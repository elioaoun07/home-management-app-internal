/**
 * Mobile-First Reminder Entry Component
 * Full-page form for creating reminders and events
 * Matches MobileExpenseForm UI/UX patterns
 */
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MOBILE_CONTENT_BOTTOM_OFFSET } from "@/constants/layout";
import { useCreateEvent, useCreateReminder } from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type {
  CreateEventInput,
  CreateReminderInput,
  ItemPriority,
  ItemStatus,
} from "@/types/items";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, ChevronLeftIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { toast } from "sonner";
import ReminderTagsBarWrapper from "./ReminderTagsBarWrapper";

// ============================================
// ICONS
// ============================================

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

const BellIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const FlagIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" x2="4" y1="22" y2="15" />
  </svg>
);

const TagIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" x2="7.01" y1="7" y2="7" />
  </svg>
);

const ListIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="8" x2="21" y1="6" y2="6" />
    <line x1="8" x2="21" y1="12" y2="12" />
    <line x1="8" x2="21" y1="18" y2="18" />
    <line x1="3" x2="3.01" y1="6" y2="6" />
    <line x1="3" x2="3.01" y1="12" y2="12" />
    <line x1="3" x2="3.01" y1="18" y2="18" />
  </svg>
);

// ============================================
// CATEGORY ICONS (SVG)
// ============================================

const categoryIcons: Record<string, React.FC<{ className?: string }>> = {
  personal: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ),
  home: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  ),
  family: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  ),
  community: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  ),
  friends: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 11.75c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25-.56-1.25-1.25-1.25zm6 0c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25-.56-1.25-1.25-1.25zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-.29.02-.58.05-.86 2.36-1.05 4.23-2.98 5.21-5.37C11.07 8.33 14.05 10 17.42 10c.78 0 1.53-.09 2.25-.26.21.71.33 1.47.33 2.26 0 4.41-3.59 8-8 8z" />
    </svg>
  ),
  work: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
    </svg>
  ),
};

// ============================================
// TYPES
// ============================================

type Step = "title" | "date" | "details";
type ItemType = "reminder" | "event";

// Priority configuration with theme-aware colors
const priorityConfig: Record<
  ItemPriority,
  { label: string; icon: string; gradient: string }
> = {
  low: {
    label: "Low",
    icon: "🔵",
    gradient: "from-gray-500/20 to-gray-600/20",
  },
  normal: {
    label: "Normal",
    icon: "⚪",
    gradient: "from-cyan-500/20 to-blue-500/20",
  },
  high: {
    label: "High",
    icon: "🟠",
    gradient: "from-orange-500/20 to-red-500/20",
  },
  urgent: {
    label: "Urgent",
    icon: "🔴",
    gradient: "from-red-500/30 to-pink-500/30",
  },
};

// Status configuration
const statusConfig: Record<
  ItemStatus,
  { label: string; icon: string; gradient: string }
> = {
  pending: {
    label: "Pending",
    icon: "⏳",
    gradient: "from-cyan-500/20 to-blue-500/20",
  },
  in_progress: {
    label: "In Progress",
    icon: "⚡",
    gradient: "from-amber-500/20 to-orange-500/20",
  },
  completed: {
    label: "Completed",
    icon: "✅",
    gradient: "from-green-500/20 to-emerald-500/20",
  },
  cancelled: {
    label: "Cancelled",
    icon: "❌",
    gradient: "from-gray-500/20 to-slate-500/20",
  },
};

// Hardcoded categories - default for all users
const CATEGORIES = [
  { id: "personal", name: "Personal", color_hex: "#8B5CF6" },
  { id: "home", name: "Home", color_hex: "#1E90FF" },
  { id: "family", name: "Family", color_hex: "#FFA500" },
  { id: "community", name: "Community", color_hex: "#22C55E" },
  { id: "friends", name: "Friends", color_hex: "#EC4899" },
  { id: "work", name: "Work", color_hex: "#FF3B30" },
] as const;

// ============================================
// COMPONENT
// ============================================

