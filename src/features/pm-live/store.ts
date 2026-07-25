// src/features/pm-live/store.ts
// Snapshot store for /pm/live. Every row the bridge publishes lands here, and
// components subscribe through narrow selectors.
//
// Why a store and not useState in the page: the bridge heartbeats every 10s.
// With the old single-hook shape, each beat re-rendered the page and every tab
// — including ~480 task rows — to update a "last seen" chip. Selector
// subscriptions mean a heartbeat now re-renders only the status chip.

import { create } from "zustand";
import type {
  BridgeHeartbeat,
  FleetSnapshot,
  HistorySnapshot,
  RollupsSnapshot,
  SessionSnapshot,
  TasksSnapshot,
} from "./types";

/** 3 missed 10s heartbeats = the laptop bridge is gone. */
export const BRIDGE_STALE_MS = 30_000;

export interface PmLiveSnapshots {
  tasks: TasksSnapshot | null;
  rollups: RollupsSnapshot | null;
  history: HistorySnapshot | null;
  fleet: FleetSnapshot | null;
  sessions: Record<string, SessionSnapshot>;
  bridge: BridgeHeartbeat | null;
}

interface PmLiveState extends PmLiveSnapshots {
  loading: boolean;
  userId: string | null;
  /** Bumped on a timer so bridge liveness recomputes without touching snapshots. */
  nowTick: number;
}

interface PmLiveActions {
  applyRow: (id: string, payload: unknown) => void;
  applyRows: (rows: { id: string; payload: unknown }[]) => void;
  dropRow: (id: string) => void;
  hydrate: (snapshots: Partial<PmLiveSnapshots>) => void;
  setLoading: (loading: boolean) => void;
  setUserId: (userId: string | null) => void;
  tick: () => void;
}

export const usePmLiveStore = create<PmLiveState & PmLiveActions>((set) => ({
  tasks: null,
  rollups: null,
  history: null,
  fleet: null,
  sessions: {},
  bridge: null,
  loading: true,
  userId: null,
  nowTick: Date.now(),

  // The publisher's row id is the stream key; anything unrecognized is a row
  // from a NEWER bridge than this bundle knows about and is ignored, not fatal.
  applyRow: (id, payload) =>
    set((state) => {
      if (id === "tasks") return { tasks: payload as TasksSnapshot };
      if (id === "rollups") return { rollups: payload as RollupsSnapshot };
      if (id === "history") return { history: payload as HistorySnapshot };
      if (id === "fleet") return { fleet: payload as FleetSnapshot };
      if (id === "bridge") return { bridge: payload as BridgeHeartbeat };
      if (id.startsWith("session:")) {
        const sessionId = id.slice("session:".length);
        return { sessions: { ...state.sessions, [sessionId]: payload as SessionSnapshot } };
      }
      return state;
    }),

  applyRows: (rows) =>
    set((state) => {
      const next: Partial<PmLiveState> = {};
      let sessions = state.sessions;
      for (const row of rows) {
        if (row.id === "tasks") next.tasks = row.payload as TasksSnapshot;
        else if (row.id === "rollups") next.rollups = row.payload as RollupsSnapshot;
        else if (row.id === "history") next.history = row.payload as HistorySnapshot;
        else if (row.id === "fleet") next.fleet = row.payload as FleetSnapshot;
        else if (row.id === "bridge") next.bridge = row.payload as BridgeHeartbeat;
        else if (row.id.startsWith("session:")) {
          sessions = { ...sessions, [row.id.slice("session:".length)]: row.payload as SessionSnapshot };
        }
      }
      if (sessions !== state.sessions) next.sessions = sessions;
      return next;
    }),

  /** The bridge prunes finished sessions; mirror the DELETE so they leave the UI too. */
  dropRow: (id) =>
    set((state) => {
      if (!id.startsWith("session:")) return state;
      const sessionId = id.slice("session:".length);
      if (!(sessionId in state.sessions)) return state;
      const sessions = { ...state.sessions };
      delete sessions[sessionId];
      return { sessions };
    }),

  hydrate: (snapshots) => set((state) => ({ ...state, ...snapshots })),
  setLoading: (loading) => set({ loading }),
  setUserId: (userId) => set({ userId }),
  tick: () => set({ nowTick: Date.now() }),
}));

// ---- selectors -------------------------------------------------------------
// Each is a stable function reference so `usePmLiveStore(selector)` subscribes
// to exactly one slice. Derived objects/arrays are built in selectors.ts with
// useMemo instead, since a selector returning a fresh object every call would
// re-render on every store change.

export const useTasks = () => usePmLiveStore((s) => s.tasks);
export const useRollups = () => usePmLiveStore((s) => s.rollups);
export const useHistory = () => usePmLiveStore((s) => s.history);
export const useFleet = () => usePmLiveStore((s) => s.fleet);
export const useSessions = () => usePmLiveStore((s) => s.sessions);
export const useBridge = () => usePmLiveStore((s) => s.bridge);
export const usePmLoading = () => usePmLiveStore((s) => s.loading);

export const useBridgeLive = () =>
  usePmLiveStore((s) => !!s.bridge && s.nowTick - new Date(s.bridge.seenAt).getTime() < BRIDGE_STALE_MS);

export const useUndoable = () => usePmLiveStore((s) => s.bridge?.undoable ?? null);

/** Non-React accessor for the cache writer and other plain modules. */
export const pmLiveSnapshots = (): PmLiveSnapshots => {
  const { tasks, rollups, history, fleet, sessions, bridge } = usePmLiveStore.getState();
  return { tasks, rollups, history, fleet, sessions, bridge };
};
