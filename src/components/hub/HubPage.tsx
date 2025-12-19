"use client";

import {
  AlertBellIcon,
  CheckIcon,
  ChevronLeftIcon,
  EyeIcon,
  FeedIcon,
  MessageIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
  Trash2Icon,
  TrophyIcon,
  XIcon,
} from "@/components/icons/FuturisticIcons";
import { useTab } from "@/contexts/TabContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import {
  useBroadcastReceiptUpdate,
  useConfirmTransactions,
  useCreateThread,
  useDismissAlert,
  useHouseholdRealtimeMessages,
  useHubAlerts,
  useHubFeed,
  useHubMessages,
  useHubStats,
  useHubThreads,
  useMarkMessageAsRead,
  useRealtimeMessages,
  useSendMessage,
  useSnoozeAlert,
  useUpdateNotificationTime,
  type HubAlert,
  type HubChatThread,
  type HubFeedItem,
  type HubMessage,
} from "@/features/hub/hooks";
import {
  useCacheSync,
  useHubCacheInit,
  useHubState,
} from "@/features/hub/useHubPersistence";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { parseMessageForTransaction } from "@/lib/nlp/messageTransactionParser";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Link as LinkIcon, RefreshCw, Settings } from "lucide-react";
import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Lazy load transaction modal to avoid bundle bloat
const AddTransactionFromMessageModal = dynamic(
  () => import("@/components/hub/AddTransactionFromMessageModal"),
  { ssr: false }
);

// Lazy load shopping list view
const ShoppingListView = dynamic(
  () =>
    import("@/components/hub/ShoppingListView").then((m) => ({
      default: m.ShoppingListView,
    })),
  { ssr: false }
);

// Lazy load notes list view
const NotesListView = dynamic(
  () =>
    import("@/components/hub/NotesListView").then((m) => ({
      default: m.NotesListView,
    })),
  { ssr: false }
);

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
  const { hubDefaultView, setHubDefaultView } = useTab();

  // Initialize hub cache from localStorage on mount
  useHubCacheInit();

  // Use persistent state for Hub UI
  const { activeView, setActiveView, activeThreadId, setActiveThreadId } =
    useHubState();

  // Check for default view from notification modal (via context)
  useEffect(() => {
    if (hubDefaultView) {
      setActiveView(hubDefaultView);
      setHubDefaultView(null); // Clear after using
    }
  }, [hubDefaultView, setHubDefaultView, setActiveView]);

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
}

// Helper function to format date separators
function formatDateSeparator(date: Date): string {
  const now = new Date();
  const messageDate = new Date(date);

  // Reset time to midnight for accurate day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(
    messageDate.getFullYear(),
    messageDate.getMonth(),
    messageDate.getDate()
  );

  if (msgDay.getTime() === today.getTime()) {
    return "Today";
  } else if (msgDay.getTime() === yesterday.getTime()) {
    return "Yesterday";
  } else {
    // Format as "Dec 14" or "Dec 14, 2024" if different year
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };
    if (messageDate.getFullYear() !== now.getFullYear()) {
      options.year = "numeric";
    }
    return messageDate.toLocaleDateString("en-US", options);
  }
}

