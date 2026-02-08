import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Loader2, Flame, ChevronRight, LogOut, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { getLocalProjects, isMockProject, isLocalProject, removeLocalProject } from '@/hooks/useProjectManifest';
import { MOCK_VENTURES } from '@/data/mockVentures';
import { getVentureStatus, VENTURE_STATUS_CONFIG, type ProjectManifest } from '@/types/database';
import { CommandPalette } from './CommandPalette';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<ProjectManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectManifest | null>(null);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: supabaseData, error } = await supabase
        .from('project_manifests')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) console.warn('[AppShell] Supabase error:', error.message);

      const localData = getLocalProjects();
      const allProjects = [
        ...(supabaseData || []),
        ...localData,
      ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      if (allProjects.length === 0) {
        setProjects(MOCK_VENTURES as unknown as ProjectManifest[]);
      } else {
        setProjects(allProjects as ProjectManifest[]);
      }
    } catch {
      const localData = getLocalProjects();
      setProjects(localData.length > 0 ? localData : MOCK_VENTURES as unknown as ProjectManifest[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Reload projects when navigating to project routes or root (to catch new/updated projects)
  useEffect(() => {
    const isProjectRoute =
      location.pathname === '/' ||
      location.pathname.startsWith('/forge/') ||
      location.pathname.startsWith('/gauntlet/') ||
      location.pathname.startsWith('/projects/');

    if (isProjectRoute) {
      loadProjects();
    }
  }, [location.pathname, loadProjects]);

  // Listen for localStorage changes (for local projects created in other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'venture_local_projects') {
        loadProjects();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadProjects]);

  // Listen for project updates from Forge and Gauntlet
  useEffect(() => {
    const handleProjectUpdate = () => {
      loadProjects();
    };
    window.addEventListener('project-updated', handleProjectUpdate);
    return () => window.removeEventListener('project-updated', handleProjectUpdate);
  }, [loadProjects]);

  // CMD+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleCreateNew = () => {
    try {
      localStorage.removeItem('venture_newidea_phase');
      localStorage.removeItem('venture_newidea_title');
      localStorage.removeItem('venture_newidea_pitch');
      localStorage.removeItem('venture_pitch_draft');
      localStorage.removeItem('venture_chat_history');
    } catch { /* ignore */ }
    navigate('/new');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    const id = projectToDelete.id;

    if (isLocalProject(id)) {
      removeLocalProject(id);
    } else if (!isMockProject(id)) {
      await supabase.from('project_manifests').delete().eq('id', id);
    }

    if (currentProjectId === id) {
      navigate('/');
    }

    setProjectToDelete(null);
    loadProjects();
  };

  // Extract current project ID from URL
  const currentProjectId = location.pathname.match(/\/(projects|analyze|forge|gauntlet)\/(.+)/)?.[2];

  // Check if we're on a public route that shouldn't show the sidebar
  const isPublicRoute = location.pathname === '/auth';

  // For public routes (like /auth), render children without the shell
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Determine the best route for a project based on its status
  const getProjectRoute = (project: ProjectManifest): string => {
    const status = getVentureStatus(project);
    if (status === 'ideation' && !isMockProject(project.id)) {
      return `/forge/${project.id}`;
    }
    if (status === 'debating') {
      return `/gauntlet/${project.id}`;
    }
    return `/projects/${project.id}`;
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-zinc-800/60 bg-zinc-950 transition-all duration-200',
          sidebarCollapsed ? 'w-14' : 'w-64'
        )}
      >
        {/* Logo / Header */}
        <div className={cn(
          "border-b border-zinc-800/60",
          sidebarCollapsed ? "p-2 flex flex-col items-center gap-2" : "p-3 flex items-center justify-between"
        )}>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4 text-white" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-semibold text-sm text-foreground truncate">Venture Forge</span>
            )}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-zinc-500 hover:text-zinc-300 p-1 shrink-0"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", !sidebarCollapsed && "rotate-180")} />
          </button>
        </div>

        {/* Quick Search */}
        {!sidebarCollapsed && (
          <button
            onClick={() => setShowCommandPalette(true)}
            className="mx-2 mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors text-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search ventures...</span>
            <kbd className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </button>
        )}

        {/* New Venture Button */}
        <div className="px-2 mt-3">
          <button
            onClick={handleCreateNew}
            className={cn(
              'flex items-center gap-2 w-full rounded-lg transition-colors text-sm',
              sidebarCollapsed
                ? 'justify-center p-2 hover:bg-zinc-800'
                : 'px-3 py-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            )}
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>New Venture</span>}
          </button>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto mt-3 px-2">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
            </div>
          ) : (
            <nav className="space-y-0.5">
              {projects.map((project) => {
                const status = getVentureStatus(project);
                const statusConfig = VENTURE_STATUS_CONFIG[status];
                const isActive = currentProjectId === project.id;
                const isMock = isMockProject(project.id);
                const isEarlyExit = !!project.manifest?.early_exit_reason;

                return (
                  <ContextMenu key={project.id}>
                    <ContextMenuTrigger asChild>
                      <button
                        onClick={() => navigate(getProjectRoute(project))}
                        className={cn(
                          'flex items-center gap-2 w-full rounded-lg text-left transition-colors group',
                          sidebarCollapsed ? 'justify-center p-2' : 'px-3 py-2',
                          isActive
                            ? 'bg-zinc-800/80 text-white'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                        )}
                        title={sidebarCollapsed ? project.title : undefined}
                      >
                        {/* Status dot */}
                        <div className={cn('w-2 h-2 rounded-full shrink-0', isEarlyExit ? 'bg-red-400' : statusConfig.dotColor)} />

                        {!sidebarCollapsed && (
                          <>
                            <span className="flex-1 text-sm truncate">{project.title}</span>
                            {project.monopoly_score > 0 && (
                              <span className={cn(
                                'text-xs font-mono tabular-nums',
                                project.monopoly_score >= 70 ? 'text-green-400' :
                                project.monopoly_score >= 40 ? 'text-yellow-400' :
                                'text-zinc-500'
                              )}>
                                {project.monopoly_score}
                              </span>
                            )}
                            {isMock && (
                              <span className="text-[10px] text-zinc-600 ml-1">ex</span>
                            )}
                          </>
                        )}
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        disabled={isMock}
                        className="text-red-400 focus:text-red-400"
                        onClick={() => setProjectToDelete(project)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </nav>
          )}
        </div>

        {/* Footer - Sign Out */}
        <div className="p-2 border-t border-zinc-800/60">
          <button
            onClick={handleSignOut}
            className={cn(
              'flex items-center gap-2 w-full rounded-lg transition-colors text-sm text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800',
              sidebarCollapsed ? 'justify-center p-2' : 'px-3 py-1.5'
            )}
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette
          projects={projects}
          onClose={() => setShowCommandPalette(false)}
          onSelectProject={(id) => {
            setShowCommandPalette(false);
            navigate(`/projects/${id}`);
          }}
          onCreateNew={() => {
            setShowCommandPalette(false);
            handleCreateNew();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={projectToDelete !== null} onOpenChange={(open) => { if (!open) setProjectToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete venture?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold text-zinc-200">{projectToDelete?.title}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
