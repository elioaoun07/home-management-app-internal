"use client";

import { Edit2Icon, Trash2Icon } from "@/components/icons/FuturisticIcons";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import {
  getTransactionDisplayAmount,
  getTransactionDisplayDescription,
} from "@/lib/utils/splitBill";
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
  inserted_at: string;
  account_name?: string;
  category_color?: string;
  subcategory_color?: string;
  user_theme?: string;
  user_id?: string;
  is_owner?: boolean;
  /** True if current user is the collaborator on a completed split transaction */
  is_collaborator?: boolean;
  /** True if this transaction is optimistic (not yet confirmed by server) */
  _isPending?: boolean;
  /** Split bill fields */
  split_requested?: boolean;
  collaborator_id?: string;
  collaborator_amount?: number;
  collaborator_description?: string;
  split_completed_at?: string;
};

type OwnershipFilter = "all" | "mine" | "partner";

type Props = {
  transaction: Transaction;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onClick?: (tx: Transaction) => void;
  currentUserId?: string;
  ownershipFilter?: OwnershipFilter;
};

export default function SwipeableTransactionItem({
  transaction,
  onEdit,
  onDelete,
  onClick,
  currentUserId,
  ownershipFilter = "all",
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

  // Check if user is the collaborator on this split transaction
  const isCollaborator = transaction.is_collaborator === true;

  // Determine if this is a completed split transaction
  const isSplitCompleted =
    transaction.split_requested &&
    transaction.split_completed_at &&
    transaction.collaborator_amount !== undefined &&
    transaction.collaborator_amount !== null;

  // Calculate display amount based on ownership filter and user's role
  const displayAmount = getTransactionDisplayAmount(
    transaction,
    ownershipFilter
  );

  // Get display description based on filter and role
  const displayDescription = getTransactionDisplayDescription(
    transaction,
    ownershipFilter
  );

  // Get current user's theme to determine border color logic
  // If I have pink theme: my transactions=pink border, partner's=blue border
  // If I have blue theme: my transactions=blue border, partner's=pink border
  const { theme: currentUserTheme } = useTheme();
  const themeClasses = useThemeClasses();

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
          <Edit2Icon
            className={`w-5 h-5 ${themeClasses.editText} ${themeClasses.editGlow}`}
          />
          <span className={`text-sm font-medium ${themeClasses.editText}`}>
            Edit
          </span>
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
          // Theme-based border styling
          // Own transactions get user's theme color border, partner's get opposite color
          "neo-card",
          isDragging ? "" : "transition-transform duration-200 ease-out"
        )}
        style={{
          transform: `translateX(${offset}px)`,
          // Override neo-card border with left colored border for ownership indication
          // Split transactions get a gradient border showing both colors
          borderLeft:
            transaction.split_requested && transaction.split_completed_at
              ? undefined // Will use gradient overlay instead
              : `4px solid ${
                  isOwner
                    ? currentUserTheme === "pink"
                      ? "#ec4899" // pink-500
                      : "#3b82f6" // blue-500
                    : currentUserTheme === "pink"
                      ? "#3b82f6" // blue-500
                      : "#ec4899" // pink-500
                }`,
          boxShadow:
            transaction.split_requested && transaction.split_completed_at
              ? "0 0 12px rgba(236,72,153,0.15), 0 0 12px rgba(59,130,246,0.15)"
              : isOwner
                ? currentUserTheme === "pink"
                  ? "0 0 12px rgba(236,72,153,0.15)"
                  : "0 0 12px rgba(59,130,246,0.15)"
                : currentUserTheme === "pink"
                  ? "0 0 12px rgba(59,130,246,0.15)"
                  : "0 0 12px rgba(236,72,153,0.15)",
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
        {/* Split bill dual-color border indicator */}
        {transaction.split_requested && transaction.split_completed_at && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl overflow-hidden"
            style={{
              background:
                "linear-gradient(to bottom, #3b82f6 0%, #3b82f6 50%, #ec4899 50%, #ec4899 100%)",
            }}
          />
        )}
        {/* Pending split indicator (waiting for partner) */}
        {transaction.split_requested && !transaction.split_completed_at && (
          <div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-pulse"
            title="Awaiting partner's portion"
          />
        )}

        <div className="flex items-center justify-between gap-3">
          {/* Left: Icon + Category */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {(() => {
                const IconComponent = getCategoryIcon(
                  transaction.category || undefined
                );
                return (
                  <IconComponent
                    className={`w-5 h-5 ${themeClasses.labelTextMuted} ${themeClasses.iconGlow}`}
                  />
                );
              })()}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: transaction.category_color || "#e2e8f0" }}
                >
                  {transaction.category || "Uncategorized"}
                </p>
                {transaction.subcategory && (
                  <p className={`text-xs truncate ${themeClasses.textMuted}`}>
                    {transaction.subcategory}
                  </p>
                )}
              </div>
            </div>
            {/* Date + Account */}
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400/60">
              <span>{format(new Date(transaction.date), "MMM d")}</span>
              {transaction.account_name && (
                <>
                  <span>•</span>
                  <span className="truncate">{transaction.account_name}</span>
                </>
              )}
              {/* Split indicator */}
              {transaction.split_requested &&
                transaction.split_completed_at && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-400">Split</span>
                  </>
                )}
            </div>
          </div>

          {/* Right: Amount + Pending Indicator */}
          <div className="text-right flex items-center gap-2">
            {/* Pending sync indicator */}
            {transaction._isPending && (
              <div className="flex items-center" title="Syncing...">
                <svg
                  className="w-4 h-4 text-amber-400 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}
            <div>
              {/* Display amount based on filter and role */}
              <p
                className={cn(
                  "text-lg font-bold bg-gradient-to-br from-emerald-400 via-emerald-300 to-teal bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]",
                  transaction._isPending && "opacity-70"
                )}
              >
                ${displayAmount.toFixed(2)}
              </p>
              {/* Show split breakdown only when viewing "all" for completed splits */}
              {isSplitCompleted && ownershipFilter === "all" && (
                <div className="flex gap-1 text-xs">
                  <span className="text-blue-400">
                    ${transaction.amount.toFixed(0)}
                  </span>
                  <span className="text-slate-500">+</span>
                  <span className="text-pink-400">
                    ${(transaction.collaborator_amount || 0).toFixed(0)}
                  </span>
                </div>
              )}
              {/* Description display based on filter */}
              {displayDescription && (
                <p className="text-xs text-slate-400/60 truncate max-w-[80px]">
                  {displayDescription}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
