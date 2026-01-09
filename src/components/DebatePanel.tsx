import { Lightbulb, ShieldAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DebatePanelProps {
  visionaryOutput: string;
  skepticOutput: string;
  isLoading?: boolean;
  loadingAgent?: "visionary" | "skeptic" | null;
}

export function DebatePanel({
  visionaryOutput,
  skepticOutput,
  isLoading = false,
  loadingAgent = null,
}: DebatePanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Visionary Panel */}
      <div
        className={cn(
          "glass-panel rounded-xl p-5 transition-all duration-300",
          visionaryOutput && "glow-primary"
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-visionary/20 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-visionary" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">The Visionary</h4>
            <p className="text-xs text-muted-foreground">Peter Thiel's Lens</p>
          </div>
        </div>

        <div className="min-h-[120px]">
          {isLoading && loadingAgent === "visionary" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-visionary" />
              <span className="text-sm">Seeking the Secret...</span>
            </div>
          ) : visionaryOutput ? (
            <div className="prose prose-sm prose-invert max-w-none">
              <p className="text-sm text-secondary-foreground leading-relaxed whitespace-pre-wrap">
                {visionaryOutput}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Click "Generate Debate" to receive visionary insights...
            </p>
          )}
        </div>
      </div>

      {/* Skeptic Panel */}
      <div
        className={cn(
          "glass-panel rounded-xl p-5 transition-all duration-300",
          skepticOutput && "glow-skeptic"
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-skeptic/20 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-skeptic" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">The Skeptic</h4>
            <p className="text-xs text-muted-foreground">Ruthless VC Analysis</p>
          </div>
        </div>

        <div className="min-h-[120px]">
          {isLoading && loadingAgent === "skeptic" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-skeptic" />
              <span className="text-sm">Finding the red flags...</span>
            </div>
          ) : skepticOutput ? (
            <div className="prose prose-sm prose-invert max-w-none">
              <p className="text-sm text-secondary-foreground leading-relaxed whitespace-pre-wrap">
                {skepticOutput}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Click "Generate Debate" to receive skeptic critique...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
