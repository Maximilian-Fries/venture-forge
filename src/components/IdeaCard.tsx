import { ArrowRight, Sparkles } from "lucide-react";
import { MonopolyChart } from "./MonopolyChart";
import { cn } from "@/lib/utils";

interface IdeaCardProps {
  id: string;
  title: string;
  pitch: string;
  score: number;
  wedgePercent: number;
  contrarianIndex: number;
  onClick: () => void;
}

export function IdeaCard({
  title,
  pitch,
  score,
  wedgePercent,
  contrarianIndex,
  onClick,
}: IdeaCardProps) {
  const getScoreColor = (s: number) => {
    if (s >= 70) return "text-accent";
    if (s >= 40) return "text-visionary";
    return "text-skeptic";
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left glass-panel rounded-2xl p-6 transition-all duration-300",
        "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        "group"
      )}
    >
      <div className="flex items-start gap-5">
        {/* Chart */}
        <div className="w-24 h-24 flex-shrink-0">
          <MonopolyChart
            totalMarket={100}
            wedgePercent={wedgePercent}
            score={score}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {title}
            </h3>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {pitch}
          </p>

          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className={cn("w-4 h-4", getScoreColor(contrarianIndex))} />
              <span className={cn("text-sm font-medium", getScoreColor(contrarianIndex))}>
                {contrarianIndex}
              </span>
              <span className="text-xs text-muted-foreground">Contrarian</span>
            </div>

            <div className="w-px h-4 bg-border" />

            <div className="flex items-center gap-1.5">
              <span className={cn("text-sm font-medium", getScoreColor(score))}>
                {score}%
              </span>
              <span className="text-xs text-muted-foreground">Monopoly</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
