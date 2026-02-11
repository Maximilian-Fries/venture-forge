import type { FrameworkDefinition } from './types';

const registry = new Map<string, FrameworkDefinition>();
let defaultId: string | null = null;

export const FrameworkRegistry = {
  register(framework: FrameworkDefinition, isDefault = false) {
    registry.set(framework.id, framework);
    if (isDefault || !defaultId) {
      defaultId = framework.id;
    }
  },

  get(id: string): FrameworkDefinition | undefined {
    return registry.get(id);
  },

  getAll(): FrameworkDefinition[] {
    return Array.from(registry.values());
  },

  getDefault(): FrameworkDefinition {
    const fw = defaultId ? registry.get(defaultId) : undefined;
    if (!fw) throw new Error('No default framework registered');
    return fw;
  },

  getDefaultId(): string {
    if (!defaultId) throw new Error('No default framework registered');
    return defaultId;
  },

  has(id: string): boolean {
    return registry.has(id);
  },
};
