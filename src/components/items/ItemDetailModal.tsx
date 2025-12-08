"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  format,
  isBefore,
  parseISO,
} from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Icons
const XIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const Edit2Icon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const Trash2Icon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckSquare = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const GlobeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// Priority badge colors
const priorityColors = {
  low: { bg: "bg-gray-500/20", text: "text-gray-400" },
  normal: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  high: { bg: "bg-orange-500/20", text: "text-orange-400" },
  urgent: { bg: "bg-red-500/20", text: "text-red-400" },
};

const statusColors = {
  pending: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  in_progress: { bg: "bg-amber-500/20", text: "text-amber-400" },
  completed: { bg: "bg-green-500/20", text: "text-green-400" },
  cancelled: { bg: "bg-gray-500/20", text: "text-gray-400" },
};

type Props = {
  item: ItemWithDetails;
  onClose: () => void;
  onEdit: () => void;
  onComplete?: () => void;
  onDelete: () => void;
  currentUserId?: string;
};

// Format countdown/overdue time
function formatTimeDistance(dateStr: string): {
  text: string;
  isOverdue: boolean;
} {
  const date = parseISO(dateStr);
  const now = new Date();
  const isOverdue = isBefore(date, now);

  const minutes = Math.abs(differenceInMinutes(date, now));
  const hours = Math.abs(differenceInHours(date, now));
  const days = Math.abs(differenceInDays(date, now));

  let text: string;
  if (days >= 1) {
    text = `${days}d ${hours % 24}h`;
  } else if (hours >= 1) {
    text = `${hours}h ${minutes % 60}m`;
  } else {
    text = `${minutes}m`;
  }

  return {
    text: isOverdue ? `${text} overdue` : `in ${text}`,
    isOverdue,
  };
}

