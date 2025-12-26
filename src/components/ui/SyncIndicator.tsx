// src/components/ui/SyncIndicator.tsx
"use client";

import { SyncStatus, useSyncSafe } from "@/contexts/SyncContext";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
          className
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
              "animate-spin"
          )}
        />

        {/* Pending operations badge */}
        {sync?.pendingOperations && sync.pendingOperations.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-[10px] font-bold text-black rounded-full flex items-center justify-center">
            {sync.pendingOperations.length}
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
          config.bgColor
        )}
      >
        <Icon
          className={cn(
            "w-4 h-4 transition-all",
            config.color,
            (isRefreshing ||
              status === "reconnecting" ||
              status === "connecting") &&
              "animate-spin"
          )}
        />

        {showLabel && (
          <span className={cn("text-sm font-medium", config.color)}>
            {config.label}
          </span>
        )}

        {/* Pending operations badge */}
        {sync?.pendingOperations && sync.pendingOperations.length > 0 && (
          <span className="px-1.5 py-0.5 bg-yellow-500 text-[10px] font-bold text-black rounded-full">
            {sync.pendingOperations.length} pending
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

            {sync?.pendingOperations && sync.pendingOperations.length > 0 && (
              <p className="text-xs text-yellow-400 mt-2">
                {sync.pendingOperations.length} operation(s) pending
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

// Full-width offline banner
export function OfflineBanner({ className }: { className?: string }) {
  const sync = useSyncSafe();
  const status = sync?.status ?? "connected";

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
        className
      )}
    >
      {isOffline ? (
        <WifiOff className="w-4 h-4 text-gray-400" />
      ) : (
        <AlertCircle className="w-4 h-4 text-red-400" />
      )}
      <span className="text-sm text-white/80">
        {isOffline
          ? "You're offline. Changes will sync when connection is restored."
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
        className
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
