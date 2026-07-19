"use client";

// Shared bottom-sheet shell for the Outfits module, modeled on the house
// portal-sheet pattern (ReceiptSheet.tsx): opaque tc.bgPage panel (Hard Rule 15),
// backdrop tap to close, slide-up/down keyframes already defined in globals.css.

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  /** Taller sheets (builder steps) get a scrollable body. */
  maxHeightClass?: string;
}

export default function OutfitSheet({
  open,
  onClose,
  title,
  icon,
  children,
  maxHeightClass = "max-h-[85dvh]",
}: Props) {
  const tc = useThemeClasses();
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) setIsClosing(false);
  }, [open]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 220);
  };

  if (!open && !isClosing) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center"
      onClick={handleClose}
      style={{
        animation: isClosing
          ? "modalBackdropFadeOut 0.22s ease-in forwards"
          : "modalBackdropFadeIn 0.18s ease-out forwards",
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className={cn(
          "relative w-full max-w-md rounded-t-3xl shadow-2xl neo-glow flex flex-col",
          maxHeightClass,
          tc.bgPage,
        )}
        style={{
          animation: isClosing
            ? "modalSlideDown 0.22s cubic-bezier(0.4, 0, 1, 1) forwards"
            : "modalSlideUp 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className={cn("text-base font-semibold", tc.text)}>{title}</h3>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className={cn("p-2 rounded-lg transition-colors", tc.hoverBgSubtle)}
          >
            <X className={cn("w-5 h-5", tc.headerText)} />
          </button>
        </div>

        <div className="px-4 pb-6 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
