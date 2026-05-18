"use client";

import { ChoreActionsSheet } from "@/components/chores/ChoreActionsSheet";
import { ChorePostponeSheet } from "@/components/chores/ChorePostponeSheet";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  type ChorePostponeTarget,
  useChoreActions,
} from "@/features/chores/useChoreActions";
import { type FlexibleRoutineItem } from "@/features/items/useFlexibleRoutines";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import {
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  ClipboardList,
  Clock,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const SWIPE_THRESHOLD = 80;
const MAX_OFFSET = 120;
const LONG_PRESS_MS = 500;

interface ChoreCardProps {
  entry: FlexibleRoutineItem;
  currentUserId?: string;
}

export function ChoreCard({ entry, currentUserId }: ChoreCardProps) {
  const { theme } = useTheme();
  const tc = useThemeClasses();
  const choreActions = useChoreActions(entry);

  // Refs hold the authoritative values for use inside event handlers.
  // State is only for triggering re-renders (the visual offset).
  const offsetRef      = useRef(0);
  const isDraggingRef  = useRef(false);
  const startXRef      = useRef(0);
  const currentXRef    = useRef(0);
  const animFrameRef   = useRef<number | undefined>(undefined);
  const longPressRef   = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const [displayOffset, setDisplayOffset] = useState(0);
  const [showActionsSheet, setShowActionsSheet] = useState(false);
  const [showPostponeSheet, setShowPostponeSheet] = useState(false);

  const isOwner = currentUserId
    ? entry.responsible_user_id === currentUserId
    : true;

  const isPink = theme === "pink";
  const borderColor = isOwner
    ? isPink ? "#ec4899" : "#3b82f6"
    : isPink ? "#3b82f6" : "#ec4899";

  const scheduledLabel = entry.flexibleSchedule?.scheduled_for_date
    ? format(parseISO(entry.flexibleSchedule.scheduled_for_date), "EEE, MMM d")
    : null;

  // Helper to update both ref and display state
  const setOffset = useCallback((v: number) => {
    offsetRef.current = v;
    setDisplayOffset(v);
  }, []);

  // ── Long press ──────────────────────────────────────────────────────────────
  const startLongPress = useCallback(() => {
    longPressRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      setShowActionsSheet(true);
    }, LONG_PRESS_MS);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  // ── Commit swipe gesture (used by both touch and mouse up) ─────────────────
  const commitSwipe = useCallback(() => {
    isDraggingRef.current = false;
    cancelLongPress();
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      setOffset(0);
      return;
    }
    const cur = offsetRef.current;
    if (cur > SWIPE_THRESHOLD) {
      setOffset(MAX_OFFSET);
      setTimeout(() => {
        setOffset(0);
        choreActions.complete();
      }, 200);
    } else if (cur < -SWIPE_THRESHOLD) {
      setOffset(-MAX_OFFSET); // snap open action rail
    } else {
      setOffset(0);
    }
  }, [cancelLongPress, choreActions, setOffset]);

  // ── Touch handlers ──────────────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = offsetRef.current;
    isDraggingRef.current = true;
    isLongPressRef.current = false;
    startLongPress();
  }, [startLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const diff = e.touches[0].clientX - startXRef.current;
    if (Math.abs(diff) > 10) cancelLongPress();
    const next = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, currentXRef.current + diff));
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      offsetRef.current = next;
      setDisplayOffset(next);
    });
  }, [cancelLongPress]);

  const handleTouchEnd = useCallback(() => {
    commitSwipe();
  }, [commitSwipe]);

  // ── Mouse handlers (desktop) ────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    currentXRef.current = offsetRef.current;
    isDraggingRef.current = true;
    isLongPressRef.current = false;
    startLongPress();
  }, [startLongPress]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const diff = e.clientX - startXRef.current;
    if (Math.abs(diff) > 10) cancelLongPress();
    const next = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, currentXRef.current + diff));
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      offsetRef.current = next;
      setDisplayOffset(next);
    });
  }, [cancelLongPress]);

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    commitSwipe();
  }, [commitSwipe]);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Close action rail when the card body is tapped while rail is open
  const handleCardClick = useCallback(() => {
    if (offsetRef.current !== 0) {
      setOffset(0);
    }
  }, [setOffset]);

  const handlePostpone = (to: ChorePostponeTarget, customDate?: string) => {
    choreActions.postpone(to, customDate);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-xl select-none">
        {/* ── Swipe-right hint (complete) ── */}
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-center rounded-l-xl bg-emerald-500/30"
          style={{ width: Math.max(0, displayOffset) }}
        >
          {displayOffset > 30 && (
            <CheckCircle2 className="mx-2 h-5 w-5 flex-shrink-0 text-emerald-400" />
          )}
        </div>

        {/* ── Swipe-left action rail ── */}
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end gap-1 rounded-r-xl px-2"
          style={{ width: Math.max(0, -displayOffset) }}
        >
          {-displayOffset > 40 && (
            <>
              <button
                type="button"
                onClick={() => { setOffset(0); setShowPostponeSheet(true); }}
                className="flex flex-col items-center gap-0.5 rounded-lg bg-amber-500/20 px-2 py-2 text-[10px] text-amber-400"
              >
                <Clock className="h-4 w-4" />
                <span>Later</span>
              </button>
              <button
                type="button"
                onClick={() => { setOffset(0); choreActions.skip(); }}
                className="flex flex-col items-center gap-0.5 rounded-lg bg-white/10 px-2 py-2 text-[10px] text-white/60"
              >
                <Ban className="h-4 w-4" />
                <span>Skip</span>
              </button>
              {choreActions.hasPartner && (
                <button
                  type="button"
                  onClick={() => { setOffset(0); choreActions.transferToPartner(); }}
                  className="flex flex-col items-center gap-0.5 rounded-lg bg-white/10 px-2 py-2 text-[10px] text-white/60"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  <span>Pass</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Card body ── */}
        <div
          className={cn(
            "relative flex items-center gap-3 rounded-xl border px-4 py-3",
            tc.surfaceBg,
          )}
          style={{
            borderColor,
            transform: `translateX(${displayOffset}px)`,
            transition: isDraggingRef.current ? "none" : "transform 0.2s ease",
            boxShadow: `0 0 0 1px ${borderColor}22`,
            // Allow vertical scroll but handle horizontal in JS
            touchAction: "pan-y",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onClick={handleCardClick}
        >
          {/* Icon */}
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${borderColor}22` }}
          >
            {entry.metadata_json &&
            typeof entry.metadata_json === "object" &&
            "icon_emoji" in entry.metadata_json &&
            entry.metadata_json.icon_emoji ? (
              <span className="text-base leading-none">
                {String(entry.metadata_json.icon_emoji)}
              </span>
            ) : (
              <ClipboardList className="h-4 w-4" style={{ color: borderColor }} />
            )}
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-sm font-medium", tc.headerText)}>
              {entry.title}
            </p>
            {scheduledLabel && (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-white/40">
                <Clock className="h-3 w-3" />
                {scheduledLabel}
              </span>
            )}
          </div>

          {/* Assignee pill */}
          <div
            className="flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${borderColor}22`,
              color: borderColor,
              border: `1px solid ${borderColor}44`,
            }}
          >
            {isOwner ? "You" : "Partner"}
          </div>

          {/* Drag hint line */}
          <div className="absolute right-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-white/10" />
        </div>
      </div>

      <ChoreActionsSheet
        isOpen={showActionsSheet}
        onClose={() => setShowActionsSheet(false)}
        title={entry.title}
        onComplete={() => choreActions.complete()}
        onSkip={() => choreActions.skip()}
        onPostpone={handlePostpone}
        onTransfer={choreActions.hasPartner ? () => choreActions.transferToPartner() : undefined}
        hasPartner={choreActions.hasPartner}
      />

      <ChorePostponeSheet
        isOpen={showPostponeSheet}
        onClose={() => setShowPostponeSheet(false)}
        onPostpone={handlePostpone}
      />
    </>
  );
}
