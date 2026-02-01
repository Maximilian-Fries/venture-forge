const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Use gemini-2.0-flash as primary model (current production model)
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'] as const;

export type SpecialistType = 'visionary' | 'strategist';

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

interface SpecialistResponse {
  message: string;
  suggestedDraft?: string;
}

interface SkepticVerdict {
  score: number;
  critiques: string[];
}

const SPECIALIST_PERSONAS = {
  visionary: {
    name: 'The Visionary',
    style: `You are Peter Thiel's venture analyst. You help founders articulate their "0 to 1" breakthrough.

Your approach:
- Seek the contrarian insight that others miss
- Push for specificity on the "Secret" - what do they know that others don't?
- Help articulate why this is category creation, not incremental improvement
- Celebrate bold thinking but demand clarity

For Engineering Moat and Secret lenses, help draft answers that highlight:
- Technical depth that compounds over time
- Proprietary data or network effects
- The contrarian truth that makes this a monopoly opportunity`,
  },
  strategist: {
    name: 'The Strategist',
    style: `You are a McKinsey-trained venture strategist. You help founders think through market positioning.

Your approach:
- Focus on the specific wedge - who is desperate for this NOW?
- Map the expansion path from niche to monopoly
- Identify timing risks and incumbent blind spots
- Help articulate a clear "why now" thesis

For Wedge and Timing lenses, help draft answers that specify:
- The exact first customer segment (be ruthlessly specific)
- The sequence of adjacent markets to capture
- Why incumbents are too slow or blind to respond`,
  },
};

