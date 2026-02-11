import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Swords, Shield,
  Zap, Clock, Target, Users, Truck, ShieldCheck, Eye,
  AlertTriangle, RotateCcw,
  ScrollText, Building2, MessageSquare,
  Lightbulb, TrendingUp, Brain, Rocket, Search, Award, Flame,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useProjectManifest } from "@/hooks/useProjectManifest";
import type { ProjectManifestState } from "@/hooks/useProjectManifest";
import { CompetitorMatrix } from "@/components/CompetitorMatrix";
import { InterviewLab } from "@/components/InterviewLab";
import { EditableField } from "@/components/EditableField";
import { DebateTable } from "@/components/DebateTable";
import { LENS_CONFIGS, type LensId } from "@/lib/agents/lens-protocols";
import { LENS_ORDER } from '@/types/lenses';
import { getDirtyLenses, getDirtyLensesForFramework, type DirtyLens } from "@/lib/dirty-state";
import type { GauntletLensState, VentureManifest } from "@/types/database";
import { getVentureStatus, VENTURE_STATUS_CONFIG } from "@/types/database";
import { cn } from "@/lib/utils";
import { FrameworkRegistry } from "@/lib/frameworks/registry";
import { useFramework } from "@/hooks/useFramework";
import type { FrameworkDefinition, StepDefinition } from "@/lib/frameworks/types";

type Tab = "project" | "gauntlet" | "competition" | "validation";

const TABS = [
  { id: "project" as Tab, label: "Project", icon: ScrollText },
  { id: "gauntlet" as Tab, label: "Evaluation", icon: Swords },
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

const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Clock, Target, Users, Truck, ShieldCheck, Eye,
  Lightbulb, TrendingUp, Brain, Rocket, Search, Award, Flame,
};

