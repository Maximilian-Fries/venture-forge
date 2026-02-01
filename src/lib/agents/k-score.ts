/**
 * K-Score: Confidence calibration for agent responses
 *
 * K = 0.4*G + 0.3*L + 0.3*E
 *
 * G (Grounding): How well-cited/evidence-backed is the claim
 * L (Logic): Internal consistency and coherence
 * E (Entropy): Inverse of uncertainty (low E = high certainty)
 */

export interface KScoreBreakdown {
  grounding: number;      // 0-100: Citations and evidence
  logic: number;          // 0-100: Internal consistency
  entropy: number;        // 0-100: Certainty level (inverted from raw entropy)
  overall: number;        // 0-100: Weighted combination
  confidence: 'high' | 'medium' | 'low' | 'uncertain';
}

export interface GroundingFactors {
  hasManifestCitations: boolean;
  hasExternalData: boolean;
  specificity: number; // 0-100: How specific vs vague
  claimCount: number;  // Number of distinct claims made
}

export interface LogicFactors {
  hasContradictions: boolean;
  followsStructure: boolean;
  causalChainValid: boolean;
  premiseSupportsConclusion: boolean;
}

/**
 * Calculate Grounding score (G) based on evidence factors
 */
export function calculateGrounding(factors: GroundingFactors): number {
  let score = 40; // Base score

  if (factors.hasManifestCitations) score += 20;
  if (factors.hasExternalData) score += 15;
  score += Math.min(25, factors.specificity * 0.25);

  // Penalty for too many unsubstantiated claims
  if (factors.claimCount > 5 && !factors.hasManifestCitations) {
    score -= Math.min(20, (factors.claimCount - 5) * 4);
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Logic score (L) based on coherence factors
 */
export function calculateLogic(factors: LogicFactors): number {
  let score = 50; // Base score

  if (!factors.hasContradictions) score += 20;
  if (factors.followsStructure) score += 15;
  if (factors.causalChainValid) score += 10;
  if (factors.premiseSupportsConclusion) score += 15;

  // Penalty for contradictions
  if (factors.hasContradictions) score -= 30;

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Entropy score (E) - higher score means MORE certain
 * Based on response characteristics that indicate uncertainty
 */
export function calculateEntropy(
  hedgingWords: number,     // Count of "maybe", "perhaps", "might"
  strongClaims: number,     // Count of definitive statements
  questionMarks: number     // Number of self-questioning
): number {
  // Start with neutral certainty
  let certainty = 50;

  // Hedging reduces certainty
  certainty -= Math.min(30, hedgingWords * 6);

  // Strong claims increase certainty
  certainty += Math.min(30, strongClaims * 5);

  // Self-questioning reduces certainty (but can be good for nuance)
  certainty -= Math.min(15, questionMarks * 5);

  return Math.max(0, Math.min(100, certainty));
}

/**
 * Calculate the overall K-Score from components
 */
export function calculateKScore(
  grounding: number,
  logic: number,
  entropy: number
): KScoreBreakdown {
  const overall = Math.round(0.4 * grounding + 0.3 * logic + 0.3 * entropy);

  let confidence: KScoreBreakdown['confidence'];
  if (overall >= 75) confidence = 'high';
  else if (overall >= 55) confidence = 'medium';
  else if (overall >= 35) confidence = 'low';
  else confidence = 'uncertain';

  return {
    grounding,
    logic,
    entropy,
    overall,
    confidence,
  };
}

/**
 * Analyze a response text to extract K-Score factors
 */
export function analyzeResponseForKScore(
  responseText: string,
  manifestContext?: string
): KScoreBreakdown {
  // Grounding analysis
  const hasManifestCitations = manifestContext
    ? responseText.toLowerCase().includes('manifest') ||
      responseText.toLowerCase().includes('stated') ||
      responseText.toLowerCase().includes('according to')
    : false;
  const hasExternalData = /\d{4}|study|research|report|data shows/i.test(responseText);
  const specificity = calculateSpecificity(responseText);
  const claimCount = (responseText.match(/\. [A-Z]/g) || []).length + 1;

  const grounding = calculateGrounding({
    hasManifestCitations,
    hasExternalData,
    specificity,
    claimCount,
  });

  // Logic analysis
  const hasContradictions = detectContradictions(responseText);
  const followsStructure = /^[*\-\d]|##|###/m.test(responseText); // Has formatting
  const causalChainValid = /because|therefore|thus|as a result|leads to/i.test(responseText);
  const premiseSupportsConclusion = responseText.length > 200 && /conclusion|in summary|ultimately/i.test(responseText);

  const logic = calculateLogic({
    hasContradictions,
    followsStructure,
    causalChainValid,
    premiseSupportsConclusion,
  });

  // Entropy analysis
  const hedgingWords = (responseText.match(/\b(maybe|perhaps|might|could|possibly|potentially|arguably)\b/gi) || []).length;
  const strongClaims = (responseText.match(/\b(definitely|certainly|clearly|obviously|undoubtedly|must|will)\b/gi) || []).length;
  const questionMarks = (responseText.match(/\?/g) || []).length;

  const entropy = calculateEntropy(hedgingWords, strongClaims, questionMarks);

  return calculateKScore(grounding, logic, entropy);
}

/**
 * Helper: Calculate specificity of claims (presence of numbers, names, dates)
 */
function calculateSpecificity(text: string): number {
  let score = 0;

  // Numbers and percentages
  if (/\d+%|\$\d+|\d+\s*(million|billion|thousand)/i.test(text)) score += 30;

  // Specific names or companies
  if (/[A-Z][a-z]+\s+(Inc|Corp|LLC|Co\.|Ltd)/i.test(text)) score += 20;

  // Dates and timeframes
  if (/\b(20\d{2}|Q[1-4]|January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(text)) score += 20;

  // Technical terms (indicates domain knowledge)
  if (/\b(API|SDK|SaaS|B2B|B2C|TAM|SAM|CAC|LTV|NPS|ARR|MRR)\b/.test(text)) score += 15;

  // Specific metrics or KPIs
  if (/\b(conversion|retention|churn|growth rate|market share)\b/i.test(text)) score += 15;

  return Math.min(100, score);
}

/**
 * Helper: Detect logical contradictions in text
 */
function detectContradictions(text: string): boolean {
  const sentences = text.split(/[.!?]+/).map(s => s.trim().toLowerCase());

  // Simple contradiction patterns
  const contradictionPairs = [
    ['no competition', 'many competitors'],
    ['first mover', 'existing players'],
    ['easy to', 'difficult to'],
    ['low risk', 'high risk'],
    ['certain', 'uncertain'],
  ];

  for (const [a, b] of contradictionPairs) {
    const hasA = sentences.some(s => s.includes(a));
    const hasB = sentences.some(s => s.includes(b));
    if (hasA && hasB) return true;
  }

  return false;
}

/**
 * Format K-Score for display
 */
export function formatKScoreLabel(score: KScoreBreakdown): string {
  const emoji = score.confidence === 'high' ? '🟢' :
                score.confidence === 'medium' ? '🟡' :
                score.confidence === 'low' ? '🟠' : '🔴';
  return `${emoji} K-Score: ${score.overall} (${score.confidence})`;
}
