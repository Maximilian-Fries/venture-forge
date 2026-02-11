/**
 * Gauntlet Agents v2: Point-Scoring Adversarial Engine
 *
 * Three-phase debate:
 * 1. Skeptic's Attack: Generate 3-5 critique points with severity ratings
 * 2. Visionary's Shield: Defend each point independently
 * 3. Jury's Gavel: Adjudicate each point independently
 *
 * Score = (Visionary Weighted Wins / Total Weighted Points) * 100
 * Weights: High=3, Medium=2, Low=1
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { VentureManifest, GauntletLensState } from '@/types/database';
import type { DebatePoint, Severity, Winner } from '@/types/debate';
import {
  LENS_CONFIGS,
  LENS_UPSTREAM_DEPENDENCIES,
  SKEPTIC_PROTOCOLS,
  VISIONARY_PROTOCOLS,
  type LensId
} from './lens-protocols';
import { getLangfuseCallback } from '@/lib/langfuse';
import {
  getPrompt,
  getLensSkepticProtocolName,
  getLensVisionaryProtocolName,
  getLensJuryProtocolName,
  getStepPromptName,
} from '@/lib/langfuse-prompts';
import {
  FALLBACK_GAUNTLET_SKEPTIC_SYSTEM,
  FALLBACK_GAUNTLET_VISIONARY_SYSTEM,
  FALLBACK_GAUNTLET_JURY_SYSTEM,
  FALLBACK_JURY_MONOPOLY_RUBRIC,
  FALLBACK_JURY_GAP_REPORT_SYSTEM,
} from '@/lib/prompts/defaults';
import { DynamicRetrievalMode } from '@google/generative-ai';
import { parseJSON, invokeWithRetry } from './utils';
import type { GapReport } from './lens-protocols';
import type { FrameworkDefinition } from '@/lib/frameworks/types';

function getModel(useSearch = false) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-google-api-key') {
    throw new Error('API key not configured');
  }

  const base = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: apiKey,
    temperature: 0.2,
    maxOutputTokens: 8192,
  });

  if (!useSearch) {
    return base;
  }

  console.log('[Gauntlet] Binding Google Search Grounding (threshold 0.7)');
  return base.bindTools([
    {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: DynamicRetrievalMode.MODE_DYNAMIC,
          dynamicThreshold: 0.7,
        },
      },
    },
  ]);
}

function buildContext(manifest: VentureManifest): string {
  return `VENTURE CONTEXT:
- Core Thesis: ${manifest.core_thesis?.statement || 'Not yet defined'}
- Secret: ${manifest.core_thesis?.zero_to_one_logic || 'Not yet defined'}
- Wedge Target: ${manifest.wedge?.target_audience || 'Not yet defined'}
- Engineering Moat: ${manifest.engineering_moat || 'Not yet defined'}
- Timing: ${manifest.timing_risks?.why_now || 'Not yet defined'}
- Vision: ${manifest.refined_vision || manifest.raw_vision || 'Not provided'}`;
}

/**
 * Build context from resolved upstream lenses for debate consistency.
 * This ensures the Skeptic, Visionary, and Jury all evaluate proposals
 * in the context of prior committed decisions.
 */
function buildUpstreamDebateContext(lensId: LensId, manifest: VentureManifest): string {
  const upstreamLenses = LENS_UPSTREAM_DEPENDENCIES[lensId];
  if (!upstreamLenses.length || !manifest.gauntlet_lenses) return '';

  const sections: string[] = [];

  for (const upstreamId of upstreamLenses) {
    const upstreamState = manifest.gauntlet_lenses[upstreamId] as GauntletLensState | undefined;
    if (!upstreamState || upstreamState.status !== 'resolved') continue;

    const resolvedText = upstreamState.userEdit || upstreamState.proposal || '';
    if (!resolvedText.trim()) continue;

    const config = LENS_CONFIGS[upstreamId];
    sections.push(`**COMMITTED ${config.title.toUpperCase()} DECISION:**
${resolvedText}`);
  }

  if (!sections.length) return '';

  return `
=== UPSTREAM COMMITTED DECISIONS ===
The founder has ALREADY committed to these positions. Any critique or defense must be CONSISTENT with these prior decisions.

${sections.join('\n\n')}
=== END UPSTREAM CONTEXT ===
`;
}

