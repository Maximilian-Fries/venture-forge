import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Bot, User, CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectManifest, useManifest } from "@/hooks/useProjectManifest";
import { refinePitch } from "@/lib/agents/venture-associate";

interface Message {
    id: string;
    role: "assistant" | "user";
    content: string;
}

interface PitchRefinementProps {
    initialPitch: string;
    topic: string; // e.g. "Venture Description"
    onComplete: (description: string) => void;
}

const ANALYSIS_TIMEOUT = 15000; // 15 seconds timeout

// localStorage keys for persistence
const STORAGE_KEY_DRAFT = 'venture_pitch_draft';
const STORAGE_KEY_CHAT = 'venture_chat_history';

export function PitchRefinement({ initialPitch, topic, onComplete }: PitchRefinementProps) {
    const { lockDescription, savePitchHistory } = useProjectManifest();
    const manifest = useManifest();
    const [hasInitialized, setHasInitialized] = useState(false);
    const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
    const [latestRefinedPitch, setLatestRefinedPitch] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const getWelcomeMessage = useCallback((): Message => ({
        id: "welcome",
        role: "assistant",
        content: initialPitch.trim()
            ? `Analyzing your pitch...`
            : `I'm your Venture Associate. Let's build your venture thesis together.\n\nTell me: what problem have you personally experienced or observed that really frustrates you?`
    }), [initialPitch]);

    // Initialize messages from localStorage if available (for immediate restore on refresh)
    const getInitialMessages = useCallback((): Message[] => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_CHAT);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error('[PitchRefinement] Failed to parse localStorage chat:', e);
        }
        return [getWelcomeMessage()];
    }, [getWelcomeMessage]);

    // Initialize input from localStorage
    const getInitialInput = (): string => {
        try {
            return localStorage.getItem(STORAGE_KEY_DRAFT) || "";
        } catch {
            return "";
        }
    };

    const [messages, setMessages] = useState<Message[]>(getInitialMessages);
    const [input, setInput] = useState(getInitialInput);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Sync with saved history when manifest loads (fixes reload bug)
    useEffect(() => {
        if (!hasInitialized && manifest?.pitch_history && manifest.pitch_history.length > 0) {
            setMessages(manifest.pitch_history);
            setHasInitialized(true);
            setHasAutoTriggered(true); // Don't auto-trigger if we have history
        } else if (!hasInitialized) {
            // No manifest yet or no history - mark as initialized after a short delay
            // This prevents race condition where hasInitialized stays false
            const timer = setTimeout(() => {
                setHasInitialized(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [manifest, hasInitialized]);

    // Function to analyze pitch (used for both auto and retry)
    const analyzePitch = useCallback(async () => {
        if (!initialPitch.trim() || initialPitch.trim().length < 20) return;

        console.log('[PitchRefinement] Analyzing pitch:', initialPitch.substring(0, 50) + '...');
        setIsLoading(true);
        setAnalysisError(null);

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT);

        try {
            // Create a "user" message from the initial pitch
            const userMsg: Message = {
                id: 'initial-pitch',
                role: 'user',
                content: initialPitch
            };

            // Race between API call and timeout
            const result = await Promise.race([
                refinePitch(initialPitch, [userMsg]),
                new Promise<never>((_, reject) => {
                    controller.signal.addEventListener('abort', () => {
                        reject(new Error('Analysis timed out after 15 seconds'));
                    });
                })
            ]);

            clearTimeout(timeoutId);

            // Combine message and refinedPitch for display
            // If refinedPitch exists and message is just an intro, show both
            let displayContent = result.message;
            if (result.refinedPitch) {
                // If message is short/intro-like and refinedPitch has the real content, combine them
                const messageIsIntro = result.message.length < 200 &&
                    (result.message.includes('Here is') ||
                     result.message.includes('refined') ||
                     result.message.includes('pitch') ||
                     result.message.endsWith(':'));

                if (messageIsIntro && result.refinedPitch.length > result.message.length) {
                    displayContent = result.message + '\n\n' + result.refinedPitch;
                } else if (result.refinedPitch.length > result.message.length * 2) {
                    // refinedPitch is much longer, probably the main content
                    displayContent = result.message + '\n\n' + result.refinedPitch;
                }
                setLatestRefinedPitch(result.refinedPitch);
            }

            const aiMsg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: displayContent
            };

            // Replace the "Analyzing..." message with the actual result
            setMessages([userMsg, aiMsg]);
        } catch (error) {
            clearTimeout(timeoutId);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[PitchRefinement] Analyze error:', errorMessage);
            setAnalysisError(errorMessage);
            setMessages([{
                id: 'error',
                role: 'assistant',
                content: `I had trouble analyzing your pitch: ${errorMessage}\n\nClick "Retry" or type your pitch below to try again.`
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [initialPitch]);

    // AUTO-TRIGGER: Immediately analyze the pitch when component mounts with a substantive pitch
    useEffect(() => {
        if (hasAutoTriggered || !hasInitialized) return;
        if (!initialPitch.trim() || initialPitch.trim().length < 20) return;

        // Prevent re-triggering if we already have conversation history (from localStorage or manifest)
        // messages[0] is welcome message, so >1 means we have real content
        if (messages.length > 1) {
            console.log('[PitchRefinement] Skipping auto-analyze - already have', messages.length, 'messages');
            setHasAutoTriggered(true);
            return;
        }

        // Also check if the first message is NOT the "Analyzing..." welcome message
        // (could be restored content from localStorage)
        if (messages.length === 1 && messages[0].id !== 'welcome') {
            console.log('[PitchRefinement] Skipping auto-analyze - restored message detected');
            setHasAutoTriggered(true);
            return;
        }

        setHasAutoTriggered(true);
        analyzePitch();
    }, [hasInitialized, hasAutoTriggered, initialPitch, analyzePitch, messages]);

    // Retry handler
    const handleRetry = () => {
        setAnalysisError(null);
        analyzePitch();
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Persist history whenever messages change (but only after initialization)
    useEffect(() => {
        if (hasInitialized && messages.length > 0) {
            savePitchHistory(messages);
        }
    }, [messages, savePitchHistory, hasInitialized]);

    // Persist messages to localStorage for immediate restore on refresh
    useEffect(() => {
        if (messages.length > 0 && messages[0].id !== 'welcome') {
            try {
                localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(messages));
            } catch (e) {
                console.error('[PitchRefinement] Failed to save chat to localStorage:', e);
            }
        }
    }, [messages]);

    // Persist draft input to localStorage
    useEffect(() => {
        try {
            if (input) {
                localStorage.setItem(STORAGE_KEY_DRAFT, input);
            } else {
                localStorage.removeItem(STORAGE_KEY_DRAFT);
            }
        } catch (e) {
            console.error('[PitchRefinement] Failed to save draft to localStorage:', e);
        }
    }, [input]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput("");
        setIsLoading(true);

        try {
            const result = await refinePitch(input, newHistory);

            // Combine message and refinedPitch for display if needed
            let displayContent = result.message;
            if (result.refinedPitch) {
                const messageIsIntro = result.message.length < 200 &&
                    (result.message.includes('Here is') ||
                     result.message.includes('refined') ||
                     result.message.includes('pitch') ||
                     result.message.endsWith(':'));

                if (messageIsIntro && result.refinedPitch.length > result.message.length) {
                    displayContent = result.message + '\n\n' + result.refinedPitch;
                } else if (result.refinedPitch.length > result.message.length * 2) {
                    displayContent = result.message + '\n\n' + result.refinedPitch;
                }
                setLatestRefinedPitch(result.refinedPitch);
            }

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: displayContent
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error(error);
            const errorMsg: Message = {
                id: Date.now().toString(),
                role: "assistant",
                content: "I'm having trouble connecting to the network. Please try again."
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLock = () => {
        // Use the latest refined pitch if available, otherwise fall back to initial pitch
        const finalDescription = latestRefinedPitch || initialPitch;
        console.log('[PitchRefinement] Locking description:', finalDescription.substring(0, 50) + '...');

        // Clear localStorage since the pitch is now locked
        try {
            localStorage.removeItem(STORAGE_KEY_DRAFT);
            localStorage.removeItem(STORAGE_KEY_CHAT);
        } catch (e) {
            console.error('[PitchRefinement] Failed to clear localStorage:', e);
        }

        lockDescription(finalDescription);
        onComplete(finalDescription);
    };

    // Helper to extract display content from potentially raw JSON responses
    const getDisplayContent = (content: string): string => {
        if (!content) return content;

        // Check if content looks like JSON (starts with { and contains "message")
        const trimmed = content.trim();
        if (trimmed.startsWith('{') && trimmed.includes('"message"')) {
            try {
                const parsed = JSON.parse(trimmed);
                // Return message or refinedPitch, whichever is more substantive
                if (parsed.refinedPitch && parsed.refinedPitch.length > (parsed.message?.length || 0)) {
                    return parsed.refinedPitch;
                }
                return parsed.message || content;
            } catch {
                // Try manual extraction if JSON.parse fails
                const messageMatch = trimmed.match(/"message"\s*:\s*"([\s\S]*?)(?:"\s*,|"\s*})/);
                if (messageMatch) {
                    return messageMatch[1]
                        .replace(/\\n/g, '\n')
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\');
                }
            }
        }
        return content;
    };

    return (
        <div className="flex flex-col h-[600px] glass-panel rounded-2xl overflow-hidden animate-fade-in transition-all duration-500">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Venture Associate</h3>
                        <p className="text-xs text-muted-foreground">Refining: {topic}</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/50 text-primary hover:bg-primary/20"
                    onClick={handleLock}
                >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Lock Description
                </Button>
            </div>

            {/* Chat Area */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex gap-3 max-w-[80%]",
                                msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                msg.role === "user" ? "bg-white/10" : "bg-primary/20"
                            )}>
                                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary" />}
                            </div>
                            <div className={cn(
                                "p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                                msg.role === "user"
                                    ? "bg-primary/20 text-foreground rounded-tr-none"
                                    : "bg-white/5 text-muted-foreground rounded-tl-none"
                            )}>
                                {getDisplayContent(msg.content)}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-3 max-w-[80%]">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4 text-primary" />
                            </div>
                            <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-black/20">
                {analysisError && (
                    <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm text-destructive">Analysis failed</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRetry}
                            disabled={isLoading}
                            className="border-destructive/50 text-destructive hover:bg-destructive/20"
                        >
                            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                            Retry Analysis
                        </Button>
                    </div>
                )}
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex gap-2"
                >
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Reply to refine your idea..."
                        className="bg-white/5 border-white/10 focus:border-primary"
                        disabled={isLoading}
                    />
                    <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
