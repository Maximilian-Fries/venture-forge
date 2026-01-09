import { useState } from "react";
import { Lightbulb, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConflictToggleProps {
  onChoice: (winner: "visionary" | "skeptic" | null) => void;
  defaultValue?: "visionary" | "skeptic" | null;
  disabled?: boolean;
}

export function ConflictToggle({
  onChoice,
  defaultValue = null,
  disabled = false,
}: ConflictToggleProps) {
  const [selected, setSelected] = useState<"visionary" | "skeptic" | null>(defaultValue);

  const handleSelect = (choice: "visionary" | "skeptic") => {
    const newValue = selected === choice ? null : choice;
    setSelected(newValue);
    onChoice(newValue);
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleSelect("visionary")}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 font-medium text-sm",
          "border-2",
          selected === "visionary"
            ? "border-visionary bg-visionary/20 text-visionary shadow-lg shadow-visionary/20"
            : "border-border bg-secondary/50 text-muted-foreground hover:border-visionary/50 hover:text-visionary/80",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Lightbulb className="w-4 h-4" />
        <span>Visionary Wins</span>
      </button>

      <div className="w-px h-8 bg-border" />

      <button
        type="button"
        disabled={disabled}
        onClick={() => handleSelect("skeptic")}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-300 font-medium text-sm",
          "border-2",
          selected === "skeptic"
            ? "border-skeptic bg-skeptic/20 text-skeptic shadow-lg shadow-skeptic/20"
            : "border-border bg-secondary/50 text-muted-foreground hover:border-skeptic/50 hover:text-skeptic/80",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <ShieldAlert className="w-4 h-4" />
        <span>Skeptic Wins</span>
      </button>
    </div>
  );
}
