// src/contexts/SyncContext.tsx
"use client";

import {
  isReallyOnline,
  probeNow,
  startProbing,
  stopProbing,
} from "@/lib/connectivityManager";
import {
  addToQueue,
  clearQueue as clearOfflineQueue,
  getAllPending,
  getQueueCount,
  removeFromQueue,
  updateQueuedOperation,
  type OfflineOperation,
  type QueueableOperation,
} from "@/lib/offlineQueue";
import {
  createSyncEngine,
  FEATURE_QUERY_KEYS,
  type OfflineSyncEngine,
  type SyncResult,
} from "@/lib/offlineSyncEngine";
import { offlinePendingActions } from "@/lib/stores/offlinePendingStore";
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

// Legacy pending operation for hub shopping list (backward compat)
interface LegacyPendingOperation {
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
    options?: RetryOptions,
  ) => Promise<T>;

  // Legacy pending operations (for hub shopping list backward compat)
  pendingOperations: LegacyPendingOperation[];
  addPendingOperation: (
    op: Omit<LegacyPendingOperation, "id" | "retryCount" | "createdAt">,
  ) => string;
  removePendingOperation: (id: string) => void;

  // Subscription status per thread
  threadSubscriptions: Map<string, boolean>;
  setThreadSubscribed: (threadId: string, subscribed: boolean) => void;

  // Force refetch on next focus
  markStale: (threadId?: string) => void;

  // === NEW: Offline queue (IndexedDB-backed) ===
  offlinePendingCount: number;
  offlinePendingOps: OfflineOperation[];
  queueOperation: (op: QueueableOperation) => Promise<string>;
  isProcessingQueue: boolean;
  lastSyncResult: SyncResult | null;
  clearOfflineQueue: () => Promise<void>;
  removeOfflineOperation: (id: string) => Promise<void>;
  updateOfflineOperation: (
    id: string,
    updates: {
      body?: Record<string, unknown>;
      metadata?: { label: string; icon?: string };
    },
  ) => Promise<boolean>;
  retryOfflineQueue: () => Promise<void>;
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

