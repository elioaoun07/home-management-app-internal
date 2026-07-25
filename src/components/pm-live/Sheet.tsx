// src/components/pm-live/Sheet.tsx
// Bottom sheet on a phone, centred dialog on a desktop. Uses `pm-panel`
// (opaque) rather than a glass card — Hard Rule 15: anything floating above
// page content must be solid or the content behind bleeds through.
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
    <div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center">
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
        className="pm-panel relative w-full lg:max-w-lg rounded-t-2xl lg:rounded-2xl max-h-[92dvh] lg:max-h-[80dvh] flex flex-col"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      >
        <div
          className="shrink-0 flex items-start gap-3 px-4 py-3.5 border-b"
          style={{ borderColor: "var(--pm-border)" }}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-[14.5px] font-semibold" style={{ color: "var(--pm-fg-1)" }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--pm-fg-3)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 -m-1" aria-label="Close">
            <X size={18} style={{ color: "var(--pm-fg-3)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3.5">{children}</div>

        {footer && (
          <div className="shrink-0 px-4 py-3 border-t" style={{ borderColor: "var(--pm-border)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
