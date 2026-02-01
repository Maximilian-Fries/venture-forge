import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Swords, X, Shield,
  Zap, Clock, Target, Users, Truck, ShieldCheck, Eye,
  AlertTriangle, RotateCcw, CheckCircle2, Circle,
  ScrollText, Building2, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectManifest } from "@/hooks/useProjectManifest";
import { CompetitorMatrix } from "@/components/CompetitorMatrix";
import { InterviewLab } from "@/components/InterviewLab";
import { EditableField } from "@/components/EditableField";
import { DebateTable } from "@/components/DebateTable";
import { LENS_CONFIGS, type LensId } from "@/lib/agents/lens-protocols";
import { LENS_ORDER } from '@/types/lenses';
import { getDirtyLenses, isVentureConsistent, type DirtyLens } from "@/lib/dirty-state";
import type { GauntletLensState } from "@/types/database";
import { cn } from "@/lib/utils";

type Tab = "summary" | "competition" | "validation";

const TABS = [
  { id: "summary" as Tab, label: "Summary", icon: ScrollText },
  { id: "competition" as Tab, label: "Competitors", icon: Building2 },
  { id: "validation" as Tab, label: "Interview Lab", icon: MessageSquare },
];

const LENS_ICONS: Record<LensId, React.ElementType> = {
  engineering: Zap,
  timing: Clock,
  monopoly: Target,
  people: Users,
  distribution: Truck,
  durability: ShieldCheck,
  secrets: Eye,
};

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 50) return 'text-amber-400';
  if (score >= 30) return 'text-orange-400';
  return 'text-zinc-500';
}

