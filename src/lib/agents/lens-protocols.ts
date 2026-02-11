/**
 * Lens Protocols: Hot-Swap prompt system for the 7-step Gauntlet.
 *
 * Each lens has:
 * - A specific system prompt for the Visionary
 * - A specific system prompt for the Skeptic
 * - A proposal generator prompt (AI Proposal step)
 * - Traps/anti-patterns to flag
 *
 * Prompts are fetched from Langfuse with local fallbacks.
 */

import type { VentureManifest, GauntletLensState } from '@/types/database';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { getLangfuseCallback } from '@/lib/langfuse';
import {
  getPrompt,
  getLensProposalPromptName,
  getLensVisionaryProtocolName,
  getLensSkepticProtocolName,
  getStepPromptName,
} from '@/lib/langfuse-prompts';
import type { FrameworkDefinition } from '@/lib/frameworks/types';

import { LensId, LENS_ORDER } from '@/types/lenses';

// ============================================================================
// GAP REPORT TYPES - Analytic Fidelity Protocol
// ============================================================================

/**
 * Gap Report: Returned when the input fails the Binary Check for a lens.
 * Instead of fabricating a mediocre proposal, the system returns a structured
 * report explaining what's missing and offering strategic pivots.
 */
export interface GapReport {
  missing_element: string;  // The specific Atomic Unit missing (e.g., "Trigger Event")
  reason: string;           // Why the input failed the Binary Check
  hypotheses: string[];     // 2-3 strategic pivots tagged with [HYPOTHESIS]
}

/**
 * The result of generateLensProposal - either a successful draft or a gap report.
 */
export type LensProposalResult =
  | { status: 'success'; content: string }
  | { status: 'gap_detected'; gapReport: GapReport };

/**
 * Custom error for AI response parsing failures.
 */
export class AIResponseParseError extends Error {
  constructor(message: string, public rawResponse: string) {
    super(message);
    this.name = 'AIResponseParseError';
  }
}
import {
  PROPOSAL_PROMPTS as PROPOSAL_PROMPTS_DEFAULT,
  VISIONARY_PROTOCOLS as VISIONARY_PROTOCOLS_DEFAULT,
  SKEPTIC_PROTOCOLS as SKEPTIC_PROTOCOLS_DEFAULT,
} from '@/lib/prompts/defaults';

export type { LensId };

export interface LensConfig {
  id: LensId;
  title: string;
  subtitle: string;
  question: string;
  icon: string; // lucide icon name
  color: string; // tailwind color class
  bgColor: string;
  borderColor: string;
}

export interface LensProtocol {
  lens: LensConfig;
  proposalPrompt: string;
  visionaryPrompt: string;
  skepticPrompt: string;
  traps: string[];
}

// LENS_ORDER is imported from @/types/lenses

/**
 * Lens Dependency Graph: Which upstream lenses should inform each lens?
 * This is used for context-aware prompt engineering.
 */
export const LENS_UPSTREAM_DEPENDENCIES: Record<LensId, LensId[]> = {
  engineering: [],                                              // First lens, no dependencies
  timing: ['engineering'],                                      // Timing should know the engineering moat
  monopoly: ['engineering'],                                    // Monopoly wedge depends on engineering moat
  people: ['engineering', 'monopoly'],                          // Team fit depends on moat + wedge
  distribution: ['monopoly', 'engineering', 'timing'],          // Distribution must reach the wedge + account for timing window
  durability: ['engineering', 'monopoly', 'distribution', 'timing'], // Durability = Last Mover; timing window must CLOSE
  secrets: ['engineering', 'monopoly', 'timing', 'distribution'], // Secret synthesizes ALL prior commitments
};

