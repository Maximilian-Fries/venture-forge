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
} from '@/lib/langfuse-prompts';
import {
  FALLBACK_GAUNTLET_SKEPTIC_SYSTEM,
  FALLBACK_GAUNTLET_VISIONARY_SYSTEM,
  FALLBACK_GAUNTLET_JURY_SYSTEM,
  FALLBACK_JURY_MONOPOLY_RUBRIC,
} from '@/lib/prompts/defaults';

function getModel() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-google-api-key') {
    throw new Error('API key not configured');
  }

  console.log('[Gauntlet] Using model: gemini-2.5-flash');
  return new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: apiKey,
    temperature: 0.2,
    maxOutputTokens: 8192,
  });
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

/**
 * Custom error class for AI response parsing failures.
 * Provides user-friendly messages while preserving technical details for debugging.
 */
class AIResponseParseError extends Error {
  public readonly isRetryable: boolean;

  constructor(message: string, public readonly rawResponse: string, isRetryable = true) {
    super(message);
    this.name = 'AIResponseParseError';
    this.isRetryable = isRetryable;
  }
}

/**
 * Maximum number of automatic retries for failed API calls.
 */
const MAX_RETRIES = 2;

/**
 * Delay between retries in milliseconds (increases with each retry).
 */
const RETRY_DELAY_MS = 1000;

/**
 * Safely parse JSON from an LLM response.
 * Handles markdown code fences, trailing commas, and provides user-friendly errors.
 */
function parseJSON<T>(raw: string): T {
  if (!raw || typeof raw !== 'string') {
    throw new AIResponseParseError(
      'The AI returned an empty response. Please try again.',
      raw || ''
    );
  }

  let cleaned = raw.trim();

  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Try to find JSON array or object in the response
  if (!cleaned.startsWith('[') && !cleaned.startsWith('{')) {
    const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) {
      cleaned = match[1];
    } else {
      // No JSON found - the AI returned plain text instead
      console.warn('[parseJSON] AI returned plain text instead of JSON:', raw.substring(0, 200));
      throw new AIResponseParseError(
        'The AI returned an unexpected response format. Retrying...',
        raw,
        true // retryable
      );
    }
  }

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(cleaned) as T;
  } catch (parseError) {
    // Log the actual error for debugging but show user-friendly message
    console.error('[parseJSON] JSON parse failed:', parseError);
    console.error('[parseJSON] Attempted to parse:', cleaned.substring(0, 500));
    throw new AIResponseParseError(
      'The AI response could not be processed. Retrying...',
      raw,
      true // retryable
    );
  }
}

/**
 * Helper to invoke the model and parse the JSON response with automatic retries.
 * Retries up to MAX_RETRIES times on parse failures before giving up.
 */
async function invokeWithRetry<T>(
  invoker: () => Promise<string>,
  parser: (text: string) => T,
  context: string // For logging
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const text = await invoker();
      return parser(text);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = error instanceof AIResponseParseError && error.isRetryable;
      const attemptsLeft = MAX_RETRIES - attempt;

      if (isRetryable && attemptsLeft > 0) {
        console.warn(`[${context}] Attempt ${attempt + 1} failed, retrying (${attemptsLeft} attempts left)...`);
        // Wait before retrying, with increasing delay
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }

      // No more retries or non-retryable error
      break;
    }
  }

  // All retries exhausted - throw user-friendly error
  console.error(`[${context}] All ${MAX_RETRIES + 1} attempts failed`);
  throw new AIResponseParseError(
    'The AI could not generate a valid response after multiple attempts. Please try again later.',
    lastError instanceof AIResponseParseError ? lastError.rawResponse : '',
    false // not retryable
  );
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
  pitch: string
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

  const model = getModel();
  const langfuseHandler = getLangfuseCallback();
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
  point: DebatePoint
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

  const model = getModel();
  const langfuseHandler = getLangfuseCallback();
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
  points: DebatePoint[]
): Promise<DebatePoint[]> {
  const results = await Promise.all(
    points.map(point =>
      generateDefense(lensId, manifest, userProposal, pitch, point)
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
}

export async function adjudicatePoint(
  lensId: LensId,
  manifest: VentureManifest,
  userProposal: string,
  point: DebatePoint
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

  const model = getModel();
  const langfuseHandler = getLangfuseCallback();
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
  points: DebatePoint[]
): Promise<DebatePoint[]> {
  const results = await Promise.all(
    points.map(point =>
      adjudicatePoint(lensId, manifest, userProposal, point)
    )
  );
  return results;
}
