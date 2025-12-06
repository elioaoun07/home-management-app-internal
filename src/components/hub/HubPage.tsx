"use client";

import {
  AlertBellIcon,
  ChevronLeftIcon,
  FeedIcon,
  MessageIcon,
  PlusIcon,
  SendIcon,
  TrophyIcon,
  XIcon,
} from "@/components/icons/FuturisticIcons";
import {
  useCreateThread,
  useDismissAlert,
  useHubAlerts,
  useHubFeed,
  useHubMessages,
  useHubStats,
  useHubThreads,
  useSendMessage,
  type HubAlert,
  type HubChatThread,
  type HubFeedItem,
  type HubMessage,
} from "@/features/hub/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type HubView = "chat" | "feed" | "score" | "alerts";

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

  if (!householdId) {
    return (
      <div className="p-8 rounded-2xl neo-card bg-bg-card-custom border border-white/5 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
          <MessageIcon className="w-8 h-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Household</h3>
        <p className="text-sm text-white/50">
          Link with a partner in Settings to start chatting!
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Header with Create Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Conversations</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Thread List */}
      {threads.length === 0 ? (
        <div className="p-8 rounded-2xl neo-card bg-bg-card-custom border border-white/5 text-center">
          <MessageIcon className="w-12 h-12 mx-auto mb-3 text-blue-400/50" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No Chats Yet
          </h3>
          <p className="text-sm text-white/50 mb-4">
            Create your first conversation to start chatting with your
            household!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium"
          >
            Create First Chat
          </button>
        </div>
      ) : (
        <div className="space-y-2">
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
      className="w-full p-4 rounded-xl neo-card bg-bg-card-custom border border-white/5 hover:border-white/10 transition-all flex items-center gap-3 text-left"
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-xl shrink-0">
        {thread.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white truncate">
            {thread.title}
          </h3>
          {thread.unread_count > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-xs font-medium">
              {thread.unread_count}
            </span>
          )}
        </div>
        {lastMessage ? (
          <p className="text-xs text-white/50 truncate mt-0.5">
            {isMyLastMessage ? "You: " : ""}
            {lastMessage.content}
          </p>
        ) : (
          <p className="text-xs text-white/30 italic mt-0.5">No messages yet</p>
        )}
      </div>

      {/* Time */}
      <span className="text-xs text-white/30 shrink-0">
        {formatRelativeTime(thread.last_message_at)}
      </span>
    </button>
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

  const messages = data?.messages || [];
  const currentUserId = data?.current_user_id;
  const thread = threadsData?.threads.find((t) => t.id === threadId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMessage.mutate(
      { content: newMessage, thread_id: threadId },
      { onSuccess: () => setNewMessage("") }
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Thread Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-bg-card-custom">
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageIcon className="w-12 h-12 mb-3 text-blue-400/30" />
            <p className="text-sm text-white/50">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((msg: HubMessage) => {
            const isMe = msg.sender_user_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={cn("flex", isMe ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] px-4 py-2.5 rounded-2xl",
                    isMe
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-md"
                      : "neo-card bg-bg-card-custom border border-white/5 text-white rounded-bl-md"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      isMe ? "text-white/60" : "text-white/40"
                    )}
                  >
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/5 bg-bg-card-custom">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
