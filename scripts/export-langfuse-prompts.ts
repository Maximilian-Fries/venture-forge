/**
 * Script to export Binary Check prompts for Langfuse migration.
 *
 * Run with: npx ts-node scripts/export-langfuse-prompts.ts
 * Or: npx tsx scripts/export-langfuse-prompts.ts
 *
 * This will output each prompt with its Langfuse name, ready for copy-paste
 * into the Langfuse Prompt Management UI.
 */

import {
  FALLBACK_LENS_PROPOSAL_ENGINEERING,
  FALLBACK_LENS_PROPOSAL_TIMING,
  FALLBACK_LENS_PROPOSAL_MONOPOLY,
  FALLBACK_LENS_PROPOSAL_DISTRIBUTION,
} from '../src/lib/prompts/defaults';

const PROMPTS = [
  { name: 'lens-proposal-engineering', content: FALLBACK_LENS_PROPOSAL_ENGINEERING },
  { name: 'lens-proposal-timing', content: FALLBACK_LENS_PROPOSAL_TIMING },
  { name: 'lens-proposal-monopoly', content: FALLBACK_LENS_PROPOSAL_MONOPOLY },
  { name: 'lens-proposal-distribution', content: FALLBACK_LENS_PROPOSAL_DISTRIBUTION },
];

console.log('='.repeat(80));
console.log('LANGFUSE PROMPT EXPORT - Binary Check / Analytic Fidelity Prompts');
console.log('='.repeat(80));
console.log('\nThese prompts implement the Gap Report protocol.');
console.log('Copy each prompt to Langfuse Prompt Management with the specified name.\n');

for (const { name, content } of PROMPTS) {
  console.log('='.repeat(80));
  console.log(`LANGFUSE PROMPT NAME: ${name}`);
  console.log('='.repeat(80));
  console.log(content);
  console.log('\n');
}

console.log('='.repeat(80));
console.log('END OF EXPORT');
console.log('='.repeat(80));
