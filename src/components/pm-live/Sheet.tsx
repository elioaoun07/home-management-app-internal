// src/components/pm-live/Sheet.tsx
// Phone-only bottom sheet. Uses `pm-panel` (opaque) rather than a glass card —
// Hard Rule 15: anything floating above page content must be solid or the
// content behind bleeds through.
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
        style={{ backdropFilter: "blur(2px)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pm-panel relative w-full rounded-t-3xl max-h-[88dvh] flex flex-col"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      >
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: "var(--pm-border-strong)" }} />
        </div>

        <div
          className="shrink-0 flex items-start gap-3 px-4 pb-3 border-b"
          style={{ borderColor: "var(--pm-border)" }}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--pm-fg-1)" }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-[13px] mt-0.5 truncate" style={{ color: "var(--pm-fg-3)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 -m-1" aria-label="Close">
            <X size={19} style={{ color: "var(--pm-fg-3)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <div className="shrink-0 px-4 py-3.5 border-t" style={{ borderColor: "var(--pm-border)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