// Helper to check if two dates are on different days
function isDifferentDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getDate() !== d2.getDate() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getFullYear() !== d2.getFullYear()
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
  const { syncThreadsToCache } = useCacheSync();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [purposeFilter, setPurposeFilter] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | "public" | "private"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const threads = data?.threads || [];
  const householdId = data?.household_id;

  // Purpose options for dropdown
  const purposeOptions = [
    { value: "all", label: "All Categories", icon: null },
    {
      value: "shopping",
      label: "Shopping",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      value: "budget",
      label: "Budget",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      value: "reminder",
      label: "Reminders",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      value: "travel",
      label: "Travel",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      ),
    },
    {
      value: "health",
      label: "Health",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      value: "notes",
      label: "Notes",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      value: "general",
      label: "General",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      value: "other",
      label: "Other",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
  ];

  const selectedPurpose =
    purposeOptions.find((p) => p.value === purposeFilter) || purposeOptions[0];

  // Sync threads to localStorage cache when data loads
  useEffect(() => {
    if (data && data.threads && data.threads.length > 0) {
      syncThreadsToCache(data);
    }
  }, [data, syncThreadsToCache]);

  // Filter threads by purpose, visibility, and search query
  const filteredThreads = threads.filter((thread) => {
    // Purpose filter
    const matchesPurpose =
      purposeFilter === "all" || thread.purpose === purposeFilter;
    // Visibility filter
    const matchesVisibility =
      visibilityFilter === "all" ||
      (visibilityFilter === "private" && thread.is_private) ||
      (visibilityFilter === "public" && !thread.is_private);
    // Search filter
    const matchesSearch =
      !searchQuery.trim() ||
      thread.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (thread.last_message?.content || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    return matchesPurpose && matchesVisibility && matchesSearch;
  });

  // Subscribe to household-level messages when viewing thread list (not inside a thread)
  // This ensures we get notified about new messages in ANY thread
  useHouseholdRealtimeMessages(!activeThreadId ? (householdId ?? null) : null);

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

      {/* Search Bar */}
      {householdId && threads.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 pl-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white/60 transition-all"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clean Filters */}
      {householdId && threads.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          {/* Visibility Toggle - Segmented Control */}
          <div className="flex bg-white/5 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setVisibilityFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                visibilityFilter === "all"
                  ? "bg-gradient-to-r from-blue-500/30 to-purple-500/30 text-white border border-blue-500/30"
                  : "text-white/50 hover:text-white/70"
              )}
            >
              All
            </button>
            <button
              onClick={() => setVisibilityFilter("public")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1",
                visibilityFilter === "public"
                  ? "bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-300 border border-cyan-500/30"
                  : "text-white/50 hover:text-white/70"
              )}
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M8 11V7a4 4 0 018 0m-4 8v2m-6-2a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2v-6a2 2 0 00-2-2H6z" />
              </svg>
            </button>
            <button
              onClick={() => setVisibilityFilter("private")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1",
                visibilityFilter === "private"
                  ? "bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-pink-300 border border-purple-500/30"
                  : "text-white/50 hover:text-white/70"
              )}
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </button>
          </div>

          {/* Category Dropdown */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                purposeFilter !== "all"
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              )}
            >
              <span className="flex items-center gap-1.5">
                {selectedPurpose.icon}
                {selectedPurpose.label}
              </span>
              <svg
                className={cn(
                  "w-3 h-3 transition-transform",
                  showCategoryDropdown && "rotate-180"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showCategoryDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowCategoryDropdown(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl z-20 py-1 max-h-60 overflow-y-auto">
                  {purposeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setPurposeFilter(option.value);
                        setShowCategoryDropdown(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-xs transition-all",
                        purposeFilter === option.value
                          ? "bg-blue-500/20 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {option.icon}
                      {option.label}
                      {purposeFilter === option.value && (
                        <svg
                          className="w-3 h-3 ml-auto text-blue-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* AI Assistant - Always First */}
      <AIAssistantItem onClick={() => setActiveThreadId(AI_THREAD_ID)} />

      {/* Household Threads */}
      {householdId && filteredThreads.length > 0 && (
        <div className="space-y-2 mt-2">
          {filteredThreads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              currentUserId={data.current_user_id}
              onClick={() => setActiveThreadId(thread.id)}
            />
          ))}
        </div>
      )}

      {/* No results message */}
      {householdId &&
        threads.length > 0 &&
        filteredThreads.length === 0 &&
        purposeFilter !== "all" && (
          <div className="p-6 rounded-2xl neo-card bg-bg-card-custom border border-white/5 text-center mt-4">
            <MessageIcon className="w-10 h-10 mx-auto mb-2 text-blue-400/30" />
            <p className="text-sm text-white/50">
              No {purposeFilter} conversations yet
            </p>
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

  // Get purpose icon and color
  const purposeConfig =
    PURPOSE_CONFIG[thread.purpose] || PURPOSE_CONFIG.general;
  const IconComponent = PurposeIcons[thread.purpose] || PurposeIcons.general;
  // Use thread.color from database, fallback to default purpose color
  const threadColor = thread.color || purposeConfig.defaultColor;

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className="w-full p-4 rounded-xl neo-card bg-bg-card-custom border transition-all flex items-center gap-3 text-left"
        style={{
          borderColor:
            thread.unread_count > 0
              ? `${threadColor}30`
              : "rgba(255,255,255,0.05)",
          backgroundColor:
            thread.unread_count > 0 ? `${threadColor}05` : undefined,
        }}
      >
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 relative transition-all"
          style={{
            backgroundColor: `${threadColor}25`,
            color: threadColor,
          }}
        >
          <IconComponent className="w-6 h-6" />
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
            {/* Private indicator */}
            {thread.is_private && (
              <svg
                className="w-4 h-4 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <title>Private - only you can see this</title>
                <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
            {/* Purpose badge */}
            {thread.purpose && thread.purpose !== "general" && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium",
                  thread.purpose === "budget" &&
                    "bg-emerald-500/20 text-emerald-400",
                  thread.purpose === "reminder" &&
                    "bg-amber-500/20 text-amber-400",
                  thread.purpose === "shopping" &&
                    "bg-blue-500/20 text-blue-400",
                  thread.purpose === "travel" &&
                    "bg-purple-500/20 text-purple-400",
                  thread.purpose === "health" && "bg-red-500/20 text-red-400",
                  thread.purpose === "notes" &&
                    "bg-yellow-500/20 text-yellow-400",
                  thread.purpose === "other" && "bg-slate-500/20 text-slate-400"
                )}
              >
                {thread.purpose}
              </span>
            )}
            {thread.unread_count > 0 && (
              <span className="relative flex items-center justify-center badge-enter">
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
            <p className="text-xs text-white/30 italic mt-0.5">
              No messages yet
            </p>
          )}
        </div>

        {/* Time */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={cn(
              "text-xs",
              thread.unread_count > 0
                ? "text-blue-400 font-medium"
                : "text-white/30"
            )}
          >
            {formatRelativeTime(thread.last_message_at)}
          </span>
        </div>
      </button>
    </div>
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
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useHubMessages(threadId);
  const { data: threadsData } = useHubThreads();
  const { syncMessagesToCache } = useCacheSync();
  const sendMessage = useSendMessage();
  const broadcastReceiptUpdate = useBroadcastReceiptUpdate();
  const markMessageAsRead = useMarkMessageAsRead();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadSeparatorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const hasScrolledToUnread = useRef(false);
  const hasProcessedUnread = useRef(false);

  // Sync messages to localStorage cache when data loads
  useEffect(() => {
    if (
      data &&
      data.messages &&
      data.messages.length > 0 &&
      data.thread_id &&
      data.household_id
    ) {
      syncMessagesToCache(threadId, {
        messages: data.messages,
        thread_id: data.thread_id,
        household_id: data.household_id,
        current_user_id: data.current_user_id,
      });
    }
  }, [data, threadId, syncMessagesToCache]);

  // Action menu state
  const [actionMenuMessage, setActionMenuMessage] = useState<HubMessage | null>(
    null
  );
  const [actionMenuPosition, setActionMenuPosition] = useState<{
    x: number;
    y: number;
    showBelow?: boolean;
  } | null>(null);
  const [transactionModalData, setTransactionModalData] = useState<{
    messageId: string;
    amount: number;
    description: string;
    categoryId: string | null;
    subcategoryId: string | null;
    date: string | null;
  } | null>(null);

  // Track locally converted messages for immediate UI feedback
  const [convertedMessageIds, setConvertedMessageIds] = useState<Set<string>>(
    new Set()
  );

  // Filter messages with actions (default: hide them)
  const [showActionsFilter, setShowActionsFilter] = useLocalStorage(
    `hub-show-actions-${threadId}`,
    false
  );

  // Multi-select mode for deleting messages
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(
    new Set()
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Thread settings modal
  const [showThreadSettings, setShowThreadSettings] = useState(false);

  // Search within messages
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Helper to highlight search terms in message content
  const highlightSearchTerms = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(
      new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
    );
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-400 text-black px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Fetch accounts and categories for transaction parsing
  const { data: accounts = [] } = useAccounts();
  const defaultAccount = accounts.find((a: any) => a.is_default);
  const { data: categories = [] } = useCategories(defaultAccount?.id);

  // Long press handler for messages (must be at component level, not in map)
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const handleMessageTouchStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent, msg: HubMessage) => {
      isLongPressRef.current = false;

      // Capture the element and its position before setTimeout
      const element = e.currentTarget as HTMLElement;
      const rect = element.getBoundingClientRect();

      longPressTimeoutRef.current = setTimeout(() => {
        isLongPressRef.current = true;

        // Trigger haptic feedback on mobile
        if ("vibrate" in navigator) {
          navigator.vibrate(50);
        }

        // Calculate optimal menu position
        const menuWidth = 280; // max-width of menu
        const menuHeight = 180; // approximate height
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 16; // minimum padding from edges

        // Start with centered position above message
        let x = rect.left + rect.width / 2;
        let y = rect.top;

        // Adjust horizontal position if menu would overflow
        if (x + menuWidth / 2 > viewportWidth - padding) {
          // Too far right, align to right edge with padding
          x = viewportWidth - padding - menuWidth / 2;
        } else if (x - menuWidth / 2 < padding) {
          // Too far left, align to left edge with padding
          x = padding + menuWidth / 2;
        }

        // Adjust vertical position if menu would overflow top
        let showBelow = false;
        if (y - menuHeight < padding) {
          // Not enough space above, show below message instead
          y = rect.bottom + 10;
          showBelow = true;
        } else {
          // Show above message
          y = rect.top - 10;
        }

        // Always show action menu on long-press
        setActionMenuMessage(msg);
        setActionMenuPosition({ x, y, showBelow });
      }, 500);
    },
    []
  );

  const handleMessageTouchEnd = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    },
    []
  );

  const handleMessageTouchCancel = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
    },
    []
  );

  // Handler for back button - refetch threads to get updated unread counts
  const handleBack = useCallback(() => {
    // Invalidate threads to refetch with fresh unread counts
    queryClient.invalidateQueries({ queryKey: ["hub", "threads"] });
    onBack();
  }, [queryClient, onBack]);

  // Store initial unread info as STATE so it triggers re-render
  const [initialUnreadInfo, setInitialUnreadInfo] = useState<{
    firstUnreadMessageId: string | null;
    unreadCount: number;
  }>({ firstUnreadMessageId: null, unreadCount: 0 });

  // Track when unread header should animate out
  const [isUnreadHeaderExiting, setIsUnreadHeaderExiting] = useState(false);

  // Capture initial unread state on first data load
  useEffect(() => {
    if (data && !hasProcessedUnread.current) {
      hasProcessedUnread.current = true;

      // Capture the unread info before it gets cleared by marking as read
      setInitialUnreadInfo({
        firstUnreadMessageId: data.first_unread_message_id,
        unreadCount: data.unread_count || 0,
      });

      // Update the threads cache directly to show 0 unread
      // This happens immediately since the API already marked them as read
      queryClient.setQueryData(
        ["hub", "threads"],
        (
          oldData:
            | {
                threads: HubChatThread[];
                household_id: string | null;
                current_user_id: string;
              }
            | undefined
        ) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            threads: oldData.threads.map((t) =>
              t.id === threadId ? { ...t, unread_count: 0 } : t
            ),
          };
        }
      );
    }
  }, [data, queryClient, threadId]);

  // Reset on thread change
  useEffect(() => {
    setInitialUnreadInfo({ firstUnreadMessageId: null, unreadCount: 0 });
    setIsUnreadHeaderExiting(false);
    hasProcessedUnread.current = false;
    hasScrolledToUnread.current = false;
    setIsSelectionMode(false);
    setSelectedMessages(new Set());
  }, [threadId]);

  // Callback when a new message from another user arrives while chat is open
  // We immediately mark it as read in the database AND broadcast the update
  const handleNewMessageFromOther = useCallback(
    async (messageId: string) => {
      // Mark as read in the database via API (so badge count is correct)
      await markMessageAsRead(messageId);
      // Broadcast to sender so they see the green checkmarks
      if (data?.current_user_id) {
        broadcastReceiptUpdate(
          threadId,
          [messageId],
          "read",
          data.current_user_id
        );
      }
    },
    [threadId, broadcastReceiptUpdate, markMessageAsRead, data?.current_user_id]
  );

  // Subscribe to realtime updates - no polling needed!
  useRealtimeMessages(threadId, handleNewMessageFromOther);

  // Broadcast receipt updates when we have unread messages from others
  // The broadcast function handles deduplication, so we can call this freely
  useEffect(() => {
    if (!data) return;

    const currentUserId = data.current_user_id;
    const messages = data.messages || [];

    // Find messages from others that are unread (is_unread flag from API)
    const unreadFromOthers = messages
      .filter((msg) => msg.sender_user_id !== currentUserId && msg.is_unread)
      .map((msg) => msg.id);

    if (unreadFromOthers.length > 0 && currentUserId) {
      broadcastReceiptUpdate(threadId, unreadFromOthers, "read", currentUserId);
    }
  }, [data, threadId, broadcastReceiptUpdate]);

  const messages = data?.messages || [];
  const currentUserId = data?.current_user_id;

  // OPTIMIZED: Use message_actions from messages response instead of separate API call
  const messageActions = data?.message_actions || [];

  // Combine database actions with local tracking
  // Check for both transaction AND reminder actions
  const isMessageConverted = (msgId: string) => {
    return (
      convertedMessageIds.has(msgId) ||
      messageActions.some(
        (a: any) =>
          a.message_id === msgId &&
          (a.action_type === "transaction" || a.action_type === "reminder")
      )
    );
  };

  // Filter messages based on showActionsFilter toggle
  const filteredMessages = messages.filter((msg) => {
    // If filter is on (show all), don't filter anything
    if (showActionsFilter) return true;

    // If filter is off (default), hide messages with ANY actions
    const hasAnyAction = messageActions.some(
      (a: any) => a.message_id === msg.id
    );
    return !hasAnyAction;
  });

  // Further filter by search query
  const searchFilteredMessages = searchQuery.trim()
    ? filteredMessages.filter((msg) =>
        msg.content?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredMessages;

  // Count hidden messages for visual feedback
  const hiddenMessagesCount = messages.length - filteredMessages.length;

  // Use the captured initial unread info for displaying the separator
  const firstUnreadMessageId = initialUnreadInfo.firstUnreadMessageId;
  const unreadCount = initialUnreadInfo.unreadCount;

  const thread = threadsData?.threads.find((t) => t.id === threadId);

  // Check if this is a shopping list thread
  const isShoppingThread = thread?.purpose === "shopping";

  // Check if this is a notes thread
  const isNotesThread = thread?.purpose === "notes";

  // Current user's theme determines their bubble color
  // Blue theme user = blue bubbles for "me", pink for partner
  // Pink theme user = pink bubbles for "me", blue for partner
  const myTheme = theme; // "blue" or "pink"

  // Scroll to unread separator or bottom on initial load
  useEffect(() => {
    if (
      !isLoading &&
      searchFilteredMessages.length > 0 &&
      !hasScrolledToUnread.current
    ) {
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
  }, [
    isLoading,
    messages.length,
    firstUnreadMessageId,
    searchFilteredMessages.length,
  ]);

  // Reset scroll tracker when changing threads
  useEffect(() => {
    hasScrolledToUnread.current = false;
  }, [threadId]);

  // Smooth scroll to bottom when new messages arrive (after initial load)
  const prevMessagesLength = useRef(searchFilteredMessages.length);
  useEffect(() => {
    if (searchFilteredMessages.length > prevMessagesLength.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessagesLength.current = searchFilteredMessages.length;
  }, [searchFilteredMessages.length]);

  const handleSend = () => {
    if (!newMessage.trim()) return;

    // If there's an unread header visible, animate it out
    if (unreadCount > 0) {
      setIsUnreadHeaderExiting(true);
      // Remove the header after animation completes
      setTimeout(() => {
        setInitialUnreadInfo({ firstUnreadMessageId: null, unreadCount: 0 });
        setIsUnreadHeaderExiting(false);
      }, 800); // Match animation duration (0.8s)
    }

    const messageToSend = newMessage;
    setNewMessage(""); // Clear input immediately (optimistic)
    sendMessage.mutate({ content: messageToSend, thread_id: threadId });
  };

  // Shopping list handlers
  const handleAddShoppingItem = useCallback(
    (content: string, topicId?: string) => {
      // Send a text message, optionally with a topic_id for notes
      sendMessage.mutate({ content, thread_id: threadId, topic_id: topicId });
    },
    [sendMessage, threadId]
  );

  const handleDeleteShoppingItem = useCallback(
    async (messageId: string) => {
      console.log("[DELETE] Starting delete for message:", messageId);
      const queryKey = ["hub", "messages", threadId];

      // Store previous state for rollback on error
      const previousData = queryClient.getQueryData<{
        messages: HubMessage[];
      }>(queryKey);

      // Optimistically remove from UI immediately
      queryClient.setQueryData<{
        messages: HubMessage[];
        [key: string]: unknown;
      }>(queryKey, (old) => {
        if (!old) {
          console.log("[DELETE] No cache data found");
          return old;
        }
        console.log(
          "[DELETE] Removing from cache, before count:",
          old.messages.length
        );
        const filtered = old.messages.filter((msg) => msg.id !== messageId);
        console.log("[DELETE] After filter count:", filtered.length);
        return {
          ...old,
          messages: filtered,
        };
      });

      try {
        // Soft delete the message
        const res = await fetch("/api/hub/messages", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: [messageId] }),
        });

        if (!res.ok) {
          // Rollback on error
          console.error("[DELETE] API error, status:", res.status);
          if (previousData) {
            queryClient.setQueryData(queryKey, previousData);
          }
          const errorData = await res.json().catch(() => ({}));
          console.error("[DELETE] Error data:", errorData);
          toast.error(errorData.error || "Failed to delete note");
          return;
        }
        console.log("[DELETE] API success");

        // Show undo toast
        toast.message("Note deleted", {
          duration: 10000,
          action: {
            label: "Undo",
            onClick: async () => {
              const undoRes = await fetch("/api/hub/messages", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messageIds: [messageId],
                  action: "undo",
                }),
              });
              if (undoRes.ok) {
                queryClient.invalidateQueries({ queryKey });
                toast.success("Note restored");
              } else {
                toast.error("Failed to restore note");
              }
            },
          },
        });
      } catch (error) {
        // Rollback on network error
        if (previousData) {
          queryClient.setQueryData(queryKey, previousData);
        }
        console.error("Failed to delete message:", error);
        toast.error("Network error - failed to delete note");
      }
    },
    [threadId, queryClient]
  );

  // Toggle item URLs for shopping thread
  const handleToggleItemUrls = useCallback(async () => {
    if (!thread) return;

    const newValue = !thread.enable_item_urls;

    try {
      // Optimistic update
      queryClient.setQueryData<{ threads: HubChatThread[] }>(
        ["hub", "threads"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            threads: old.threads.map((t) =>
              t.id === threadId ? { ...t, enable_item_urls: newValue } : t
            ),
          };
        }
      );

      const res = await fetch("/api/hub/threads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          enable_item_urls: newValue,
        }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to update setting";
        try {
          const errorData = await res.json();
          console.error("Toggle error:", errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;

          // If migration required, show specific message
          if (errorData.error === "Database migration required") {
            errorMessage =
              "Please run the database migration first. Check console for details.";
            console.error("Migration required:", errorData.message);
          }
        } catch (e) {
          console.error("Error parsing response:", e);
        }
        throw new Error(errorMessage);
      }

      toast.success(newValue ? "Item links enabled" : "Item links disabled");
    } catch (error) {
      console.error("Failed to toggle item URLs:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update setting";
      toast.error(errorMessage);
      // Rollback on error
      queryClient.invalidateQueries({ queryKey: ["hub", "threads"] });
    }
  }, [thread, threadId, queryClient]);

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
      {/* Thread Header - Fixed below app header with solid background and color accent */}
      <div
        className="fixed top-14 left-0 right-0 z-30 flex items-center gap-3 px-4 py-3 border-b transition-all duration-300"
        style={{
          borderBottomColor: thread?.color
            ? `${thread.color}40`
            : "rgba(255,255,255,0.1)",
          backgroundColor: thread?.color
            ? `color-mix(in srgb, ${thread.color} 8%, rgb(15, 23, 42))`
            : "rgb(15, 23, 42)",
          boxShadow: thread?.color ? `0 4px 20px ${thread.color}20` : "none",
        }}
      >
        {isSearchOpen ? (
          /* Search Mode Header - Replace everything with search input */
          <>
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              className="p-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className="flex-1 relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search in chat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 transition-all text-sm"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white/60 transition-all"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <span className="text-xs text-white/50 whitespace-nowrap">
                {searchFilteredMessages.length} found
              </span>
            )}
          </>
        ) : (
          /* Normal Header */
          <>
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Thread Icon with Color */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300"
                style={{
                  backgroundColor: thread?.color
                    ? `${thread.color}25`
                    : "rgba(59, 130, 246, 0.2)",
                  color: thread?.color || "#3b82f6",
                }}
              >
                {thread?.purpose && PurposeIcons[thread.purpose] ? (
                  React.createElement(PurposeIcons[thread.purpose], {
                    className: "w-5 h-5",
                  })
                ) : (
                  <span className="text-lg">{thread?.icon || "💬"}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-white truncate">
                  {thread?.title || "Chat"}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {thread?.purpose && thread.purpose !== "general" && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-300"
                      style={{
                        backgroundColor: thread.color
                          ? `${thread.color}20`
                          : undefined,
                        color: thread.color || undefined,
                      }}
                    >
                      {thread.purpose}
                    </span>
                  )}
                  {/* Item Links Toggle for Shopping Threads */}
                  {thread?.purpose === "shopping" && (
                    <button
                      onClick={handleToggleItemUrls}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium transition-all",
                        thread.enable_item_urls
                          ? "text-blue-400 hover:bg-blue-500/30"
                          : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                      )}
                      style={
                        thread.enable_item_urls && thread.color
                          ? {
                              backgroundColor: `${thread.color}20`,
                              color: thread.color,
                            }
                          : undefined
                      }
                      title={
                        thread.enable_item_urls
                          ? "Item links enabled"
                          : "Enable item links"
                      }
                    >
                      <LinkIcon className="w-3 h-3" />
                      {thread.enable_item_urls && (
                        <span className="hidden sm:inline">Links</span>
                      )}
                    </button>
                  )}
                  {thread?.description && (
                    <span className="text-xs text-white/50 truncate">
                      {thread.description}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSelectionMode ? (
                <>
                  <span className="text-sm text-white/70">
                    {selectedMessages.size} selected
                  </span>
                  <button
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedMessages(new Set());
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={selectedMessages.size === 0}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      selectedMessages.size > 0
                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        : "bg-white/5 text-white/30 cursor-not-allowed"
                    )}
                  >
                    <Trash2Icon className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  {/* Search Button */}
                  <button
                    onClick={() => {
                      setIsSearchOpen(!isSearchOpen);
                      if (isSearchOpen) {
                        setSearchQuery("");
                      }
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      isSearchOpen
                        ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                    )}
                    title="Search messages"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                  {/* Eye icon only for budget and reminder chats */}
                  {thread?.purpose &&
                    (thread.purpose === "budget" ||
                      thread.purpose === "reminder") && (
                      <button
                        onClick={() => setShowActionsFilter(!showActionsFilter)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          showActionsFilter
                            ? "text-emerald-400 hover:bg-emerald-500/30"
                            : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                        )}
                        style={
                          showActionsFilter && thread.color
                            ? {
                                backgroundColor: `${thread.color}20`,
                                color: thread.color,
                              }
                            : undefined
                        }
                        title={
                          showActionsFilter
                            ? "Hide completed actions"
                            : "Show completed actions"
                        }
                      >
                        <EyeIcon className="w-5 h-5" />
                      </button>
                    )}
                  {/* Settings Button - Far Right */}
                  <button
                    onClick={() => setShowThreadSettings(true)}
                    className="p-2 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-all"
                    title="Chat appearance"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Spacer for fixed header */}
      <div className="h-16" />

      {/* Conditional rendering: Shopping List View, Notes View, or Normal Messages */}
      {isShoppingThread ? (
        <ShoppingListView
          messages={messages}
          currentUserId={currentUserId || ""}
          threadId={thread?.id || ""}
          thread={thread}
          onAddItem={handleAddShoppingItem}
          onDeleteItem={handleDeleteShoppingItem}
          isLoading={isLoading}
        />
      ) : isNotesThread ? (
        <NotesListView
          messages={messages}
          currentUserId={currentUserId || ""}
          threadId={thread?.id || ""}
          thread={thread}
          onAddItem={handleAddShoppingItem}
          onDeleteItem={handleDeleteShoppingItem}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onUpdateItem={async (messageId: string, content: string) => {
            try {
              const res = await fetch("/api/hub/messages", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "update_content",
                  message_id: messageId,
                  content,
                }),
              });

              if (!res.ok) {
                let errorData;
                try {
                  errorData = await res.json();
                } catch (e) {
                  errorData = {
                    error: `HTTP ${res.status}: ${res.statusText}`,
                  };
                }
                console.error("Update failed:", {
                  status: res.status,
                  statusText: res.statusText,
                  errorData,
                  messageId,
                  contentLength: content.length,
                });
                throw new Error(errorData.error || "Failed to update");
              }

              return true;
            } catch (error) {
              console.error("Failed to update message:", error);
              return false;
            }
          }}
        />
      ) : (
        <>
          {/* Messages - Scrollable area, messages stick to bottom like WhatsApp */}
          <div
            className="flex-1 overflow-y-auto px-4 pb-36 flex flex-col transition-all duration-300"
            style={{
              background: thread?.color
                ? `linear-gradient(to bottom, ${thread.color}03, transparent 200px)`
                : undefined,
            }}
          >
            {/* Spacer to push messages to bottom when few messages */}
            <div className="flex-1" />

            {/* Messages container */}
            <div className="space-y-3 py-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-2xl p-4 animate-pulse",
                        i % 2 === 0
                          ? "ml-auto max-w-[80%]"
                          : "mr-auto max-w-[80%]"
                      )}
                      style={{
                        backgroundColor: thread?.color
                          ? `${thread.color}15`
                          : "rgba(255, 255, 255, 0.05)",
                      }}
                    >
                      <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-white/5 rounded w-1/2" />
                    </div>
                  ))}
                  <p className="text-center text-xs text-white/30 mt-4">
                    Loading messages...
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <MessageIcon className="w-12 h-12 mb-3 text-blue-400/30" />
                  <p className="text-sm text-white/50">
                    No messages yet. Start the conversation!
                  </p>
                </div>
              ) : searchFilteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <EyeIcon className="w-12 h-12 mb-3 text-emerald-400/30" />
                  <p className="text-sm text-white/50">
                    All messages have completed actions.
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    Toggle the eye icon to show them.
                  </p>
                </div>
              ) : (
                searchFilteredMessages.map((msg: HubMessage, index: number) => {
                  const styles = getMessageStyles(msg);
                  const isSystem = msg.message_type === "system";
                  const isMe = msg.sender_user_id === currentUserId;
                  const isFirstUnread = msg.id === firstUnreadMessageId;

                  // Check if this message has actions
                  const msgActions = messageActions.filter(
                    (a: any) => a.message_id === msg.id
                  );
                  const hasTransactionAction = msgActions.some(
                    (a: any) => a.action_type === "transaction"
                  );

                  // Date separator logic - only for reminder and budget chats
                  const showDateSeparator =
                    (thread?.purpose === "reminder" ||
                      thread?.purpose === "budget") &&
                    (index === 0 ||
                      isDifferentDay(
                        msg.created_at,
                        searchFilteredMessages[index - 1].created_at
                      ));

                  return (
                    <div key={msg.id}>
                      {/* Date separator */}
                      {showDateSeparator && (
                        <div className="flex items-center gap-3 py-3 my-2">
                          <div className="flex-1 h-px bg-white/5" />
                          <span className="px-3 py-1 text-xs font-medium text-white/40 bg-white/5 rounded-full">
                            {formatDateSeparator(new Date(msg.created_at))}
                          </span>
                          <div className="flex-1 h-px bg-white/5" />
                        </div>
                      )}

                      {/* Unread messages separator */}
                      {isFirstUnread && unreadCount > 0 && (
                        <div
                          ref={unreadSeparatorRef}
                          className={cn(
                            "flex items-center gap-3 py-4 my-2",
                            isUnreadHeaderExiting && "unread-header-exit"
                          )}
                        >
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                          <span className="px-3 py-1 text-xs font-medium text-amber-400 bg-amber-500/10 rounded-full border border-amber-500/20 animate-pulse">
                            {unreadCount} unread message
                            {unreadCount > 1 ? "s" : ""}
                          </span>
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        {/* Checkbox column - fixed width on LEFT */}
                        {isSelectionMode && (
                          <div className="w-8 flex-shrink-0 flex justify-center pt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Cannot select messages with actions or deleted messages
                                if (msgActions.length > 0 || msg.deleted_at)
                                  return;

                                setSelectedMessages((prev) => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(msg.id)) {
                                    newSet.delete(msg.id);
                                  } else {
                                    newSet.add(msg.id);
                                  }
                                  return newSet;
                                });
                              }}
                              disabled={
                                msgActions.length > 0 || !!msg.deleted_at
                              }
                              className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                msgActions.length > 0 || msg.deleted_at
                                  ? "bg-white/5 border-white/10 cursor-not-allowed opacity-30"
                                  : selectedMessages.has(msg.id)
                                    ? "bg-blue-500 border-blue-500"
                                    : "bg-white/5 border-white/30 hover:border-white/50"
                              )}
                              title={
                                msgActions.length > 0
                                  ? "Cannot delete: has actions"
                                  : msg.deleted_at
                                    ? "Cannot delete: already deleted"
                                    : ""
                              }
                            >
                              {selectedMessages.has(msg.id) &&
                                !msgActions.length &&
                                !msg.deleted_at && (
                                  <CheckIcon className="w-3 h-3 text-white" />
                                )}
                            </button>
                          </div>
                        )}

                        {/* Message content - flexible width */}
                        <div className={cn("flex-1 flex", styles.alignment)}>
                          <div
                            onMouseDown={(e) =>
                              !isSelectionMode &&
                              handleMessageTouchStart(e, msg)
                            }
                            onMouseUp={handleMessageTouchEnd}
                            onMouseLeave={handleMessageTouchCancel}
                            onTouchStart={(e) =>
                              !isSelectionMode &&
                              handleMessageTouchStart(e, msg)
                            }
                            onTouchEnd={handleMessageTouchEnd}
                            onTouchCancel={handleMessageTouchCancel}
                            onClick={() => {
                              if (
                                isSelectionMode &&
                                msgActions.length === 0 &&
                                !msg.deleted_at
                              ) {
                                setSelectedMessages((prev) => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(msg.id)) {
                                    newSet.delete(msg.id);
                                  } else {
                                    newSet.add(msg.id);
                                  }
                                  return newSet;
                                });
                              }
                            }}
                            className={cn(
                              "px-4 py-2.5 rounded-2xl transition-all relative",
                              !isSelectionMode && "active:scale-95",
                              isSelectionMode &&
                                selectedMessages.has(msg.id) &&
                                "ring-2 ring-blue-500",
                              isSelectionMode && "cursor-pointer",
                              isSystem ? "max-w-[90%]" : "max-w-[80%]",
                              styles.bubble
                            )}
                          >
                            {/* Action badges in top-right corner */}
                            {msgActions.length > 0 && (
                              <div className="absolute -top-1 -right-1 flex gap-1">
                                {msgActions.map((action: any) => (
                                  <div
                                    key={action.id}
                                    className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-bg-custom shadow-lg"
                                    title={`Action: ${action.action_type}`}
                                  >
                                    <span className="text-white text-xs font-bold">
                                      {action.action_type === "transaction" &&
                                        "💰"}
                                      {action.action_type === "reminder" &&
                                        "⏰"}
                                      {action.action_type === "forward" && "↗️"}
                                      {action.action_type === "pin" && "📌"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {isSystem && (
                              <p className="text-xs text-violet-300 font-medium mb-1">
                                🤖 System
                              </p>
                            )}

                            {/* Show "This message was deleted/hidden" with undo button */}
                            {msg.deleted_at || (msg as any).is_hidden_by_me ? (
                              <div className="flex items-center gap-2">
                                <p className="text-sm italic text-white/40">
                                  🗑️{" "}
                                  {msg.deleted_at
                                    ? "This message was deleted"
                                    : "Message hidden"}
                                </p>
                                {/* Show undo button for own deletions or hidden messages */}
                                {(msg.deleted_by === currentUserId ||
                                  (msg as any).is_hidden_by_me) && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const isHidden = (msg as any)
                                          .is_hidden_by_me;
                                        const response = await fetch(
                                          "/api/hub/messages",
                                          {
                                            method: "PATCH",
                                            headers: {
                                              "Content-Type":
                                                "application/json",
                                            },
                                            body: JSON.stringify({
                                              messageIds: [msg.id],
                                              action: isHidden
                                                ? "unhide"
                                                : "undo",
                                            }),
                                          }
                                        );

                                        if (!response.ok) {
                                          throw new Error(
                                            isHidden
                                              ? "Failed to unhide message"
                                              : "Failed to undo deletion"
                                          );
                                        }

                                        queryClient.invalidateQueries({
                                          queryKey: [
                                            "hub",
                                            "messages",
                                            threadId,
                                          ],
                                        });
                                      } catch (error) {
                                        alert(
                                          error instanceof Error
                                            ? error.message
                                            : "Failed to undo"
                                        );
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg"
                                  >
                                    Undo
                                  </button>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">
                                {searchQuery.trim()
                                  ? highlightSearchTerms(
                                      msg.content || "",
                                      searchQuery
                                    )
                                  : msg.content}
                              </p>
                            )}

                            {/* Action badges */}
                            {msgActions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {msgActions.map((action: any) => (
                                  <span
                                    key={action.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    title={`Action: ${action.action_type}`}
                                  >
                                    {action.action_type === "transaction" &&
                                      "💰"}
                                    {action.action_type === "reminder" && "⏰"}
                                    {action.action_type === "forward" && "↗️"}
                                    {action.action_type === "pin" && "📌"}
                                    <span className="capitalize">
                                      {action.action_type}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}

                            <div
                              className={cn(
                                "flex items-center gap-1 mt-1",
                                isMe ? "justify-end" : ""
                              )}
                            >
                              <span className={cn("text-xs", styles.timeColor)}>
                                {new Date(msg.created_at).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                              {/* Message status icons for sent messages */}
                              {isMe && !isSystem && (
                                <MessageStatus status={msg.status || "sent"} />
                              )}
                            </div>
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

          {/* Input - Fixed at bottom, above navigation bar (only for non-shopping/non-notes threads) */}
          {!isShoppingThread && !isNotesThread && (
            <div
              className="fixed bottom-[72px] left-0 right-0 px-4 py-2 border-t backdrop-blur-sm z-20 transition-all duration-300"
              style={{
                borderTopColor: thread?.color
                  ? `${thread.color}15`
                  : "rgba(255,255,255,0.05)",
                backgroundColor: thread?.color
                  ? `${thread.color}05`
                  : "rgba(var(--bg-card-custom), 0.95)",
              }}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && handleSend()
                  }
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder:text-white/30 focus:outline-none transition-all duration-300"
                  style={{
                    borderColor: thread?.color
                      ? `${thread.color}30`
                      : "rgba(255,255,255,0.1)",
                  }}
                  onFocus={(e) => {
                    if (thread?.color) {
                      e.target.style.borderColor = `${thread.color}80`;
                      e.target.style.boxShadow = `0 0 20px ${thread.color}15`;
                    }
                  }}
                  onBlur={(e) => {
                    if (thread?.color) {
                      e.target.style.borderColor = `${thread.color}30`;
                      e.target.style.boxShadow = "none";
                    }
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sendMessage.isPending}
                  className="px-4 py-3 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                  style={
                    thread?.color
                      ? {
                          background: `linear-gradient(135deg, ${thread.color}, ${thread.color}dd)`,
                        }
                      : undefined
                  }
                >
                  <SendIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Action Menu - Shows on long press */}
      {actionMenuMessage && actionMenuPosition && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setActionMenuMessage(null);
              setActionMenuPosition(null);
            }}
          />

          {/* Action Menu */}
          <div
            className="fixed z-50 bg-bg-card-custom/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{
              left: `${actionMenuPosition.x}px`,
              top: `${actionMenuPosition.y}px`,
              transform: actionMenuPosition.showBelow
                ? "translate(-50%, 0%)"
                : "translate(-50%, -100%)",
              minWidth: "240px",
              maxWidth: "280px",
            }}
          >
            {(() => {
              // Check if message already has transaction action (database OR local)
              const hasTransactionAction = isMessageConverted(
                actionMenuMessage.id
              );

              // Determine action based on thread purpose
              const threadPurpose = thread?.purpose || "general";
              const isBudgetThread = threadPurpose === "budget";

              // For budget threads or general, show "Add Transaction" action
              const actionLabel = "Add as Transaction";
              const actionDescription = "Create expense entry";
              const actionIcon = "💰";
              const actionCompleteLabel = "Transaction Added";

              return (
                <div className="p-2">
                  {/* Add as Transaction Action */}
                  <button
                    onClick={() => {
                      if (hasTransactionAction) return;

                      // Parse message for transaction data
                      const parsed = parseMessageForTransaction(
                        actionMenuMessage.content || "",
                        categories as any[]
                      );

                      // Open transaction modal with prefilled data
                      setTransactionModalData({
                        messageId: actionMenuMessage.id,
                        amount: parsed.amount || 0,
                        description: parsed.description,
                        categoryId: parsed.categoryId,
                        subcategoryId: parsed.subcategoryId,
                        date: parsed.date,
                      });

                      // Close action menu
                      setActionMenuMessage(null);
                      setActionMenuPosition(null);
                    }}
                    disabled={hasTransactionAction}
                    className={cn(
                      "w-full px-4 py-3 flex items-center gap-3 rounded-xl transition-all",
                      hasTransactionAction
                        ? "opacity-50 cursor-not-allowed bg-white/5"
                        : "hover:bg-white/10 active:scale-[0.98]"
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        hasTransactionAction
                          ? "bg-emerald-500/20"
                          : myTheme === "pink"
                            ? "bg-gradient-to-br from-pink-500/20 to-rose-500/20"
                            : "bg-gradient-to-br from-blue-500/20 to-cyan-500/20"
                      )}
                    >
                      {hasTransactionAction ? (
                        <CheckIcon className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <span className="text-xl">{actionIcon}</span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-white">
                        {hasTransactionAction
                          ? actionCompleteLabel
                          : actionLabel}
                      </p>
                      <p className="text-xs text-white/60 mt-0.5">
                        {hasTransactionAction
                          ? "Already created"
                          : actionDescription}
                      </p>
                    </div>
                  </button>

                  {/* Select Message Action - only if message has no actions */}
                  {!hasTransactionAction &&
                    (threadPurpose === "shopping" ||
                      threadPurpose === "notes") && (
                      <button
                        onClick={() => {
                          // Enter selection mode and select this message
                          setIsSelectionMode(true);
                          setSelectedMessages(new Set([actionMenuMessage.id]));

                          // Close action menu
                          setActionMenuMessage(null);
                          setActionMenuPosition(null);
                        }}
                        className="w-full px-4 py-3 flex items-center gap-3 rounded-xl hover:bg-white/10 active:scale-[0.98] transition-all mt-1"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-red-500/20 to-orange-500/20 shrink-0">
                          <Trash2Icon className="w-5 h-5 text-red-400" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold text-white">
                            Select to Delete
                          </p>
                          <p className="text-xs text-white/60 mt-0.5">
                            Choose messages to remove
                          </p>
                        </div>
                      </button>
                    )}

                  {/* Delete Message - For all other chats (budget, reminder, general, etc) */}
                  {!hasTransactionAction &&
                    threadPurpose !== "shopping" &&
                    threadPurpose !== "notes" && (
                      <>
                        {/* Delete for me */}
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/hub/messages", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  messageIds: [actionMenuMessage.id],
                                  action: "hide",
                                }),
                              });

                              if (!res.ok) {
                                throw new Error("Failed to hide message");
                              }

                              queryClient.invalidateQueries({
                                queryKey: ["hub", "messages", threadId],
                              });

                              setActionMenuMessage(null);
                              setActionMenuPosition(null);
                            } catch (error) {
                              console.error("Failed to hide message:", error);
                            }
                          }}
                          className="w-full px-4 py-3 flex items-center gap-3 rounded-xl hover:bg-white/10 active:scale-[0.98] transition-all mt-1"
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-orange-500/20 to-red-500/20 shrink-0">
                            <Trash2Icon className="w-5 h-5 text-orange-400" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-semibold text-white">
                              Delete for me
                            </p>
                            <p className="text-xs text-white/60 mt-0.5">
                              Hide from your view only
                            </p>
                          </div>
                        </button>

                        {/* Delete for everyone - only if it's my message */}
                        {actionMenuMessage.sender_user_id === currentUserId && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/hub/messages", {
                                  method: "DELETE",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    messageIds: [actionMenuMessage.id],
                                  }),
                                });

                                if (!res.ok) {
                                  throw new Error("Failed to delete message");
                                }

                                queryClient.invalidateQueries({
                                  queryKey: ["hub", "messages", threadId],
                                });

                                setActionMenuMessage(null);
                                setActionMenuPosition(null);
                              } catch (error) {
                                console.error(
                                  "Failed to delete message:",
                                  error
                                );
                              }
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 rounded-xl hover:bg-white/10 active:scale-[0.98] transition-all"
                          >
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-red-500/20 to-pink-500/20 shrink-0">
                              <Trash2Icon className="w-5 h-5 text-red-400" />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-semibold text-white">
                                Delete for everyone
                              </p>
                              <p className="text-xs text-white/60 mt-0.5">
                                Remove permanently
                              </p>
                            </div>
                          </button>
                        )}
                      </>
                    )}
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* Transaction Modal */}
      {transactionModalData && (
        <AddTransactionFromMessageModal
          messageId={transactionModalData.messageId}
          initialAmount={transactionModalData.amount}
          initialDescription={transactionModalData.description}
          initialCategoryId={transactionModalData.categoryId}
          initialSubcategoryId={transactionModalData.subcategoryId}
          initialDate={transactionModalData.date}
          onClose={() => setTransactionModalData(null)}
          onSuccess={(messageId) => {
            // Add to local tracking for immediate UI feedback
            setConvertedMessageIds((prev) => new Set(prev).add(messageId));
            setTransactionModalData(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-md mx-4 mb-[88px] sm:mb-8 bg-bg-card-custom rounded-2xl border border-white/10 overflow-hidden animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white text-center">
                Delete {selectedMessages.size} message
                {selectedMessages.size > 1 ? "s" : ""}?
              </h3>
            </div>

            <div className="p-2">
              {/* Delete for me */}
              <button
                onClick={() => {
                  const idsToDelete = Array.from(selectedMessages);
                  if (idsToDelete.length === 0) return;

                  const queryKey = ["hub", "messages", threadId];

                  // Optimistically hide messages
                  queryClient.setQueryData<{ messages: HubMessage[] }>(
                    queryKey,
                    (old) => {
                      if (!old) return old;
                      return {
                        ...old,
                        messages: old.messages.map((msg) =>
                          idsToDelete.includes(msg.id)
                            ? { ...msg, is_hidden_by_me: true }
                            : msg
                        ),
                      };
                    }
                  );

                  // Fire and forget
                  fetch("/api/hub/messages", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      messageIds: idsToDelete,
                      action: "hide",
                    }),
                  }).then((res) => {
                    if (!res.ok) {
                      console.error("Failed to hide messages");
                      queryClient.invalidateQueries({ queryKey });
                    }
                  });

                  setSelectedMessages(new Set());
                  setIsSelectionMode(false);
                  setShowDeleteModal(false);
                }}
                className="w-full p-4 text-left hover:bg-white/5 rounded-xl transition-colors"
              >
                <p className="text-sm font-medium text-white">Delete for me</p>
                <p className="text-xs text-white/50 mt-0.5">
                  Messages will be hidden from your view only
                </p>
              </button>

              {/* Delete for everyone - only if ALL selected messages are mine */}
              {(() => {
                const selectedMsgs = searchFilteredMessages.filter((m) =>
                  selectedMessages.has(m.id)
                );
                const allMine = selectedMsgs.every(
                  (m) => m.sender_user_id === currentUserId
                );

                return (
                  <button
                    onClick={() => {
                      if (!allMine) return;
                      const idsToDelete = Array.from(selectedMessages);
                      if (idsToDelete.length === 0) return;

                      const queryKey = ["hub", "messages", threadId];

                      // Optimistically remove messages
                      queryClient.setQueryData<{ messages: HubMessage[] }>(
                        queryKey,
                        (old) => {
                          if (!old) return old;
                          return {
                            ...old,
                            messages: old.messages.filter(
                              (msg) => !idsToDelete.includes(msg.id)
                            ),
                          };
                        }
                      );

                      // Fire and forget
                      fetch("/api/hub/messages", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ messageIds: idsToDelete }),
                      }).then((res) => {
                        if (!res.ok) {
                          console.error("Failed to delete messages");
                          queryClient.invalidateQueries({ queryKey });
                        }
                      });

                      setSelectedMessages(new Set());
                      setIsSelectionMode(false);
                      setShowDeleteModal(false);
                    }}
                    disabled={!allMine}
                    className={cn(
                      "w-full p-4 text-left rounded-xl transition-colors",
                      allMine
                        ? "hover:bg-red-500/10"
                        : "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm font-medium",
                        allMine ? "text-red-400" : "text-white/50"
                      )}
                    >
                      Delete for everyone
                    </p>
                    <p className="text-xs text-white/50 mt-0.5">
                      {allMine
                        ? "Messages will be permanently deleted for all participants"
                        : "You can only delete your own messages for everyone"}
                    </p>
                  </button>
                );
              })()}
            </div>

            <div className="p-2 border-t border-white/10">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full p-3 text-center text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thread Settings Modal */}
      {showThreadSettings && thread && (
        <ThreadSettingsModal
          thread={thread}
          onClose={() => setShowThreadSettings(false)}
          onDeleted={() => {
            setShowThreadSettings(false);
            onBack();
          }}
        />
      )}
    </div>
  );
}