export const LENS_CONFIGS: Record<LensId, LensConfig> = {
  engineering: {
    id: 'engineering',
    title: 'Engineering',
    subtitle: 'The 10x Test',
    question: 'Can you create breakthrough technology, not just incremental improvements?',
    icon: 'Zap',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
  },
  timing: {
    id: 'timing',
    title: 'Timing',
    subtitle: 'Why Now',
    question: 'Is now the right time to start this particular company?',
    icon: 'Clock',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  monopoly: {
    id: 'monopoly',
    title: 'Monopoly',
    subtitle: 'Dominatability Standard',
    question: 'Can you dominate a market so small that every participant is identifiable?',
    icon: 'Target',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  people: {
    id: 'people',
    title: 'People',
    subtitle: 'The Team',
    question: 'Do you have the right team with unique founder-market fit?',
    icon: 'Users',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
  },
  distribution: {
    id: 'distribution',
    title: 'Distribution',
    subtitle: 'Go-to-Market',
    question: 'Do you have a way to deliver your product, not just create it?',
    icon: 'Truck',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  durability: {
    id: 'durability',
    title: 'Durability',
    subtitle: 'Last Mover',
    question: 'Will your market position be defensible 10-20 years into the future?',
    icon: 'ShieldCheck',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
  },
  secrets: {
    id: 'secrets',
    title: 'Secrets',
    subtitle: 'Contrarian Truth',
    question: 'Have you identified a unique opportunity that others don\'t see?',
    icon: 'Eye',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
};

function getModel() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-google-api-key') {
    throw new Error('API key not configured');
  }

  console.log('[LensProtocols] Using model: gemini-2.5-flash');
  return new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: apiKey,
    temperature: 0.7,
    maxOutputTokens: 4096,
  });
}

/**
 * Mapping of manifest fields to the lens that produces them.
 * Used to enforce the dependency graph when building context.
 */
const MANIFEST_FIELD_SOURCE: Record<string, LensId> = {
  engineering_moat: 'engineering',
  timing_why_now: 'timing',
  wedge_target: 'monopoly',
  wedge_expansion: 'monopoly',
  core_thesis_statement: 'secrets',
  core_thesis_logic: 'secrets',
};

/**
 * Build manifest context respecting the DAG dependency structure.
 * A lens should ONLY see context from its upstream dependencies.
 * This prevents context leakage (e.g., Engineering seeing Monopoly/Secrets data).
 *
 * NOTE: Raw Vision and Refined Vision are NOT included here because they are
 * already appended as "FOUNDER'S PITCH" in generateLensProposal. Including them
 * here would be redundant.
 *
 * @param manifest - The venture manifest
 * @param forLensId - The lens this context is being built FOR
 * @returns Context string with only upstream-permitted fields, or empty string if no upstream deps
 */
function buildManifestContext(manifest: VentureManifest, forLensId: LensId): string {
  // Get the upstream dependencies for this lens
  const upstreamDeps = LENS_UPSTREAM_DEPENDENCIES[forLensId];

  // If no upstream dependencies (e.g., Engineering), return empty string.
  // The lens will receive only the FOUNDER'S PITCH.
  if (upstreamDeps.length === 0) {
    return '';
  }

  // A lens can see a field only if the field's source lens is in this lens's upstream dependencies
  const canSeeField = (fieldSource: LensId): boolean => {
    return upstreamDeps.includes(fieldSource);
  };

  // Build context with only permitted fields from upstream lenses
  const lines: string[] = ['UPSTREAM CONTEXT (Committed Decisions):'];

  // Engineering Moat - only if engineering is upstream
  if (canSeeField(MANIFEST_FIELD_SOURCE.engineering_moat)) {
    lines.push(`- Engineering Moat: ${manifest.engineering_moat || 'Not yet defined'}`);
  }

  // Timing - only if timing is upstream
  if (canSeeField(MANIFEST_FIELD_SOURCE.timing_why_now)) {
    lines.push(`- Timing (Why Now): ${manifest.timing_risks?.why_now || 'Not yet defined'}`);
  }

  // Monopoly/Wedge - only if monopoly is upstream
  if (canSeeField(MANIFEST_FIELD_SOURCE.wedge_target)) {
    lines.push(`- Wedge Target: ${manifest.wedge?.target_audience || 'Not yet defined'}`);
    lines.push(`- Expansion Path: ${manifest.wedge?.expansion_path || 'Not yet defined'}`);
  }

  // Secrets/Core Thesis - only if secrets is upstream (which is never, secrets is terminal)
  if (canSeeField(MANIFEST_FIELD_SOURCE.core_thesis_statement)) {
    lines.push(`- Core Thesis: ${manifest.core_thesis?.statement || 'Not yet defined'}`);
    lines.push(`- Secret (0-to-1 Logic): ${manifest.core_thesis?.zero_to_one_logic || 'Not yet defined'}`);
  }

  // If only header was added (no actual fields), return empty
  if (lines.length === 1) {
    return '';
  }

  return lines.join('\n');
}

