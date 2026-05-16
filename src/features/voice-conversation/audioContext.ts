"use client";

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return ctx;
}

export function unlockAudioContext(): void {
  const context = getAudioContext();
  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }
}

// Auto-unlock on first user gesture — covers any click before voice wake fires.
if (typeof document !== "undefined") {
  const tryUnlock = () => unlockAudioContext();
  document.addEventListener("pointerdown", tryUnlock, { once: true });
  document.addEventListener("keydown", tryUnlock, { once: true });
}
