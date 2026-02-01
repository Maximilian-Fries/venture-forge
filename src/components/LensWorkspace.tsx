import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, Lock, Unlock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { chatWithSpecialist, critiqueAnswer, type SpecialistType } from "@/lib/agents/lens-specialists";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
}

interface SkepticVerdict {
  score: number;
  critiques: string[];
}

interface LensWorkspaceProps {
  lensId: string;
  lensName: string;
  lensDescription: string;
  specialistType: SpecialistType;
  onComplete: (answer: string, score: number) => void;
}

export function LensWorkspace({
  lensId,
  lensName,
  lensDescription,
  specialistType,
  onComplete,
}: LensWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Let's work on your ${lensName}. ${lensDescription}\n\nTell me your initial thoughts, and I'll help you craft a strong answer.`,
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [draftAnswer, setDraftAnswer] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [verdict, setVerdict] = useState<SkepticVerdict | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: chatInput };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsLoading(true);

    try {
      const result = await chatWithSpecialist(
        specialistType,
        lensId,
        chatInput,
        messages,
        draftAnswer
      );

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.message,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // If the specialist suggested text, offer to add it to draft
      if (result.suggestedDraft) {
        setDraftAnswer(result.suggestedDraft);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "I'm having trouble connecting. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLockAndEvaluate = async () => {
    if (!draftAnswer.trim()) return;

    setIsLocked(true);
    setIsCritiquing(true);

    try {
      const result = await critiqueAnswer(lensId, lensName, draftAnswer);
      setVerdict(result);

      // Add skeptic feedback to chat
      const skepticMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `**Skeptic Evaluation: ${result.score}/100**\n\n${result.critiques.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
      };
      setMessages((prev) => [...prev, skepticMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsCritiquing(false);
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
    setVerdict(null);
  };

  const handleAcceptVerdict = () => {
    if (verdict) {
      onComplete(draftAnswer, verdict.score);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
      {/* Left Panel: Chat with Specialist */}
      <div className="flex flex-col bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              {specialistType === "visionary" ? "Visionary" : "Strategist"}
            </h3>
            <p className="text-xs text-muted-foreground">Drafting: {lensName}</p>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 max-w-[90%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    msg.role === "user" ? "bg-zinc-700" : "bg-primary/20"
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div
                  className={cn(
                    "p-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary/20 text-foreground rounded-tr-none"
                      : "bg-zinc-800 text-zinc-300 rounded-tl-none"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-zinc-800 p-3 rounded-xl rounded-tl-none">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-zinc-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="flex gap-2"
          >
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask for help drafting..."
              className="bg-zinc-800 border-zinc-700 focus:border-primary"
              disabled={isLoading || isCritiquing}
            />
            <Button type="submit" size="icon" disabled={isLoading || !chatInput.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Right Panel: Draft Form */}
      <div className="flex flex-col bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{lensName}</h3>
            <p className="text-xs text-muted-foreground">Your answer</p>
          </div>
          {verdict && (
            <div
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium",
                verdict.score >= 70
                  ? "bg-green-500/20 text-green-400"
                  : verdict.score >= 40
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-red-500/20 text-red-400"
              )}
            >
              Score: {verdict.score}/100
            </div>
          )}
        </div>

        <div className="flex-1 p-4">
          <Textarea
            value={draftAnswer}
            onChange={(e) => setDraftAnswer(e.target.value)}
            placeholder={`Write your ${lensName.toLowerCase()} here...`}
            className="h-full min-h-[300px] bg-zinc-800 border-zinc-700 focus:border-primary resize-none"
            disabled={isLocked}
          />
        </div>

        {/* Verdict Critiques */}
        {verdict && verdict.critiques.length > 0 && (
          <div className="px-4 pb-4">
            <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                Skeptic Critiques
              </div>
              <ul className="text-sm text-zinc-400 space-y-1">
                {verdict.critiques.map((critique, i) => (
                  <li key={i}>• {critique}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-zinc-800 flex gap-3">
          {!isLocked ? (
            <Button
              className="flex-1"
              onClick={handleLockAndEvaluate}
              disabled={!draftAnswer.trim() || isCritiquing}
            >
              {isCritiquing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Lock & Evaluate
                </>
              )}
            </Button>
          ) : (
            <>
              <Button variant="outline" className="flex-1" onClick={handleUnlock}>
                <Unlock className="w-4 h-4 mr-2" />
                Refine Answer
              </Button>
              <Button className="flex-1" onClick={handleAcceptVerdict}>
                Accept Verdict
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
