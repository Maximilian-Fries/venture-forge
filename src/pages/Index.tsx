import { useState } from "react";
import { Hexagon, ArrowRight, Lightbulb, ShieldAlert, SearchCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IdeaCard } from "@/components/IdeaCard";
import { Header } from "@/components/Header";
import { useNavigate } from "react-router-dom";

// Mock data for demonstration
const MOCK_IDEAS = [
  {
    id: "1",
    title: "AI-Powered Legal Document Analysis",
    pitch: "Using LLMs to automate contract review for mid-market law firms, reducing review time by 80%.",
    score: 72,
    wedgePercent: 18,
    contrarianIndex: 68,
  },
  {
    id: "2",
    title: "Vertical SaaS for Specialty Coffee Roasters",
    pitch: "End-to-end platform for managing sourcing, roasting profiles, and direct-to-consumer sales.",
    score: 54,
    wedgePercent: 12,
    contrarianIndex: 45,
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [ideas] = useState(MOCK_IDEAS);

  return (
    <div className="min-h-screen bg-gradient-dark">
      <Header onNewIdea={() => navigate("/new")} />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial opacity-50" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-skeptic/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        </div>

        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Multi-Agent Venture Analysis
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Find Your{" "}
              <span className="text-gradient-visionary">Monopoly</span>
              <br />
              Before You Build
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Three AI personas debate your startup idea. The Visionary seeks breakthroughs. 
              The Skeptic finds flaws. The Investigator validates with customers.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button variant="hero" size="xl" onClick={() => navigate("/new")}>
                Analyze New Idea
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="glass" size="xl">
                View Demo
              </Button>
            </div>
          </div>

          {/* Agent Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-4xl mx-auto">
            <div className="glass-panel rounded-2xl p-6 text-center space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="w-14 h-14 rounded-xl bg-visionary/20 flex items-center justify-center mx-auto">
                <Lightbulb className="w-7 h-7 text-visionary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">The Visionary</h3>
              <p className="text-sm text-muted-foreground">
                Channels Peter Thiel. Seeks the contrarian "0 to 1" breakthrough. Ignores incrementalism.
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 text-center space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-14 h-14 rounded-xl bg-skeptic/20 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-7 h-7 text-skeptic" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">The Skeptic</h3>
              <p className="text-sm text-muted-foreground">
                Ruthless VC mindset. Finds hidden incumbents, timing traps, and defensibility gaps.
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 text-center space-y-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="w-14 h-14 rounded-xl bg-investigator/20 flex items-center justify-center mx-auto">
                <SearchCheck className="w-7 h-7 text-investigator" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">The Investigator</h3>
              <p className="text-sm text-muted-foreground">
                Rob Fitzpatrick's lens. Creates Mom Test questions about past behavior, never the future.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ideas Section */}
      {ideas.length > 0 && (
        <section className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Your Ideas</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Continue analyzing or start a new venture thesis
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                {...idea}
                onClick={() => navigate(`/idea/${idea.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-border">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Hexagon className="w-4 h-4 text-primary" />
            <span>MonopolyMap</span>
          </div>
          <p>Built for founders who think differently.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
