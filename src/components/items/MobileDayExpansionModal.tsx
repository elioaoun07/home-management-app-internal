"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { getBirthdayDisplayName, getBirthdaysForDate } from "@/data/birthdays";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef } from "react";

// Item type colors
const typeColors: Record<string, { bg: string; border: string; text: string }> =
  {
    reminder: {
      bg: "bg-cyan-500/20",
      border: "border-l-cyan-400",
      text: "text-cyan-300",
    },
    event: {
      bg: "bg-pink-500/20",
      border: "border-l-pink-400",
      text: "text-pink-300",
    },
    task: {
      bg: "bg-purple-500/20",
      border: "border-l-purple-400",
      text: "text-purple-300",
    },
  };

// Icons as inline SVGs for mobile performance
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

const CakeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
    <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
    <path d="M2 21h20" />
    <path d="M7 8v2" />
    <path d="M12 8v2" />
    <path d="M17 8v2" />
    <path d="M7 4h.01" />
    <path d="M12 4h.01" />
    <path d="M17 4h.01" />
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

const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
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

interface MobileDayExpansionModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  items: ItemWithDetails[];
  completedItems?: ItemWithDetails[];
  postponedItems?: ItemWithDetails[];
  onItemClick?: (item: ItemWithDetails) => void;
  onBirthdayClick?: (birthday: { name: string; date: Date }) => void;
  onAddEvent?: (date: Date) => void;
  showBirthdays?: boolean;
  anchorRect?: { x: number; y: number; width: number; height: number } | null;
}

