"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export const inputCls =
  "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/30";
export const labelCls = "block text-xs text-white/60 mb-1";

export function chipCls(active: boolean) {
  return cn(
    "px-3 py-1.5 rounded-full text-xs border",
    active
      ? "bg-white/10 text-white border-white/30"
      : "text-white/60 border-white/10 hover:border-white/30",
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const tc = useThemeClasses();
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* Floating panel: opaque page background (Hard Rule 15 — never glass). */}
      <div
        className={cn(
          "relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 p-5",
          tc.bgPage,
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 -m-2 text-white/60 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
