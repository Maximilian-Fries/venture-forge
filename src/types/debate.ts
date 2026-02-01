export type Severity = 'high' | 'medium' | 'low';
export type Winner = 'visionary' | 'skeptic';

export interface DebatePoint {
  id: string;
  lensId: string;

  // The Critique (Skeptic)
  critique: {
    claim: string;       // Concise one-line claim
    reasoning: string;   // Detailed paragraph
    severity: Severity;  // Fatal flaw vs Friction
    source?: string;     // Citation or "Logic/Physics"
  };

  // The Defense (Visionary)
  defense?: {
    rebuttal: string;    // Direct counter-argument
    reasoning: string;   // Detailed paragraph
    source?: string;     // Citation or "Logic"
  };

  // The Verdict (Jury)
  verdict?: {
    winner: Winner;
    reasoning: string;   // Why the Jury awarded the point
  };
}

export interface LensDebateResult {
  lensId: string;
  points: DebatePoint[];
  score: number;          // 0-100 (Visionary Win Rate weighted by Severity)
  status: 'pending' | 'attacking' | 'defending' | 'judging' | 'resolved';
}

// Severity weights for scoring
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Calculate lens score from debate points.
 * Score = (Total Visionary Weighted Points / Total Weighted Points) * 100
 */
export function calculateLensScore(points: DebatePoint[]): number {
  const judged = points.filter(p => p.verdict);
  if (judged.length === 0) return 0;

  let totalWeight = 0;
  let visionaryWeight = 0;

  for (const point of judged) {
    const weight = SEVERITY_WEIGHTS[point.critique.severity];
    totalWeight += weight;
    if (point.verdict!.winner === 'visionary') {
      visionaryWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round((visionaryWeight / totalWeight) * 100) : 0;
}
