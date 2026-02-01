/**
 * Push Binary Check prompts to Langfuse and set them to Production.
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
} from '../src/lib/prompts/defaults';

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
  {
    name: 'lens-proposal-engineering',
    content: FALLBACK_LENS_PROPOSAL_ENGINEERING,
    labels: ['binary-check', 'analytic-fidelity', 'engineering', 'wrapper-vs-core', 'production'],
  },
  {
    name: 'lens-proposal-timing',
    content: FALLBACK_LENS_PROPOSAL_TIMING,
    labels: ['binary-check', 'analytic-fidelity', 'timing', 'trend-vs-trigger', 'production'],
  },
  {
    name: 'lens-proposal-monopoly',
    content: FALLBACK_LENS_PROPOSAL_MONOPOLY,
    labels: ['binary-check', 'analytic-fidelity', 'monopoly', 'ocean-vs-pond', 'production'],
  },
  {
    name: 'lens-proposal-distribution',
    content: FALLBACK_LENS_PROPOSAL_DISTRIBUTION,
    labels: ['binary-check', 'analytic-fidelity', 'distribution', 'rented-vs-owned', 'production'],
  },
];

async function pushPrompts() {
  console.log('Pushing prompts to Langfuse (Production)...\n');

  for (const { name, content, labels } of PROMPTS) {
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
