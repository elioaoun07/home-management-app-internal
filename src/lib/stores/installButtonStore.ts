// src/lib/stores/installButtonStore.ts
// Per-device toggle: show the Install button on installable pages. Off by default.

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface InstallButtonState {
  showInstall: boolean;
  setShowInstall: (show: boolean) => void;
}

export const useInstallButtonStore = create<InstallButtonState>()(
  persist(
    (set) => ({
      showInstall: false,
      setShowInstall: (show) => set({ showInstall: show }),
    }),
    { name: "show-install-button" },
  ),
);
