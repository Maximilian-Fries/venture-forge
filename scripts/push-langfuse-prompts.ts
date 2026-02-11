/**
 * Push prompts to Langfuse and set them to Production.
 *
 * Run with: npx tsx scripts/push-langfuse-prompts.ts
 *
 * This script:
 * 1. Creates or updates prompts in Langfuse
 * 2. Sets them as the active "production" version
 *
 * Add new prompts to the PROMPTS array below.
 */

import { Langfuse } from 'langfuse';

// Import prompts - add new FALLBACK_ constants here
import {
  FALLBACK_LENS_PROPOSAL_ENGINEERING,
  FALLBACK_LENS_PROPOSAL_TIMING,
  FALLBACK_LENS_PROPOSAL_MONOPOLY,
  FALLBACK_LENS_PROPOSAL_DISTRIBUTION,
  FALLBACK_GAUNTLET_VISIONARY_SYSTEM,
  FALLBACK_GAUNTLET_SKEPTIC_SYSTEM,
  FALLBACK_GAUNTLET_JURY_SYSTEM,
  FALLBACK_JURY_GAP_REPORT_SYSTEM,
  FALLBACK_COMPETITOR_SCOUT_SYSTEM,
  SKEPTIC_PROTOCOLS,
} from '../src/lib/prompts/defaults';

// YC Framework prompts
import {
  YC_PROPOSAL_PROMPTS,
  YC_ADVOCATE_SYSTEM,
  YC_SKEPTIC_SYSTEM,
  YC_COMMITTEE_SYSTEM,
  YC_ADVOCATE_PROTOCOLS,
  YC_SKEPTIC_PROTOCOLS,
} from '../src/lib/frameworks/yc/prompts';

const langfuse = new Langfuse({
  secretKey: process.env.VITE_LANGFUSE_SECRET_KEY || 'sk-lf-143edc8e-585e-4ee0-ab38-f3baadcb03d7',
  publicKey: process.env.VITE_LANGFUSE_PUBLIC_KEY || 'pk-lf-16ab6a4f-2c43-446c-a373-ae91824efd7b',
  baseUrl: process.env.VITE_LANGFUSE_HOST || 'https://cloud.langfuse.com',
});

/**
 * PROMPTS REGISTRY
 *
 * Add new prompts here. Each entry needs:
 * - name: Langfuse prompt name (must match getLensProposalPromptName() output)
 * - content: The prompt text (import from defaults.ts)
 * - labels: Tags for organization in Langfuse UI
 */