async function callGemini(prompt: string, temperature = 0.7): Promise<string> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-google-api-key') {
    throw new Error('Gemini API key not configured');
  }

  let lastError: Error | null = null;

  // Try each model in order until one works
  for (const model of GEMINI_MODELS) {
    const endpoint = `${GEMINI_BASE}/${model}:generateContent`;

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

      // If 404/429/503, try next model
      if (response.status === 404 || response.status === 429 || response.status === 503) {
        lastError = new Error(`Model ${model} failed (${response.status})`);
        continue;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${error}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble thinking right now.";
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message;
      if (!msg.includes('404') && !msg.includes('429') && !msg.includes('503') && !msg.includes('Quota')) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

/**
 * Chat with a specialist agent to help draft a lens answer.
 */
export async function chatWithSpecialist(
  specialistType: SpecialistType,
  lensId: string,
  userMessage: string,
  history: ChatMessage[],
  currentDraft: string
): Promise<SpecialistResponse> {
  const specialist = SPECIALIST_PERSONAS[specialistType];
  const conversation = history.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

  const prompt = `${specialist.style}

LENS: ${lensId}
CURRENT DRAFT (may be empty):
${currentDraft || '(No draft yet)'}

CONVERSATION SO FAR:
${conversation}

USER'S LATEST MESSAGE:
${userMessage}

INSTRUCTIONS:
1. Help the founder think through their answer for this lens
2. Ask clarifying questions if needed
3. If they have enough material, suggest draft text they can use
4. Be encouraging but push for specificity

Response Format (JSON):
{
  "message": "Your conversational response",
  "suggestedDraft": "Optional: full draft text to replace their current answer" (only if you're ready to suggest one)
}`;

  try {
    const responseText = await callGemini(prompt, 0.7);

    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
      responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      try {
        return JSON.parse(jsonStr);
      } catch (parseError) {
        console.warn('[Specialist] JSON parse failed, extracting message', parseError);
        // Try to extract just the message field
        const messageMatch = jsonStr.match(/"message"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/);
        if (messageMatch) {
          return { message: messageMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') };
        }
      }
    }

    // Fallback: clean up and return raw response
    const cleanText = responseText
      .replace(/^\{[\s\S]*?"message"\s*:\s*"/, '')
      .replace(/"\s*[,}][\s\S]*$/, '')
      .trim() || responseText;

    return { message: cleanText };
  } catch (error) {
    console.error('Specialist error:', error);
    const msg = error instanceof Error ? error.message : '';
    // User-friendly error messages
    if (msg.includes('429') || msg.includes('Quota') || msg.includes('Rate')) {
      return { message: "The AI is a bit busy right now. Please try again in a moment." };
    }
    return { message: "I'm having trouble connecting. Let's try that again." };
  }
}

/**
 * Generate Visionary perspective for debate on a lens.
 */
export async function generateVisionaryDebate(
  lensId: string,
  lensName: string,
  userInput: string
): Promise<string> {
  const prompt = `You are Peter Thiel's venture analyst. You seek the "0 to 1" breakthrough in every idea.

LENS: ${lensName}

FOUNDER'S INPUT:
${userInput}

INSTRUCTIONS:
Analyze this input through the lens of "${lensName}" and argue FOR the idea's breakthrough potential.

Your response should:
1. Identify the contrarian insight or "Secret" in their thinking
2. Explain why this could be category creation, not incremental improvement
3. Highlight the compounding advantages and timing opportunity
4. Be specific and actionable

Format your response with:
- **Contrarian Thesis**: Why this represents a "0 to 1" opportunity
- Numbered supporting points (2-3 key arguments)

Keep it concise but substantive (150-250 words).`;

  try {
    return await callGemini(prompt, 0.7);
  } catch (error) {
    console.error('Visionary debate error:', error);
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('429') || msg.includes('Quota') || msg.includes('Rate')) {
      return "**The AI is currently busy.** Please wait a moment and try generating the debate again.";
    }
    return "**Unable to generate Visionary analysis.** Please try again.";
  }
}

/**
 * Generate Skeptic perspective for debate on a lens.
 */
export async function generateSkepticDebate(
  lensId: string,
  lensName: string,
  userInput: string
): Promise<string> {
  const prompt = `You are a ruthless VC skeptic. Your job is to stress-test every thesis and find fatal flaws.

LENS: ${lensName}

FOUNDER'S INPUT:
${userInput}

INSTRUCTIONS:
Analyze this input through the lens of "${lensName}" and argue AGAINST the idea, finding weaknesses.

Your response should:
1. Identify hidden competitors or incumbents they're ignoring
2. Challenge timing assumptions - is this too early or too late?
3. Question defensibility - can this moat be copied?
4. Point out "1 to N" incrementalism disguised as innovation

Format your response with:
- **Red Flags Identified:**
- 🚩 **[Severity]** - [Issue]: [Explanation]

Include 2-4 red flags with severity levels (High/Medium/Low).

Keep it concise but hard-hitting (150-250 words).`;

  try {
    return await callGemini(prompt, 0.5);
  } catch (error) {
    console.error('Skeptic debate error:', error);
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('429') || msg.includes('Quota') || msg.includes('Rate')) {
      return "**The AI is currently busy.** Please wait a moment and try generating the debate again.";
    }
    return "**Unable to generate Skeptic analysis.** Please try again.";
  }
}

/**
 * Skeptic agent critiques a locked answer.
 * Returns a score (0-100) and list of strategic critiques.
 */
export async function critiqueAnswer(
  lensId: string,
  lensName: string,
  answer: string
): Promise<SkepticVerdict> {
  const prompt = `You are a ruthless VC skeptic. Your job is to find weaknesses in a founder's thesis.

You are NOT critiquing grammar or writing style. You are critiquing STRATEGY:
- Is this defensible?
- Are there hidden competitors they're ignoring?
- Is the timing right, or is this too early/late?
- Is the moat real or imagined?
- Is the wedge specific enough?

LENS: ${lensName}

FOUNDER'S ANSWER:
${answer}

INSTRUCTIONS:
1. Evaluate the strategic strength of this answer (0-100)
2. Identify 2-4 specific strategic weaknesses or risks
3. Be harsh but fair - point out what they're missing

Score Guidelines:
- 80-100: Strong, defensible, specific
- 60-79: Decent but has gaps
- 40-59: Weak, needs significant work
- 0-39: Fundamentally flawed

Response Format (JSON):
{
  "score": number (0-100),
  "critiques": ["Strategic weakness 1", "Strategic weakness 2", ...]
}`;

  try {
    const responseText = await callGemini(prompt, 0.3);

    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
      responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      return {
        score: Math.max(0, Math.min(100, parsed.score || 50)),
        critiques: parsed.critiques || [],
      };
    }

    return { score: 50, critiques: ['Unable to parse critique response'] };
  } catch (error) {
    console.error('Skeptic error:', error);
    return { score: 50, critiques: ['Error during evaluation'] };
  }
}
