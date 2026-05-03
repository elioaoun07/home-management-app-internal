// src/features/era/useEraStore.ts
// ERA shell state — Zustand store. Mirrors the offlinePendingActions pattern
// (src/lib/stores/offlinePendingStore.ts) so non-React modules can mutate
// state via getState() if needed in later phases.

import { create } from "zustand";
import { DEFAULT_FACE_KEY } from "./faceRegistry";
import type { FaceKey, Intent } from "./types";

/** A turn in the ERA conversation log — user input + ERA's parsed reply. */
export interface EraTurn {
  id: string;
  at: number;
  intent: Intent;
  /** Canned natural-language reply shown to the user (Phase 0 templated). */
  reply: string;
}

interface EraState {
  /** Currently active face. Drives the shapeshift slot and chip highlight. */
  activeFaceKey: FaceKey;
  /** Last intent produced by the IntentRouter — useful for debug / future toasts. */
  lastIntent: Intent | null;
  /** Persisted command-bar text across in-app navigation (cleared on submit). */
  pendingTranscript: string;
  /** Rolling history of recent turns (most recent first, capped at 12). */
  turns: EraTurn[];
}

interface EraActions {
  setActiveFace: (key: FaceKey) => void;
  setLastIntent: (intent: Intent | null) => void;
  setPendingTranscript: (text: string) => void;
  pushTurn: (turn: EraTurn) => void;
  clearTurns: () => void;
  reset: () => void;
}

const MAX_TURNS = 12;

const INITIAL: EraState = {
  activeFaceKey: DEFAULT_FACE_KEY,
  lastIntent: null,
  pendingTranscript: "",
  turns: [],
};

export const useEraStore = create<EraState & EraActions>((set) => ({
  ...INITIAL,
  setActiveFace: (key) => set({ activeFaceKey: key }),
  setLastIntent: (intent) => set({ lastIntent: intent }),
  setPendingTranscript: (text) => set({ pendingTranscript: text }),
  pushTurn: (turn) =>
    set((s) => ({ turns: [turn, ...s.turns].slice(0, MAX_TURNS) })),
  clearTurns: () => set({ turns: [] }),
  reset: () => set(INITIAL),
}));

/** Non-React accessor for use from plain TS modules. */
export const eraActions = {
  setActiveFace: (key: FaceKey) => useEraStore.getState().setActiveFace(key),
  setLastIntent: (intent: Intent | null) =>
    useEraStore.getState().setLastIntent(intent),
  setPendingTranscript: (text: string) =>
    useEraStore.getState().setPendingTranscript(text),
  pushTurn: (turn: EraTurn) => useEraStore.getState().pushTurn(turn),
  getActiveFace: () => useEraStore.getState().activeFaceKey,
};