// =============================================================================
// STEP A: The Skeptic's Attack
// =============================================================================

interface CritiquePointRaw {
  claim: string;
  reasoning: string;
  severity: Severity;
  source?: string;
}

export async function generateCritiquePoints(
  lensId: LensId,
  manifest: VentureManifest,
  userProposal: string,
  pitch: string,
  sessionId?: string
): Promise<DebatePoint[]> {
  const lensConfig = LENS_CONFIGS[lensId];
  const context = buildContext(manifest);
  const upstreamContext = buildUpstreamDebateContext(lensId, manifest);

  // Fetch base Skeptic system prompt and lens-specific protocol from Langfuse
  const [baseSkepticPrompt, lensProtocol] = await Promise.all([
    getPrompt('gauntlet-skeptic-system', FALLBACK_GAUNTLET_SKEPTIC_SYSTEM),
    getPrompt(getLensSkepticProtocolName(lensId), SKEPTIC_PROTOCOLS[lensId]),
  ]);

  // Build the full system prompt with lens-specific protocol injection
  const systemPrompt = `${baseSkepticPrompt}

=== LENS CONTEXT: ${lensConfig.title.toUpperCase()} (${lensConfig.subtitle}) ===
Analyze the User's Proposal for the ${lensConfig.title} lens.

${context}
${upstreamContext}

=== LENS-SPECIFIC PROTOCOL ===
${lensProtocol}
=== END LENS PROTOCOL ===`;

  const userMessage = `USER'S PROPOSAL:
${userProposal}

FOUNDER'S PITCH:
${pitch}

Remember: Output ONLY a JSON array. Start with [ and end with ]`;

  const model = getModel(true);
  const langfuseHandler = getLangfuseCallback(sessionId);
  const callbacks = langfuseHandler ? [langfuseHandler] : undefined;

  // Use retry logic for resilience against malformed AI responses
  const rawPoints = await invokeWithRetry<CritiquePointRaw[]>(
    async () => {
      const response = await model.invoke(
        [
          new SystemMessage(systemPrompt),
          new HumanMessage(userMessage)
        ],
        { callbacks }
      );

      return typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? (response.content[0] as any).text
          : '';
    },
    (text) => parseJSON<CritiquePointRaw[]>(text),
    'generateCritiquePoints'
  );

  return rawPoints.slice(0, 5).map((p, idx) => ({
    id: `${lensId}-${Date.now()}-${idx}`,
    lensId,
    critique: {
      claim: p.claim || 'Unspecified critique',
      reasoning: p.reasoning || '',
      severity: (['high', 'medium', 'low'].includes(p.severity) ? p.severity : 'medium') as Severity,
      source: p.source,
    },
  }));
}

// =============================================================================
// STEP B: The Visionary's Shield (per-point)
// =============================================================================

interface DefenseRaw {
  rebuttal: string;
  reasoning: string;
  source?: string;
}

