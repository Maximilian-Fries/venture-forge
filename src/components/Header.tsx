import { Hexagon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface HeaderProps {
  showNewIdea?: boolean;
  onNewIdea?: () => void;
}

export function Header({ showNewIdea = true, onNewIdea }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            <Hexagon className="w-8 h-8 text-primary fill-primary/10 group-hover:fill-primary/20 transition-colors" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">M</span>
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              MonopolyMap
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest -mt-0.5">
              Adversarial Venture Architect
            </p>
          </div>
        </Link>

        {showNewIdea && (
          <Button variant="default" size="sm" onClick={onNewIdea}>
            <Plus className="w-4 h-4" />
            New Idea
          </Button>
        )}
      </div>
    </header>
  );
}
