"use client";

import {
  personTone,
  useChoreTone,
  type ChorePerson,
} from "@/components/chores/choreUi";
import { cn } from "@/lib/utils";
import { useRef, useState, type ReactNode } from "react";

// Same feel as the Hub shopping list: a dead zone, follow the finger up to the
// lock point, then heavy resistance. Release past the lock to commit.
const DEAD_ZONE = 14;
const LOCK = 72;
const MAX = 132;

export type ChoreSwipeSide = "me" | "partner";

interface ChoreSwipeProps {
  /** Swipe left target; null = side unavailable */
  me: ChorePerson | null;
  /** Swipe right target; null = side unavailable */
  partner: ChorePerson | null;
  disabled?: boolean;
  onSwipe: (side: ChoreSwipeSide) => void;
  className?: string;
  children: ReactNode;
}

export function ChoreSwipe({
  me,
  partner,
  disabled,
  onSwipe,
  className,
  children,
}: ChoreSwipeProps) {
  const { isFrost } = useChoreTone();
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const locked = useRef(false);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const side: ChoreSwipeSide | null =
    offset < 0 ? "me" : offset > 0 ? "partner" : null;
  const target = side === "me" ? me : side === "partner" ? partner : null;
  const isLocked = Math.abs(offset) >= LOCK && !!target;
  const tone = target ? personTone(target.color, isFrost) : null;

  const reset = () => {
    start.current = null;
    axis.current = null;
    locked.current = false;
    setDragging(false);
    setOffset(0);
  };

  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl", className)}
      style={{ touchAction: "pan-y" }}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return;
        start.current = {
          x: event.clientX,
          y: event.clientY,
          id: event.pointerId,
        };
        axis.current = null;
      }}
      onPointerMove={(event) => {
        const origin = start.current;
        if (!origin || origin.id !== event.pointerId) return;
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        if (axis.current === null) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < DEAD_ZONE) return;
          axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          if (axis.current === "x") {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }
        }
        if (axis.current !== "x") return;
        const available = dx < 0 ? me : partner;
        const abs = Math.abs(dx);
        const travel = !available
          ? Math.min(24, abs * 0.2)
          : Math.min(MAX, abs < LOCK ? abs : LOCK + (abs - LOCK) * 0.3);
        const nowLocked = !!available && abs >= LOCK;
        if (nowLocked && !locked.current) navigator.vibrate?.(8);
        locked.current = nowLocked;
        setOffset(Math.sign(dx) * travel);
      }}
      onPointerUp={() => {
        if (axis.current === "x") {
          suppressClick.current = true;
          if (locked.current && side) onSwipe(side);
        }
        reset();
      }}
      onPointerCancel={reset}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {target && tone && offset !== 0 && (
        <div
          className={cn(
            "absolute inset-y-0 flex items-center rounded-2xl px-4 text-xs font-semibold transition-colors",
            side === "me" ? "right-0 justify-end" : "left-0 justify-start",
            isLocked ? tone.revealStrong : tone.reveal,
            tone.text,
          )}
          style={{ width: Math.abs(offset) + 24 }}
          aria-hidden
        >
          <span
            className={cn(
              "truncate transition-opacity",
              isLocked ? "opacity-100" : "opacity-40",
            )}
          >
            {target.label}
          </span>
        </div>
      )}
      <div
        className="relative"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
