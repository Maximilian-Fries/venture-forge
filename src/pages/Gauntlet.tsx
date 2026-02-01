import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2, Zap, Clock, Target, Users, Truck, ShieldCheck, Eye,
  CheckCircle2, Circle, Play, Pencil, Swords, ArrowRight, ArrowLeft,
  Sparkles, AlertTriangle, RotateCcw, Shield, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProjectManifest } from '@/hooks/useProjectManifest';
import { LENS_CONFIGS, generateLensProposal, getLensSyncFields, LENS_UPSTREAM_DEPENDENCIES, type LensId, type GapReport, type LensProposalResult } from '@/lib/agents/lens-protocols';
import { LENS_ORDER } from '@/types/lenses';
import { generateCritiquePoints, generateAllDefenses, adjudicateAllPoints } from '@/lib/agents/gauntlet-agents';
import { calculateLensScore } from '@/types/debate';
import { DebateTable } from '@/components/DebateTable';
import { PeopleLensForm } from '@/components/PeopleLensForm';
import { getDirtyLenses, isLensDirty, getDownstreamLenses, getAffectedDownstreamLenses, calculateChainReaction, type DirtyLens, type ChainReaction } from '@/lib/dirty-state';
import type { GauntletLensState, GauntletLensStatus } from '@/types/database';
import type { DebatePoint } from '@/types/debate';

// Icon mapping for lens configs
const LENS_ICONS: Record<LensId, React.ElementType> = {
  engineering: Zap,
  timing: Clock,
  monopoly: Target,
  people: Users,
  distribution: Truck,
  durability: ShieldCheck,
  secrets: Eye,
};

// Step status icons
const STATUS_ICONS: Record<GauntletLensStatus, React.ElementType> = {
  pending: Circle,
  proposing: Loader2,
  selecting: Target,
  editing: Pencil,
  attacking: Swords,
  defending: Shield,
  judging: CheckCircle2,
  debating: Swords, // legacy
  resolved: CheckCircle2,
};

