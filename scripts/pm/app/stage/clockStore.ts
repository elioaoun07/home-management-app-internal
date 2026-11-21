import { useSyncExternalStore } from "react";

/** Only subscribed clock/age/counter leaves render on the factual second tick. */
let now = Date.now();
const listeners = new Set<() => void>();
export const boardClock = {
  get: () => now,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  tick(value = Date.now()) {
    now = value;
    for (const listener of listeners) listener();
  },
};
export function useBoardNow() {
  return useSyncExternalStore(
    boardClock.subscribe,
    boardClock.get,
    boardClock.get,
  );
}

let replay: { runId: string; at: number } | null = null;
const replayListeners = new Set<() => void>();
export const boardReplayClock = {
  get: (runId: string) => (replay?.runId === runId ? replay.at : null),
  subscribe(listener: () => void) {
    replayListeners.add(listener);
    return () => {
      replayListeners.delete(listener);
    };
  },
  tick(runId: string, at: number | null) {
    if ((replay?.runId ?? runId) === runId && (replay?.at ?? null) === at)
      return;
    replay = at === null ? null : { runId, at };
    for (const listener of replayListeners) listener();
  },
};
/** The playhead clock advances without invalidating the board, rail or feed. */
export function useBoardReplayTime(runId: string, fallback: number | null) {
  const at = useSyncExternalStore(
    boardReplayClock.subscribe,
    () => boardReplayClock.get(runId),
    () => null,
  );
  return fallback === null ? null : (at ?? fallback);
}
