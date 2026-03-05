// src/lib/offlineSyncEngine.ts
// Core sync processor that replays the IndexedDB queue when back online

import type { OfflineOperation } from "./offlineQueue";
import {
  getAllPending,
  removeFromQueue,
  updateRetryCount,
  removeStaleOperations,
  cancelCreateDeletePair,
  getQueueCount,
} from "./offlineQueue";

export interface SyncResult {
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  errors: Array<{ operationId: string; error: string }>;
}

// Query key map: feature → relevant React Query keys to invalidate
export const FEATURE_QUERY_KEYS: Record<string, string[][]> = {
  transaction: [
    ["transactions"],
    ["transactions-today"],
    ["account-balance"],
    ["accounts"],
    ["dashboard-stats"],
  ],
  item: [["items"]],
  "hub-message": [
    ["hub", "messages"],
    ["hub", "threads"],
  ],
  subtask: [["items"]],
  recurring: [["recurring-payments"], ["transactions"], ["account-balance"]],
};

type InvalidateQueriesFn = (queryKeys: string[][]) => void;
type OnOperationSuccessFn = (
  op: OfflineOperation,
  serverResponse: unknown,
) => void;
type OnOperationFailureFn = (
  op: OfflineOperation,
  error: string,
  permanent: boolean,
) => void;

interface SyncEngineOptions {
  invalidateQueries: InvalidateQueriesFn;
  onOperationSuccess?: OnOperationSuccessFn;
  onOperationFailure?: OnOperationFailureFn;
  onQueueChange?: () => void;
  onSyncStart?: () => void;
  onSyncEnd?: (result: SyncResult) => void;
}

class OfflineSyncEngine {
  private isSyncing = false;
  private listeners = new Set<() => void>();
  private options: SyncEngineOptions;

  constructor(options: SyncEngineOptions) {
    this.options = options;
  }

  /**
   * Subscribe to queue changes (for UI indicator)
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn());
    this.options.onQueueChange?.();
  }

  /**
   * Get current syncing state
   */
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Get current pending count
   */
  async getPendingCount(): Promise<number> {
    return getQueueCount();
  }

  /**
   * Get all pending operations (for UI display)
   */
  async getPendingOperations(): Promise<OfflineOperation[]> {
    return getAllPending();
  }

  /**
   * Process all pending operations sequentially (FIFO)
   */
  async processQueue(): Promise<SyncResult> {
    // Prevent concurrent processing
    if (this.isSyncing) {
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        remaining: await this.getPendingCount(),
        errors: [],
      };
    }

    this.isSyncing = true;
    this.options.onSyncStart?.();
    this.notifyListeners();

    const result: SyncResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 0,
      errors: [],
    };

    try {
      // Clean up stale operations first (>24h old)
      await removeStaleOperations();

      // Cancel create+delete pairs (user created then deleted same entity offline)
      const allOps = await getAllPending();
      const createOps = allOps.filter(
        (op) => op.operation === "create" && op.tempId,
      );
      for (const createOp of createOps) {
        // Look for a delete targeting this tempId's endpoint
        const matchingDelete = allOps.find(
          (op) =>
            op.operation === "delete" &&
            op.feature === createOp.feature &&
            op.endpoint.includes(createOp.tempId!),
        );
        if (matchingDelete) {
          await cancelCreateDeletePair(
            createOp.feature as OfflineOperation["feature"],
            createOp.tempId!,
          );
        }
      }

      // Refresh auth token before processing (JWT may have expired while offline)
      try {
        const { supabaseBrowser } = await import("@/lib/supabase/client");
        const supabase = supabaseBrowser();
        await supabase.auth.getSession();
      } catch {
        // Auth refresh failed — continue anyway, individual requests may still work
      }

      const operations = await getAllPending();
      if (operations.length === 0) {
        result.remaining = 0;
        return result;
      }

      for (const op of operations) {
        result.processed++;

        // Check max retries
        if (op.retryCount >= op.maxRetries) {
          // Permanent failure — remove from queue
          await removeFromQueue(op.id);
          result.failed++;
          result.errors.push({
            operationId: op.id,
            error: `Max retries (${op.maxRetries}) exceeded`,
          });
          this.options.onOperationFailure?.(
            op,
            `Max retries exceeded for: ${op.metadata?.label || op.operation}`,
            true,
          );
          this.notifyListeners();
          continue;
        }

        try {
          const response = await fetch(op.endpoint, {
            method: op.method,
            headers: { "Content-Type": "application/json" },
            ...(op.method !== "DELETE" || Object.keys(op.body).length > 0
              ? { body: JSON.stringify(op.body) }
              : {}),
          });

          if (response.ok) {
            // Success
            let serverResponse: unknown = null;
            try {
              serverResponse = await response.json();
            } catch {
              // Some endpoints may not return JSON
            }

            await removeFromQueue(op.id);
            result.succeeded++;

            // Notify for post-sync reconciliation
            this.options.onOperationSuccess?.(op, serverResponse);

            // Invalidate relevant React Query caches
            const keys = FEATURE_QUERY_KEYS[op.feature];
            if (keys) {
              this.options.invalidateQueries(keys);
            }

            this.notifyListeners();
          } else if (response.status >= 400 && response.status < 500) {
            // Client error — won't succeed on retry, remove
            let errorMessage = `HTTP ${response.status}`;
            try {
              const errorBody = await response.json();
              errorMessage = errorBody.error || errorBody.message || errorMessage;
            } catch {
              // ignore
            }

            await removeFromQueue(op.id);
            result.failed++;
            result.errors.push({
              operationId: op.id,
              error: errorMessage,
            });
            this.options.onOperationFailure?.(op, errorMessage, true);
            this.notifyListeners();
          } else {
            // Server error (5xx) — increment retry, keep in queue
            await updateRetryCount(op.id, op.retryCount + 1);
            result.failed++;
            result.errors.push({
              operationId: op.id,
              error: `Server error: ${response.status}`,
            });
            this.options.onOperationFailure?.(
              op,
              `Server error (${response.status}), will retry`,
              false,
            );
            this.notifyListeners();
          }
        } catch (err) {
          // Network error — still offline, stop processing
          const errorMessage =
            err instanceof Error ? err.message : "Network error";

          // If it's a genuine network error (not a code error), stop all processing
          if (
            errorMessage.includes("fetch") ||
            errorMessage.includes("network") ||
            errorMessage.includes("Failed to fetch") ||
            errorMessage.includes("NetworkError") ||
            !navigator.onLine
          ) {
            // Network is down — stop processing, keep everything in queue
            break;
          }

          // Other error — increment retry
          await updateRetryCount(op.id, op.retryCount + 1);
          result.failed++;
          result.errors.push({
            operationId: op.id,
            error: errorMessage,
          });
          this.notifyListeners();
        }
      }

      result.remaining = await this.getPendingCount();
    } finally {
      this.isSyncing = false;
      this.options.onSyncEnd?.(result);
      this.notifyListeners();
    }

    return result;
  }
}

// Singleton instance — initialized once in SyncContext
let engineInstance: OfflineSyncEngine | null = null;

export function createSyncEngine(
  options: SyncEngineOptions,
): OfflineSyncEngine {
  engineInstance = new OfflineSyncEngine(options);
  return engineInstance;
}

export function getSyncEngine(): OfflineSyncEngine | null {
  return engineInstance;
}

export { OfflineSyncEngine };
