"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { type ChorePostponeTarget } from "@/features/chores/useChoreActions";
import { ArrowRightLeft, Ban, Check, Clock, Pencil, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { ChorePostponeSheet } from "./ChorePostponeSheet";

interface ChoreActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onComplete: () => void;
  onSkip: () => void;
  onPostpone: (to: ChorePostponeTarget, customDate?: string) => void;
  onTransfer?: () => void;
  onEdit?: () => void;
  hasPartner: boolean;
}

export function ChoreActionsSheet({
  isOpen,
  onClose,
  title,
  onComplete,
  onSkip,
  onPostpone,
  onTransfer,
  onEdit,
  hasPartner,
}: ChoreActionsSheetProps) {
  const tc = useThemeClasses();
  const [isClosing, setIsClosing] = useState(false);
  const [showPostpone, setShowPostpone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false);
      setShowPostpone(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const wrap = (fn: () => void) => () => {
    fn();
    handleClose();
  };

  const handlePostpone = (to: ChorePostponeTarget, customDate?: string) => {
    onPostpone(to, customDate);
    setShowPostpone(false);
    handleClose();
  };

  const actions = [
    {
      label: "Mark done",
      Icon: Check,
      className: "text-emerald-400",
      bg: "bg-emerald-500/20 hover:bg-emerald-500/30",
      onClick: wrap(onComplete),
    },
    {
      label: "Postpone",
      Icon: Clock,
      className: "text-amber-400",
      bg: "bg-amber-500/10 hover:bg-amber-500/20",
      onClick: () => setShowPostpone(true),
    },
    {
      label: "Skip this time",
      Icon: Ban,
      className: "text-white/60",
      bg: "bg-white/5 hover:bg-white/10",
      onClick: wrap(onSkip),
    },
    ...(hasPartner && onTransfer
      ? [
          {
            label: "Give to partner",
            Icon: ArrowRightLeft,
            className: "text-white/60",
            bg: "bg-white/5 hover:bg-white/10",
            onClick: wrap(onTransfer),
          },
        ]
      : []),
    ...(onEdit
      ? [
          {
            label: "Edit chore",
            Icon: Pencil,
            className: "text-white/50",
            bg: "bg-white/5 hover:bg-white/10",
            onClick: wrap(onEdit),
          },
        ]
      : []),
  ];

  if (!mounted || !isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-end">
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity",
            isClosing ? "opacity-0" : "opacity-100",
          )}
          onClick={handleClose}
        />

        {/* Sheet */}
        <div
          className={cn(
            "relative w-full rounded-t-3xl border-t border-white/10 p-5 pb-8",
            tc.pageBg,
            "transition-transform",
            isClosing ? "translate-y-full" : "translate-y-0",
          )}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

          <div className="mb-4 flex items-center justify-between">
            <p className={cn("text-sm font-semibold truncate pr-4", tc.headerText)}>
              {title}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl bg-white/10 p-2 text-white/50 hover:bg-white/15 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {actions.map(({ label, Icon, className, bg, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-white/5 px-4 py-3 text-left transition-colors active:scale-[0.98]",
                  bg,
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", className)} />
                <span className={cn("text-sm font-medium", className)}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Nested postpone sheet */}
      <ChorePostponeSheet
        isOpen={showPostpone}
        onClose={() => setShowPostpone(false)}
        onPostpone={handlePostpone}
      />
    </>,
    document.body,
  );
}
