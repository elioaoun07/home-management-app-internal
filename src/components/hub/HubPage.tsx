"use client";

import {
  AlertBellIcon,
  ChevronLeftIcon,
  FeedIcon,
  MessageIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
  TrophyIcon,
  XIcon,
} from "@/components/icons/FuturisticIcons";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useCreateThread,
  useDismissAlert,
  useHubAlerts,
  useHubFeed,
  useHubMessages,
  useHubStats,
  useHubThreads,
  useRealtimeMessages,
  useSendMessage,
  type HubAlert,
  type HubChatThread,
  type HubFeedItem,
  type HubMessage,
} from "@/features/hub/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// AI Chat Types
interface AIConversation {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tokens?: number;
}

// Generate session ID for AI conversations
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const MAX_CONTEXT_MESSAGES = 20;

type HubView = "chat" | "feed" | "score" | "alerts";

// Special thread ID for AI
const AI_THREAD_ID = "ai-assistant";

const viewOptions: Array<{
  id: HubView;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = [
  { id: "chat", icon: MessageIcon, label: "Chat" },
  { id: "feed", icon: FeedIcon, label: "Feed" },
  { id: "score", icon: TrophyIcon, label: "Score" },
  { id: "alerts", icon: AlertBellIcon, label: "Alerts" },
];

export default function HubPage() {
  const themeClasses = useThemeClasses();
  const [activeView, setActiveView] = useState<HubView>("chat");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  return (
    <div className={cn("min-h-screen pb-24", themeClasses.bgPage)}>
      {/* Daily Pulse Header - Hide when inside a thread */}
      {!activeThreadId && (
        <div className="px-4 py-3">
          <DailyPulse />
        </div>
      )}

      {/* View Switcher - Hide when inside a thread */}
      {!activeThreadId && (
        <div className="px-4 mb-4">
          <div className="flex gap-1 p-1 rounded-2xl neo-card bg-bg-card-custom border border-white/5">
            {viewOptions.map((option) => {
              const Icon = option.icon;
              const isActive = activeView === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => setActiveView(option.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400"
                      : "text-white/50 hover:text-white/70"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* View Content */}
      <div className={cn(!activeThreadId && "px-4")}>
        {activeView === "chat" && (
          <ChatView
            activeThreadId={activeThreadId}
            setActiveThreadId={setActiveThreadId}
          />
        )}
        {activeView === "feed" && !activeThreadId && <FeedView />}
        {activeView === "score" && !activeThreadId && <ScoreboardView />}
        {activeView === "alerts" && !activeThreadId && <AlertsView />}
      </div>
    </div>
  );
}

// Daily Pulse Mini Widget
function DailyPulse() {
  const { data: stats, isLoading } = useHubStats();

  if (isLoading) {
    return (
      <div className="p-4 rounded-2xl neo-card bg-bg-card-custom border border-white/5 animate-pulse">
        <div className="h-16 bg-white/5 rounded" />
      </div>
    );
  }

  const streak = stats?.logging_streak || 0;

  return (
    <div className="p-4 rounded-2xl neo-card bg-bg-card-custom border border-white/5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-white/50 font-medium">YOUR STREAK</p>
          <p className="text-2xl font-bold text-white">
            {streak} {streak === 1 ? "day" : "days"}
            <span className="text-lg ml-2">🔥</span>
          </p>
        </div>
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            streak > 7
              ? "bg-green-500/20 text-green-400"
              : streak > 0
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-white/5 text-white/30"
          )}
        >
          <span className="text-lg font-bold">{streak}</span>
        </div>
      </div>
    </div>
  );
}

// Chat View with Threads
function ChatView({
  activeThreadId,
  setActiveThreadId,
}: {
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
}) {
  const { data, isLoading } = useHubThreads();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const threads = data?.threads || [];
  const householdId = data?.household_id;

  // Show AI conversation view
  if (activeThreadId === AI_THREAD_ID) {
    return <AIConversationView onBack={() => setActiveThreadId(null)} />;
  }

  // Show regular thread conversation
  if (activeThreadId) {
    return (
      <ThreadConversation
        threadId={activeThreadId}
        onBack={() => setActiveThreadId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl neo-card bg-bg-card-custom border border-white/5 animate-pulse"
          >
            <div className="h-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Header with Create Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Conversations</h2>
        {householdId && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            New Chat
          </button>
        )}
      </div>

      {/* AI Assistant - Always First */}
      <AIAssistantItem onClick={() => setActiveThreadId(AI_THREAD_ID)} />

      {/* Household Threads */}
      {householdId && threads.length > 0 && (
        <div className="space-y-2 mt-2">
          {threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              currentUserId={data.current_user_id}
              onClick={() => setActiveThreadId(thread.id)}
            />
          ))}
        </div>
      )}

      {/* No household message - but AI is still available */}
      {!householdId && (
        <div className="p-6 rounded-2xl neo-card bg-bg-card-custom border border-white/5 text-center mt-4">
          <MessageIcon className="w-10 h-10 mx-auto mb-2 text-blue-400/30" />
          <p className="text-sm text-white/50">
            Link with a partner in Settings to chat with your household
          </p>
        </div>
      )}

      {/* Create Thread Modal */}
      {showCreateModal && householdId && (
        <CreateThreadModal
          householdId={householdId}
          onClose={() => setShowCreateModal(false)}
          onCreated={(threadId) => {
            setShowCreateModal(false);
            setActiveThreadId(threadId);
          }}
        />
      )}
    </>
  );
}

// Thread Item in List
function ThreadItem({
  thread,
  currentUserId,
  onClick,
}: {
  thread: HubChatThread;
  currentUserId: string;
  onClick: () => void;
}) {
  const lastMessage = thread.last_message;
  const isMyLastMessage = lastMessage?.sender_user_id === currentUserId;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-xl neo-card bg-bg-card-custom border transition-all flex items-center gap-3 text-left",
        thread.unread_count > 0
          ? "border-blue-500/30 bg-blue-500/5"
          : "border-white/5 hover:border-white/10"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0",
          thread.unread_count > 0
            ? "bg-gradient-to-br from-blue-500/30 to-purple-500/30"
            : "bg-gradient-to-br from-blue-500/20 to-purple-500/20"
        )}
      >
        {thread.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              "text-sm font-semibold truncate",
              thread.unread_count > 0 ? "text-white" : "text-white/90"
            )}
          >
            {thread.title}
          </h3>
          {thread.unread_count > 0 && (
            <span className="relative flex items-center justify-center">
              <span className="absolute w-5 h-5 rounded-full bg-blue-500/50 animate-ping" />
              <span className="relative px-2 py-0.5 min-w-[20px] text-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold shadow-lg shadow-blue-500/30">
                {thread.unread_count}
              </span>
            </span>
          )}
        </div>
        {lastMessage ? (
          <p
            className={cn(
              "text-xs truncate mt-0.5",
              thread.unread_count > 0
                ? "text-white/70 font-medium"
                : "text-white/50"
            )}
          >
            {isMyLastMessage ? "You: " : ""}
            {lastMessage.content}
          </p>
        ) : (
          <p className="text-xs text-white/30 italic mt-0.5">No messages yet</p>
        )}
      </div>

      {/* Time */}
      <span
        className={cn(
          "text-xs shrink-0",
          thread.unread_count > 0
            ? "text-blue-400 font-medium"
            : "text-white/30"
        )}
      >
        {formatRelativeTime(thread.last_message_at)}
      </span>
    </button>
  );
}

