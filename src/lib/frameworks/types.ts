import type { VentureManifest, GauntletLensState } from '@/types/database';
import type { DebatePoint } from '@/types/debate';

/**
 * Step Definition: Generalization of a "lens" for any evaluation framework.
 */
export interface StepDefinition {
  id: string;
  title: string;
  subtitle: string;
  question: string;
  icon: string;       // lucide icon name
  color: string;      // tailwind text color class
  bgColor: string;    // tailwind bg color class
  borderColor: string; // tailwind border class
}

/**
 * Evaluation format for a framework's debate system.
 */
export type EvaluationFormat = 'adversarial-debate' | 'hypothesis-testing' | 'rubric-scoring';

/**
 * Agent role in the evaluation system.
 */
export interface AgentRole {
  id: string;
  label: string;
  color: string;       // tailwind text color class
  systemPrompt: string; // base system prompt for this role
}

/**
 * Per-step protocol: cartridge loaded for a specific step.
 */
export interface StepProtocol {
  proposalPrompt: string;
  agentProtocols: Record<string, string>; // role id -> lens-specific protocol
  traps: string[];
}

/**
 * The complete framework descriptor.
 * Adding a new framework requires only filling this shape + prompts.
 */
export interface FrameworkDefinition {
  // Metadata
  id: string;
  name: string;
  description: string;
  icon: string;        // lucide icon name
  color: string;       // tailwind text color class

  // Steps
  steps: StepDefinition[];
  stepOrder: string[];

  // Evaluation
  evaluationFormat: EvaluationFormat;
  agentRoles: AgentRole[];

  // Cartridges: per-step protocols
  stepProtocols: Record<string, StepProtocol>;

  // Dependencies
  upstreamDependencies: Record<string, string[]>;  // stepId -> upstream stepIds
  downstreamDependencies: Record<string, string[]>; // stepId -> downstream stepIds

  // Scoring
  calculateStepScore: (points: DebatePoint[]) => number;

  // Context builder: produces upstream context string for AI prompts
  manifestContextBuilder: (manifest: VentureManifest, stepId: string, gauntletLenses?: Record<string, GauntletLensState>) => string;

  // Langfuse prefix for prompt names (e.g. 'lens' -> 'lens-proposal-engineering')
  langfusePrefix: string;

  // Optional: special step handling (e.g., monopoly multi-select, people bio input)
  stepBehaviors?: Record<string, StepBehavior>;
}

/**
 * Special behaviors for steps that need custom UI.
 */
export interface StepBehavior {
  multiSelect?: boolean;        // e.g., monopoly lens generates 3 options
  requiresInput?: boolean;      // e.g., people lens needs bio input
  inputLabel?: string;          // label for the input field
  inputPlaceholder?: string;    // placeholder for input
}
