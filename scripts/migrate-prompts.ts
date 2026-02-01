/**
 * Langfuse Prompt Migration Script
 *
 * This script migrates all hardcoded prompts from the codebase to Langfuse.
 * Run with: npx tsx scripts/migrate-prompts.ts
 *
 * Required environment variables:
 * - LANGFUSE_PUBLIC_KEY
 * - LANGFUSE_SECRET_KEY
 * - LANGFUSE_HOST (optional, defaults to https://cloud.langfuse.com)
 */

import { Langfuse } from 'langfuse';
import * as dotenv from 'dotenv';
import {
  FALLBACK_INFLATION_PROMPT,
  FALLBACK_GAUNTLET_SKEPTIC_SYSTEM,
  FALLBACK_GAUNTLET_VISIONARY_SYSTEM,
  FALLBACK_GAUNTLET_JURY_SYSTEM,
  PROPOSAL_PROMPTS,
  VISIONARY_PROTOCOLS,
  SKEPTIC_PROTOCOLS,
  FALLBACK_JURY_MONOPOLY_RUBRIC,
} from '@/lib/prompts/defaults';
import { LENS_ORDER } from '@/types/lenses';

// Load .env file
dotenv.config();

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || process.env.VITE_LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY || process.env.VITE_LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST || process.env.VITE_LANGFUSE_HOST || 'https://cloud.langfuse.com',
});

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

interface PromptConfig {
  name: string;
  prompt: string;
  labels?: string[];
  config?: Record<string, unknown>;
}

async function createPrompt(config: PromptConfig): Promise<void> {
  // Ensure 'production' label is present to fix runtime errors
  const labels = config.labels || ['venture-forge'];
  if (!labels.includes('production')) {
    labels.push('production');
  }

  try {
    // createPrompt creates a new version if the prompt already exists
    await langfuse.createPrompt({
      name: config.name,
      prompt: config.prompt,
      labels: labels,
      config: config.config,
      type: 'text',
    });
    console.log(`✅ Created prompt: ${config.name} [${labels.join(', ')}]`);
  } catch (error: unknown) {
    const err = error as { message?: string };
    // Handle cases where exact duplicate version might be rejected or other issues
    if (err.message?.includes('already exists')) {
      console.log(`⏭️  Prompt version already exists: ${config.name}`);
    } else {
      console.error(`❌ Failed to create prompt ${config.name}:`, error);
      // We log but don't rethrow to allow other prompts to migrate
    }
  }
}

async function migratePrompts(): Promise<void> {
  console.log('🚀 Starting Langfuse Prompt Migration...\n');

  // Check credentials
  if (!process.env.LANGFUSE_PUBLIC_KEY && !process.env.VITE_LANGFUSE_PUBLIC_KEY) {
    throw new Error('LANGFUSE_PUBLIC_KEY or VITE_LANGFUSE_PUBLIC_KEY is required');
  }
  if (!process.env.LANGFUSE_SECRET_KEY && !process.env.VITE_LANGFUSE_SECRET_KEY) {
    throw new Error('LANGFUSE_SECRET_KEY or VITE_LANGFUSE_SECRET_KEY is required');
  }

  console.log('📦 Migrating Inflation Prompt...');
  await createPrompt({
    name: 'inflation-narrative-architect',
    prompt: FALLBACK_INFLATION_PROMPT,
    labels: ['venture-forge', 'forge'],
  });

  console.log('\n📦 Migrating Gauntlet Base Prompts...');
  await createPrompt({
    name: 'gauntlet-skeptic-system',
    prompt: FALLBACK_GAUNTLET_SKEPTIC_SYSTEM,
    labels: ['venture-forge', 'gauntlet', 'skeptic'],
  });
  await createPrompt({
    name: 'gauntlet-visionary-system',
    prompt: FALLBACK_GAUNTLET_VISIONARY_SYSTEM,
    labels: ['venture-forge', 'gauntlet', 'visionary'],
  });
  await createPrompt({
    name: 'gauntlet-jury-system',
    prompt: FALLBACK_GAUNTLET_JURY_SYSTEM,
    labels: ['venture-forge', 'gauntlet', 'jury'],
  });

  console.log('\n📦 Migrating Lens Proposal Prompts...');
  for (const lensId of LENS_ORDER) {
    await createPrompt({
      name: `lens-proposal-${lensId}`,
      prompt: PROPOSAL_PROMPTS[lensId],
      labels: ['venture-forge', 'gauntlet', 'proposal', lensId],
    });
  }

  console.log('\n📦 Migrating Visionary Protocol Prompts...');
  for (const lensId of LENS_ORDER) {
    await createPrompt({
      name: `lens-protocol-visionary-${lensId}`,
      prompt: VISIONARY_PROTOCOLS[lensId],
      labels: ['venture-forge', 'gauntlet', 'visionary', lensId],
    });
  }

  console.log('\n📦 Migrating Skeptic Protocol Prompts...');
  for (const lensId of LENS_ORDER) {
    await createPrompt({
      name: `lens-protocol-skeptic-${lensId}`,
      prompt: SKEPTIC_PROTOCOLS[lensId],
      labels: ['venture-forge', 'gauntlet', 'skeptic', lensId],
    });
  }

  console.log('\n📦 Migrating Jury Protocol Extension (Monopoly)...');
  await createPrompt({
    name: 'lens-protocol-jury-monopoly',
    prompt: FALLBACK_JURY_MONOPOLY_RUBRIC,
    labels: ['venture-forge', 'gauntlet', 'jury', 'monopoly'],
  });

  // Flush all events
  await langfuse.shutdownAsync();

  console.log('\n✨ Migration complete!');
  console.log(`\nTotal prompts migrated:`);
  console.log(`  - 1 Inflation prompt`);
  console.log(`  - 3 Gauntlet base prompts`);
  console.log(`  - ${LENS_ORDER.length} Proposal prompts`);
  console.log(`  - ${LENS_ORDER.length} Visionary protocol prompts`);
  console.log(`  - ${LENS_ORDER.length} Skeptic protocol prompts`);
  console.log(`  - 1 Jury protocol extension (Monopoly)`);
  console.log(`\nTotal: ${1 + 3 + LENS_ORDER.length * 3 + 1} prompts`);
}

// Run migration
migratePrompts().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