/**
 * Build context from resolved upstream lenses.
 * This enforces intellectual rigor by making downstream lenses explicitly
 * reference the specific outcomes of upstream lenses.
 */
function buildUpstreamContext(lensId: LensId, manifest: VentureManifest): string {
  const upstreamLenses = LENS_UPSTREAM_DEPENDENCIES[lensId];
  if (!upstreamLenses.length || !manifest.gauntlet_lenses) return '';

  const sections: string[] = [];

  for (const upstreamId of upstreamLenses) {
    const upstreamState = manifest.gauntlet_lenses[upstreamId] as GauntletLensState | undefined;
    if (!upstreamState || upstreamState.status !== 'resolved') continue;

    const resolvedText = upstreamState.userEdit || upstreamState.proposal || '';
    if (!resolvedText.trim()) continue;

    const config = LENS_CONFIGS[upstreamId];
    sections.push(`### COMMITTED ${config.title.toUpperCase()} DECISION (Resolved)
${resolvedText}
---`);
  }

  if (!sections.length) return '';

  return `
=== UPSTREAM CONTEXT: COMMITTED DECISIONS ===
You MUST design your proposal to be CONSISTENT with these prior lens decisions.
Do NOT contradict or ignore these resolved positions.

${sections.join('\n\n')}
=== END UPSTREAM CONTEXT ===
`;
}

// ============================================================================
// PROPOSAL PROMPTS - Generate AI draft for user to edit
// These are also used as fallbacks when Langfuse is unavailable
// ============================================================================

export const PROPOSAL_PROMPTS = PROPOSAL_PROMPTS_DEFAULT;

// ============================================================================
// VISIONARY PROTOCOLS - Hot-swapped into Visionary agent per lens
// These are also used as fallbacks when Langfuse is unavailable
// ============================================================================

export const VISIONARY_PROTOCOLS = VISIONARY_PROTOCOLS_DEFAULT;

// ============================================================================
// SKEPTIC PROTOCOLS - Hot-swapped into Skeptic agent per lens
// These are also used as fallbacks when Langfuse is unavailable
// ============================================================================

export const SKEPTIC_PROTOCOLS = SKEPTIC_PROTOCOLS_DEFAULT;

// ============================================================================
// LENS TRAPS - Quick reference for each lens
// ============================================================================

const LENS_TRAPS: Record<LensId, string[]> = {
  engineering: [
    'Incremental improvement disguised as breakthrough',
    'Commodity AI/ML without proprietary data',
    'Feature of existing product, not standalone',
    'Replicable by big tech in months',
    'No clear 10x metric identified',
  ],
  timing: [
    'Market not actually ready yet',
    'Incumbents already moving on this',
    'Timing trigger is vague or already happened',
    'Dependent on uncertain external event',
    'Same opportunity existed 3 years ago',
  ],
  monopoly: [
    'Boundary too fuzzy to prove Directory Test',
    '80% market share unreachable in 12 months',
    'Pain is "nice-to-have" not 10x for THIS wedge',
    'Incumbents will notice once you prove demand',
    'Sequencing asset has no gravity well effect',
  ],
  people: [
    'Credentials irrelevant to this market',
    'Missing critical technical/domain skill',
    'No evidence of long-term commitment',
    'Team too homogeneous in perspective',
    'All vision, no execution capability',
  ],
  distribution: [
    'No specific acquisition channel identified',
    'Growth plan relies on "going viral"',
    'Unit economics unproven or negative',
    'Platform dependency risk (Google/Apple)',
    'No backup if primary channel fails',
    'Channel is saturated/closing (last war trap)',
    'Channel doesn\'t match committed wedge audience',
    'Timing mismatch: channel lifecycle vs timing thesis',
  ],
  durability: [
    'Moat easily overcome by capital',
    'Technology could become obsolete',
    'No compounding/flywheel mechanism',
    'Switching costs lower than claimed',
    'Regulatory change could kill business',
    'Timing window stays open for competitors',
    'Accumulated asset is replicable/purchasable',
    'Timing trigger disconnected from flywheel',
  ],
  secrets: [
    'Secret is actually conventional wisdom',
    'Cannot be validated with evidence',
    'Others tried this and failed',
    'True but not actionable as business',
    'Confirmation bias in evidence cited',
    'Fails to synthesize all four commitments',
    'No emergent value from combination',
    'Disconnected from prior lens decisions',
  ],
};

