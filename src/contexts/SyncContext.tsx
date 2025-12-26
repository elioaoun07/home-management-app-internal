// src/contexts/SyncContext.tsx
"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

// Sync status types
export type SyncStatus =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "offline"
  | "error";

// Pending operation for offline queue
interface PendingOperation {
  id: string;
  type:
    | "toggle_check"
    | "add_item"
    | "delete_item"
    | "set_quantity"
    | "set_url";
  payload: Record<string, unknown>;
  retryCount: number;
  createdAt: number;
  threadId?: string;
}

interface SyncContextValue {
  // Connection status
  status: SyncStatus;
  isOnline: boolean;
  lastSyncTime: Date | null;

  // Manual refresh
  refreshAll: () => Promise<void>;
  refreshThread: (threadId: string) => Promise<void>;

  // Retry mechanism
  retryWithBackoff: <T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ) => Promise<T>;

  // Pending operations (for offline queue)
  pendingOperations: PendingOperation[];
  addPendingOperation: (
    op: Omit<PendingOperation, "id" | "retryCount" | "createdAt">
  ) => string;
  removePendingOperation: (id: string) => void;

  // Subscription status per thread
  threadSubscriptions: Map<string, boolean>;
  setThreadSubscribed: (threadId: string, subscribed: boolean) => void;

  // Force refetch on next focus
  markStale: (threadId?: string) => void;
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
  showToast?: boolean;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const DEFAULT_RETRY_OPTIONS: Required<
  Omit<RetryOptions, "onRetry" | "showToast">
> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

