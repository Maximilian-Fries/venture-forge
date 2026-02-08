import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DebatePoint, Severity } from '@/types/debate';
import { SEVERITY_WEIGHTS, calculateLensScore } from '@/types/debate';

const SEVERITY_CONFIG: Record<Severity, { label: string }> = {
  high: { label: 'Fatal' },
  medium: { label: 'Friction' },
  low: { label: 'Minor' },
};

// Priority bars icon (Linear-style) — 3 vertical bars of increasing height
function PriorityBars({ severity }: { severity: Severity }) {
  const config = SEVERITY_CONFIG[severity];
  const filled = severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
  // Only severity gets color — red for fatal, amber for friction, zinc for minor
  const fillClass = severity === 'high' ? 'fill-red-400' : severity === 'medium' ? 'fill-amber-400' : 'fill-zinc-500';
  return (
    <div className="shrink-0" title={config.label}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="9" width="3" height="4" rx="0.5"
          className={filled >= 1 ? fillClass : 'fill-zinc-700'}
        />
        <rect x="5.5" y="5" width="3" height="8" rx="0.5"
          className={filled >= 2 ? fillClass : 'fill-zinc-700'}
        />
        <rect x="10" y="1" width="3" height="12" rx="0.5"
          className={filled >= 3 ? fillClass : 'fill-zinc-700'}
        />
      </svg>
    </div>
  );
}

