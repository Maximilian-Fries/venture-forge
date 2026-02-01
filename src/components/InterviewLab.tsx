import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProjectManifest } from "@/hooks/useProjectManifest";
import {
  Plus,
  Trash2,
  User,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Interview {
  id: string;
  name: string;
  role: string;
  key_insight: string;
  status: "planned" | "completed";
}

export function InterviewLab() {
  const { currentProject, updateManifest } = useProjectManifest();
  const manifest = currentProject?.manifest || {};
  const interviews = manifest.interviews || [];
  const questions = manifest.interview_questions || [];

  const [newInterview, setNewInterview] = useState({
    name: "",
    role: "",
  });
  const [newQuestion, setNewQuestion] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [insightDraft, setInsightDraft] = useState("");

  // Interview handlers
  const handleAddInterview = async () => {
    if (!newInterview.name.trim()) return;

    const interview: Interview = {
      id: Date.now().toString(),
      name: newInterview.name,
      role: newInterview.role,
      key_insight: "",
      status: "planned",
    };

    await updateManifest({ interviews: [...interviews, interview] });
    setNewInterview({ name: "", role: "" });
  };

  const handleDeleteInterview = async (id: string) => {
    const updated = interviews.filter((i) => i.id !== id);
    await updateManifest({ interviews: updated });
  };

  const handleToggleStatus = async (id: string) => {
    const updated = interviews.map((i) =>
      i.id === id
        ? { ...i, status: i.status === "planned" ? "completed" : "planned" }
        : i
    ) as Interview[];
    await updateManifest({ interviews: updated });
  };

  const handleEditInsight = (interview: Interview) => {
    setEditingId(interview.id);
    setInsightDraft(interview.key_insight);
  };

  const handleSaveInsight = async (id: string) => {
    const updated = interviews.map((i) =>
      i.id === id ? { ...i, key_insight: insightDraft } : i
    );
    await updateManifest({ interviews: updated });
    setEditingId(null);
    setInsightDraft("");
  };

  // Question handlers
  const handleAddQuestion = async () => {
    if (!newQuestion.trim()) return;
    await updateManifest({ interview_questions: [...questions, newQuestion] });
    setNewQuestion("");
  };

  const handleDeleteQuestion = async (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    await updateManifest({ interview_questions: updated });
  };

  const completedCount = interviews.filter((i) => i.status === "completed").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Customer Validation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track interviews and capture insights using the Mom Test methodology
          </p>
        </div>
        {interviews.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {completedCount}/{interviews.length} completed
          </div>
        )}
      </div>

      {/* Interview List */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <User className="w-4 h-4" />
          Interviews
        </h3>

        {interviews.length === 0 ? (
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-8 text-center">
            <User className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-muted-foreground">No interviews planned</p>
            <p className="text-sm text-zinc-500 mt-1">
              Add potential customers to interview
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {interviews.map((interview) => (
              <div
                key={interview.id}
                className={cn(
                  "bg-zinc-900/50 rounded-xl border overflow-hidden transition-colors",
                  interview.status === "completed"
                    ? "border-green-500/30"
                    : "border-zinc-800"
                )}
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleStatus(interview.id)}
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                        interview.status === "completed"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {interview.status === "completed" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <p className="font-medium text-foreground">
                        {interview.name}
                      </p>
                      {interview.role && (
                        <p className="text-xs text-muted-foreground">
                          {interview.role}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteInterview(interview.id)}
                    className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Key Insight Section */}
                <div className="px-4 py-3 border-t border-zinc-800/50 bg-zinc-800/20">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Key Insight
                  </p>
                  {editingId === interview.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={insightDraft}
                        onChange={(e) => setInsightDraft(e.target.value)}
                        placeholder="What did you learn from this interview?"
                        className="bg-zinc-900 border-zinc-700 min-h-[80px]"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveInsight(interview.id)}
                          className="text-xs"
                        >
                          Save Insight
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleEditInsight(interview)}
                      className="cursor-pointer hover:bg-zinc-800/30 rounded p-2 -m-2 transition-colors"
                    >
                      {interview.key_insight ? (
                        <p className="text-sm text-foreground">
                          {interview.key_insight}
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-500 italic">
                          Click to add insight...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Interview Form */}
        <div className="flex gap-3">
          <Input
            value={newInterview.name}
            onChange={(e) =>
              setNewInterview({ ...newInterview, name: e.target.value })
            }
            placeholder="Person's name"
            className="flex-1 bg-zinc-800 border-zinc-700"
          />
          <Input
            value={newInterview.role}
            onChange={(e) =>
              setNewInterview({ ...newInterview, role: e.target.value })
            }
            placeholder="Role / Company"
            className="flex-1 bg-zinc-800 border-zinc-700"
          />
          <Button
            onClick={handleAddInterview}
            disabled={!newInterview.name.trim()}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      {/* Mom Test Questions */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Mom Test Questions
        </h3>
        <p className="text-xs text-muted-foreground">
          Good questions ask about past behavior, not future intentions
        </p>

        {questions.length === 0 ? (
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 text-center">
            <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No questions added yet
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {questions.map((question, index) => (
              <li
                key={index}
                className="flex items-start gap-3 bg-zinc-900/50 rounded-lg border border-zinc-800 p-3 group"
              >
                <span className="text-xs text-zinc-500 mt-0.5">
                  {index + 1}.
                </span>
                <p className="flex-1 text-sm text-foreground">{question}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteQuestion(index)}
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Add Question Form */}
        <div className="flex gap-3">
          <Input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="e.g., When was the last time you experienced this problem?"
            className="flex-1 bg-zinc-800 border-zinc-700"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddQuestion();
              }
            }}
          />
          <Button onClick={handleAddQuestion} disabled={!newQuestion.trim()}>
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
