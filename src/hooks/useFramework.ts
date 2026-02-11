import { useMemo } from 'react';
import { FrameworkRegistry } from '@/lib/frameworks/registry';
import type { FrameworkDefinition } from '@/lib/frameworks/types';

/**
 * Returns the FrameworkDefinition for a given frameworkId.
 * Falls back to the default (Thiel) if not found.
 */
export function useFramework(frameworkId?: string): FrameworkDefinition {
  return useMemo(() => {
    if (frameworkId) {
      const fw = FrameworkRegistry.get(frameworkId);
      if (fw) return fw;
    }
    return FrameworkRegistry.getDefault();
  }, [frameworkId]);
}
