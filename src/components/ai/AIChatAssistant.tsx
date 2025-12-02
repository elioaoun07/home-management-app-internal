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
import {
  Check,
  Clock,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tokens?: number;
}

interface Conversation {
  id: string; // This is the session_id
  title: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
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
  "Check my recurring payments",
  "Am I on track for my goals?",
];

// Generate a unique session ID for grouping conversations
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Max messages to send as context (to limit token usage)
const MAX_CONTEXT_MESSAGES = 20;

export default function AIChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() =>
    generateSessionId()
  );
  const [currentConversationTitle, setCurrentConversationTitle] =
    useState<string>("New Conversation");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [showUsage, setShowUsage] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const themeClasses = useThemeClasses();

  // Fetch initial usage stats when opening
  useEffect(() => {
    if (isOpen && !usage) {
      fetchUsageStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Fetch conversations when history panel opens
  useEffect(() => {
    if (showHistory) {
      fetchConversations();
    }
  }, [showHistory]);

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

  const fetchConversations = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await fetch("/api/ai-chat/conversations");
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadConversation = async (conversation: Conversation) => {
    try {
      setIsLoading(true);
      setShowHistory(false);

      // Fetch messages for this session (conv.id IS the session_id)
      const response = await fetch(
        `/api/ai-chat?sessionId=${conversation.id}&limit=100`
      );
      if (response.ok) {
        const data = await response.json();

        // Handle new format (individual messages with role field)
        const messages = data.messages || data.chatHistory || [];
        const loadedMessages: ChatMessage[] = [];

        // Check if it's the new format (has 'role' field) or old format (has 'user_message' field)
        if (messages.length > 0 && messages[0].role) {
          // New format: each message is separate
          messages.forEach(
            (msg: {
              role: string;
              content: string;
              created_at: string;
              input_tokens?: number;
              output_tokens?: number;
              is_edited?: boolean;
            }) => {
              if (msg.role === "user" || msg.role === "assistant") {
                loadedMessages.push({
                  role: msg.role as "user" | "assistant",
                  content: msg.content,
                  timestamp: new Date(msg.created_at),
                  tokens: (msg.input_tokens || 0) + (msg.output_tokens || 0),
                });
              }
            }
          );
        } else {
          // Old format: user_message + assistant_response paired
          messages
            .sort(
              (a: { created_at: string }, b: { created_at: string }) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            )
            .forEach(
              (log: {
                user_message: string;
                assistant_response: string;
                created_at: string;
                output_tokens?: number;
              }) => {
                loadedMessages.push({
                  role: "user",
                  content: log.user_message,
                  timestamp: new Date(log.created_at),
                });
                loadedMessages.push({
                  role: "assistant",
                  content: log.assistant_response,
                  timestamp: new Date(log.created_at),
                  tokens: log.output_tokens,
                });
              }
            );
        }

        setMessages(loadedMessages);
        setCurrentSessionId(conversation.id);
        setCurrentConversationTitle(conversation.title);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
      setError("Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(
        `/api/ai-chat/conversations?sessionId=${sessionId}`,
        {
          method: "DELETE",
        }
      );
      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== sessionId));
        // If we deleted the current conversation, start fresh
        if (sessionId === currentSessionId) {
          startNewConversation();
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentSessionId(generateSessionId());
    setCurrentConversationTitle("New Conversation");
    setError(null);
    setShowHistory(false);
    setEditingIndex(null);
  };

  // Start editing a user message
  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditContent(messages[index].content);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingIndex(null);
    setEditContent("");
  };

  // Submit edited message (resend from that point)
  const submitEdit = async () => {
    if (editingIndex === null || !editContent.trim() || isLoading) return;

    const editedContent = editContent.trim();

    // Remove all messages from the edited one onwards
    const messagesBeforeEdit = messages.slice(0, editingIndex);
    setMessages(messagesBeforeEdit);
    setEditingIndex(null);
    setEditContent("");

    // Send the edited message as a new message
    // This will add it to history and get a new response
    await sendMessage(editedContent, messagesBeforeEdit);
  };

  // Regenerate the last assistant response
  const regenerateResponse = async () => {
    if (messages.length < 2 || isLoading) return;

    // Find the last user message
    let lastUserIndex = messages.length - 1;
    while (lastUserIndex >= 0 && messages[lastUserIndex].role !== "user") {
      lastUserIndex--;
    }

    if (lastUserIndex < 0) return;

    const lastUserMessage = messages[lastUserIndex].content;

    // Remove the last assistant response(s)
    const messagesUpToUser = messages.slice(0, lastUserIndex + 1);
    const contextMessages = messagesUpToUser.slice(0, -1); // Exclude the message we're resending

    setMessages(messagesUpToUser);

    // Resend the last user message to get a new response
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: lastUserMessage,
          chatHistory: contextMessages.slice(-MAX_CONTEXT_MESSAGES),
          includeContext: true,
          sessionId: currentSessionId,
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

      if (data.usage) {
        setUsage(data.usage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when sheet opens
  useEffect(() => {
    if (isOpen && !showHistory) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, showHistory]);

  const sendMessage = useCallback(
    async (messageText: string, existingMessages?: ChatMessage[]) => {
      if (!messageText.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: messageText.trim(),
        timestamp: new Date(),
      };

      // Use provided messages or current messages
      const baseMessages = existingMessages ?? messages;
      setMessages([...baseMessages, userMessage]);
      setInput("");
      setIsLoading(true);
      setError(null);

      // Only send last N messages as context to limit token usage
      const contextMessages = baseMessages.slice(-MAX_CONTEXT_MESSAGES);

      try {
        const response = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText.trim(),
            chatHistory: contextMessages,
            includeContext: true,
            sessionId: currentSessionId,
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

        // Update conversation title on first message
        if (baseMessages.length === 0) {
          const title =
            messageText.trim().slice(0, 50) +
            (messageText.length > 50 ? "..." : "");
          setCurrentConversationTitle(title);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, currentSessionId]
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
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
                    {showHistory
                      ? "Conversation History"
                      : currentConversationTitle}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* History Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className={cn(
                    "h-8 w-8 p-0 rounded-full",
                    showHistory ? "bg-violet-500/20" : "",
                    themeClasses.textMuted,
                    "hover:text-white"
                  )}
                  title="Chat History"
                >
                  <Clock className="h-4 w-4" />
                </Button>
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
                {/* New Chat Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startNewConversation}
                  className={cn(
                    "h-8 w-8 p-0 rounded-full",
                    themeClasses.textMuted,
                    "hover:text-white"
                  )}
                  title="New Conversation"
                >
                  <Plus className="h-4 w-4" />
                </Button>
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
                  Context limited to last {MAX_CONTEXT_MESSAGES} messages to
                  save tokens
                </p>
              </div>
            )}
          </SheetHeader>

          {/* History Panel */}
          {showHistory ? (
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center h-32">
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
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare
                    className={cn(
                      "h-12 w-12 mx-auto mb-3 opacity-30",
                      themeClasses.textMuted
                    )}
                  />
                  <p className={cn("text-sm", themeClasses.textMuted)}>
                    No conversations yet
                  </p>
                  <p className={cn("text-xs mt-1", themeClasses.textMuted)}>
                    Start chatting to see history here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => loadConversation(conv)}
                      className={cn(
                        "w-full p-3 rounded-lg text-left transition-all cursor-pointer",
                        "border border-white/10 hover:border-violet-500/50",
                        "hover:bg-violet-500/10",
                        conv.id === currentSessionId &&
                          "border-violet-500/50 bg-violet-500/10"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              themeClasses.labelText
                            )}
                          >
                            {conv.title}
                          </p>
                          <p
                            className={cn(
                              "text-xs mt-1",
                              themeClasses.textMuted
                            )}
                          >
                            {conv.messageCount} messages •{" "}
                            {formatDate(conv.updatedAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => deleteConversation(conv.id, e)}
                          className={cn(
                            "h-6 w-6 p-0 rounded-full shrink-0 flex items-center justify-center",
                            "text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                          )}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
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
                          "flex group",
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        )}
                      >
                        <div className="flex flex-col max-w-[85%]">
                          {/* Edit mode for user messages */}
                          {editingIndex === idx && message.role === "user" ? (
                            <div className="space-y-2">
                              <textarea
                                ref={editInputRef}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    submitEdit();
                                  }
                                  if (e.key === "Escape") {
                                    cancelEditing();
                                  }
                                }}
                                className={cn(
                                  "w-full p-3 rounded-xl text-sm resize-none",
                                  "bg-violet-600/20 border border-violet-500/50",
                                  "text-white placeholder:text-white/40",
                                  "focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                )}
                                rows={3}
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelEditing}
                                  className="h-7 px-2 text-xs"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={submitEdit}
                                  disabled={!editContent.trim() || isLoading}
                                  className="h-7 px-2 text-xs bg-violet-600 hover:bg-violet-500"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Send
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div
                                className={cn(
                                  "rounded-2xl px-4 py-3",
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

                              {/* Action buttons - show on hover */}
                              <div
                                className={cn(
                                  "flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity",
                                  message.role === "user"
                                    ? "justify-end"
                                    : "justify-start"
                                )}
                              >
                                {message.role === "user" && !isLoading && (
                                  <button
                                    onClick={() => startEditing(idx)}
                                    className={cn(
                                      "flex items-center gap-1 px-2 py-1 rounded text-[10px]",
                                      "text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
                                    )}
                                    title="Edit and resend from here"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Edit
                                  </button>
                                )}
                                {message.role === "assistant" &&
                                  idx === messages.length - 1 &&
                                  !isLoading && (
                                    <button
                                      onClick={regenerateResponse}
                                      className={cn(
                                        "flex items-center gap-1 px-2 py-1 rounded text-[10px]",
                                        themeClasses.textMuted,
                                        "hover:text-white hover:bg-white/10 transition-colors"
                                      )}
                                      title="Regenerate response"
                                    >
                                      <RefreshCw className="h-3 w-3" />
                                      Regenerate
                                    </button>
                                  )}
                              </div>
                            </>
                          )}
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
                            <span
                              className={cn("text-sm", themeClasses.textMuted)}
                            >
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
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