// Storage key for pending operations
const PENDING_OPS_KEY = "sync-pending-operations";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pendingOperations, setPendingOperations] = useState<
    PendingOperation[]
  >([]);
  const [threadSubscriptions, setThreadSubscriptions] = useState<
    Map<string, boolean>
  >(new Map());

  // Track stale threads that need refresh on focus
  const staleThreads = useRef<Set<string>>(new Set());
  const allStale = useRef(false);

  // Connection health check interval
  const healthCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempt = useRef(0);
  const maxReconnectAttempts = 5;

  // Load pending operations from storage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(PENDING_OPS_KEY);
      if (stored) {
        const ops = JSON.parse(stored) as PendingOperation[];
        // Filter out stale operations (older than 1 hour)
        const fresh = ops.filter(
          (op) => Date.now() - op.createdAt < 60 * 60 * 1000
        );
        setPendingOperations(fresh);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save pending operations to storage when changed
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(pendingOperations));
    } catch {
      // Ignore storage errors
    }
  }, [pendingOperations]);

  // Detect online/offline status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setStatus("reconnecting");
      // Trigger reconnection
      processPendingOperations();
      refreshAll();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatus("offline");
    };

    // Initial check
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) {
      setStatus("offline");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Visibility change handler - refresh when returning to tab
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (!document.hidden && isOnline) {
        // User returned to the app - check for updates
        if (allStale.current) {
          refreshAll();
          allStale.current = false;
        } else if (staleThreads.current.size > 0) {
          // Refresh only stale threads
          staleThreads.current.forEach((threadId) => {
            refreshThread(threadId);
          });
          staleThreads.current.clear();
        } else {
          // Light refresh - just invalidate active queries
          const hasAnySubscriptionDown = Array.from(
            threadSubscriptions.values()
          ).some((v) => !v);
          if (hasAnySubscriptionDown) {
            refreshAll();
          }
        }

        // Process any pending operations
        processPendingOperations();
      }
    };

    // Also check focus (for mobile apps)
    const handleFocus = () => {
      if (isOnline) {
        handleVisibilityChange();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isOnline, threadSubscriptions]);

  // Connection health check via Supabase realtime ping
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkConnection = async () => {
      const supabase = supabaseBrowser();
      const channels = supabase.getChannels();

      // Check if we have any active channels
      if (channels.length === 0) {
        // No channels = not connected to realtime
        if (status === "connected") {
          setStatus("reconnecting");
        }
        return;
      }

      // Check channel states
      const allSubscribed = channels.every(
        (ch) => (ch as unknown as { state: string }).state === "joined"
      );

      if (allSubscribed) {
        if (status !== "connected") {
          setStatus("connected");
          reconnectAttempt.current = 0;
        }
      } else {
        setStatus("reconnecting");
      }
    };

    // Run health check periodically
    healthCheckInterval.current = setInterval(checkConnection, 5000);

    // Initial check
    checkConnection();

    return () => {
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current);
      }
    };
  }, [status]);

  // Retry with exponential backoff
  const retryWithBackoff = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      options?: RetryOptions
    ): Promise<T> => {
      const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
      let lastError: Error;

      for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
          const result = await operation();
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt < opts.maxRetries) {
            const delay = Math.min(
              opts.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
              opts.maxDelay
            );

            opts.onRetry?.(attempt + 1, lastError);

            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (options?.showToast !== false) {
        toast.error("Operation failed. Please try again.");
      }

      throw lastError!;
    },
    []
  );

  // Process pending operations
  const processPendingOperations = useCallback(async () => {
    if (!isOnline || pendingOperations.length === 0) return;

    const opsToProcess = [...pendingOperations];

    for (const op of opsToProcess) {
      try {
        // Build the API request based on operation type
        let url = "/api/hub/messages";
        let method = "PATCH";
        let body: Record<string, unknown> = { ...op.payload };

        switch (op.type) {
          case "toggle_check":
            body.action = "toggle_check";
            break;
          case "set_quantity":
            body.action = "set_quantity";
            break;
          case "set_url":
            body.action = "set_item_url";
            break;
          case "add_item":
            method = "POST";
            break;
          case "delete_item":
            method = "DELETE";
            break;
        }

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          // Remove from pending
          removePendingOperation(op.id);

          // Refresh the thread if we have one
          if (op.threadId) {
            queryClient.invalidateQueries({
              queryKey: ["hub", "messages", op.threadId],
            });
          }
        } else if (response.status >= 500) {
          // Server error - will retry later
          continue;
        } else {
          // Client error (4xx) - remove operation, it won't succeed
          removePendingOperation(op.id);
        }
      } catch {
        // Network error - will retry later
        continue;
      }
    }
  }, [isOnline, pendingOperations, queryClient]);

  // Add pending operation
  const addPendingOperation = useCallback(
    (op: Omit<PendingOperation, "id" | "retryCount" | "createdAt">): string => {
      const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const newOp: PendingOperation = {
        ...op,
        id,
        retryCount: 0,
        createdAt: Date.now(),
      };

      setPendingOperations((prev) => [...prev, newOp]);
      return id;
    },
    []
  );

  // Remove pending operation
  const removePendingOperation = useCallback((id: string) => {
    setPendingOperations((prev) => prev.filter((op) => op.id !== id));
  }, []);

  // Set thread subscription status
  const setThreadSubscribed = useCallback(
    (threadId: string, subscribed: boolean) => {
      setThreadSubscriptions((prev) => {
        const next = new Map(prev);
        next.set(threadId, subscribed);
        return next;
      });

      if (subscribed && status !== "connected") {
        setStatus("connected");
      }
    },
    [status]
  );

  // Mark thread as stale (will refresh on next focus)
  const markStale = useCallback((threadId?: string) => {
    if (threadId) {
      staleThreads.current.add(threadId);
    } else {
      allStale.current = true;
    }
  }, []);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    setStatus("reconnecting");

    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["hub", "threads"] }),
        queryClient.invalidateQueries({ queryKey: ["hub", "messages"] }),
        queryClient.invalidateQueries({ queryKey: ["hub", "alerts"] }),
        queryClient.invalidateQueries({ queryKey: ["hub", "feed"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      ]);

      setLastSyncTime(new Date());
      setStatus(isOnline ? "connected" : "offline");
    } catch (error) {
      console.error("Failed to refresh:", error);
      setStatus("error");
    }
  }, [queryClient, isOnline]);

  // Refresh specific thread
  const refreshThread = useCallback(
    async (threadId: string) => {
      try {
        await queryClient.invalidateQueries({
          queryKey: ["hub", "messages", threadId],
          refetchType: "active",
        });
        setLastSyncTime(new Date());
      } catch (error) {
        console.error(`Failed to refresh thread ${threadId}:`, error);
      }
    },
    [queryClient]
  );

  return (
    <SyncContext.Provider
      value={{
        status,
        isOnline,
        lastSyncTime,
        refreshAll,
        refreshThread,
        retryWithBackoff,
        pendingOperations,
        addPendingOperation,
        removePendingOperation,
        threadSubscriptions,
        setThreadSubscribed,
        markStale,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}

// Hook for safe sync operations (works even without provider)
export function useSyncSafe() {
  const context = useContext(SyncContext);
  return context;
}