// ============================================================================
// BUILD LENS PROTOCOL - The Hot-Swap function
// ============================================================================

export function buildLensProtocol(lensId: LensId, manifest: VentureManifest, peopleInput?: string): LensProtocol {
  const config = LENS_CONFIGS[lensId];
  const context = buildManifestContext(manifest, lensId);
  const upstreamContext = buildUpstreamContext(lensId, manifest);

  let proposalPrompt = PROPOSAL_PROMPTS[lensId]
    .replace('{MANIFEST}', context)
    .replace('{UPSTREAM_CONTEXT}', upstreamContext);

  if (lensId === 'people' && peopleInput) {
    proposalPrompt = proposalPrompt.replace('{PEOPLE_INPUT}', peopleInput);
  } else if (lensId === 'people') {
    proposalPrompt = proposalPrompt.replace('{PEOPLE_INPUT}', 'Not provided yet - generate based on available context.');
  }

  return {
    lens: config,
    proposalPrompt,
    visionaryPrompt: VISIONARY_PROTOCOLS[lensId],
    skepticPrompt: SKEPTIC_PROTOCOLS[lensId],
    traps: LENS_TRAPS[lensId],
  };
}

/**
 * Sync resolved lens data to the global manifest.
 * This is called when a lens is resolved to persist the decision
 * to the appropriate manifest field for downstream context.
 */
export function getLensSyncFields(lensId: LensId, resolvedText: string): Partial<VentureManifest> {
  switch (lensId) {
    case 'engineering':
      return { engineering_moat: resolvedText };
    case 'monopoly':
      return {
        wedge: {
          target_audience: resolvedText,
        },
      };
    case 'timing':
      return {
        timing_risks: {
          why_now: resolvedText,
        },
      };
    case 'secrets':
      return {
        core_thesis: {
          zero_to_one_logic: resolvedText,
        },
      };
    default:
      return {};
  }
}

/**
 * Lightweight JSON unwrapper for Langfuse migration compatibility.
 * During migration, old Langfuse prompts may still return JSON-wrapped responses.
 * This extracts the content if present, otherwise returns the raw text.
 */
function unwrapLegacyJsonResponse(rawResponse: string): string {
  const trimmed = rawResponse.trim();

  // Try to detect JSON-wrapped responses from old prompts
  let jsonStr = trimmed;

  // Remove markdown code fences if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Only attempt JSON parse if it looks like JSON
  if (jsonStr.startsWith('{')) {
    try {
      const parsed = JSON.parse(jsonStr);
      // Old format: {status: "success", content: "..."}
      if (parsed.status === 'success' && typeof parsed.content === 'string') {
        console.log('[unwrapLegacyJsonResponse] Unwrapped legacy JSON response');
        return parsed.content;
      }
      // Old format: {status: "gap_detected", ...} — treat as plain text during migration
      if (parsed.status === 'gap_detected') {
        console.warn('[unwrapLegacyJsonResponse] Legacy gap_detected response treated as plain text');
        return parsed.gapReport?.reason || rawResponse;
      }
    } catch {
      // Not valid JSON, that's fine — use as plain text
    }
  }

  return rawResponse;
}