function getIconForStep(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || Circle;
}

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
  const [showInconsistentWarning, setShowInconsistentWarning] = useState(false);
  const [activeEvalFrameworkId, setActiveEvalFrameworkId] = useState<string>(FrameworkRegistry.getDefaultId());

  // Hook must be called unconditionally (before any early returns)
  const evalFramework = useFramework(activeEvalFrameworkId);

  const activeTab = (searchParams.get("tab") as Tab) || "gauntlet";
  const setActiveTab = (tab: Tab) => setSearchParams({ tab }, { replace: true });

  useEffect(() => {
    if (id) loadProject(id);
  }, [id, loadProject]);

  // Sync active framework with manifest when project loads
  const manifestFrameworksRaw = currentProject?.manifest?.frameworks;
  useEffect(() => {
    if (!manifestFrameworksRaw || manifestFrameworksRaw.length === 0) return;
    if (!manifestFrameworksRaw.includes(activeEvalFrameworkId)) {
      setActiveEvalFrameworkId(manifestFrameworksRaw[0]);
    }
  }, [manifestFrameworksRaw]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Multi-framework support
  const manifestFrameworks = manifest.frameworks;
  const frameworkIds = manifestFrameworks && manifestFrameworks.length > 0
    ? manifestFrameworks
    : [FrameworkRegistry.getDefaultId()];

  // Get lens states for the active evaluation framework
  const isDefaultFw = activeEvalFrameworkId === FrameworkRegistry.getDefaultId();

  const lensStates = isDefaultFw
    ? (manifest.gauntlet_lenses || {})
    : (manifest.framework_data?.[activeEvalFrameworkId]?.gauntlet_lenses || {});

  const frameworkData = manifest.framework_data?.[activeEvalFrameworkId];
  const dirtyLenses = isDefaultFw
    ? getDirtyLenses(manifest)
    : frameworkData
      ? getDirtyLensesForFramework(frameworkData, evalFramework, manifest.last_forge_edit)
      : [];
  const isConsistent = dirtyLenses.length === 0;
  const resolvedCount = evalFramework.stepOrder.filter(l => lensStates[l]?.status === 'resolved').length;
  const earlyExitReason = manifest.early_exit_reason;
  const ventureStatus = getVentureStatus(currentProject);
  const statusConfig = VENTURE_STATUS_CONFIG[ventureStatus];
  const getLensScore = (s: GauntletLensState | undefined) => s?.lensScore ?? s?.kScore ?? 0;
  const averageLensScore = resolvedCount > 0
    ? Math.round(
      evalFramework.stepOrder
        .filter(l => getLensScore(lensStates[l]))
        .reduce((sum, l) => sum + getLensScore(lensStates[l]), 0)
      / resolvedCount
    )
    : 0;

  // Build gauntlet URL with optional framework + step params
  const gauntletUrl = (step?: string) => {
    const params = new URLSearchParams();
    if (activeEvalFrameworkId !== FrameworkRegistry.getDefaultId()) {
      params.set('framework', activeEvalFrameworkId);
    }
    if (step) params.set('step', step);
    const qs = params.toString();
    return `/gauntlet/${id}${qs ? `?${qs}` : ''}`;
  };

  // Handle entering the Gauntlet with dirty lenses
  const handleEnterGauntlet = () => {
    if (!isConsistent && resolvedCount > 0) {
      setShowInconsistentWarning(true);
    } else {
      navigate(gauntletUrl());
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
                  displayClassName="p-0 hover:bg-transparent text-xl font-bold tracking-tight"
                />
              </div>
              <p className="text-xs text-zinc-500 truncate mt-0.5">
                {manifest.one_sentence_thesis || manifest.refined_vision?.substring(0, 80) || "The War Room"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Consolidated header badge: either Conceded OR score+status, never both */}
            {earlyExitReason ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400 font-medium">Conceded</span>
              </div>
            ) : (
              <>
                {averageLensScore > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Avg Lens Score</p>
                    <p className={cn("text-xl font-bold tabular-nums", getScoreColor(averageLensScore))}>
                      {averageLensScore}
                    </p>
                  </div>
                )}
                <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-transparent", statusConfig.bgColor)}>
                  <div className={cn("w-2 h-2 rounded-full", statusConfig.dotColor)} />
                  <span className={cn("text-xs font-medium", statusConfig.color)}>{statusConfig.label}</span>
                </div>
              </>
            )}
            {/* Consistency Status Badge */}
            {resolvedCount > 0 && !isConsistent && !earlyExitReason && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] text-red-400 font-medium">Inconsistent</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Dirty State Alerts */}
        {dirtyLenses.length > 0 && (
          <DirtyStateAlerts
            dirtyLenses={dirtyLenses}
            onReDebate={(lensId) => navigate(gauntletUrl(lensId))}
          />
        )}

        {/* Tab bar — directly below alerts */}
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
          {activeTab === "project" && (
            <ProjectTab manifest={manifest} pitch={currentProject.pitch} onUpdateManifest={updateManifest} />
          )}
          {activeTab === "gauntlet" && (
            <div className="space-y-4">
              {/* Framework sub-tabs */}
              {frameworkIds.length > 0 && (
                <div className="flex items-center gap-1 border-b border-zinc-800/40 pb-0">
                  {frameworkIds.map(fwId => {
                    const fw = FrameworkRegistry.get(fwId);
                    if (!fw) return null;
                    const FwIcon = getIconForStep(fw.icon);
                    const isActive = fwId === activeEvalFrameworkId;
                    const fwLenses = fwId === FrameworkRegistry.getDefaultId()
                      ? (manifest.gauntlet_lenses || {})
                      : (manifest.framework_data?.[fwId]?.gauntlet_lenses || {});
                    const fwDef = FrameworkRegistry.get(fwId);
                    const fwResolved = fwDef
                      ? fwDef.stepOrder.filter(s => fwLenses[s]?.status === 'resolved').length
                      : 0;
                    return (
                      <button
                        key={fwId}
                        onClick={() => setActiveEvalFrameworkId(fwId)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                          isActive
                            ? 'border-cyan-500 text-zinc-100'
                            : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                        )}
                      >
                        <FwIcon className={cn('w-3.5 h-3.5', isActive ? fw.color : '')} />
                        {fw.name}
                        {fwDef && (
                          <span className={cn(
                            'text-[10px] ml-1',
                            isActive ? 'text-zinc-400' : 'text-zinc-600'
                          )}>
                            {fwResolved}/{fwDef.stepOrder.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <GauntletTab
                lensStates={lensStates}
                dirtyLenses={dirtyLenses}
                resolvedCount={resolvedCount}
                earlyExitReason={earlyExitReason}
                isConsistent={isConsistent}
                onEnterGauntlet={handleEnterGauntlet}
                onReDebate={(lensId) => navigate(gauntletUrl(lensId))}
                framework={evalFramework}
              />
            </div>
          )}
          {activeTab === "competition" && <CompetitorMatrix />}
          {activeTab === "validation" && <InterviewLab />}
        </div>
      </div>

      {/* Inconsistent State Warning Modal */}
      {showInconsistentWarning && (
        <InconsistentWarningModal
          dirtyCount={dirtyLenses.length}
          onProceed={() => {
            setShowInconsistentWarning(false);
            navigate(gauntletUrl());
          }}
          onReDebateFirst={(lensId) => {
            setShowInconsistentWarning(false);
            navigate(gauntletUrl(lensId));
          }}
          dirtyLenses={dirtyLenses}
          onCancel={() => setShowInconsistentWarning(false)}
        />
      )}
    </div>
  );
}

// =============================================================================
// PROJECT TAB
// =============================================================================

function ProjectTab({
  manifest,
  pitch,
  onUpdateManifest,
}: {
  manifest: NonNullable<VentureManifest>;
  pitch: string | null;
  onUpdateManifest: ProjectManifestState["updateManifest"];
}) {
  const pitchText = manifest.refined_vision || manifest.raw_vision || pitch;

  return (
    <div className="space-y-6">
      {/* The Pitch */}
      {(pitchText || manifest.core_thesis?.statement) && (
        <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-8">
          <div className="flex items-center gap-2 mb-4">
            <ScrollText className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium">The Pitch</span>
          </div>

          {pitchText && (
            <p className="text-base md:text-lg text-zinc-200 leading-relaxed">
              {pitchText}
            </p>
          )}

          {manifest.core_thesis?.statement && (
            <>
              <div className="w-12 h-px bg-zinc-800 my-6" />
              <p className="text-sm text-zinc-300">{manifest.core_thesis.statement}</p>
              {manifest.core_thesis.zero_to_one_logic && (
                <div className="mt-3">
                  <span className="text-[10px] text-green-400 uppercase tracking-wider font-medium">The Secret: </span>
                  <span className="text-sm text-zinc-400">{manifest.core_thesis.zero_to_one_logic}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Thesis + Wedge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* One-Sentence Thesis */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
          <EditableField
            label="One-Sentence Thesis"
            value={manifest.one_sentence_thesis || ""}
            onSave={(value) => onUpdateManifest({ one_sentence_thesis: value })}
            placeholder="Summarize your venture thesis in one compelling sentence..."
            emptyText="Click to add a one-sentence thesis..."
          />
        </div>

        {/* Wedge */}
        {manifest.wedge?.target_audience && (
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
    </div>
  );
}

// =============================================================================
// GAUNTLET TAB
// =============================================================================

function GauntletTab({
  lensStates,
  dirtyLenses,
  resolvedCount,
  earlyExitReason,
  isConsistent,
  onEnterGauntlet,
  onReDebate,
  framework,
}: {
  lensStates: Record<string, GauntletLensState>;
  dirtyLenses: DirtyLens[];
  resolvedCount: number;
  earlyExitReason: string | undefined;
  isConsistent: boolean;
  onEnterGauntlet: () => void;
  onReDebate: (lensId: string) => void;
  framework: FrameworkDefinition;
}) {
  const dirtySet = new Set(dirtyLenses.map(d => d.lensId));
  const stepMap = new Map(framework.steps.map(s => [s.id, s]));
  const isAllResolved = resolvedCount === framework.stepOrder.length;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">Gauntlet Report</h2>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            {resolvedCount} of {framework.stepOrder.length} resolved
          </p>
        </div>
        {!isAllResolved && !earlyExitReason && (
          <Button
            onClick={onEnterGauntlet}
            className={cn(
              "bg-amber-600 hover:bg-amber-500",
              !isConsistent && resolvedCount > 0 && "ring-2 ring-red-500/30"
            )}
          >
            <Swords className="w-3.5 h-3.5 mr-1.5" />
            Enter Gauntlet
          </Button>
        )}
        {earlyExitReason && (
          <Button
            variant="outline"
            onClick={onEnterGauntlet}
          >
            <Swords className="w-3.5 h-3.5 mr-1.5" />
            Re-attempt Gauntlet
          </Button>
        )}
      </div>

      {/* Vertical Accordion */}
      <Accordion type="multiple" className="space-y-2">
        {framework.stepOrder.map(lensId => {
          const config = stepMap.get(lensId);
          if (!config) return null;
          const state = lensStates[lensId];
          const Icon = getIconForStep(config.icon);
          const isDirty = dirtySet.has(lensId);
          const score = state?.lensScore ?? state?.kScore ?? 0;
          const isResolved = state?.status === 'resolved';
          const isFailed = !isResolved && !!state?.debatePoints?.length && (state?.lensScore != null || state?.kScore != null);
          const isInProgress = state?.status && state.status !== 'pending' && state.status !== 'resolved' && !isFailed;
          const points = state?.debatePoints || [];

          const contentText = isResolved ? (state?.userEdit || state?.proposal) : null;
          const gapReport = isFailed ? state?.gapReport : null;

          return (
            <AccordionItem
              key={lensId}
              value={lensId}
              className={cn(
                "rounded-xl border px-4 overflow-hidden",
                isDirty
                  ? 'border-red-500/40 bg-red-500/5'
                  : isResolved
                    ? getScoreBgColor(score)
                    : isFailed
                      ? 'border-red-500/30 bg-red-500/5'
                      : isInProgress
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-zinc-800 bg-zinc-900/30'
              )}
            >
              <AccordionTrigger className="hover:no-underline py-3 gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Dirty dot */}
                  {isDirty && (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  )}

                  {/* Icon */}
                  <Icon className={cn(
                    'w-4 h-4 shrink-0',
                    isDirty ? 'text-red-400' :
                      isResolved ? getScoreColor(score) :
                        isFailed ? 'text-red-400' :
                          isInProgress ? 'text-amber-400' :
                            'text-zinc-600'
                  )} />

                  {/* Title + subtitle */}
                  <div className="flex-1 min-w-0 text-left">
                    <span className={cn(
                      'text-sm font-medium',
                      isDirty ? 'text-red-400' :
                        isResolved ? 'text-zinc-200' :
                          isFailed ? 'text-red-300' :
                            'text-zinc-400'
                    )}>
                      {config.title}
                    </span>
                    <span className="text-[10px] text-zinc-600 ml-2">{config.subtitle}</span>
                  </div>

                  {/* Score or nothing if Conceded */}
                  {(isResolved || isFailed) ? (
                    <div className="flex items-center gap-3 shrink-0">
                      {isResolved && score > 0 && (
                        <span className={cn('text-base font-bold tabular-nums', getScoreColor(score))}>
                          {score}
                        </span>
                      )}
                    </div>
                  ) : isInProgress ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                  ) : null}
                </div>
              </AccordionTrigger>

              <AccordionContent className="pb-4 pt-0">
                <div className="space-y-4">
                  {/* Gap Report */}
                  {gapReport && (
                    <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-xs font-medium text-red-400 uppercase tracking-wider">Jury Gap Report</span>
                      </div>
                      <p className="text-xs text-zinc-300">
                        <span className="text-red-300 font-medium">Missing: </span>{gapReport.missing_element}
                      </p>
                      <p className="text-xs text-zinc-400">{gapReport.reason}</p>
                      {gapReport.hypotheses?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Suggested Pivots:</span>
                          {gapReport.hypotheses.map((h, i) => (
                            <p key={i} className="text-xs text-zinc-300 pl-3 border-l-2 border-red-500/30">{h}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Position — no truncation */}
                  {contentText && (
                    <div className={cn('border rounded-lg p-3', isFailed ? 'border-red-500/20 bg-red-500/5' : config.borderColor + ' ' + config.bgColor)}>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Position:</span>
                      <p className="text-sm text-zinc-200 mt-1 whitespace-pre-wrap">
                        {contentText}
                      </p>
                    </div>
                  )}

                  {/* Debate Table — inline, no score summary (shown in trigger) */}
                  {points.length > 0 && (
                    <DebateTable points={points} hideScoreSummary />
                  )}

                  {/* Re-debate button */}
                  {(isResolved || isFailed) && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReDebate(lensId)}
                        className="text-amber-400 hover:text-amber-300"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Re-Debate
                      </Button>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
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
  onReDebate: (lensId: string) => void;
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
  onReDebateFirst: (lensId: string) => void;
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
