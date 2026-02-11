import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, ArrowRight, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectManifest } from '@/hooks/useProjectManifest';
import { useInflation } from '@/hooks/useInflation';

export default function Forge() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject, loadProject, updateManifest, createProject, updateTitle, clearProject, isLoading: isProjectLoading } = useProjectManifest();
  const { inflate, refinedVision, isInflating, error: inflationError } = useInflation();

  const [rawText, setRawText] = useState('');
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing project or clear state for new project
  useEffect(() => {
    if (id) {
      loadProject(id);
    } else {
      // Clear state when navigating to /new (no id)
      clearProject();
      setRawText('');
      setTitle('');
      setHasChanges(false);
    }
  }, [id, loadProject, clearProject]);

  // Hydrate from project
  useEffect(() => {
    if (currentProject) {
      setTitle(currentProject.title || '');
      setRawText(currentProject.manifest?.raw_vision || currentProject.pitch || '');
    } else {
      // Clear local state if project is unloaded (prevents stale data during transitions)
      setTitle('');
      setRawText('');
    }
  }, [currentProject]);

  // Update text without auto-inflation
  const handleTextChange = useCallback((value: string) => {
    setRawText(value);
    setHasChanges(true);
  }, []);

  // Manual inflation trigger
  const handleInflate = useCallback(() => {
    inflate(rawText);
  }, [inflate, rawText]);

  // Adopt refined vision
  const handleAdoptRefinedVision = useCallback(() => {
    if (refinedVision) {
      setRawText(refinedVision);
      setHasChanges(true);
    }
  }, [refinedVision]);

  // Save to manifest
  const handleSave = async (): Promise<string | null> => {
    setIsSaving(true);
    try {
      if (!currentProject) {
        // Create new project
        const newId = await createProject(
          title || 'Untitled Venture',
          rawText
        );
        if (newId) {
          await updateManifest({
            raw_vision: rawText,
            refined_vision: refinedVision || undefined,
            last_forge_edit: new Date().toISOString(),
          });
          navigate(`/forge/${newId}`, { replace: true });
          // Notify sidebar of new project
          window.dispatchEvent(new CustomEvent('project-updated'));
          return newId;
        }
      } else {
        // Update existing - save both title and manifest
        const titleChanged = title !== currentProject.title;

        // Update title if changed
        if (titleChanged) {
          await updateTitle(title || 'Untitled Venture');
        }

        // Update manifest
        await updateManifest({
          raw_vision: rawText,
          refined_vision: refinedVision || undefined,
          last_forge_edit: new Date().toISOString(),
        });

        setHasChanges(false);

        // Notify sidebar of project update
        window.dispatchEvent(new CustomEvent('project-updated'));

        return currentProject.id;
      }
      setHasChanges(false);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Proceed to framework selection
  const handleProceedToFrameworks = async () => {
    const projectId = await handleSave();
    if (projectId) {
      navigate(`/frameworks/${projectId}`);
    }
  };

  if (isProjectLoading && id) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

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
              <span className="text-sm font-medium text-zinc-400">The Forge</span>
            </div>
            <span className="text-zinc-700">|</span>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setHasChanges(true); }}
              placeholder="Venture title..."
              className="text-sm font-medium text-foreground bg-transparent outline-none placeholder:text-zinc-600 w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            {inflationError && (
              <span className="text-xs text-amber-400">{inflationError}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              title="Save your current draft without starting analysis"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Draft
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleProceedToFrameworks}
              disabled={!rawText.trim() || rawText.trim().length < 20 || isSaving}
              className="bg-cyan-600 hover:bg-cyan-500"
              title="Save and choose analysis frameworks"
            >
              Commit & Continue
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Editor Area */}
      <div className="flex-1 flex">
        {/* Left: Raw Input */}
        <div className="flex-1 flex flex-col border-r border-zinc-800/60">
          <div className="px-6 py-3 border-b border-zinc-800/40">
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Raw Vision</h2>
            <p className="text-[11px] text-zinc-600 mt-0.5">Write freely. Click "Inflate with AI" when ready.</p>
          </div>
          <div className="flex-1 p-6">
            <textarea
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Start typing your venture idea...&#10;&#10;Examples:&#10;- &quot;AI tool that makes legal docs cheaper&quot;&#10;- &quot;marketplace for freelance devs with fast matching&quot;&#10;- &quot;robotics for warehouse automation, 10x faster than humans&quot;"
              className="w-full h-full bg-transparent text-zinc-200 text-base leading-relaxed resize-none outline-none placeholder:text-zinc-700 font-mono"
              spellCheck={false}
            />
          </div>
          <div className="px-6 py-2 border-t border-zinc-800/40 flex items-center justify-between">
            <span className="text-[11px] text-zinc-600">
              {rawText.length} chars
              {rawText.trim().length < 20 && rawText.trim().length > 0 && (
                <span className="ml-2 text-amber-500">Need 20+ chars for inflation</span>
              )}
            </span>
          </div>
        </div>

        {/* Right: Inflated Vision */}
        <div className="flex-1 flex flex-col bg-zinc-900/30">
          <div className="px-6 py-3 border-b border-zinc-800/40 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-medium text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                AI-Inflated Vision
              </h2>
              <p className="text-[11px] text-zinc-600 mt-0.5">AI-expanded Thielian concepts</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleInflate}
              disabled={rawText.trim().length < 20 || isInflating}
              className="text-xs"
            >
              {isInflating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Inflating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Inflate with AI
                </>
              )}
            </Button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {!refinedVision && !isInflating && (
              <div className="text-center py-12">
                <Sparkles className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                <p className="text-sm text-zinc-600">
                  Start typing to see AI inflation
                </p>
                <p className="text-xs text-zinc-700 mt-1">
                  Your raw notes will be expanded into venture concepts
                </p>
              </div>
            )}

            {isInflating && !refinedVision && (
              <div className="text-center py-12">
                <Loader2 className="w-6 h-6 text-cyan-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-zinc-500">Inflating your vision...</p>
              </div>
            )}

            {refinedVision && (
              <div className="space-y-6">
                {/* Refined text */}
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {refinedVision}
                  </p>
                </div>

                {/* Adopt Refined Vision Button */}
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAdoptRefinedVision}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                    Adopt Refined Vision
                  </Button>
                </div>


              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
