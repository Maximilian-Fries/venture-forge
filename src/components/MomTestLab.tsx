import { useState } from "react";
import { SearchCheck, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MomTestLabProps {
  secretText: string;
}

export function MomTestLab({ secretText }: MomTestLabProps) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    // Simulate AI generation - in production this would call the AI
    await new Promise((r) => setTimeout(r, 2000));

    const mockQuestions = [
      "Tell me about the last time you encountered this problem. Walk me through exactly what happened and what you did.",
      "What solutions have you tried so far? What worked and what didn't?",
      "How much time/money did you spend trying to solve this in the past month?",
      "Who else in your organization deals with this? What do they currently do about it?",
      "When you tried [current solution], what was the most frustrating part of that experience?",
    ];

    setQuestions(mockQuestions);
    setIsGenerating(false);
  };

  const copyQuestion = async (question: string, index: number) => {
    await navigator.clipboard.writeText(question);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-investigator/20 flex items-center justify-center">
          <SearchCheck className="w-6 h-6 text-investigator" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-foreground">Validation Lab</h3>
          <p className="text-sm text-muted-foreground">The Mom Test Question Generator</p>
        </div>
      </div>

      {/* Secret context */}
      {secretText && (
        <div className="glass-panel rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Your Secret (from Wizard)
          </p>
          <p className="text-sm text-secondary-foreground">{secretText}</p>
        </div>
      )}

      {/* Generate button */}
      {questions.length === 0 && (
        <div className="flex justify-center py-8">
          <Button
            variant="investigator"
            size="lg"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Crafting questions...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Mom Test Questions
              </>
            )}
          </Button>
        </div>
      )}

      {/* Questions list */}
      {questions.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            These questions focus on <span className="text-investigator font-medium">past behavior</span>, 
            not future intentions. Use them in customer interviews.
          </p>

          <div className="space-y-3">
            {questions.map((question, index) => (
              <div
                key={index}
                className={cn(
                  "glass-panel rounded-lg p-4 transition-all duration-300",
                  "hover:border-investigator/50 group"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-investigator/20 text-investigator text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <p className="text-sm text-secondary-foreground leading-relaxed">
                      {question}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                    onClick={() => copyQuestion(question, index)}
                  >
                    {copiedIndex === index ? (
                      <Check className="w-4 h-4 text-accent" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Regenerate button */}
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Regenerate Questions
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