export async function generateDefense(
  lensId: LensId,
  manifest: VentureManifest,
  userProposal: string,
  pitch: string,
  point: DebatePoint,
  sessionId?: string
): Promise<DebatePoint> {
  const lensConfig = LENS_CONFIGS[lensId];
  const context = buildContext(manifest);
  const upstreamContext = buildUpstreamDebateContext(lensId, manifest);

  // Fetch base Visionary system prompt and lens-specific protocol from Langfuse
  const [baseVisionaryPrompt, lensProtocol] = await Promise.all([
    getPrompt('gauntlet-visionary-system', FALLBACK_GAUNTLET_VISIONARY_SYSTEM),
    getPrompt(getLensVisionaryProtocolName(lensId), VISIONARY_PROTOCOLS[lensId]),
  ]);

  // Build the full system prompt with lens-specific protocol injection
  const systemPrompt = `${baseVisionaryPrompt}

=== LENS CONTEXT: ${lensConfig.title.toUpperCase()} (${lensConfig.subtitle}) ===
Defend against this SPECIFIC critique regarding ${lensConfig.title}.

${context}
${upstreamContext}

=== LENS-SPECIFIC PROTOCOL ===
${lensProtocol}
=== END LENS PROTOCOL ===`;

  const userMessage = `USER'S PROPOSAL:
${userProposal}

FOUNDER'S PITCH:
${pitch}

**The Attack** (Severity: ${point.critique.severity}):
"${point.critique.claim}"
${point.critique.reasoning}

Remember: Output ONLY a JSON object. Start with { and end with }`;

  const model = getModel(true);
  const langfuseHandler = getLangfuseCallback(sessionId);
  const callbacks = langfuseHandler ? [langfuseHandler] : undefined;

  // Use retry logic for resilience against malformed AI responses
  const defense = await invokeWithRetry<DefenseRaw>(
    async () => {
      const response = await model.invoke(
        [
          new SystemMessage(systemPrompt),
          new HumanMessage(userMessage)
        ],
        { callbacks }
      );

      return typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? (response.content[0] as any).text
          : '';
    },
    (text) => parseJSON<DefenseRaw>(text),
    `generateDefense:${point.id}`
  );

  return {
    ...point,
    defense: {
      rebuttal: defense.rebuttal || 'No rebuttal provided',
      reasoning: defense.reasoning || '',
      source: defense.source,
    },
  };
}

/**
 * Generate defenses for all points in parallel.
 */
export async function generateAllDefenses(
  lensId: LensId,
  manifest: VentureManifest,
  userProposal: string,
  pitch: string,
  points: DebatePoint[],
  sessionId?: string
): Promise<DebatePoint[]> {
  const results = await Promise.all(
    points.map(point =>
      generateDefense(lensId, manifest, userProposal, pitch, point, sessionId)
    )
  );
  return results;
}

// =============================================================================
// STEP C: The Jury's Gavel (per-point)
// =============================================================================

interface VerdictRaw {
  winner: Winner;
  reasoning: string;
  checklist?: {
    grounding: string;
    vague_ban: string;
    inflation: string;
    refutation: string;
  };
}

export async function adjudicatePoint(
  lensId: LensId,
  manifest: VentureManifest,
  userProposal: string,
  point: DebatePoint,
  sessionId?: string
): Promise<DebatePoint> {
  if (!point.defense) return point;

  const lensConfig = LENS_CONFIGS[lensId];
  const context = buildContext(manifest);
  const upstreamContext = buildUpstreamDebateContext(lensId, manifest);

  // Fetch base Jury system prompt from Langfuse
  // For Monopoly lens, also fetch the lens-specific jury rubric
  const promptFetches: Promise<string>[] = [
    getPrompt('gauntlet-jury-system', FALLBACK_GAUNTLET_JURY_SYSTEM),
  ];

  if (lensId === 'monopoly') {
    promptFetches.push(
      getPrompt(getLensJuryProtocolName(lensId), FALLBACK_JURY_MONOPOLY_RUBRIC)
    );
  }

  const [baseJuryPrompt, lensJuryRubric] = await Promise.all(promptFetches);

  // Build the full system prompt with lens-specific rubric injection
  const systemPrompt = `${baseJuryPrompt}

=== LENS CONTEXT: ${lensConfig.title.toUpperCase()} (${lensConfig.subtitle}) ===
Adjudicate this specific point of contention for the ${lensConfig.title} lens.

${context}
${upstreamContext}
${lensJuryRubric ? `
=== LENS-SPECIFIC JURY RUBRIC ===
${lensJuryRubric}
=== END LENS RUBRIC ===
` : ''}`;

  const userMessage = `USER'S PROPOSAL:
${userProposal}

**The Attack** (Severity: ${point.critique.severity}):
Claim: "${point.critique.claim}"
Reasoning: ${point.critique.reasoning}
${point.critique.source ? `Source: ${point.critique.source}` : ''}

**The Defense**:
Rebuttal: "${point.defense.rebuttal}"
Reasoning: ${point.defense.reasoning}
${point.defense.source ? `Evidence: ${point.defense.source}` : 'Evidence: None provided'}

Remember: Output ONLY a JSON object. Start with { and end with }`;

  const model = getModel(true);
  const langfuseHandler = getLangfuseCallback(sessionId);
  const callbacks = langfuseHandler ? [langfuseHandler] : undefined;

  // Use retry logic for resilience against malformed AI responses
  const verdict = await invokeWithRetry<VerdictRaw>(
    async () => {
      const response = await model.invoke(
        [
          new SystemMessage(systemPrompt),
          new HumanMessage(userMessage)
        ],
        { callbacks }
      );

      return typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? (response.content[0] as any).text
          : '';
    },
    (text) => parseJSON<VerdictRaw>(text),
    `adjudicatePoint:${point.id}`
  );

  return {
    ...point,
    verdict: {
      winner: verdict.winner === 'visionary' ? 'visionary' : 'skeptic',
      reasoning: verdict.reasoning || 'No reasoning provided',
      checklist: verdict.checklist,
    },
  };
}

