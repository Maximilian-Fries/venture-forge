import { useState, useRef, useEffect } from 'react';
import { Search, Plus, ArrowRight, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVentureStatus, VENTURE_STATUS_CONFIG, type ProjectManifest } from '@/types/database';

interface CommandPaletteProps {
  projects: ProjectManifest[];
  onClose: () => void;
  onSelectProject: (id: string) => void;
  onCreateNew: () => void;
}

export function CommandPalette({ projects, onClose, onSelectProject, onCreateNew }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter projects by query
  const filtered = query.trim()
    ? projects.filter(p =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        (p.pitch || '').toLowerCase().includes(query.toLowerCase())
      )
    : projects;

  // Items: new venture action + filtered projects
  const items = [
    { type: 'action' as const, id: '__new__', label: 'New Venture' },
    ...filtered.map(p => ({ type: 'project' as const, id: p.id, project: p })),
  ];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[selectedIndex];
      if (item?.type === 'action') {
        onCreateNew();
      } else if (item?.type === 'project') {
        onSelectProject(item.id);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative flex items-start justify-center pt-[20vh]" onClick={e => e.stopPropagation()}>
        <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
            <Search className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search ventures or type to filter..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-zinc-500 outline-none"
            />
            <kbd className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto py-2">
            {items.map((item, index) => {
              if (item.type === 'action') {
                return (
                  <button
                    key={item.id}
                    onClick={onCreateNew}
                    className={cn(
                      'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                      index === selectedIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                    )}
                  >
                    <div className="w-6 h-6 rounded-md bg-zinc-700 flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5 text-zinc-300" />
                    </div>
                    <span className="text-sm text-zinc-200">New Venture</span>
                    <span className="ml-auto text-xs text-zinc-600">Create</span>
                  </button>
                );
              }

              const project = item.project!;
              const status = getVentureStatus(project);
              const statusConfig = VENTURE_STATUS_CONFIG[status];

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectProject(item.id)}
                  className={cn(
                    'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                    index === selectedIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                  )}
                >
                  <div className={cn('w-2 h-2 rounded-full shrink-0', statusConfig.dotColor)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{project.title}</p>
                    {project.manifest?.one_sentence_thesis && (
                      <p className="text-xs text-zinc-500 truncate">{project.manifest.one_sentence_thesis}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('text-xs', statusConfig.color)}>{statusConfig.label}</span>
                    {project.monopoly_score > 0 && (
                      <span className={cn(
                        'text-xs font-mono',
                        project.monopoly_score >= 70 ? 'text-green-400' :
                        project.monopoly_score >= 40 ? 'text-yellow-400' :
                        'text-zinc-500'
                      )}>
                        {project.monopoly_score}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {items.length === 1 && query && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-zinc-500">No ventures matching "{query}"</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-zinc-800 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1"><kbd className="bg-zinc-800 px-1 rounded">↑↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="bg-zinc-800 px-1 rounded">↵</kbd> Open</span>
            <span className="flex items-center gap-1"><kbd className="bg-zinc-800 px-1 rounded">esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
