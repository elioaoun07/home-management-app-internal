// src/hooks/useOfflineAware.ts
// Shared utility for making mutation hooks offline-aware
// Checks navigator.onLine and queues operations via SyncContext when offline

"use client";

import { useSync } from "@/contexts/SyncContext";
import type { QueueableOperation } from "@/lib/offlineQueue";
import { useCallback } from "react";

/**
 * Returns a helper that checks if we're offline and can queue an operation.
 * Use in mutation hooks to route to IndexedDB queue when offline.
 *
 * Usage:
 *   const { tryOfflineQueue } = useOfflineAware();
 *
 *   // In mutationFn:
 *   const offlineResult = await tryOfflineQueue({
 *     feature: "transaction",
 *     operation: "create",
 *     endpoint: "/api/transactions",
 *     method: "POST",
 *     body: data,
 *     tempId: `temp-${Date.now()}`,
 *     metadata: { label: "Add transaction $50" },
 *   });
 *
 *   if (offlineResult) return offlineResult.fakeResponse;
 *   // else: proceed with normal online fetch
 */
export function useOfflineAware() {
  const { queueOperation } = useSync();

  const tryOfflineQueue = useCallback(
    async <T extends Record<string, unknown>>(
      op: QueueableOperation,
      fakeResponse: T,
    ): Promise<{ queued: true; fakeResponse: T; queueId: string } | null> => {
      if (navigator.onLine) return null;

      try {
        const queueId = await queueOperation(op);
        return { queued: true, fakeResponse, queueId };
      } catch (err) {
        // If queuing fails (e.g., too many pending), throw so mutation's onError fires
        throw new Error(
          err instanceof Error
            ? err.message
            : "Failed to queue offline operation",
        );
      }
    },
    [queueOperation],
  );

  return { tryOfflineQueue, isOnline: navigator.onLine };
}
