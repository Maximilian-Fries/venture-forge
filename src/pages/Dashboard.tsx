import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Flame, ArrowUpRight, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

  // Track if we have local projects to show the Sync button
  const [hasLocalProjects, setHasLocalProjects] = useState(false);

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

  useEffect(() => {
    loadProjects();
  }, []);

  const handleSyncToCloud = async () => {
    // Get current user (guaranteed by ProtectedRoute, but check anyway)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Authentication error. Please refresh and try again.");
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

  // Filter projects by status
  const filteredProjects = filterStatus === 'all'
    ? projects
    : projects.filter(p => getVentureStatus(p) === filterStatus);

  // Group counts
  const statusCounts = projects.reduce((acc, p) => {
    const status = getVentureStatus(p);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<VentureStatus, number>);

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
