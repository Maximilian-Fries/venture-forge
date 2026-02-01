import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Flame, ArrowUpRight, CloudUpload, LogOut, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { getVentureStatus, VENTURE_STATUS_CONFIG, type ProjectManifest, type VentureStatus } from "@/types/database";
import { MOCK_VENTURES } from "@/data/mockVentures";
import { getLocalProjects, isMockProject, removeLocalProject } from "@/hooks/useProjectManifest";

function getProjectRoute(project: ProjectManifest): string {
  const status = getVentureStatus(project);
  if (status === 'ideation' && !isMockProject(project.id)) {
    return `/forge/${project.id}`;
  }
  if (status === 'debating') {
    return `/gauntlet/${project.id}`;
  }
  return `/projects/${project.id}`;
}

// Helper to clear localStorage before starting fresh analysis
const clearAnalysisStorage = () => {
  try {
    localStorage.removeItem('venture_newidea_phase');
    localStorage.removeItem('venture_newidea_title');
    localStorage.removeItem('venture_newidea_pitch');
    localStorage.removeItem('venture_pitch_draft');
    localStorage.removeItem('venture_chat_history');
  } catch { /* ignore */ }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingMocks, setIsUsingMocks] = useState(false);
  const [filterStatus, setFilterStatus] = useState<VentureStatus | 'all'>('all');
  const [user, setUser] = useState<any>(null);

  // Auth State for inline login
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Track if we have local projects to show the Sync button
  const [hasLocalProjects, setHasLocalProjects] = useState(false);

  useEffect(() => {
    // Initial user check
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (_event === 'SIGNED_IN') {
        // window.location.reload(); // Can reload to be fresh
        loadProjects(); // Or just load data
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Isolate data loading
  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const { data: supabaseData, error } = await supabase
        .from("project_manifests")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) console.warn("[Dashboard] Supabase error:", error.message);

      const localData = getLocalProjects();
      setHasLocalProjects(localData.length > 0);

      const supabaseIds = new Set((supabaseData || []).map(p => p.id));
      const uniqueLocalData = localData.filter(p => !supabaseIds.has(p.id));

      const allProjects = [
        ...(supabaseData || []),
        ...uniqueLocalData,
      ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      if (allProjects.length === 0) {
        setProjects(MOCK_VENTURES as unknown as ProjectManifest[]);
        setIsUsingMocks(true);
      } else {
        setProjects(allProjects as ProjectManifest[]);
        setIsUsingMocks(false);
      }
    } catch (err) {
      console.error("[Dashboard] Failed to load projects:", err);
      // Fallback logic
      const localData = getLocalProjects();
      if (localData.length > 0) {
        setProjects(localData);
        setIsUsingMocks(false);
      } else {
        setProjects(MOCK_VENTURES as unknown as ProjectManifest[]);
        setIsUsingMocks(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reload projects whenever user changes (login/logout)
  useEffect(() => {
    if (user) loadProjects();
  }, [user]);

  const handleSyncToCloud = async () => {
    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in to sync projects.");
      return;
    }

    const localProjects = getLocalProjects();
    if (localProjects.length === 0) {
      toast.info("No local projects to sync.");
      setHasLocalProjects(false);
      return;
    }

    const toastId = toast.loading("Syncing local projects to Supabase...");
    let successCount = 0;
    let failCount = 0;

    for (const project of localProjects) {
      try {
        let projectToInsert = { ...project };
        const { id, ...projectData } = projectToInsert;

        const { error } = await (supabase
          .from('project_manifests') as any)
          .insert({
            ...projectData,
            user_id: user.id
          });

        if (error) {
          console.error(`Failed to sync project ${project.title}:`, error);
          failCount++;
        } else {
          // Success! Remove local copy to prevent duplication
          removeLocalProject(project.id);
          successCount++;
        }
      } catch (e) {
        console.error(`Failed to sync project ${project.title}:`, e);
        failCount++;
      }
    }

    toast.dismiss(toastId);
    if (successCount > 0) {
      toast.success(`Synced ${successCount} projects to Cloud!`);
      // Reload projects to show the new Cloud ones
      window.location.reload();
    } else if (failCount > 0) {
      toast.error(`Failed to sync ${failCount} projects. Check console.`);
    } else {
      toast.info("Sync complete.");
    }
  };

  const handleCreateNew = () => {
    clearAnalysisStorage();
    navigate("/new");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Account created! You can now log in.");
        setIsSignUp(false); // Switch to login view
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        // User state will update automatically via listener
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setIsAuthLoading(false);
    }
  };

  // --- RENDER ---

  // 1. If not logged in, show Minimalistic Login Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 text-zinc-100 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {isSignUp ? "Venture Forge" : "Venture Forge"}
            </CardTitle>
            <CardDescription className="text-center text-zinc-400">
              {isSignUp
                ? "Create an account to start building"
                : "Sign in to access your portfolio"}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAuth}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="pl-9 bg-zinc-950 border-zinc-800 focus:ring-zinc-700"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9 bg-zinc-950 border-zinc-800 focus:ring-zinc-700"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full bg-white text-zinc-950 hover:bg-zinc-200"
                disabled={isAuthLoading}
              >
                {isAuthLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSignUp ? "Sign Up" : "Sign In"}
              </Button>
              <p className="text-sm text-center text-zinc-500">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}
                <button
                  type="button"
                  className="ml-1 text-zinc-300 hover:underline hover:text-white"
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // 2. If logged in, show Dashboard
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative">
      {/* Header */}
      <header className="border-b border-zinc-800/60 bg-zinc-950 sticky top-0 z-10">
        <div className="px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Portfolio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isUsingMocks ? "Example ventures" : `${projects.length} venture${projects.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCreateNew}
              size="sm"
              className="bg-white text-zinc-950 hover:bg-zinc-200 font-medium"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Venture
            </Button>

            {/* Sync button only shows if we have local projects */}
            {hasLocalProjects && (
              <Button
                onClick={handleSyncToCloud}
                size="sm"
                variant="outline"
                className="bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border-zinc-700 animate-pulse"
              >
                <CloudUpload className="w-4 h-4 mr-1.5" />
                Sync Local
              </Button>
            )}
          </div>
        </div>

        {/* Status Filters */}
        <div className="px-8 pb-3 flex items-center gap-1">
          <FilterButton
            active={filterStatus === 'all'}
            onClick={() => setFilterStatus('all')}
            count={projects.length}
          >
            All
          </FilterButton>
          <FilterButton
            active={filterStatus === 'ideation'}
            onClick={() => setFilterStatus('ideation')}
            count={statusCounts.ideation || 0}
            dotColor="bg-blue-400"
          >
            Ideation
          </FilterButton>
          <FilterButton
            active={filterStatus === 'debating'}
            onClick={() => setFilterStatus('debating')}
            count={statusCounts.debating || 0}
            dotColor="bg-amber-400"
          >
            Debating
          </FilterButton>
          <FilterButton
            active={filterStatus === 'resolved'}
            onClick={() => setFilterStatus('resolved')}
            count={statusCounts.resolved || 0}
            dotColor="bg-green-400"
          >
            Resolved
          </FilterButton>
        </div>
      </header>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        </div>
      )}

      {/* Project List */}
      {!isLoading && (
        <div className="flex-1 pb-20">
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-8">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
                <Flame className="w-6 h-6 text-zinc-500" />
              </div>
              <p className="text-zinc-500 text-sm">
                {filterStatus === 'all'
                  ? 'No ventures yet. Start creating.'
                  : `No ventures in "${filterStatus}" status.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {filteredProjects.map((project) => (
                <VentureRow
                  key={project.id}
                  project={project}
                  onClick={() => navigate(getProjectRoute(project))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Logout Button (Bottom LEFT) */}
      <div className="fixed bottom-6 left-6 z-50">
        <Button
          onClick={handleSignOut}
          size="sm"
          variant="ghost"
          className="text-zinc-500 hover:text-white hover:bg-zinc-800"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

// --- Sub-components ---

function FilterButton({
  active,
  onClick,
  count,
  dotColor,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  dotColor?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
        active
          ? 'bg-zinc-800 text-zinc-200'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
      )}
    >
      {dotColor && <div className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />}
      <span>{children}</span>
      <span className={cn('text-[10px] tabular-nums', active ? 'text-zinc-400' : 'text-zinc-600')}>
        {count}
      </span>
    </button>
  );
}

function VentureRow({ project, onClick }: { project: ProjectManifest; onClick: () => void }) {
  const status = getVentureStatus(project);
  const statusConfig = VENTURE_STATUS_CONFIG[status];
  const isMock = isMockProject(project.id);
  const isEarlyExit = !!project.manifest?.early_exit_reason;

  const timeAgo = getTimeAgo(project.updated_at);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 w-full px-8 py-4 text-left hover:bg-zinc-900/50 transition-colors group"
    >
      {/* Status indicator */}
      <div className={cn('w-2 h-2 rounded-full shrink-0', isEarlyExit ? 'bg-red-400' : statusConfig.dotColor)} />

      {/* Title + thesis */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
            {project.title}
          </h3>
          {isMock && (
            <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
              example
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 truncate mt-0.5">
          {project.manifest?.one_sentence_thesis || project.pitch || "No description"}
        </p>
      </div>

      {/* Status badge */}
      <span className={cn(
        'text-[11px] font-medium px-2 py-0.5 rounded shrink-0',
        isEarlyExit ? 'bg-red-500/10 text-red-400' : statusConfig.bgColor,
        !isEarlyExit && statusConfig.color
      )}>
        {isEarlyExit ? 'Conceded' : statusConfig.label}
      </span>

      {/* Score */}
      <div className="w-10 text-right shrink-0">
        {project.monopoly_score > 0 ? (
          <span className={cn(
            'text-sm font-semibold tabular-nums',
            project.monopoly_score >= 70 ? 'text-green-400' :
              project.monopoly_score >= 40 ? 'text-yellow-400' :
                'text-zinc-500'
          )}>
            {project.monopoly_score}
          </span>
        ) : (
          <span className="text-xs text-zinc-700">--</span>
        )}
      </div>

      {/* Time */}
      <span className="text-[11px] text-zinc-600 w-12 text-right shrink-0">
        {timeAgo}
      </span>

      {/* Arrow */}
      <ArrowUpRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
    </button>
  );
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  return `${Math.floor(diffDays / 30)}mo`;
}
