import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectManifest } from "@/hooks/useProjectManifest";
import { Plus, Trash2, Building2, AlertTriangle, Search, Loader2, ExternalLink, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { runCompetitorScout } from "@/lib/agents/competitor-agent";
import type { ScoutCompetitor } from "@/types/database";

interface Competitor {
  name: string;
  weakness: string;
}

const CATEGORY_STYLES: Record<ScoutCompetitor['category'], { label: string; color: string; bg: string; border: string }> = {
  direct: { label: 'Direct', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  adjacent: { label: 'Adjacent', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  status_quo: { label: 'Status Quo', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30' },
};

export function CompetitorMatrix() {
  const { currentProject, updateManifest } = useProjectManifest();
  const manifest = currentProject?.manifest || {};
  const competitors = manifest.competitors || [];
  const scoutCompetitors = manifest.scout_competitors || [];
  const competitorReport = manifest.competitor_report;

  const [newCompetitor, setNewCompetitor] = useState({ name: "", weakness: "" });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Competitor>({ name: "", weakness: "" });
  const [isScanning, setIsScanning] = useState(false);

  const handleAdd = async () => {
    if (!newCompetitor.name.trim()) return;

    const updated = [...competitors, newCompetitor];
    await updateManifest({ competitors: updated });
    setNewCompetitor({ name: "", weakness: "" });
  };

  const handleDelete = async (index: number) => {
    const updated = competitors.filter((_, i) => i !== index);
    await updateManifest({ competitors: updated });
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditDraft(competitors[index]);
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null) return;

    const updated = competitors.map((c, i) =>
      i === editingIndex ? editDraft : c
    );
    await updateManifest({ competitors: updated });
    setEditingIndex(null);
    setEditDraft({ name: "", weakness: "" });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditDraft({ name: "", weakness: "" });
  };

  const handleRescan = async () => {
    if (!currentProject?.manifest) return;
    setIsScanning(true);
    try {
      const report = await runCompetitorScout(currentProject.manifest);
      await updateManifest({
        competitor_report: report,
        scout_competitors: report.competitors,
      });
    } catch (err) {
      console.error('[CompetitorMatrix] Re-scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddToMatrix = async (scout: ScoutCompetitor) => {
    const updated = [...competitors, { name: scout.name, weakness: scout.weakness || '' }];
    // Remove from scout list
    const updatedScout = scoutCompetitors.filter(s => s.name !== scout.name);
    await updateManifest({
      competitors: updated,
      scout_competitors: updatedScout,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Competitor Analysis</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Map your competitive landscape and their weaknesses
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRescan}
          disabled={isScanning}
          className="text-zinc-400 hover:text-zinc-200"
        >
          {isScanning ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5 mr-1.5" />
          )}
          {isScanning ? 'Scanning...' : 'Scout Competitors'}
        </Button>
      </div>

      {/* Red Ocean Alert */}
      {competitorReport?.redOceanAlert && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <span className="text-sm font-medium text-red-300">Red Ocean Alert</span>
            <p className="text-xs text-red-400/80 mt-0.5">
              More than 3 direct competitors detected. Differentiation is critical.
            </p>
          </div>
        </div>
      )}

      {/* Scout Summary */}
      {competitorReport?.summary && (
        <div className="px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Competitive Landscape</span>
          <p className="text-sm text-zinc-300 mt-1">{competitorReport.summary}</p>
          {competitorReport.searchedAt && (
            <p className="text-[10px] text-zinc-600 mt-2">
              Last scanned: {new Date(competitorReport.searchedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: User Identified */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider">
            User Identified
          </h3>

          {competitors.length === 0 ? (
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 text-center">
              <Building2 className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No competitors added yet</p>
            </div>
          ) : (
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Competitor
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        Weakness
                      </div>
                    </th>
                    <th className="px-4 py-2.5 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((competitor, index) => (
                    <tr
                      key={index}
                      className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors"
                    >
                      {editingIndex === index ? (
                        <>
                          <td className="px-4 py-2.5">
                            <Input
                              value={editDraft.name}
                              onChange={(e) =>
                                setEditDraft({ ...editDraft, name: e.target.value })
                              }
                              className="bg-zinc-800 border-zinc-700 h-8 text-sm"
                              autoFocus
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <Input
                              value={editDraft.weakness}
                              onChange={(e) =>
                                setEditDraft({ ...editDraft, weakness: e.target.value })
                              }
                              className="bg-zinc-800 border-zinc-700 h-8 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleSaveEdit}
                                className="text-green-500 hover:text-green-400 h-7 text-xs"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelEdit}
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td
                            className="px-4 py-2.5 cursor-pointer"
                            onClick={() => handleEdit(index)}
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                              <span className="text-sm font-medium text-foreground">
                                {competitor.name}
                              </span>
                            </div>
                          </td>
                          <td
                            className="px-4 py-2.5 cursor-pointer"
                            onClick={() => handleEdit(index)}
                          >
                            <span className="text-xs text-muted-foreground">
                              {competitor.weakness || (
                                <span className="italic text-zinc-600">
                                  Not identified
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(index)}
                              className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add New Competitor */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-3">
            <div className="flex gap-2">
              <Input
                value={newCompetitor.name}
                onChange={(e) =>
                  setNewCompetitor({ ...newCompetitor, name: e.target.value })
                }
                placeholder="Competitor name"
                className="flex-1 bg-zinc-800 border-zinc-700 h-8 text-sm"
              />
              <Input
                value={newCompetitor.weakness}
                onChange={(e) =>
                  setNewCompetitor({ ...newCompetitor, weakness: e.target.value })
                }
                placeholder="Their weakness"
                className="flex-1 bg-zinc-800 border-zinc-700 h-8 text-sm"
              />
              <Button
                onClick={handleAdd}
                disabled={!newCompetitor.name.trim()}
                size="sm"
                className={cn(
                  "shrink-0 h-8",
                  !newCompetitor.name.trim() && "opacity-50"
                )}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Scout Detected */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            Scout Detected
          </h3>

          {scoutCompetitors.length === 0 ? (
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 text-center">
              <Search className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {competitorReport ? 'No competitors found' : 'Run the scout to detect competitors'}
              </p>
              {!competitorReport && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRescan}
                  disabled={isScanning}
                  className="mt-3 text-cyan-400 hover:text-cyan-300"
                >
                  {isScanning ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Run Competitor Scout
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {scoutCompetitors.map((scout, idx) => {
                const style = CATEGORY_STYLES[scout.category];
                return (
                  <div
                    key={idx}
                    className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {scout.name}
                          </span>
                          <span className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded border',
                            style.color, style.bg, style.border
                          )}>
                            {style.label}
                          </span>
                          {scout.url && (
                            <a
                              href={scout.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-500 hover:text-zinc-300"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {scout.description}
                        </p>
                        {scout.weakness && (
                          <p className="text-xs text-amber-400/80 mt-1">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            {scout.weakness}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddToMatrix(scout)}
                        className="shrink-0 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-7"
                      >
                        <ArrowRight className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