/**
 * Adjudicate all points in parallel.
 */
export async function adjudicateAllPoints(
  lensId: LensId,
  manifest: VentureManifest,
  userProposal: string,
  points: DebatePoint[],
  sessionId?: string
): Promise<DebatePoint[]> {
  const results = await Promise.all(
    points.map(point =>
      adjudicatePoint(lensId, manifest, userProposal, point, sessionId)
    )
  );
  return results;
}

// =============================================================================
// POST-JURY GAP REPORT: Structural failure detection
// =============================================================================

/** Lenses eligible for post-jury gap reports */
const GAP_REPORT_LENSES: LensId[] = ['engineering', 'timing', 'monopoly', 'distribution'];

/**
 * Determine if a gap report should be issued after jury adjudication.
 * Triggers when ANY debate point has high severity AND the skeptic won.
 */
export function shouldIssueGapReport(lensId: LensId, judgedPoints: DebatePoint[]): boolean {
  if (!GAP_REPORT_LENSES.includes(lensId)) return false;

  return judgedPoints.some(
    p => p.critique.severity === 'high' && p.verdict?.winner === 'skeptic'
  );
}

/**
 * Generate a Gap Report synthesized from failed high-severity debate points.
 * Makes one additional AI call to produce a coherent gap report from the debate failures.
 */
export async function generateJuryGapReport(
  lensId: LensId,
  manifest: VentureManifest,
  userProposal: string,
  judgedPoints: DebatePoint[],
  sessionId?: string
): Promise<GapReport> {
  // Filter to high-severity skeptic wins
  const failedPoints = judgedPoints.filter(
    p => p.critique.severity === 'high' && p.verdict?.winner === 'skeptic'
  );

  const lensConfig = LENS_CONFIGS[lensId];

  // Build context of failed points for the synthesis prompt
  const failedPointsSummary = failedPoints.map((p, idx) => {
    return `${idx + 1}. ATTACK: "${p.critique.claim}"
   Reasoning: ${p.critique.reasoning}
   DEFENSE: "${p.defense?.rebuttal || 'No defense'}"
   JURY RULING: Skeptic wins — ${p.verdict?.reasoning || 'No reasoning'}`;
  }).join('\n\n');

  // Fetch gap report synthesis prompt from Langfuse
  const systemPrompt = await getPrompt(
    'gauntlet-jury-gap-report',
    FALLBACK_JURY_GAP_REPORT_SYSTEM
  );

  const userMessage = `LENS: ${lensConfig.title} (${lensConfig.subtitle})

USER'S PROPOSAL:
${userProposal}

=== FAILED HIGH-SEVERITY DEBATE POINTS ===
${failedPointsSummary}
=== END FAILED POINTS ===

Synthesize these failures into a single Gap Report. Output JSON only.`;

  const model = getModel();
  const langfuseHandler = getLangfuseCallback(sessionId);
  const callbacks = langfuseHandler ? [langfuseHandler] : undefined;

  const gapReport = await invokeWithRetry<GapReport>(
    async () => {
      const response = await model.invoke(
        [
          new SystemMessage(systemPrompt),
          new HumanMessage(userMessage)
        ],
        { callbacks }
      );

      return typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? (response.content[0] as any).text
          : '';
    },
    (text) => parseJSON<GapReport>(text),
    `generateJuryGapReport:${lensId}`
  );

  // Ensure hypotheses array exists
  return {
    missing_element: gapReport.missing_element || 'Structural Weakness',
    reason: gapReport.reason || 'The debate revealed unresolved critical weaknesses.',
    hypotheses: Array.isArray(gapReport.hypotheses)
      ? gapReport.hypotheses
      : [],
  };
}

