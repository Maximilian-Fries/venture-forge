import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectManifest } from "@/hooks/useProjectManifest";
import { Plus, Trash2, Building2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Competitor {
  name: string;
  weakness: string;
}

export function CompetitorMatrix() {
  const { currentProject, updateManifest } = useProjectManifest();
  const manifest = currentProject?.manifest || {};
  const competitors = manifest.competitors || [];

  const [newCompetitor, setNewCompetitor] = useState({ name: "", weakness: "" });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Competitor>({ name: "", weakness: "" });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Competitor Analysis</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Map your competitive landscape and their weaknesses
          </p>
        </div>
      </div>

      {/* Competitor List */}
      <div className="space-y-3">
        {competitors.length === 0 ? (
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-8 text-center">
            <Building2 className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-muted-foreground">No competitors added yet</p>
            <p className="text-sm text-zinc-500 mt-1">
              Add competitors to understand your market position
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Competitor
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      Their Weakness
                    </div>
                  </th>
                  <th className="px-4 py-3 w-20"></th>
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
                        <td className="px-4 py-3">
                          <Input
                            value={editDraft.name}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, name: e.target.value })
                            }
                            className="bg-zinc-800 border-zinc-700"
                            autoFocus
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={editDraft.weakness}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, weakness: e.target.value })
                            }
                            className="bg-zinc-800 border-zinc-700"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleSaveEdit}
                              className="text-green-500 hover:text-green-400"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => handleEdit(index)}
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-zinc-500" />
                            <span className="font-medium text-foreground">
                              {competitor.name}
                            </span>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => handleEdit(index)}
                        >
                          <span className="text-muted-foreground">
                            {competitor.weakness || (
                              <span className="italic text-zinc-600">
                                No weakness identified
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(index)}
                            className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
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
      </div>

      {/* Add New Competitor */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Add Competitor
        </h3>
        <div className="flex gap-3">
          <Input
            value={newCompetitor.name}
            onChange={(e) =>
              setNewCompetitor({ ...newCompetitor, name: e.target.value })
            }
            placeholder="Competitor name"
            className="flex-1 bg-zinc-800 border-zinc-700"
          />
          <Input
            value={newCompetitor.weakness}
            onChange={(e) =>
              setNewCompetitor({ ...newCompetitor, weakness: e.target.value })
            }
            placeholder="Their weakness"
            className="flex-1 bg-zinc-800 border-zinc-700"
          />
          <Button
            onClick={handleAdd}
            disabled={!newCompetitor.name.trim()}
            className={cn(
              "shrink-0",
              !newCompetitor.name.trim() && "opacity-50"
            )}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
