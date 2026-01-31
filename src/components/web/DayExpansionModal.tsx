"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { getBirthdayDisplayName } from "@/data/birthdays";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Cake,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FastForward,
  MapPin,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

// Item type colors
const typeColors: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    frostBg: string;
    frostBorder: string;
    frostText: string;
  }
> = {
  reminder: {
    bg: "bg-cyan-500/20",
    border: "border-l-cyan-400",
    text: "text-cyan-300",
    frostBg: "bg-indigo-50",
    frostBorder: "border-l-indigo-400",
    frostText: "text-indigo-600",
  },
  event: {
    bg: "bg-pink-500/20",
    border: "border-l-pink-400",
    text: "text-pink-300",
    frostBg: "bg-pink-50",
    frostBorder: "border-l-pink-400",
    frostText: "text-pink-600",
  },
  task: {
    bg: "bg-purple-500/20",
    border: "border-l-purple-400",
    text: "text-purple-300",
    frostBg: "bg-violet-50",
    frostBorder: "border-l-violet-400",
    frostText: "text-violet-600",
  },
};

// Priority badge colors
const priorityColors: Record<
  string,
  { bg: string; text: string; frostBg: string; frostText: string }
> = {
  low: {
    bg: "bg-gray-500/20",
    text: "text-gray-300",
    frostBg: "bg-gray-100",
    frostText: "text-gray-600",
  },
  normal: {
    bg: "bg-cyan-500/20",
    text: "text-cyan-300",
    frostBg: "bg-indigo-100",
    frostText: "text-indigo-600",
  },
  high: {
    bg: "bg-orange-500/20",
    text: "text-orange-300",
    frostBg: "bg-orange-100",
    frostText: "text-orange-600",
  },
  urgent: {
    bg: "bg-red-500/20",
    text: "text-red-300",
    frostBg: "bg-red-100",
    frostText: "text-red-600",
  },
};

interface CompletedItem {
  item: ItemWithDetails;
  occurrenceDate: Date;
  completedAt: Date;
}

interface PostponedItem {
  item: ItemWithDetails;
  occurrenceDate: Date;
  originalDate: Date;
  isPostponed: true;
}

interface Birthday {
  id: string;
  name: string;
  month: number;
  day: number;
  category: "family" | "friends" | "work" | "community";
  year?: number;
}

interface DayExpansionModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  items: ItemWithDetails[];
  completedItems: CompletedItem[];
  postponedItems: PostponedItem[];
  birthdays: Birthday[];
  onItemClick: (
    item: ItemWithDetails,
    event: React.MouseEvent,
    occurrenceDate?: Date,
  ) => void;
  onBirthdayClick?: (
    birthday: { name: string; category?: string },
    date: Date,
  ) => void;
  onAddEvent?: (date: Date) => void;
  getOccurrenceDateTimeForItem: (item: ItemWithDetails, date: Date) => Date;
  anchorRect?: DOMRect | null;
}