// Storage key for legacy pending operations
const PENDING_OPS_KEY = "sync-pending-operations";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pendingOperations, setPendingOperations] = useState<
    LegacyPendingOperation[]
  >([]);
  const [threadSubscriptions, setThreadSubscriptions] = useState<
    Map<string, boolean>
  >(new Map());

  // === NEW: Offline queue state ===
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [offlinePendingOps, setOfflinePendingOps] = useState<
    OfflineOperation[]
  >([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Track stale threads that need refresh on focus
  const staleThreads = useRef<Set<string>>(new Set());
  const allStale = useRef(false);

  // Connection health check interval
  const healthCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempt = useRef(0);
  const maxReconnectAttempts = 5;

  // Sync engine ref
  const syncEngineRef = useRef<OfflineSyncEngine | null>(null);

  // === Refresh offline queue state from IndexedDB ===
  const refreshOfflineQueueState = useCallback(async () => {
    try {
      const count = await getQueueCount();
      setOfflinePendingCount(count);
      // Also sync the Zustand store (source-of-truth correction)
      offlinePendingActions.setCount(count);
      if (count > 0) {
        const ops = await getAllPending();
        setOfflinePendingOps(ops);
      } else {
        setOfflinePendingOps([]);
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // === Listen for direct queue mutations (e.g. addToQueue called outside SyncContext) ===
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      refreshOfflineQueueState();
    };
    window.addEventListener("offline-queue-changed", handler);
    return () => window.removeEventListener("offline-queue-changed", handler);
  }, [refreshOfflineQueueState]);

  // === Initialize sync engine ===
  useEffect(() => {
    if (typeof window === "undefined") return;

    const engine = createSyncEngine({
      invalidateQueries: (keys: string[][]) => {
        keys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      },
      onOperationSuccess: (op, serverResponse) => {
        // Replace temp IDs in cache if applicable
        if (op.tempId && op.operation === "create") {
          const realId =
            (serverResponse as Record<string, unknown>)?.id ||
            (
              (serverResponse as Record<string, unknown>)?.item as Record<
                string,
                unknown
              >
            )?.id ||
            (
              (serverResponse as Record<string, unknown>)?.subtask as Record<
                string,
                unknown
              >
            )?.id;

          if (realId && typeof realId === "string") {
            // Replace tempId in relevant caches
            const keys = FEATURE_QUERY_KEYS[op.feature];
            if (keys) {
              keys.forEach((key) => {
                queryClient.setQueriesData(
                  { queryKey: key },
                  (old: unknown) => {
                    if (!Array.isArray(old)) return old;
                    return old.map((item: Record<string, unknown>) =>
                      item.id === op.tempId
                        ? { ...item, id: realId, _isPending: false }
                        : item,
                    );
                  },
                );
              });
            }
          }
        }
      },
      onOperationFailure: (op, error, permanent) => {
        if (permanent) {
          toast.error(`Sync failed: ${op.metadata?.label || op.operation}`, {
            description: error,
            duration: 4000,
          });
        }
      },
      onQueueChange: () => {
        refreshOfflineQueueState();
      },
      onSyncStart: () => {
        setIsProcessingQueue(true);
      },
      onSyncEnd: (result) => {
        setIsProcessingQueue(false);
        setLastSyncResult(result);
        refreshOfflineQueueState();

        if (result.succeeded > 0 && result.remaining === 0) {
          toast.success("All changes synced", { duration: 2000 });
        }
      },
    });

    syncEngineRef.current = engine;

    // Load initial queue state
    refreshOfflineQueueState();

    // Process queue if actually online (use real check, not navigator.onLine)
    if (isReallyOnline()) {
      engine.processQueue();
    }
  }, [queryClient, refreshOfflineQueueState]);

  // Load legacy pending operations from storage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(PENDING_OPS_KEY);
      if (stored) {
        const ops = JSON.parse(stored) as LegacyPendingOperation[];
        // Filter out stale operations (older than 1 hour)
        const fresh = ops.filter(
          (op) => Date.now() - op.createdAt < 60 * 60 * 1000,
        );
        setPendingOperations(fresh);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save legacy pending operations to storage when changed
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(PENDING_OPS_KEY, JSON.stringify(pendingOperations));
    } catch {
      // Ignore storage errors
    }
  }, [pendingOperations]);

  // ── Active connectivity detection via connectivityManager ──
  // Instead of trusting navigator.onLine / window online/offline events,
  // we use a real HEAD-request probe that detects silent WiFi drops.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Start the background probing loop
    startProbing();

    // Listen for verified connectivity changes from the probe
    const handleConnectivityChanged = (e: Event) => {
      const online = (e as CustomEvent).detail?.online as boolean;
      setIsOnline(online);

      if (online) {
        setStatus("reconnecting");
        // Small delay then sync
        setTimeout(() => {
          if (!isReallyOnline()) return;
          processLegacyPendingOperations();
          syncEngineRef.current?.processQueue();
          refreshAll();
        }, 500);
      } else {
        setStatus("offline");
      }
    };

    // Initial state from connectivity manager
    setIsOnline(isReallyOnline());
    if (!isReallyOnline()) {
      setStatus("offline");
    }

    window.addEventListener("connectivity-changed", handleConnectivityChanged);

    return () => {
      stopProbing();
      window.removeEventListener(
        "connectivity-changed",
        handleConnectivityChanged,
      );
    };
  }, []);

  // Visibility change handler - refresh when returning to tab
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (!document.hidden && isOnline) {
        // Probe connectivity on return to tab (catches WiFi changes while backgrounded)
        probeNow().then((actuallyOnline) => {
          if (!actuallyOnline) return;
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
              threadSubscriptions.values(),
            ).some((v) => !v);
            if (hasAnySubscriptionDown) {
              refreshAll();
            }
          }

          // Process both legacy and new queues
          processLegacyPendingOperations();
          syncEngineRef.current?.processQueue();
        });
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
  // This supplements the connectivity manager with Supabase-specific checks.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkConnection = async () => {
      // If the connectivity manager already says we're offline, skip channel checks
      if (!isReallyOnline()) {
        if (status !== "offline") setStatus("offline");
        return;
      }

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
        (ch) => (ch as unknown as { state: string }).state === "joined",
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
      options?: RetryOptions,
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
              opts.maxDelay,
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
    [],
  );

  // Process legacy pending operations (hub shopping list)
  const processLegacyPendingOperations = useCallback(async () => {
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

  // Add legacy pending operation
  const addPendingOperation = useCallback(
    (
      op: Omit<LegacyPendingOperation, "id" | "retryCount" | "createdAt">,
    ): string => {
      const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const newOp: LegacyPendingOperation = {
        ...op,
        id,
        retryCount: 0,
        createdAt: Date.now(),
      };

      setPendingOperations((prev) => [...prev, newOp]);
      return id;
    },
    [],
  );

  // Remove legacy pending operation
  const removePendingOperation = useCallback((id: string) => {
    setPendingOperations((prev) => prev.filter((op) => op.id !== id));
  }, []);

  // === NEW: Queue an offline operation (IndexedDB) ===
  const queueOperation = useCallback(
    async (op: QueueableOperation): Promise<string> => {
      const id = await addToQueue(op);
      await refreshOfflineQueueState();
      return id;
    },
    [refreshOfflineQueueState],
  );

  // === NEW: Clear entire offline queue ===
  const handleClearOfflineQueue = useCallback(async () => {
    await clearOfflineQueue();
    await refreshOfflineQueueState();
    toast.success("Pending changes cleared");
  }, [refreshOfflineQueueState]);

  // === NEW: Remove a single offline operation ===
  const handleRemoveOfflineOperation = useCallback(
    async (id: string) => {
      await removeFromQueue(id);
      await refreshOfflineQueueState();
    },
    [refreshOfflineQueueState],
  );

  // === NEW: Update a queued offline operation ===
  const handleUpdateOfflineOperation = useCallback(
    async (
      id: string,
      updates: {
        body?: Record<string, unknown>;
        metadata?: { label: string; icon?: string };
      },
    ): Promise<boolean> => {
      const ok = await updateQueuedOperation(id, updates);
      await refreshOfflineQueueState();
      return ok;
    },
    [refreshOfflineQueueState],
  );

  // === NEW: Retry offline queue manually ===
  const retryOfflineQueue = useCallback(async () => {
    if (!isReallyOnline()) {
      toast.error("Still offline. Please connect to sync.");
      return;
    }
    await syncEngineRef.current?.processQueue();
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
    [status],
  );

  // Mark thread as stale (will refresh on next focus)
  const markStale = useCallback((threadId?: string) => {
    if (threadId) {
      staleThreads.current.add(threadId);
    } else {
      allStale.current = true;
    }
  }, []);

  // ── Auto-reconcile balances on mount ──
  // Fires once when the app loads (online only), compares stored balances
  // against a first-principles formula and silently corrects any drift.
  const reconciliationDone = useRef(false);
  useEffect(() => {
    if (reconciliationDone.current) return;
    if (typeof window === "undefined") return;
    if (!isReallyOnline()) return;

    reconciliationDone.current = true;
    // Delay to avoid contending with initial data fetches
    const timer = setTimeout(() => {
      fetch("/api/accounts/reconcile", { method: "POST" })
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          if (data.corrections > 0) {
            // Balance was corrected — refetch so UI picks up the fix
            queryClient.invalidateQueries({ queryKey: ["account-balance"] });
          }
        })
        .catch(() => {
          /* best-effort */
        });
    }, 3000);

    return () => clearTimeout(timer);
  }, [queryClient]);

  // Refresh all data — only when truly online
  const refreshAll = useCallback(async () => {
    // Guard: never invalidate queries when offline — it triggers refetches that fail
    if (!isReallyOnline()) {
      setStatus("offline");
      return;
    }

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
        queryClient.invalidateQueries({ queryKey: ["account-balance"] }),
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
    [queryClient],
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
        // New offline queue
        offlinePendingCount,
        offlinePendingOps,
        queueOperation,
        isProcessingQueue,
        lastSyncResult,
        clearOfflineQueue: handleClearOfflineQueue,
        removeOfflineOperation: handleRemoveOfflineOperation,
        updateOfflineOperation: handleUpdateOfflineOperation,
        retryOfflineQueue,
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
