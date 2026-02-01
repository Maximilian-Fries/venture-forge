import { useState } from 'react';
import { ChevronDown, ChevronRight, Shield, Swords, Loader2, Brain, Database, Atom, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DebatePoint, Severity } from '@/types/debate';
import { SEVERITY_WEIGHTS, calculateLensScore } from '@/types/debate';

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bgColor: string }> = {
  high: { label: 'Fatal', color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/30' },
  medium: { label: 'Friction', color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/30' },
  low: { label: 'Minor', color: 'text-zinc-400', bgColor: 'bg-zinc-500/10 border-zinc-500/30' },
};

// Parse source type from prefixed string (e.g., "Logic: First Principles" → { type: 'logic', text: 'First Principles' })
function parseSource(source: string | undefined): { type: string; icon: React.ElementType; text: string; color: string } | null {
  if (!source) return null;
  const lower = source.toLowerCase();
  if (lower.startsWith('logic:')) return { type: 'Logic', icon: Brain, text: source.slice(6).trim(), color: 'text-purple-400' };
  if (lower.startsWith('data:')) return { type: 'Data', icon: Database, text: source.slice(5).trim(), color: 'text-blue-400' };
  if (lower.startsWith('physics:')) return { type: 'Physics', icon: Atom, text: source.slice(8).trim(), color: 'text-green-400' };
  if (lower.startsWith('market:')) return { type: 'Market', icon: TrendingUp, text: source.slice(7).trim(), color: 'text-amber-400' };
  if (lower.startsWith('comparable:')) return { type: 'Comparable', icon: TrendingUp, text: source.slice(11).trim(), color: 'text-cyan-400' };
  // Fallback: treat as generic
  return { type: 'Source', icon: Brain, text: source, color: 'text-zinc-400' };
}

interface DebateTableProps {
  points: DebatePoint[];
  isLoading?: boolean;
  loadingPhase?: 'attacking' | 'defending' | 'judging';
}

export function DebateTable({ points, isLoading, loadingPhase }: DebateTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const score = calculateLensScore(points);
  const judgedCount = points.filter(p => p.verdict).length;
  const visionaryWins = points.filter(p => p.verdict?.winner === 'visionary').length;
  const skepticWins = points.filter(p => p.verdict?.winner === 'skeptic').length;

  return (
    <div className="space-y-4">
      {/* Score Summary */}
      {judgedCount > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Score</span>
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
          <div className="h-6 w-px bg-zinc-800" />
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-cyan-400">
              <Shield className="w-3 h-3" /> {visionaryWins}
            </span>
            <span className="flex items-center gap-1 text-orange-400">
              <Swords className="w-3 h-3" /> {skepticWins}
            </span>
            <span className="text-zinc-600">of {points.length} points</span>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm px-2 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span className="text-zinc-400">
            {loadingPhase === 'attacking' && 'Skeptic is identifying atomic failure points...'}
            {loadingPhase === 'defending' && 'Visionary is mounting mechanism-based defenses...'}
            {loadingPhase === 'judging' && 'Jury is applying the Rubric of Death...'}
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

function SourceBadge({ source }: { source: string | undefined }) {
  const parsed = parseSource(source);
  if (!parsed) return null;
  const Icon = parsed.icon;
  return (
    <div className={cn('flex items-center gap-1.5 text-[11px] pl-4 mt-1', parsed.color)}>
      <Icon className="w-3 h-3" />
      <span className="font-medium">{parsed.type}:</span>
      <span className="text-zinc-400">{parsed.text}</span>
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
  const severity = SEVERITY_CONFIG[point.critique.severity];
  const weight = SEVERITY_WEIGHTS[point.critique.severity];

  return (
    <div className="bg-zinc-950">
      {/* Summary Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/50 transition-colors text-left"
      >
        {/* Expand indicator */}
        {isExpanded
          ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        }

        {/* Severity badge */}
        <span className={cn(
          'text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border shrink-0',
          severity.bgColor, severity.color
        )}>
          {severity.label}
          <span className="ml-0.5 opacity-60">x{weight}</span>
        </span>

        {/* Claim - no truncation, allow wrapping */}
        <span className="flex-1 text-sm text-zinc-300">
          {point.critique.claim}
        </span>

        {/* Defense status */}
        {point.defense ? (
          <span className="text-[10px] text-cyan-400 shrink-0">defended</span>
        ) : (
          <span className="text-[10px] text-zinc-600 shrink-0">pending</span>
        )}

        {/* Verdict */}
        {point.verdict ? (
          point.verdict.winner === 'visionary' ? (
            <div className="flex items-center gap-1 shrink-0" title="Visionary wins">
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0" title="Skeptic wins">
              <Swords className="w-4 h-4 text-orange-400" />
            </div>
          )
        ) : (
          <div className="w-4 h-4 shrink-0" />
        )}
      </button>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-zinc-800/40 bg-zinc-900/20">
          {/* Critique */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Swords className="w-3 h-3 text-orange-400" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-orange-400">Skeptic's Attack</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed pl-4 whitespace-pre-wrap">{point.critique.reasoning}</p>
            <SourceBadge source={point.critique.source} />
          </div>

          {/* Defense */}
          {point.defense && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-cyan-400">Visionary's Defense</span>
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed pl-4 font-medium">
                {point.defense.rebuttal}
              </p>
              <p className="text-sm text-zinc-300 leading-relaxed pl-4 whitespace-pre-wrap">
                {point.defense.reasoning}
              </p>
              <SourceBadge source={point.defense.source} />
            </div>
          )}

          {/* Verdict */}
          {point.verdict && (
            <div className={cn(
              'rounded-lg px-3 py-2 border',
              point.verdict.winner === 'visionary'
                ? 'bg-cyan-500/5 border-cyan-500/20'
                : 'bg-orange-500/5 border-orange-500/20'
            )}>
              <div className="flex items-center gap-1.5 mb-1">
                {point.verdict.winner === 'visionary'
                  ? <Shield className="w-3 h-3 text-cyan-400" />
                  : <Swords className="w-3 h-3 text-orange-400" />
                }
                <span className={cn(
                  'text-[10px] font-medium uppercase tracking-wider',
                  point.verdict.winner === 'visionary' ? 'text-cyan-400' : 'text-orange-400'
                )}>
                  {point.verdict.winner === 'visionary' ? 'Visionary Wins' : 'Skeptic Wins'}
                </span>
              </div>
              <p className="text-xs text-zinc-300 pl-4">{point.verdict.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