export function MobileDayExpansionModal({
  isOpen,
  onClose,
  date,
  items,
  completedItems = [],
  postponedItems = [],
  onItemClick,
  onBirthdayClick,
  onAddEvent,
  showBirthdays = true,
  anchorRect,
}: MobileDayExpansionModalProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Get birthdays for the selected date
  const birthdays = date && showBirthdays ? getBirthdaysForDate(date) : [];

  // Format time for display
  const getItemTime = useCallback((item: ItemWithDetails): string | null => {
    if (item.type === "reminder" && item.reminder_details?.due_at) {
      return format(parseISO(item.reminder_details.due_at), "h:mm a");
    }
    if (item.type === "event" && item.event_details?.start_at) {
      const startTime = format(parseISO(item.event_details.start_at), "h:mm a");
      if (item.event_details.end_at) {
        const endTime = format(parseISO(item.event_details.end_at), "h:mm a");
        return `${startTime} - ${endTime}`;
      }
      return startTime;
    }
    return null;
  }, []);

  if (!date) return null;

  const hasContent =
    items.length > 0 ||
    birthdays.length > 0 ||
    completedItems.length > 0 ||
    postponedItems.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />

          {/* 3D Floating Modal */}
          <motion.div
            ref={modalRef}
            initial={{
              opacity: 0,
              scale: 0.7,
              rotateX: 25,
              y: anchorRect ? anchorRect.y - 200 : 0,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              rotateX: 0,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.7,
              rotateX: -15,
              y: 30,
            }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 350,
              mass: 0.8,
            }}
            style={{
              perspective: "1200px",
              transformStyle: "preserve-3d",
            }}
            className={cn(
              "fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[101]",
              "max-h-[80vh] overflow-hidden",
              "rounded-3xl border-2 shadow-2xl",
              isPink
                ? "border-pink-500/40 shadow-pink-500/30"
                : "border-cyan-500/40 shadow-cyan-500/30",
            )}
          >
            {/* Gradient Background */}
            <div
              className={cn(
                "absolute inset-0",
                isPink
                  ? "bg-gradient-to-br from-slate-900 via-slate-900 to-pink-950/50"
                  : "bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/50",
              )}
            />

            {/* Glow effect */}
            <div
              className={cn(
                "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30",
                isPink ? "bg-pink-500" : "bg-cyan-500",
              )}
            />

            {/* Content */}
            <div className="relative z-10">
              {/* Header */}
              <div
                className={cn(
                  "sticky top-0 z-20 px-5 py-4 border-b backdrop-blur-xl",
                  isPink
                    ? "border-pink-500/20 bg-slate-900/80"
                    : "border-cyan-500/20 bg-slate-900/80",
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <motion.h2
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className={cn(
                        "text-xl font-bold",
                        isPink ? "text-pink-300" : "text-cyan-300",
                      )}
                    >
                      {format(date, "EEEE")}
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-white/60 text-sm"
                    >
                      {format(date, "MMMM d, yyyy")}
                    </motion.p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Add Event Button */}
                    {onAddEvent && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        type="button"
                        onClick={() => {
                          onAddEvent(date);
                          onClose();
                        }}
                        className={cn(
                          "p-2.5 rounded-xl transition-all",
                          isPink
                            ? "bg-pink-500/20 text-pink-300 hover:bg-pink-500/30"
                            : "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30",
                        )}
                      >
                        <PlusIcon className="w-5 h-5" />
                      </motion.button>
                    )}

                    {/* Close Button */}
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      type="button"
                      onClick={onClose}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                    >
                      <XIcon className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto max-h-[calc(80vh-80px)] px-5 py-4">
                {!hasContent ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-center py-12"
                  >
                    <div
                      className={cn(
                        "w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center",
                        isPink ? "bg-pink-500/10" : "bg-cyan-500/10",
                      )}
                    >
                      <span className="text-3xl">📅</span>
                    </div>
                    <p className="text-white/50 text-sm">No events scheduled</p>
                    {onAddEvent && (
                      <button
                        type="button"
                        onClick={() => {
                          onAddEvent(date);
                          onClose();
                        }}
                        className={cn(
                          "mt-4 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                          isPink
                            ? "bg-pink-500/20 text-pink-300 hover:bg-pink-500/30"
                            : "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30",
                        )}
                      >
                        Add an event
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {/* Birthdays Section */}
                    {birthdays.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">
                          🎂 Birthdays
                        </h3>
                        <div className="space-y-2">
                          {birthdays.map((birthday, index) => (
                            <motion.button
                              key={birthday.id}
                              type="button"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 + index * 0.05 }}
                              onClick={() => {
                                if (onBirthdayClick && date) {
                                  onBirthdayClick({
                                    name: getBirthdayDisplayName(
                                      birthday,
                                      date,
                                    ),
                                    date,
                                  });
                                }
                              }}
                              className={cn(
                                "w-full p-3 rounded-xl text-left transition-all",
                                "bg-gradient-to-r from-amber-500/10 to-orange-500/10",
                                "border border-amber-500/20",
                                "hover:from-amber-500/20 hover:to-orange-500/20",
                                "active:scale-[0.98]",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                  <CakeIcon className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                  <p className="font-medium text-amber-200">
                                    {date &&
                                      getBirthdayDisplayName(birthday, date)}
                                  </p>
                                  <p className="text-xs text-amber-400/60">
                                    Birthday 🎉
                                  </p>
                                </div>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Events Section */}
                    {items.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                          Events
                        </h3>
                        <div className="space-y-2">
                          {items.map((item, index) => {
                            const colors =
                              typeColors[item.type] || typeColors.event;
                            const time = getItemTime(item);

                            return (
                              <motion.button
                                key={item.id}
                                type="button"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.15 + index * 0.05 }}
                                onClick={() => onItemClick?.(item)}
                                className={cn(
                                  "w-full p-4 rounded-xl text-left transition-all",
                                  "border-l-4",
                                  colors.bg,
                                  colors.border,
                                  "hover:bg-white/10",
                                  "active:scale-[0.98]",
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={cn(
                                        "font-medium truncate",
                                        colors.text,
                                      )}
                                    >
                                      {item.title}
                                    </p>
                                    {time && (
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <ClockIcon className="w-3.5 h-3.5 text-white/40" />
                                        <span className="text-xs text-white/50">
                                          {time}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div
                                    className={cn(
                                      "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase",
                                      colors.bg,
                                      colors.text,
                                    )}
                                  >
                                    {item.type}
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Completed Section */}
                    {completedItems.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-green-400/80 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <CheckCircleIcon className="w-3.5 h-3.5" />
                          Completed
                        </h3>
                        <div className="space-y-2">
                          {completedItems.map((item, index) => (
                            <motion.button
                              key={item.id}
                              type="button"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 + index * 0.05 }}
                              onClick={() => onItemClick?.(item)}
                              className={cn(
                                "w-full p-3 rounded-xl text-left transition-all",
                                "bg-green-500/10 border border-green-500/20",
                                "hover:bg-green-500/15",
                                "active:scale-[0.98]",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
                                <span className="text-sm text-green-300 line-through opacity-70">
                                  {item.title}
                                </span>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Postponed Section */}
                    {postponedItems.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <FastForwardIcon className="w-3.5 h-3.5" />
                          Postponed
                        </h3>
                        <div className="space-y-2">
                          {postponedItems.map((item, index) => (
                            <motion.button
                              key={item.id}
                              type="button"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.25 + index * 0.05 }}
                              onClick={() => onItemClick?.(item)}
                              className={cn(
                                "w-full p-3 rounded-xl text-left transition-all",
                                "bg-amber-500/10 border border-amber-500/20",
                                "hover:bg-amber-500/15",
                                "active:scale-[0.98]",
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <FastForwardIcon className="w-5 h-5 text-amber-400 flex-shrink-0" />
                                <span className="text-sm text-amber-300">
                                  {item.title}
                                </span>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