export function DayExpansionModal({
  isOpen,
  onClose,
  date,
  items,
  completedItems,
  postponedItems,
  birthdays,
  onItemClick,
  onBirthdayClick,
  onAddEvent,
  getOccurrenceDateTimeForItem,
  anchorRect,
}: DayExpansionModalProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
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

  // Close on click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const hasItems =
    items.length > 0 ||
    birthdays.length > 0 ||
    completedItems.length > 0 ||
    postponedItems.length > 0;

  // Calculate animation origin based on anchor position
  const getOriginPosition = () => {
    if (!anchorRect) return { originX: 0.5, originY: 0.5 };
    const viewportWidth =
      typeof window !== "undefined" ? window.innerWidth : 1920;
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : 1080;

    const centerX = anchorRect.left + anchorRect.width / 2;
    const centerY = anchorRect.top + anchorRect.height / 2;

    return {
      originX: centerX / viewportWidth,
      originY: centerY / viewportHeight,
    };
  };

  const origin = getOriginPosition();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.3 }}
            className={cn(
              "absolute inset-0",
              isFrost ? "bg-slate-900/30" : "bg-black/50",
            )}
          />

          {/* 3D Modal Card */}
          <motion.div
            ref={modalRef}
            initial={{
              opacity: 0,
              scale: 0.5,
              rotateX: 15,
              rotateY: -10,
              y: 50,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              rotateX: 0,
              rotateY: 0,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.8,
              rotateX: 10,
              rotateY: 5,
              y: 30,
            }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
              duration: 0.4,
            }}
            style={{
              transformOrigin: `${origin.originX * 100}% ${origin.originY * 100}%`,
              perspective: "1000px",
              transformStyle: "preserve-3d",
            }}
            className={cn(
              "relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl",
              "border-2",
              isFrost
                ? "bg-white/95 border-indigo-200 shadow-indigo-500/20"
                : "bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 border-white/10",
              // 3D shadow effect
              "before:absolute before:inset-0 before:rounded-2xl before:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] before:pointer-events-none",
            )}
          >
            {/* Decorative glow effect */}
            <div
              className={cn(
                "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none",
                isFrost
                  ? "bg-gradient-to-br from-indigo-400 to-purple-400"
                  : isPink
                    ? "bg-gradient-to-br from-pink-500 to-purple-500"
                    : "bg-gradient-to-br from-cyan-500 to-blue-500",
              )}
            />

            {/* Header */}
            <div
              className={cn(
                "relative px-5 py-4 border-b",
                isFrost
                  ? "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100"
                  : "bg-white/5 border-white/10",
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <motion.h2
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className={cn(
                      "text-xl sm:text-2xl font-bold",
                      isFrost
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"
                        : isPink
                          ? "bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text text-transparent"
                          : "bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent",
                    )}
                  >
                    {format(date, "EEEE")}
                  </motion.h2>
                  <motion.p
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className={cn(
                      "text-sm mt-0.5",
                      isFrost ? "text-slate-500" : "text-white/60",
                    )}
                  >
                    {format(date, "MMMM d, yyyy")}
                  </motion.p>
                </div>

                <div className="flex items-center gap-2">
                  {onAddEvent && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                    >
                      <Button
                        size="sm"
                        onClick={() => {
                          onAddEvent(date);
                          onClose();
                        }}
                        className={cn(
                          "gap-1.5",
                          isFrost
                            ? "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white"
                            : isPink
                              ? "bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                              : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600",
                        )}
                      >
                        <CalendarPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Add</span>
                      </Button>
                    </motion.div>
                  )}

                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.25, type: "spring" }}
                    onClick={onClose}
                    className={cn(
                      "p-2 rounded-full transition-colors",
                      isFrost
                        ? "hover:bg-slate-100 text-slate-500"
                        : "hover:bg-white/10 text-white/60",
                    )}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="relative overflow-y-auto max-h-[60vh] p-4 space-y-3">
              {hasItems ? (
                <>
                  {/* Birthdays */}
                  {birthdays.map((birthday, index) => (
                    <motion.div
                      key={birthday.id}
                      initial={{ opacity: 0, y: 20, rotateX: -10 }}
                      animate={{ opacity: 1, y: 0, rotateX: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBirthdayClick?.(birthday, date);
                        onClose();
                      }}
                      className={cn(
                        "p-4 rounded-xl cursor-pointer relative overflow-hidden",
                        "border-l-4 border-l-amber-400 transition-all duration-200",
                        "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
                        isFrost
                          ? "bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 ring-1 ring-amber-200"
                          : "bg-gradient-to-r from-amber-500/15 to-yellow-500/10 hover:from-amber-500/25 hover:to-yellow-500/15 ring-1 ring-amber-400/30",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-2 rounded-full",
                            isFrost ? "bg-amber-100" : "bg-amber-500/20",
                          )}
                        >
                          <Cake
                            className={cn(
                              "w-5 h-5",
                              isFrost ? "text-amber-600" : "text-amber-300",
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          <h4
                            className={cn(
                              "font-semibold",
                              isFrost ? "text-amber-800" : "text-amber-200",
                            )}
                          >
                            {getBirthdayDisplayName(birthday, date)}
                          </h4>
                          {birthday.category && (
                            <p
                              className={cn(
                                "text-sm capitalize",
                                isFrost
                                  ? "text-amber-600"
                                  : "text-amber-300/70",
                              )}
                            >
                              {birthday.category}
                            </p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "px-2 py-1 rounded-lg text-xs font-medium",
                            isFrost
                              ? "bg-amber-200 text-amber-800"
                              : "bg-amber-500/30 text-amber-200",
                          )}
                        >
                          Birthday
                        </span>
                      </div>
                    </motion.div>
                  ))}

                  {/* Regular Items */}
                  {items.map((item, index) => {
                    const colors = typeColors[item.type] || typeColors.task;
                    const priorityColor =
                      priorityColors[item.priority] || priorityColors.normal;
                    const time =
                      item.type === "event"
                        ? item.event_details?.start_at
                        : item.reminder_details?.due_at;
                    const endTime =
                      item.type === "event" ? item.event_details?.end_at : null;
                    const location =
                      item.type === "event"
                        ? item.event_details?.location_text
                        : null;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20, rotateX: -10 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                        transition={{
                          delay: 0.1 + (birthdays.length + index) * 0.05,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const occurrenceDateTime =
                            getOccurrenceDateTimeForItem(item, date);
                          onItemClick(item, e, occurrenceDateTime);
                        }}
                        className={cn(
                          "p-4 rounded-xl cursor-pointer",
                          "border-l-4 transition-all duration-200",
                          "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
                          isFrost ? colors.frostBorder : colors.border,
                          isFrost
                            ? "bg-slate-50 hover:bg-slate-100"
                            : "bg-white/5 hover:bg-white/10",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4
                              className={cn(
                                "font-semibold",
                                isFrost ? "text-slate-900" : "text-white",
                              )}
                            >
                              {item.title}
                            </h4>

                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              {time && (
                                <div
                                  className={cn(
                                    "flex items-center gap-1 text-sm",
                                    isFrost
                                      ? "text-slate-500"
                                      : "text-white/60",
                                  )}
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>
                                    {format(parseISO(time), "h:mm a")}
                                    {endTime &&
                                      ` - ${format(parseISO(endTime), "h:mm a")}`}
                                  </span>
                                </div>
                              )}

                              {location && (
                                <div
                                  className={cn(
                                    "flex items-center gap-1 text-sm",
                                    isFrost
                                      ? "text-slate-500"
                                      : "text-white/60",
                                  )}
                                >
                                  <MapPin className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[150px]">
                                    {location}
                                  </span>
                                </div>
                              )}
                            </div>

                            {item.description && (
                              <p
                                className={cn(
                                  "text-sm mt-2 line-clamp-2",
                                  isFrost ? "text-slate-400" : "text-white/50",
                                )}
                              >
                                {item.description}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1.5">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-lg text-xs capitalize font-medium",
                                isFrost ? colors.frostBg : colors.bg,
                                isFrost ? colors.frostText : colors.text,
                              )}
                            >
                              {item.type}
                            </span>
                            {item.priority !== "normal" && (
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-lg text-xs capitalize font-medium",
                                  isFrost
                                    ? priorityColor.frostBg
                                    : priorityColor.bg,
                                  isFrost
                                    ? priorityColor.frostText
                                    : priorityColor.text,
                                )}
                              >
                                {item.priority}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Postponed Items */}
                  {postponedItems.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className={cn(
                        "pt-3 mt-3 border-t",
                        isFrost ? "border-slate-200" : "border-white/10",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <FastForward
                          className={cn(
                            "w-4 h-4",
                            isFrost ? "text-amber-600" : "text-amber-400",
                          )}
                        />
                        <h4
                          className={cn(
                            "text-sm font-medium",
                            isFrost ? "text-amber-700" : "text-amber-400",
                          )}
                        >
                          Postponed to this day
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {postponedItems.map((postponed, index) => (
                          <motion.div
                            key={`postponed-${postponed.item.id}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.35 + index * 0.05 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onItemClick(
                                postponed.item,
                                e,
                                postponed.occurrenceDate,
                              );
                            }}
                            className={cn(
                              "p-3 rounded-xl cursor-pointer",
                              "border-2 transition-all duration-200",
                              "hover:scale-[1.02] active:scale-[0.98]",
                              isFrost
                                ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
                                : "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <FastForward
                                className={cn(
                                  "w-4 h-4",
                                  isFrost ? "text-amber-600" : "text-amber-400",
                                )}
                              />
                              <div className="flex-1">
                                <h4
                                  className={cn(
                                    "font-medium",
                                    isFrost
                                      ? "text-amber-800"
                                      : "text-amber-300",
                                  )}
                                >
                                  {postponed.item.title}
                                </h4>
                                <p
                                  className={cn(
                                    "text-xs",
                                    isFrost
                                      ? "text-amber-600"
                                      : "text-amber-300/60",
                                  )}
                                >
                                  from {format(postponed.originalDate, "MMM d")}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Completed Items */}
                  {completedItems.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className={cn(
                        "pt-3 mt-3 border-t",
                        isFrost ? "border-slate-200" : "border-white/10",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2
                          className={cn(
                            "w-4 h-4",
                            isFrost ? "text-green-600" : "text-green-400",
                          )}
                        />
                        <h4
                          className={cn(
                            "text-sm font-medium",
                            isFrost ? "text-green-700" : "text-green-400",
                          )}
                        >
                          Completed
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {completedItems.map((completed, index) => (
                          <motion.div
                            key={`completed-${completed.item.id}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.45 + index * 0.05 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onItemClick(
                                completed.item,
                                e,
                                completed.occurrenceDate,
                              );
                            }}
                            className={cn(
                              "p-3 rounded-xl cursor-pointer opacity-70",
                              "border-2 transition-all duration-200",
                              "hover:scale-[1.02] active:scale-[0.98]",
                              isFrost
                                ? "border-green-200 bg-green-50 hover:bg-green-100"
                                : "border-green-500/30 bg-green-500/10 hover:bg-green-500/15",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <CheckCircle2
                                className={cn(
                                  "w-4 h-4",
                                  isFrost ? "text-green-600" : "text-green-400",
                                )}
                              />
                              <div className="flex-1">
                                <h4
                                  className={cn(
                                    "font-medium line-through",
                                    isFrost
                                      ? "text-green-700"
                                      : "text-green-300",
                                  )}
                                >
                                  {completed.item.title}
                                </h4>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-center py-12"
                >
                  <div
                    className={cn(
                      "w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center",
                      isFrost ? "bg-slate-100" : "bg-white/5",
                    )}
                  >
                    <CalendarPlus
                      className={cn(
                        "w-8 h-8",
                        isFrost ? "text-slate-300" : "text-white/20",
                      )}
                    />
                  </div>
                  <p
                    className={cn(
                      "text-base font-medium mb-1",
                      isFrost ? "text-slate-500" : "text-white/50",
                    )}
                  >
                    No events scheduled
                  </p>
                  <p
                    className={cn(
                      "text-sm",
                      isFrost ? "text-slate-400" : "text-white/30",
                    )}
                  >
                    Tap the add button to create an event
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
