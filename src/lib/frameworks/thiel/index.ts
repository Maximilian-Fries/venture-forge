import type { FrameworkDefinition, StepDefinition, AgentRole, StepProtocol } from '../types';
import { THIEL_LENS_ORDER } from '@/types/lenses';
import type { ThielLensId } from '@/types/lenses';
import {
  LENS_CONFIGS,
  PROPOSAL_PROMPTS,
  VISIONARY_PROTOCOLS,
  SKEPTIC_PROTOCOLS,
} from '@/lib/agents/lens-protocols';
import {
  FALLBACK_GAUNTLET_SKEPTIC_SYSTEM,
  FALLBACK_GAUNTLET_VISIONARY_SYSTEM,
  FALLBACK_GAUNTLET_JURY_SYSTEM,
} from '@/lib/prompts/defaults';
import { calculateLensScore } from '@/types/debate';
import { THIEL_UPSTREAM_DEPENDENCIES, THIEL_DOWNSTREAM_DEPENDENCIES, buildThielManifestContext } from './context';

// Build steps from existing LENS_CONFIGS
const steps: StepDefinition[] = THIEL_LENS_ORDER.map(id => {
  const c = LENS_CONFIGS[id];
  return {
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    question: c.question,
    icon: c.icon,
    color: c.color,
    bgColor: c.bgColor,
    borderColor: c.borderColor,
  };
});

// Agent roles for adversarial debate
const agentRoles: AgentRole[] = [
  {
    id: 'visionary',
    label: 'Visionary',
    color: 'text-cyan-400',
    systemPrompt: FALLBACK_GAUNTLET_VISIONARY_SYSTEM,
  },
  {
    id: 'skeptic',
    label: 'Skeptic',
    color: 'text-orange-400',
    systemPrompt: FALLBACK_GAUNTLET_SKEPTIC_SYSTEM,
  },
  {
    id: 'jury',
    label: 'GP Jury',
    color: 'text-purple-400',
    systemPrompt: FALLBACK_GAUNTLET_JURY_SYSTEM,
  },
];

// Lens traps
const LENS_TRAPS: Record<ThielLensId, string[]> = {
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
    "Channel doesn't match committed wedge audience",
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

// Build step protocols from existing prompt constants
const stepProtocols: Record<string, StepProtocol> = {};
for (const id of THIEL_LENS_ORDER) {
  stepProtocols[id] = {
    proposalPrompt: PROPOSAL_PROMPTS[id],
    agentProtocols: {
      visionary: VISIONARY_PROTOCOLS[id],
      skeptic: SKEPTIC_PROTOCOLS[id],
    },
    traps: LENS_TRAPS[id],
  };
}

export const thielFramework: FrameworkDefinition = {
  id: 'thiel-zero-to-one',
  name: 'Zero to One',
  description: "Peter Thiel's 7-lens framework for evaluating whether an idea creates a new category (0→1) or is incremental improvement (1→N).",
  icon: 'Zap',
  color: 'text-amber-400',

  steps,
  stepOrder: [...THIEL_LENS_ORDER],

  evaluationFormat: 'adversarial-debate',
  agentRoles,

  stepProtocols,

  upstreamDependencies: { ...THIEL_UPSTREAM_DEPENDENCIES },
  downstreamDependencies: { ...THIEL_DOWNSTREAM_DEPENDENCIES },

  calculateStepScore: calculateLensScore,
  manifestContextBuilder: buildThielManifestContext,

  langfusePrefix: 'lens',

  stepBehaviors: {
    monopoly: { multiSelect: true },
    people: {
      requiresInput: true,
      inputLabel: 'Team Information',
      inputPlaceholder: 'Enter founder bios, relevant experience, and team composition...',
    },
  },
};
