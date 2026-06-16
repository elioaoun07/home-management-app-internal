// src/lib/stores/chatFullscreenStore.ts
// Lets ConditionalHeader (root layout, outside HubPage's tree) know when a
// chat thread is open so it can hide the global app header for full-screen mode.

import { create } from "zustand";

interface ChatFullscreenState {
  isThreadOpen: boolean;
  setThreadOpen: (open: boolean) => void;
}

export const useChatFullscreenStore = create<ChatFullscreenState>((set) => ({
  isThreadOpen: false,
  setThreadOpen: (open) => set({ isThreadOpen: open }),
}));
