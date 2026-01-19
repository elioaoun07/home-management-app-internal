"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import { format, parseISO } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Icons
const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <polyline points="20 6 9 17 4 12" />
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
  </svg>
);

const FastForwardIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polygon points="13 19 22 12 13 5 13 19" />
    <polygon points="2 19 11 12 2 5 2 19" />
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

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

const MessageIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CalendarPlusIcon = ({ className }: { className?: string }) => (
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
    <line x1="12" x2="12" y1="14" y2="18" />
    <line x1="10" x2="14" y1="16" y2="16" />
  </svg>
);

type PostponeOption = {
  id: "next_occurrence" | "tomorrow" | "custom" | "ai_slot";
  label: string;
  sublabel?: string;
  icon: React.FC<{ className?: string }>;
  disabled?: boolean;
};

type Props = {
  item: ItemWithDetails;
  occurrenceDate: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (reason?: string) => void;
  onPostpone: (
    type: "next_occurrence" | "tomorrow" | "custom" | "ai_slot",
    reason?: string,
  ) => void;
  onCancel: (reason?: string) => void;
  onDelete: () => void;
};

export default function ItemActionsSheet({
  item,
  occurrenceDate,
  isOpen,
  onClose,
  onComplete,
  onPostpone,
  onCancel,
  onDelete,
}: Props) {
  const { theme } = useTheme();
  const themeClasses = useThemeClasses();
  const isPink = theme === "pink";
  const [isClosing, setIsClosing] = useState(false);
  const [showPostponeOptions, setShowPostponeOptions] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "complete" | "cancel" | "postpone" | null
  >(null);
  const [pendingPostponeType, setPendingPostponeType] = useState<
    "next_occurrence" | "tomorrow" | "custom" | "ai_slot" | null
  >(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const isRecurring = !!item.recurrence_rule?.rrule;

  // Initialize custom date/time from occurrence date
  useEffect(() => {
    if (isOpen && occurrenceDate) {
      const date = parseISO(occurrenceDate);
      // Add 1 day for default suggestion
      date.setDate(date.getDate() + 1);
      setCustomDate(format(date, "yyyy-MM-dd"));
      setCustomTime(format(parseISO(occurrenceDate), "HH:mm"));
    }
  }, [isOpen, occurrenceDate]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setShowPostponeOptions(false);
      setShowDatePicker(false);
      setShowReasonInput(false);
      setReason("");
      setCustomDate("");
      setCustomTime("");
      setPendingAction(null);
      setPendingPostponeType(null);
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const handleCompleteClick = () => {
    // Complete directly without prompting for reason
    onComplete();
    handleClose();
  };

  const handleCancelClick = () => {
    setPendingAction("cancel");
    setShowReasonInput(true);
  };

  const handleReasonSubmit = () => {
    if (pendingAction === "complete") {
      onComplete(reason || undefined);
    } else if (pendingAction === "cancel") {
      onCancel(reason || undefined);
    } else if (pendingAction === "postpone" && pendingPostponeType) {
      onPostpone(pendingPostponeType, reason || undefined);
    }
    handleClose();
  };

  const handlePostponeSelect = (
    type: "next_occurrence" | "tomorrow" | "custom" | "ai_slot",
  ) => {
    if (type === "custom") {
      // Show date picker instead of reason input
      setShowPostponeOptions(false);
      setShowDatePicker(true);
      return;
    }
    // Show reason input for other postpone types
    setPendingAction("postpone");
    setPendingPostponeType(type);
    setShowPostponeOptions(false);
    setShowReasonInput(true);
  };

  const handleCustomDateConfirm = () => {
    if (!customDate) return;

    // Combine date and time into ISO string
    const dateTimeStr = customTime
      ? `${customDate}T${customTime}:00`
      : `${customDate}T${format(parseISO(occurrenceDate), "HH:mm")}:00`;

    // Call onPostpone with "custom" type
    // The parent component will need to handle the custom date
    setShowDatePicker(false);
    setPendingAction("postpone");
    setPendingPostponeType("custom");

    // Store the custom date in reason temporarily to pass to parent
    // Better approach: Update the callback to accept custom date
    onPostpone("custom", dateTimeStr);
    handleClose();
  };

  const handleDeleteClick = () => {
    onDelete();
    handleClose();
  };

  const postponeOptions: PostponeOption[] = isRecurring
    ? [
        {
          id: "next_occurrence",
          label: "Next Occurrence",
          sublabel: "Skip this time, mark as incomplete",
          icon: FastForwardIcon,
        },
        {
          id: "tomorrow",
          label: "Tomorrow Same Time",
          sublabel: format(parseISO(occurrenceDate), "h:mm a"),
          icon: CalendarIcon,
        },
        {
          id: "custom",
          label: "Pick Specific Date",
          sublabel: "Choose date and time",
          icon: CalendarPlusIcon,
        },
        {
          id: "ai_slot",
          label: "My Next Available Slot",
          sublabel: "Coming soon",
          icon: SparklesIcon,
          disabled: true,
        },
      ]
    : [
        {
          id: "tomorrow",
          label: "Tomorrow",
          sublabel: format(parseISO(occurrenceDate), "h:mm a"),
          icon: CalendarIcon,
        },
        {
          id: "custom",
          label: "Pick Specific Date",
          sublabel: "Choose date and time",
          icon: CalendarPlusIcon,
        },
        {
          id: "ai_slot",
          label: "Find Best Time",
          sublabel: "Coming soon",
          icon: SparklesIcon,
          disabled: true,
        },
      ];

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
          isClosing ? "opacity-0" : "opacity-100",
        )}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "relative w-full max-w-lg mx-2 mb-2 rounded-2xl overflow-hidden",
          "bg-gradient-to-br from-[#1a2942] to-[#0f1d2e]",
          "border border-white/10 shadow-2xl",
          "transition-transform duration-200 ease-out",
          isClosing ? "translate-y-full" : "translate-y-0",
        )}
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: isClosing ? undefined : "slideUp 0.3s ease-out",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white truncate">
            {item.title}
          </h3>
          <p className="text-sm text-white/50 mt-0.5">
            {format(parseISO(occurrenceDate), "EEEE, MMM d 'at' h:mm a")}
            {isRecurring && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400">
                Recurring
              </span>
            )}
          </p>
        </div>

        {/* Reason Input View */}
        {showReasonInput && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-white/70">
              <MessageIcon className="w-4 h-4" />
              <span className="text-sm">
                {pendingAction === "complete"
                  ? "Add a note (optional)"
                  : pendingAction === "postpone"
                    ? "Why was this postponed? (optional)"
                    : "Reason for cancelling (optional)"}
              </span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason..."
              className={cn(
                "w-full h-24 px-4 py-3 rounded-xl resize-none",
                "bg-white/5 border border-white/10",
                "text-white placeholder:text-white/30",
                "focus:outline-none focus:ring-2",
                isPink ? "focus:ring-pink-500/50" : "focus:ring-cyan-500/50",
              )}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowReasonInput(false);
                  setPendingAction(null);
                  setPendingPostponeType(null);
                }}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleReasonSubmit}
                className={cn(
                  "flex-1 py-3 rounded-xl font-medium text-white",
                  pendingAction === "postpone"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : pendingAction === "cancel"
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-green-500 hover:bg-green-600",
                )}
              >
                {pendingAction === "postpone"
                  ? "Postpone"
                  : pendingAction === "cancel"
                    ? "Cancel Item"
                    : "Complete"}
              </button>
            </div>
          </div>
        )}

        {/* Postpone Options View */}
        {showPostponeOptions && !showReasonInput && (
          <div className="p-4 space-y-2">
            <button
              type="button"
              onClick={() => setShowPostponeOptions(false)}
              className="flex items-center gap-2 text-white/50 hover:text-white mb-3"
            >
              <ChevronDownIcon className="w-4 h-4 rotate-90" />
              <span className="text-sm">Back</span>
            </button>

            {postponeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={option.disabled}
                onClick={() => handlePostponeSelect(option.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl transition-all",
                  option.disabled
                    ? "opacity-40 cursor-not-allowed bg-white/5"
                    : "bg-white/5 hover:bg-white/10 active:scale-[0.98]",
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    option.disabled
                      ? "bg-gray-500/20"
                      : isPink
                        ? "bg-pink-500/20"
                        : "bg-cyan-500/20",
                  )}
                >
                  <option.icon
                    className={cn(
                      "w-5 h-5",
                      option.disabled
                        ? "text-gray-500"
                        : isPink
                          ? "text-pink-400"
                          : "text-cyan-400",
                    )}
                  />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">{option.label}</p>
                  {option.sublabel && (
                    <p className="text-sm text-white/50">{option.sublabel}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Date Picker View */}
        {showDatePicker && !showReasonInput && (
          <div className="p-4 space-y-4">
            <button
              type="button"
              onClick={() => {
                setShowDatePicker(false);
                setShowPostponeOptions(true);
              }}
              className="flex items-center gap-2 text-white/50 hover:text-white mb-3"
            >
              <ChevronDownIcon className="w-4 h-4 rotate-90" />
              <span className="text-sm">Back</span>
            </button>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl",
                    "bg-white/5 border border-white/10",
                    "text-white",
                    "focus:outline-none focus:ring-2",
                    isPink
                      ? "focus:ring-pink-500/50"
                      : "focus:ring-cyan-500/50",
                    "[color-scheme:dark]",
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Time
                </label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl",
                    "bg-white/5 border border-white/10",
                    "text-white",
                    "focus:outline-none focus:ring-2",
                    isPink
                      ? "focus:ring-pink-500/50"
                      : "focus:ring-cyan-500/50",
                    "[color-scheme:dark]",
                  )}
                />
              </div>

              {/* Preview */}
              {customDate && (
                <div
                  className={cn(
                    "px-4 py-3 rounded-xl",
                    "bg-white/5 border border-white/10",
                  )}
                >
                  <p className="text-sm text-white/50 mb-1">Postpone to:</p>
                  <p
                    className={cn(
                      "text-lg font-medium",
                      isPink ? "text-pink-400" : "text-cyan-400",
                    )}
                  >
                    {format(
                      new Date(`${customDate}T${customTime || "12:00"}`),
                      "EEEE, MMM d 'at' h:mm a",
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDatePicker(false);
                  setShowPostponeOptions(true);
                }}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCustomDateConfirm}
                disabled={!customDate}
                className={cn(
                  "flex-1 py-3 rounded-xl font-medium text-white transition-all",
                  customDate
                    ? isPink
                      ? "bg-pink-500 hover:bg-pink-600"
                      : "bg-cyan-500 hover:bg-cyan-600"
                    : "bg-gray-500/30 cursor-not-allowed",
                )}
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* Main Actions View */}
        {!showPostponeOptions && !showReasonInput && !showDatePicker && (
          <div className="p-4 space-y-2">
            {/* Complete Button */}
            <button
              type="button"
              onClick={handleCompleteClick}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl transition-all",
                "bg-green-500/20 hover:bg-green-500/30 active:scale-[0.98]",
              )}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-500">
                <CheckIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white font-medium">Complete</p>
                <p className="text-sm text-white/50">Mark as done</p>
              </div>
            </button>

            {/* Postpone Button */}
            <button
              type="button"
              onClick={() => setShowPostponeOptions(true)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl transition-all",
                "bg-white/5 hover:bg-white/10 active:scale-[0.98]",
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isPink ? "bg-pink-500/20" : "bg-cyan-500/20",
                )}
              >
                <ClockIcon
                  className={cn(
                    "w-5 h-5",
                    isPink ? "text-pink-400" : "text-cyan-400",
                  )}
                />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white font-medium">Postpone</p>
                <p className="text-sm text-white/50">Reschedule for later</p>
              </div>
              <ChevronDownIcon className="w-5 h-5 text-white/40 -rotate-90" />
            </button>

            {/* Cancel (This Occurrence) Button */}
            <button
              type="button"
              onClick={handleCancelClick}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl transition-all",
                "bg-white/5 hover:bg-white/10 active:scale-[0.98]",
              )}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-500/20">
                <XIcon className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white font-medium">
                  {isRecurring ? "Skip This Time" : "Cancel"}
                </p>
                <p className="text-sm text-white/50">
                  {isRecurring
                    ? "Mark this occurrence as skipped"
                    : "Cancel this item"}
                </p>
              </div>
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={handleDeleteClick}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl transition-all",
                "bg-red-500/10 hover:bg-red-500/20 active:scale-[0.98]",
              )}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/20">
                <Trash2Icon className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-red-400 font-medium">Delete</p>
                <p className="text-sm text-red-400/60">
                  {isRecurring ? "Remove entire series" : "Remove permanently"}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Safe area padding for iOS */}
        <div className="h-safe-area-inset-bottom" />
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}