export default function MobileReminderForm() {
  const themeClasses = useThemeClasses();
  const createReminder = useCreateReminder();
  const createEvent = useCreateEvent();

  // Form state
  const [step, setStep] = useState<Step>("title");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [priority, setPriority] = useState<ItemPriority>("normal");
  const [status, setStatus] = useState<ItemStatus>("pending");

  // Date fields for auto-detection
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  // Categories (multi-select)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // Date for tags bar calendar
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Auto-detect item type based on filled date fields
  const detectedItemType: ItemType = useMemo(() => {
    // If any event fields are filled, it's an event
    const hasEventFields = !!(startDate || startTime || endDate || endTime);
    // If only due date fields are filled and no event fields, it's a reminder
    const hasOnlyDueFields = !!(dueDate || dueTime) && !hasEventFields;

    if (hasEventFields) return "event";
    if (hasOnlyDueFields) return "reminder";

    // Default to reminder if nothing is filled
    return "reminder";
  }, [dueDate, dueTime, startDate, startTime, endDate, endTime]);

  // Step flow
  const stepFlow: Step[] = ["title", "date", "details"];
  const currentStepIndex = stepFlow.indexOf(step);

  // Progress percentage
  const progress = ((currentStepIndex + 1) / stepFlow.length) * 100;

  // Navigation
  const goBack = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate([5, 5, 5]);
    const prevIndex = Math.max(currentStepIndex - 1, 0);
    setStep(stepFlow[prevIndex]);
  }, [currentStepIndex, stepFlow]);

  const goNext = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(10);
    const nextIndex = Math.min(currentStepIndex + 1, stepFlow.length - 1);
    setStep(stepFlow[nextIndex]);
  }, [currentStepIndex, stepFlow]);

  // Validation
  const isStepValid = useCallback(() => {
    switch (step) {
      case "title":
        return title.trim().length > 0;
      case "date":
        return true; // Optional
      case "details":
        return selectedCategoryIds.length > 0; // At least one category required
      default:
        return true;
    }
  }, [step, title, selectedCategoryIds]);

  // Reset form
  const resetForm = useCallback(() => {
    setStep("title");
    setTitle("");
    setDescription("");
    setIsPrivate(false);
    setPriority("normal");
    setStatus("pending");
    setDueDate("");
    setDueTime("");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setSelectedCategoryIds([]);
  }, []);

  // Toggle category selection
  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []);

  // Submit handler
  const handleSubmit = async () => {
    if (!title.trim()) return;

    try {
      if (detectedItemType === "event") {
        // Create Event
        if (!startDate || !startTime || !endDate || !endTime) {
          toast.error("Event requires start and end date/time");
          return;
        }

        // Convert local date/time to ISO string with timezone
        const startAtIso = new Date(
          `${startDate}T${startTime}:00`
        ).toISOString();
        const endAtIso = new Date(`${endDate}T${endTime}:00`).toISOString();

        const input: CreateEventInput = {
          type: "event",
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          status,
          is_public: !isPrivate,
          start_at: startAtIso,
          end_at: endAtIso,
          category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        };

        await createEvent.mutateAsync(input);
        toast.success("Event created!", {
          icon: ToastIcons.create,
          description: title,
        });
      } else {
        // Create Reminder
        // Convert local date/time to ISO string with timezone
        let dueAtIso: string | undefined;
        if (dueDate && dueTime) {
          // Create a Date object from local date/time - this preserves the local timezone
          const localDate = new Date(`${dueDate}T${dueTime}:00`);
          dueAtIso = localDate.toISOString();
        }

        const input: CreateReminderInput = {
          type: "reminder",
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          status,
          is_public: !isPrivate,
          due_at: dueAtIso,
          category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        };

        await createReminder.mutateAsync(input);
        toast.success("Reminder created!", {
          icon: ToastIcons.create,
          description: title,
        });
      }

      resetForm();
    } catch (error) {
      console.error("Failed to create item:", error);
      toast.error("Failed to create item", { icon: ToastIcons.error });
    }
  };

  const contentAreaStyles: CSSProperties = {
    paddingBottom: `calc(${MOBILE_CONTENT_BOTTOM_OFFSET + 80}px)`,
  };

  // Set default category to "Personal" on mount
  useEffect(() => {
    if (selectedCategoryIds.length === 0) {
      // Personal is always the first in CATEGORIES
      setSelectedCategoryIds(["personal"]);
    }
  }, []); // Only run once on mount

  // Sync selectedDate with date input fields
  useEffect(() => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    // Update the appropriate date field based on detected item type
    if (detectedItemType === "event") {
      if (!startDate) {
        setStartDate(dateStr);
      }
    } else {
      if (!dueDate) {
        setDueDate(dateStr);
      }
    }
  }, [selectedDate]); // Run when selectedDate changes

  const isPending = createReminder.isPending || createEvent.isPending;

  return (
    <>
      <div className="fixed inset-0 top-14 bg-bg-dark flex flex-col">
        {/* HEADER - positioned below main app header (top-14 = 56px) */}
        <div
          className={cn(
            "sticky top-0 z-[50] bg-gradient-to-b from-bg-card-custom to-bg-medium border-b px-3 py-3 shadow-2xl shadow-black/10 backdrop-blur-xl",
            themeClasses.border
          )}
        >
          <div className="flex items-center justify-between mb-2">
            {/* Back Button */}
            {currentStepIndex > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className={cn(
                  "flex items-center gap-1 transition-colors active:scale-95",
                  themeClasses.textSecondary,
                  themeClasses.textHover
                )}
              >
                <ChevronLeftIcon className="w-5 h-5" />
                <span className="text-sm">Back</span>
              </button>
            ) : (
              <div className="w-16" />
            )}

            {/* Title with detected type badge */}
            <div className="flex items-center gap-2">
              <h1
                className={cn("text-lg font-semibold", themeClasses.headerText)}
              >
                New {detectedItemType === "event" ? "Event" : "Reminder"}
              </h1>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={resetForm}
              className={cn(
                "p-1.5 -mr-2 rounded-lg transition-all active:scale-95",
                themeClasses.bgSurface,
                themeClasses.border,
                "hover:bg-opacity-30"
              )}
            >
              <svg
                className={cn("w-5 h-5", themeClasses.text)}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div
            className={cn(
              "h-1 rounded-full overflow-hidden",
              themeClasses.bgSurface
            )}
          >
            <motion.div
              className="h-full neo-gradient"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>
        </div>

        {/* CONTENT */}
        <div
          className="flex-1 overflow-y-auto pt-4 px-4"
          style={contentAreaStyles}
        >
          <AnimatePresence mode="wait">
            {/* STEP 1: TITLE + DESCRIPTION + PRIVATE/PUBLIC */}
            {step === "title" && (
              <motion.div
                key="title"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 step-slide-in"
              >
                <div className="space-y-3">
                  <div>
                    <Label
                      className={cn(
                        "mb-2 block text-sm font-medium",
                        themeClasses.headerText
                      )}
                    >
                      Title *
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g., Team meeting, Call dentist..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={cn(
                        "text-base py-3 neo-card border-0 category-appear",
                        themeClasses.text
                      )}
                      autoFocus
                    />
                  </div>

                  <div>
                    <Label
                      className={cn(
                        "mb-2 block text-sm font-medium",
                        themeClasses.headerText
                      )}
                    >
                      Additional Description
                    </Label>
                    <Textarea
                      placeholder="Add any extra details... (optional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={cn(
                        "text-base py-3 neo-card border-0 category-appear",
                        themeClasses.text
                      )}
                      style={{ animationDelay: "50ms" }}
                    />
                  </div>

                  {/* Private/Public Toggle - Exact match to MobileExpenseForm */}
                  <div
                    className="category-appear flex items-center justify-end px-1 py-2"
                    style={{ animationDelay: "100ms" }}
                  >
                    <button
                      onClick={() => setIsPrivate(!isPrivate)}
                      className={cn(
                        "group relative p-3 rounded-xl border transition-all duration-300 active:scale-95 flex items-center gap-2.5 overflow-hidden",
                        isPrivate
                          ? `${themeClasses.borderActive} bg-gradient-to-br ${themeClasses.activeItemGradient} ${themeClasses.activeItemShadow} hover:shadow-[0_0_25px_rgba(20,184,166,0.35),0_0_50px_rgba(6,182,212,0.2)]`
                          : `neo-card ${themeClasses.border} ${themeClasses.borderHover}`
                      )}
                    >
                      {/* Animated background glow when private */}
                      {isPrivate && (
                        <div
                          className={`absolute inset-0 bg-gradient-to-r ${themeClasses.iconBg} animate-[shimmer_3s_ease-in-out_infinite]`}
                        />
                      )}

                      <span
                        className={cn(
                          "relative text-sm font-semibold tracking-wide transition-all duration-300",
                          isPrivate
                            ? `${themeClasses.textActive} drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]`
                            : `${themeClasses.textFaint} ${themeClasses.textHover}`
                        )}
                      >
                        {isPrivate ? "Private" : "Public"}
                      </span>
                      <svg
                        className={cn(
                          "relative w-5 h-5 transition-all duration-500",
                          isPrivate
                            ? `${themeClasses.textActive} drop-shadow-[0_0_10px_rgba(20,184,166,0.8)] animate-pulse`
                            : `${themeClasses.textFaint} ${themeClasses.textHover}`
                        )}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        {isPrivate ? (
                          // Locked icon
                          <>
                            <rect
                              x="5"
                              y="11"
                              width="14"
                              height="10"
                              rx="2"
                              ry="2"
                            />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </>
                        ) : (
                          // Unlocked icon
                          <>
                            <rect
                              x="5"
                              y="11"
                              width="14"
                              height="10"
                              rx="2"
                              ry="2"
                            />
                            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                <Button
                  onClick={goNext}
                  disabled={!isStepValid()}
                  className="w-full h-11 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 transition-all active:scale-[0.98] spring-bounce mt-2"
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {/* STEP 2: DATE (Reminder or Event) */}
            {step === "date" && (
              <motion.div
                key="date"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 step-slide-in"
              >
                {/* Type Toggle */}
                <div className="flex justify-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Clear event fields when switching to reminder
                      setStartDate("");
                      setStartTime("");
                      setEndDate("");
                      setEndTime("");
                    }}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95",
                      detectedItemType === "reminder"
                        ? "neo-gradient text-white shadow-lg"
                        : `neo-card ${themeClasses.border} ${themeClasses.text} ${themeClasses.borderHover}`
                    )}
                  >
                    ⏰ Reminder
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Clear due fields when switching to event
                      setDueDate("");
                      setDueTime("");
                      // Set default start/end if empty
                      if (!startDate)
                        setStartDate(format(new Date(), "yyyy-MM-dd"));
                      if (!startTime) setStartTime("12:00");
                      if (!endDate)
                        setEndDate(format(new Date(), "yyyy-MM-dd"));
                      if (!endTime) setEndTime("13:00");
                    }}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95",
                      detectedItemType === "event"
                        ? "neo-gradient text-white shadow-lg"
                        : `neo-card ${themeClasses.border} ${themeClasses.text} ${themeClasses.borderHover}`
                    )}
                  >
                    📅 Event
                  </button>
                </div>

                <div className="space-y-3">
                  {detectedItemType === "reminder" ? (
                    /* Reminder Mode: Just Due Date & Time */
                    <div className="neo-card p-4 rounded-xl space-y-3 category-appear">
                      <div className="flex items-center gap-2 mb-2">
                        <BellIcon
                          className={cn("w-4 h-4", themeClasses.text)}
                        />
                        <Label
                          className={cn(
                            "text-sm font-semibold",
                            themeClasses.headerText
                          )}
                        >
                          Due Date & Time
                        </Label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className={cn(
                            "py-3 neo-card border-0",
                            themeClasses.text
                          )}
                        />
                        <Input
                          type="time"
                          value={dueTime}
                          onChange={(e) => setDueTime(e.target.value)}
                          className={cn(
                            "py-3 neo-card border-0",
                            themeClasses.text
                          )}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Event Mode: Start and End Date & Time */
                    <>
                      <div className="neo-card p-4 rounded-xl space-y-3 category-appear">
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarIcon
                            className={cn("w-4 h-4", themeClasses.text)}
                          />
                          <Label
                            className={cn(
                              "text-sm font-semibold",
                              themeClasses.headerText
                            )}
                          >
                            Start Date & Time
                          </Label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className={cn(
                              "py-3 neo-card border-0",
                              themeClasses.text
                            )}
                          />
                          <Input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className={cn(
                              "py-3 neo-card border-0",
                              themeClasses.text
                            )}
                          />
                        </div>
                      </div>

                      <div
                        className="neo-card p-4 rounded-xl space-y-3 category-appear"
                        style={{ animationDelay: "50ms" }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarIcon
                            className={cn("w-4 h-4", themeClasses.text)}
                          />
                          <Label
                            className={cn(
                              "text-sm font-semibold",
                              themeClasses.headerText
                            )}
                          >
                            End Date & Time
                          </Label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className={cn(
                              "py-3 neo-card border-0",
                              themeClasses.text
                            )}
                          />
                          <Input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className={cn(
                              "py-3 neo-card border-0",
                              themeClasses.text
                            )}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <Button
                  onClick={goNext}
                  className="w-full h-11 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 transition-all active:scale-[0.98] spring-bounce mt-2"
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {/* STEP 3: DETAILS (Priority, Categories, Status) - Modern Card Layout */}
            {step === "details" && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5 step-slide-in"
              >
                {/* Priority Selector - Pill Tabs */}
                <div className="space-y-2">
                  <Label
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider px-1",
                      themeClasses.textSecondary
                    )}
                  >
                    Priority
                  </Label>

                  {/* Pill Container */}
                  <div className="relative p-1 rounded-2xl bg-gray-900/60 backdrop-blur-sm border border-white/5">
                    {/* Animated Background Pill */}
                    <motion.div
                      className={cn(
                        "absolute top-1 bottom-1 rounded-xl",
                        priority === "low" &&
                          "bg-gradient-to-r from-gray-600/80 to-gray-500/60",
                        priority === "normal" &&
                          "bg-gradient-to-r from-cyan-600/80 to-cyan-500/60",
                        priority === "high" &&
                          "bg-gradient-to-r from-orange-600/80 to-orange-500/60",
                        priority === "urgent" &&
                          "bg-gradient-to-r from-red-600/80 to-red-500/60"
                      )}
                      initial={false}
                      animate={{
                        left:
                          priority === "low"
                            ? "4px"
                            : priority === "normal"
                              ? "25%"
                              : priority === "high"
                                ? "50%"
                                : "75%",
                        width: "calc(25% - 2px)",
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }}
                      style={{
                        boxShadow:
                          priority === "low"
                            ? "0 0 20px rgba(107, 114, 128, 0.4)"
                            : priority === "normal"
                              ? "0 0 20px rgba(6, 182, 212, 0.4)"
                              : priority === "high"
                                ? "0 0 20px rgba(249, 115, 22, 0.4)"
                                : "0 0 20px rgba(239, 68, 68, 0.4)",
                      }}
                    />

                    {/* Priority Options */}
                    <div className="relative flex">
                      {(Object.keys(priorityConfig) as ItemPriority[]).map(
                        (p) => {
                          const isSelected = priority === p;
                          return (
                            <motion.button
                              key={p}
                              type="button"
                              onClick={() => setPriority(p)}
                              className={cn(
                                "flex-1 py-2.5 px-1 rounded-xl text-xs font-semibold transition-colors relative z-10",
                                isSelected
                                  ? "text-white"
                                  : themeClasses.textMuted
                              )}
                              whileTap={{ scale: 0.95 }}
                            >
                              <motion.span
                                animate={{
                                  opacity: isSelected ? 1 : 0.6,
                                  y: isSelected ? 0 : 1,
                                }}
                                transition={{ duration: 0.15 }}
                              >
                                {priorityConfig[p].label}
                              </motion.span>
                            </motion.button>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>

                {/* Categories - Icon Grid with Animations */}
                <div className="space-y-3">
                  <Label
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider px-1",
                      themeClasses.textSecondary
                    )}
                  >
                    Categories{" "}
                    <span className={themeClasses.textMuted}>
                      {selectedCategoryIds.length > 0
                        ? `(${selectedCategoryIds.length})`
                        : "(Select at least one)"}
                    </span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {CATEGORIES.map((category, idx) => {
                      const isSelected = selectedCategoryIds.includes(
                        category.id
                      );
                      const Icon = categoryIcons[category.id];

                      return (
                        <motion.button
                          key={category.id}
                          type="button"
                          onClick={() => toggleCategory(category.id)}
                          className={cn(
                            "relative py-4 px-2 rounded-2xl text-xs font-medium transition-all overflow-hidden",
                            isSelected
                              ? `shadow-lg`
                              : `neo-card ${themeClasses.border} hover:border-opacity-50`
                          )}
                          style={{
                            background: isSelected
                              ? `linear-gradient(135deg, ${category.color_hex}dd, ${category.color_hex})`
                              : undefined,
                          }}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {/* Animated background pulse */}
                          {isSelected && (
                            <motion.div
                              className="absolute inset-0 rounded-2xl"
                              style={{
                                background: `radial-gradient(circle at center, ${category.color_hex}33, transparent)`,
                              }}
                              animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 0.8, 0.5],
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                            />
                          )}

                          <div className="relative flex flex-col items-center gap-2">
                            {/* Icon */}
                            <motion.div
                              className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center",
                                isSelected
                                  ? "bg-white/20 backdrop-blur-sm text-white"
                                  : themeClasses.bgSurface
                              )}
                              style={{
                                color: !isSelected
                                  ? category.color_hex
                                  : undefined,
                              }}
                              animate={
                                isSelected
                                  ? { rotate: [0, 10, -10, 0] }
                                  : { rotate: 0 }
                              }
                              transition={{ duration: 0.5 }}
                            >
                              <Icon className="w-5 h-5" />
                            </motion.div>

                            {/* Label */}
                            <span
                              className={cn(
                                "text-center leading-tight font-semibold",
                                isSelected ? "text-white" : themeClasses.text
                              )}
                            >
                              {category.name}
                            </span>
                          </div>

                          {/* Check badge */}
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0, rotate: 180 }}
                              className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg"
                            >
                              <CheckIcon className="w-3.5 h-3.5 text-green-600" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Event Status - Toggle Switch Style */}
                {detectedItemType === "event" && (
                  <div className="space-y-3">
                    <Label
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wider px-1",
                        themeClasses.textSecondary
                      )}
                    >
                      Event Status
                    </Label>
                    <div className="relative neo-card rounded-2xl p-1 flex gap-1">
                      {/* Sliding background */}
                      <motion.div
                        className="absolute inset-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg"
                        animate={{
                          x: status === "pending" ? 0 : "100%",
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                        style={{ width: "calc(50% - 4px)" }}
                      />

                      {(["pending", "in_progress"] as ItemStatus[]).map((s) => {
                        const config = statusConfig[s];
                        const isSelected = status === s;
                        const displayLabel =
                          s === "pending" ? "Tentative" : config.label;

                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatus(s)}
                            className={cn(
                              "relative flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 z-10",
                              isSelected ? "text-white" : themeClasses.text
                            )}
                          >
                            <motion.span
                              animate={
                                isSelected ? { rotate: [0, 15, -15, 0] } : {}
                              }
                              transition={{ duration: 0.5 }}
                              className="text-base"
                            >
                              {config.icon}
                            </motion.span>
                            <span>{displayLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={!isStepValid() || isPending}
                  className="w-full h-12 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 transition-all active:scale-[0.98] spring-bounce mt-4"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{
                          repeat: Infinity,
                          duration: 1,
                          ease: "linear",
                        }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Creating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckIcon className="w-5 h-5" />
                      Create{" "}
                      {detectedItemType === "event" ? "Event" : "Reminder"}
                    </span>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tags Bar - Fixed at bottom */}
      <ReminderTagsBarWrapper
        step={step}
        setStep={setStep}
        title={title}
        detectedItemType={detectedItemType}
        selectedCategoryIds={selectedCategoryIds}
        priority={priority}
        dueDate={dueDate}
        dueTime={dueTime}
        startDate={startDate}
        startTime={startTime}
        date={selectedDate}
        setDate={setSelectedDate}
      />
    </>
  );
}
