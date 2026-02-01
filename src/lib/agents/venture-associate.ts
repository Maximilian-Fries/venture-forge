const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Use gemini-2.0-flash as primary model (current production model)
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'] as const;

export interface ChatMessage {
    role: "assistant" | "user";
    content: string;
}

export interface RefinementResult {
    message: string;
    isComplete: boolean;
    refinedPitch?: string;
}

async function callGemini(prompt: string, temperature = 0.7): Promise<string> {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-google-api-key') {
        console.error('[Gemini] API key not configured');
        throw new Error('Gemini API key not configured');
    }

    let lastError: Error | null = null;

    // Try each model in order until one works
    for (const model of GEMINI_MODELS) {
        const endpoint = `${GEMINI_BASE}/${model}:generateContent`;
        console.log('[Gemini] Trying model:', model);

        try {
            const response = await fetch(`${endpoint}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature,
                        topP: 0.8,
                        maxOutputTokens: 8192,
                    },
                }),
            });

            console.log('[Gemini] Response status:', response.status, response.statusText);

            // If 404 (Not Found), 429 (Rate Limit), or 503 (Service Unavailable), try next model
            if (response.status === 404 || response.status === 429 || response.status === 503) {
                console.warn(`[Gemini] Model ${model} failed with status ${response.status}, trying next...`);
                lastError = new Error(`Model ${model} failed (${response.status})`);
                continue;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Gemini] API Error Response:', errorText);
                throw new Error(`Gemini API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!content) {
                console.error('[Gemini] No content in response:', JSON.stringify(data));
                throw new Error('No content returned from Gemini');
            }

            console.log('[Gemini] Success with model:', model, '- received', content.length, 'chars');
            return content;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // If it's a 404, continue to next model; otherwise throw
            // If it's a 404/429/503-like error, continue; otherwise throw
            const msg = lastError.message;
            if (!msg.includes('404') && !msg.includes('429') && !msg.includes('503') && !msg.includes('Quota') && !msg.includes('found')) {
                throw lastError;
            }
        }
    }

    // All models failed
    throw lastError || new Error('All Gemini models failed');
}

