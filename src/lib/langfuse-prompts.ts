/**
 * Langfuse Prompt Runtime Helper
 *
 * Provides getPrompt() function to fetch prompts from Langfuse with:
 * - In-memory caching (15 minute TTL)
 * - Fallback to local constants on failure
 * - Type-safe prompt names
 */

import { Langfuse } from 'langfuse';
import type { LensId } from '@/types/lenses';
import {
  FALLBACK_INFLATION_PROMPT,
  FALLBACK_GAUNTLET_SKEPTIC_SYSTEM,
  FALLBACK_GAUNTLET_VISIONARY_SYSTEM,
  FALLBACK_GAUNTLET_JURY_SYSTEM,
  FALLBACK_JURY_MONOPOLY_RUBRIC,
  FALLBACK_JURY_GAP_REPORT_SYSTEM,
  FALLBACK_LENS_PROPOSAL_ENGINEERING,
  FALLBACK_LENS_PROPOSAL_TIMING,
  FALLBACK_LENS_PROPOSAL_MONOPOLY,
  FALLBACK_LENS_PROPOSAL_DISTRIBUTION,
} from '@/lib/prompts/defaults';

// ============================================================================
// LANGFUSE CLIENT
// ============================================================================

const LANGFUSE_PUBLIC_KEY = import.meta.env.VITE_LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = import.meta.env.VITE_LANGFUSE_SECRET_KEY;
const LANGFUSE_BASE_URL = import.meta.env.VITE_LANGFUSE_HOST || 'https://cloud.langfuse.com';

let langfuseClient: Langfuse | null = null;

function getLangfuse(): Langfuse | null {
  if (!LANGFUSE_PUBLIC_KEY) {
    console.warn('[langfuse-prompts] Langfuse Public Key not found. Using fallback prompts.');
    return null;
  }

  if (!langfuseClient) {
    langfuseClient = new Langfuse({
      publicKey: LANGFUSE_PUBLIC_KEY,
      secretKey: LANGFUSE_SECRET_KEY,
      baseUrl: LANGFUSE_BASE_URL,
    });
  }

  return langfuseClient;
}

// ============================================================================
// PROMPT CACHE
// ============================================================================

interface CacheEntry {
  prompt: string;
  timestamp: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const promptCache = new Map<string, CacheEntry>();

function getCached(name: string): string | null {
  const entry = promptCache.get(name);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    promptCache.delete(name);
    return null;
  }

  return entry.prompt;
}

function setCache(name: string, prompt: string): void {
  promptCache.set(name, {
    prompt,
    timestamp: Date.now(),
  });
}

// ============================================================================
// PROMPT FETCHING
// ============================================================================

/**
 * Fetch a prompt from Langfuse with caching and fallback.
 *
 * @param name - The Langfuse prompt name
 * @param fallback - Local fallback prompt if Langfuse fails
 * @returns The prompt string
 */
export async function getPrompt(name: string, fallback: string): Promise<string> {
  // Check cache first
  const cached = getCached(name);
  if (cached) {
    return cached;
  }

  const langfuse = getLangfuse();
  if (!langfuse) {
    return fallback;
  }

  try {
    const prompt = await langfuse.getPrompt(name);
    const compiled = prompt.prompt;

    if (typeof compiled === 'string') {
      setCache(name, compiled);
      return compiled;
    }

    // For chat prompts, extract the content
    if (Array.isArray(compiled)) {
      const text = compiled.map((msg) => {
        if (typeof msg === 'string') return msg;
        if (msg && typeof msg === 'object' && 'content' in msg) return msg.content;
        return '';
      }).join('\n\n');
      setCache(name, text);
      return text;
    }

    console.warn(`[langfuse-prompts] Unexpected prompt format for ${name}, using fallback`);
    return fallback;
  } catch (error) {
    console.warn(`[langfuse-prompts] Failed to fetch prompt "${name}", using fallback:`, error);
    return fallback;
  }
}

/**
 * Invalidate the cache for a specific prompt.
 */
export function invalidatePromptCache(name?: string): void {
  if (name) {
    promptCache.delete(name);
  } else {
    promptCache.clear();
  }
}

// ============================================================================
// PROMPT NAME HELPERS
// ============================================================================

export type PromptName =
  | 'inflation-narrative-architect'
  | 'gauntlet-skeptic-system'
  | 'gauntlet-visionary-system'
  | 'gauntlet-jury-system'
  | 'gauntlet-jury-gap-report'
  | `lens-proposal-${LensId}`
  | `lens-protocol-visionary-${LensId}`
  | `lens-protocol-skeptic-${LensId}`
  | `lens-protocol-jury-${LensId}`;

/**
 * Get the Langfuse prompt name for a lens proposal prompt.
 */
export function getLensProposalPromptName(lensId: LensId): PromptName {
  return `lens-proposal-${lensId}`;
}

/**
 * Get the Langfuse prompt name for a lens visionary protocol.
 */
export function getLensVisionaryProtocolName(lensId: LensId): PromptName {
  return `lens-protocol-visionary-${lensId}`;
}

/**
 * Get the Langfuse prompt name for a lens skeptic protocol.
 */
export function getLensSkepticProtocolName(lensId: LensId): PromptName {
  return `lens-protocol-skeptic-${lensId}`;
}

/**
 * Get the Langfuse prompt name for a lens jury protocol.
 */
export function getLensJuryProtocolName(lensId: LensId): PromptName {
  return `lens-protocol-jury-${lensId}`;
}

// ============================================================================
// FALLBACK PROMPT CONSTANTS
// Imported from @/lib/prompts/defaults for Single Source of Truth
// ============================================================================

export {
  FALLBACK_INFLATION_PROMPT,
  FALLBACK_GAUNTLET_SKEPTIC_SYSTEM,
  FALLBACK_GAUNTLET_VISIONARY_SYSTEM,
  FALLBACK_GAUNTLET_JURY_SYSTEM,
  FALLBACK_JURY_MONOPOLY_RUBRIC,
  FALLBACK_JURY_GAP_REPORT_SYSTEM,
  FALLBACK_LENS_PROPOSAL_ENGINEERING,
  FALLBACK_LENS_PROPOSAL_TIMING,
  FALLBACK_LENS_PROPOSAL_MONOPOLY,
  FALLBACK_LENS_PROPOSAL_DISTRIBUTION,
};