// =============================================================================
// FRAMEWORK-AWARE AGENT FUNCTIONS
// =============================================================================

/**
 * Build upstream debate context using framework's dependency graph and context builder.
 */
function buildUpstreamDebateContextForFramework(
  framework: FrameworkDefinition,
  stepId: string,
  manifest: VentureManifest,
  gauntletLenses?: Record<string, GauntletLensState>
): string {
  const upstreamSteps = framework.upstreamDependencies[stepId] || [];
  const lenses = gauntletLenses || manifest.gauntlet_lenses;
  if (!upstreamSteps.length || !lenses) return '';

  const sections: string[] = [];
  const stepMap = new Map(framework.steps.map(s => [s.id, s]));

  for (const upstreamId of upstreamSteps) {
    const upstreamState = lenses[upstreamId] as GauntletLensState | undefined;
    if (!upstreamState || upstreamState.status !== 'resolved') continue;

    const resolvedText = upstreamState.userEdit || upstreamState.proposal || '';
    if (!resolvedText.trim()) continue;

    const step = stepMap.get(upstreamId);
    const title = step?.title?.toUpperCase() || upstreamId.toUpperCase();
    sections.push(`**COMMITTED ${title} DECISION:**\n${resolvedText}`);
  }

  if (!sections.length) return '';

  return `\n=== UPSTREAM COMMITTED DECISIONS ===\nThe founder has ALREADY committed to these positions. Any critique or defense must be CONSISTENT with these prior decisions.\n\n${sections.join('\n\n')}\n=== END UPSTREAM CONTEXT ===\n`;
}

/**
 * Framework-aware critique generation.
 */
export async function generateCritiquePointsForFramework(
  framework: FrameworkDefinition,
  stepId: string,
  manifest: VentureManifest,
  userProposal: string,
  pitch: string,
  sessionId?: string,
  gauntletLenses?: Record<string, GauntletLensState>
): Promise<DebatePoint[]> {
  const step = framework.steps.find(s => s.id === stepId);
  const stepProtocol = framework.stepProtocols[stepId];
  if (!step || !stepProtocol) {
    throw new Error(`Step "${stepId}" not found in framework "${framework.id}"`);
  }

  const context = buildContext(manifest);
  const upstreamContext = buildUpstreamDebateContextForFramework(framework, stepId, manifest, gauntletLenses);

  const skepticRole = framework.agentRoles.find(r => r.id === 'skeptic');
  const baseSkepticPrompt = skepticRole
    ? await getPrompt(getStepPromptName(framework, stepId, 'skeptic-system'), skepticRole.systemPrompt)
    : await getPrompt('gauntlet-skeptic-system', FALLBACK_GAUNTLET_SKEPTIC_SYSTEM);

  const lensProtocol = await getPrompt(
    getStepPromptName(framework, stepId, 'skeptic'),
    stepProtocol.agentProtocols.skeptic || ''
  );

  const systemPrompt = `${baseSkepticPrompt}\n\n=== STEP CONTEXT: ${step.title.toUpperCase()} (${step.subtitle}) ===\nAnalyze the User's Proposal for the ${step.title} step.\n\n${context}\n${upstreamContext}\n\n=== STEP-SPECIFIC PROTOCOL ===\n${lensProtocol}\n=== END STEP PROTOCOL ===`;

  const userMessage = `USER'S PROPOSAL:\n${userProposal}\n\nFOUNDER'S PITCH:\n${pitch}\n\nRemember: Output ONLY a JSON array. Start with [ and end with ]`;

  const model = getModel(true);
  const langfuseHandler = getLangfuseCallback(sessionId);
  const callbacks = langfuseHandler ? [langfuseHandler] : undefined;

  const rawPoints = await invokeWithRetry<CritiquePointRaw[]>(
    async () => {
      const response = await model.invoke(
        [new SystemMessage(systemPrompt), new HumanMessage(userMessage)],
        { callbacks }
      );
      return typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? (response.content[0] as any).text
          : '';
    },
    (text) => parseJSON<CritiquePointRaw[]>(text),
    `generateCritiquePointsForFramework:${framework.id}/${stepId}`
  );

  return rawPoints.slice(0, 5).map((p, idx) => ({
    id: `${stepId}-${Date.now()}-${idx}`,
    lensId: stepId,
    critique: {
      claim: p.claim || 'Unspecified critique',
      reasoning: p.reasoning || '',
      severity: (['high', 'medium', 'low'].includes(p.severity) ? p.severity : 'medium') as Severity,
      source: p.source,
    },
  }));
}

