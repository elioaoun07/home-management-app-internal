// src/components/ui/SyncIndicator.tsx
"use client";

import { MOBILE_NAV_HEIGHT } from "@/constants/layout";
import { SyncStatus, useSyncSafe } from "@/contexts/SyncContext";
import { useOfflinePendingStore } from "@/lib/stores/offlinePendingStore";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronUp,
  Clock,
  Loader2,
  RefreshCw,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SyncIndicatorProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
  onRefresh?: () => Promise<void>;
}

const statusConfig: Record<
  SyncStatus,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    label: string;
    description: string;
  }
> = {
  connected: {
    icon: CheckCircle2,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    label: "Synced",
    description: "All data is up to date",
  },
  connecting: {
    icon: Loader2,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    label: "Connecting",
    description: "Establishing connection...",
  },
  reconnecting: {
    icon: RefreshCw,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    label: "Syncing",
    description: "Reconnecting to server...",
  },
  offline: {
    icon: WifiOff,
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    label: "Offline",
    description: "No internet connection",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    label: "Error",
    description: "Connection error",
  },
};

export function SyncIndicator({
  className,
  showLabel = false,
  compact = false,
  onRefresh,
}: SyncIndicatorProps) {
  const sync = useSyncSafe();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Default to connected if no sync context
  const status = sync?.status ?? "connected";
  // Use BOTH Zustand store (synchronous, instant) and SyncContext (async IDB)
  // Take the max to ensure we never miss an increment
  const zustandCount = useOfflinePendingStore((s) => s.count);
  const contextCount = sync?.offlinePendingCount ?? 0;
  const pendingCount = Math.max(zustandCount, contextCount);
  const config = statusConfig[status];
  const Icon = config.icon;

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else if (sync?.refreshAll) {
        await sync.refreshAll();
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [isRefreshing, onRefresh, sync]);

  // Show notification when going offline
  useEffect(() => {
    if (status === "offline") {
      setShowTooltip(true);
      const timer = setTimeout(() => setShowTooltip(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (compact) {
    return (
      <button
        onClick={handleRefresh}
        disabled={isRefreshing || status === "offline"}
        className={cn(
          "relative p-2 rounded-lg transition-all duration-200",
          "hover:bg-white/5 active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          config.bgColor,
          className,
        )}
        title={`${config.label}: ${config.description}. Tap to refresh.`}
      >
        <Icon
          className={cn(
            "w-4 h-4 transition-all",
            config.color,
            (isRefreshing ||
              status === "reconnecting" ||
              status === "connecting") &&
              "animate-spin",
          )}
        />

        {/* Pending operations badge - show offline queue count */}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-[10px] font-bold text-black rounded-full flex items-center justify-center">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={handleRefresh}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={isRefreshing || status === "offline"}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200",
          "hover:bg-white/5 active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          config.bgColor,
        )}
      >
        <Icon
          className={cn(
            "w-4 h-4 transition-all",
            config.color,
            (isRefreshing ||
              status === "reconnecting" ||
              status === "connecting") &&
              "animate-spin",
          )}
        />

        {showLabel && (
          <span className={cn("text-sm font-medium", config.color)}>
            {config.label}
          </span>
        )}

        {/* Pending operations badge - show offline queue count */}
        {pendingCount > 0 && (
          <span className="px-1.5 py-0.5 bg-yellow-500 text-[10px] font-bold text-black rounded-full">
            {pendingCount} pending
          </span>
        )}
      </button>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-full mt-2 right-0 z-50 p-3 rounded-xl bg-bg-card-custom border border-white/10 shadow-xl min-w-[200px]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn("w-5 h-5", config.color)} />
              <span className="font-medium text-white">{config.label}</span>
            </div>
            <p className="text-sm text-white/60">{config.description}</p>

            {sync?.lastSyncTime && (
              <p className="text-xs text-white/40 mt-2">
                Last synced: {formatTimeAgo(sync.lastSyncTime)}
              </p>
            )}

            {pendingCount > 0 && (
              <p className="text-xs text-yellow-400 mt-2">
                {pendingCount} operation(s) pending
              </p>
            )}

            <p className="text-xs text-white/30 mt-2 italic">
              Tap to refresh manually
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Floating pill indicator — sits above the bottom nav bar.
 * Shows offline status, pending queue count, syncing state.
 * Tappable to expand and show pending operations list.
 */
export function SyncPill({ className }: { className?: string }) {
  const sync = useSyncSafe();
  const [expanded, setExpanded] = useState(false);
  const [showSynced, setShowSynced] = useState(false);
  const prevCountRef = useRef(0);

  const status = sync?.status ?? "connected";
  const isOnline = sync?.isOnline ?? true;
  const isProcessing = sync?.isProcessingQueue ?? false;
  // Use BOTH Zustand store (synchronous, instant) and SyncContext (async IDB)
  const zustandCount = useOfflinePendingStore((s) => s.count);
  const contextCount = sync?.offlinePendingCount ?? 0;
  const pendingCount = Math.max(zustandCount, contextCount);
  const pendingOps = sync?.offlinePendingOps ?? [];

  // Briefly show "All synced" when queue goes from >0 to 0
  useEffect(() => {
    if (prevCountRef.current > 0 && pendingCount === 0 && isOnline) {
      setShowSynced(true);
      const timer = setTimeout(() => setShowSynced(false), 2000);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = pendingCount;
  }, [pendingCount, isOnline]);

  // Determine visibility and content
  const isOffline = !isOnline || status === "offline";
  const hasError =
    sync?.lastSyncResult?.failed && sync.lastSyncResult.failed > 0;
  const shouldShow =
    isOffline || pendingCount > 0 || isProcessing || showSynced || hasError;

  if (!shouldShow) return null;

  // Determine pill state
  let pillColor = "bg-gray-800/90 border-gray-600/50";
  let pillIcon = <WifiOff className="w-3.5 h-3.5 text-gray-400" />;
  let pillLabel = "Offline";

  if (isProcessing) {
    pillColor = "bg-blue-950/90 border-blue-500/30";
    pillIcon = <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
    pillLabel = `Syncing ${pendingCount} change${pendingCount !== 1 ? "s" : ""}…`;
  } else if (showSynced && !isOffline) {
    pillColor = "bg-green-950/90 border-green-500/30";
    pillIcon = <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
    pillLabel = "All changes synced";
  } else if (hasError && !isOffline) {
    pillColor = "bg-amber-950/90 border-amber-500/30";
    pillIcon = <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
    pillLabel = "Sync failed · Tap to retry";
  } else if (isOffline && pendingCount > 0) {
    pillColor = "bg-amber-950/90 border-amber-500/30";
    pillIcon = <WifiOff className="w-3.5 h-3.5 text-amber-400" />;
    pillLabel = `Offline · ${pendingCount} pending`;
  } else if (isOffline) {
    pillColor = "bg-gray-800/90 border-gray-600/50";
    pillIcon = <WifiOff className="w-3.5 h-3.5 text-gray-400" />;
    pillLabel = "Offline";
  } else if (pendingCount > 0) {
    pillColor = "bg-amber-950/90 border-amber-500/30";
    pillIcon = <Clock className="w-3.5 h-3.5 text-amber-400" />;
    pillLabel = `${pendingCount} pending change${pendingCount !== 1 ? "s" : ""}`;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn("fixed left-4 right-4 z-40", className)}
        style={{ bottom: MOBILE_NAV_HEIGHT + 8 }}
      >
        {/* Main pill */}
        <motion.button
          layout
          onClick={() => {
            if (hasError && !isOffline) {
              sync?.retryOfflineQueue();
            } else if (pendingCount > 0) {
              setExpanded(!expanded);
            }
          }}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-2xl",
            "border backdrop-blur-md shadow-lg",
            "transition-colors duration-200",
            pillColor,
          )}
        >
          {pillIcon}
          <span className="text-xs font-medium text-white/80">{pillLabel}</span>
          {pendingCount > 0 && !isProcessing && !showSynced && (
            <ChevronUp
              className={cn(
                "w-3.5 h-3.5 text-white/40 transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          )}
        </motion.button>

        {/* Expanded operations list */}
        <AnimatePresence>
          {expanded && pendingCount > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 p-3 rounded-2xl border border-white/10 bg-gray-900/95 backdrop-blur-md shadow-xl max-h-[200px] overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white/60">
                    Pending Operations
                  </span>
                  <div className="flex gap-1">
                    {sync?.retryOfflineQueue && isOnline && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sync.retryOfflineQueue();
                          setExpanded(false);
                        }}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                        title="Retry now"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                    )}
                    {sync?.clearOfflineQueue && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Discard all pending changes?")) {
                            sync.clearOfflineQueue();
                            setExpanded(false);
                          }
                        }}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                        title="Discard all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(false);
                      }}
                      className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-white/40" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {pendingOps.map((op) => (
                    <div
                      key={op.id}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg bg-white/5"
                    >
                      <span className="text-[10px] text-white/30 font-mono">
                        {getFeatureIcon(op.feature)}
                      </span>
                      <span className="text-xs text-white/70 truncate flex-1">
                        {op.metadata?.label || `${op.operation} ${op.feature}`}
                      </span>
                      <span className="text-[10px] text-white/30 shrink-0">
                        {formatTimeAgo(new Date(op.createdAt))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

function getFeatureIcon(feature: string): string {
  switch (feature) {
    case "transaction":
      return "💰";
    case "item":
      return "📋";
    case "hub-message":
      return "💬";
    case "subtask":
      return "☑️";
    case "recurring":
      return "🔄";
    default:
      return "📌";
  }
}

// Full-width offline banner
export function OfflineBanner({ className }: { className?: string }) {
  const sync = useSyncSafe();
  const status = sync?.status ?? "connected";
  const pendingCount = sync?.offlinePendingCount ?? 0;

  if (status !== "offline" && status !== "error") return null;

  const isOffline = status === "offline";

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2",
        isOffline ? "bg-gray-800" : "bg-red-900/50",
        className,
      )}
    >
      {isOffline ? (
        <WifiOff className="w-4 h-4 text-gray-400" />
      ) : (
        <AlertCircle className="w-4 h-4 text-red-400" />
      )}
      <span className="text-sm text-white/80">
        {isOffline
          ? `You're offline.${pendingCount > 0 ? ` ${pendingCount} change${pendingCount !== 1 ? "s" : ""} will sync when connected.` : " Changes will sync when connection is restored."}`
          : "Connection error. Retrying..."}
      </span>
      {!isOffline && sync?.refreshAll && (
        <button
          onClick={() => sync.refreshAll()}
          className="px-2 py-1 text-xs bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
        >
          Retry Now
        </button>
      )}
    </motion.div>
  );
}

// Floating refresh button (for mobile)
export function FloatingRefreshButton({ className }: { className?: string }) {
  const sync = useSyncSafe();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !sync?.refreshAll) return;

    setIsRefreshing(true);
    try {
      await sync.refreshAll();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [isRefreshing, sync]);

  if (!sync) return null;

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing || sync.status === "offline"}
      className={cn(
        "fixed bottom-24 right-4 z-40",
        "w-12 h-12 rounded-full",
        "bg-gradient-to-r from-blue-500 to-purple-500",
        "flex items-center justify-center",
        "shadow-lg shadow-blue-500/20",
        "hover:scale-105 active:scale-95",
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      <RefreshCw
        className={cn("w-5 h-5 text-white", isRefreshing && "animate-spin")}
      />
    </button>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleDateString();
}
