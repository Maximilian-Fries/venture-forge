import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DebatePanel } from "./DebatePanel";
import { ConflictToggle } from "./ConflictToggle";
import { LENS_TYPES, type LensType } from "@/lib/prompts";
import { cn } from "@/lib/utils";

interface LensData {
  userInput: string;
  visionaryOutput: string;
  skepticOutput: string;
  userChoice: "visionary" | "skeptic" | null;
}

interface LensWizardProps {
  onComplete: (data: Record<LensType, LensData>, secretText: string) => void;
}

export function LensWizard({ onComplete }: LensWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [lensData, setLensData] = useState<Record<string, LensData>>(
    Object.fromEntries(
      LENS_TYPES.map((lens) => [
        lens.id,
        { userInput: "", visionaryOutput: "", skepticOutput: "", userChoice: null },
      ])
    )
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingAgent, setLoadingAgent] = useState<"visionary" | "skeptic" | null>(null);

  const currentLens = LENS_TYPES[currentStep];
  const currentData = lensData[currentLens.id];

  const handleInputChange = (value: string) => {
    setLensData((prev) => ({
      ...prev,
      [currentLens.id]: { ...prev[currentLens.id], userInput: value },
    }));
  };

  const handleGenerate = async () => {
    if (!currentData.userInput.trim()) return;

    setIsGenerating(true);
    
    // Simulate AI generation - in production this would call the AI
    setLoadingAgent("visionary");
    await new Promise((r) => setTimeout(r, 1500));
    
    const mockVisionary = `**Contrarian Thesis**: This approach to ${currentLens.name.toLowerCase()} represents a genuine "0 to 1" opportunity.\n\n1. **Unique Insight**: The founder sees something others miss - this isn't incremental improvement but category creation.\n\n2. **Timing Advantage**: Market conditions have shifted, creating a window that larger players are too slow to exploit.\n\n3. **Compounding Moat**: Early market dominance in this wedge creates defensibility through network effects and switching costs.`;

    setLensData((prev) => ({
      ...prev,
      [currentLens.id]: { ...prev[currentLens.id], visionaryOutput: mockVisionary },
    }));

    setLoadingAgent("skeptic");
    await new Promise((r) => setTimeout(r, 1200));

    const mockSkeptic = `**Red Flags Identified:**\n\n🚩 **High** - Hidden Incumbent Risk: Larger players could pivot into this space with existing resources and distribution.\n\n🚩 **Medium** - Timing Trap: The "why now" thesis may be wishful thinking rather than structural change.\n\n🚩 **Low** - Defensibility Gap: The moat described may be narrower than presented.`;

    setLensData((prev) => ({
      ...prev,
      [currentLens.id]: { ...prev[currentLens.id], skepticOutput: mockSkeptic },
    }));

    setLoadingAgent(null);
    setIsGenerating(false);
  };

  const handleChoice = (choice: "visionary" | "skeptic" | null) => {
    setLensData((prev) => ({
      ...prev,
      [currentLens.id]: { ...prev[currentLens.id], userChoice: choice },
    }));
  };

  const handleNext = () => {
    if (currentStep < LENS_TYPES.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Wizard complete - pass the secret text to Investigator
      const secretData = lensData["secret"];
      onComplete(lensData as Record<LensType, LensData>, secretData?.userInput || "");
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = currentData.userChoice !== null || (!currentData.visionaryOutput && !currentData.skepticOutput);

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-8">
        {LENS_TYPES.map((lens, index) => (
          <div
            key={lens.id}
            className="flex items-center"
          >
            <button
              onClick={() => setCurrentStep(index)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 font-medium text-sm",
                index === currentStep
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : index < currentStep && lensData[lens.id].userChoice
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              {index < currentStep && lensData[lens.id].userChoice ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                index + 1
              )}
            </button>
            {index < LENS_TYPES.length - 1 && (
              <div
                className={cn(
                  "w-12 md:w-20 h-0.5 mx-2 transition-colors duration-300",
                  index < currentStep ? "bg-accent" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Current lens content */}
      <div className="space-y-6 animate-fade-in" key={currentLens.id}>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            {currentStep + 1}. {currentLens.name}
          </h2>
          <p className="text-muted-foreground">{currentLens.description}</p>
        </div>

        {/* User input */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Describe your approach to {currentLens.name.toLowerCase()}:
          </label>
          <Textarea
            value={currentData.userInput}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={`Enter your thoughts on ${currentLens.name.toLowerCase()}...`}
            className="min-h-[120px] bg-input border-border focus:border-primary resize-none"
          />
        </div>

        {/* Generate button */}
        <div className="flex justify-center">
          <Button
            variant="visionary"
            size="lg"
            onClick={handleGenerate}
            disabled={!currentData.userInput.trim() || isGenerating}
          >
            <Sparkles className="w-4 h-4" />
            Generate Debate
          </Button>
        </div>

        {/* Debate panels */}
        <DebatePanel
          visionaryOutput={currentData.visionaryOutput}
          skepticOutput={currentData.skepticOutput}
          isLoading={isGenerating}
          loadingAgent={loadingAgent}
        />

        {/* Conflict toggle */}
        {(currentData.visionaryOutput || currentData.skepticOutput) && (
          <div className="space-y-3 pt-4">
            <p className="text-center text-sm text-muted-foreground">
              Who won this debate? Your judgment affects the Monopoly Score.
            </p>
            <ConflictToggle
              onChoice={handleChoice}
              defaultValue={currentData.userChoice}
              disabled={isGenerating}
            />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <span className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {LENS_TYPES.length}
        </span>

        <Button
          variant={currentStep === LENS_TYPES.length - 1 ? "visionary" : "default"}
          onClick={handleNext}
          disabled={!canProceed && (currentData.visionaryOutput || currentData.skepticOutput) !== ""}
        >
          {currentStep === LENS_TYPES.length - 1 ? "Complete & Validate" : "Next"}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
