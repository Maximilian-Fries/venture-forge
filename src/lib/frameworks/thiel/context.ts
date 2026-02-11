import type { VentureManifest, GauntletLensState } from '@/types/database';
import type { ThielLensId } from '@/types/lenses';

/**
 * Mapping of manifest fields to the Thiel lens that produces them.
 */
const MANIFEST_FIELD_SOURCE: Record<string, ThielLensId> = {
  engineering_moat: 'engineering',
  timing_why_now: 'timing',
  wedge_target: 'monopoly',
  wedge_expansion: 'monopoly',
  core_thesis_statement: 'secrets',
  core_thesis_logic: 'secrets',
};

/**
 * Thiel lens upstream dependencies.
 */
export const THIEL_UPSTREAM_DEPENDENCIES: Record<ThielLensId, ThielLensId[]> = {
  engineering: [],
  timing: ['engineering'],
  monopoly: ['engineering'],
  people: ['engineering', 'monopoly'],
  distribution: ['monopoly', 'engineering', 'timing'],
  durability: ['engineering', 'monopoly', 'distribution', 'timing'],
  secrets: ['engineering', 'monopoly', 'timing', 'distribution'],
};

/**
 * Thiel lens downstream dependencies.
 */
export const THIEL_DOWNSTREAM_DEPENDENCIES: Record<ThielLensId, ThielLensId[]> = {
  engineering: ['monopoly', 'distribution', 'durability', 'secrets'],
  timing: ['distribution', 'durability', 'secrets'],
  monopoly: ['distribution', 'durability', 'secrets'],
  people: ['distribution'],
  distribution: ['durability', 'secrets'],
  durability: [],
  secrets: [],
};

/**
 * LENS_CONFIGS lookup for Thiel steps.
 * Imported where needed to get config titles.
 */
import { LENS_CONFIGS } from '@/lib/agents/lens-protocols';

/**
 * Build manifest context respecting the DAG dependency structure.
 * A lens should ONLY see context from its upstream dependencies.
 */
export function buildThielManifestContext(
  manifest: VentureManifest,
  forStepId: string,
  gauntletLenses?: Record<string, GauntletLensState>
): string {
  const upstreamDeps = THIEL_UPSTREAM_DEPENDENCIES[forStepId as ThielLensId];
  if (!upstreamDeps || upstreamDeps.length === 0) {
    return '';
  }

  const canSeeField = (fieldSource: ThielLensId): boolean => {
    return upstreamDeps.includes(fieldSource);
  };

  const lines: string[] = ['UPSTREAM CONTEXT (Committed Decisions):'];

  if (canSeeField(MANIFEST_FIELD_SOURCE.engineering_moat as ThielLensId)) {
    lines.push(`- Engineering Moat: ${manifest.engineering_moat || 'Not yet defined'}`);
  }
  if (canSeeField(MANIFEST_FIELD_SOURCE.timing_why_now as ThielLensId)) {
    lines.push(`- Timing (Why Now): ${manifest.timing_risks?.why_now || 'Not yet defined'}`);
  }
  if (canSeeField(MANIFEST_FIELD_SOURCE.wedge_target as ThielLensId)) {
    lines.push(`- Wedge Target: ${manifest.wedge?.target_audience || 'Not yet defined'}`);
    lines.push(`- Expansion Path: ${manifest.wedge?.expansion_path || 'Not yet defined'}`);
  }
  if (canSeeField(MANIFEST_FIELD_SOURCE.core_thesis_statement as ThielLensId)) {
    lines.push(`- Core Thesis: ${manifest.core_thesis?.statement || 'Not yet defined'}`);
    lines.push(`- Secret (0-to-1 Logic): ${manifest.core_thesis?.zero_to_one_logic || 'Not yet defined'}`);
  }

  if (lines.length === 1) return '';

  // Build upstream debate context from resolved lenses
  const lenses = gauntletLenses || manifest.gauntlet_lenses;
  const sections: string[] = [];

  if (lenses) {
    for (const upstreamId of upstreamDeps) {
      const upstreamState = lenses[upstreamId] as GauntletLensState | undefined;
      if (!upstreamState || upstreamState.status !== 'resolved') continue;

      const resolvedText = upstreamState.userEdit || upstreamState.proposal || '';
      if (!resolvedText.trim()) continue;

      const config = LENS_CONFIGS[upstreamId as ThielLensId];
      if (config) {
        sections.push(`### COMMITTED ${config.title.toUpperCase()} DECISION (Resolved)
${resolvedText}
---`);
      }
    }
  }

  let result = lines.join('\n');

  if (sections.length > 0) {
    result += `\n\n=== UPSTREAM CONTEXT: COMMITTED DECISIONS ===
You MUST design your proposal to be CONSISTENT with these prior lens decisions.
Do NOT contradict or ignore these resolved positions.

${sections.join('\n\n')}
=== END UPSTREAM CONTEXT ===`;
  }

  return result;
}
