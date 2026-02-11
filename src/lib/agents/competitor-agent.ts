/**
 * Competitor Scout Agent
 *
 * Uses Google Search Grounding with an aggressive threshold to find
 * competitors, alternatives, and status-quo solutions for a venture.
 * Fires after the Monopoly lens resolves.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DynamicRetrievalMode } from '@google/generative-ai';
import type { VentureManifest, CompetitorReport } from '@/types/database';
import { getLangfuseCallback } from '@/lib/langfuse';
import { getPrompt } from '@/lib/langfuse-prompts';
import { FALLBACK_COMPETITOR_SCOUT_SYSTEM } from '@/lib/prompts/defaults';
import { parseJSON, invokeWithRetry } from './utils';

/**
 * Create a model with aggressive Google Search grounding (threshold 0.3).
 * Lower threshold = more frequent searching.
 */
function getSearchModel() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-google-api-key') {
    throw new Error('API key not configured');
  }

  const base = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: apiKey,
    temperature: 0.3,
    maxOutputTokens: 8192,
  });

  return base.bindTools([
    {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: DynamicRetrievalMode.MODE_DYNAMIC,
          dynamicThreshold: 0.3,
        },
      },
    },
  ]);
}

/**
 * Run the Competitor Scout against the venture manifest.
 * Returns a CompetitorReport with categorized competitors and a red ocean alert.
 */
export async function runCompetitorScout(
  manifest: VentureManifest,
  sessionId?: string
): Promise<CompetitorReport> {
  const systemPrompt = await getPrompt(
    'competitor-scout-system',
    FALLBACK_COMPETITOR_SCOUT_SYSTEM
  );

  const wedge = manifest.wedge?.target_audience || 'Not specified';
  const thesis = manifest.core_thesis?.statement || manifest.refined_vision || manifest.raw_vision || 'Not specified';
  const moat = manifest.engineering_moat || 'Not specified';

  const userMessage = `VENTURE TO SCOUT:
- Core Thesis: ${thesis}
- Wedge / Target Audience: ${wedge}
- Engineering Moat: ${moat}

Search for competitors, adjacent solutions, and status-quo alternatives for this venture. Be thorough.

Remember: Output ONLY a JSON object. Start with { and end with }`;

  const model = getSearchModel();
  const langfuseHandler = getLangfuseCallback(sessionId);
  const callbacks = langfuseHandler ? [langfuseHandler] : undefined;

  const report = await invokeWithRetry<CompetitorReport>(
    async () => {
      const response = await model.invoke(
        [
          new SystemMessage(systemPrompt),
          new HumanMessage(userMessage),
        ],
        { callbacks }
      );

      return typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? (response.content[0] as any).text
          : '';
    },
    (text) => parseJSON<CompetitorReport>(text),
    'runCompetitorScout'
  );

  // Validate and normalize the report
  const competitors = Array.isArray(report.competitors)
    ? report.competitors.slice(0, 10).map(c => ({
      name: c.name || 'Unknown',
      url: c.url,
      category: (['direct', 'adjacent', 'status_quo'].includes(c.category) ? c.category : 'adjacent') as 'direct' | 'adjacent' | 'status_quo',
      description: c.description || '',
      weakness: c.weakness,
    }))
    : [];

  const directCount = competitors.filter(c => c.category === 'direct').length;

  return {
    competitors,
    redOceanAlert: report.redOceanAlert ?? directCount > 3,
    summary: report.summary || 'Competitive landscape analysis complete.',
    searchedAt: new Date().toISOString(),
  };
}
