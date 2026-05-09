// src/features/era/useEraStore.ts
// ERA shell state — Zustand store. Mirrors the offlinePendingActions pattern
// (src/lib/stores/offlinePendingStore.ts) so non-React modules can mutate
// state via getState() if needed in later phases.

import { create } from "zustand";
import { DEFAULT_FACE_KEY } from "./faceRegistry";
import type { ERAModuleKey } from "@/components/shared/ERAMark";
import type { FaceKey, Intent } from "./types";

/** A turn in the ERA conversation log — user input + ERA's parsed reply. */
export interface EraTurn {
  id: string;
  at: number;
  intent: Intent;
  /** Canned natural-language reply shown to the user (Phase 0 templated). */
  reply: string;
}

export type EraView = "hub" | "dashboard";

interface EraState {
  /** Currently active face. Drives ERA hue + intent routing + chip highlight. */
  activeFaceKey: FaceKey;
  /** "hub" = chat/ERAMark center; "dashboard" = full face dashboard view. */
  activeView: EraView;
  /** Last intent produced by the IntentRouter — useful for debug / future toasts. */
  lastIntent: Intent | null;
  /** Persisted command-bar text across in-app navigation (cleared on submit). */
  pendingTranscript: string;
  /** Rolling history of recent turns (most recent first, capped at 12). */
  turns: EraTurn[];
  /** ERA starts dormant; first click on the shell wakes it and begins all animations. */
  isAwake: boolean;
  /** When true, assistant replies are spoken aloud via Azure TTS. Default false. */
  voiceReplyEnabled: boolean;
  /**
   * The module key driving ERA DOT color/cue in hub view.
   * Starts as "chat" (neutral) and updates to the mentioned face's module when
   * a face-specific intent is parsed — so the DOT shifts hue live as the user
   * addresses a module.
   */
  hubModuleKey: ERAModuleKey;
}

interface EraActions {
  setActiveFace: (key: FaceKey) => void;
  setActiveView: (view: EraView) => void;
  /** Convenience: sets both face + view in one update (for nav clicks). */
  openDashboard: (key: FaceKey) => void;
  setLastIntent: (intent: Intent | null) => void;
  setPendingTranscript: (text: string) => void;
  pushTurn: (turn: EraTurn) => void;
  clearTurns: () => void;
  reset: () => void;
  wake: () => void;
  setVoiceReplyEnabled: (v: boolean) => void;
  setHubModuleKey: (key: ERAModuleKey) => void;
}

const MAX_TURNS = 12;

const INITIAL: EraState = {
  activeFaceKey: DEFAULT_FACE_KEY,
  activeView: "hub",
  lastIntent: null,
  pendingTranscript: "",
  turns: [],
  isAwake: false,
  voiceReplyEnabled: false,
  hubModuleKey: "chat",
};

export const useEraStore = create<EraState & EraActions>((set) => ({
  ...INITIAL,
  setActiveFace: (key) => set({ activeFaceKey: key }),
  setActiveView: (view) => set({ activeView: view }),
  openDashboard: (key) => set({ activeFaceKey: key, activeView: "dashboard" }),
  setLastIntent: (intent) => set({ lastIntent: intent }),
  setPendingTranscript: (text) => set({ pendingTranscript: text }),
  pushTurn: (turn) =>
    set((s) => ({ turns: [turn, ...s.turns].slice(0, MAX_TURNS) })),
  clearTurns: () => set({ turns: [] }),
  reset: () => set(INITIAL),
  wake: () => set({ isAwake: true }),
  setVoiceReplyEnabled: (v) => set({ voiceReplyEnabled: v }),
  setHubModuleKey: (key) => set({ hubModuleKey: key }),
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
