import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useProjectManifest, useManifest } from "@/hooks/useProjectManifest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/Header";
import { LensWizard } from "@/components/LensWizard";
import { PitchRefinement } from "@/components/PitchRefinement";
import { MomTestLab } from "@/components/MomTestLab";
import { MonopolyChart } from "@/components/MonopolyChart";
import { ContrarianIndex } from "@/components/ContrarianIndex";
import { cn } from "@/lib/utils";

type Phase = "pitch" | "refining" | "wizard" | "validation" | "complete";

interface LensDataItem {
  userChoice?: "visionary" | "skeptic";
}

type LensData = Record<string, LensDataItem>;

// localStorage keys for NewIdea state persistence
const STORAGE_KEY_PHASE = 'venture_newidea_phase';
const STORAGE_KEY_TITLE = 'venture_newidea_title';
const STORAGE_KEY_PITCH = 'venture_newidea_pitch';

// Helper to safely get from localStorage
const getStoredValue = (key: string, defaultValue: string = ""): string => {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch {
    return defaultValue;
  }
};

const getStoredPhase = (): Phase => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PHASE);
    if (stored && ["pitch", "refining", "wizard", "validation", "complete"].includes(stored)) {
      return stored as Phase;
    }
  } catch {
    // ignore
  }
  return "pitch";
};

