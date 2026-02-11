import type { VentureManifest, GauntletLensState } from '@/types/database';

/**
 * YC step upstream dependencies.
 */
export const YC_UPSTREAM_DEPENDENCIES: Record<string, string[]> = {
  'idea-clarity': [],
  'market': ['idea-clarity'],
  'traction': ['idea-clarity'],
  'team': ['idea-clarity', 'market'],
  'unique-insight': ['idea-clarity', 'market', 'traction'],
  'growth': ['idea-clarity', 'market', 'traction', 'unique-insight'],
};

/**
 * YC step downstream dependencies.
 */
export const YC_DOWNSTREAM_DEPENDENCIES: Record<string, string[]> = {
  'idea-clarity': ['market', 'traction', 'team', 'unique-insight', 'growth'],
  'market': ['team', 'unique-insight', 'growth'],
  'traction': ['unique-insight', 'growth'],
  'team': [],
  'unique-insight': ['growth'],
  'growth': [],
};

const STEP_TITLES: Record<string, string> = {
  'idea-clarity': 'Idea Clarity',
  'market': 'Market',
  'traction': 'Traction',
  'team': 'Team',
  'unique-insight': 'Unique Insight',
  'growth': 'Growth',
};

/**
 * Build upstream context for YC framework steps.
 */
export function buildYCManifestContext(
  manifest: VentureManifest,
  forStepId: string,
  gauntletLenses?: Record<string, GauntletLensState>
): string {
  const upstreamDeps = YC_UPSTREAM_DEPENDENCIES[forStepId];
  if (!upstreamDeps || upstreamDeps.length === 0) return '';

  const lenses = gauntletLenses || manifest.gauntlet_lenses;
  if (!lenses) return '';

  const sections: string[] = [];

  for (const upstreamId of upstreamDeps) {
    const upstreamState = lenses[upstreamId] as GauntletLensState | undefined;
    if (!upstreamState || upstreamState.status !== 'resolved') continue;

    const resolvedText = upstreamState.userEdit || upstreamState.proposal || '';
    if (!resolvedText.trim()) continue;

    const title = STEP_TITLES[upstreamId] || upstreamId;
    sections.push(`### COMMITTED ${title.toUpperCase()} DECISION (Resolved)
${resolvedText}
---`);
  }

  if (!sections.length) return '';

  return `=== UPSTREAM CONTEXT: COMMITTED DECISIONS ===
You MUST design your proposal to be CONSISTENT with these prior decisions.
Do NOT contradict or ignore these resolved positions.

${sections.join('\n\n')}
=== END UPSTREAM CONTEXT ===`;
}