// Safely coerce any AI field to a string — the AI sometimes returns objects/arrays
// instead of strings, which crashes .split() and .replace() calls.
function str(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(v => str(v)).join('\n\n');
  if (typeof value === 'object') {
    // If it has a common text field, use it; otherwise stringify
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.reasoning === 'string') return obj.reasoning;
    if (typeof obj.content === 'string') return obj.content;
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

// Parse [GROUNDING: "quote" → PROVES: "explanation"] markers from Visionary text.
// Handles quoted or unquoted values, smart quotes, various arrow styles.
function parseGroundingCitations(text: string): { clean: string; citations: { quote: string; proves: string }[] } {
  const citations: { quote: string; proves: string }[] = [];
  const stripQuotes = (s: string) => s.replace(/^["""\s]+|["""\s]+$/g, '').trim();
  const clean = text
    .replace(
      /\[GROUNDING:\s*([\s\S]+?)\s*(?:→|->|=>|—>)\s*PROVES:\s*([\s\S]+?)\s*\]/gi,
      (_, rawQuote, rawProves) => {
        citations.push({ quote: stripQuotes(rawQuote), proves: stripQuotes(rawProves) });
        return '';
      }
    )
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { clean, citations };
}

interface DebateTableProps {
  points: DebatePoint[];
  isLoading?: boolean;
  loadingPhase?: 'attacking' | 'defending' | 'judging';
  hideScoreSummary?: boolean;
}

export function DebateTable({ points: rawPoints, isLoading, loadingPhase, hideScoreSummary }: DebateTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Defensive: ensure points is always a valid array with valid critique objects
  const points = Array.isArray(rawPoints)
    ? rawPoints.filter(p => p && p.critique && typeof p.critique.claim === 'string')
    : [];

  const score = calculateLensScore(points);
  const judgedCount = points.filter(p => p.verdict).length;

  return (
    <div className="space-y-4">
      {/* Score Summary */}
      {judgedCount > 0 && !hideScoreSummary && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Lens Score</span>
          <span className={cn(
            'text-xl font-bold tabular-nums',
            score >= 70 ? 'text-green-400' :
            score >= 50 ? 'text-amber-400' :
            score >= 30 ? 'text-orange-400' :
            'text-red-400'
          )}>
            {score}
          </span>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm px-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
          <span className="text-zinc-400">
            {loadingPhase === 'attacking' && 'Skeptic is identifying failure points...'}
            {loadingPhase === 'defending' && 'Visionary is mounting defenses...'}
            {loadingPhase === 'judging' && 'Jury is adjudicating...'}
          </span>
        </div>
      )}

      {/* Points Table */}
      {points.length > 0 && (
        <div className="border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/60">
          {points.map((point) => (
            <DebatePointRow
              key={point.id}
              point={point}
              isExpanded={expandedId === point.id}
              onToggle={() => setExpandedId(expandedId === point.id ? null : point.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DebatePointRow({
  point,
  isExpanded,
  onToggle,
}: {
  point: DebatePoint;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const winner = point.verdict?.winner;

  return (
    <div className="bg-zinc-950">
      {/* Collapsed Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/50 transition-colors text-left"
      >
        {isExpanded
          ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        }

        <PriorityBars severity={point.critique.severity} />

        <span className="flex-1 text-sm text-zinc-300">
          {str(point.critique.claim)}
        </span>

        {/* Winner badge */}
        {winner && (
          <span className={cn(
            'text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium',
            winner === 'visionary'
              ? 'text-green-400 bg-green-500/10'
              : 'text-red-400 bg-red-500/10'
          )}>
            {winner === 'visionary' ? 'Defended' : 'Conceded'}
          </span>
        )}
      </button>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-zinc-800/40 bg-zinc-900/20">
          {/* Critique */}
          <ExpandedSection label="Critique">
            {str(point.critique.reasoning).split('\n\n').map((para, i) => (
              <p key={i} className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{para}</p>
            ))}
            <SourceLine source={point.critique.source} />
          </ExpandedSection>

          <div className="h-px bg-zinc-800/60" />

          {/* Defense */}
          {point.defense && (
            <>
              <DefenseSection defense={point.defense} />
              <div className="h-px bg-zinc-800/60" />
            </>
          )}

          {/* Verdict */}
          {point.verdict && (
            <div className="rounded-lg px-3 py-2.5 bg-zinc-800/50 border border-zinc-800">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  winner === 'visionary' ? 'bg-green-400' : 'bg-red-400'
                )} />
                <span className="text-[11px] font-medium text-zinc-400">
                  {winner === 'visionary' ? 'Visionary wins' : 'Skeptic wins'}
                </span>
              </div>

              {/* Checklist — aligned grid */}
              {point.verdict.checklist && (
                <VerdictChecklist checklist={point.verdict.checklist} />
              )}

              {/* Only show reasoning if no checklist (legacy data) */}
              {!point.verdict.checklist && point.verdict.reasoning && (
                <p className="text-xs text-zinc-400 mt-2">{str(point.verdict.reasoning)}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Neutral section header
function ExpandedSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="pl-3 space-y-2">
        {children}
      </div>
    </div>
  );
}

// Full defense section — parses GROUNDING citations from both rebuttal and reasoning
function DefenseSection({ defense }: { defense: NonNullable<DebatePoint['defense']> }) {
  // Parse citations from both fields
  const rebuttalParsed = parseGroundingCitations(str(defense.rebuttal));
  const reasoningParsed = parseGroundingCitations(str(defense.reasoning));
  const allCitations = [...rebuttalParsed.citations, ...reasoningParsed.citations];

  return (
    <ExpandedSection label="Defense">
      {/* Rebuttal (cleaned) */}
      {rebuttalParsed.clean && (
        <p className="text-sm text-zinc-200 leading-relaxed font-medium">{rebuttalParsed.clean}</p>
      )}

      {/* Reasoning (cleaned) */}
      {reasoningParsed.clean && reasoningParsed.clean.split('\n\n').map((para, i) => (
        <p key={i} className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{para}</p>
      ))}

      {/* Collected citations */}
      {allCitations.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {allCitations.map((c, i) => (
            <div key={i} className="text-xs border-l-2 border-zinc-700 pl-3 py-1">
              <span className="text-zinc-500 italic">"{c.quote}"</span>
              <span className="text-zinc-600 block mt-0.5">{c.proves}</span>
            </div>
          ))}
        </div>
      )}

      <SourceLine source={defense.source} />
    </ExpandedSection>
  );
}

// Verdict checklist — aligned rows
function VerdictChecklist({ checklist }: { checklist: Record<string, string> }) {
  const labels: Record<string, string> = {
    grounding: 'Grounding',
    vague_ban: 'Vague Ban',
    inflation: 'Inflation',
    refutation: 'Refutation',
  };

  return (
    <div className="space-y-1 text-[11px]">
      {Object.entries(checklist).map(([key, value]) => {
        const passed = value === 'PASS';
        const label = labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
        return (
          <div key={key} className="flex items-baseline gap-2">
            <span className={cn('font-mono shrink-0 w-3 text-center', passed ? 'text-green-500' : 'text-red-400')}>
              {passed ? '\u2713' : '\u2717'}
            </span>
            <span className="text-zinc-500 shrink-0 w-[72px]">{label}</span>
            {!passed && (
              <span className="text-zinc-400">{value.replace(/^FAIL:\s*/, '')}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Source line — neutral, no multi-color icons
function SourceLine({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <div className="text-[11px] text-zinc-600 mt-1">
      {source}
    </div>
  );
}