/**
 * Generate an AI proposal for a specific lens.
 * This is step 1 of the lens interaction flow.
 * Fetches the proposal prompt from Langfuse with local fallback.
 *
 * For Binary Check lenses (engineering, timing, monopoly, distribution),
 * returns a structured result that may be a Gap Report if the input fails validation.
 */
export async function generateLensProposal(
  lensId: LensId,
  manifest: VentureManifest,
  pitch: string,
  peopleInput?: string,
  sessionId?: string
): Promise<LensProposalResult> {
  // Build context for prompt compilation
  // Exclude the current lens's old value to prevent contamination
  const context = buildManifestContext(manifest, lensId);
  const upstreamContext = buildUpstreamContext(lensId, manifest);

  // Fetch proposal prompt from Langfuse (with local fallback)
  const fallbackPrompt = PROPOSAL_PROMPTS[lensId];
  const promptTemplate = await getPrompt(
    getLensProposalPromptName(lensId),
    fallbackPrompt
  );

  // Compile the prompt with context
  // Handle both local placeholders ({MANIFEST}) and Langfuse placeholders ({{manifest}})
  let proposalPrompt = promptTemplate
    .replace('{MANIFEST}', context)
    .replace('{{manifest}}', context)
    .replace('{UPSTREAM_CONTEXT}', upstreamContext)
    .replace('{{upstream_context}}', upstreamContext);

  // Handle people input for the People lens
  if (lensId === 'people' && peopleInput) {
    proposalPrompt = proposalPrompt
      .replace('{PEOPLE_INPUT}', peopleInput)
      .replace('{{people_input}}', peopleInput);
  } else if (lensId === 'people') {
    proposalPrompt = proposalPrompt
      .replace('{PEOPLE_INPUT}', 'Not provided yet - generate based on available context.')
      .replace('{{people_input}}', 'Not provided yet - generate based on available context.');
  }

  const fullPrompt = `${proposalPrompt}

FOUNDER'S PITCH:
${pitch}`;

  // Call Gemini
  try {
    const model = getModel();
    const callbacks = getLangfuseCallback(sessionId);

    const response = await model.invoke([
      new HumanMessage(fullPrompt)
    ], {
      callbacks: callbacks ? [callbacks] : undefined,
      runName: `Lens Proposal: ${lensId}`
    });

    const rawContent = response.content as string;

    // All lenses now return plain text (neutral pipeline).
    // Unwrap legacy JSON responses from old Langfuse prompts during migration.
    const content = unwrapLegacyJsonResponse(rawContent);
    return { status: 'success', content };
  } catch (error) {
    console.error('Lens proposal generation failed:', error);
    throw error;
  }
}

/**
 * Run a lens-specific adversarial debate turn.
 * Uses hot-swapped protocols for the given lens.
 * Fetches visionary and skeptic protocols from Langfuse with local fallbacks.
 */