/**
 * Framework-aware defense generation.
 */
export async function generateDefenseForFramework(
  framework: FrameworkDefinition,
  stepId: string,
  manifest: VentureManifest,
  userProposal: string,
  pitch: string,
  point: DebatePoint,
  sessionId?: string,
  gauntletLenses?: Record<string, GauntletLensState>
): Promise<DebatePoint> {
  const step = framework.steps.find(s => s.id === stepId);
  const stepProtocol = framework.stepProtocols[stepId];
  if (!step || !stepProtocol) {
    throw new Error(`Step "${stepId}" not found in framework "${framework.id}"`);
  }

  const context = buildContext(manifest);
  const upstreamContext = buildUpstreamDebateContextForFramework(framework, stepId, manifest, gauntletLenses);

  const visionaryRole = framework.agentRoles.find(r => r.id === 'visionary');
  const baseVisionaryPrompt = visionaryRole
    ? await getPrompt(getStepPromptName(framework, stepId, 'visionary-system'), visionaryRole.systemPrompt)
    : await getPrompt('gauntlet-visionary-system', FALLBACK_GAUNTLET_VISIONARY_SYSTEM);

  const lensProtocol = await getPrompt(
    getStepPromptName(framework, stepId, 'visionary'),
    stepProtocol.agentProtocols.visionary || ''
  );

  const systemPrompt = `${baseVisionaryPrompt}\n\n=== STEP CONTEXT: ${step.title.toUpperCase()} (${step.subtitle}) ===\nDefend against this SPECIFIC critique regarding ${step.title}.\n\n${context}\n${upstreamContext}\n\n=== STEP-SPECIFIC PROTOCOL ===\n${lensProtocol}\n=== END STEP PROTOCOL ===`;

  const userMessage = `USER'S PROPOSAL:\n${userProposal}\n\nFOUNDER'S PITCH:\n${pitch}\n\n**The Attack** (Severity: ${point.critique.severity}):\n"${point.critique.claim}"\n${point.critique.reasoning}\n\nRemember: Output ONLY a JSON object. Start with { and end with }`;

  const model = getModel(true);
  const langfuseHandler = getLangfuseCallback(sessionId);
  const callbacks = langfuseHandler ? [langfuseHandler] : undefined;

  const defense = await invokeWithRetry<DefenseRaw>(
    async () => {
      const response = await model.invoke(
        [new SystemMessage(systemPrompt), new HumanMessage(userMessage)],
        { callbacks }
      );
      return typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? (response.content[0] as any).text
          : '';
    },
    (text) => parseJSON<DefenseRaw>(text),
    `generateDefenseForFramework:${point.id}`
  );

  return {
    ...point,
    defense: {
      rebuttal: defense.rebuttal || 'No rebuttal provided',
      reasoning: defense.reasoning || '',
      source: defense.source,
    },
  };
}