export default function Gauntlet() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentProject, loadProject, updateManifest, resetGauntlet, isLoading: isProjectLoading } = useProjectManifest();

  const stepParam = searchParams.get('step') as LensId | null;
  const initialLens = stepParam && LENS_ORDER.includes(stepParam) ? stepParam : 'engineering';

  const [activeLens, setActiveLens] = useState<LensId>(initialLens);
  const [lensStates, setLensStates] = useState<Record<string, GauntletLensState>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainReactionWarning, setChainReactionWarning] = useState<ChainReaction | null>(null);
  const [gapReport, setGapReport] = useState<GapReport | null>(null);
  const [previousGapReport, setPreviousGapReport] = useState<GapReport | null>(null);

  // Dependency checking: check if all upstream lenses are resolved
  const getUnresolvedDependencies = useCallback((lensId: LensId): LensId[] => {
    const dependencies = LENS_UPSTREAM_DEPENDENCIES[lensId] || [];
    return dependencies.filter(depId => {
      const depState = lensStates[depId];
      return !depState || depState.status !== 'resolved';
    });
  }, [lensStates]);

  const canRunLens = useCallback((lensId: LensId): boolean => {
    return getUnresolvedDependencies(lensId).length === 0;
  }, [getUnresolvedDependencies]);

  // Dirty state tracking
  const dirtyLenses = currentProject?.manifest ? getDirtyLenses(currentProject.manifest) : [];
  const dirtyLensIds = new Set(dirtyLenses.map(d => d.lensId));
  const currentLensDirty = dirtyLenses.find(d => d.lensId === activeLens);

  // Abort stale async chains: incremented on project/lens change or unmount
  const runSessionRef = useRef(0);

  // Sync with step query param changes (e.g., from War Room heatmap clicks)
  useEffect(() => {
    if (stepParam && LENS_ORDER.includes(stepParam)) {
      setActiveLens(stepParam);
    }
  }, [stepParam]);

  // Reset local state and cancel in-flight chains when project ID changes
  useEffect(() => {
    runSessionRef.current += 1;
    setLensStates({});
    setIsProcessing(false);
    setIsRegenerating(false);
    setError(null);
    setActiveLens(initialLens);
    if (id) loadProject(id);
    return () => { runSessionRef.current += 1; }; // cancel on unmount
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate lens states from manifest (or clear if none)
  useEffect(() => {
    if (!currentProject) return;
    if (currentProject.manifest?.gauntlet_lenses) {
      setLensStates(currentProject.manifest.gauntlet_lenses);
    } else {
      setLensStates({});
    }
    if (currentProject.manifest?.gauntlet_active_lens) {
      setActiveLens(currentProject.manifest.gauntlet_active_lens as LensId);
    }
  }, [currentProject]);

  // Get current lens state
  const currentLensState = lensStates[activeLens] || { status: 'pending' as const };

  // Debug: Log whenever currentLensState changes
  useEffect(() => {
    console.log('[Gauntlet] currentLensState changed:', {
      activeLens,
      status: currentLensState.status,
      userEditPreview: currentLensState.userEdit?.substring(0, 100),
      proposalPreview: currentLensState.proposal?.substring(0, 100),
    });
  }, [activeLens, currentLensState]);

  // Persist lens state changes
  const persistLensState = useCallback(async (lensId: LensId, state: GauntletLensState) => {
    console.log('[Gauntlet] persistLensState called:', {
      lensId,
      oldState: lensStates[lensId]?.userEdit?.substring(0, 50),
      newState: state.userEdit?.substring(0, 50),
    });
    const updated = { ...lensStates, [lensId]: state };
    setLensStates(updated);
    console.log('[Gauntlet] setLensStates called with new state');
    await updateManifest({
      gauntlet_lenses: updated,
      gauntlet_active_lens: lensId,
    });
    console.log('[Gauntlet] updateManifest completed');
  }, [lensStates, updateManifest]);

  // Get pitch text from manifest
  const getPitch = (): string => {
    if (!currentProject) return '';
    return currentProject.manifest?.refined_vision
      || currentProject.manifest?.raw_vision
      || currentProject.pitch
      || currentProject.title;
  };

  // === STEP 1: Generate AI Proposal ===
  const handleGenerateProposal = async () => {
    console.log('[Gauntlet] handleGenerateProposal called', {
      currentProjectId: currentProject?.id,
      currentProjectTitle: currentProject?.title,
      urlId: id,
      isProjectLoading,
      activeLens,
    });

    // Verify we have the correct project loaded (prevent stale data)
    if (!currentProject || currentProject.id !== id) {
      const errorMsg = `Project data is stale. Current: ${currentProject?.id}, URL: ${id}. Please refresh the page.`;
      console.error('[Gauntlet] Project mismatch:', errorMsg);
      setError(errorMsg);
      return;
    }

    // Ensure project has finished loading
    if (isProjectLoading) {
      console.warn('[Gauntlet] Project still loading');
      setError('Project is still loading. Please wait.');
      return;
    }

    setIsRegenerating(true);
    setError(null);
    setGapReport(null); // Clear any previous gap report

    // Log for debugging
    console.log('[Gauntlet] Generating proposal for:', {
      projectId: currentProject.id,
      projectTitle: currentProject.title,
      lensId: activeLens,
      pitch: getPitch().substring(0, 100) + '...',
    });

    // Log the full manifest to see if there's contamination
    console.log('[Gauntlet] Manifest contents:', {
      raw_vision: currentProject.manifest?.raw_vision?.substring(0, 100),
      refined_vision: currentProject.manifest?.refined_vision?.substring(0, 100),
      engineering_moat: currentProject.manifest?.engineering_moat?.substring(0, 100),
      core_thesis: currentProject.manifest?.core_thesis,
      wedge: currentProject.manifest?.wedge,
    });

    try {
      const result: LensProposalResult = await generateLensProposal(
        activeLens,
        currentProject.manifest || {},
        getPitch(),
        activeLens === 'people' ? currentProject.manifest?.gauntlet_people_input : undefined
      );

      console.log('[Gauntlet] API returned result:', result);

      // Handle Gap Report
      if (result.status === 'gap_detected') {
        console.log('[Gauntlet] Gap detected:', result.gapReport);
        setGapReport(result.gapReport);
        setIsRegenerating(false);
        return;
      }

      // Handle successful proposal
      const content = result.content;

      let newState: GauntletLensState;
      if (activeLens === 'monopoly') {
        const wedges = content.split('---WEDGE---').map(w => w.trim()).filter(Boolean);

        // Ensure we have at least 3 wedges
        if (wedges.length < 3) {
          console.warn(`Only ${wedges.length} wedges generated, expected 3`);
          setError(`AI generated ${wedges.length} wedge${wedges.length !== 1 ? 's' : ''} instead of 3. You can proceed with the available options or regenerate.`);
        }

        newState = {
          status: 'selecting',
          proposals: wedges.length > 0 ? wedges : [content], // Fallback to full result if no wedges found
          proposal: wedges[0] || content
        };
      } else {
        newState = { status: 'editing', proposal: content, userEdit: content };
      }

      console.log('[Gauntlet] Persisting new state:', {
        lensId: activeLens,
        status: newState.status,
        proposalPreview: newState.proposal?.substring(0, 100) + '...',
        userEditPreview: newState.userEdit?.substring(0, 100) + '...',
      });

      await persistLensState(activeLens, newState);
      console.log('[Gauntlet] State persisted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proposal');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Handle "Force Draft" - override gap report and use hypothesis
  // Save gap report to previousGapReport so user can navigate back to hypotheses
  const handleForceFromHypothesis = async (hypothesis: string) => {
    setPreviousGapReport(gapReport);
    setGapReport(null);
    // Create a draft proposal state with the hypothesis as the starting point
    const newState: GauntletLensState = {
      status: 'editing',
      proposal: hypothesis,
      userEdit: hypothesis,
    };
    await persistLensState(activeLens, newState);
  };

  // Handle "Back to Hypotheses" - restore gap report from previousGapReport
  const handleBackToHypotheses = () => {
    if (previousGapReport) {
      setGapReport(previousGapReport);
      setPreviousGapReport(null);
    }
  };

  // Handle "Edit Idea" - go back to refine the pitch
  const handleEditIdea = () => {
    setGapReport(null);
    navigate(`/forge/${id}`);
  };

  const handleSelectProposal = async (proposal: string) => {
    const state = lensStates[activeLens];
    if (!state) return;

    const newState: GauntletLensState = {
      ...state,
      status: 'editing',
      userEdit: proposal
    };
    await persistLensState(activeLens, newState);
  };

  // === STEP 2: User edits and approves → triggers Attack ===
  const handleUserEdit = (text: string) => {
    setLensStates(prev => ({
      ...prev,
      [activeLens]: { ...currentLensState, userEdit: text },
    }));
  };

  const handleApproveEdit = async () => {
    // Clear gap report and previousGapReport when user approves and starts the debate
    setGapReport(null);
    setPreviousGapReport(null);
    const session = ++runSessionRef.current;
    const state: GauntletLensState = { ...currentLensState, status: 'attacking', debatePoints: [], debateStatus: 'attacking' };
    await persistLensState(activeLens, state);
    // Auto-start the attack phase
    await handleRunAttack(state, session);
  };

  // === STEP 3a: Skeptic's Attack ===
  const handleRunAttack = async (stateOverride?: GauntletLensState, session?: number) => {
    const s = session ?? runSessionRef.current;
    const state = stateOverride || currentLensState;
    // Idempotency: if debate points already exist, skip to defense
    if (state.debatePoints && state.debatePoints.length > 0) {
      await handleRunDefense(state, s);
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const points = await generateCritiquePoints(
        activeLens,
        currentProject?.manifest || {},
        state.userEdit || state.proposal || '',
        getPitch()
      );
      if (s !== runSessionRef.current) return; // stale — abort
      const newState: GauntletLensState = {
        ...state,
        status: 'defending',
        debatePoints: points,
        debateStatus: 'defending',
      };
      await persistLensState(activeLens, newState);
      // Auto-continue to defense phase
      await handleRunDefense(newState, s);
    } catch (err) {
      if (s !== runSessionRef.current) return;
      setError(err instanceof Error ? err.message : 'Attack phase failed');
      setIsProcessing(false);
    }
  };

  // === STEP 3b: Visionary's Shield ===
  const handleRunDefense = async (stateOverride?: GauntletLensState, session?: number) => {
    const s = session ?? runSessionRef.current;
    const state = stateOverride || currentLensState;
    const points = state.debatePoints || [];
    // Idempotency: if all points already have defenses, skip to judging
    if (points.length > 0 && points.every(p => p.defense)) {
      await handleRunJudging(state, s);
      return;
    }
    try {
      const defended = await generateAllDefenses(
        activeLens,
        currentProject?.manifest || {},
        state.userEdit || state.proposal || '',
        getPitch(),
        points
      );
      if (s !== runSessionRef.current) return; // stale — abort
      const newState: GauntletLensState = {
        ...state,
        status: 'judging',
        debatePoints: defended,
        debateStatus: 'judging',
      };
      await persistLensState(activeLens, newState);
      // Auto-continue to judging phase
      await handleRunJudging(newState, s);
    } catch (err) {
      if (s !== runSessionRef.current) return;
      setError(err instanceof Error ? err.message : 'Defense phase failed');
      setIsProcessing(false);
    }
  };

  // === STEP 3c: Jury's Gavel ===
  const handleRunJudging = async (stateOverride?: GauntletLensState, session?: number) => {
    const s = session ?? runSessionRef.current;
    const state = stateOverride || currentLensState;
    const points = state.debatePoints || [];
    // Idempotency: if all points already have verdicts, skip
    if (points.length > 0 && points.every(p => p.verdict)) {
      setIsProcessing(false);
      return;
    }
    try {
      const judged = await adjudicateAllPoints(
        activeLens,
        currentProject?.manifest || {},
        state.userEdit || state.proposal || '',
        points
      );
      if (s !== runSessionRef.current) return; // stale — abort
      const score = calculateLensScore(judged);
      const resolvedText = state.userEdit || state.proposal || '';
      const newState: GauntletLensState = {
        ...state,
        status: 'resolved',
        debatePoints: judged,
        debateStatus: 'resolved',
        kScore: score,
        resolvedAt: new Date().toISOString(),
      };

      // === CONTEXT SYNCER: Auto-sync resolved lens to manifest fields ===
      // This enables downstream lenses to reference committed upstream decisions
      const syncFields = getLensSyncFields(activeLens, resolvedText);

      // Persist lens state AND sync fields in one update
      const updated = { ...lensStates, [activeLens]: newState };
      setLensStates(updated);
      await updateManifest({
        gauntlet_lenses: updated,
        gauntlet_active_lens: activeLens,
        ...syncFields,
      });
    } catch (err) {
      if (s !== runSessionRef.current) return;
      setError(err instanceof Error ? err.message : 'Judging phase failed');
    } finally {
      if (s === runSessionRef.current) setIsProcessing(false);
    }
  };

  // === People Lens: Submit bio ===
  const handlePeopleSubmit = async (formattedInput: string) => {
    await updateManifest({ gauntlet_people_input: formattedInput });
    setIsProcessing(true);
    setError(null);
    try {
      const result = await generateLensProposal(
        'people',
        currentProject?.manifest || {},
        getPitch(),
        formattedInput
      );
      // People lens doesn't use binary check, so it should always be success
      if (result.status === 'gap_detected') {
        setError('Unexpected gap report for People lens');
        return;
      }
      const proposal = result.content;
      const newState: GauntletLensState = { status: 'editing', proposal, userEdit: proposal };
      await persistLensState('people', newState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proposal');
    } finally {
      setIsProcessing(false);
    }
  };

  // Navigate to next/prev lens
  const navigateLens = (direction: 'next' | 'prev') => {
    const idx = LENS_ORDER.indexOf(activeLens);
    if (direction === 'next' && idx < LENS_ORDER.length - 1) {
      setActiveLens(LENS_ORDER[idx + 1]);
      setGapReport(null); // Clear gap report when changing lens
      setPreviousGapReport(null);
    } else if (direction === 'prev' && idx > 0) {
      setActiveLens(LENS_ORDER[idx - 1]);
      setGapReport(null); // Clear gap report when changing lens
      setPreviousGapReport(null);
    }
  };

  // Check completion
  const resolvedCount = LENS_ORDER.filter(l => lensStates[l]?.status === 'resolved').length;
  const isAllResolved = resolvedCount === 7;
  const hasEarlyExit = !!currentProject?.manifest?.early_exit_reason;
  const canEnterWarRoom = isAllResolved || hasEarlyExit || resolvedCount > 0;

  // Handle "Enter War Room" (proceed to final view)
  const handleComplete = () => {
    if (currentProject) {
      navigate(`/projects/${currentProject.id}`);
    }
  };

  // Handle "Concede & Finish Venture" - early exit due to failed lens
  const handleConcedeVenture = async () => {
    if (!currentProject) return;

    // Preserve the user's hypothesis if they selected one
    const currentState = lensStates[activeLens];
    const hypothesis = currentState?.userEdit || currentState?.proposal;

    // Save the current state with the hypothesis
    const updatedLenses = {
      ...lensStates,
      [activeLens]: {
        ...currentState,
        status: 'pending' as const,
        userEdit: hypothesis, // Preserve what they were working with
      },
    };

    // Update manifest with early exit info
    await updateManifest({
      venture_status: 'resolved',
      early_exit_reason: activeLens,
      gauntlet_lenses: updatedLenses,
    });

    // Navigate to War Room
    navigate(`/projects/${currentProject.id}`);
  };

  // Check for chain reaction when attempting to reopen a lens
  const handleReopenRequest = (lensId: LensId) => {
    const chainReaction = calculateChainReaction(lensId, currentProject?.manifest || {});
    if (chainReaction.affectedLenses.length > 0) {
      setChainReactionWarning(chainReaction);
    } else {
      executeReopen(lensId);
    }
  };

  // Execute the actual reopen with cascade invalidation
  const executeReopen = async (lensId: LensId) => {
    const affectedLenses = getAffectedDownstreamLenses(lensId, currentProject?.manifest || {});
    const currentState = lensStates[lensId];

    // Reset the target lens to editing state
    const newState: GauntletLensState = {
      ...currentState,
      status: 'editing',
      debatePoints: undefined,
      debateStatus: undefined,
      kScore: undefined,
      resolvedAt: undefined,
    };

    // Build updated lens states - invalidate downstream lenses by marking them with new dirty timestamp
    const updated = { ...lensStates, [lensId]: newState };

    // Mark downstream resolved lenses as needing re-debate (set their resolvedAt to undefined)
    // This creates a dirty state because their upstream lens was just reopened
    for (const downstreamId of affectedLenses) {
      const downstreamState = updated[downstreamId];
      if (downstreamState?.status === 'resolved') {
        // We don't actually reset them - the dirty state detection will catch them
        // because their upstream (lensId) will have a newer resolvedAt when re-resolved
      }
    }

    setLensStates(updated);
    await updateManifest({
      gauntlet_lenses: updated,
      gauntlet_active_lens: lensId,
    });

    setChainReactionWarning(null);
  };

  if (isProjectLoading && id) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const lensConfig = LENS_CONFIGS[activeLens];
  const LensIcon = LENS_ICONS[activeLens];
  const activeLensIdx = LENS_ORDER.indexOf(activeLens);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/60 bg-zinc-950 sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back to Forge button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/forge/${id}`)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Edit Idea
            </Button>

            <div className="h-4 w-px bg-zinc-800" />

            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">The Gauntlet</h1>
              <p className="text-[11px] text-zinc-500">{currentProject?.title || 'Untitled'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">{resolvedCount}/7 lenses cleared</span>
            <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-green-500 transition-all duration-500"
                style={{ width: `${(resolvedCount / 7) * 100}%` }}
              />
            </div>
            {resolvedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (confirm('Reset all lens analysis? This will clear all lens data but keep your raw vision.')) {
                    await resetGauntlet();
                    setLensStates({});
                    setActiveLens('engineering');
                  }
                }}
                className="text-xs text-zinc-500 hover:text-red-400"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset
              </Button>
            )}
            {canEnterWarRoom && (
              <Button
                size="sm"
                onClick={handleComplete}
                className={cn(
                  hasEarlyExit
                    ? "bg-zinc-600 hover:bg-zinc-500"
                    : isAllResolved
                      ? "bg-green-600 hover:bg-green-500"
                      : "bg-zinc-700 hover:bg-zinc-600"
                )}
              >
                {hasEarlyExit ? 'View War Room' : 'Enter War Room'}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Left: Lens Navigation */}
        <nav className="w-56 border-r border-zinc-800/60 flex flex-col py-3">
          {LENS_ORDER.map((lensId, idx) => {
            const config = LENS_CONFIGS[lensId];
            const Icon = LENS_ICONS[lensId];
            const state = lensStates[lensId];
            const status: GauntletLensStatus = state?.status || 'pending';
            const StatusIcon = STATUS_ICONS[status];
            const isActive = lensId === activeLens;
            const isBlocked = !canRunLens(lensId) && status === 'pending';

            return (
              <button
                key={lensId}
                onClick={() => { setActiveLens(lensId); setGapReport(null); setPreviousGapReport(null); }}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-left transition-colors w-full',
                  isActive
                    ? 'bg-zinc-800/60 border-r-2 border-r-amber-400'
                    : 'hover:bg-zinc-800/30',
                  isBlocked && !isActive && 'opacity-50'
                )}
              >
                <div className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
                  status === 'resolved'
                    ? 'bg-green-500/10'
                    : isBlocked
                      ? 'bg-zinc-800/30'
                      : isActive
                        ? config.bgColor
                        : 'bg-zinc-800/50'
                )}>
                  <Icon className={cn(
                    'w-3.5 h-3.5',
                    status === 'resolved'
                      ? 'text-green-400'
                      : isBlocked
                        ? 'text-zinc-600'
                        : isActive
                          ? config.color
                          : 'text-zinc-500'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    'text-xs font-medium block truncate',
                    isBlocked ? 'text-zinc-500' : isActive ? 'text-zinc-200' : 'text-zinc-400'
                  )}>
                    {idx + 1}. {config.title}
                  </span>
                  <span className="text-[10px] text-zinc-600 block truncate">{config.subtitle}</span>
                </div>
                {/* Dirty indicator */}
                {dirtyLensIds.has(lensId) && status === 'resolved' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 animate-pulse" title="Needs re-debate" />
                )}
                {/* Blocked indicator */}
                {isBlocked ? (
                  <Lock className="w-3.5 h-3.5 shrink-0 text-zinc-600" />
                ) : (
                  <StatusIcon className={cn(
                    'w-3.5 h-3.5 shrink-0',
                    dirtyLensIds.has(lensId) && status === 'resolved' ? 'text-orange-400' :
                      status === 'resolved' ? 'text-green-400' :
                        status === 'judging' ? 'text-purple-400' :
                          status === 'defending' ? 'text-cyan-400' :
                            status === 'attacking' ? 'text-orange-400 animate-pulse' :
                              status === 'editing' ? 'text-cyan-400' :
                                status === 'proposing' ? 'text-cyan-400 animate-spin' :
                                  status === 'debating' ? 'text-amber-400' :
                                    'text-zinc-700'
                  )} />
                )}
              </button>
            );
          })}

          {/* Lens score summary */}
          {resolvedCount > 0 && (
            <div className="mt-auto px-4 py-3 border-t border-zinc-800/60">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Scores</p>
              <div className="space-y-1">
                {LENS_ORDER.filter(l => lensStates[l]?.status === 'resolved').map(lensId => (
                  <div key={lensId} className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500">{LENS_CONFIGS[lensId].title}</span>
                    <span className={cn(
                      'text-[11px] font-mono',
                      (lensStates[lensId]?.kScore || 0) >= 70 ? 'text-green-400' :
                        (lensStates[lensId]?.kScore || 0) >= 50 ? 'text-amber-400' :
                          'text-red-400'
                    )}>
                      {lensStates[lensId]?.kScore || '--'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Right: Active Lens Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Lens Header */}
          <div className={cn('px-6 py-4 border-b border-zinc-800/40', lensConfig.bgColor)}>
            <div className="flex items-center gap-3">
              <LensIcon className={cn('w-5 h-5', lensConfig.color)} />
              <div>
                <h2 className={cn('text-sm font-semibold', lensConfig.color)}>
                  Lens {activeLensIdx + 1}: {lensConfig.title} — {lensConfig.subtitle}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">{lensConfig.question}</p>
              </div>
            </div>
          </div>

          {/* Lens Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Dirty State Warning */}
            {currentLensDirty && currentLensState.status === 'resolved' && (
              <div className="mb-4 flex items-center gap-2 text-sm text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">This lens may be outdated.</span>
                  <span className="text-orange-300/80 ml-1">{currentLensDirty.reason}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const newState: GauntletLensState = {
                      ...currentLensState,
                      status: 'editing',
                      debatePoints: undefined,
                      debateStatus: undefined,
                      kScore: undefined,
                      resolvedAt: undefined,
                    };
                    await persistLensState(activeLens, newState);
                  }}
                  className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Re-debate
                </Button>
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-auto text-amber-400/60 hover:text-amber-400">
                  dismiss
                </button>
              </div>
            )}

            {/* GAP REPORT STATE */}
            {gapReport && (
              <GapReportCard
                gapReport={gapReport}
                lensConfig={lensConfig}
                onEditIdea={handleEditIdea}
                onForceHypothesis={handleForceFromHypothesis}
                onRegenerate={handleGenerateProposal}
                onConcedeVenture={handleConcedeVenture}
                isRegenerating={isRegenerating}
              />
            )}

            {/* PENDING STATE */}
            {currentLensState.status === 'pending' && !gapReport && (
              <LensPendingState
                lensId={activeLens}
                isProcessing={isProcessing}
                isRegenerating={isRegenerating}
                onStart={activeLens === 'people' ? undefined : handleGenerateProposal}
                onPeopleSubmit={activeLens === 'people' ? handlePeopleSubmit : undefined}
                peopleInput={currentProject?.manifest?.gauntlet_people_input}
                unresolvedDependencies={getUnresolvedDependencies(activeLens)}
                canRun={canRunLens(activeLens)}
              />
            )}

            {/* SELECTING STATE */}
            {currentLensState.status === 'selecting' && !gapReport && (
              <LensSelectingState
                proposals={currentLensState.proposals || []}
                onSelect={handleSelectProposal}
                onCustom={() => handleSelectProposal('')}
                lensConfig={lensConfig}
                onRegenerate={handleGenerateProposal}
                isRegenerating={isRegenerating}
              />
            )}

            {/* EDITING STATE */}
            {(currentLensState.status === 'editing' || currentLensState.status === 'proposing') && !gapReport && (
              <LensEditingState
                proposal={currentLensState.proposal || ''}
                userEdit={currentLensState.userEdit || ''}
                isProcessing={isProcessing}
                isRegenerating={isRegenerating}
                onEdit={handleUserEdit}
                onApprove={handleApproveEdit}
                onRegenerate={handleGenerateProposal}
                lensConfig={lensConfig}
                showBackToSelection={activeLens === 'monopoly' && !!currentLensState.proposals?.length}
                onBackToSelection={async () => {
                  const newState: GauntletLensState = {
                    ...currentLensState,
                    status: 'selecting',
                  };
                  await persistLensState(activeLens, newState);
                }}
                showBackToHypotheses={!!previousGapReport}
                onBackToHypotheses={handleBackToHypotheses}
              />
            )}

            {/* DEBATING STATES (attacking/defending/judging) */}
            {(currentLensState.status === 'attacking' ||
              currentLensState.status === 'defending' ||
              currentLensState.status === 'judging' ||
              currentLensState.status === 'debating') && (
                <LensDebatingState
                  points={currentLensState.debatePoints || []}
                  userEdit={currentLensState.userEdit || ''}
                  isProcessing={isProcessing}
                  debateStatus={currentLensState.debateStatus || currentLensState.status}
                  lensConfig={lensConfig}
                  onResume={() => {
                    const session = ++runSessionRef.current;
                    const status = currentLensState.debateStatus || currentLensState.status;
                    if (status === 'attacking') {
                      handleRunAttack(currentLensState, session);
                    } else if (status === 'defending') {
                      setIsProcessing(true);
                      handleRunDefense(currentLensState, session);
                    } else if (status === 'judging') {
                      setIsProcessing(true);
                      handleRunJudging(currentLensState, session);
                    }
                  }}
                />
              )}

            {/* RESOLVED STATE */}
            {currentLensState.status === 'resolved' && (
              <LensResolvedState
                lensState={currentLensState}
                lensConfig={lensConfig}
                downstreamLenses={getDownstreamLenses(activeLens).filter(
                  l => lensStates[l]?.status === 'resolved'
                )}
                isDirty={dirtyLensIds.has(activeLens)}
                onReopen={() => handleReopenRequest(activeLens)}
              />
            )}
          </div>

          {/* Footer navigation */}
          <div className="px-6 py-3 border-t border-zinc-800/40 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={activeLensIdx === 0}
              onClick={() => navigateLens('prev')}
              className="text-zinc-400"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Previous
            </Button>
            <span className="text-[11px] text-zinc-600">
              {activeLensIdx + 1} of {LENS_ORDER.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={activeLensIdx === LENS_ORDER.length - 1}
              onClick={() => navigateLens('next')}
              className="text-zinc-400"
            >
              Next
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chain Reaction Warning Modal */}
      {chainReactionWarning && (
        <ChainReactionModal
          chainReaction={chainReactionWarning}
          onConfirm={() => executeReopen(chainReactionWarning.modifiedLens)}
          onCancel={() => setChainReactionWarning(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function LensSelectingState({
  proposals,
  onSelect,
  onCustom,
  lensConfig,
  onRegenerate,
  isRegenerating,
}: {
  proposals: string[];
  onSelect: (p: string) => void;
  onCustom: () => void;
  lensConfig: typeof LENS_CONFIGS[LensId];
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <h3 className="text-lg font-medium text-zinc-200">Select Your Wedge</h3>
          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Regenerate
                </>
              )}
            </Button>
          )}
        </div>
        <p className="text-sm text-zinc-500 max-w-lg mx-auto">
          {proposals.length === 3
            ? "We've generated three distinct starting markets. Choose one to analyze, or write your own custom proposal."
            : `${proposals.length} wedge${proposals.length !== 1 ? 's' : ''} generated. Choose one to analyze, regenerate for more options, or write your own.`}
        </p>
        {lensConfig.id === 'monopoly' && proposals.length === 3 && (
          <p className="text-sm text-zinc-500 max-w-2xl mx-auto pt-2">
            Each wedge varies in dominatability profile: <span className="text-zinc-400">Option 1 (Fast Acquisition)</span>,
            <span className="text-zinc-400"> Option 2 (Balanced)</span>,
            <span className="text-zinc-400"> Option 3 (High Moat)</span>. Choose based on your assets and timeline.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {proposals.map((proposal, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(proposal)}
            className={cn(
              "group relative flex flex-col p-5 rounded-xl border bg-zinc-900/40 text-left transition-all hover:border-amber-500/50 hover:bg-zinc-900/60 hover:shadow-lg hover:shadow-amber-500/5",
              lensConfig.borderColor
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Option {idx + 1}</span>
              <div className="w-6 h-6 rounded-full border border-zinc-800 flex items-center justify-center bg-zinc-950 group-hover:border-amber-500/50">
                <ArrowRight className="w-3 h-3 text-zinc-600 group-hover:text-amber-400" />
              </div>
            </div>
            <div className="flex-1 space-y-3">
              {proposal.split('\n').filter(Boolean).map((line, i) => (
                <p key={i} className="text-[11px] leading-relaxed text-zinc-400 group-hover:text-zinc-300">
                  {line}
                </p>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center pt-4">
        <div className="h-px w-20 bg-zinc-800 mb-6" />
        <Button
          variant="ghost"
          onClick={onCustom}
          className="text-zinc-500 hover:text-zinc-300 text-xs"
        >
          <Pencil className="w-3.5 h-3.5 mr-2" />
          Write my own custom proposal
        </Button>
      </div>
    </div>
  );
}

function LensPendingState({
  lensId,
  isProcessing,
  isRegenerating,
  onStart,
  onPeopleSubmit,
  peopleInput,
  unresolvedDependencies = [],
  canRun = true,
}: {
  lensId: LensId;
  isProcessing: boolean;
  isRegenerating?: boolean;
  onStart?: () => void;
  onPeopleSubmit?: (input: string) => void;
  peopleInput?: string;
  unresolvedDependencies?: LensId[];
  canRun?: boolean;
}) {
  // People lens uses isProcessing (from handlePeopleSubmit)
  // Other lenses use isRegenerating (from handleGenerateProposal)
  const isGenerating = lensId === 'people' ? isProcessing : isRegenerating;

  if (lensId === 'people' && onPeopleSubmit) {
    // Show dependency blocker for People lens too
    if (!canRun && unresolvedDependencies.length > 0) {
      return (
        <div className="max-w-2xl mx-auto">
          <DependencyBlocker lensId={lensId} unresolvedDependencies={unresolvedDependencies} />
        </div>
      );
    }
    return (
      <div className="max-w-2xl mx-auto">
        <PeopleLensForm initialValue={peopleInput} onSubmit={onPeopleSubmit} />
        {isProcessing && (
          <div className="flex items-center gap-2 mt-4 text-sm text-pink-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing founder-market fit...
          </div>
        )}
      </div>
    );
  }

  const config = LENS_CONFIGS[lensId];

  // Show dependency blocker if lens cannot run yet
  if (!canRun && unresolvedDependencies.length > 0) {
    return <DependencyBlocker lensId={lensId} unresolvedDependencies={unresolvedDependencies} />;
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center mb-4', config.bgColor, 'border', config.borderColor)}>
        <Sparkles className={cn('w-7 h-7', config.color)} />
      </div>
      <h3 className="text-lg font-medium text-zinc-200 mb-2">
        Ready to analyze: {config.title}
      </h3>
      <p className="text-sm text-zinc-500 max-w-md mb-6">
        {config.question}
      </p>
      <p className="text-xs text-zinc-600 max-w-sm mb-6">
        AI will generate a draft proposal. After editing, a Skeptic will attack it,
        a Visionary will defend it, and a Jury will adjudicate each point.
      </p>
      <Button
        onClick={onStart}
        disabled={isGenerating}
        className={cn('px-6', config.bgColor, config.color, 'border', config.borderColor, 'hover:opacity-80')}
      >
        {isGenerating ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Play className="w-4 h-4 mr-2" />
        )}
        Generate AI Proposal
      </Button>
    </div>
  );
}

function DependencyBlocker({
  lensId,
  unresolvedDependencies,
}: {
  lensId: LensId;
  unresolvedDependencies: LensId[];
}) {
  const config = LENS_CONFIGS[lensId];
  const Icon = LENS_ICONS[lensId];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-zinc-800/50 border border-zinc-700/50')}>
        <Icon className="w-7 h-7 text-zinc-500" />
      </div>
      <h3 className="text-lg font-medium text-zinc-400 mb-2">
        {config.title} is blocked
      </h3>
      <p className="text-sm text-zinc-500 max-w-md mb-6">
        This lens depends on upstream lenses that haven't been resolved yet.
        Complete them first to unlock this analysis.
      </p>

      <div className="flex flex-col items-center gap-3 mb-6">
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">
          Complete these lenses first:
        </span>
        <div className="flex flex-wrap gap-2 justify-center">
          {unresolvedDependencies.map(depId => {
            const depConfig = LENS_CONFIGS[depId];
            const DepIcon = LENS_ICONS[depId];
            return (
              <div
                key={depId}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border',
                  depConfig.bgColor,
                  depConfig.borderColor
                )}
              >
                <DepIcon className={cn('w-3.5 h-3.5', depConfig.color)} />
                <span className={cn('text-xs font-medium', depConfig.color)}>
                  {depConfig.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-zinc-600 max-w-sm">
        Each lens builds upon prior decisions to ensure intellectual consistency
        across your venture thesis.
      </p>
    </div>
  );
}

function LensEditingState({
  proposal,
  userEdit,
  isProcessing,
  isRegenerating,
  onEdit,
  onApprove,
  onRegenerate,
  lensConfig,
  showBackToSelection,
  onBackToSelection,
  showBackToHypotheses,
  onBackToHypotheses,
}: {
  proposal: string;
  userEdit: string;
  isProcessing: boolean;
  isRegenerating?: boolean;
  onEdit: (text: string) => void;
  onApprove: () => void;
  onRegenerate?: () => void;
  lensConfig: typeof LENS_CONFIGS[LensId];
  showBackToSelection?: boolean;
  onBackToSelection?: () => void;
  showBackToHypotheses?: boolean;
  onBackToHypotheses?: () => void;
}) {
  const isModified = userEdit !== proposal;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>AI-generated proposal — edit below to refine</span>
          {isModified && (
            <span className="text-amber-400 ml-2">(modified)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Hide Regenerate button when user came from gap report hypothesis */}
          {onRegenerate && !showBackToHypotheses && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                console.log('[LensEditingState] Regenerate button clicked');
                onRegenerate();
              }}
              disabled={isRegenerating || isProcessing}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Regenerate
                </>
              )}
            </Button>
          )}
          {showBackToSelection && onBackToSelection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToSelection}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back to Options
            </Button>
          )}
          {showBackToHypotheses && onBackToHypotheses && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToHypotheses}
              className="text-xs text-orange-400 hover:text-orange-300"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back to Hypotheses
            </Button>
          )}
        </div>
      </div>

      <div className={cn('border rounded-lg overflow-hidden', lensConfig.borderColor)}>
        <textarea
          value={userEdit}
          onChange={e => onEdit(e.target.value)}
          className="w-full h-48 bg-zinc-900/50 text-zinc-200 text-sm leading-relaxed p-4 resize-none outline-none"
          placeholder="Edit the proposal..."
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={onApprove}
          disabled={isProcessing || isRegenerating || !userEdit.trim()}
          className="bg-amber-600 hover:bg-amber-500"
        >
          {isProcessing && !isRegenerating ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Swords className="w-4 h-4 mr-2" />
          )}
          Run Adversarial Debate
        </Button>
        <span className="text-xs text-zinc-600">
          Skeptic attacks → Visionary defends → Jury adjudicates
        </span>
      </div>
    </div>
  );
}

function LensDebatingState({
  points,
  userEdit,
  isProcessing,
  debateStatus,
  lensConfig,
  onResume,
}: {
  points: DebatePoint[];
  userEdit: string;
  isProcessing: boolean;
  debateStatus: string;
  lensConfig: typeof LENS_CONFIGS[LensId];
  onResume?: () => void;
}) {
  const loadingPhase = isProcessing
    ? (debateStatus === 'attacking' ? 'attacking' as const :
      debateStatus === 'defending' ? 'defending' as const :
        debateStatus === 'judging' ? 'judging' as const :
          undefined)
    : undefined;

  // Stale = intermediate status but no API call running
  const isStale = !isProcessing && (debateStatus === 'attacking' || debateStatus === 'defending' || debateStatus === 'judging');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* User's approved proposal */}
      <div className={cn('border rounded-lg p-4 text-xs', lensConfig.borderColor, lensConfig.bgColor)}>
        <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-medium">Your proposal:</span>
        <p className="text-zinc-300 mt-1 whitespace-pre-wrap line-clamp-4">{userEdit}</p>
      </div>

      {/* Phase Progress */}
      <div className="flex items-center gap-2 px-1">
        <PhaseStep label="Attack" active={isProcessing && debateStatus === 'attacking'} done={points.length > 0 && debateStatus !== 'attacking'} stalled={isStale && debateStatus === 'attacking'} />
        <div className="w-6 h-px bg-zinc-700" />
        <PhaseStep label="Defend" active={isProcessing && debateStatus === 'defending'} done={points.some(p => p.defense) && debateStatus !== 'defending'} stalled={isStale && debateStatus === 'defending'} />
        <div className="w-6 h-px bg-zinc-700" />
        <PhaseStep label="Judge" active={isProcessing && debateStatus === 'judging'} done={points.some(p => p.verdict)} stalled={isStale && debateStatus === 'judging'} />
      </div>

      {/* Stale state: show resume button */}
      {isStale && onResume && (
        <div className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">This phase was interrupted. Resume to continue from where it left off.</span>
          <Button size="sm" onClick={onResume} className="ml-auto bg-amber-600 hover:bg-amber-500 text-xs">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Resume
          </Button>
        </div>
      )}

      {/* Debate Table */}
      <DebateTable
        points={points}
        isLoading={isProcessing}
        loadingPhase={loadingPhase}
      />
    </div>
  );
}

function PhaseStep({ label, active, done, stalled }: { label: string; active: boolean; done: boolean; stalled?: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 text-xs px-2 py-1 rounded',
      active ? 'bg-amber-500/10 text-amber-400' :
        stalled ? 'bg-amber-500/5 text-amber-500/70' :
          done ? 'text-green-400' :
            'text-zinc-600'
    )}>
      {active && <Loader2 className="w-3 h-3 animate-spin" />}
      {stalled && <AlertTriangle className="w-3 h-3" />}
      {done && <CheckCircle2 className="w-3 h-3" />}
      {!active && !stalled && !done && <Circle className="w-3 h-3" />}
      <span>{label}</span>
    </div>
  );
}

function LensResolvedState({
  lensState,
  lensConfig,
  onReopen,
  downstreamLenses,
  isDirty,
}: {
  lensState: GauntletLensState;
  lensConfig: typeof LENS_CONFIGS[LensId];
  onReopen: () => void;
  downstreamLenses: LensId[];
  isDirty: boolean;
}) {
  const points = lensState.debatePoints || [];
  const score = lensState.kScore || 0;
  const visionaryWins = points.filter(p => p.verdict?.winner === 'visionary').length;
  const skepticWins = points.filter(p => p.verdict?.winner === 'skeptic').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Resolved badge */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-green-400">Lens Resolved</h3>
          <p className="text-xs text-zinc-500">
            Score: <span className={cn(
              'font-mono font-semibold',
              score >= 70 ? 'text-green-400' :
                score >= 50 ? 'text-amber-400' : 'text-red-400'
            )}>{score}</span>
            <span className="text-zinc-600 ml-2">
              ({visionaryWins} defended, {skepticWins} conceded)
            </span>
            {lensState.resolvedAt && (
              <span className="ml-2 text-zinc-600">
                {new Date(lensState.resolvedAt).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Legacy monopoly lens detection */}
      {lensConfig.id === 'monopoly' &&
        (lensState.userEdit || lensState.proposal || '').includes('<1,000') && (
          <div className="mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300">
            This analysis uses the legacy &lt;1,000 standard. Re-debate to apply the new Dominatability Standard.
          </div>
        )}

      {/* Final answer */}
      <div className={cn('border rounded-lg p-4', lensConfig.borderColor, lensConfig.bgColor)}>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Final Position:</span>
        <p className="text-sm text-zinc-200 mt-2 whitespace-pre-wrap leading-relaxed">
          {lensState.userEdit || lensState.proposal}
        </p>
      </div>

      {/* Debate Table (read-only) */}
      {points.length > 0 && (
        <div>
          <h4 className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">Debate Points</h4>
          <DebateTable points={points} />
        </div>
      )}

      {/* Downstream warning */}
      {downstreamLenses.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-800/30 border border-zinc-700/50 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-400" />
          <div>
            <span className="text-zinc-400">Changing this lens may invalidate:</span>
            <span className="ml-1 text-zinc-300">
              {downstreamLenses.map(l => LENS_CONFIGS[l].title).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Reopen */}
      <Button variant="ghost" size="sm" onClick={onReopen} className="text-zinc-500 hover:text-zinc-300">
        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
        Reopen & Re-debate
      </Button>
    </div>
  );
}

// =============================================================================
// CHAIN REACTION WARNING MODAL
// =============================================================================

// =============================================================================
// GAP REPORT CARD
// =============================================================================

function GapReportCard({
  gapReport,
  lensConfig,
  onEditIdea,
  onForceHypothesis,
  onRegenerate,
  onConcedeVenture,
  isRegenerating,
}: {
  gapReport: GapReport;
  lensConfig: typeof LENS_CONFIGS[LensId];
  onEditIdea: () => void;
  onForceHypothesis: (hypothesis: string) => void;
  onRegenerate: () => void;
  onConcedeVenture: () => void;
  isRegenerating: boolean;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Gap Report Header */}
      <div className="flex items-start gap-4 p-6 bg-orange-500/5 border border-orange-500/20 rounded-xl">
        <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Gap Detected</span>
            <span className={cn('text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded', lensConfig.bgColor, lensConfig.color)}>
              {lensConfig.title} Lens
            </span>
          </div>
          <h3 className="text-lg font-semibold text-orange-300 mb-2">
            Missing: {gapReport.missing_element}
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {gapReport.reason}
          </p>
        </div>
      </div>

      {/* Hypotheses Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Strategic Pivots to Consider
          </span>
        </div>

        <div className="grid gap-3">
          {gapReport.hypotheses.map((hypothesis, idx) => {
            // Extract mechanism name from [HYPOTHESIS: Name] format
            const match = hypothesis.match(/\[HYPOTHESIS[:\s]*([^\]]+)\]/i);
            const mechanismName = match ? match[1].trim() : `Option ${idx + 1}`;
            const description = hypothesis.replace(/\[HYPOTHESIS[:\s]*[^\]]+\]/i, '').trim().replace(/^[-–—]\s*/, '');

            return (
              <button
                key={idx}
                onClick={() => onForceHypothesis(hypothesis)}
                className="group flex items-start gap-4 p-4 bg-zinc-900/40 border border-zinc-800 rounded-lg text-left transition-all hover:border-cyan-500/30 hover:bg-zinc-900/60"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/20">
                  <span className="text-xs font-bold text-cyan-400">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-cyan-300 block mb-1">
                    {mechanismName}
                  </span>
                  <span className="text-xs text-zinc-500 group-hover:text-zinc-400">
                    {description || 'Click to explore this direction'}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 shrink-0 mt-1" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-4 pt-4 border-t border-zinc-800/60">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={onEditIdea}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Edit Idea
          </Button>

          <Button
            variant="ghost"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="text-zinc-500 hover:text-zinc-300"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>

          <div className="flex-1" />

          <span className="text-[10px] text-zinc-600">
            Select a pivot above to continue, or edit your idea
          </span>
        </div>

        {/* Early Exit Option */}
        <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3">
          <div className="flex-1">
            <p className="text-xs text-zinc-400">
              If this venture is fundamentally flawed, you can archive it and move on.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={onConcedeVenture}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Concede & Finish
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CHAIN REACTION WARNING MODAL
// =============================================================================

function ChainReactionModal({
  chainReaction,
  onConfirm,
  onCancel,
}: {
  chainReaction: ChainReaction;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const modifiedConfig = LENS_CONFIGS[chainReaction.modifiedLens];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden mx-4">
        {/* Header */}
        <div className="px-6 py-4 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-amber-400">Chain Reaction Warning</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Re-debating <span className="text-amber-300">{modifiedConfig.title}</span> will invalidate downstream lenses
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-zinc-300">
            The following resolved lenses depend on <span className="font-medium text-amber-400">{modifiedConfig.title}</span> and will need to be re-debated:
          </p>

          <div className="space-y-2">
            {chainReaction.affectedLenses.map(({ lensId }) => {
              const config = LENS_CONFIGS[lensId];
              const Icon = LENS_ICONS[lensId];
              return (
                <div key={lensId} className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2">
                  <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', config.bgColor)}>
                    <Icon className={cn('w-3.5 h-3.5', config.color)} />
                  </div>
                  <div className="flex-1">
                    <span className={cn('text-xs font-medium', config.color)}>{config.title}</span>
                    <span className="text-[10px] text-zinc-500 ml-2">{config.subtitle}</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                </div>
              );
            })}
          </div>

          <p className="text-xs text-zinc-500">
            These lenses will be marked as "dirty" and their current analyses will be invalidated. You'll need to re-run the debates to ensure consistency.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-zinc-400">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-500"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Proceed with Re-debate
          </Button>
        </div>
      </div>
    </div>
  );
}
