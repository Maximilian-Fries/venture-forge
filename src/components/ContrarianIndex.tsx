import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContrarianIndexProps {
  score: number;
  engineeringScore: number;
  secretScore: number;
  skepticFlags: number;
}

export function ContrarianIndex({
  score,
  engineeringScore,
  secretScore,
  skepticFlags,
}: ContrarianIndexProps) {
  const getTrend = () => {
    if (score >= 70) return { icon: TrendingUp, label: "Strong", color: "text-accent" };
    if (score >= 40) return { icon: Minus, label: "Moderate", color: "text-visionary" };
    return { icon: TrendingDown, label: "Weak", color: "text-skeptic" };
  };

  const trend = getTrend();
  const TrendIcon = trend.icon;

  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Contrarian Index
          </h4>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-4xl font-bold", trend.color)}>{score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>
        <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full", 
          score >= 70 ? "bg-accent/20" : score >= 40 ? "bg-visionary/20" : "bg-skeptic/20"
        )}>
          <TrendIcon className={cn("w-4 h-4", trend.color)} />
          <span className={cn("text-sm font-medium", trend.color)}>{trend.label}</span>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Engineering Moat</span>
          <span className="font-medium text-foreground">{engineeringScore}/100</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-visionary transition-all duration-500"
            style={{ width: `${engineeringScore}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Secret Strength</span>
          <span className="font-medium text-foreground">{secretScore}/100</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${secretScore}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">Skeptic Flags</span>
          <span className={cn("font-medium", skepticFlags > 2 ? "text-skeptic" : "text-accent")}>
            -{skepticFlags * 5} penalty
          </span>
        </div>
      </div>

      {/* Formula hint */}
      <p className="mt-4 text-xs text-muted-foreground text-center">
        Formula: (Engineering + Secret) / 2 − (Flags × 5)
      </p>
    </div>
  );
}