export async function refinePitch(
    currentInput: string,
    history: ChatMessage[]
): Promise<RefinementResult> {
    // Format history for the prompt
    const conversation = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    // Detect if this is a substantive pitch (not empty, not just "help me")
    const scratchKeywords = ['make one up', 'generate', 'create for me', 'help me think', 'no idea', 'from scratch', 'suggest', 'i don\'t know'];
    const isAskingForHelp = scratchKeywords.some(kw => currentInput.toLowerCase().includes(kw)) || currentInput.trim().length < 10;
    const hasPitch = currentInput.trim().length >= 20; // Substantive input

    console.log('[VentureAssociate] Input length:', currentInput.length, 'hasPitch:', hasPitch, 'isAskingForHelp:', isAskingForHelp);

    const prompt = `You are a "Venture Associate" at a top-tier VC firm (Thielian School).
Your goal is to transform a founder's raw idea into a crisp, "Zero to One" problem statement.

CRITICAL INSTRUCTION:
${hasPitch ? `The user has provided a pitch. DO NOT greet them. DO NOT ask questions.
IMMEDIATELY generate a polished "Zero to One" venture description based on their input.
Your response MUST include a refined pitch in the refinedPitch field.` :
            `The user needs help. Ask ONE specific question to understand their idea better.`}

Your Style:
- Sharp and direct
- No buzzwords
- Specific, concrete problems
- Focus on "Who is desperate for this?"

${isAskingForHelp ? `HELP MODE: Ask ONE probing question about:
- What industry do they know well?
- What problem have they personally experienced?
- What skills or unfair advantages do they have?` : ''}

CONVERSATION SO FAR:
${conversation}

LATEST USER INPUT:
${currentInput || "(Empty input)"}

${hasPitch ? `REQUIRED ACTION: Generate a refined "Zero to One" description NOW. Structure it as:
1. The specific customer with a burning problem
2. The unique insight or "Secret"
3. Why existing solutions fail
4. The compounding advantage

Set isComplete=true and include the full refinedPitch.` : ''}

Response Format (JSON only, no markdown):
{
  "message": "Your FULL response including the complete refined pitch. Do NOT just say 'Here is the pitch' - include the entire content here.",
  "isComplete": ${hasPitch ? 'true' : 'false'},
  "refinedPitch": "${hasPitch ? 'Copy of the polished pitch text only (same content, for storage)' : 'null'}"
}

IMPORTANT: The "message" field must contain your COMPLETE response. Do not split content between fields.`;

    try {
        const responseText = await callGemini(prompt, 0.7);
        console.log('[VentureAssociate] Raw response length:', responseText.length);
        console.log('[VentureAssociate] Raw response preview:', responseText.substring(0, 500));

        // Strategy 1: Try to parse as clean JSON (remove markdown fences first)
        let jsonStr = responseText;
        const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
            jsonStr = fenceMatch[1].trim();
        }

        // Try direct JSON parse first
        try {
            const parsed = JSON.parse(jsonStr);
            console.log('[VentureAssociate] Direct JSON parse succeeded');
            return {
                message: parsed.message || '',
                isComplete: Boolean(parsed.isComplete),
                refinedPitch: parsed.refinedPitch || undefined
            };
        } catch (e) {
            console.log('[VentureAssociate] Direct JSON parse failed:', e);
        }

        // Strategy 2: Extract fields manually using proper string boundary detection
        // This handles cases where the model puts unescaped newlines in JSON strings
        const extractJsonStringField = (json: string, fieldName: string): string | null => {
            const fieldPattern = new RegExp(`"${fieldName}"\\s*:\\s*"`);
            const match = json.match(fieldPattern);
            if (!match || match.index === undefined) return null;

            const startIdx = match.index + match[0].length;
            let endIdx = startIdx;
            let escaped = false;

            // Walk through character by character to find the unescaped closing quote
            for (let i = startIdx; i < json.length; i++) {
                const char = json[i];
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (char === '\\') {
                    escaped = true;
                    continue;
                }
                if (char === '"') {
                    endIdx = i;
                    break;
                }
            }

            if (endIdx > startIdx) {
                const content = json.substring(startIdx, endIdx);
                // Unescape the content
                return content
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r')
                    .replace(/\\t/g, '\t')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');
            }
            return null;
        };

        // Try to find JSON object in response
        const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
            const jsonContent = jsonObjectMatch[0];
            console.log('[VentureAssociate] Found JSON object, length:', jsonContent.length);

            const message = extractJsonStringField(jsonContent, 'message');
            const refinedPitch = extractJsonStringField(jsonContent, 'refinedPitch');
            const isComplete = /["']?isComplete["']?\s*:\s*true/i.test(jsonContent);

            if (message) {
                console.log('[VentureAssociate] Extracted message length:', message.length);
                console.log('[VentureAssociate] Extracted refinedPitch:', refinedPitch ? refinedPitch.length + ' chars' : 'null');
                return {
                    message,
                    isComplete,
                    refinedPitch: refinedPitch || undefined
                };
            }
        }

        // Strategy 3: No JSON found - return raw response cleaned up
        console.log('[VentureAssociate] No valid JSON structure found, returning cleaned response');
        // Remove any partial JSON artifacts
        const cleanedResponse = responseText
            .replace(/^```json\s*/i, '')
            .replace(/```\s*$/i, '')
            .replace(/^\s*\{\s*"message"\s*:\s*"?/, '')
            .replace(/"?\s*,?\s*"isComplete"[\s\S]*$/, '')
            .trim();

        return {
            message: cleanedResponse || responseText,
            isComplete: false
        };

    } catch (error) {
        console.error("Agent Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Provide user-friendly error messages (hide technical details)
        let userMessage: string;
        if (errorMessage.includes('API key not configured')) {
            userMessage = "API key not configured. Please check your VITE_GEMINI_API_KEY environment variable.";
        } else if (errorMessage.includes('403') || errorMessage.includes('401')) {
            userMessage = "Authentication failed. Please verify your API key is valid.";
        } else if (errorMessage.includes('429') || errorMessage.includes('Quota') || errorMessage.includes('Rate')) {
            userMessage = "The AI is a bit busy right now. Please wait a moment and try again.";
        } else if (errorMessage.includes('500') || errorMessage.includes('503')) {
            userMessage = "The AI service is temporarily unavailable. Please try again in a few moments.";
        } else if (errorMessage.includes('All Gemini models failed') || errorMessage.includes('not found')) {
            userMessage = "I'm having trouble connecting to the AI service right now. Please try again in a moment.";
        } else {
            userMessage = "Something went wrong. Please try again.";
        }

        // Log the actual error for debugging
        console.error('[VentureAssociate] Returning user-friendly error. Original:', errorMessage);

        return {
            message: userMessage,
            isComplete: false
        };
    }
}
