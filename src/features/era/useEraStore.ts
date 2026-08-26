// src/features/era/useEraStore.ts
// ERA shell state — Zustand store.

import { create } from "zustand";
import { DEFAULT_FACE_KEY } from "./faceRegistry";
import type { ERAModuleKey } from "@/components/shared/ERAMark";
import type { EraActiveProposal, EraPendingTurn, FaceKey, Intent } from "./types";

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
  /** ERA starts dormant; first click on the shell wakes it and begins all animations. */
  isAwake: boolean;
  /** When true, assistant replies are spoken aloud via Azure TTS. Default false. */
  voiceReplyEnabled: boolean;
  /** Latest assistant reply text — set the instant ERA begins speaking it, ahead
   *  of the era_messages round trip (see conversationEngine's onWillSpeak). */
  eraReply: string;
  /**
   * The module key driving ERA DOT color/cue in hub view.
   * Starts as "chat" (neutral) and updates to the mentioned face's module when
   * a face-specific intent is parsed — so the DOT shifts hue live as the user
   * addresses a module.
   */
  hubModuleKey: ERAModuleKey;
  /** A question ERA is waiting on an answer to (Slice 3) — see EraPendingTurn. */
  pendingTurn: EraPendingTurn | null;
  /** An AI-proposed action awaiting Confirm/Dismiss (Slice 4) — see EraActiveProposal. */
  activeProposal: EraActiveProposal | null;
  /** True while an "Ask AI" call is in flight. */
  askingAI: boolean;
}

interface EraActions {
  setActiveFace: (key: FaceKey) => void;
  setActiveView: (view: EraView) => void;
  /** Convenience: sets both face + view in one update (for nav clicks). */
  openDashboard: (key: FaceKey) => void;
  setLastIntent: (intent: Intent | null) => void;
  setPendingTranscript: (text: string) => void;
  reset: () => void;
  wake: () => void;
  setVoiceReplyEnabled: (v: boolean) => void;
  setHubModuleKey: (key: ERAModuleKey) => void;
  setEraReply: (text: string) => void;
  setPendingTurn: (turn: EraPendingTurn | null) => void;
  setActiveProposal: (proposal: EraActiveProposal | null) => void;
  setAskingAI: (v: boolean) => void;
}

const INITIAL: EraState = {
  activeFaceKey: DEFAULT_FACE_KEY,
  activeView: "hub",
  lastIntent: null,
  pendingTranscript: "",
  isAwake: false,
  voiceReplyEnabled: false,
  hubModuleKey: "chat",
  eraReply: "",
  pendingTurn: null,
  activeProposal: null,
  askingAI: false,
};

export const useEraStore = create<EraState & EraActions>((set) => ({
  ...INITIAL,
  setActiveFace: (key) => set({ activeFaceKey: key }),
  setActiveView: (view) => set({ activeView: view }),
  openDashboard: (key) => set({ activeFaceKey: key, activeView: "dashboard" }),
  setLastIntent: (intent) => set({ lastIntent: intent }),
  setPendingTranscript: (text) => set({ pendingTranscript: text }),
  reset: () => set(INITIAL),
  wake: () => set({ isAwake: true }),
  setVoiceReplyEnabled: (v) => set({ voiceReplyEnabled: v }),
  setHubModuleKey: (key) => set({ hubModuleKey: key }),
  setEraReply: (text) => set({ eraReply: text }),
  setPendingTurn: (turn) => set({ pendingTurn: turn }),
  setActiveProposal: (proposal) => set({ activeProposal: proposal }),
  setAskingAI: (v) => set({ askingAI: v }),
}));