export async function runLensDebateTurn(
  lensId: LensId,
  manifest: VentureManifest,
  pitch: string,
  userProposal: string,
  previousDebate: { role: 'visionary' | 'skeptic'; content: string }[],
  _peopleInput?: string, // Reserved for future use
  sessionId?: string
): Promise<{ visionary: string; skeptic: string }> {
  const context = buildManifestContext(manifest, lensId);

  // Fetch protocols from Langfuse in parallel (with local fallbacks)
  const [visionaryProtocol, skepticProtocol] = await Promise.all([
    getPrompt(getLensVisionaryProtocolName(lensId), VISIONARY_PROTOCOLS[lensId]),
    getPrompt(getLensSkepticProtocolName(lensId), SKEPTIC_PROTOCOLS[lensId]),
  ]);

  const debateContext = previousDebate
    .map(d => `[${d.role.toUpperCase()}]: ${d.content}`)
    .join('\n\n');

  // Visionary turn
  const visionaryPrompt = `${visionaryProtocol}

${context}

FOUNDER'S PITCH: ${pitch}

USER'S PROPOSAL FOR THIS LENS:
${userProposal}

${debateContext ? `PREVIOUS DEBATE:\n${debateContext}\n\nBuild on your previous arguments and address the Skeptic's latest points.` : 'This is the opening argument. Steel-man the proposal.'}

Respond with 2-4 paragraphs. Be specific and reference the user's proposal directly.
Respond in plain text.`;

  // Skeptic turn
  const skepticPromptTemplate = `${skepticProtocol}

${context}

FOUNDER'S PITCH: ${pitch}

USER'S PROPOSAL FOR THIS LENS:
${userProposal}

${debateContext ? `PREVIOUS DEBATE:\n${debateContext}\n\nAddress the Visionary's latest defense. Find new angles of attack.` : 'This is the opening critique. Attack the proposal directly.'}

VISIONARY JUST SAID:
{VISIONARY_RESPONSE}

Respond with 2-4 paragraphs. Be specific and cite the traps/anti-patterns from your protocol.
Respond in plain text.`;

  const model = getModel();
  const callbacks = getLangfuseCallback(sessionId);

  async function callModel(prompt: string, runName: string): Promise<string> {
    const response = await model.invoke([
      new HumanMessage(prompt)
    ], {
      callbacks: callbacks ? [callbacks] : undefined,
      runName
    });
    return response.content as string;
  }

  const visionaryResponse = await callModel(visionaryPrompt, `Visionary Turn: ${lensId}`);
  const fullSkepticPrompt = skepticPromptTemplate.replace('{VISIONARY_RESPONSE}', visionaryResponse);
  const skepticResponse = await callModel(fullSkepticPrompt, `Skeptic Turn: ${lensId}`);

  return { visionary: visionaryResponse, skeptic: skepticResponse };
}

// ============================================================================
// FRAMEWORK-AWARE PROPOSAL GENERATION
// ============================================================================

/**
 * Generate an AI proposal for a specific step within any framework.
 * Reads prompts from the framework's stepProtocols.
 */
export async function generateStepProposal(
  framework: FrameworkDefinition,
  stepId: string,
  manifest: VentureManifest,
  pitch: string,
  peopleInput?: string,
  sessionId?: string,
  gauntletLenses?: Record<string, GauntletLensState>
): Promise<LensProposalResult> {
  const stepProtocol = framework.stepProtocols[stepId];
  if (!stepProtocol) {
    throw new Error(`No step protocol found for step "${stepId}" in framework "${framework.id}"`);
  }

  // Build context using the framework's context builder
  const context = framework.manifestContextBuilder(manifest, stepId, gauntletLenses);

  // Fetch proposal prompt from Langfuse (with local fallback from framework)
  const langfusePromptName = getStepPromptName(framework, stepId, 'proposal');
  const promptTemplate = await getPrompt(langfusePromptName, stepProtocol.proposalPrompt);

  // Compile the prompt with context
  let proposalPrompt = promptTemplate
    .replace('{MANIFEST}', context)
    .replace('{{manifest}}', context)
    .replace('{UPSTREAM_CONTEXT}', context)
    .replace('{{upstream_context}}', context);

  // Handle people/team input
  if (peopleInput) {
    proposalPrompt = proposalPrompt
      .replace('{PEOPLE_INPUT}', peopleInput)
      .replace('{{people_input}}', peopleInput);
  } else {
    proposalPrompt = proposalPrompt
      .replace('{PEOPLE_INPUT}', 'Not provided yet - generate based on available context.')
      .replace('{{people_input}}', 'Not provided yet - generate based on available context.');
  }

  const fullPrompt = `${proposalPrompt}

FOUNDER'S PITCH:
${pitch}`;

  try {
    const model = getModel();
    const callbacks = getLangfuseCallback(sessionId);

    const response = await model.invoke([
      new HumanMessage(fullPrompt)
    ], {
      callbacks: callbacks ? [callbacks] : undefined,
      runName: `${framework.name} Proposal: ${stepId}`
    });

    const rawContent = response.content as string;
    const content = unwrapLegacyJsonResponse(rawContent);
    return { status: 'success', content };
  } catch (error) {
    console.error(`Step proposal generation failed (${framework.id}/${stepId}):`, error);
    throw error;
  }
}
