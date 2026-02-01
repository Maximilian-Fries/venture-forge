/**
 * Dirty State Logic: Lens Dependency Graph
 *
 * When a user edits the Core Idea (in Forge), dependent lenses are flagged DIRTY.
 * User is prompted to "Re-Debate" dirty lenses.
 *
 * The dependency graph models which lenses depend on which inputs:
 * - Raw Vision changes → all lenses become dirty
 * - Engineering changes → Monopoly, Distribution, Durability become dirty
 * - Timing changes → Distribution, Durability become dirty
 * - Monopoly changes → Distribution, Durability become dirty
 * - People changes → Distribution become dirty
 */

import type { LensId } from '@/types/lenses';
import type { VentureManifest, GauntletLensState } from '@/types/database';

/**
 * Dependencies: if key lens changes, value lenses become dirty.
 *
 * Key dependency rationales:
 * - timing → distribution: Channel lifecycle depends on timing window
 * - timing → durability: Last Mover Advantage requires timing window to CLOSE
 * - distribution → secrets: Grand synthesis must include distribution innovation
 * - distribution → durability: Flywheel depends on distribution compounding
 */
export const LENS_DEPENDENCIES: Record<LensId, LensId[]> = {
  engineering: ['monopoly', 'distribution', 'durability', 'secrets'],
  timing: ['distribution', 'durability', 'secrets'],
  monopoly: ['distribution', 'durability', 'secrets'],
  people: ['distribution'],
  distribution: ['durability', 'secrets'],
  durability: [],
  secrets: [],
};

/**
 * If the forge raw vision changes, these lenses all become dirty.
 */
export const FORGE_DEPENDENTS: LensId[] = [
  'engineering', 'timing', 'monopoly', 'people', 'distribution', 'durability', 'secrets',
];

export interface DirtyLens {
  lensId: LensId;
  reason: string;
  dirtyAt: string; // ISO timestamp
}

/**
 * Determine which resolved lenses are "dirty" based on manifest changes.
 *
 * A lens is dirty if:
 * 1. The raw vision was edited AFTER the lens was resolved
 * 2. An upstream lens was resolved AFTER this lens was resolved
 */
export function getDirtyLenses(manifest: VentureManifest): DirtyLens[] {
  const lenses = manifest.gauntlet_lenses;
  if (!lenses) return [];

  const dirty: DirtyLens[] = [];
  const forgeEditTime = manifest.last_forge_edit ? new Date(manifest.last_forge_edit).getTime() : 0;

  for (const [lensId, state] of Object.entries(lenses) as [LensId, GauntletLensState][]) {
    if (state.status !== 'resolved' || !state.resolvedAt) continue;

    const resolvedTime = new Date(state.resolvedAt).getTime();

    // Check 1: Was the raw vision edited after this lens was resolved?
    if (forgeEditTime > resolvedTime) {
      dirty.push({
        lensId,
        reason: 'Core idea was edited in The Forge after this lens was resolved',
        dirtyAt: manifest.last_forge_edit!,
      });
      continue;
    }

    // Check 2: Was an upstream lens re-resolved after this lens was resolved?
    // Find which lenses are "upstream" of this one (which lenses' changes make this dirty)
    for (const [upstreamId, downstreams] of Object.entries(LENS_DEPENDENCIES) as [LensId, LensId[]][]) {
      if (!downstreams.includes(lensId as LensId)) continue;

      const upstreamState = lenses[upstreamId];
      if (!upstreamState?.resolvedAt) continue;

      const upstreamResolvedTime = new Date(upstreamState.resolvedAt).getTime();
      if (upstreamResolvedTime > resolvedTime) {
        dirty.push({
          lensId,
          reason: `Upstream lens "${upstreamId}" was re-debated after this lens was resolved`,
          dirtyAt: upstreamState.resolvedAt,
        });
        break; // One reason is enough
      }
    }
  }

  return dirty;
}

/**
 * Get downstream lenses that would be affected if a given lens changes.
 */
export function getDownstreamLenses(lensId: LensId): LensId[] {
  return LENS_DEPENDENCIES[lensId] || [];
}

/**
 * Check if a specific lens is dirty.
 */
export function isLensDirty(lensId: LensId, manifest: VentureManifest): boolean {
  return getDirtyLenses(manifest).some(d => d.lensId === lensId);
}

/**
 * Check if the venture is "consistent" (no dirty lenses).
 * A venture cannot be truly "Resolved" if its logic chain is broken.
 */
export function isVentureConsistent(manifest: VentureManifest): boolean {
  return getDirtyLenses(manifest).length === 0;
}

/**
 * Get all resolved downstream lenses that would be invalidated if a lens is re-debated.
 * This is used to show the "Chain Reaction" warning before reopening a lens.
 */
export function getAffectedDownstreamLenses(
  lensId: LensId,
  manifest: VentureManifest
): LensId[] {
  const lenses = manifest.gauntlet_lenses;
  if (!lenses) return [];

  const affected: LensId[] = [];
  const downstreamLenses = LENS_DEPENDENCIES[lensId] || [];

  for (const downstreamId of downstreamLenses) {
    const state = lenses[downstreamId];
    if (state?.status === 'resolved') {
      affected.push(downstreamId);
    }
  }

  return affected;
}

/**
 * Recursively get ALL downstream lenses (transitive closure).
 * Used for understanding the full cascade effect.
 */
export function getAllDownstreamLenses(lensId: LensId): LensId[] {
  const visited = new Set<LensId>();
  const queue = [...(LENS_DEPENDENCIES[lensId] || [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const children = LENS_DEPENDENCIES[current] || [];
    queue.push(...children);
  }

  return Array.from(visited);
}

/**
 * Verify the dependency graph is acyclic (DAG).
 * Returns true if no cycles exist.
 */
export function verifyDependencyGraphIsDAG(): boolean {
  const allLenses = Object.keys(LENS_DEPENDENCIES) as LensId[];

  for (const lens of allLenses) {
    const allDownstream = getAllDownstreamLenses(lens);
    // A cycle exists if a lens appears in its own downstream
    if (allDownstream.includes(lens)) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate the chain reaction: which lenses need to be re-debated
 * given a set of lenses that have been modified.
 */
export interface ChainReaction {
  modifiedLens: LensId;
  affectedLenses: {
    lensId: LensId;
    reason: string;
  }[];
}

export function calculateChainReaction(
  modifiedLensId: LensId,
  manifest: VentureManifest
): ChainReaction {
  const affected = getAffectedDownstreamLenses(modifiedLensId, manifest);

  return {
    modifiedLens: modifiedLensId,
    affectedLenses: affected.map(lensId => ({
      lensId,
      reason: `Depends on ${modifiedLensId} which has changed`,
    })),
  };
}
