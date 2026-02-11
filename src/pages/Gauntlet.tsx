import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2, Zap, Clock, Target, Users, Truck, ShieldCheck, Eye,
  CheckCircle2, Circle, Play, Pencil, Swords, ArrowRight, ArrowLeft,
  Sparkles, AlertTriangle, RotateCcw, Shield, Lock, ChevronDown, FileText,
  Lightbulb, TrendingUp, Brain, Rocket, Search, Award, Flame,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useProjectManifest } from '@/hooks/useProjectManifest';
import { useFramework } from '@/hooks/useFramework';
import { FrameworkRegistry } from '@/lib/frameworks/registry';
import { LENS_CONFIGS, getLensSyncFields, generateStepProposal, type LensId, type GapReport, type LensProposalResult } from '@/lib/agents/lens-protocols';
import { LENS_ORDER } from '@/types/lenses';
import {
  shouldIssueGapReport, generateJuryGapReport,
  generateCritiquePointsForFramework, generateAllDefensesForFramework, adjudicateAllPointsForFramework,
} from '@/lib/agents/gauntlet-agents';
import { runCompetitorScout } from '@/lib/agents/competitor-agent';
import { calculateLensScore } from '@/types/debate';
import { DebateTable } from '@/components/DebateTable';
import { PeopleLensForm } from '@/components/PeopleLensForm';
import { getDirtyLenses, isLensDirty, getDownstreamLenses, getAffectedDownstreamLenses, calculateChainReaction, getDirtyLensesForFramework, getDownstreamSteps, getAffectedDownstreamSteps, calculateChainReactionForFramework, type DirtyLens, type ChainReaction } from '@/lib/dirty-state';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { GauntletLensState, GauntletLensStatus } from '@/types/database';
import type { DebatePoint } from '@/types/debate';
import type { FrameworkDefinition, StepDefinition } from '@/lib/frameworks/types';

type RerunMode = 'full' | 'visionary-jury' | 'jury-only';

// Icon mapping by name string → React component
const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Clock, Target, Users, Truck, ShieldCheck, Eye,
  Lightbulb, TrendingUp, Brain, Rocket, Search, Award, Flame,
  Sparkles, FileText, Swords, Shield,
};

