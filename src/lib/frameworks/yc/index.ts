import type { FrameworkDefinition, StepDefinition, AgentRole, StepProtocol } from '../types';
import {
  YC_PROPOSAL_PROMPTS,
  YC_ADVOCATE_SYSTEM,
  YC_SKEPTIC_SYSTEM,
  YC_COMMITTEE_SYSTEM,
  YC_ADVOCATE_PROTOCOLS,
  YC_SKEPTIC_PROTOCOLS,
  YC_TRAPS,
} from './prompts';
import { YC_UPSTREAM_DEPENDENCIES, YC_DOWNSTREAM_DEPENDENCIES, buildYCManifestContext } from './context';
import { calculateLensScore } from '@/types/debate';

const YC_STEP_ORDER = [
  'idea-clarity',
  'market',
  'traction',
  'team',
  'unique-insight',
  'growth',
] as const;

const steps: StepDefinition[] = [
  {
    id: 'idea-clarity',
    title: 'Idea Clarity',
    subtitle: 'Explain It Simply',
    question: 'Can you describe what your company does in one sentence a smart 12-year-old understands?',
    icon: 'Lightbulb',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  {
    id: 'market',
    title: 'Market',
    subtitle: 'How Big Can This Get?',
    question: 'What is the TAM, and what evidence shows the market wants this?',
    icon: 'TrendingUp',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  {
    id: 'traction',
    title: 'Traction',
    subtitle: "Do Things That Don't Scale",
    question: 'What have you built, and what unscalable things have you done to get early users?',
    icon: 'Rocket',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    id: 'team',
    title: 'Team',
    subtitle: 'Relentlessly Resourceful',
    question: 'Why is this team uniquely qualified? What have the founders shipped before?',
    icon: 'Users',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  {
    id: 'unique-insight',
    title: 'Unique Insight',
    subtitle: 'Schlep Blindness',
    question: 'What do you understand about your users that nobody else does?',
    icon: 'Eye',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
  },
  {
    id: 'growth',
    title: 'Growth',
    subtitle: 'Frighteningly Ambitious',
    question: 'How does this become a billion-dollar company in 7 years?',
    icon: 'Flame',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
];

const agentRoles: AgentRole[] = [
  {
    id: 'visionary',
    label: 'YC Advocate',
    color: 'text-cyan-400',
    systemPrompt: YC_ADVOCATE_SYSTEM,
  },
  {
    id: 'skeptic',
    label: 'YC Skeptic',
    color: 'text-orange-400',
    systemPrompt: YC_SKEPTIC_SYSTEM,
  },
  {
    id: 'jury',
    label: 'YC Committee',
    color: 'text-purple-400',
    systemPrompt: YC_COMMITTEE_SYSTEM,
  },
];

// Build step protocols from YC prompt constants
const stepProtocols: Record<string, StepProtocol> = {};
for (const id of YC_STEP_ORDER) {
  stepProtocols[id] = {
    proposalPrompt: YC_PROPOSAL_PROMPTS[id],
    agentProtocols: {
      visionary: YC_ADVOCATE_PROTOCOLS[id],
      skeptic: YC_SKEPTIC_PROTOCOLS[id],
    },
    traps: YC_TRAPS[id],
  };
}

export const ycFramework: FrameworkDefinition = {
  id: 'yc-application',
  name: 'YC Application',
  description: "Y Combinator's application framework inspired by Paul Graham essays. Evaluates idea clarity, market, traction, team, unique insight, and growth potential.",
  icon: 'Rocket',
  color: 'text-orange-400',

  steps,
  stepOrder: [...YC_STEP_ORDER],

  evaluationFormat: 'adversarial-debate',
  agentRoles,

  stepProtocols,

  upstreamDependencies: { ...YC_UPSTREAM_DEPENDENCIES },
  downstreamDependencies: { ...YC_DOWNSTREAM_DEPENDENCIES },

  calculateStepScore: calculateLensScore,
  manifestContextBuilder: buildYCManifestContext,

  langfusePrefix: 'yc',

  stepBehaviors: {
    team: {
      requiresInput: true,
      inputLabel: 'Team Information',
      inputPlaceholder: 'Enter founder bios, relevant experience, and team composition...',
    },
  },
};
