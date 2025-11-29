"use client";

import { ReactNode } from "react";

// Futuristic toast icons with glow effects
export const ToastIcons = {
  // Green plus - for creating/adding
  create: (
    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 ring-2 ring-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]">
      <svg
        className="w-3.5 h-3.5 text-emerald-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </div>
  ) as ReactNode,

  // Cyan pencil - for editing/updating
  update: (
    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 ring-2 ring-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.4)]">
      <svg
        className="w-3.5 h-3.5 text-cyan-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z" />
      </svg>
    </div>
  ) as ReactNode,

  // Orange/Amber checkmark - for successful deletion (not red to avoid confusion with error)
  delete: (
    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 ring-2 ring-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.4)]">
      <svg
        className="w-3.5 h-3.5 text-amber-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </div>
  ) as ReactNode,

  // Red X with warning triangle background - for API errors (distinct from success toasts)
  error: (
    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-red-600/30 ring-2 ring-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.5)]">
      <svg
        className="w-4 h-4 text-red-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    </div>
  ) as ReactNode,

  // Green checkmark - generic success
  success: (
    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 ring-2 ring-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]">
      <svg
        className="w-3.5 h-3.5 text-emerald-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </div>
  ) as ReactNode,
};
