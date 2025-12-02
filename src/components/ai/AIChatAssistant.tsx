"use client";

import {
  BarChart3Icon,
  SparklesIcon,
} from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tokens?: number;
}

interface UsageStats {
  requestTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  monthlyUsed: number;
  monthlyLimit: number;
  monthlyPercentage: number;
  responseTimeMs?: number;
}

const SUGGESTED_PROMPTS = [
  "Analyze my spending this month",
  "Where can I save money?",
  "What's my budget status?",
  "Show me my top expenses",
];

// Generate a unique session ID for grouping conversations
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

export default function AIChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [showUsage, setShowUsage] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const themeClasses = useThemeClasses();

  // Fetch initial usage stats when opening
  useEffect(() => {
    if (isOpen && !usage) {
      fetchUsageStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchUsageStats = async () => {
    try {
      const response = await fetch("/api/ai-chat");
      if (response.ok) {
        const data = await response.json();
        setUsage(data.usage);
      }
    } catch (err) {
      console.error("Failed to fetch usage stats:", err);
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: messageText.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText.trim(),
            chatHistory: messages,
            includeContext: true,
            sessionId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to get response");
        }

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.message,
          timestamp: new Date(data.timestamp),
          tokens: data.usage?.requestTokens,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Update usage stats
        if (data.usage) {
          setUsage(data.usage);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, sessionId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <>
      {/* Floating AI Button */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            className={cn(
              "fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg",
              "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500",
              "border border-violet-400/30",
              "transition-all duration-300 hover:scale-105",
              "flex items-center justify-center"
            )}
            size="icon"
          >
            <SparklesIcon className="h-6 w-6 text-white" />
            <span className="sr-only">Open AI Assistant</span>
          </Button>
        </SheetTrigger>

        <SheetContent
          side="right"
          className={cn(
            "w-full sm:w-[400px] sm:max-w-[400px] p-0 flex flex-col",
            themeClasses.surfaceBg,
            "border-l border-white/10"
          )}
        >
          {/* Header */}
          <SheetHeader className="p-4 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center">
                  <SparklesIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <SheetTitle
                    className={cn("text-lg", themeClasses.headerText)}
                  >
                    Budget AI
                  </SheetTitle>
                  <p className={cn("text-xs", themeClasses.textMuted)}>
                    Your personal finance assistant
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Usage Stats Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUsage(!showUsage)}
                  className={cn(
                    "h-8 w-8 p-0 rounded-full",
                    showUsage ? "bg-violet-500/20" : "",
                    themeClasses.textMuted,
                    "hover:text-white"
                  )}
                  title="Token Usage"
                >
                  <BarChart3Icon className="h-4 w-4" />
                </Button>
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearChat}
                    className={cn(
                      "text-xs",
                      themeClasses.textMuted,
                      "hover:text-white"
                    )}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Usage Stats Panel */}
            {showUsage && usage && (
              <div
                className={cn(
                  "mt-3 p-3 rounded-lg",
                  "bg-white/5 border border-white/10"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      themeClasses.labelText
                    )}
                  >
                    Monthly Token Usage
                  </span>
                  <span className={cn("text-xs", themeClasses.textMuted)}>
                    {usage.monthlyPercentage.toFixed(1)}%
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      usage.monthlyPercentage > 80
                        ? "bg-red-500"
                        : usage.monthlyPercentage > 50
                          ? "bg-yellow-500"
                          : "bg-emerald-500"
                    )}
                    style={{
                      width: `${Math.min(usage.monthlyPercentage, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className={themeClasses.textMuted}>
                    {(usage.monthlyUsed / 1000).toFixed(1)}k used
                  </span>
                  <span className={themeClasses.textMuted}>
                    {((usage.monthlyLimit - usage.monthlyUsed) / 1000).toFixed(
                      0
                    )}
                    k remaining
                  </span>
                </div>
                <p
                  className={cn(
                    "text-[10px] mt-2 text-center",
                    themeClasses.textMuted
                  )}
                >
                  ~{Math.floor((usage.monthlyLimit - usage.monthlyUsed) / 1000)}{" "}
                  conversations left this month
                </p>
              </div>
            )}
          </SheetHeader>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 rounded-full bg-gradient-to-r from-violet-600/20 to-indigo-600/20 flex items-center justify-center mb-4">
                  <SparklesIcon className="h-8 w-8 text-violet-400" />
                </div>
                <h3
                  className={cn(
                    "text-lg font-medium mb-2",
                    themeClasses.headerText
                  )}
                >
                  How can I help you today?
                </h3>
                <p
                  className={cn(
                    "text-sm mb-6 max-w-[280px]",
                    themeClasses.textMuted
                  )}
                >
                  Ask me about your spending, budgets, or get personalized
                  savings tips.
                </p>

                {/* Suggested Prompts */}
                <div className="grid grid-cols-1 gap-2 w-full max-w-[300px]">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(prompt)}
                      className={cn(
                        "p-3 rounded-lg text-left text-sm transition-all",
                        "border border-white/10 hover:border-violet-500/50",
                        "hover:bg-violet-500/10",
                        themeClasses.labelText
                      )}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                          : cn(
                              "bg-white/5 border border-white/10",
                              themeClasses.labelText
                            )
                      )}
                    >
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </div>
                      <div
                        className={cn(
                          "text-[10px] mt-1 opacity-60 flex items-center gap-2",
                          message.role === "user"
                            ? "text-white/70 justify-end"
                            : themeClasses.textMuted
                        )}
                      >
                        <span>
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {message.tokens && (
                          <span className="opacity-70">
                            • {message.tokens} tokens
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3",
                        "bg-white/5 border border-white/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span
                            className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                        <span className={cn("text-sm", themeClasses.textMuted)}>
                          Thinking...
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="flex justify-center">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400 text-sm">
                      {error}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 p-4 border-t border-white/10"
          >
            <div
              className={cn(
                "flex items-end gap-2 p-2 rounded-xl",
                "bg-white/5 border border-white/10",
                "focus-within:border-violet-500/50 transition-colors"
              )}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your budget..."
                rows={1}
                className={cn(
                  "flex-1 bg-transparent border-none outline-none resize-none",
                  "text-sm py-2 px-2 max-h-[100px]",
                  themeClasses.labelText,
                  "placeholder:text-white/30"
                )}
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "h-9 px-4 rounded-lg",
                  "bg-gradient-to-r from-violet-600 to-indigo-600",
                  "hover:from-violet-500 hover:to-indigo-500",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                Send
              </Button>
            </div>
            <p
              className={cn(
                "text-[10px] text-center mt-2",
                themeClasses.textMuted
              )}
            >
              AI responses may not always be accurate. Verify important
              information.
            </p>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
