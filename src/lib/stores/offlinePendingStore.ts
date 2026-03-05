// src/lib/stores/offlinePendingStore.ts
// Zustand store for offline pending count — synchronous updates for instant UI reactivity.
// The IDB queue remains the source of truth; this store provides the reactive "view".

import { create } from "zustand";

interface OfflinePendingState {
  /** Current count of pending offline operations */
  count: number;
  /** Whether we have loaded the initial count from IDB */
  hydrated: boolean;
}

interface OfflinePendingActions {
  /** Increment count by 1 (called after addToQueue) */
  increment: () => void;
  /** Decrement count by 1 (called after removeFromQueue) */
  decrement: () => void;
  /** Set the exact count (called from IDB sync / refreshOfflineQueueState) */
  setCount: (count: number) => void;
  /** Reset to 0 (called after clearQueue) */
  reset: () => void;
}

export const useOfflinePendingStore = create<
  OfflinePendingState & OfflinePendingActions
>((set) => ({
  count: 0,
  hydrated: false,
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: Math.max(0, s.count - 1) })),
  setCount: (count) => set({ count, hydrated: true }),
  reset: () => set({ count: 0 }),
}));

/**
 * Non-React accessor — call from plain TS modules (offlineQueue.ts, etc.)
 * These bypass React entirely and update the store synchronously.
 */
export const offlinePendingActions = {
  increment: () => useOfflinePendingStore.getState().increment(),
  decrement: () => useOfflinePendingStore.getState().decrement(),
  setCount: (n: number) => useOfflinePendingStore.getState().setCount(n),
  reset: () => useOfflinePendingStore.getState().reset(),
  getCount: () => useOfflinePendingStore.getState().count,
};
