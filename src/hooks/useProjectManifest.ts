/* eslint-disable @typescript-eslint/no-explicit-any */
// Note: 'any' casts are used intentionally to work around Supabase generated types
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { VentureManifest, ProjectManifest, LensDiscussion } from '@/types/database';
import { getMockVenture } from '@/data/mockVentures';

// localStorage keys
const LOCAL_PROJECTS_KEY = 'venture_local_projects';

// Helper to check if a project is mock or local
export const isMockProject = (id: string) => id.startsWith('mock-');
export const isLocalProject = (id: string) => id.startsWith('local-');
export const isOfflineProject = (id: string) => isMockProject(id) || isLocalProject(id);

// Helper to get local projects from localStorage
export function getLocalProjects(): ProjectManifest[] {
  try {
    const stored = localStorage.getItem(LOCAL_PROJECTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Helper to save local projects to localStorage
function saveLocalProjects(projects: ProjectManifest[]) {
  try {
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('[useProjectManifest] Failed to save local projects:', e);
  }
}

// Helper to update a local project in localStorage
function updateLocalProject(projectId: string, updates: Partial<ProjectManifest>) {
  const projects = getLocalProjects();
  const index = projects.findIndex(p => p.id === projectId);
  if (index !== -1) {
    projects[index] = { ...projects[index], ...updates, updated_at: new Date().toISOString() };
    saveLocalProjects(projects);
    return projects[index];
  }
  return null;
}

export interface ProjectManifestState {
  // Current project state
  currentProject: ProjectManifest | null;
  discussions: LensDiscussion[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  createProject: (title: string, pitch: string) => Promise<string | null>;
  loadProject: (projectId: string) => Promise<void>;
  updateManifest: (manifest: Partial<VentureManifest>) => Promise<void>;
  updateMonopolyScore: (score: number) => Promise<void>;
  addDiscussion: (lensId: string, agentId: string, content: string) => Promise<void>;
  clearProject: () => void;

  // Optimistic local updates
  setLocalManifest: (manifest: Partial<VentureManifest>) => void;
  lockDescription: (description: string) => Promise<void>;
  savePitchHistory: (history: { role: "assistant" | "user"; content: string; id: string }[]) => Promise<void>;
  updateTitle: (title: string) => Promise<void>;

  // Reset gauntlet data (clear all lens analysis while keeping raw vision)
  resetGauntlet: () => Promise<void>;
}

export const useProjectManifest = create<ProjectManifestState>((set, get) => ({
  currentProject: null,
  discussions: [],
  isLoading: false,
  isSaving: false,
  error: null,

  createProject: async (title: string, pitch: string) => {
    set({ isLoading: true, error: null });

    try {
      // Try to get authenticated user, fall back to anonymous user ID
      let userId = 'anonymous';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) userId = user.id;
      } catch {
        console.log('[useProjectManifest] No auth, using anonymous user');
      }

      const { data, error } = await (supabase
        .from('project_manifests') as any)
        .insert({
          user_id: userId,
          title,
          pitch,
          manifest: {},
          monopoly_score: 0,
        })
        .select()
        .single();

      if (error) {
        console.error('[useProjectManifest] Supabase insert error, falling back to localStorage:', error);
        throw error;
      }
      if (!data) throw new Error('No data returned');

      console.log('[useProjectManifest] Project created in Supabase:', data.id);

      set({
        currentProject: data as ProjectManifest,
        discussions: [],
        isLoading: false
      });

      return data.id;
    } catch (err) {
      // Fallback to localStorage
      console.warn('[useProjectManifest] Falling back to localStorage');

      const localProject: ProjectManifest = {
        id: `local-${Date.now()}`,
        user_id: 'local',
        title,
        pitch,
        manifest: {},
        monopoly_score: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existing = getLocalProjects();
      saveLocalProjects([localProject, ...existing]);

      console.log('[useProjectManifest] Project created in localStorage:', localProject.id);

      set({
        currentProject: localProject,
        discussions: [],
        isLoading: false,
        error: null, // Clear error since we succeeded with fallback
      });

      return localProject.id;
    }
  },

  loadProject: async (projectId: string) => {
    // Reset state before loading to prevent project leakage
    set({ currentProject: null, discussions: [], isLoading: true, error: null });

    try {
      // Check if it's a mock project
      if (isMockProject(projectId)) {
        const mockProject = getMockVenture(projectId);
        if (mockProject) {
          console.log('[useProjectManifest] Loading mock project:', projectId);
          set({
            currentProject: mockProject as ProjectManifest,
            discussions: [],
            isLoading: false,
          });
          return;
        }
        throw new Error('Mock project not found');
      }

      // Check if it's a local project
      if (isLocalProject(projectId)) {
        const localProjects = getLocalProjects();
        const localProject = localProjects.find(p => p.id === projectId);
        if (localProject) {
          console.log('[useProjectManifest] Loading local project:', projectId);
          set({
            currentProject: localProject,
            discussions: [],
            isLoading: false,
          });
          return;
        }
        throw new Error('Local project not found');
      }

      // Load from Supabase
      const { data: project, error: projectError } = await supabase
        .from('project_manifests')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Load discussions
      const { data: discussions, error: discussionsError } = await supabase
        .from('lens_discussions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (discussionsError) throw discussionsError;

      set({
        currentProject: project as ProjectManifest,
        discussions: (discussions || []) as LensDiscussion[],
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project';
      set({ error: message, isLoading: false });
    }
  },

  updateManifest: async (manifestUpdate: Partial<VentureManifest>) => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isSaving: true, error: null });

    const updatedManifest = {
      ...currentProject.manifest,
      ...manifestUpdate,
    };

    // Handle mock/local projects - persist to localStorage
    if (isOfflineProject(currentProject.id)) {
      console.log('[useProjectManifest] Updating offline project manifest');

      // For mock projects, save a copy to local storage
      if (isMockProject(currentProject.id)) {
        // Store mock edits separately
        const mockEditsKey = `venture_mock_edits_${currentProject.id}`;
        try {
          localStorage.setItem(mockEditsKey, JSON.stringify(updatedManifest));
        } catch (e) {
          console.error('[useProjectManifest] Failed to save mock edits:', e);
        }
      } else {
        // For local projects, update in localStorage
        updateLocalProject(currentProject.id, { manifest: updatedManifest });
      }

      set({
        currentProject: {
          ...currentProject,
          manifest: updatedManifest,
        },
        isSaving: false,
      });
      return;
    }

    // Supabase update
    try {
      const { error } = await (supabase
        .from('project_manifests') as any)
        .update({ manifest: updatedManifest })
        .eq('id', currentProject.id);

      if (error) throw error;

      set({
        currentProject: {
          ...currentProject,
          manifest: updatedManifest,
        },
        isSaving: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update manifest';
      set({ error: message, isSaving: false });
    }
  },

  updateMonopolyScore: async (score: number) => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({ isSaving: true, error: null });

    // Handle offline projects
    if (isOfflineProject(currentProject.id)) {
      if (isLocalProject(currentProject.id)) {
        updateLocalProject(currentProject.id, { monopoly_score: score });
      }
      set({
        currentProject: {
          ...currentProject,
          monopoly_score: score,
        },
        isSaving: false,
      });
      return;
    }

    try {
      const { error } = await (supabase
        .from('project_manifests') as any)
        .update({ monopoly_score: score })
        .eq('id', currentProject.id);

      if (error) throw error;

      set({
        currentProject: {
          ...currentProject,
          monopoly_score: score,
        },
        isSaving: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update score';
      set({ error: message, isSaving: false });
    }
  },

  addDiscussion: async (lensId: string, agentId: string, content: string) => {
    const { currentProject, discussions } = get();
    if (!currentProject) return;

    // Handle offline projects - store in memory only
    if (isOfflineProject(currentProject.id)) {
      const localDiscussion: LensDiscussion = {
        id: `local-disc-${Date.now()}`,
        project_id: currentProject.id,
        lens_id: lensId,
        agent_id: agentId,
        content,
        created_at: new Date().toISOString(),
      };
      set({
        discussions: [...discussions, localDiscussion],
      });
      return;
    }

    try {
      const { data, error } = await (supabase
        .from('lens_discussions') as any)
        .insert({
          project_id: currentProject.id,
          lens_id: lensId,
          agent_id: agentId,
          content,
        })
        .select()
        .single();

      if (error) throw error;

      set({
        discussions: [...discussions, data as LensDiscussion],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add discussion';
      set({ error: message });
    }
  },

  clearProject: () => {
    set({
      currentProject: null,
      discussions: [],
      error: null,
    });
  },

  setLocalManifest: (manifestUpdate: Partial<VentureManifest>) => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({
      currentProject: {
        ...currentProject,
        manifest: {
          ...currentProject.manifest,
          ...manifestUpdate,
        },
      },
    });
  },

  lockDescription: async (description: string) => {
    const { currentProject, updateManifest } = get();
    if (!currentProject) return;

    // First update the hook state
    set({
      currentProject: {
        ...currentProject,
        manifest: {
          ...currentProject.manifest,
          locked_description: description,
        }
      }
    });

    // Then persist (updateManifest handles offline projects)
    await updateManifest({ locked_description: description });
  },

  savePitchHistory: async (history) => {
    const { currentProject, updateManifest } = get();
    if (!currentProject) return;

    // Optimistic update
    set({
      currentProject: {
        ...currentProject,
        manifest: {
          ...currentProject.manifest,
          pitch_history: history,
        }
      }
    });

    // Persist (updateManifest handles offline projects)
    await updateManifest({ pitch_history: history });
  },

  updateTitle: async (title: string) => {
    const { currentProject } = get();
    if (!currentProject) return;

    // Optimistic update
    set({
      currentProject: {
        ...currentProject,
        title,
      }
    });

    // Handle offline projects
    if (isOfflineProject(currentProject.id)) {
      if (isLocalProject(currentProject.id)) {
        updateLocalProject(currentProject.id, { title });
      }
      // Mock edits are only stored for manifest, not title
      return;
    }

    // Supabase update
    try {
      const { error } = await (supabase
        .from('project_manifests') as any)
        .update({ title })
        .eq('id', currentProject.id);

      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update title';
      set({ error: message });
    }
  },

  resetGauntlet: async () => {
    const { currentProject, updateManifest } = get();
    if (!currentProject) return;

    console.log('[useProjectManifest] Resetting gauntlet data for project:', currentProject.id);

    // Clear all gauntlet-related fields while preserving raw_vision and refined_vision
    const cleanedManifest: Partial<VentureManifest> = {
      gauntlet_lenses: undefined,
      gauntlet_active_lens: undefined,
      gauntlet_people_input: undefined,
      engineering_moat: undefined,
      timing_risks: undefined,
      wedge: undefined,
      core_thesis: undefined,
    };

    await updateManifest(cleanedManifest);
    console.log('[useProjectManifest] Gauntlet data reset complete');
  },
}));

// Selector hooks for specific parts of the state
export const useCurrentProject = () => useProjectManifest((state) => state.currentProject);
export const useManifest = () => useProjectManifest((state) => state.currentProject?.manifest);
export const useDiscussions = () => useProjectManifest((state) => state.discussions);
export const useDiscussionsByLens = (lensId: string) =>
  useProjectManifest((state) => state.discussions.filter((d) => d.lens_id === lensId));