// AI Assistant Item - Always at top
function AIAssistantItem({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 rounded-xl neo-card bg-bg-card-custom border border-violet-500/20 hover:border-violet-500/40 transition-all flex items-center gap-3 text-left"
    >
      {/* AI Icon */}
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
        <SparklesIcon className="w-6 h-6 text-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Budget AI</h3>
          <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-medium">
            AI
          </span>
        </div>
        <p className="text-xs text-white/50 mt-0.5">
          Ask anything about your finances
        </p>
      </div>

      {/* Arrow */}
      <ChevronLeftIcon className="w-5 h-5 text-white/30 rotate-180" />
    </button>
  );
}

// AI Conversation View - Shows list of AI conversations or active chat
function AIConversationView({ onBack }: { onBack: () => void }) {
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch AI conversations
  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/ai-chat/conversations");
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to load conversations");
      }
    } catch (err) {
      console.error("Failed to fetch AI conversations:", err);
      setError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Scroll to top when entering
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handle back from conversation - refetch list
  const handleBackFromConversation = () => {
    setActiveSessionId(null);
    fetchConversations(); // Refresh the list
  };

  // Show active AI chat
  if (activeSessionId) {
    return (
      <AIThreadConversation
        sessionId={activeSessionId}
        onBack={handleBackFromConversation}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-bg-card-custom">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">Budget AI</h2>
            <p className="text-xs text-white/50">
              {conversations.length} conversation
              {conversations.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveSessionId(generateSessionId())}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          New
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-white/5 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl neo-card bg-bg-card-custom border border-red-500/20 text-center">
            <XIcon className="w-12 h-12 mx-auto mb-3 text-red-400/50" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Error Loading Chats
            </h3>
            <p className="text-sm text-red-400/80 mb-4">{error}</p>
            <button
              onClick={fetchConversations}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 rounded-2xl neo-card bg-bg-card-custom border border-white/5 text-center">
            <SparklesIcon className="w-12 h-12 mx-auto mb-3 text-violet-400/50" />
            <h3 className="text-lg font-semibold text-white mb-2">
              No AI Chats Yet
            </h3>
            <p className="text-sm text-white/50 mb-4">
              Start a conversation to get insights about your finances!
            </p>
            <button
              onClick={() => setActiveSessionId(generateSessionId())}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-medium"
            >
              Start First Chat
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveSessionId(conv.id)}
                className="w-full p-4 rounded-xl neo-card bg-bg-card-custom border border-white/5 hover:border-violet-500/30 transition-all flex items-center gap-3 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center shrink-0">
                  <SparklesIcon className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">
                    {conv.title}
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    {conv.messageCount} message
                    {conv.messageCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-xs text-white/30 shrink-0">
                  {formatRelativeTime(conv.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// AI Thread Conversation - Chat with AI
function AIThreadConversation({
  sessionId,
  onBack,
}: {
  sessionId: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [conversationTitle, setConversationTitle] = useState("New Chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation history
  useEffect(() => {
    const loadHistory = async () => {
      // Check if this is a brand new session (just generated, has no messages yet)
      // New sessions have format: session_<timestamp>_<random>
      // If timestamp is within last 5 seconds, it's brand new
      const isNewSession = (() => {
        if (!sessionId.startsWith("session_")) return false;
        const parts = sessionId.split("_");
        if (parts.length < 2) return false;
        const timestamp = parseInt(parts[1], 10);
        if (isNaN(timestamp)) return false;
        return Date.now() - timestamp < 5000; // Created within last 5 seconds
      })();

      if (isNewSession) {
        // Brand new session, no history to load
        setIsLoadingHistory(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/ai-chat?sessionId=${sessionId}&limit=100`
        );
        if (response.ok) {
          const data = await response.json();
          const loadedMessages: AIChatMessage[] = [];
          const msgList = data.messages || data.chatHistory || [];

          msgList.forEach(
            (msg: {
              role: string;
              content: string;
              created_at: string;
              input_tokens?: number;
              output_tokens?: number;
            }) => {
              if (msg.role === "user" || msg.role === "assistant") {
                loadedMessages.push({
                  role: msg.role,
                  content: msg.content,
                  timestamp: new Date(msg.created_at),
                  tokens: (msg.input_tokens || 0) + (msg.output_tokens || 0),
                });
              }
            }
          );

          setMessages(loadedMessages);

          // Get title from first message
          if (loadedMessages.length > 0) {
            const firstUserMsg = loadedMessages.find((m) => m.role === "user");
            if (firstUserMsg) {
              setConversationTitle(
                firstUserMsg.content.slice(0, 40) +
                  (firstUserMsg.content.length > 40 ? "..." : "")
              );
            }
          }
        }
      } catch (err) {
        console.error("Failed to load AI history:", err);
      }
      setIsLoadingHistory(false);
    };
    loadHistory();
  }, [sessionId]);

  // Scroll to top when entering
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [sessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [isLoadingHistory]);

  const sendMessage = useCallback(
    async (directMessage?: string) => {
      const messageText = directMessage || input.trim();
      if (!messageText || isLoading) return;

      const userMessage: AIChatMessage = {
        role: "user",
        content: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setError(null);

      // Update title on first message
      if (messages.length === 0) {
        setConversationTitle(
          messageText.slice(0, 40) + (messageText.length > 40 ? "..." : "")
        );
      }

      try {
        const response = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            chatHistory: messages.slice(-MAX_CONTEXT_MESSAGES),
            includeContext: true,
            sessionId: currentSessionId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to get response");
        }

        const assistantMessage: AIChatMessage = {
          role: "assistant",
          content: data.message,
          timestamp: new Date(data.timestamp),
          tokens: data.usage?.requestTokens,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, currentSessionId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(generateSessionId());
    setConversationTitle("New Chat");
    setError(null);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-bg-card-custom">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">
              {conversationTitle}
            </h2>
            <p className="text-xs text-white/50">Budget AI Assistant</p>
          </div>
        </div>
        <button
          onClick={startNewChat}
          className="p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
          title="New Chat"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-36 space-y-3">
        {isLoadingHistory ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 bg-white/5 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <SparklesIcon className="w-12 h-12 mb-3 text-violet-400/30" />
            <p className="text-sm text-white/50 mb-4">
              Ask me anything about your finances!
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {[
                "Analyze my spending",
                "Where can I save?",
                "Check my budget",
                "Monthly summary",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 hover:text-white transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "px-4 py-2.5 rounded-2xl max-w-[80%]",
                  msg.role === "user"
                    ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-br-md"
                    : "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 text-white rounded-bl-md"
                )}
              >
                {msg.role === "assistant" && (
                  <p className="text-xs text-violet-300 font-medium mb-1">
                    🤖 Budget AI
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={cn(
                    "text-xs mt-1",
                    msg.role === "user" ? "text-white/60" : "text-white/40"
                  )}
                >
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 rounded-bl-md">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-violet-400 animate-spin" />
                <span className="text-sm text-white/70">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-sm text-red-400">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-[72px] left-0 right-0 px-4 py-2 border-t border-white/5 bg-bg-card-custom/95 backdrop-blur-sm z-20">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Message status indicator (sent/delivered/read) with animation
function MessageStatus({ status }: { status: "sent" | "delivered" | "read" }) {
  if (status === "sent") {
    // Single check - sent (white, visible on blue)
    return (
      <svg className="w-4 h-4 text-white/70" viewBox="0 0 16 16" fill="none">
        <path
          d="M13.5 4.5L6 12L2.5 8.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-[fadeIn_0.2s_ease-out]"
        />
      </svg>
    );
  }

  if (status === "delivered") {
    // Double check - delivered (white, visible on blue)
    return (
      <svg className="w-4 h-4 text-white/70" viewBox="0 0 16 16" fill="none">
        <path
          d="M11.5 4.5L4 12L0.5 8.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15.5 4.5L8 12L6.5 10.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-[fadeIn_0.2s_ease-out]"
        />
      </svg>
    );
  }

  // Double check - read (bright green like WhatsApp, very visible!)
  return (
    <svg
      className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.5)] transition-colors duration-300"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M11.5 4.5L4 12L0.5 8.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 4.5L8 12L6.5 10.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Thread Conversation View
function ThreadConversation({
  threadId,
  onBack,
}: {
  threadId: string;
  onBack: () => void;
}) {
  const { data, isLoading } = useHubMessages(threadId);
  const { data: threadsData } = useHubThreads();
  const sendMessage = useSendMessage();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadSeparatorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const hasScrolledToUnread = useRef(false);

  // Subscribe to realtime updates - no polling needed!
  const { isSubscribed } = useRealtimeMessages(threadId);

  // Debug: Log subscription status
  useEffect(() => {
    console.log(
      "[HubPage] Realtime subscription status:",
      isSubscribed,
      "threadId:",
      threadId
    );
  }, [isSubscribed, threadId]);

  const messages = data?.messages || [];
  const currentUserId = data?.current_user_id;
  const firstUnreadMessageId = data?.first_unread_message_id;
  const unreadCount = data?.unread_count || 0;
  const thread = threadsData?.threads.find((t) => t.id === threadId);

  // Current user's theme determines their bubble color
  // Blue theme user = blue bubbles for "me", pink for partner
  // Pink theme user = pink bubbles for "me", blue for partner
  const myTheme = theme; // "blue" or "pink"

  // Scroll to unread separator or bottom on initial load
  useEffect(() => {
    if (!isLoading && messages.length > 0 && !hasScrolledToUnread.current) {
      hasScrolledToUnread.current = true;

      // If there are unread messages, scroll to the separator (centered)
      if (firstUnreadMessageId && unreadSeparatorRef.current) {
        unreadSeparatorRef.current.scrollIntoView({
          behavior: "instant",
          block: "center",
        });
      } else {
        // No unread, scroll to bottom
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }
    }
  }, [isLoading, messages.length, firstUnreadMessageId]);

  // Reset scroll tracker when changing threads
  useEffect(() => {
    hasScrolledToUnread.current = false;
  }, [threadId]);

  // Smooth scroll to bottom when new messages arrive (after initial load)
  const prevMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMessage.mutate(
      { content: newMessage, thread_id: threadId },
      { onSuccess: () => setNewMessage("") }
    );
  };

  // Get message bubble styles based on sender and current user's theme
  const getMessageStyles = (msg: HubMessage) => {
    const isMe = msg.sender_user_id === currentUserId;
    const isSystem = msg.message_type === "system";

    if (isSystem) {
      // AI/System messages - centered with purple gradient (matches both themes)
      return {
        alignment: "justify-center",
        bubble:
          "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 text-white rounded-xl",
        timeColor: "text-white/40",
      };
    }

    if (isMe) {
      // My messages - aligned right, my theme color
      if (myTheme === "pink") {
        return {
          alignment: "justify-end",
          bubble:
            "bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-br-md",
          timeColor: "text-white/60",
        };
      } else {
        return {
          alignment: "justify-end",
          bubble:
            "bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-br-md",
          timeColor: "text-white/60",
        };
      }
    } else {
      // Partner messages - aligned left, opposite theme color
      if (myTheme === "pink") {
        // I'm pink, partner is blue
        return {
          alignment: "justify-start",
          bubble:
            "bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-bl-md",
          timeColor: "text-white/60",
        };
      } else {
        // I'm blue, partner is pink
        return {
          alignment: "justify-start",
          bubble:
            "bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-bl-md",
          timeColor: "text-white/60",
        };
      }
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col min-h-[calc(100vh-56px)]">
      {/* Thread Header - Fixed below app header */}
      <div className="fixed top-14 left-0 right-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-bg-card-custom/95 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-lg shrink-0">
            {thread?.icon || "💬"}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">
              {thread?.title || "Chat"}
            </h2>
            {thread?.description && (
              <p className="text-xs text-white/50 truncate">
                {thread.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-16" />

      {/* Messages - Scrollable area, messages stick to bottom like WhatsApp */}
      <div className="flex-1 overflow-y-auto px-4 pb-36 flex flex-col">
        {/* Spacer to push messages to bottom when few messages */}
        <div className="flex-1" />

        {/* Messages container */}
        <div className="space-y-3 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-white/5 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MessageIcon className="w-12 h-12 mb-3 text-blue-400/30" />
              <p className="text-sm text-white/50">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            messages.map((msg: HubMessage, index: number) => {
              const styles = getMessageStyles(msg);
              const isSystem = msg.message_type === "system";
              const isMe = msg.sender_user_id === currentUserId;
              const isFirstUnread = msg.id === firstUnreadMessageId;

              return (
                <div key={msg.id}>
                  {/* Unread messages separator */}
                  {isFirstUnread && unreadCount > 0 && (
                    <div
                      ref={unreadSeparatorRef}
                      className="flex items-center gap-3 py-4 my-2"
                    >
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                      <span className="px-3 py-1 text-xs font-medium text-amber-400 bg-amber-500/10 rounded-full border border-amber-500/20 animate-pulse">
                        {unreadCount} unread message{unreadCount > 1 ? "s" : ""}
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                    </div>
                  )}

                  <div className={cn("flex", styles.alignment)}>
                    <div
                      className={cn(
                        "px-4 py-2.5 rounded-2xl",
                        isSystem ? "max-w-[90%]" : "max-w-[80%]",
                        styles.bubble
                      )}
                    >
                      {isSystem && (
                        <p className="text-xs text-violet-300 font-medium mb-1">
                          🤖 System
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      <div
                        className={cn(
                          "flex items-center gap-1 mt-1",
                          isMe ? "justify-end" : ""
                        )}
                      >
                        <span className={cn("text-xs", styles.timeColor)}>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {/* Message status icons for sent messages */}
                        {isMe && !isSystem && (
                          <MessageStatus status={msg.status || "sent"} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input - Fixed at bottom, above navigation bar */}
      <div className="fixed bottom-[72px] left-0 right-0 px-4 py-2 border-t border-white/5 bg-bg-card-custom/95 backdrop-blur-sm z-20">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
            className={cn(
              "px-4 py-3 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed",
              myTheme === "pink"
                ? "bg-gradient-to-r from-pink-500 to-rose-500"
                : "bg-gradient-to-r from-blue-500 to-cyan-500"
            )}
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Create Thread Modal
function CreateThreadModal({
  householdId,
  onClose,
  onCreated,
}: {
  householdId: string;
  onClose: () => void;
  onCreated: (threadId: string) => void;
}) {
  const createThread = useCreateThread();
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("💬");

  const iconOptions = [
    "💬",
    "🏠",
    "💰",
    "🛒",
    "🍽️",
    "🎉",
    "❤️",
    "📋",
    "🎯",
    "✈️",
    "🚗",
    "🏥",
  ];

  const handleCreate = () => {
    if (!title.trim()) return;
    createThread.mutate(
      {
        title: title.trim(),
        icon,
        household_id: householdId,
      },
      {
        onSuccess: (data) => {
          onCreated(data.thread.id);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md mx-auto sm:mx-4 bg-bg-card-custom border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">New Conversation</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Icon Picker */}
        <div className="mb-4">
          <label className="block text-xs text-white/50 mb-2">
            Choose an Icon
          </label>
          <div className="flex flex-wrap gap-2">
            {iconOptions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setIcon(emoji)}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all",
                  icon === emoji
                    ? "bg-gradient-to-r from-blue-500/30 to-purple-500/30 ring-2 ring-blue-500"
                    : "bg-white/5 hover:bg-white/10"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Title Input */}
        <div className="mb-6">
          <label className="block text-xs text-white/50 mb-2">
            Conversation Name
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Groceries, Bills, Trip Planning..."
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || createThread.isPending}
            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createThread.isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Feed View - Activity stream
function FeedView() {
  const { data, isLoading } = useHubFeed();
  const feed = data?.feed || [];
  const currentUserId = data?.current_user_id;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl neo-card bg-bg-card-custom border border-white/5 animate-pulse"
          >
            <div className="h-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data?.household_id) {
    return (
      <div className="p-8 rounded-2xl neo-card bg-bg-card-custom border border-white/5 text-center">
        <FeedIcon className="w-12 h-12 mx-auto mb-3 text-green-400/50" />
        <h3 className="text-lg font-semibold text-white mb-2">No Household</h3>
        <p className="text-sm text-white/50">
          Link with a partner to see shared activity.
        </p>
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="p-8 rounded-2xl neo-card bg-bg-card-custom border border-white/5 text-center">
        <FeedIcon className="w-12 h-12 mx-auto mb-3 text-green-400/50" />
        <h3 className="text-lg font-semibold text-white mb-2">
          No Activity Yet
        </h3>
        <p className="text-sm text-white/50">
          Transactions will appear here automatically.
        </p>
      </div>
    );
  }

  const getEmoji = (type: string) => {
    switch (type) {
      case "transaction_added":
        return "💸";
      case "goal_created":
        return "🎯";
      case "goal_completed":
        return "🏆";
      case "milestone":
        return "⭐";
      default:
        return "📝";
    }
  };

  return (
    <div className="space-y-3">
      {feed.map((item: HubFeedItem) => {
        const isMe = item.user_id === currentUserId;
        return (
          <div
            key={item.id}
            className="p-4 rounded-xl neo-card bg-bg-card-custom border border-white/5 flex items-start gap-3"
          >
            <div className="text-2xl">{getEmoji(item.activity_type)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">
                <span className="font-semibold">
                  {isMe ? "You" : "Partner"}
                </span>
                <span className="text-white/50">
                  {" "}
                  {item.activity_type.replace("_", " ")}
                </span>
              </p>
              <p className="text-sm text-white/70 truncate">
                {item.title}
                {item.amount && ` - $${item.amount.toFixed(2)}`}
              </p>
              {item.subtitle && (
                <p className="text-xs text-white/40 truncate">
                  {item.subtitle}
                </p>
              )}
            </div>
            <span className="text-xs text-white/40 shrink-0">
              {formatRelativeTime(item.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Scoreboard View - Financial gamification
function ScoreboardView() {
  const { data: stats, isLoading } = useHubStats();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="p-6 rounded-2xl neo-card bg-bg-card-custom border border-white/5 animate-pulse">
          <div className="h-24 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  const myStreak = stats?.logging_streak || 0;
  const mySpent = stats?.total_spent_month || 0;
  const partner = stats?.household;

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl neo-card bg-bg-card-custom border border-white/5">
          <div className="text-2xl mb-2">🔥</div>
          <p className="text-2xl font-bold text-white">{myStreak}</p>
          <p className="text-xs text-white/50">Day Streak</p>
        </div>
        <div className="p-4 rounded-xl neo-card bg-bg-card-custom border border-white/5">
          <div className="text-2xl mb-2">💸</div>
          <p className="text-2xl font-bold text-emerald-400">
            ${mySpent.toFixed(0)}
          </p>
          <p className="text-xs text-white/50">Spent This Month</p>
        </div>
      </div>

      {/* Household Leaderboard */}
      {partner ? (
        <div className="p-4 rounded-xl neo-card bg-bg-card-custom border border-white/5">
          <h4 className="text-sm font-semibold text-white mb-3">
            Streak Leaderboard
          </h4>
          <div className="space-y-2">
            {myStreak >= partner.partner_streak ? (
              <>
                <LeaderboardRow
                  rank={1}
                  name="You"
                  value={myStreak}
                  label="days"
                  isTop
                />
                <LeaderboardRow
                  rank={2}
                  name={partner.partner_email?.split("@")[0] || "Partner"}
                  value={partner.partner_streak}
                  label="days"
                />
              </>
            ) : (
              <>
                <LeaderboardRow
                  rank={1}
                  name={partner.partner_email?.split("@")[0] || "Partner"}
                  value={partner.partner_streak}
                  label="days"
                  isTop
                />
                <LeaderboardRow
                  rank={2}
                  name="You"
                  value={myStreak}
                  label="days"
                />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl neo-card bg-bg-card-custom border border-white/5 text-center">
          <TrophyIcon className="w-8 h-8 mx-auto mb-2 text-yellow-400/50" />
          <p className="text-sm text-white/50">
            Link a partner to compare streaks!
          </p>
        </div>
      )}
    </div>
  );
}

function LeaderboardRow({
  rank,
  name,
  value,
  label,
  isTop,
}: {
  rank: number;
  name: string;
  value: number;
  label: string;
  isTop?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg",
        isTop ? "bg-yellow-500/10" : "bg-white/5"
      )}
    >
      <span className="text-lg">{rank === 1 ? "🥇" : "🥈"}</span>
      <span
        className={cn("flex-1 text-sm", isTop ? "text-white" : "text-white/70")}
      >
        {name}
      </span>
      <span
        className={cn(
          "text-sm font-semibold",
          isTop ? "text-yellow-400" : "text-white/50"
        )}
      >
        {value} {label}
      </span>
    </div>
  );
}

// Alerts View - Smart notifications
function AlertsView() {
  const { data, isLoading } = useHubAlerts();
  const dismissAlert = useDismissAlert();
  const alerts = data?.alerts || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl neo-card bg-bg-card-custom border border-white/5 animate-pulse"
          >
            <div className="h-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="p-8 rounded-2xl neo-card bg-bg-card-custom border border-white/5 text-center">
        <AlertBellIcon className="w-12 h-12 mx-auto mb-3 text-red-400/50" />
        <h3 className="text-lg font-semibold text-white mb-2">
          All Caught Up!
        </h3>
        <p className="text-sm text-white/50">No alerts at the moment.</p>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "budget_warning":
      case "budget_exceeded":
        return "⚠️";
      case "goal_milestone":
        return "🎉";
      case "weekly_summary":
      case "monthly_summary":
        return "📊";
      case "bill_due":
        return "📅";
      default:
        return "💡";
    }
  };

  const getBorderColor = (severity: string) => {
    switch (severity) {
      case "warning":
        return "border-yellow-500/20";
      case "success":
        return "border-green-500/20";
      case "action":
        return "border-red-500/20";
      default:
        return "border-blue-500/20";
    }
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert: HubAlert) => (
        <div
          key={alert.id}
          className={cn(
            "p-4 rounded-xl neo-card bg-bg-card-custom flex items-start gap-3 border",
            getBorderColor(alert.severity)
          )}
        >
          <div className="text-2xl">{getIcon(alert.alert_type)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-white">{alert.title}</p>
            </div>
            <p className="text-sm text-white/60">{alert.message}</p>
            <p className="text-xs text-white/30 mt-1">
              {formatRelativeTime(alert.created_at)}
            </p>
          </div>
          <button
            onClick={() => dismissAlert.mutate(alert.id)}
            className="text-white/30 hover:text-white/60 text-lg"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// Helper function
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
