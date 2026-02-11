import { LENS_ORDER } from '@/types/lenses';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      project_manifests: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          pitch: string | null;
          manifest: VentureManifest;
          monopoly_score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          pitch?: string | null;
          manifest?: VentureManifest;
          monopoly_score?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          pitch?: string | null;
          manifest?: VentureManifest;
          monopoly_score?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      lens_discussions: {
        Row: {
          id: string;
          project_id: string;
          lens_id: string;
          agent_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          lens_id: string;
          agent_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          lens_id?: string;
          agent_id?: string;
          content?: string;
          created_at?: string;
        };
      };
    };
  };
}

// Scout competitor types for AI-powered competitor detection
export interface ScoutCompetitor {
  name: string;
  url?: string;
  category: 'direct' | 'adjacent' | 'status_quo';
  description: string;
  weakness?: string;
}

export interface CompetitorReport {
  competitors: ScoutCompetitor[];
  redOceanAlert: boolean;
  summary: string;
  searchedAt?: string;
}

// Venture Manifest schema based on 01_manifest_architecture.md
export interface VentureManifest {
  core_thesis?: {
    statement?: string; // The 'Secret': What contrarian truth do you believe?
    zero_to_one_logic?: string; // Why is this a new category, not incremental improvement?
  };
  wedge?: {
    target_audience?: string; // Specific niche to dominate first
    expansion_path?: string; // How to move from niche to monopoly
  };
  engineering_moat?: string; // Technical advantages that compound over time
  timing_risks?: {
    why_now?: string;
    incumbent_blind_spots?: string[];
  };
  jury_verdict?: {
    monopoly_score?: number;
    synthesis?: string;
    red_flags?: string[];
  };
  locked_description?: string; // The refined pitch agreed upon by user and agent
  pitch_history?: { role: "assistant" | "user"; content: string; id: string }[];
  one_sentence_thesis?: string; // A concise one-sentence summary of the venture thesis

  // Competitor analysis
  competitors?: {
    name: string;
    weakness: string;
  }[];

  // AI-powered competitor scout results
  scout_competitors?: ScoutCompetitor[];
  competitor_report?: CompetitorReport;

  // Customer validation interviews
  interviews?: {
    id: string;
    name: string;
    role: string;
    key_insight: string;
    status: 'planned' | 'completed';
  }[];

  // Mom Test questions for validation
  interview_questions?: string[];

  // The Forge: raw and AI-inflated vision
  raw_vision?: string;      // User's raw unedited input
  refined_vision?: string;  // AI-inflated Thielian expansion
  last_forge_edit?: string; // ISO timestamp of last Forge edit (for dirty state tracking)

  // Venture status tracking
  venture_status?: VentureStatus;
  early_exit_reason?: string; // Lens ID where venture was conceded (e.g., 'engineering', 'monopoly')

  // The Gauntlet: Per-lens analysis state
  gauntlet_lenses?: Record<string, GauntletLensState>;
  gauntlet_active_lens?: string; // Current lens being worked on
  gauntlet_people_input?: string; // Bio/resume for People lens

  // Multi-framework support
  frameworks?: string[];                                  // selected framework IDs
  framework_data?: Record<string, FrameworkManifestData>; // per-framework state
}

export interface FrameworkManifestData {
  frameworkId: string;
  gauntlet_lenses?: Record<string, GauntletLensState>;
  gauntlet_active_lens?: string;
  gauntlet_people_input?: string; // Framework-specific people/team input
  context_fields?: Record<string, unknown>; // framework-specific fields
}

export type GauntletLensStatus = 'pending' | 'proposing' | 'selecting' | 'editing' | 'attacking' | 'defending' | 'judging' | 'debating' | 'resolved';

export interface GauntletLensState {
  status: GauntletLensStatus;
  proposal?: string;       // AI-generated draft
  proposals?: string[];     // v2: Multiple AI-generated options for selection
  userEdit?: string;       // User's edited version
  debate?: {               // Legacy: Adversarial debate history
    role: 'visionary' | 'skeptic';
    content: string;
  }[];
  // v2: Point-scoring debate system
  debatePoints?: import('./debate').DebatePoint[];
  debateStatus?: import('./debate').LensDebateResult['status'];
  lensScore?: number;      // Final score (0-100) — Visionary Win Rate weighted by Severity
  /** @deprecated Use lensScore instead. Kept for lazy migration of persisted data. */
  kScore?: number;
  resolvedAt?: string;     // ISO timestamp
  sessionId?: string;      // Langfuse session ID for the debate
  gapReport?: {            // Persisted gap report from jury or binary check failure
    missing_element: string;
    reason: string;
    hypotheses: string[];
  };
}

export type VentureStatus = 'ideation' | 'debating' | 'resolved';

export type ProjectManifest = Database['public']['Tables']['project_manifests']['Row'];
export type LensDiscussion = Database['public']['Tables']['lens_discussions']['Row'];

/**
 * Derive the venture status from manifest data
 */
export function getVentureStatus(project: ProjectManifest): VentureStatus {
  // Explicit status takes priority
  if (project.manifest?.venture_status) return project.manifest.venture_status;

  // Early exit (conceded venture) → resolved
  if (project.manifest?.early_exit_reason) return 'resolved';

  // v2 Gauntlet lens state takes priority over legacy jury_verdict
  const lenses = project.manifest?.gauntlet_lenses;
  if (lenses) {
    const lensValues = Object.values(lenses);
    if (lensValues.length > 0) {
      const allResolved = LENS_ORDER.every(l => lenses[l]?.status === 'resolved');
      if (allResolved) return 'resolved';
      if (lensValues.some(l => l.status !== 'pending')) return 'debating';
      return 'ideation';
    }
  }

  // Legacy: derive from old data only if no gauntlet lenses exist
  if (project.manifest?.jury_verdict?.synthesis) return 'resolved';
  if (project.manifest?.core_thesis?.statement || project.manifest?.engineering_moat) return 'debating';
  return 'ideation';
}

export const VENTURE_STATUS_CONFIG: Record<VentureStatus, {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
}> = {
  ideation: {
    label: 'Ideation',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    dotColor: 'bg-blue-400',
  },
  debating: {
    label: 'Debating',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    dotColor: 'bg-amber-400',
  },
  resolved: {
    label: 'Resolved',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    dotColor: 'bg-green-400',
  },
};
