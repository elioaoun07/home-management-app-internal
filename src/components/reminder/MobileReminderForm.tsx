/**
 * Mobile-First Reminder Entry Component
 * Streamlined single-page form with smart text parsing
 * Quick entry via natural language input
 */
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOBILE_CONTENT_BOTTOM_OFFSET } from "@/constants/layout";
import {
  useCreateEvent,
  useCreateReminder,
  useCreateTask,
} from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  getDateDescription,
  getRecurrenceDescription,
  getTimeDescription,
  parseSmartText,
  type ParsedItem,
} from "@/lib/smartTextParser";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type {
  CreateEventInput,
  CreateRecurrenceInput,
  CreateReminderInput,
  CreateTaskInput,
  ItemPriority,
  ItemStatus,
  ItemType,
} from "@/types/items";
import { format, parse } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, SparklesIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { toast } from "sonner";

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

const RepeatIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
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

const MicIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
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
// Using ItemType from @/types/items which includes "reminder" | "event" | "task"

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
  archived: {
    label: "Archived",
    icon: "📦",
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
  const createTask = useCreateTask();
  const inputRef = useRef<HTMLInputElement>(null);

  // Smart text input state
  const [smartInput, setSmartInput] = useState("");
  const [parsedItem, setParsedItem] = useState<ParsedItem | null>(null);

  // Track manual overrides - when user manually changes a field, don't let parsing overwrite it
  const [manualOverrides, setManualOverrides] = useState<{
    type: boolean;
    priority: boolean;
    categories: boolean;
  }>({ type: false, priority: false, categories: false });

  // Form state (can be overridden manually after parsing)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [priority, setPriority] = useState<ItemPriority>("normal");
  const [status, setStatus] = useState<ItemStatus>("pending");
  const [itemType, setItemType] = useState<ItemType>("reminder");

  // Date fields
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  // Categories (multi-select, defaults to personal)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([
    "personal",
  ]);

  // Recurrence state
  const [recurrenceRule, setRecurrenceRule] = useState("");

  // Missing fields modal state
  const [showMissingFieldsModal, setShowMissingFieldsModal] = useState(false);
  const [missingFieldType, setMissingFieldType] = useState<
    "event" | "reminder" | "task" | null
  >(null);
  const [editingDateField, setEditingDateField] = useState<string | null>(null);

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join("");
          setSmartInput(transcript);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
          if (event.error === "not-allowed") {
            toast.error("Microphone access denied", {
              icon: ToastIcons.error,
              description: "Please allow microphone access to use voice input",
            });
          }
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Toggle voice input
  const toggleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error("Voice input not supported", {
        icon: ToastIcons.error,
        description: "Your browser doesn't support speech recognition",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  // Helper to format date for display
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "Select date";
    try {
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      return format(date, "d MMM, yyyy");
    } catch {
      return dateStr;
    }
  };

  // Helper to format time for display
  const formatTimeDisplay = (timeStr: string) => {
    if (!timeStr) return "Select time";
    try {
      const [hours, minutes] = timeStr.split(":");
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return format(date, "h:mm a");
    } catch {
      return timeStr;
    }
  };

  // Parse smart input on change (debounced effect)
  useEffect(() => {
    if (!smartInput.trim()) {
      setParsedItem(null);
      return;
    }

    // Parse after a brief delay to avoid parsing on every keystroke
    const timer = setTimeout(() => {
      const parsed = parseSmartText(smartInput);
      setParsedItem(parsed);

      // Update form fields based on parsed data, respecting manual overrides
      setTitle(parsed.title);

      // Only update type if user hasn't manually changed it
      if (!manualOverrides.type) {
        setItemType(parsed.type);
      }

      // Only update priority if user hasn't manually changed it
      if (!manualOverrides.priority) {
        setPriority(parsed.priority);
      }

      // Add detected categories to existing ones (additive, not replacing)
      if (
        !manualOverrides.categories &&
        parsed.categoryIds &&
        parsed.categoryIds.length > 0
      ) {
        setSelectedCategoryIds((prev) => {
          const combined = new Set([...prev, ...parsed.categoryIds!]);
          return Array.from(combined);
        });
      }

      if (parsed.recurrenceRule) {
        setRecurrenceRule(parsed.recurrenceRule);
      }

      if (parsed.type === "event" && !manualOverrides.type) {
        if (parsed.startDate) setStartDate(parsed.startDate);
        if (parsed.startTime) setStartTime(parsed.startTime);
        if (parsed.endDate) setEndDate(parsed.endDate);
        if (parsed.endTime) setEndTime(parsed.endTime);
      } else if (!manualOverrides.type) {
        if (parsed.dueDate) setDueDate(parsed.dueDate);
        if (parsed.dueTime) setDueTime(parsed.dueTime);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [smartInput, manualOverrides]);

  // Reset form
  const resetForm = useCallback(() => {
    setSmartInput("");
    setParsedItem(null);
    setTitle("");
    setDescription("");
    setIsPrivate(false);
    setPriority("normal");
    setStatus("pending");
    setItemType("reminder");
    setDueDate("");
    setDueTime("");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setSelectedCategoryIds(["personal"]);
    setRecurrenceRule("");
    setManualOverrides({ type: false, priority: false, categories: false });
  }, []);

  // Submit handler
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter what you want to remember", {
        icon: ToastIcons.error,
      });
      inputRef.current?.focus();
      return;
    }

    try {
      if (itemType === "event") {
        // Set defaults if missing
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formatDate = (d: Date) => d.toISOString().split("T")[0];
        const formatTime = (d: Date) => d.toTimeString().slice(0, 5);

        const defaultStartDate = startDate || formatDate(today);
        const defaultStartTime = startTime || formatTime(today);
        const defaultEndDate = endDate || formatDate(tomorrow);
        const defaultEndTime = endTime || formatTime(today);

        // Check for missing event fields
        if (!startDate || !startTime || !endDate || !endTime) {
          setStartDate(defaultStartDate);
          setStartTime(defaultStartTime);
          setEndDate(defaultEndDate);
          setEndTime(defaultEndTime);

          setMissingFieldType("event");
          setShowMissingFieldsModal(true);
          return;
        }

        // Create Event
        const startAtIso = new Date(
          `${startDate}T${startTime}:00`,
        ).toISOString();
        const endAtIso = new Date(`${endDate}T${endTime}:00`).toISOString();

        let recurrence_rule: CreateRecurrenceInput | undefined;
        if (recurrenceRule) {
          recurrence_rule = {
            rrule: recurrenceRule,
            start_anchor: startAtIso,
          };
        }

        const input: CreateEventInput = {
          type: "event",
          title: title.trim(),
          description: smartInput.trim() || undefined, // Original input as description
          priority,
          status,
          is_public: !isPrivate,
          start_at: startAtIso,
          end_at: endAtIso,
          category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          recurrence_rule,
        };

        await createEvent.mutateAsync(input);
        toast.success("Event created!", {
          icon: ToastIcons.create,
          description: title,
        });
      } else if (itemType === "task") {
        // Set defaults if missing
        const today = new Date();
        const formatDate = (d: Date) => d.toISOString().split("T")[0];
        const formatTime = (d: Date) => d.toTimeString().slice(0, 5);

        const defaultDueDate = dueDate || formatDate(today);
        const defaultDueTime = dueTime || formatTime(today);

        // Check for missing task fields - always prompt if no date/time set
        if (!dueDate || !dueTime) {
          setDueDate(defaultDueDate);
          setDueTime(defaultDueTime);

          setMissingFieldType("task");
          setShowMissingFieldsModal(true);
          return;
        }

        // Create Task
        let dueAtIso: string | undefined;
        if (dueDate && dueTime) {
          dueAtIso = new Date(`${dueDate}T${dueTime}:00`).toISOString();
        } else if (dueDate) {
          dueAtIso = new Date(`${dueDate}T12:00:00`).toISOString();
        }

        let recurrence_rule: CreateRecurrenceInput | undefined;
        if (recurrenceRule && dueAtIso) {
          recurrence_rule = {
            rrule: recurrenceRule,
            start_anchor: dueAtIso,
          };
        }

        const input: CreateTaskInput = {
          type: "task",
          title: title.trim(),
          description: smartInput.trim() || undefined,
          priority,
          is_public: !isPrivate,
          due_at: dueAtIso,
          category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          recurrence_rule,
        };

        await createTask.mutateAsync(input);
        toast.success("Task created!", {
          icon: ToastIcons.create,
          description: title,
        });
      } else {
        // Set defaults if missing
        const today = new Date();
        const formatDate = (d: Date) => d.toISOString().split("T")[0];
        const formatTime = (d: Date) => d.toTimeString().slice(0, 5);

        const defaultDueDate = dueDate || formatDate(today);
        const defaultDueTime = dueTime || formatTime(today);

        // Check for missing reminder fields - always prompt if no date/time set
        if (!dueDate || !dueTime) {
          setDueDate(defaultDueDate);
          setDueTime(defaultDueTime);

          setMissingFieldType("reminder");
          setShowMissingFieldsModal(true);
          return;
        }

        // Create Reminder
        let dueAtIso: string | undefined;
        if (dueDate && dueTime) {
          dueAtIso = new Date(`${dueDate}T${dueTime}:00`).toISOString();
        } else if (dueDate) {
          dueAtIso = new Date(`${dueDate}T12:00:00`).toISOString();
        }

        let recurrence_rule: CreateRecurrenceInput | undefined;
        if (recurrenceRule && dueAtIso) {
          recurrence_rule = {
            rrule: recurrenceRule,
            start_anchor: dueAtIso,
          };
        }

        const input: CreateReminderInput = {
          type: "reminder",
          title: title.trim(),
          description: smartInput.trim() || undefined,
          priority,
          status,
          is_public: !isPrivate,
          due_at: dueAtIso,
          category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          recurrence_rule,
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

  const isPending =
    createReminder.isPending || createEvent.isPending || createTask.isPending;

  // Get parsed info display
  const getParsedInfoChips = () => {
    if (!parsedItem) return null;

    const chips: { label: string; color: string; confidence: number }[] = [];

    // Type chip
    const typeLabel =
      parsedItem.type === "event"
        ? "📅 Event"
        : parsedItem.type === "task"
          ? "✅ Task"
          : "⏰ Reminder";
    chips.push({
      label: typeLabel,
      color: "from-cyan-500/30 to-blue-500/30",
      confidence: parsedItem.confidence.type,
    });

    // Date chip
    if (parsedItem.dueDate || parsedItem.startDate) {
      const dateStr = parsedItem.dueDate || parsedItem.startDate || "";
      const dateLabel = getDateDescription(dateStr);
      if (dateLabel) {
        chips.push({
          label: `📆 ${dateLabel}`,
          color: "from-violet-500/30 to-purple-500/30",
          confidence: parsedItem.confidence.date,
        });
      }
    }

    // Time chip
    if (parsedItem.dueTime || parsedItem.startTime) {
      const timeStr = parsedItem.dueTime || parsedItem.startTime || "";
      const timeLabel = getTimeDescription(timeStr);
      if (timeLabel) {
        chips.push({
          label: `🕐 ${timeLabel}`,
          color: "from-amber-500/30 to-orange-500/30",
          confidence: parsedItem.confidence.time,
        });
      }
    }

    // Recurrence chip
    if (parsedItem.recurrenceRule) {
      const recurrenceLabel = getRecurrenceDescription(
        parsedItem.recurrenceRule,
      );
      chips.push({
        label: `🔄 ${recurrenceLabel}`,
        color: "from-green-500/30 to-emerald-500/30",
        confidence: parsedItem.confidence.recurrence,
      });
    }

    // Priority chip (only if not normal)
    if (parsedItem.priority !== "normal") {
      const prioLabel = priorityConfig[parsedItem.priority].label;
      const prioIcon =
        parsedItem.priority === "urgent"
          ? "🔴"
          : parsedItem.priority === "high"
            ? "🟠"
            : "🔵";
      chips.push({
        label: `${prioIcon} ${prioLabel}`,
        color: "from-red-500/30 to-pink-500/30",
        confidence: parsedItem.confidence.priority,
      });
    }

    return chips;
  };

  const parsedChips = getParsedInfoChips();

  return (
    <>
      <div className="fixed inset-0 top-14 bg-bg-dark flex flex-col">
        {/* HEADER */}
        <div
          className={cn(
            "sticky top-0 z-[50] bg-gradient-to-b from-bg-card-custom to-bg-medium border-b px-3 py-3 shadow-2xl shadow-black/10 backdrop-blur-xl",
            themeClasses.border,
          )}
        >
          <div className="flex items-center justify-between">
            <div className="w-8" />

            {/* Title with AI indicator */}
            <div className="flex items-center gap-2">
              <SparklesIcon
                className={cn("w-4 h-4", themeClasses.textActive)}
              />
              <h1
                className={cn("text-lg font-semibold", themeClasses.headerText)}
              >
                Quick Entry
              </h1>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={resetForm}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-95",
                themeClasses.bgSurface,
                themeClasses.border,
                "hover:bg-opacity-30",
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
        </div>

        {/* CONTENT - Single Page */}
        <div
          className="flex-1 overflow-y-auto pt-4 px-4"
          style={contentAreaStyles}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* SMART TEXT INPUT */}
            <div className="space-y-2">
              <Label
                className={cn(
                  "mb-1 block text-sm font-medium",
                  themeClasses.headerText,
                )}
              >
                What do you want to remember?
              </Label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder='e.g., "Remind me to call Thomas tomorrow at 6 pm"'
                    value={smartInput}
                    onChange={(e) => setSmartInput(e.target.value)}
                    className={cn(
                      "text-base py-4 pl-4 pr-10 neo-card border-0 w-full",
                      themeClasses.text,
                      isListening && "ring-2 ring-red-500/50",
                    )}
                    autoFocus
                  />
                  {smartInput && !isListening && (
                    <SparklesIcon
                      className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-pulse",
                        themeClasses.textActive,
                      )}
                    />
                  )}
                  {isListening && (
                    <motion.div
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    >
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                    </motion.div>
                  )}
                </div>
                {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={cn(
                    "flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl transition-all active:scale-95",
                    isListening
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                      : `neo-card ${themeClasses.border} ${themeClasses.text} hover:bg-opacity-80`,
                  )}
                >
                  <MicIcon
                    className={cn("w-5 h-5", isListening && "animate-pulse")}
                  />
                </button>
              </div>

              {/* Parsed Info Chips */}
              <AnimatePresence>
                {parsedChips && parsedChips.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-wrap gap-1.5 pt-1"
                  >
                    {parsedChips.map((chip, idx) => (
                      <motion.span
                        key={chip.label}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r",
                          chip.color,
                          themeClasses.text,
                        )}
                      >
                        {chip.label}
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Extracted Title Preview */}
              {parsedItem && title && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn("text-sm px-1", themeClasses.textSecondary)}
                >
                  <span className="font-medium">Title:</span> {title}
                </motion.div>
              )}

              {/* Date Display - Clickable to open modal */}
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const formatDateStr = (d: Date) =>
                    d.toISOString().split("T")[0];
                  const formatTimeStr = (d: Date) =>
                    d.toTimeString().slice(0, 5);

                  if (itemType === "event") {
                    if (!startDate) setStartDate(formatDateStr(today));
                    if (!startTime) setStartTime(formatTimeStr(today));
                    if (!endDate) setEndDate(formatDateStr(tomorrow));
                    if (!endTime) setEndTime(formatTimeStr(today));
                    setMissingFieldType("event");
                  } else if (itemType === "task") {
                    if (!dueDate) setDueDate(formatDateStr(today));
                    if (!dueTime) setDueTime(formatTimeStr(today));
                    setMissingFieldType("task");
                  } else {
                    if (!dueDate) setDueDate(formatDateStr(today));
                    if (!dueTime) setDueTime(formatTimeStr(today));
                    setMissingFieldType("reminder");
                  }
                  setShowMissingFieldsModal(true);
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98]",
                  "neo-card",
                  themeClasses.border,
                  themeClasses.text,
                )}
              >
                <CalendarIcon className="w-4 h-4 text-purple" />
                <span className={themeClasses.textMuted}>Date:</span>
                <span className="font-semibold text-purple">
                  {itemType === "event" ? (
                    startDate && endDate ? (
                      <>
                        {formatDateDisplay(startDate)}
                        {startTime && ` ${formatTimeDisplay(startTime)}`}
                        <span className={themeClasses.textMuted}> → </span>
                        {formatDateDisplay(endDate)}
                        {endTime && ` ${formatTimeDisplay(endTime)}`}
                      </>
                    ) : (
                      "Tap to set date & time"
                    )
                  ) : dueDate ? (
                    <>
                      {formatDateDisplay(dueDate)}
                      {dueTime && ` ${formatTimeDisplay(dueTime)}`}
                    </>
                  ) : (
                    "Tap to set date & time"
                  )}
                </span>
              </button>
            </div>

            {/* DIVIDER */}
            <div className="flex items-center gap-3 py-1">
              <div className={cn("flex-1 h-px", themeClasses.bgSurface)} />
              <span
                className={cn("text-xs font-medium", themeClasses.textMuted)}
              >
                Quick Options
              </span>
              <div className={cn("flex-1 h-px", themeClasses.bgSurface)} />
            </div>

            {/* TYPE SELECTOR */}
            <div className="space-y-2">
              <Label
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider px-1",
                  themeClasses.textSecondary,
                )}
              >
                Type
              </Label>
              <div className="flex gap-2">
                {[
                  {
                    type: "reminder" as ItemType,
                    icon: "⏰",
                    label: "Reminder",
                  },
                  { type: "event" as ItemType, icon: "📅", label: "Event" },
                  { type: "task" as ItemType, icon: "✅", label: "Task" },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setItemType(item.type);
                      setManualOverrides((prev) => ({ ...prev, type: true }));
                    }}
                    className={cn(
                      "flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all active:scale-95",
                      itemType === item.type
                        ? "neo-gradient text-white shadow-lg"
                        : `neo-card ${themeClasses.border} ${themeClasses.text} ${themeClasses.borderHover}`,
                    )}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PRIORITY SELECTOR - Pill Tabs */}
            <div className="space-y-2">
              <Label
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider px-1",
                  themeClasses.textSecondary,
                )}
              >
                Priority
              </Label>
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
                      "bg-gradient-to-r from-red-600/80 to-red-500/60",
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
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
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
                  {(Object.keys(priorityConfig) as ItemPriority[]).map((p) => {
                    const isSelected = priority === p;
                    return (
                      <motion.button
                        key={p}
                        type="button"
                        onClick={() => {
                          setPriority(p);
                          setManualOverrides((prev) => ({
                            ...prev,
                            priority: true,
                          }));
                        }}
                        className={cn(
                          "flex-1 py-2.5 px-1 rounded-xl text-xs font-semibold transition-colors relative z-10",
                          isSelected ? "text-white" : themeClasses.textMuted,
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
                  })}
                </div>
              </div>
            </div>

            {/* CATEGORY SELECTOR - Icon Grid */}
            <div className="space-y-2">
              <Label
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider px-1",
                  themeClasses.textSecondary,
                )}
              >
                Categories{" "}
                <span className={themeClasses.textMuted}>
                  {selectedCategoryIds.length > 0
                    ? `(${selectedCategoryIds.length})`
                    : "(Select at least one)"}
                </span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((category, idx) => {
                  const isSelected = selectedCategoryIds.includes(category.id);
                  const Icon = categoryIcons[category.id];

                  return (
                    <motion.button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryIds((prev) =>
                          prev.includes(category.id)
                            ? prev.filter((id) => id !== category.id)
                            : [...prev, category.id],
                        );
                        setManualOverrides((prev) => ({
                          ...prev,
                          categories: true,
                        }));
                      }}
                      className={cn(
                        "relative py-3 px-2 rounded-xl text-xs font-medium transition-all overflow-hidden",
                        isSelected
                          ? "shadow-lg"
                          : `neo-card ${themeClasses.border} hover:border-opacity-50`,
                      )}
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg, ${category.color_hex}dd, ${category.color_hex})`
                          : undefined,
                      }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* Animated background pulse */}
                      {isSelected && (
                        <motion.div
                          className="absolute inset-0 rounded-xl"
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

                      <div className="relative flex flex-col items-center gap-1.5">
                        {/* Icon */}
                        <motion.div
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center",
                            isSelected
                              ? "bg-white/20 backdrop-blur-sm text-white"
                              : themeClasses.bgSurface,
                          )}
                          style={{
                            color: !isSelected ? category.color_hex : undefined,
                          }}
                        >
                          <Icon className="w-4 h-4" />
                        </motion.div>

                        {/* Label */}
                        <span
                          className={cn(
                            "text-center leading-tight font-semibold text-[10px]",
                            isSelected ? "text-white" : themeClasses.text,
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
                          className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-lg"
                        >
                          <CheckIcon className="w-3 h-3 text-green-600" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Private/Public Toggle */}
            <div className="flex items-center justify-end px-1">
              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className={cn(
                  "group relative p-2.5 rounded-xl border transition-all duration-300 active:scale-95 flex items-center gap-2 overflow-hidden",
                  isPrivate
                    ? `${themeClasses.borderActive} bg-gradient-to-br ${themeClasses.activeItemGradient} ${themeClasses.activeItemShadow}`
                    : `neo-card ${themeClasses.border} ${themeClasses.borderHover}`,
                )}
              >
                <span
                  className={cn(
                    "relative text-xs font-semibold tracking-wide transition-all duration-300",
                    isPrivate
                      ? `${themeClasses.textActive} drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]`
                      : `${themeClasses.textFaint} ${themeClasses.textHover}`,
                  )}
                >
                  {isPrivate ? "Private" : "Public"}
                </span>
                <svg
                  className={cn(
                    "relative w-4 h-4 transition-all duration-500",
                    isPrivate
                      ? `${themeClasses.textActive} drop-shadow-[0_0_10px_rgba(20,184,166,0.8)]`
                      : `${themeClasses.textFaint} ${themeClasses.textHover}`,
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  {isPrivate ? (
                    <>
                      <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </>
                  ) : (
                    <>
                      <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            {/* CREATE BUTTON */}
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || isPending}
              className="w-full h-12 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 transition-all active:scale-[0.98] spring-bounce mt-2"
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
                  {itemType === "event"
                    ? "Event"
                    : itemType === "task"
                      ? "Task"
                      : "Reminder"}
                </span>
              )}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Missing Fields Modal */}
      <AnimatePresence>
        {showMissingFieldsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 px-4"
            onClick={() => setShowMissingFieldsModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-full max-w-md rounded-2xl p-6 space-y-4 border",
                "bg-[#0a1628] border-cyan-500/30",
              )}
            >
              {/* Header */}
              <div className="space-y-1">
                <h3
                  className={cn("text-lg font-bold", themeClasses.headerText)}
                >
                  📅 Complete Date & Time
                </h3>
                <p className={cn("text-sm", themeClasses.textSecondary)}>
                  {missingFieldType === "event"
                    ? "Please set the start and end date/time for your event"
                    : "Please set the date and time for your item"}
                </p>
              </div>

              {/* Date/Time Inputs */}
              <div className="space-y-3">
                {missingFieldType === "event" ? (
                  <>
                    {/* Start Date & Time */}
                    <div className="bg-[#0d1f35] border border-cyan-500/20 p-4 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarIcon className="w-4 h-4 text-cyan-400" />
                        <Label className="text-sm font-semibold text-cyan-300">
                          Start Date & Time
                        </Label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Start Date */}
                        <div className="relative">
                          {editingDateField === "startDate" ? (
                            <Input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              onBlur={() => setEditingDateField(null)}
                              autoFocus
                              className="py-3 h-11 bg-[#0a1628] border border-cyan-500/30 text-cyan-100 [color-scheme:dark]"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingDateField("startDate")}
                              className="w-full py-3 h-11 px-3 bg-[#0a1628] border border-cyan-500/20 rounded-md text-left text-cyan-100 hover:border-cyan-500/40 transition-colors text-sm"
                            >
                              {formatDateDisplay(startDate)}
                            </button>
                          )}
                        </div>
                        {/* Start Time */}
                        <div className="relative">
                          {editingDateField === "startTime" ? (
                            <Input
                              type="time"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              onBlur={() => setEditingDateField(null)}
                              autoFocus
                              className="py-3 h-11 bg-[#0a1628] border border-cyan-500/30 text-cyan-100 [color-scheme:dark]"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingDateField("startTime")}
                              className="w-full py-3 h-11 px-3 bg-[#0a1628] border border-cyan-500/20 rounded-md text-left text-cyan-100 hover:border-cyan-500/40 transition-colors text-sm"
                            >
                              {formatTimeDisplay(startTime)}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* End Date & Time */}
                    <div className="bg-[#0d1f35] border border-cyan-500/20 p-4 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarIcon className="w-4 h-4 text-cyan-400" />
                        <Label className="text-sm font-semibold text-cyan-300">
                          End Date & Time
                        </Label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* End Date */}
                        <div className="relative">
                          {editingDateField === "endDate" ? (
                            <Input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              onBlur={() => setEditingDateField(null)}
                              autoFocus
                              className="py-3 h-11 bg-[#0a1628] border border-cyan-500/30 text-cyan-100 [color-scheme:dark]"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingDateField("endDate")}
                              className="w-full py-3 h-11 px-3 bg-[#0a1628] border border-cyan-500/20 rounded-md text-left text-cyan-100 hover:border-cyan-500/40 transition-colors text-sm"
                            >
                              {formatDateDisplay(endDate)}
                            </button>
                          )}
                        </div>
                        {/* End Time */}
                        <div className="relative">
                          {editingDateField === "endTime" ? (
                            <Input
                              type="time"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              onBlur={() => setEditingDateField(null)}
                              autoFocus
                              className="py-3 h-11 bg-[#0a1628] border border-cyan-500/30 text-cyan-100 [color-scheme:dark]"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingDateField("endTime")}
                              className="w-full py-3 h-11 px-3 bg-[#0a1628] border border-cyan-500/20 rounded-md text-left text-cyan-100 hover:border-cyan-500/40 transition-colors text-sm"
                            >
                              {formatTimeDisplay(endTime)}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Reminder/Task Date & Time */
                  <div className="bg-[#0d1f35] border border-cyan-500/20 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <BellIcon className="w-4 h-4 text-cyan-400" />
                      <Label className="text-sm font-semibold text-cyan-300">
                        Due Date & Time
                      </Label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Due Date */}
                      <div className="relative">
                        {editingDateField === "dueDate" ? (
                          <Input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            onBlur={() => setEditingDateField(null)}
                            autoFocus
                            className="py-3 h-11 bg-[#0a1628] border border-cyan-500/30 text-cyan-100 [color-scheme:dark]"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingDateField("dueDate")}
                            className="w-full py-3 h-11 px-3 bg-[#0a1628] border border-cyan-500/20 rounded-md text-left text-cyan-100 hover:border-cyan-500/40 transition-colors text-sm"
                          >
                            {formatDateDisplay(dueDate)}
                          </button>
                        )}
                      </div>
                      {/* Due Time */}
                      <div className="relative">
                        {editingDateField === "dueTime" ? (
                          <Input
                            type="time"
                            value={dueTime}
                            onChange={(e) => setDueTime(e.target.value)}
                            onBlur={() => setEditingDateField(null)}
                            autoFocus
                            className="py-3 h-11 bg-[#0a1628] border border-cyan-500/30 text-cyan-100 [color-scheme:dark]"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingDateField("dueTime")}
                            className="w-full py-3 h-11 px-3 bg-[#0a1628] border border-cyan-500/20 rounded-md text-left text-cyan-100 hover:border-cyan-500/40 transition-colors text-sm"
                          >
                            {formatTimeDisplay(dueTime)}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setShowMissingFieldsModal(false)}
                  variant="outline"
                  className="flex-1 h-11"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowMissingFieldsModal(false);
                    // Retry submit after fields are filled
                    setTimeout(() => handleSubmit(), 100);
                  }}
                  disabled={
                    missingFieldType === "event"
                      ? !startDate || !startTime || !endDate || !endTime
                      : !dueDate || !dueTime
                  }
                  className="flex-1 h-11 neo-gradient text-white border-0 shadow-lg"
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