const NewIdea = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { currentProject, loadProject, createProject, isLoading: isProjectLoading } = useProjectManifest();
  const manifest = useManifest();

  // Initialize from localStorage for immediate restore on refresh
  const [phase, setPhase] = useState<Phase>(() => projectId ? "pitch" : getStoredPhase());
  const [isInitialized, setIsInitialized] = useState(false);
  const [ideaTitle, setIdeaTitle] = useState(() => projectId ? "" : getStoredValue(STORAGE_KEY_TITLE));
  const [rawPitch, setRawPitch] = useState(() => projectId ? "" : getStoredValue(STORAGE_KEY_PITCH));
  const [lockedPitch, setLockedPitch] = useState("");
  const [secretText, setSecretText] = useState("");
  const [scores, setScores] = useState({
    monopoly: 0,
    wedge: 15,
    engineering: 0,
    secret: 0,
    skepticFlags: 0,
    contrarian: 0,
  });

  // Load project from URL param if editing existing project
  useEffect(() => {
    if (projectId && !currentProject) {
      loadProject(projectId);
    }
  }, [projectId, currentProject, loadProject]);

  // Hydrate state from project manifest on mount (fixes page refresh reset)
  useEffect(() => {
    if (!currentProject || isInitialized) return;

    // Restore inputs
    if (currentProject.title) setIdeaTitle(currentProject.title);
    if (currentProject.pitch) setRawPitch(currentProject.pitch);

    // Restore phase based on progress
    if (manifest?.locked_description) {
      setLockedPitch(manifest.locked_description);
      setPhase("wizard");
    } else if (currentProject.pitch) {
      // If we have a pitch but not yet locked, go to refining phase
      // This fixes the "loop to start" bug on refresh
      setPhase("refining");
    }

    setIsInitialized(true);
  }, [currentProject, manifest, isInitialized]);

  // Persist state to localStorage (only when not using projectId route)
  useEffect(() => {
    if (projectId) return; // Don't persist when editing existing project
    try {
      localStorage.setItem(STORAGE_KEY_PHASE, phase);
    } catch { /* ignore */ }
  }, [phase, projectId]);

  useEffect(() => {
    if (projectId) return;
    try {
      localStorage.setItem(STORAGE_KEY_TITLE, ideaTitle);
    } catch { /* ignore */ }
  }, [ideaTitle, projectId]);

  useEffect(() => {
    if (projectId) return;
    try {
      localStorage.setItem(STORAGE_KEY_PITCH, rawPitch);
    } catch { /* ignore */ }
  }, [rawPitch, projectId]);

  const handlePitchSubmit = async () => {
    if (!ideaTitle.trim() || !rawPitch.trim()) return;

    // Create project in database if this is a new analysis
    if (!currentProject) {
      const newProjectId = await createProject(ideaTitle, rawPitch);
      if (newProjectId) {
        // Update URL to reflect the new project
        navigate(`/analyze/${newProjectId}`, { replace: true });
      }
    }

    setPhase("refining");
  };

  const handleRefinementComplete = (description: string) => {
    setLockedPitch(description);
    setPhase("wizard");
  };

  const handleWizardComplete = (lensData: LensData, secret: string) => {
    setSecretText(secret);

    // Calculate scores based on user choices
    let visionaryWins = 0;
    let skepticWins = 0;

    Object.values(lensData).forEach((data) => {
      if (data.userChoice === "visionary") visionaryWins++;
      if (data.userChoice === "skeptic") skepticWins++;
    });

    const engineering = lensData.engineering?.userChoice === "visionary" ? 75 : 35;
    const secretScore = lensData.secret?.userChoice === "visionary" ? 80 : 40;
    const flags = skepticWins;

    const monopolyScore = Math.round((visionaryWins / 5) * 100);
    const wedgePercent = Math.max(5, Math.min(30, 10 + visionaryWins * 4));
    const contrarianIndex = Math.max(0, Math.min(100, (engineering + secretScore) / 2 - flags * 5));

    setScores({
      monopoly: monopolyScore,
      wedge: wedgePercent,
      engineering,
      secret: secretScore,
      skepticFlags: flags,
      contrarian: Math.round(contrarianIndex),
    });

    setPhase("validation");
  };

  // Show loading state when loading project from URL
  if (projectId && isProjectLoading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      <Header showNewIdea={false} />

      <div className="container mx-auto px-4 py-8">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Phase: Initial Pitch */}
        {phase === "pitch" && (
          <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
            <div className="text-center space-y-3">
              <h1 className="text-3xl font-bold text-foreground">
                Start Your Venture Analysis
              </h1>
              <p className="text-muted-foreground">
                Enter your idea for multi-agent analysis. Our AI personas will debate its monopoly potential.
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Idea Title
                </label>
                <Input
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  placeholder="e.g., AI-Powered Legal Document Analysis"
                  className="bg-input border-border focus:border-primary"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Raw Pitch
                </label>
                <Textarea
                  value={rawPitch}
                  onChange={(e) => setRawPitch(e.target.value)}
                  placeholder="Describe your idea in 2-3 sentences. What problem does it solve? Who is it for? What makes it unique?"
                  className="min-h-[150px] bg-input border-border focus:border-primary resize-none"
                />
              </div>

              <Button
                variant="visionary"
                size="lg"
                className="w-full"
                onClick={handlePitchSubmit}
                disabled={!ideaTitle.trim()}
              >
                Refine with Venture Associate
              </Button>
            </div>
          </div>
        )}

        {/* Phase: Pitch Refinement */}
        {phase === "refining" && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-3xl font-bold text-foreground">
                Refine Your Thesis
              </h1>
              <p className="text-muted-foreground">
                Work with the Venture Associate to lock a "Zero to One" description.
              </p>
            </div>

            <PitchRefinement
              initialPitch={rawPitch}
              topic={ideaTitle}
              onComplete={handleRefinementComplete}
            />
          </div>
        )}

        {/* Phase: Wizard */}
        {phase === "wizard" && (
          <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="glass-panel rounded-2xl p-8">
              <LensWizard onComplete={handleWizardComplete} />
            </div>
          </div>
        )}

        {/* Phase: Validation */}
        {phase === "validation" && (
          <div className="max-w-6xl mx-auto animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column: Results */}
              <div className="lg:col-span-1 space-y-6">
                <div className="glass-panel rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">{ideaTitle}</h3>
                  <p className="text-sm text-muted-foreground mb-6">{rawPitch}</p>

                  <div className="w-48 h-48 mx-auto">
                    <MonopolyChart
                      totalMarket={100}
                      wedgePercent={scores.wedge}
                      score={scores.monopoly}
                    />
                  </div>
                </div>

                <ContrarianIndex
                  score={scores.contrarian}
                  engineeringScore={scores.engineering}
                  secretScore={scores.secret}
                  skepticFlags={scores.skepticFlags}
                />

                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => setPhase("complete")}
                >
                  Save & Complete Analysis
                </Button>
              </div>

              {/* Right column: Mom Test Lab */}
              <div className="lg:col-span-2">
                <div className="glass-panel rounded-2xl p-6">
                  <MomTestLab secretText={secretText} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase: Complete */}
        {phase === "complete" && (
          <div className="max-w-2xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-foreground">
                Analysis Complete!
              </h1>
              <p className="text-muted-foreground">
                Your venture thesis has been analyzed through all 5 lenses. The Investigator has prepared
                Mom Test questions for customer validation.
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 inline-block">
              <div className="grid grid-cols-2 gap-8 text-left">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monopoly Score</p>
                  <p className={cn("text-3xl font-bold", scores.monopoly >= 70 ? "text-accent" : scores.monopoly >= 40 ? "text-visionary" : "text-skeptic")}>
                    {scores.monopoly}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Contrarian Index</p>
                  <p className={cn("text-3xl font-bold", scores.contrarian >= 70 ? "text-accent" : scores.contrarian >= 40 ? "text-visionary" : "text-skeptic")}>
                    {scores.contrarian}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="hero" size="lg" onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </Button>
              <Button variant="outline" size="lg" onClick={() => {
                // Clear localStorage
                try {
                  localStorage.removeItem(STORAGE_KEY_PHASE);
                  localStorage.removeItem(STORAGE_KEY_TITLE);
                  localStorage.removeItem(STORAGE_KEY_PITCH);
                  localStorage.removeItem('venture_pitch_draft');
                  localStorage.removeItem('venture_chat_history');
                } catch { /* ignore */ }
                // Reset state
                setPhase("pitch");
                setIdeaTitle("");
                setRawPitch("");
                setSecretText("");
              }}>
                Analyze Another Idea
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewIdea;