export default function ItemDetailModal({
  item,
  onClose,
  onEdit,
  onComplete,
  onDelete,
  currentUserId,
}: Props) {
  const themeClasses = useThemeClasses();
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [isClosing, setIsClosing] = useState(false);

  // Determine ownership
  const isOwner = currentUserId
    ? item.responsible_user_id === currentUserId ||
      item.user_id === currentUserId
    : true;

  // Item type info
  const isReminder = item.type === "reminder";
  const isEvent = item.type === "event";
  const isTask = item.type === "task";
  const isCompleted = item.status === "completed";

  // Get due/start date
  const dateStr =
    isReminder || isTask
      ? item.reminder_details?.due_at
      : isEvent
        ? item.event_details?.start_at
        : null;

  const endDateStr = isEvent ? item.event_details?.end_at : null;
  const timeInfo = dateStr ? formatTimeDistance(dateStr) : null;

  // Animated close handler
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
  }, [onClose]);

  const handleEdit = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      onEdit();
    }, 200);
  }, [onClose, onEdit]);

  const handleComplete = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      onComplete?.();
    }, 200);
  }, [onClose, onComplete]);

  const handleDelete = useCallback(() => {
    if (!confirm("Delete this item?")) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      onDelete();
    }, 200);
  }, [onClose, onDelete]);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Owner-based border colors
  const borderColor = isOwner
    ? isPink
      ? "#ec4899"
      : "#3b82f6"
    : isPink
      ? "#3b82f6"
      : "#ec4899";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center overflow-hidden"
      onClick={handleClose}
      style={{
        animation: isClosing
          ? "modalBackdropFadeOut 0.25s ease-in forwards"
          : "modalBackdropFadeIn 0.2s ease-out forwards",
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{
          animation: isClosing
            ? "modalBackdropFadeOut 0.25s ease-in forwards"
            : "modalBackdropFadeIn 0.2s ease-out forwards",
        }}
      />

      {/* Modal Content */}
      <div
        className={cn(
          "relative w-full max-w-lg mx-4 rounded-t-2xl md:rounded-2xl",
          "bg-gradient-to-br from-[#1a2942] to-[#0f1d2e]",
          "border border-white/10 shadow-2xl",
          "max-h-[85vh] overflow-hidden flex flex-col"
        )}
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: isClosing
            ? "modalSlideOut 0.25s ease-in forwards"
            : "modalSlideIn 0.3s ease-out forwards",
          borderTop: `4px solid ${borderColor}`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {/* Type Icon */}
            {isReminder && (
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                )}
              >
                <ClockIcon
                  className={cn(
                    "w-5 h-5",
                    isPink ? "text-pink-400" : "text-cyan-400"
                  )}
                />
              </div>
            )}
            {isEvent && (
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                )}
              >
                <CalendarIcon
                  className={cn(
                    "w-5 h-5",
                    isPink ? "text-pink-400" : "text-cyan-400"
                  )}
                />
              </div>
            )}
            {isTask && (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/20">
                <CheckSquare className="w-5 h-5 text-purple-400" />
              </div>
            )}

            <div>
              <span
                className={cn(
                  "text-xs uppercase font-medium",
                  isPink ? "text-pink-400" : "text-cyan-400"
                )}
              >
                {item.type}
              </span>
              {/* Owner indicator */}
              {!isOwner && (
                <span className="ml-2 text-[10px] text-white/40">
                  (Partner's)
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <XIcon className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title + Priority */}
          <div>
            <div className="flex items-start gap-2">
              <h2
                className={cn(
                  "text-xl font-bold text-white flex-1",
                  isCompleted && "line-through text-white/50"
                )}
              >
                {item.title}
              </h2>
              {item.priority !== "normal" && (
                <span
                  className={cn(
                    "px-2 py-1 rounded text-xs font-medium uppercase",
                    priorityColors[item.priority].bg,
                    priorityColors[item.priority].text
                  )}
                >
                  {item.priority}
                </span>
              )}
            </div>

            {/* Status badge */}
            {item.status && (
              <span
                className={cn(
                  "inline-block mt-2 px-2 py-1 rounded text-xs font-medium",
                  statusColors[item.status].bg,
                  statusColors[item.status].text
                )}
              >
                {item.status.replace("_", " ")}
              </span>
            )}
          </div>

          {/* Countdown/Overdue */}
          {timeInfo && !isCompleted && (
            <div
              className={cn(
                "flex items-center gap-2 p-3 rounded-xl",
                timeInfo.isOverdue
                  ? "bg-red-500/10 border border-red-500/30"
                  : isPink
                    ? "bg-pink-500/10 border border-pink-500/30"
                    : "bg-cyan-500/10 border border-cyan-500/30"
              )}
            >
              {timeInfo.isOverdue ? (
                <AlertIcon className="w-5 h-5 text-red-400" />
              ) : (
                <ClockIcon
                  className={cn(
                    "w-5 h-5",
                    isPink ? "text-pink-400" : "text-cyan-400"
                  )}
                />
              )}
              <span
                className={cn(
                  "font-semibold",
                  timeInfo.isOverdue
                    ? "text-red-400"
                    : isPink
                      ? "text-pink-400"
                      : "text-cyan-400"
                )}
              >
                {timeInfo.text}
              </span>
            </div>
          )}

          {/* Date/Time info */}
          {dateStr && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/70">
                <CalendarIcon className="w-4 h-4" />
                <span>{format(parseISO(dateStr), "EEEE, MMMM d, yyyy")}</span>
              </div>
              {!item.event_details?.all_day && (
                <div className="flex items-center gap-2 text-white/70">
                  <ClockIcon className="w-4 h-4" />
                  <span>
                    {format(parseISO(dateStr), "h:mm a")}
                    {endDateStr &&
                      ` - ${format(parseISO(endDateStr), "h:mm a")}`}
                  </span>
                </div>
              )}
              {item.event_details?.all_day && (
                <div className="flex items-center gap-2 text-white/50 text-sm">
                  <span>All day</span>
                </div>
              )}
            </div>
          )}

          {/* Location for events */}
          {isEvent && item.event_details?.location_text && (
            <div className="flex items-center gap-2 text-white/70">
              <MapPinIcon className="w-4 h-4" />
              <span>{item.event_details.location_text}</span>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-white/80 whitespace-pre-wrap text-sm">
                {item.description}
              </p>
            </div>
          )}

          {/* Categories/Tags */}
          {item.categories && item.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.categories.map((cat) => (
                <span
                  key={cat.id}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-white/10 text-white/70"
                  style={{
                    backgroundColor: cat.color_hex
                      ? `${cat.color_hex}20`
                      : undefined,
                    color: cat.color_hex || undefined,
                  }}
                >
                  {cat.name}
                </span>
              ))}
            </div>
          )}

          {/* Subtasks */}
          {item.subtasks && item.subtasks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-white/60">Subtasks</h3>
              <div className="space-y-1.5">
                {item.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white/5"
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center",
                        subtask.done_at
                          ? "bg-green-500 border-green-500"
                          : "border-white/30"
                      )}
                    >
                      {subtask.done_at && (
                        <CheckIcon className="w-2.5 h-2.5 text-white" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm",
                        subtask.done_at
                          ? "text-white/50 line-through"
                          : "text-white/80"
                      )}
                    >
                      {subtask.title}
                    </span>
                  </div>
                ))}
              </div>
              {/* Progress */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      isPink ? "bg-pink-400" : "bg-cyan-400"
                    )}
                    style={{
                      width: `${
                        (item.subtasks.filter((s) => s.done_at).length /
                          item.subtasks.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <span className="text-xs text-white/50">
                  {item.subtasks.filter((s) => s.done_at).length}/
                  {item.subtasks.length}
                </span>
              </div>
            </div>
          )}

          {/* Visibility */}
          <div className="flex items-center gap-2 text-white/50 text-sm">
            {item.is_public ? (
              <>
                <GlobeIcon className="w-4 h-4" />
                <span>Visible to household</span>
              </>
            ) : (
              <>
                <LockIcon className="w-4 h-4" />
                <span>Private</span>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 flex gap-2">
          {isOwner ? (
            <>
              {isReminder && !isCompleted && (
                <button
                  type="button"
                  onClick={handleComplete}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/20 text-green-400 font-medium hover:bg-green-500/30 transition-colors"
                >
                  <CheckIcon className="w-5 h-5" />
                  Complete
                </button>
              )}
              <button
                type="button"
                onClick={handleEdit}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors",
                  isPink
                    ? "bg-pink-500/20 text-pink-400 hover:bg-pink-500/30"
                    : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                )}
              >
                <Edit2Icon className="w-5 h-5" />
                Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                <Trash2Icon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex-1 text-center text-white/40 py-3">
              This item belongs to your partner
            </div>
          )}
        </div>
      </div>

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes modalBackdropFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes modalBackdropFadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        @keyframes modalSlideIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes modalSlideOut {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(100%);
            opacity: 0;
          }
        }
        @media (min-width: 768px) {
          @keyframes modalSlideIn {
            from {
              transform: scale(0.95);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
          @keyframes modalSlideOut {
            from {
              transform: scale(1);
              opacity: 1;
            }
            to {
              transform: scale(0.95);
              opacity: 0;
            }
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