/**
 * Generate defenses for all points using framework-aware logic.
 */
export async function generateAllDefensesForFramework(
  framework: FrameworkDefinition,
  stepId: string,
  manifest: VentureManifest,
  userProposal: string,
  pitch: string,
  points: DebatePoint[],
  sessionId?: string,
  gauntletLenses?: Record<string, GauntletLensState>
): Promise<DebatePoint[]> {
  return Promise.all(
    points.map(point =>
      generateDefenseForFramework(framework, stepId, manifest, userProposal, pitch, point, sessionId, gauntletLenses)
    )
  );
}

/**
 * Framework-aware adjudication.
 */
export async function adjudicatePointForFramework(
  framework: FrameworkDefinition,
  stepId: string,
  manifest: VentureManifest,
  userProposal: string,
  point: DebatePoint,
  sessionId?: string,
  gauntletLenses?: Record<string, GauntletLensState>
): Promise<DebatePoint> {
  if (!point.defense) return point;

  const step = framework.steps.find(s => s.id === stepId);
  if (!step) throw new Error(`Step "${stepId}" not found in framework "${framework.id}"`);

  const context = buildContext(manifest);
  const upstreamContext = buildUpstreamDebateContextForFramework(framework, stepId, manifest, gauntletLenses);

  const juryRole = framework.agentRoles.find(r => r.id === 'jury');
  const baseJuryPrompt = juryRole
    ? await getPrompt(getStepPromptName(framework, stepId, 'jury-system'), juryRole.systemPrompt)
    : await getPrompt('gauntlet-jury-system', FALLBACK_GAUNTLET_JURY_SYSTEM);

  const systemPrompt = `${baseJuryPrompt}\n\n=== STEP CONTEXT: ${step.title.toUpperCase()} (${step.subtitle}) ===\nAdjudicate this specific point of contention for the ${step.title} step.\n\n${context}\n${upstreamContext}`;

  const userMessage = `USER'S PROPOSAL:\n${userProposal}\n\n**The Attack** (Severity: ${point.critique.severity}):\nClaim: "${point.critique.claim}"\nReasoning: ${point.critique.reasoning}\n${point.critique.source ? `Source: ${point.critique.source}` : ''}\n\n**The Defense**:\nRebuttal: "${point.defense.rebuttal}"\nReasoning: ${point.defense.reasoning}\n${point.defense.source ? `Evidence: ${point.defense.source}` : 'Evidence: None provided'}\n\nRemember: Output ONLY a JSON object. Start with { and end with }`;

  const model = getModel(true);
  const langfuseHandler = getLangfuseCallback(sessionId);
  const callbacks = langfuseHandler ? [langfuseHandler] : undefined;

  const verdict = await invokeWithRetry<VerdictRaw>(
    async () => {
      const response = await model.invoke(
        [new SystemMessage(systemPrompt), new HumanMessage(userMessage)],
        { callbacks }
      );
      return typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? (response.content[0] as any).text
          : '';
    },
    (text) => parseJSON<VerdictRaw>(text),
    `adjudicatePointForFramework:${point.id}`
  );

  return {
    ...point,
    verdict: {
      winner: verdict.winner === 'visionary' ? 'visionary' : 'skeptic',
      reasoning: verdict.reasoning || 'No reasoning provided',
      checklist: verdict.checklist,
    },
  };
}

/**
 * Adjudicate all points using framework-aware logic.
 */
export async function adjudicateAllPointsForFramework(
  framework: FrameworkDefinition,
  stepId: string,
  manifest: VentureManifest,
  userProposal: string,
  points: DebatePoint[],
  sessionId?: string,
  gauntletLenses?: Record<string, GauntletLensState>
): Promise<DebatePoint[]> {
  return Promise.all(
    points.map(point =>
      adjudicatePointForFramework(framework, stepId, manifest, userProposal, point, sessionId, gauntletLenses)
    )
  );
}