function getIconForStep(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || Circle;
}

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

  // Multi-framework support
  const manifestFrameworks = currentProject?.manifest?.frameworks;
  const frameworkIds = manifestFrameworks && manifestFrameworks.length > 0
    ? manifestFrameworks
    : [FrameworkRegistry.getDefaultId()];
  const hasMultipleFrameworks = frameworkIds.length > 1;

  const frameworkParam = searchParams.get('framework') as string | null;
  const initialFramework = frameworkParam && frameworkIds.includes(frameworkParam) ? frameworkParam : frameworkIds[0];

  const [activeFrameworkId, setActiveFrameworkId] = useState<string>(initialFramework);
  // Keep activeFrameworkId in sync if the manifest frameworks change
  useEffect(() => {
    if (!frameworkIds.includes(activeFrameworkId)) {
      setActiveFrameworkId(frameworkIds[0]);
    }
  }, [frameworkIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const framework = useFramework(activeFrameworkId);
  const stepOrder = framework.stepOrder;
  const stepMap = useMemo(() => new Map(framework.steps.map(s => [s.id, s])), [framework]);

  const stepParam = searchParams.get('step') as string | null;
  const initialLens = stepParam && stepOrder.includes(stepParam) ? stepParam : stepOrder[0];

  const [activeLens, setActiveLens] = useState<string>(initialLens);
  const [lensStates, setLensStates] = useState<Record<string, GauntletLensState>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainReactionWarning, setChainReactionWarning] = useState<ChainReaction | null>(null);
  const [pendingRerunMode, setPendingRerunMode] = useState<RerunMode>('full');
  const [gapReport, setGapReport] = useState<GapReport | null>(null);
  const [previousGapReport, setPreviousGapReport] = useState<GapReport | null>(null);
  const [showIdeaPanel, setShowIdeaPanel] = useState(false);

  // Refs to avoid stale closures in async chains (defense/judging persist calls)
  const lensStatesRef = useRef<Record<string, GauntletLensState>>({});
  lensStatesRef.current = lensStates;
  const activeLensRef = useRef<string>(activeLens);
  activeLensRef.current = activeLens;
  const activeFrameworkIdRef = useRef<string>(activeFrameworkId);
  activeFrameworkIdRef.current = activeFrameworkId;

  // Framework-aware lens state helpers: default framework uses top-level gauntlet_lenses
  // for backward compatibility; other frameworks use framework_data[fwId]
  const isDefaultFramework = activeFrameworkId === FrameworkRegistry.getDefaultId();

  const getManifestLensStates = useCallback((): Record<string, GauntletLensState> | undefined => {
    const manifest = currentProject?.manifest;
    if (!manifest) return undefined;
    if (isDefaultFramework) {
      return manifest.gauntlet_lenses;
    }
    return manifest.framework_data?.[activeFrameworkId]?.gauntlet_lenses;
  }, [currentProject, activeFrameworkId, isDefaultFramework]);

  const getManifestActiveLens = useCallback((): string | undefined => {
    const manifest = currentProject?.manifest;
    if (!manifest) return undefined;
    if (isDefaultFramework) {
      return manifest.gauntlet_active_lens;
    }
    return manifest.framework_data?.[activeFrameworkId]?.gauntlet_active_lens;
  }, [currentProject, activeFrameworkId, isDefaultFramework]);

  const buildPersistPayload = useCallback((updated: Record<string, GauntletLensState>, activeStep: string, extra?: Record<string, unknown>) => {
    if (isDefaultFramework) {
      return { gauntlet_lenses: updated, gauntlet_active_lens: activeStep, ...extra };
    }
    const existingData = currentProject?.manifest?.framework_data || {};
    const existingFw = existingData[activeFrameworkId] || { frameworkId: activeFrameworkId };
    return {
      framework_data: {
        ...existingData,
        [activeFrameworkId]: {
          ...existingFw,
          gauntlet_lenses: updated,
          gauntlet_active_lens: activeStep,
        },
      },
      ...extra,
    };
  }, [isDefaultFramework, activeFrameworkId, currentProject]);

  // Dependency checking: check if all upstream steps are resolved
  const getUnresolvedDependencies = useCallback((stepId: string): string[] => {
    const dependencies = framework.upstreamDependencies[stepId] || [];
    return dependencies.filter(depId => {
      const depState = lensStates[depId];
      return !depState || depState.status !== 'resolved';
    });
  }, [lensStates, framework]);

  const canRunLens = useCallback((stepId: string): boolean => {
    return getUnresolvedDependencies(stepId).length === 0;
  }, [getUnresolvedDependencies]);

  // Dirty state tracking
  const dirtyLenses = currentProject?.manifest ? getDirtyLenses(currentProject.manifest) : [];
  const dirtyLensIds = new Set(dirtyLenses.map(d => d.lensId));
  const currentLensDirty = dirtyLenses.find(d => d.lensId === activeLens);

  // Abort stale async chains: incremented on project/lens change or unmount
  const runSessionRef = useRef(0);

  // Sync with step query param changes (e.g., from War Room heatmap clicks)
  useEffect(() => {
    if (stepParam && stepOrder.includes(stepParam)) {
      setActiveLens(stepParam);
    }
  }, [stepParam, stepOrder]);

  // Reset local state and cancel in-flight chains when project ID changes
  useEffect(() => {
    runSessionRef.current += 1;
    hasHydratedRef.current = false; // Allow re-hydration for new project
    setLensStates({});
    setIsProcessing(false);
    setIsRegenerating(false);
    setError(null);
    setActiveLens(initialLens);
    if (id) loadProject(id);
    return () => { runSessionRef.current += 1; }; // cancel on unmount
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate lens states from manifest (or clear if none)
  // Only restore activeLens on INITIAL load (not during background chain updates)
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (!currentProject) return;
    const manifestLenses = getManifestLensStates();
    if (manifestLenses) {
      setLensStates(manifestLenses);
      // Restore persisted gap report for the CURRENT active lens (not the manifest's)
      const currentLens = activeLensRef.current;
      const lensState = manifestLenses[currentLens];
      if (lensState?.gapReport) {
        setGapReport(lensState.gapReport);
      }
    } else {
      setLensStates({});
    }
    // Only restore saved active lens on FIRST hydration or when there's no step param.
    // Skip if a debate chain is running (isProcessing) to prevent snapping the user away.
    const savedActiveLens = getManifestActiveLens();
    if (!hasHydratedRef.current && !stepParam && savedActiveLens) {
      setActiveLens(savedActiveLens);
    }
    hasHydratedRef.current = true;
  }, [currentProject, activeFrameworkId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get current lens state — defensive: ensure status is always valid
  const rawLensState = lensStates[activeLens];
  const currentLensState: GauntletLensState = rawLensState && rawLensState.status
    ? rawLensState
    : { status: 'pending' as const };

  // Helper: switch to a lens and restore its persisted gap report (if any)
  const switchToLens = useCallback((lensId: LensId) => {
    setActiveLens(lensId);
    setShowIdeaPanel(false);
    setPreviousGapReport(null);
    const state = lensStates[lensId];
    setGapReport(state?.gapReport || null);
  }, [lensStates]);

  // Debug: Log whenever currentLensState changes
  useEffect(() => {
    console.log('[Gauntlet] currentLensState changed:', {
      activeLens,
      status: currentLensState.status,
      userEditPreview: currentLensState.userEdit?.substring(0, 100),
      proposalPreview: currentLensState.proposal?.substring(0, 100),
    });
  }, [activeLens, currentLensState]);

  // Persist lens state changes — uses refs to avoid stale closures in async chains
  const persistLensState = useCallback(async (lensId: string, state: GauntletLensState, extra?: Record<string, unknown>) => {
    console.log('[Gauntlet] persistLensState called:', {
      lensId,
      framework: activeFrameworkIdRef.current,
      oldState: lensStatesRef.current[lensId]?.userEdit?.substring(0, 50),
      newState: state.userEdit?.substring(0, 50),
    });
    // Read the LATEST lens states from the ref, not the stale closure
    const updated = { ...lensStatesRef.current, [lensId]: state };
    setLensStates(updated);
    console.log('[Gauntlet] setLensStates called with new state');
    // Use the ref for active lens so background chains don't hijack user navigation
    const payload = buildPersistPayload(updated, activeLensRef.current, extra);
    await updateManifest(payload);
    console.log('[Gauntlet] updateManifest completed');
  }, [updateManifest, buildPersistPayload]);

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
      const result: LensProposalResult = await generateStepProposal(
        framework,
        activeLens,
        currentProject.manifest || {},
        getPitch(),
        activeLens === 'people' ? currentProject.manifest?.gauntlet_people_input : undefined,
        undefined,
        lensStates
      );

      console.log('[Gauntlet] API returned result:', result);

      // Neutral pipeline: proposals always succeed.
      // Legacy safety: if old Langfuse prompts return gap_detected, log and treat as content.
      if (result.status === 'gap_detected') {
        console.warn('[Gauntlet] Legacy gap_detected received during neutral pipeline — treating as content');
      }

      const content = result.status === 'gap_detected'
        ? (result.gapReport?.reason || 'Draft could not be generated')
        : result.content;

      let newState: GauntletLensState;
      if (framework.stepBehaviors?.[activeLens]?.multiSelect) {
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
    // START SESSION: Generate a new Langfuse session ID for this debate
    const sessionId = crypto.randomUUID();
    const state: GauntletLensState = {
      ...currentLensState,
      status: 'attacking',
      debatePoints: [],
      debateStatus: 'attacking',
      gapReport: undefined, // Explicitly clear persisted gap report from previous debate
      sessionId
    };
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
      const points = await generateCritiquePointsForFramework(
        framework,
        activeLens,
        currentProject?.manifest || {},
        state.userEdit || state.proposal || '',
        getPitch(),
        state.sessionId,
        lensStates
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
      const defended = await generateAllDefensesForFramework(
        framework,
        activeLens,
        currentProject?.manifest || {},
        state.userEdit || state.proposal || '',
        getPitch(),
        points,
        state.sessionId,
        lensStates
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
      const judged = await adjudicateAllPointsForFramework(
        framework,
        activeLens,
        currentProject?.manifest || {},
        state.userEdit || state.proposal || '',
        points,
        state.sessionId,
        lensStates
      );
      if (s !== runSessionRef.current) return; // stale — abort

      // === POST-JURY GAP REPORT CHECK ===
      // If any high-severity point was lost, the Jury issues a Gap Report
      // instead of resolving the lens.
      if (shouldIssueGapReport(activeLens, judged)) {
        console.log('[Gauntlet] Jury issuing gap report for:', activeLens);
        try {
          const juryGapReport = await generateJuryGapReport(
            activeLens,
            currentProject?.manifest || {},
            state.userEdit || state.proposal || '',
            judged,
            state.sessionId
          );
          if (s !== runSessionRef.current) return; // stale — abort

          // Persist debate points AND gap report — keep lens in editing status
          const gapState: GauntletLensState = {
            ...state,
            status: 'editing',
            debatePoints: judged,
            debateStatus: 'resolved',
            lensScore: calculateLensScore(judged),
            gapReport: juryGapReport,
          };
          // Use refs to avoid stale closure
          const updated = { ...lensStatesRef.current, [activeLens]: gapState };
          setLensStates(updated);
          await updateManifest(buildPersistPayload(updated, activeLensRef.current));

          // Show the gap report UI
          setGapReport(juryGapReport);
          return;
        } catch (gapErr) {
          console.error('[Gauntlet] Failed to generate jury gap report, resolving normally:', gapErr);
          // Fall through to normal resolution if gap report generation fails
        }
      }

      const score = calculateLensScore(judged);
      const resolvedText = state.userEdit || state.proposal || '';
      const newState: GauntletLensState = {
        ...state,
        status: 'resolved',
        debatePoints: judged,
        debateStatus: 'resolved',
        lensScore: score,
        resolvedAt: new Date().toISOString(),
      };

      // === CONTEXT SYNCER: Auto-sync resolved lens to manifest fields ===
      // This enables downstream lenses to reference committed upstream decisions
      const syncFields = getLensSyncFields(activeLens, resolvedText);

      // Persist lens state AND sync fields in one update — use refs for fresh state
      const updated = { ...lensStatesRef.current, [activeLens]: newState };
      setLensStates(updated);
      await updateManifest(buildPersistPayload(updated, activeLensRef.current, syncFields));

      // === COMPETITOR SCOUT: Fire-and-forget after market/monopoly step resolves ===
      const scoutTriggerSteps = ['monopoly', 'market'];
      if (scoutTriggerSteps.includes(activeLens) && currentProject?.manifest) {
        const scoutManifest = { ...currentProject.manifest, ...syncFields };
        runCompetitorScout(scoutManifest, state.sessionId)
          .then(report => {
            console.log('[Scout] Competitor report received:', report.competitors.length, 'competitors');
            updateManifest({
              competitor_report: report,
              scout_competitors: report.competitors,
            });
          })
          .catch(err => console.error('[Scout] failed:', err));
      }
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
      const result = await generateStepProposal(
        framework,
        activeLens,
        currentProject?.manifest || {},
        getPitch(),
        formattedInput,
        undefined,
        lensStates
      );
      // Neutral pipeline: all lenses return success
      const proposal = result.status === 'success' ? result.content : 'Draft could not be generated';
      const newState: GauntletLensState = { status: 'editing', proposal, userEdit: proposal };
      await persistLensState(activeLens, newState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proposal');
    } finally {
      setIsProcessing(false);
    }
  };

  // Navigate to next/prev lens
  const navigateLens = (direction: 'next' | 'prev') => {
    const idx = stepOrder.indexOf(activeLens);
    if (direction === 'next' && idx < stepOrder.length - 1) {
      switchToLens(stepOrder[idx + 1]);
    } else if (direction === 'prev' && idx > 0) {
      switchToLens(stepOrder[idx - 1]);
    }
  };

  // Check completion
  const resolvedCount = stepOrder.filter(l => lensStates[l]?.status === 'resolved').length;
  const isAllResolved = resolvedCount === stepOrder.length;
  const hasEarlyExit = !!currentProject?.manifest?.early_exit_reason;
  const canEnterWarRoom = isAllResolved || hasEarlyExit || resolvedCount > 0;

  // Handle "Enter War Room" (proceed to final view)
  const handleComplete = () => {
    if (currentProject) {
      navigate(`/projects/${currentProject.id}`);
    }
  };

  // Check for chain reaction when attempting to rerun a lens
  const handleRerunRequest = (lensId: string, mode: RerunMode) => {
    const chainReaction = calculateChainReactionForFramework(lensId, framework, lensStates);
    if (chainReaction.affectedLenses.length > 0) {
      setPendingRerunMode(mode);
      setChainReactionWarning(chainReaction);
    } else {
      executeRerun(lensId, mode);
    }
  };

  // Execute the actual rerun with cascade invalidation
  const executeRerun = async (lensId: string, mode: RerunMode) => {
    const currentState = lensStates[lensId];

    if (mode === 'full') {
      // Full re-run: reset to editing, clear all debate data
      const newState: GauntletLensState = {
        ...currentState,
        status: 'editing',
        debatePoints: undefined,
        debateStatus: undefined,
        lensScore: undefined,
        kScore: undefined,
        resolvedAt: undefined,
      };

      const updated = { ...lensStates, [lensId]: newState };
      setLensStates(updated);
      await updateManifest(buildPersistPayload(updated, lensId));
    } else if (mode === 'visionary-jury') {
      // Keep critique points, strip defense + verdict, re-run from defending
      const session = ++runSessionRef.current;
      const sessionId = crypto.randomUUID();
      const strippedPoints = (currentState.debatePoints || []).map(p => ({
        ...p,
        defense: undefined,
        verdict: undefined,
      }));

      const newState: GauntletLensState = {
        ...currentState,
        status: 'defending',
        debatePoints: strippedPoints,
        debateStatus: 'defending',
        lensScore: undefined,
        kScore: undefined,
        resolvedAt: undefined,
        sessionId,
      };

      const updated = { ...lensStates, [lensId]: newState };
      setLensStates(updated);
      setIsProcessing(true);
      await updateManifest(buildPersistPayload(updated, lensId));

      // Auto-start defense phase (which auto-chains to judging)
      await handleRunDefense(newState, session);
    } else if (mode === 'jury-only') {
      // Keep critiques + defenses, strip verdict, re-run from judging
      const session = ++runSessionRef.current;
      const sessionId = crypto.randomUUID();
      const strippedPoints = (currentState.debatePoints || []).map(p => ({
        ...p,
        verdict: undefined,
      }));

      const newState: GauntletLensState = {
        ...currentState,
        status: 'judging',
        debatePoints: strippedPoints,
        debateStatus: 'judging',
        lensScore: undefined,
        kScore: undefined,
        resolvedAt: undefined,
        sessionId,
      };

      const updated = { ...lensStates, [lensId]: newState };
      setLensStates(updated);
      setIsProcessing(true);
      await updateManifest(buildPersistPayload(updated, lensId));

      // Auto-start judging phase
      await handleRunJudging(newState, session);
    }

    setChainReactionWarning(null);
  };

  if (isProjectLoading && id) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const lensConfig = stepMap.get(activeLens) || framework.steps[0];
  const LensIcon = getIconForStep(lensConfig.icon);
  const activeLensIdx = stepOrder.indexOf(activeLens);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/60 bg-zinc-950 sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">The Gauntlet</h1>
              <p className="text-[11px] text-zinc-500">{currentProject?.title || 'Untitled'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">{resolvedCount}/{stepOrder.length} lenses cleared</span>
            <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-green-500 transition-all duration-500"
                style={{ width: `${(resolvedCount / stepOrder.length) * 100}%` }}
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
                    setActiveLens(stepOrder[0]);
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

      {/* Framework tabs — shown when multiple frameworks selected */}
      {hasMultipleFrameworks && (
        <div className="border-b border-zinc-800/60 bg-zinc-900/40 px-6 flex items-center gap-1">
          {frameworkIds.map(fwId => {
            const fw = FrameworkRegistry.get(fwId);
            if (!fw) return null;
            const FwIcon = getIconForStep(fw.icon);
            const isActive = fwId === activeFrameworkId;
            return (
              <button
                key={fwId}
                onClick={() => {
                  if (fwId !== activeFrameworkId) {
                    hasHydratedRef.current = false;
                    setActiveFrameworkId(fwId);
                    setLensStates({});
                    setGapReport(null);
                    setPreviousGapReport(null);
                    setError(null);
                    setShowIdeaPanel(false);
                  }
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'border-cyan-500 text-zinc-100'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                )}
              >
                <FwIcon className={cn('w-3.5 h-3.5', isActive ? fw.color : '')} />
                {fw.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 flex">
        {/* Left: Lens Navigation */}
        <nav className="w-56 border-r border-zinc-800/60 flex flex-col py-3">
          {/* Idea tab */}
          <button
            onClick={() => setShowIdeaPanel(true)}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 text-left transition-colors w-full mb-1',
              showIdeaPanel
                ? 'bg-zinc-800/60 border-r-2 border-r-amber-400'
                : 'hover:bg-zinc-800/30',
            )}
          >
            <div className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
              showIdeaPanel ? 'bg-amber-500/10' : 'bg-zinc-800/50'
            )}>
              <FileText className={cn('w-3.5 h-3.5', showIdeaPanel ? 'text-amber-400' : 'text-zinc-500')} />
            </div>
            <span className={cn(
              'text-xs font-medium',
              showIdeaPanel ? 'text-zinc-200' : 'text-zinc-400'
            )}>
              Idea
            </span>
          </button>

          <div className="h-px bg-zinc-800/40 mx-4 mb-1" />

          {stepOrder.map((lensId, idx) => {
            const config = stepMap.get(lensId)!;
            const Icon = getIconForStep(config.icon);
            const state = lensStates[lensId];
            const status: GauntletLensStatus = state?.status || 'pending';
            const StatusIcon = STATUS_ICONS[status];
            const isActive = lensId === activeLens;
            const isBlocked = !canRunLens(lensId) && status === 'pending';

            return (
              <button
                key={lensId}
                onClick={() => switchToLens(lensId)}
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
                {stepOrder.filter(l => lensStates[l]?.status === 'resolved').map(lensId => {
                  const s = lensStates[lensId];
                  const score = s?.lensScore ?? s?.kScore ?? 0;
                  return (
                    <div key={lensId} className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">{stepMap.get(lensId)?.title || lensId}</span>
                      <span className={cn(
                        'text-[11px] font-mono',
                        score >= 70 ? 'text-green-400' :
                          score >= 50 ? 'text-amber-400' :
                            'text-red-400'
                      )}>
                        {score || '--'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Right: Active Lens Content */}
        <ErrorBoundary fallbackMessage="This lens encountered an error">
        <div className="flex-1 flex flex-col overflow-hidden">
          {showIdeaPanel ? (
            <>
              {/* Idea Panel Header */}
              <div className="px-6 py-4 border-b border-zinc-800/40">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-200">Idea</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">{currentProject?.title || 'Untitled'}</p>
                  </div>
                </div>
              </div>

              {/* Idea Panel Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/30">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Vision</span>
                    <p className="text-sm text-zinc-200 mt-2 whitespace-pre-wrap leading-relaxed">
                      {currentProject?.manifest?.refined_vision
                        || currentProject?.manifest?.raw_vision
                        || currentProject?.pitch
                        || currentProject?.title
                        || 'No idea text available.'}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/forge/${id}`)}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    Edit in Forge
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
          {/* Lens Header */}
          <div className="px-6 py-4 border-b border-zinc-800/40">
            <div className="flex items-center gap-3">
              <LensIcon className={cn('w-5 h-5', lensConfig.color)} />
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">
                  Lens {activeLensIdx + 1}: {lensConfig.title} — {lensConfig.subtitle}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">{lensConfig.question}</p>
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
                      lensScore: undefined,
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
              <div className="max-w-3xl mx-auto space-y-6">
                {/* 1. Proposal at the very top */}
                {(currentLensState.userEdit || currentLensState.proposal) && (
                  <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Proposal</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateProposal}
                        disabled={isRegenerating}
                        className="text-zinc-500 hover:text-zinc-300 h-7"
                      >
                        {isRegenerating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            Regenerate Proposal
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {currentLensState.userEdit || currentLensState.proposal}
                    </p>
                  </div>
                )}

                {/* 2. Lens score with re-run debate, then debate points */}
                {currentLensState.debatePoints && currentLensState.debatePoints.length > 0 && (
                  <>
                    {/* Lens score row + re-run button */}
                    {(() => {
                      const pts = currentLensState.debatePoints;
                      const judgedCount = pts.filter(p => p.verdict).length;
                      if (judgedCount === 0) return null;
                      const score = currentLensState.lensScore ?? currentLensState.kScore ?? calculateLensScore(pts);
                      return (
                        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                          <div className="flex items-center gap-2">
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-300">
                                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                Re-run Debate
                                <ChevronDown className="w-3 h-3 ml-1.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72">
                              <DropdownMenuItem onClick={() => handleRerunRequest(activeLens, 'full')} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
                                <span className="text-xs font-medium text-zinc-200">Full Re-run</span>
                                <span className="text-[10px] text-zinc-500">Regenerate all debate phases from scratch</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRerunRequest(activeLens, 'visionary-jury')} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
                                <span className="text-xs font-medium text-zinc-200">Re-run Defense + Jury</span>
                                <span className="text-[10px] text-zinc-500">Keep critiques, regenerate defense and verdict</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRerunRequest(activeLens, 'jury-only')} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
                                <span className="text-xs font-medium text-zinc-200">Re-run Jury Only</span>
                                <span className="text-[10px] text-zinc-500">Keep critiques and defenses, regenerate verdict only</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })()}
                    <DebateTable points={currentLensState.debatePoints} hideScoreSummary />
                  </>
                )}

                {/* 3. Gap report + hypotheses */}
                <GapReportCard
                  gapReport={gapReport}
                  onForceHypothesis={handleForceFromHypothesis}
                />
              </div>
            )}

            {/* PENDING STATE */}
            {currentLensState.status === 'pending' && !gapReport && (
              <LensPendingState
                lensId={activeLens}
                isProcessing={isProcessing}
                isRegenerating={isRegenerating}
                onStart={framework.stepBehaviors?.[activeLens]?.requiresInput ? undefined : handleGenerateProposal}
                onPeopleSubmit={framework.stepBehaviors?.[activeLens]?.requiresInput ? handlePeopleSubmit : undefined}
                peopleInput={currentProject?.manifest?.gauntlet_people_input}
                unresolvedDependencies={getUnresolvedDependencies(activeLens)}
                canRun={canRunLens(activeLens)}
                stepConfig={lensConfig}
                framework={framework}
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
                showBackToSelection={!!framework.stepBehaviors?.[activeLens]?.multiSelect && !!currentLensState.proposals?.length}
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
                downstreamLenses={getDownstreamSteps(activeLens, framework).filter(
                  l => lensStates[l]?.status === 'resolved'
                )}
                onRerun={(mode) => handleRerunRequest(activeLens, mode)}
                framework={framework}
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
              {activeLensIdx + 1} of {stepOrder.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={activeLensIdx === stepOrder.length - 1}
              onClick={() => navigateLens('next')}
              className="text-zinc-400"
            >
              Next
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
            </>
          )}
        </div>
        </ErrorBoundary>
      </div>

      {/* Chain Reaction Warning Modal */}
      {chainReactionWarning && (
        <ChainReactionModal
          chainReaction={chainReactionWarning}
          onConfirm={() => executeRerun(chainReactionWarning.modifiedLens, pendingRerunMode)}
          onCancel={() => setChainReactionWarning(null)}
          framework={framework}
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
  lensConfig: StepDefinition;
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
            className="group relative flex flex-col p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-left transition-all hover:border-zinc-600 hover:bg-zinc-900/60"
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
  stepConfig,
  framework,
}: {
  lensId: string;
  isProcessing: boolean;
  isRegenerating?: boolean;
  onStart?: () => void;
  onPeopleSubmit?: (input: string) => void;
  peopleInput?: string;
  unresolvedDependencies?: string[];
  canRun?: boolean;
  stepConfig: StepDefinition;
  framework: FrameworkDefinition;
}) {
  const behavior = framework.stepBehaviors?.[lensId];
  const requiresInput = behavior?.requiresInput;

  // People-like lens uses isProcessing (from handlePeopleSubmit)
  // Other lenses use isRegenerating (from handleGenerateProposal)
  const isGenerating = requiresInput ? isProcessing : isRegenerating;

  if (requiresInput && onPeopleSubmit) {
    // Show dependency blocker too
    if (!canRun && unresolvedDependencies.length > 0) {
      return (
        <div className="max-w-2xl mx-auto">
          <DependencyBlocker lensId={lensId} unresolvedDependencies={unresolvedDependencies} framework={framework} />
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

  const config = stepConfig;

  // Show dependency blocker if lens cannot run yet
  if (!canRun && unresolvedDependencies.length > 0) {
    return <DependencyBlocker lensId={lensId} unresolvedDependencies={unresolvedDependencies} framework={framework} />;
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mb-4', config.bgColor, 'border', config.borderColor)}>
        <Sparkles className={cn('w-6 h-6', config.color)} />
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
  framework,
}: {
  lensId: string;
  unresolvedDependencies: string[];
  framework: FrameworkDefinition;
}) {
  const fwStepMap = useMemo(() => new Map(framework.steps.map(s => [s.id, s])), [framework]);
  const config = fwStepMap.get(lensId) || framework.steps[0];
  const Icon = getIconForStep(config.icon);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-zinc-800/50 border border-zinc-700/50')}>
        <Icon className="w-6 h-6 text-zinc-500" />
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
            const depConfig = fwStepMap.get(depId) || framework.steps[0];
            const DepIcon = getIconForStep(depConfig.icon);
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
  showBackToSelection?: boolean;
  onBackToSelection?: () => void;
  showBackToHypotheses?: boolean;
  onBackToHypotheses?: () => void;
}) {
  const isModified = userEdit !== proposal;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Navigation back buttons */}
      {(showBackToSelection || showBackToHypotheses) && (
        <div className="flex items-center gap-2">
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
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back to Hypotheses
            </Button>
          )}
        </div>
      )}

      {/* Textarea with regenerate tucked under it */}
      <div>
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <textarea
            value={userEdit}
            onChange={e => onEdit(e.target.value)}
            className="w-full h-48 bg-zinc-900/50 text-zinc-200 text-sm leading-relaxed p-4 resize-none outline-none"
            placeholder="Edit the proposal..."
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 text-[11px] text-zinc-600">
            {isModified && <span className="text-amber-400">(modified)</span>}
          </div>
          {/* Regenerate — right-aligned, directly under the textarea */}
          {onRegenerate && !showBackToHypotheses && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                console.log('[LensEditingState] Regenerate button clicked');
                onRegenerate();
              }}
              disabled={isRegenerating || isProcessing}
              className="text-xs text-zinc-500 hover:text-zinc-300 h-7"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Regenerate Proposal
                </>
              )}
            </Button>
          )}
        </div>
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
  onResume,
}: {
  points: DebatePoint[];
  userEdit: string;
  isProcessing: boolean;
  debateStatus: string;
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
      <div className="border border-zinc-800 rounded-lg p-4 text-xs bg-zinc-900/30">
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
  onRerun,
  downstreamLenses,
  framework,
}: {
  lensState: GauntletLensState;
  lensConfig: StepDefinition;
  onRerun: (mode: RerunMode) => void;
  downstreamLenses: string[];
  framework: FrameworkDefinition;
}) {
  const points = lensState.debatePoints || [];
  const score = lensState.lensScore ?? lensState.kScore ?? 0;
  const visionaryWins = points.filter(p => p.verdict?.winner === 'visionary').length;
  const skepticWins = points.filter(p => p.verdict?.winner === 'skeptic').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Resolved badge + Re-run dropdown */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-green-400">Lens Resolved</h3>
            <p className="text-xs text-zinc-500">
              Lens Score: <span className={cn(
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

        {/* Re-run dropdown — top-right, always visible */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-300">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Re-run Debate
              <ChevronDown className="w-3 h-3 ml-1.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuItem onClick={() => onRerun('full')} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
              <span className="text-xs font-medium text-zinc-200">Full Re-run</span>
              <span className="text-[10px] text-zinc-500">Regenerate all debate phases from scratch</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRerun('visionary-jury')} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
              <span className="text-xs font-medium text-zinc-200">Re-run Defense + Jury</span>
              <span className="text-[10px] text-zinc-500">Keep critiques, regenerate defense and verdict</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRerun('jury-only')} className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
              <span className="text-xs font-medium text-zinc-200">Re-run Jury Only</span>
              <span className="text-[10px] text-zinc-500">Keep critiques and defenses, regenerate verdict only</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Legacy monopoly lens detection */}
      {lensConfig.id === 'monopoly' &&
        (lensState.userEdit || lensState.proposal || '').includes('<1,000') && (
          <div className="mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300">
            This analysis uses the legacy &lt;1,000 standard. Re-debate to apply the new Dominatability Standard.
          </div>
        )}

      {/* Final answer */}
      <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
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
              {downstreamLenses.map(l => {
                const s = framework.steps.find(step => step.id === l);
                return s?.title || l;
              }).join(', ')}
            </span>
          </div>
        </div>
      )}

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
  onForceHypothesis,
}: {
  gapReport: GapReport;
  onForceHypothesis: (hypothesis: string) => void;
}) {
  return (
    <>
      {/* Gap Report Header */}
      <div className="px-4 py-3 bg-orange-500/5 border border-orange-500/20 rounded-lg space-y-1.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
          <span className="text-sm font-medium text-orange-300">
            Missing: {gapReport.missing_element}
          </span>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed pl-6">
          {gapReport.reason}
        </p>
      </div>

      {/* Hypotheses Section */}
      <div className="space-y-3">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Strategic Pivots
        </span>

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
                className="group flex items-start gap-4 p-4 bg-zinc-900/40 border border-zinc-800 rounded-lg text-left transition-all hover:border-zinc-600 hover:bg-zinc-900/60"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 group-hover:bg-zinc-700">
                  <span className="text-xs font-bold text-zinc-400">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-zinc-200 block mb-1">
                    {mechanismName}
                  </span>
                  <span className="text-xs text-zinc-500 group-hover:text-zinc-400">
                    {description || 'Click to explore this direction'}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-1" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Helper text */}
      <div className="text-center">
        <span className="text-[10px] text-zinc-600">
          Select a pivot above to continue, or regenerate the proposal
        </span>
      </div>
    </>
  );
}

// =============================================================================
// CHAIN REACTION WARNING MODAL
// =============================================================================

function ChainReactionModal({
  chainReaction,
  onConfirm,
  onCancel,
  framework,
}: {
  chainReaction: ChainReaction;
  onConfirm: () => void;
  onCancel: () => void;
  framework: FrameworkDefinition;
}) {
  const fwStepMap = useMemo(() => new Map(framework.steps.map(s => [s.id, s])), [framework]);
  const modifiedConfig = fwStepMap.get(chainReaction.modifiedLens) || framework.steps[0];

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
              const config = fwStepMap.get(lensId) || framework.steps[0];
              const Icon = getIconForStep(config.icon);
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
