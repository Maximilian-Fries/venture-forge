import { useState, useRef, useCallback, useEffect } from 'react';
import { getPrompt } from '@/lib/langfuse-prompts';
import { FALLBACK_INFLATION_PROMPT } from '@/lib/prompts/defaults';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { getLangfuseCallback } from '@/lib/langfuse';

// GEMINI constants removed as we use ChatGoogleGenerativeAI

interface InflationResult {
  refinedVision: string;
}

interface UseInflationReturn {
  inflate: (rawText: string) => void;
  refinedVision: string;
  isInflating: boolean;
  error: string | null;
  cancel: () => void;
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-google-api-key') {
    throw new Error('API key not configured');
  }

  console.log('[Inflation] Using model: gemini-2.5-flash');
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: apiKey,
    temperature: 0.7,
    maxOutputTokens: 4096,
  });

  const callbacks = getLangfuseCallback();

  try {
    const response = await model.invoke([
      new HumanMessage(prompt)
    ], {
      callbacks: callbacks ? [callbacks] : undefined,
      runName: 'Inflation Agent'
    });
    return response.content as string;
  } catch (error) {
    console.error('Inflation failed:', error);
    throw error;
  }
}

function parseInflationResponse(text: string): InflationResult {
  try {
    // Try to extract JSON
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      return {
        refinedVision: parsed.refinedVision || parsed.refined_vision || text,
      };
    }
  } catch {
    // Fall through
  }

  return { refinedVision: text };
}

export function useInflation(): UseInflationReturn {
  const [refinedVision, setRefinedVision] = useState('');
  const [isInflating, setIsInflating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptTemplateRef = useRef<string>(FALLBACK_INFLATION_PROMPT);

  // Pre-fetch prompt from Langfuse on mount
  useEffect(() => {
    getPrompt('inflation-narrative-architect', FALLBACK_INFLATION_PROMPT)
      .then((prompt) => {
        promptTemplateRef.current = prompt;
      })
      .catch(() => {
        // Keep using fallback
      });
  }, []);

  const cancel = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsInflating(false);
  }, []);

  const inflate = useCallback((rawText: string) => {
    // Cancel previous requests
    cancel();

    // Don't inflate very short text
    if (rawText.trim().length < 20) {
      setRefinedVision('');
      return;
    }

    // Debounce: wait 1.5s after user stops typing
    debounceRef.current = setTimeout(async () => {
      setIsInflating(true);
      setError(null);

      try {
        // Use the pre-fetched prompt template (from Langfuse or fallback)
        // Handle both {INPUT} (local) and {{input}} (Langfuse) placeholder formats
        const promptTemplate = promptTemplateRef.current;
        const prompt = promptTemplate
          .replace('{INPUT}', rawText)
          .replace('{{input}}', rawText);
        const response = await callGemini(prompt);
        const result = parseInflationResponse(response);

        setRefinedVision(result.refinedVision);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Inflation failed';
        if (msg.includes('API key')) {
          setError('API key not configured');
        } else if (msg.includes('429') || msg.includes('Rate')) {
          setError('AI is busy. Will retry...');
        } else {
          setError(null); // Silently fail for other errors
        }
      } finally {
        setIsInflating(false);
      }
    }, 1500);
  }, [cancel]);

  return { inflate, refinedVision, isInflating, error, cancel };
}