const PROMPTS = [
  // Neutral proposal prompts (Standard Bearer drafters)
  {
    name: 'lens-proposal-engineering',
    content: FALLBACK_LENS_PROPOSAL_ENGINEERING,
    labels: ['neutral-pipeline', 'standard-bearer', 'engineering', 'production'],
  },
  {
    name: 'lens-proposal-timing',
    content: FALLBACK_LENS_PROPOSAL_TIMING,
    labels: ['neutral-pipeline', 'standard-bearer', 'timing', 'production'],
  },
  {
    name: 'lens-proposal-monopoly',
    content: FALLBACK_LENS_PROPOSAL_MONOPOLY,
    labels: ['neutral-pipeline', 'standard-bearer', 'monopoly', 'production'],
  },
  {
    name: 'lens-proposal-distribution',
    content: FALLBACK_LENS_PROPOSAL_DISTRIBUTION,
    labels: ['neutral-pipeline', 'standard-bearer', 'distribution', 'production'],
  },
  // Updated system prompts
  {
    name: 'gauntlet-skeptic-system',
    content: FALLBACK_GAUNTLET_SKEPTIC_SYSTEM,
    labels: ['gauntlet', 'skeptic', 'analytic-fidelity', 'production'],
  },
  {
    name: 'gauntlet-visionary-system',
    content: FALLBACK_GAUNTLET_VISIONARY_SYSTEM,
    labels: ['gauntlet', 'visionary', 'grounding-firewall', 'production'],
  },
  {
    name: 'gauntlet-jury-system',
    content: FALLBACK_GAUNTLET_JURY_SYSTEM,
    labels: ['gauntlet', 'jury', 'thiel-10x-test', 'production'],
  },
  // New: Jury Gap Report synthesis prompt
  {
    name: 'gauntlet-jury-gap-report',
    content: FALLBACK_JURY_GAP_REPORT_SYSTEM,
    labels: ['gauntlet', 'jury', 'gap-report', 'production'],
  },
  // Competitor Scout
  {
    name: 'competitor-scout-system',
    content: FALLBACK_COMPETITOR_SCOUT_SYSTEM,
    labels: ['scout', 'competitor', 'search-grounding', 'production'],
  },
  // Lens-specific cartridge protocols (skeptic)
  {
    name: 'lens-protocol-skeptic-engineering',
    content: SKEPTIC_PROTOCOLS.engineering,
    labels: ['cartridge', 'skeptic', 'engineering', 'analytic-fidelity', 'production'],
  },
  {
    name: 'lens-protocol-skeptic-monopoly',
    content: SKEPTIC_PROTOCOLS.monopoly,
    labels: ['cartridge', 'skeptic', 'monopoly', 'production'],
  },
  {
    name: 'lens-protocol-skeptic-distribution',
    content: SKEPTIC_PROTOCOLS.distribution,
    labels: ['cartridge', 'skeptic', 'distribution', 'production'],
  },

  // =========================================================================
  // YC Application Framework
  // =========================================================================

  // YC system prompts
  {
    name: 'yc-advocate-system',
    content: YC_ADVOCATE_SYSTEM,
    labels: ['yc', 'advocate', 'system', 'production'],
  },
  {
    name: 'yc-skeptic-system',
    content: YC_SKEPTIC_SYSTEM,
    labels: ['yc', 'skeptic', 'system', 'production'],
  },
  {
    name: 'yc-committee-system',
    content: YC_COMMITTEE_SYSTEM,
    labels: ['yc', 'committee', 'system', 'production'],
  },

  // YC proposal prompts
  ...Object.entries(YC_PROPOSAL_PROMPTS).map(([stepId, content]) => ({
    name: `yc-proposal-${stepId}`,
    content,
    labels: ['yc', 'proposal', stepId, 'production'],
  })),

  // YC advocate protocols
  ...Object.entries(YC_ADVOCATE_PROTOCOLS).map(([stepId, content]) => ({
    name: `yc-protocol-visionary-${stepId}`,
    content,
    labels: ['yc', 'cartridge', 'advocate', stepId, 'production'],
  })),

  // YC skeptic protocols
  ...Object.entries(YC_SKEPTIC_PROTOCOLS).map(([stepId, content]) => ({
    name: `yc-protocol-skeptic-${stepId}`,
    content,
    labels: ['yc', 'cartridge', 'skeptic', stepId, 'production'],
  })),
];

async function pushPrompts() {
  // --only flag: push specific prompts by name (comma-separated)
  // Usage: npx tsx scripts/push-langfuse-prompts.ts --only gauntlet-skeptic-system,lens-protocol-skeptic-engineering
  const onlyFlag = process.argv.find(a => a.startsWith('--only='))?.split('=')[1]
    ?? (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null);
  const onlyNames = onlyFlag ? onlyFlag.split(',').map(s => s.trim()) : null;

  const toPush = onlyNames
    ? PROMPTS.filter(p => onlyNames.includes(p.name))
    : PROMPTS;

  if (onlyNames && toPush.length === 0) {
    console.error(`No prompts matched --only filter: ${onlyNames.join(', ')}`);
    console.error(`Available: ${PROMPTS.map(p => p.name).join(', ')}`);
    process.exit(1);
  }

  console.log(`Pushing ${toPush.length} prompt(s) to Langfuse (Production)...\n`);

  for (const { name, content, labels } of toPush) {
    try {
      // Create prompt with isActive=true to set as production
      await langfuse.createPrompt({
        name,
        prompt: content,
        labels,
        type: 'text',
        config: {
          // Any model config can go here
        },
      });
      console.log(`✓ ${name} → Production`);
    } catch (error: any) {
      // Handle existing prompts - create new version
      const isConflict = error.message?.includes('already exists') ||
                         error.status === 409 ||
                         error.message?.includes('Prompt with this name');

      if (isConflict) {
        try {
          // Creating with same name creates a new version
          await langfuse.createPrompt({
            name,
            prompt: content,
            labels,
            type: 'text',
          });
          console.log(`✓ ${name} → New version (Production)`);
        } catch (retryError: any) {
          console.error(`✗ ${name}: ${retryError.message || retryError}`);
        }
      } else {
        console.error(`✗ ${name}: ${error.message || error}`);
      }
    }
  }

  await langfuse.shutdownAsync();
  console.log('\n✓ Done! Prompts are now live in Langfuse.');
  console.log('  View at: https://cloud.langfuse.com → Prompts');
}

pushPrompts().catch(console.error);
