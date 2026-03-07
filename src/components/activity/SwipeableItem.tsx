"use client";

import { cn } from "@/lib/utils";
import { Edit2Icon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface SwipeableItemProps {
  /** Unique item identifier */
  itemId: string;
  /** Whether the current user owns this item (swipe disabled if false) */
  isOwner: boolean;
  /** Called when swipe-right confirms (edit action) */
  onEdit: (id: string) => void;
  /** Called when swipe-left confirms (delete action) */
  onDelete: (id: string) => void;
  /** Called on tap (non-swipe click) */
  onClick: (id: string) => void;
  children: ReactNode;
}

const DEAD_ZONE = 20; // px before any visual feedback
const CONFIRM_ZONE = 70; // px to confirm action
const MAX_DRAG = 100; // px max visual translation

/**
 * Swipeable wrapper for list items using the same native touch listener pattern
 * as ShoppingListView's SwipeToAssign.
 *
 * - Swipe RIGHT → Edit (theme color reveal)
 * - Swipe LEFT → Delete (red reveal)
 * - Tap → onClick
 * - Disabled for non-owner items
 */
export default function SwipeableItem({
  itemId,
  isOwner,
  onEdit,
  onDelete,
  onClick,
  children,
}: SwipeableItemProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const offsetRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    direction: "horizontal" | "vertical" | null;
    dragging: boolean;
    didSwipe: boolean;
  } | null>(null);

  // Use refs to always have latest values in touch handlers
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !isOwner) return;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        direction: null,
        dragging: false,
        didSwipe: false,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const state = touchStateRef.current;
      if (!state) return;
      const touch = e.touches[0];
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Lock direction on first significant movement
      if (!state.direction) {
        if (absDx < 8 && absDy < 8) return;
        state.direction = absDx > absDy ? "horizontal" : "vertical";
      }

      // Vertical scroll — do nothing
      if (state.direction === "vertical") return;

      // Prevent page scroll while swiping horizontally
      e.preventDefault();

      if (!state.dragging && absDx > DEAD_ZONE) {
        state.dragging = true;
        state.didSwipe = true;
        setIsDragging(true);
      }

      if (absDx <= DEAD_ZONE) {
        offsetRef.current = 0;
        setOffsetX(0);
        return;
      }

      // Resistance past confirm zone (piano-key snap feel)
      const sign = dx > 0 ? 1 : -1;
      const activeDist = absDx - DEAD_ZONE;
      const confirmDist = CONFIRM_ZONE - DEAD_ZONE;
      let mapped: number;
      if (activeDist <= confirmDist) {
        mapped = activeDist;
      } else {
        mapped = confirmDist + (activeDist - confirmDist) * 0.3;
      }
      const val = sign * Math.min(mapped, MAX_DRAG);
      offsetRef.current = val;
      setOffsetX(val);
    };

    const onTouchEnd = () => {
      const state = touchStateRef.current;
      if (!state) return;

      const currentOffset = offsetRef.current;
      const absOff = Math.abs(currentOffset);
      const confirmDist = CONFIRM_ZONE - DEAD_ZONE;

      // Reset offset immediately
      offsetRef.current = 0;
      setOffsetX(0);

      // Fire callbacks outside the state updater to avoid setState-during-render
      if (absOff >= confirmDist) {
        if (navigator.vibrate) navigator.vibrate(15);
        if (currentOffset > 0) {
          // Swiped RIGHT → Edit
          onEditRef.current(itemId);
        } else {
          // Swiped LEFT → Delete
          onDeleteRef.current(itemId);
        }
      }

      setIsDragging(false);
      // Keep didSwipe flag briefly to suppress onClick
      setTimeout(() => {
        if (touchStateRef.current) {
          touchStateRef.current = null;
        }
      }, 50);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [isOwner, itemId]);

  const absOffset = Math.abs(offsetX);
  const confirmedThreshold = CONFIRM_ZONE - DEAD_ZONE;
  const isConfirmed = absOffset >= confirmedThreshold;
  const previewOpacity = isDragging
    ? Math.min(absOffset / confirmedThreshold, 1)
    : 0;

  const handleClick = () => {
    // Suppress click if we just finished a swipe
    if (touchStateRef.current?.didSwipe) return;
    onClick(itemId);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Right reveal (Edit) — shown when swiping right */}
      {isDragging && offsetX > 0 && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start px-4 rounded-xl transition-colors z-0",
            isConfirmed ? "bg-blue-500/30" : "bg-blue-500/10",
          )}
          style={{ width: `${absOffset + 16}px`, opacity: previewOpacity }}
        >
          <div className="flex items-center gap-1.5">
            <Edit2Icon
              className={cn(
                "w-4 h-4",
                isConfirmed ? "text-blue-300" : "text-blue-400/60",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                isConfirmed ? "text-blue-300" : "text-blue-400/60",
              )}
            >
              Edit
            </span>
          </div>
        </div>
      )}

      {/* Left reveal (Delete) — shown when swiping left */}
      {isDragging && offsetX < 0 && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end px-4 rounded-xl transition-colors z-0",
            isConfirmed ? "bg-red-500/30" : "bg-red-500/10",
          )}
          style={{ width: `${absOffset + 16}px`, opacity: previewOpacity }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                isConfirmed ? "text-red-300" : "text-red-400/60",
              )}
            >
              Delete
            </span>
            <Trash2Icon
              className={cn(
                "w-4 h-4",
                isConfirmed ? "text-red-300" : "text-red-400/60",
              )}
            />
          </div>
        </div>
      )}

      {/* Swipeable content */}
      <div
        ref={contentRef}
        onClick={handleClick}
        className="relative z-10"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 0.25s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
