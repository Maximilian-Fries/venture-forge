import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectManifest } from '@/hooks/useProjectManifest';
import { FrameworkSelector } from '@/components/FrameworkSelector';
import { FrameworkRegistry } from '@/lib/frameworks/registry';

export default function FrameworkSelection() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject, loadProject, updateManifest, isLoading } = useProjectManifest();

  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([FrameworkRegistry.getDefaultId()]);
  const [isSaving, setIsSaving] = useState(false);

  // Load project if not already loaded
  useEffect(() => {
    if (id && (!currentProject || currentProject.id !== id)) {
      loadProject(id);
    }
  }, [id, currentProject, loadProject]);

  // Hydrate frameworks from manifest
  useEffect(() => {
    if (currentProject?.manifest?.frameworks?.length) {
      setSelectedFrameworks(currentProject.manifest.frameworks);
    }
  }, [currentProject]);

  const handleFrameworkChange = useCallback((ids: string[]) => {
    setSelectedFrameworks(ids);
  }, []);

  const handleStartAnalysis = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      await updateManifest({ frameworks: selectedFrameworks });
      navigate(`/gauntlet/${id}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !currentProject) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const pitch = currentProject.manifest?.refined_vision || currentProject.manifest?.raw_vision || currentProject.pitch || '';

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/60 bg-zinc-950 sticky top-0 z-10">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-zinc-400">Analysis Setup</span>
            </div>
            <span className="text-zinc-700">|</span>
            <span className="text-sm font-medium text-foreground">{currentProject.title || 'Untitled Venture'}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/forge/${id}`)}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back to Forge
            </Button>
            <Button
              size="sm"
              onClick={handleStartAnalysis}
              disabled={isSaving || selectedFrameworks.length === 0}
              className="bg-cyan-600 hover:bg-cyan-500"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Start Analysis
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center py-10 px-8">
        {/* Pitch summary */}
        {pitch && (
          <div className="w-full max-w-3xl mb-8 p-4 rounded-lg border border-zinc-800/60 bg-zinc-900/30">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Pitch Summary</h3>
            <p className="text-sm text-zinc-300 line-clamp-3">{pitch}</p>
          </div>
        )}

        {/* Framework selector */}
        <div className="w-full max-w-3xl">
          <FrameworkSelector
            selected={selectedFrameworks}
            onChange={handleFrameworkChange}
          />
        </div>
      </div>
    </div>
  );
}
