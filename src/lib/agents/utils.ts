/**
 * Shared utilities for AI agent modules.
 *
 * Contains JSON parsing, retry logic, and error types
 * used across gauntlet-agents and competitor-agent.
 */

/**
 * Custom error class for AI response parsing failures.
 * Provides user-friendly messages while preserving technical details for debugging.
 */
export class AIResponseParseError extends Error {
  public readonly isRetryable: boolean;

  constructor(message: string, public readonly rawResponse: string, isRetryable = true) {
    super(message);
    this.name = 'AIResponseParseError';
    this.isRetryable = isRetryable;
  }
}

/**
 * Maximum number of automatic retries for failed API calls.
 */
export const MAX_RETRIES = 2;

/**
 * Delay between retries in milliseconds (increases with each retry).
 */
export const RETRY_DELAY_MS = 1000;

/**
 * Safely parse JSON from an LLM response.
 * Handles markdown code fences, trailing commas, and provides user-friendly errors.
 */
export function parseJSON<T>(raw: string): T {
  if (!raw || typeof raw !== 'string') {
    throw new AIResponseParseError(
      'The AI returned an empty response. Please try again.',
      raw || ''
    );
  }

  let cleaned = raw.trim();

  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Try to find JSON array or object in the response
  if (!cleaned.startsWith('[') && !cleaned.startsWith('{')) {
    const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) {
      cleaned = match[1];
    } else {
      // No JSON found - the AI returned plain text instead
      console.warn('[parseJSON] AI returned plain text instead of JSON:', raw.substring(0, 200));
      throw new AIResponseParseError(
        'The AI returned an unexpected response format. Retrying...',
        raw,
        true // retryable
      );
    }
  }

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(cleaned) as T;
  } catch (parseError) {
    // Log the actual error for debugging but show user-friendly message
    console.error('[parseJSON] JSON parse failed:', parseError);
    console.error('[parseJSON] Attempted to parse:', cleaned.substring(0, 500));
    throw new AIResponseParseError(
      'The AI response could not be processed. Retrying...',
      raw,
      true // retryable
    );
  }
}

/**
 * Helper to invoke the model and parse the JSON response with automatic retries.
 * Retries up to MAX_RETRIES times on parse failures before giving up.
 */
export async function invokeWithRetry<T>(
  invoker: () => Promise<string>,
  parser: (text: string) => T,
  context: string // For logging
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const text = await invoker();
      return parser(text);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = error instanceof AIResponseParseError && error.isRetryable;
      const attemptsLeft = MAX_RETRIES - attempt;

      if (isRetryable && attemptsLeft > 0) {
        console.warn(`[${context}] Attempt ${attempt + 1} failed, retrying (${attemptsLeft} attempts left)...`);
        // Wait before retrying, with increasing delay
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }

      // No more retries or non-retryable error
      break;
    }
  }

  // All retries exhausted - throw user-friendly error
  console.error(`[${context}] All ${MAX_RETRIES + 1} attempts failed`);
  throw new AIResponseParseError(
    'The AI could not generate a valid response after multiple attempts. Please try again later.',
    lastError instanceof AIResponseParseError ? lastError.rawResponse : '',
    false // not retryable
  );
}
