"use client";

import { Edit2Icon, Trash2Icon } from "@/components/icons/FuturisticIcons";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";

type Transaction = {
  id: string;
  date: string;
  category: string | null;
  subcategory: string | null;
  amount: number;
  description: string | null;
  account_id: string;
  account_name?: string;
  category_icon?: string;
  user_theme?: string;
  user_id?: string;
  is_owner?: boolean;
};

type Props = {
  transaction: Transaction;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onClick?: (tx: Transaction) => void;
  currentUserId?: string;
};

export default function SwipeableTransactionItem({
  transaction,
  onEdit,
  onDelete,
  onClick,
  currentUserId,
}: Props) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Determine ownership - prefer server flag, fall back to client check
  const isOwner =
    transaction.is_owner ??
    (currentUserId && transaction.user_id
      ? transaction.user_id === currentUserId
      : true);

  // Get current user's theme to determine border color logic
  // If I have pink theme: my transactions=pink border, partner's=blue border
  // If I have blue theme: my transactions=blue border, partner's=pink border
  const { theme: currentUserTheme } = useTheme();

  const SWIPE_THRESHOLD = 80; // pixels to trigger action
  const MAX_OFFSET = 120; // max swipe distance

  const handleTouchStart = (e: React.TouchEvent) => {
    // Disable swipe for partner's transactions
    if (!isOwner) return;
    startX.current = e.touches[0].clientX;
    currentX.current = offset;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    const diff = touch.clientX - startX.current;
    const newOffset = Math.max(
      -MAX_OFFSET,
      Math.min(MAX_OFFSET, currentX.current + diff)
    );

    // Cancel animation frame if exists
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Use RAF for smooth updates
    animationFrameRef.current = requestAnimationFrame(() => {
      setOffset(newOffset);
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    // Determine action based on offset
    if (offset < -SWIPE_THRESHOLD) {
      // Swiped left - Delete
      setOffset(-MAX_OFFSET);
      setTimeout(() => onDelete(transaction.id), 200);
    } else if (offset > SWIPE_THRESHOLD) {
      // Swiped right - Edit
      setOffset(MAX_OFFSET);
      setTimeout(() => {
        setOffset(0);
        onEdit(transaction);
      }, 200);
    } else {
      // Reset
      setOffset(0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Disable swipe for partner's transactions
    if (!isOwner) return;
    startX.current = e.clientX;
    currentX.current = offset;
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const diff = e.clientX - startX.current;
    const newOffset = Math.max(
      -MAX_OFFSET,
      Math.min(MAX_OFFSET, currentX.current + diff)
    );

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      setOffset(newOffset);
    });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    handleTouchEnd();
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl"
      style={{ touchAction: "pan-y" }}
    >
      {/* Background Actions */}
      <div className="absolute inset-0 flex items-center justify-between px-4">
        {/* Edit (Right side - revealed by swiping right) */}
        <div
          className={cn(
            "flex items-center gap-2 transition-opacity",
            offset > 30 ? "opacity-100" : "opacity-0"
          )}
        >
          <Edit2Icon className="w-5 h-5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
          <span className="text-sm font-medium text-blue-400">Edit</span>
        </div>

        {/* Delete (Left side - revealed by swiping left) */}
        <div
          className={cn(
            "flex items-center gap-2 transition-opacity ml-auto",
            offset < -30 ? "opacity-100" : "opacity-0"
          )}
        >
          <span className="text-sm font-medium text-red-400">Delete</span>
          <Trash2Icon className="w-5 h-5 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
        </div>
      </div>

      {/* Main Content */}
      <div
        className={cn(
          "relative bg-gradient-to-br from-[#1a2942] to-[#0f1d2e] rounded-xl p-3 cursor-pointer",
          // Theme-based border colors
          // If this is my transaction: use my theme color
          // If this is partner's transaction: use opposite color
          isOwner
            ? currentUserTheme === "pink"
              ? "border-2 border-[#ec4899]/40"
              : "border-2 border-[#3b82f6]/40"
            : currentUserTheme === "pink"
              ? "border-2 border-[#3b82f6]/40"
              : "border-2 border-[#ec4899]/40",
          isDragging ? "" : "transition-transform duration-200 ease-out"
        )}
        style={{
          transform: `translateX(${offset}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          if (Math.abs(offset) < 5) {
            onClick?.(transaction);
          }
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: Icon + Category */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {(() => {
                const IconComponent = getCategoryIcon(
                  transaction.category || undefined
                );
                return (
                  <IconComponent className="w-5 h-5 text-[#06b6d4]/70 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {transaction.category || "Uncategorized"}
                </p>
                {transaction.subcategory && (
                  <p className="text-xs text-[#38bdf8]/70 truncate">
                    {transaction.subcategory}
                  </p>
                )}
              </div>
            </div>
            {/* Date + Account */}
            <div className="flex items-center gap-2 mt-1.5 text-xs text-[#38bdf8]/60">
              <span>{format(new Date(transaction.date), "MMM d")}</span>
              {transaction.account_name && (
                <>
                  <span>•</span>
                  <span className="truncate">{transaction.account_name}</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Amount */}
          <div className="text-right">
            <p className="text-lg font-bold text-[#06b6d4]">
              ${transaction.amount.toFixed(2)}
            </p>
            {transaction.description && (
              <p className="text-xs text-[#38bdf8]/60 truncate max-w-[80px]">
                {transaction.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