// Create Thread Modal
// Purpose configuration
// SVG Icon components for each purpose
const PurposeIcons = {
  general: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  budget: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  reminder: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  shopping: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  travel: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  health: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  notes: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  other: ({ className }: { className?: string }) => (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

const PURPOSE_CONFIG = {
  general: {
    label: "General",
    icon: "💬",
    defaultColor: "#6366f1", // Indigo
  },
  budget: {
    label: "Budget",
    icon: "💰",
    defaultColor: "#10b981", // Emerald
  },
  reminder: {
    label: "Reminder",
    icon: "⏰",
    defaultColor: "#f59e0b", // Amber
  },
  shopping: {
    label: "Shopping",
    icon: "🛒",
    defaultColor: "#3b82f6", // Blue
  },
  travel: {
    label: "Travel",
    icon: "✈️",
    defaultColor: "#8b5cf6", // Purple
  },
  health: {
    label: "Health",
    icon: "🏥",
    defaultColor: "#ef4444", // Red
  },
  notes: {
    label: "Notes",
    icon: "📝",
    defaultColor: "#eab308", // Yellow
  },
  other: {
    label: "Other",
    icon: "📋",
    defaultColor: "#64748b", // Slate
  },
} as const;

type ThreadPurpose = keyof typeof PURPOSE_CONFIG;

// Thread Settings Modal for editing icon/color
function ThreadSettingsModal({
  thread,
  onClose,
  onDeleted,
}: {
  thread: HubChatThread;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const themeClasses = useThemeClasses();
  const [icon, setIcon] = useState(thread.icon);
  const [color, setColor] = useState<string>(
    thread.color || PURPOSE_CONFIG[thread.purpose]?.defaultColor || "#6366f1"
  );
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const COLOR_PALETTE = [
    "#FF7043",
    "#FF5252",
    "#E91E63",
    "#9C27B0",
    "#673AB7",
    "#3F51B5",
    "#2196F3",
    "#03A9F4",
    "#00BCD4",
    "#009688",
    "#4CAF50",
    "#8BC34A",
    "#CDDC39",
    "#FFEB3B",
    "#FFC107",
    "#FF9800",
    "#795548",
    "#607D8B",
    "#9E9E9E",
    "#22d3ee",
  ];

  const IconComponent = PurposeIcons[thread.purpose] || PurposeIcons.general;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Optimistic update
      queryClient.setQueryData<{ threads: HubChatThread[] }>(
        ["hub", "threads"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            threads: old.threads.map((t) =>
              t.id === thread.id ? { ...t, icon, color } : t
            ),
          };
        }
      );

      const res = await fetch("/api/hub/threads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: thread.id,
          icon,
          color,
        }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to update thread";
        try {
          const errorData = await res.json();
          console.error("Thread update error:", errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;

          // If migration required, show specific message
          if (errorData.error === "Database migration required") {
            errorMessage =
              "Please run the database migration to add the 'color' column. Check console for details.";
            console.error("Migration required:", errorData.message);
          }
        } catch (e) {
          console.error("Error parsing response:", e);
        }
        throw new Error(errorMessage);
      }

      toast.success("Chat appearance updated");
      onClose();
    } catch (error) {
      console.error("Failed to update thread:", error);
      toast.error("Failed to update appearance");
      queryClient.invalidateQueries({ queryKey: ["hub", "threads"] });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Optimistic update - remove from list
      queryClient.setQueryData<{ threads: HubChatThread[] }>(
        ["hub", "threads"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            threads: old.threads.filter((t) => t.id !== thread.id),
          };
        }
      );

      const res = await fetch(`/api/hub/threads?thread_id=${thread.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete");
      }

      // Store thread id for undo
      const deletedThreadId = thread.id;

      // Show undo toast with action
      toast.message("Chat deleted", {
        duration: 10000,
        action: {
          label: "Undo",
          onClick: async () => {
            const undoRes = await fetch(
              `/api/hub/threads?thread_id=${deletedThreadId}&undo=true`,
              { method: "DELETE" }
            );
            if (undoRes.ok) {
              queryClient.invalidateQueries({ queryKey: ["hub", "threads"] });
              toast.success("Chat restored");
            } else {
              toast.error("Failed to restore chat");
            }
          },
        },
      });

      onClose();
      onDeleted?.();
    } catch (error) {
      console.error("Failed to delete thread:", error);
      toast.error("Failed to delete chat");
      queryClient.invalidateQueries({ queryKey: ["hub", "threads"] });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-[72px] sm:pb-0">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md mx-auto bg-bg-dark border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl animate-slide-up max-h-[calc(100vh-88px)] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-2 border-b border-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <h2
              className={`text-lg font-semibold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
            >
              Chat Appearance
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="text-slate-400 text-sm">{thread.title}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Preview */}
          <div className="flex items-center justify-center py-4">
            <div
              className="flex items-center gap-3 px-5 py-3 rounded-xl border-2 transition-all duration-300"
              style={{
                borderColor: color,
                backgroundColor: `${color}15`,
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: `${color}30`,
                  color: color,
                }}
              >
                <IconComponent className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold">{thread.title}</div>
                <div className="text-xs text-slate-400">
                  {PURPOSE_CONFIG[thread.purpose].label}
                </div>
              </div>
            </div>
          </div>

          {/* Emoji Icon (read-only display, users can't change it) */}
          <div>
            <label className={`block text-xs mb-2 ${themeClasses.textFaint}`}>
              Icon
            </label>
            <div className="w-full px-4 py-3 rounded-xl border bg-slate-900/50 border-slate-700">
              <div className="flex items-center gap-3">
                <div style={{ color }}>
                  <IconComponent className="w-6 h-6" />
                </div>
                <span className="text-white">
                  {PURPOSE_CONFIG[thread.purpose].label} Icon
                </span>
              </div>
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-xs ${themeClasses.textFaint}`}>
                Color Theme
              </label>
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {showColorPicker ? "Hide" : "Show"} Palette
              </button>
            </div>
            <div
              className="w-full px-4 py-3 rounded-xl border cursor-pointer transition-all"
              style={{
                borderColor: color,
                backgroundColor: `${color}20`,
              }}
              onClick={() => setShowColorPicker(true)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg"
                  style={{ backgroundColor: color }}
                />
                <span className="text-white font-medium">
                  {color.toUpperCase()}
                </span>
              </div>
            </div>
            {showColorPicker && (
              <div className="flex flex-wrap gap-2 p-3 mt-2 rounded-xl bg-slate-900/50 border border-slate-700">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-10 h-10 rounded-lg transition-all duration-200 active:scale-95",
                      color === c
                        ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110"
                        : "hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Delete Chat Section */}
          <div className="pt-4 border-t border-slate-800/50">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all border border-red-500/20"
              >
                <Trash2Icon className="w-5 h-5" />
                <span>Delete Chat</span>
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-red-400 text-center">
                  Are you sure? This action can be undone within 1 day.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2 rounded-xl bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 transition-all border border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800/50 bg-slate-900/30 flex gap-3">
          <button
            onClick={onClose}
            className={cn(
              "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
              "bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white",
              "border border-slate-700 hover:border-slate-600"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "flex-1 px-4 py-3 rounded-xl font-semibold transition-all",
              "bg-gradient-to-r from-cyan-500 to-blue-500 text-white",
              "hover:from-cyan-400 hover:to-blue-400",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "shadow-lg shadow-cyan-500/25"
            )}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const themeClasses = useThemeClasses();
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("💬");
  const [purpose, setPurpose] = useState<ThreadPurpose>("general");
  const [color, setColor] = useState<string>(
    PURPOSE_CONFIG.general.defaultColor
  );
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  // Color palette matching NewCategoryDrawer
  const COLOR_PALETTE = [
    "#FF7043", // Deep Orange
    "#FF5252", // Red
    "#E91E63", // Pink
    "#9C27B0", // Purple
    "#673AB7", // Deep Purple
    "#3F51B5", // Indigo
    "#2196F3", // Blue
    "#03A9F4", // Light Blue
    "#00BCD4", // Cyan
    "#009688", // Teal
    "#4CAF50", // Green
    "#8BC34A", // Light Green
    "#CDDC39", // Lime
    "#FFEB3B", // Yellow
    "#FFC107", // Amber
    "#FF9800", // Orange
    "#795548", // Brown
    "#607D8B", // Blue Grey
    "#9E9E9E", // Grey
    "#22d3ee", // Theme cyan
  ];

  // Update color when purpose changes
  const handlePurposeChange = (newPurpose: ThreadPurpose) => {
    setPurpose(newPurpose);
    const config = PURPOSE_CONFIG[newPurpose];
    setColor(config.defaultColor);
    setIcon(config.icon);
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    createThread.mutate(
      {
        title: title.trim(),
        icon,
        household_id: householdId,
        purpose,
        is_private: isPrivate,
      },
      {
        onSuccess: (data) => {
          onCreated(data.thread.id);
        },
      }
    );
  };

  const IconComponent = PurposeIcons[purpose];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-[72px] sm:pb-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Drawer style */}
      <div className="relative w-full sm:max-w-md mx-auto bg-bg-dark border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl animate-slide-up max-h-[calc(100vh-88px)] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 border-b border-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <h2
              className={`text-lg font-semibold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
            >
              New Conversation
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="text-slate-400 text-sm">
            Create a chat for your household
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Preview Card */}
          <div className="flex items-center justify-center py-4">
            <div
              className="flex items-center gap-3 px-5 py-3 rounded-xl border-2 transition-all duration-300"
              style={{
                borderColor: color,
                backgroundColor: `${color}15`,
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: `${color}30`,
                  color: color,
                }}
              >
                <IconComponent className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <div className="text-white font-semibold">
                  {title || "Conversation Name"}
                </div>
                <div className="text-xs text-slate-400">
                  {PURPOSE_CONFIG[purpose].label}
                </div>
              </div>
              {isPrivate && (
                <svg
                  className="w-4 h-4 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className={`block text-xs mb-2 ${themeClasses.textFaint}`}>
              Conversation Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Groceries, Bill Reminders..."
              className={cn(
                "w-full px-4 py-3 rounded-xl border transition-all",
                "bg-slate-900/50 text-white placeholder:text-slate-500",
                "border-slate-700 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              )}
              autoFocus
            />
          </div>

          {/* Purpose Picker */}
          <div>
            <label className={`block text-xs mb-2 ${themeClasses.textFaint}`}>
              Purpose
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(PURPOSE_CONFIG) as ThreadPurpose[]).map((key) => {
                const config = PURPOSE_CONFIG[key];
                const Icon = PurposeIcons[key];
                const isSelected = purpose === key;
                return (
                  <button
                    key={key}
                    onClick={() => handlePurposeChange(key)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 active:scale-95",
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20"
                        : "border-slate-700 bg-slate-900/50 hover:bg-slate-800/50 hover:border-slate-600"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 transition-colors",
                        isSelected ? "text-cyan-400" : "text-slate-400"
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isSelected ? "text-white" : "text-slate-400"
                      )}
                    >
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-xs ${themeClasses.textFaint}`}>
                Color
              </label>
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {showColorPicker ? "Hide" : "Show"} Palette
              </button>
            </div>
            {showColorPicker && (
              <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-700">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-10 h-10 rounded-lg transition-all duration-200 active:scale-95",
                      color === c
                        ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110"
                        : "hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Privacy Toggle */}
          <div>
            <label className={`block text-xs mb-2 ${themeClasses.textFaint}`}>
              Privacy
            </label>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              suppressHydrationWarning
              className={cn(
                "w-full group relative p-3 rounded-xl border transition-all duration-300 active:scale-[0.98] flex items-center gap-3 overflow-hidden",
                isPrivate
                  ? `${themeClasses.borderActive} bg-gradient-to-br ${themeClasses.activeItemGradient} ${themeClasses.activeItemShadow}`
                  : `border-slate-700 bg-slate-900/50 hover:bg-slate-800/50 hover:border-slate-600`
              )}
            >
              {isPrivate && (
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${themeClasses.iconBg} animate-[shimmer_3s_ease-in-out_infinite]`}
                />
              )}

              <svg
                className={cn(
                  "relative w-5 h-5 transition-all duration-500 shrink-0",
                  isPrivate
                    ? `${themeClasses.textActive} drop-shadow-[0_0_10px_rgba(20,184,166,0.8)] animate-pulse`
                    : "text-slate-400"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                {isPrivate ? (
                  <>
                    <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </>
                ) : (
                  <>
                    <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  </>
                )}
              </svg>

              <div className="flex-1 text-left">
                <div
                  className={cn(
                    "relative text-sm font-semibold tracking-wide transition-all duration-300",
                    isPrivate
                      ? `${themeClasses.textActive} drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]`
                      : "text-white"
                  )}
                >
                  {isPrivate ? "Private" : "Public"}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {isPrivate
                    ? "Only you can see this chat"
                    : "Visible to all household members"}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800/50 bg-slate-900/30 flex gap-3">
          <button
            onClick={onClose}
            className={cn(
              "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
              "bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white",
              "border border-slate-700 hover:border-slate-600"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || createThread.isPending}
            className={cn(
              "flex-1 px-4 py-3 rounded-xl font-semibold transition-all",
              "bg-gradient-to-r from-cyan-500 to-blue-500 text-white",
              "hover:from-cyan-400 hover:to-blue-400",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-cyan-500 disabled:hover:to-blue-500",
              "shadow-lg shadow-cyan-500/25"
            )}
          >
            {createThread.isPending ? "Creating..." : "Create Chat"}
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
  const confirmTransactions = useConfirmTransactions();
  const snoozeAlert = useSnoozeAlert();
  const updateNotificationTime = useUpdateNotificationTime();
  const [showCelebration, setShowCelebration] = useState<string | null>(null);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState<string | null>(null);
  const [showTimeSettings, setShowTimeSettings] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState("20:00");
  const alerts = data?.alerts || [];

  const handleConfirmTransactions = async (alertId: string) => {
    setShowCelebration(alertId);
    await confirmTransactions.mutateAsync(alertId);
    // Let animation play before removing
    setTimeout(() => {
      setShowCelebration(null);
    }, 2000);
  };

  const handleNotYet = () => {
    // Navigate to add expense
    window.location.href = "/dashboard?action=add-expense";
  };

  const handleSnooze = async (alertId: string, minutes: number) => {
    await snoozeAlert.mutateAsync({
      notificationId: alertId,
      snoozeMinutes: minutes,
    });
    setShowSnoozeMenu(null);
    toast.success(
      `Snoozed for ${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}`
    );
  };

  const handleUpdateTime = async (time: string) => {
    await updateNotificationTime.mutateAsync({
      preferenceKey: "daily_transaction_reminder",
      preferredTime: `${time}:00`,
    });
    setShowTimeSettings(null);
    toast.success(`Reminder time updated to ${time}`);
  };

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

  const getIcon = (type: string | null | undefined) => {
    switch (type) {
      case "budget_warning":
      case "budget_exceeded":
        return "⚠️";
      case "goal_milestone":
      case "goal_completed":
        return "🎉";
      case "weekly_summary":
      case "monthly_summary":
        return "📊";
      case "bill_due":
      case "bill_overdue":
        return "📅";
      case "daily_reminder":
      case "transaction_reminder":
        return "📝";
      case "item_reminder":
      case "item_due":
      case "item_overdue":
        return "⏰";
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
        return "border-cyan-500/30";
      default:
        return "border-blue-500/20";
    }
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert: HubAlert) => {
        const isCelebrating = showCelebration === alert.id;
        // Check for transaction reminder type
        const isTransactionReminder =
          alert.action_type === "transaction_reminder" ||
          alert.action_type === "log_transaction" ||
          alert.notification_type === "daily_reminder";

        // Special UI for transaction reminder
        if (isTransactionReminder) {
          const isSnoozeMenuOpen = showSnoozeMenu === alert.id;
          const isTimeSettingsOpen = showTimeSettings === alert.id;

          return (
            <div
              key={alert.id}
              className={cn(
                "p-4 rounded-xl neo-card bg-bg-card-custom border relative overflow-hidden transition-all duration-300",
                isCelebrating
                  ? "border-green-500/50 bg-green-500/10"
                  : "border-cyan-500/30"
              )}
            >
              {/* Celebration animation overlay */}
              {isCelebrating && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-green-500/20 to-cyan-500/20 backdrop-blur-sm z-10">
                  <div className="text-center animate-bounce">
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="text-green-400 font-semibold">Great job!</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="text-2xl">📝</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white">
                      {alert.title}
                    </p>
                  </div>
                  <p className="text-sm text-white/60">{alert.message}</p>
                  <p className="text-xs text-white/30 mt-1">
                    {formatRelativeTime(alert.created_at)}
                  </p>

                  {/* Main Action buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleConfirmTransactions(alert.id)}
                      disabled={confirmTransactions.isPending || isCelebrating}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-medium hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50"
                    >
                      <CheckIcon className="w-4 h-4" />
                      Yes, all done!
                    </button>
                    <button
                      onClick={handleNotYet}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white/80 text-sm font-medium hover:bg-white/20 transition-all"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Log Expense
                    </button>
                  </div>

                  {/* Secondary actions: Snooze & Settings */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() =>
                        setShowSnoozeMenu(isSnoozeMenuOpen ? null : alert.id)
                      }
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-medium hover:bg-white/10 hover:text-white/70 transition-all"
                    >
                      ⏰ Snooze
                    </button>
                    <button
                      onClick={() =>
                        setShowTimeSettings(
                          isTimeSettingsOpen ? null : alert.id
                        )
                      }
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs font-medium hover:bg-white/10 hover:text-white/70 transition-all"
                    >
                      <Settings className="w-3 h-3" /> Change Time
                    </button>
                  </div>

                  {/* Snooze menu */}
                  {isSnoozeMenuOpen && (
                    <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs text-white/40 mb-2">Snooze for:</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: "1h", minutes: 60 },
                          { label: "3h", minutes: 180 },
                          { label: "6h", minutes: 360 },
                          { label: "Tomorrow", minutes: 60 * 24 },
                        ].map((option) => (
                          <button
                            key={option.label}
                            onClick={() =>
                              handleSnooze(alert.id, option.minutes)
                            }
                            disabled={snoozeAlert.isPending}
                            className="px-3 py-1 rounded-md bg-white/10 text-white/70 text-xs hover:bg-white/20 transition-all disabled:opacity-50"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Time settings */}
                  {isTimeSettingsOpen && (
                    <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs text-white/40 mb-2">
                        Daily reminder time:
                      </p>
                      <div className="flex gap-2 items-center">
                        <input
                          type="time"
                          value={selectedTime}
                          onChange={(e) => setSelectedTime(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-md bg-white/10 text-white text-sm border border-white/10 focus:outline-none focus:border-cyan-500/50"
                        />
                        <button
                          onClick={() => handleUpdateTime(selectedTime)}
                          disabled={updateNotificationTime.isPending}
                          className="px-4 py-1.5 rounded-md bg-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-all disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                      <p className="text-xs text-white/30 mt-1">
                        You&apos;ll be reminded at this time every day
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // Regular alert UI
        return (
          <div
            key={alert.id}
            className={cn(
              "p-4 rounded-xl neo-card bg-bg-card-custom flex items-start gap-3 border",
              getBorderColor(alert.severity)
            )}
          >
            <div className="text-2xl">
              {getIcon(alert.notification_type || alert.alert_type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-white">
                  {alert.title}
                </p>
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
        );
      })}
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