function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-green-500/15 border-green-500/30';
  if (score >= 50) return 'bg-amber-500/15 border-amber-500/30';
  if (score >= 30) return 'bg-orange-500/15 border-orange-500/30';
  return 'bg-zinc-800/50 border-zinc-700/50';
}

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentProject, loadProject, updateManifest, updateTitle, isLoading, error } = useProjectManifest();
  const [detailLens, setDetailLens] = useState<LensId | null>(null);
  const [showInconsistentWarning, setShowInconsistentWarning] = useState(false);

  const activeTab = (searchParams.get("tab") as Tab) || "summary";
  const setActiveTab = (tab: Tab) => setSearchParams({ tab }, { replace: true });

  useEffect(() => {
    if (id) loadProject(id);
  }, [id, loadProject]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error || !currentProject) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Project not found"}</p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Portfolio
          </Button>
        </div>
      </div>
    );
  }

  const manifest = currentProject.manifest || {};
  const lensStates = manifest.gauntlet_lenses || {};
  const dirtyLenses = getDirtyLenses(manifest);
  const isConsistent = isVentureConsistent(manifest);
  const resolvedCount = LENS_ORDER.filter(l => lensStates[l]?.status === 'resolved').length;
  const isAllResolved = resolvedCount === 7;
  const earlyExitReason = manifest.early_exit_reason;
  const earlyExitLensConfig = earlyExitReason ? LENS_CONFIGS[earlyExitReason as LensId] : null;
  const averageKScore = resolvedCount > 0
    ? Math.round(
      LENS_ORDER
        .filter(l => lensStates[l]?.kScore)
        .reduce((sum, l) => sum + (lensStates[l]?.kScore || 0), 0)
      / resolvedCount
    )
    : 0;

  // Handle entering the Gauntlet with dirty lenses
  const handleEnterGauntlet = () => {
    if (!isConsistent && resolvedCount > 0) {
      setShowInconsistentWarning(true);
    } else {
      navigate(`/gauntlet/${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/60 bg-zinc-950 sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-zinc-400 hover:text-foreground shrink-0 w-8 h-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <EditableField
                  value={currentProject.title}
                  onSave={updateTitle}
                  placeholder="Project title..."
                  emptyText="Untitled Project"
                  className="flex-1"
                  displayClassName="p-0 hover:bg-transparent text-base font-semibold"
                />
              </div>
              <p className="text-xs text-zinc-500 truncate mt-0.5 px-3">
                {manifest.one_sentence_thesis || manifest.refined_vision?.substring(0, 80) || "The War Room"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Early Exit Badge */}
            {earlyExitReason && earlyExitLensConfig ? (
              <div className="text-right">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <div>
                    <p className="text-[10px] text-red-400 uppercase tracking-wider font-medium">Conceded</p>
                    <p className="text-xs text-zinc-400">
                      Failed at <span className="text-red-300">{earlyExitLensConfig.title}</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : averageKScore > 0 ? (
              <div className="text-right">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Avg Score</p>
                <p className={cn("text-xl font-bold tabular-nums", getScoreColor(averageKScore))}>
                  {averageKScore}
                </p>
              </div>
            ) : null}
            {/* Consistency Status Badge */}
            {resolvedCount > 0 && !isConsistent && !earlyExitReason && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] text-red-400 font-medium">Inconsistent</span>
              </div>
            )}
            <Button
              size="sm"
              onClick={handleEnterGauntlet}
              className={cn(
                earlyExitReason
                  ? "bg-zinc-700 hover:bg-zinc-600"
                  : "bg-amber-600 hover:bg-amber-500",
                !isConsistent && resolvedCount > 0 && !earlyExitReason && "ring-2 ring-red-500/30"
              )}
            >
              <Swords className="w-3.5 h-3.5 mr-1.5" />
              {earlyExitReason ? 'Re-attempt Gauntlet' : 'Enter Gauntlet'}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Dirty State Alerts */}
        {dirtyLenses.length > 0 && (
          <DirtyStateAlerts
            dirtyLenses={dirtyLenses}
            onReDebate={(lensId) => navigate(`/gauntlet/${id}?step=${lensId}`)}
          />
        )}

        {/* The Heatmap */}
        <div className="px-6 py-6 border-b border-zinc-800/40">
          <GauntletHeatmap
            lensStates={lensStates}
            dirtyLenses={dirtyLenses}
            resolvedCount={resolvedCount}
            onLensClick={(lensId) => {
              const state = lensStates[lensId];
              if (state?.status === 'resolved' && state.debatePoints?.length) {
                setDetailLens(lensId);
              } else {
                navigate(`/gauntlet/${id}?step=${lensId}`);
              }
            }}
          />
        </div>

        {/* The Dossier - Tabbed View */}
        <div className="flex-1 flex flex-col">
          {/* Tab bar */}
          <div className="px-6 pt-4 flex items-center gap-1 border-b border-zinc-800/40">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-[1px]",
                    isActive
                      ? "text-zinc-200 border-cyan-400 bg-zinc-800/40"
                      : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800/20"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 p-6">
            {activeTab === "summary" && (
              <SummaryTab manifest={manifest} onUpdateManifest={updateManifest} />
            )}
            {activeTab === "competition" && <CompetitorMatrix />}
            {activeTab === "validation" && <InterviewLab />}
          </div>
        </div>
      </div>

      {/* Lens Detail Modal */}
      {detailLens && lensStates[detailLens] && (
        <LensDetailModal
          lensId={detailLens}
          lensState={lensStates[detailLens]}
          onClose={() => setDetailLens(null)}
          onReDebate={() => {
            setDetailLens(null);
            navigate(`/gauntlet/${id}?step=${detailLens}`);
          }}
        />
      )}

      {/* Inconsistent State Warning Modal */}
      {showInconsistentWarning && (
        <InconsistentWarningModal
          dirtyCount={dirtyLenses.length}
          onProceed={() => {
            setShowInconsistentWarning(false);
            navigate(`/gauntlet/${id}`);
          }}
          onReDebateFirst={(lensId) => {
            setShowInconsistentWarning(false);
            navigate(`/gauntlet/${id}?step=${lensId}`);
          }}
          dirtyLenses={dirtyLenses}
          onCancel={() => setShowInconsistentWarning(false)}
        />
      )}
    </div>
  );
}

// =============================================================================
// GAUNTLET HEATMAP
// =============================================================================

function GauntletHeatmap({
  lensStates,
  dirtyLenses,
  resolvedCount,
  onLensClick,
}: {
  lensStates: Record<string, GauntletLensState>;
  dirtyLenses: DirtyLens[];
  resolvedCount: number;
  onLensClick: (lensId: LensId) => void;
}) {
  const dirtySet = new Set(dirtyLenses.map(d => d.lensId));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Gauntlet Heatmap</h2>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            {resolvedCount}/7 lenses resolved
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Resolved</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> In Progress</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-zinc-600" /> Pending</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Dirty</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {LENS_ORDER.map(lensId => {
          const config = LENS_CONFIGS[lensId];
          const state = lensStates[lensId];
          const Icon = LENS_ICONS[lensId];
          const isDirty = dirtySet.has(lensId);
          const kScore = state?.kScore || 0;
          const isResolved = state?.status === 'resolved';
          const isInProgress = state?.status && state.status !== 'pending' && state.status !== 'resolved';

          return (
            <button
              key={lensId}
              onClick={() => onLensClick(lensId)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:scale-[1.02]",
                isDirty
                  ? 'border-red-500/40 bg-red-500/5'
                  : isResolved
                    ? getScoreBgColor(kScore)
                    : isInProgress
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
              )}
            >
              {/* Dirty indicator */}
              {isDirty && (
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5 text-white" />
                </div>
              )}

              <Icon className={cn(
                'w-5 h-5',
                isDirty ? 'text-red-400' :
                  isResolved ? getScoreColor(kScore) :
                    isInProgress ? 'text-amber-400' :
                      'text-zinc-600'
              )} />

              {/* K-Score or status */}
              {isResolved && kScore > 0 ? (
                <span className={cn('text-lg font-bold tabular-nums', getScoreColor(kScore))}>
                  {kScore}
                </span>
              ) : isInProgress ? (
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
              ) : (
                <Circle className="w-4 h-4 text-zinc-700" />
              )}

              <div className="text-center">
                <p className={cn(
                  'text-[11px] font-medium',
                  isDirty ? 'text-red-400' :
                    isResolved ? 'text-zinc-300' :
                      'text-zinc-500'
                )}>
                  {config.title}
                </p>
                <p className="text-[9px] text-zinc-600">{config.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// DIRTY STATE ALERTS
// =============================================================================

function DirtyStateAlerts({
  dirtyLenses,
  onReDebate,
}: {
  dirtyLenses: DirtyLens[];
  onReDebate: (lensId: LensId) => void;
}) {
  // Group dirty lenses by their reason to show chain reactions
  const reasonGroups = dirtyLenses.reduce((acc, dl) => {
    // Extract the upstream lens from the reason if it exists
    const upstreamMatch = dl.reason.match(/Upstream lens "(\w+)"/);
    const key = upstreamMatch ? `upstream:${upstreamMatch[1]}` : 'forge';
    if (!acc[key]) acc[key] = [];
    acc[key].push(dl);
    return acc;
  }, {} as Record<string, DirtyLens[]>);

  const hasChainReaction = Object.keys(reasonGroups).some(k => k.startsWith('upstream:'));

  return (
    <div className="px-6 pt-4">
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
        {/* Header with auto-rerun option */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-medium text-red-400">
              {hasChainReaction ? 'Chain Reaction Alert' : `${dirtyLenses.length} lens${dirtyLenses.length !== 1 ? 'es' : ''} need re-debating`}
            </h3>
          </div>
          {dirtyLenses.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReDebate(dirtyLenses[0].lensId)}
              className="text-red-400 hover:text-red-300 text-xs h-7"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Re-run Chain ({dirtyLenses.length})
            </Button>
          )}
        </div>

        {/* Chain reaction explanation if applicable */}
        {hasChainReaction && (
          <p className="text-xs text-zinc-400 mb-3">
            Upstream lens changes have invalidated downstream analyses. Re-debate the affected lenses to restore consistency.
          </p>
        )}

        <div className="space-y-2">
          {dirtyLenses.map(dl => {
            const config = LENS_CONFIGS[dl.lensId];
            const Icon = LENS_ICONS[dl.lensId];
            return (
              <div key={dl.lensId} className="flex items-center justify-between bg-zinc-900/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', config.color)} />
                  <div>
                    <span className="text-xs font-medium text-zinc-300">{config.title}</span>
                    <p className="text-[10px] text-zinc-500">{dl.reason}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onReDebate(dl.lensId)}
                  className="text-red-400 hover:text-red-300 text-xs h-7"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Re-Debate
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUMMARY TAB
// =============================================================================

import type { ProjectManifestState } from "@/hooks/useProjectManifest";

function SummaryTab({
  manifest,
  onUpdateManifest,
}: {
  manifest: NonNullable<ProjectManifestState["currentProject"]>["manifest"];
  onUpdateManifest: ProjectManifestState["updateManifest"];
}) {
  const lensStates = manifest?.gauntlet_lenses || {};

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Early Exit Alert */}
      {manifest?.early_exit_reason && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-400 mb-1">Venture Conceded</h3>
              <p className="text-xs text-zinc-400">
                This venture was archived after failing the{' '}
                <span className="text-red-300 font-medium">
                  {LENS_CONFIGS[manifest.early_exit_reason as LensId]?.title || manifest.early_exit_reason}
                </span>
                {' '}lens. The data below reflects analysis completed before the gap was detected.
              </p>
              {lensStates[manifest.early_exit_reason]?.userEdit && (
                <div className="mt-3 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Last Hypothesis</p>
                  <p className="text-xs text-zinc-300">
                    {lensStates[manifest.early_exit_reason]?.userEdit}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* One-Sentence Thesis */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
        <EditableField
          label="One-Sentence Thesis"
          value={manifest?.one_sentence_thesis || ""}
          onSave={(value) => onUpdateManifest({ one_sentence_thesis: value })}
          placeholder="Summarize your venture thesis in one compelling sentence..."
          emptyText="Click to add a one-sentence thesis..."
        />
      </div>

      {/* Refined Vision from Forge */}
      {manifest?.refined_vision && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Inflated Vision (from Forge)</h3>
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {manifest.refined_vision}
          </p>
        </div>
      )}

      {/* Core Thesis & Secret */}
      {manifest?.core_thesis?.statement && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5 space-y-3">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Core Thesis</h3>
          <p className="text-sm text-zinc-200">{manifest.core_thesis.statement}</p>
          {manifest.core_thesis.zero_to_one_logic && (
            <div className="mt-2">
              <span className="text-[10px] text-green-400 uppercase tracking-wider font-medium">The Secret: </span>
              <span className="text-sm text-zinc-300">{manifest.core_thesis.zero_to_one_logic}</span>
            </div>
          )}
        </div>
      )}

      {/* Resolved Lens Summaries */}
      {LENS_ORDER.filter(l => lensStates[l]?.status === 'resolved').length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Resolved Positions</h3>
          <div className="space-y-2">
            {LENS_ORDER.filter(l => lensStates[l]?.status === 'resolved').map(lensId => {
              const state = lensStates[lensId] as GauntletLensState;
              const config = LENS_CONFIGS[lensId];
              const Icon = LENS_ICONS[lensId];
              const debatePoints = state.debatePoints || [];
              const vWins = debatePoints.filter(p => p.verdict?.winner === 'visionary').length;
              const sWins = debatePoints.filter(p => p.verdict?.winner === 'skeptic').length;
              return (
                <div key={lensId} className={cn('rounded-lg border p-4', config.bgColor, config.borderColor)}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn('w-4 h-4', config.color)} />
                    <span className={cn('text-xs font-medium uppercase tracking-wider', config.color)}>
                      {config.title}
                    </span>
                    <div className="flex items-center gap-2 ml-auto">
                      {debatePoints.length > 0 && (
                        <span className="text-[10px] text-zinc-500">
                          <Shield className="w-3 h-3 inline text-cyan-400" />{vWins}
                          {' / '}
                          <Swords className="w-3 h-3 inline text-orange-400" />{sWins}
                        </span>
                      )}
                      <span className={cn('text-xs font-mono font-semibold', getScoreColor(state.kScore || 0))}>
                        {state.kScore || '--'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 line-clamp-3">
                    {state.userEdit || state.proposal || 'No position recorded'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Jury Verdict (if exists from old system) */}
      {manifest?.jury_verdict?.synthesis && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Jury Verdict</h3>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap mb-3">
            {manifest.jury_verdict.synthesis}
          </p>
          {manifest.jury_verdict.red_flags && manifest.jury_verdict.red_flags.length > 0 && (
            <div className="border-t border-zinc-800 pt-3">
              <p className="text-[10px] text-red-400 font-medium mb-1.5 uppercase tracking-wider">Residual Risks</p>
              <ul className="space-y-1">
                {manifest.jury_verdict.red_flags.map((flag, i) => (
                  <li key={i} className="text-xs text-zinc-400 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Wedge */}
      {manifest?.wedge?.target_audience && (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5 space-y-2">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">The Wedge</h3>
          <div>
            <span className="text-[10px] text-purple-400 uppercase tracking-wider font-medium">Target: </span>
            <span className="text-sm text-zinc-300">{manifest.wedge.target_audience}</span>
          </div>
          {manifest.wedge.expansion_path && (
            <div>
              <span className="text-[10px] text-purple-400 uppercase tracking-wider font-medium">Expansion: </span>
              <span className="text-sm text-zinc-300">{manifest.wedge.expansion_path}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LENS DETAIL MODAL
// =============================================================================

function LensDetailModal({
  lensId,
  lensState,
  onClose,
  onReDebate,
}: {
  lensId: LensId;
  lensState: GauntletLensState;
  onClose: () => void;
  onReDebate: () => void;
}) {
  const config = LENS_CONFIGS[lensId];
  const Icon = LENS_ICONS[lensId];
  const points = lensState.debatePoints || [];
  const score = lensState.kScore || 0;
  const visionaryWins = points.filter(p => p.verdict?.winner === 'visionary').length;
  const skepticWins = points.filter(p => p.verdict?.winner === 'skeptic').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden mx-4">
        {/* Header */}
        <div className={cn('px-6 py-4 border-b border-zinc-800/60 flex items-center justify-between', config.bgColor)}>
          <div className="flex items-center gap-3">
            <Icon className={cn('w-5 h-5', config.color)} />
            <div>
              <h2 className={cn('text-sm font-semibold', config.color)}>
                {config.title} — {config.subtitle}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Score: <span className={cn(
                  'font-mono font-semibold',
                  getScoreColor(score)
                )}>{score}</span>
                <span className="text-zinc-600 ml-2">
                  (<Shield className="w-3 h-3 inline text-cyan-400" /> {visionaryWins} / <Swords className="w-3 h-3 inline text-orange-400" /> {skepticWins})
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Position */}
          <div className={cn('border rounded-lg p-3', config.borderColor, config.bgColor)}>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Position:</span>
            <p className="text-sm text-zinc-200 mt-1 whitespace-pre-wrap line-clamp-4">
              {lensState.userEdit || lensState.proposal || 'No position'}
            </p>
          </div>

          {/* Debate Table */}
          <DebateTable points={points} />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/60 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onReDebate} className="text-amber-400 hover:text-amber-300">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Re-Debate in Gauntlet
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// INCONSISTENT WARNING MODAL
// =============================================================================

function InconsistentWarningModal({
  dirtyCount,
  dirtyLenses,
  onProceed,
  onReDebateFirst,
  onCancel,
}: {
  dirtyCount: number;
  dirtyLenses: DirtyLens[];
  onProceed: () => void;
  onReDebateFirst: (lensId: LensId) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-zinc-950 border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden mx-4">
        {/* Header */}
        <div className="px-6 py-4 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-red-400">Venture Inconsistent</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {dirtyCount} lens{dirtyCount !== 1 ? 'es' : ''} need re-debating
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-zinc-300">
            Your venture has lenses that are out of sync. Their analyses may be based on outdated information.
          </p>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {dirtyLenses.map(dl => {
              const config = LENS_CONFIGS[dl.lensId];
              const Icon = LENS_ICONS[dl.lensId];
              return (
                <button
                  key={dl.lensId}
                  onClick={() => onReDebateFirst(dl.lensId)}
                  className="w-full flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 hover:border-red-500/30 hover:bg-red-500/5 transition-colors text-left"
                >
                  <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', config.bgColor)}>
                    <Icon className={cn('w-3.5 h-3.5', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn('text-xs font-medium', config.color)}>{config.title}</span>
                    <p className="text-[10px] text-zinc-500 truncate">{dl.reason}</p>
                  </div>
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                </button>
              );
            })}
          </div>

          <div className="bg-zinc-900/30 border border-zinc-800 rounded-lg px-3 py-2">
            <p className="text-xs text-zinc-500">
              <span className="text-amber-400 font-medium">Recommendation:</span> Re-debate the dirty lenses before proceeding to ensure your analysis is consistent with your latest decisions.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-zinc-400">
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onProceed}
              className="text-zinc-400 hover:text-zinc-300"
            >
              Proceed Anyway
            </Button>
            <Button
              size="sm"
              onClick={() => onReDebateFirst(dirtyLenses[0].lensId)}
              className="bg-red-600 hover:bg-red-500"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Fix First Lens
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
