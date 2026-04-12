/**
 * Mobile-First Reminder/Event/Task Entry Component
 * Streamlined single-page form with smart text parsing
 * Quick entry via natural language input
 *
 * Features: type/priority/categories, dates, repeat/recurrence,
 * SmartAlertPicker, location, responsible user, trigger conditions,
 * description, voice input
 */
"use client";

import {
  CustomRecurrencePicker,
  describeRRule,
} from "@/components/items/CustomRecurrencePicker";
import { PrerequisitePicker } from "@/components/items/PrerequisitePicker";
import { ResponsibleUserPicker } from "@/components/items/ResponsibleUserPicker";
import {
  SmartAlertPicker,
  type SmartAlertValue,
} from "@/components/items/SmartAlertPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { localToISO } from "@/lib/utils/date";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type {
  CreateAlertInput,
  CreateEventInput,
  CreateRecurrenceInput,
  CreateReminderInput,
  CreateTaskInput,
  ItemPriority,
  ItemStatus,
  ItemType,
} from "@/types/items";
import type { CreatePrerequisiteInput } from "@/types/prerequisites";
import { parse as dateParse, format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, Circle, MapPin, SparklesIcon, Zap } from "lucide-react";
import type { ReactNode } from "react";
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

const ClipboardCheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 14l2 2 4-4" />
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
// TYPES & CONSTANTS
// ============================================

const priorityConfig: Record<
  ItemPriority,
  { label: string; icon: ReactNode; gradient: string }
> = {
  low: {
    label: "Low",
    icon: <Circle className="w-3 h-3 fill-blue-500 text-blue-500" />,
    gradient: "from-gray-500/20 to-gray-600/20",
  },
  normal: {
    label: "Normal",
    icon: <Circle className="w-3 h-3 fill-gray-400 text-gray-400" />,
    gradient: "from-cyan-500/20 to-blue-500/20",
  },
  high: {
    label: "High",
    icon: <Circle className="w-3 h-3 fill-orange-500 text-orange-500" />,
    gradient: "from-orange-500/20 to-red-500/20",
  },
  urgent: {
    label: "Urgent",
    icon: <Circle className="w-3 h-3 fill-red-500 text-red-500" />,
    gradient: "from-red-500/30 to-pink-500/30",
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

// Recurrence presets matching WebEventFormDialog
const RECURRENCE_PRESETS = [
  { label: "Never", value: "" },
  { label: "Daily", value: "FREQ=DAILY" },
  { label: "Weekdays", value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { label: "Weekly", value: "FREQ=WEEKLY" },
  { label: "Bi-weekly", value: "FREQ=WEEKLY;INTERVAL=2" },
  { label: "Monthly", value: "FREQ=MONTHLY" },
  { label: "Quarterly", value: "FREQ=MONTHLY;INTERVAL=3" },
  { label: "Yearly", value: "FREQ=YEARLY" },
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

  // Header height measurement
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(160);

  // Tags scroll fade indicators
  const tagsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollFades = useCallback(() => {
    const el = tagsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = tagsScrollRef.current;
    if (!el) return;
    updateScrollFades();
    el.addEventListener("scroll", updateScrollFades, { passive: true });
    const ro = new ResizeObserver(updateScrollFades);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollFades);
      ro.disconnect();
    };
  }, [updateScrollFades]);

  // Smart text input state
  const [smartInput, setSmartInput] = useState("");
  const [parsedItem, setParsedItem] = useState<ParsedItem | null>(null);

  // Manual override tracking
  const [manualOverrides, setManualOverrides] = useState<{
    type: boolean;
    priority: boolean;
    categories: boolean;
    dates: boolean;
    location: boolean;
    responsible: boolean;
  }>({
    type: false,
    priority: false,
    categories: false,
    dates: false,
    location: false,
    responsible: false,
  });

  // Core form state
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

  // Categories
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([
    "personal",
  ]);

  // Alert state (SmartAlertPicker)
  const [alertValue, setAlertValue] = useState<SmartAlertValue>({
    offsetMinutes: 0,
    customTime: null,
  });

  // Recurrence state
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [customRecurrenceOpen, setCustomRecurrenceOpen] = useState(false);

  // Location (all types)
  const [location, setLocation] = useState("");
  const [showLocation, setShowLocation] = useState(false);

  // Responsible user
  const [responsibleUserId, setResponsibleUserId] = useState<
    string | undefined
  >(undefined);
  const [notifyAllHousehold, setNotifyAllHousehold] = useState(false);

  // Prerequisites / Triggers
  const [prerequisites, setPrerequisites] = useState<CreatePrerequisiteInput[]>(
    [],
  );
  const [showTriggers, setShowTriggers] = useState(false);

  // Description section
  const [showDescription, setShowDescription] = useState(false);

  // Missing fields modal state
  const [showMissingFieldsModal, setShowMissingFieldsModal] = useState(false);
  const [missingFieldType, setMissingFieldType] = useState<
    "event" | "reminder" | "task" | null
  >(null);
  const [dateModalIntent, setDateModalIntent] = useState<"set-date" | "submit">(
    "set-date",
  );
  const [editingDateField, setEditingDateField] = useState<string | null>(null);
  const [showEndDateInModal, setShowEndDateInModal] = useState(false);

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

  // Helpers
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "Select date";
    try {
      const date = dateParse(dateStr, "yyyy-MM-dd", new Date());
      return format(date, "d MMM, yyyy");
    } catch {
      return dateStr;
    }
  };

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

  // Parse smart input on change (debounced)
  useEffect(() => {
    if (!smartInput.trim()) {
      setParsedItem(null);
      if (!manualOverrides.type) setItemType("reminder");
      if (!manualOverrides.priority) setPriority("normal");
      if (!manualOverrides.categories) setSelectedCategoryIds(["personal"]);
      if (!manualOverrides.dates) {
        setDueDate("");
        setDueTime("");
        setStartDate("");
        setStartTime("");
        setEndDate("");
        setEndTime("");
      }
      if (!manualOverrides.location) setLocation("");
      setTitle("");
      if (!manualOverrides.type) setRecurrenceRule("");
      return;
    }

    const timer = setTimeout(() => {
      const parsed = parseSmartText(smartInput);
      setParsedItem(parsed);
      setTitle(parsed.title);

      if (!manualOverrides.type) setItemType(parsed.type);
      if (!manualOverrides.priority) setPriority(parsed.priority);

      if (!manualOverrides.categories) {
        setSelectedCategoryIds(
          parsed.categoryIds && parsed.categoryIds.length > 0
            ? parsed.categoryIds
            : ["personal"],
        );
      }

      if (parsed.recurrenceRule && !manualOverrides.type) {
        setRecurrenceRule(parsed.recurrenceRule);
      } else if (!manualOverrides.type) {
        setRecurrenceRule("");
      }

      // Location parsing: detect "at [place]" but not "at [time]"
      if (!manualOverrides.location) {
        const locationMatch = smartInput.match(
          /\bat\s+(?!(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|noon|midnight|morning|evening|night|dawn|dusk|sunset|sunrise)\b)([a-zA-Z][a-zA-Z0-9\s,.'-]{2,30}?)(?:\s+(?:on|at|by|from|tomorrow|today|next|every|daily|weekly)\b|$)/i,
        );
        if (locationMatch && parsed.type === "event") {
          setLocation(locationMatch[1].trim());
        } else {
          setLocation("");
        }
      }

      if (parsed.type === "event" && !manualOverrides.type) {
        if (!manualOverrides.dates) {
          setStartDate(parsed.startDate || "");
          setStartTime(parsed.startTime || "");
          setEndDate(parsed.endDate || "");
          setEndTime(parsed.endTime || "");
        }
      } else if (!manualOverrides.type) {
        if (!manualOverrides.dates) {
          setDueDate(parsed.dueDate || "");
          setDueTime(parsed.dueTime || "");
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [smartInput, manualOverrides, isPrivate]);

  // Auto-reset responsible user when toggling private
  useEffect(() => {
    if (isPrivate) {
      setResponsibleUserId(undefined);
      setNotifyAllHousehold(false);
    }
  }, [isPrivate]);

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
    setAlertValue({ offsetMinutes: 0, customTime: null });
    setRecurrenceRule("");
    setCustomRecurrenceOpen(false);
    setLocation("");
    setResponsibleUserId(undefined);
    setNotifyAllHousehold(false);
    setPrerequisites([]);
    setShowTriggers(false);
    setShowDescription(false);
    setShowLocation(false);
    setManualOverrides({
      type: false,
      priority: false,
      categories: false,
      dates: false,
      location: false,
      responsible: false,
    });
    setShowEndDateInModal(false);
  }, []);

  // Build alert input from SmartAlertValue
  const buildAlertInput = (
    alertVal: SmartAlertValue,
  ): CreateAlertInput | null => {
    if (alertVal.offsetMinutes === 0 && !alertVal.customTime) return null;
    return {
      kind: "relative",
      offset_minutes: alertVal.offsetMinutes,
      relative_to: "due",
      custom_time: alertVal.customTime || undefined,
      channel: "push",
    };
  };

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
      const descriptionToSave = description.trim() || undefined;
      const startingStatus: ItemStatus =
        prerequisites.length > 0 ? "dormant" : status;

      if (itemType === "event") {
        if (!startDate || !startTime || !endDate || !endTime) {
          setMissingFieldType("event");
          setDateModalIntent("submit");
          setShowEndDateInModal(true);
          setShowMissingFieldsModal(true);
          return;
        }

        const startAtIso = localToISO(startDate, startTime);
        const endAtIso = localToISO(endDate, endTime);

        let recurrence_rule: CreateRecurrenceInput | undefined;
        if (recurrenceRule) {
          recurrence_rule = {
            rrule: recurrenceRule,
            start_anchor: startAtIso,
          };
        }

        const alertInput = buildAlertInput(alertValue);

        const input: CreateEventInput = {
          type: "event",
          title: title.trim(),
          description: descriptionToSave,
          priority,
          status: startingStatus,
          is_public: !isPrivate,
          start_at: startAtIso,
          end_at: endAtIso,
          location_text: location.trim() || undefined,
          alerts: alertInput ? [alertInput] : undefined,
          category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          recurrence_rule,
          responsible_user_id: responsibleUserId || undefined,
          notify_all_household: notifyAllHousehold || undefined,
          prerequisites: prerequisites.length > 0 ? prerequisites : undefined,
        };

        await createEvent.mutateAsync(input);
        toast.success("Event created!", {
          icon: ToastIcons.create,
          description: title,
        });
      } else if (itemType === "task") {
        if (!dueDate || !dueTime) {
          setMissingFieldType("task");
          setDateModalIntent("submit");
          setShowEndDateInModal(false);
          setShowMissingFieldsModal(true);
          return;
        }

        let dueAtIso: string | undefined;
        if (dueDate && dueTime) {
          dueAtIso = localToISO(dueDate, dueTime);
        } else if (dueDate) {
          dueAtIso = localToISO(dueDate, "12:00");
        }

        let recurrence_rule: CreateRecurrenceInput | undefined;
        if (recurrenceRule && dueAtIso) {
          recurrence_rule = {
            rrule: recurrenceRule,
            start_anchor: dueAtIso,
          };
        }

        const alertInput = buildAlertInput(alertValue);

        const locationTrimmed = location.trim();
        const input: CreateTaskInput = {
          type: "task",
          title: title.trim(),
          description: descriptionToSave,
          priority,
          is_public: !isPrivate,
          status: startingStatus,
          due_at: dueAtIso,
          alerts: alertInput ? [alertInput] : undefined,
          category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          recurrence_rule,
          responsible_user_id: responsibleUserId || undefined,
          notify_all_household: notifyAllHousehold || undefined,
          prerequisites: prerequisites.length > 0 ? prerequisites : undefined,
          metadata_json: locationTrimmed
            ? { location_text: locationTrimmed }
            : undefined,
        };

        await createTask.mutateAsync(input);
        toast.success("Task created!", {
          icon: ToastIcons.create,
          description: title,
        });
      } else {
        // Reminder
        if (!dueDate || !dueTime) {
          setMissingFieldType("reminder");
          setDateModalIntent("submit");
          setShowEndDateInModal(false);
          setShowMissingFieldsModal(true);
          return;
        }

        let dueAtIso: string | undefined;
        if (dueDate && dueTime) {
          dueAtIso = localToISO(dueDate, dueTime);
        } else if (dueDate) {
          dueAtIso = localToISO(dueDate, "12:00");
        }

        let recurrence_rule: CreateRecurrenceInput | undefined;
        if (recurrenceRule && dueAtIso) {
          recurrence_rule = {
            rrule: recurrenceRule,
            start_anchor: dueAtIso,
          };
        }

        const locationTrimmed = location.trim();
        const input: CreateReminderInput = {
          type: "reminder",
          title: title.trim(),
          description: descriptionToSave,
          priority,
          status: startingStatus,
          is_public: !isPrivate,
          due_at: dueAtIso,
          category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          recurrence_rule,
          responsible_user_id: responsibleUserId || undefined,
          notify_all_household: notifyAllHousehold || undefined,
          prerequisites: prerequisites.length > 0 ? prerequisites : undefined,
          metadata_json: locationTrimmed
            ? { location_text: locationTrimmed }
            : undefined,
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

  // Measure header height
  useEffect(() => {
    if (!headerRef.current) return;
    const measure = () => {
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  const contentAreaStyles: CSSProperties = {
    bottom: `calc(env(safe-area-inset-bottom) + ${MOBILE_CONTENT_BOTTOM_OFFSET}px)`,
  };

  const isPending =
    createReminder.isPending || createEvent.isPending || createTask.isPending;

  // Parsed info chips
  const getParsedInfoChips = () => {
    if (!parsedItem) return null;

    const chips: { label: string; color: string; confidence: number }[] = [];

    const typeLabel =
      parsedItem.type === "event"
        ? "Event"
        : parsedItem.type === "task"
          ? "Task"
          : "Reminder";
    chips.push({
      label: typeLabel,
      color: "from-cyan-500/30 to-blue-500/30",
      confidence: parsedItem.confidence.type,
    });

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

    if (parsedItem.priority !== "normal") {
      const prioLabel = priorityConfig[parsedItem.priority].label;
      chips.push({
        label: prioLabel,
        color: "from-red-500/30 to-pink-500/30",
        confidence: parsedItem.confidence.priority,
      });
    }

    return chips;
  };

  const parsedChips = getParsedInfoChips();

  // Recurrence display text
  const recurrenceDisplayText = recurrenceRule
    ? RECURRENCE_PRESETS.find((p) => p.value === recurrenceRule)?.label ||
      describeRRule(recurrenceRule)
    : "Never";

  return (
    <>
      <div className="fixed inset-0 top-14 bg-bg-dark flex flex-col">
        {/* HEADER */}
        <div
          ref={headerRef}
          className={cn(
            "fixed top-0 left-0 right-0 z-[100] bg-gradient-to-b from-bg-card-custom to-bg-medium border-b px-3 pb-2 shadow-2xl shadow-black/10 backdrop-blur-xl slide-in-top",
            themeClasses.border,
          )}
        >
          <div className="flex items-center justify-between mb-2 pt-16">
            <div className="w-8" />
            <div className="flex items-center gap-2">
              <SparklesIcon
                className={cn("w-4 h-4", themeClasses.textActive)}
              />
              <h1
                className={`text-base font-semibold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent ${themeClasses.glow}`}
              >
                New Item
              </h1>
            </div>
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

          <div className="h-px bg-gradient-to-r from-transparent via-slate-700/60 to-transparent mb-2" />

          {/* ── Inline Tags Row ── */}
          <div className="relative -mx-1">
            <div ref={tagsScrollRef} className="overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1.5 px-1 min-w-max pb-1">
                {/* 1. Priority Tag — only when non-default */}
                {priority !== "normal" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`inline-flex items-center px-2 py-1.5 rounded-full ${themeClasses.pillBg} ${themeClasses.pillBgHover} active:scale-95 transition-all duration-150 shrink-0`}
                      >
                        <FlagIcon
                          className={cn(
                            "w-3.5 h-3.5",
                            priority === "urgent"
                              ? "text-red-500"
                              : priority === "high"
                                ? "text-orange-500"
                                : "text-blue-400",
                          )}
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      className="w-40 p-1 bg-bg-card-custom border border-slate-700/60 rounded-xl shadow-2xl z-[200]"
                    >
                      {(Object.keys(priorityConfig) as ItemPriority[]).map(
                        (p) => (
                          <button
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
                              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                              priority === p
                                ? `bg-gradient-to-r ${priorityConfig[p].gradient} ${themeClasses.text} font-semibold`
                                : `${themeClasses.textMuted} hover:bg-white/5`,
                            )}
                          >
                            {priorityConfig[p].icon}
                            {priorityConfig[p].label}
                          </button>
                        ),
                      )}
                    </PopoverContent>
                  </Popover>
                )}

                {/* 2. Type Tag */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full active:scale-95 transition-all duration-150 shrink-0",
                        itemType === "reminder"
                          ? "bg-cyan-500/20 hover:bg-cyan-500/30"
                          : itemType === "event"
                            ? "bg-pink-500/20 hover:bg-pink-500/30"
                            : "bg-purple-500/20 hover:bg-purple-500/30",
                      )}
                    >
                      {itemType === "reminder" ? (
                        <BellIcon className="w-3 h-3 text-cyan-400" />
                      ) : itemType === "event" ? (
                        <CalendarIcon className="w-3 h-3 text-pink-400" />
                      ) : (
                        <ClipboardCheckIcon className="w-3 h-3 text-purple-400" />
                      )}
                      <span
                        className={cn(
                          "font-semibold text-[11px]",
                          itemType === "reminder"
                            ? "text-cyan-300"
                            : itemType === "event"
                              ? "text-pink-300"
                              : "text-purple-300",
                        )}
                      >
                        {itemType === "reminder"
                          ? "Reminder"
                          : itemType === "event"
                            ? "Event"
                            : "Task"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    sideOffset={6}
                    className="w-36 p-1 bg-bg-card-custom border border-slate-700/60 rounded-xl shadow-2xl z-[200]"
                  >
                    {(
                      [
                        {
                          type: "reminder" as ItemType,
                          icon: BellIcon,
                          label: "Reminder",
                          color: "text-cyan-300",
                          bg: "from-cyan-500/20 to-cyan-600/20",
                        },
                        {
                          type: "event" as ItemType,
                          icon: CalendarIcon,
                          label: "Event",
                          color: "text-pink-300",
                          bg: "from-pink-500/20 to-pink-600/20",
                        },
                        {
                          type: "task" as ItemType,
                          icon: ClipboardCheckIcon,
                          label: "Task",
                          color: "text-purple-300",
                          bg: "from-purple-500/20 to-purple-600/20",
                        },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => {
                          setItemType(item.type);
                          setManualOverrides((prev) => ({
                            ...prev,
                            type: true,
                          }));
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                          itemType === item.type
                            ? `bg-gradient-to-r ${item.bg} ${item.color} font-semibold`
                            : `${themeClasses.textMuted} hover:bg-white/5`,
                        )}
                      >
                        <item.icon className={cn("w-3.5 h-3.5", item.color)} />
                        {item.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>

                {/* 3. Date Tag — only when date is set */}
                {(itemType === "event" ? startDate : dueDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const tomorrow = new Date(today);
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const fmt = (d: Date) => d.toISOString().split("T")[0];
                      const fmtT = (d: Date) => d.toTimeString().slice(0, 5);
                      if (itemType === "event") {
                        if (!startDate) setStartDate(fmt(today));
                        if (!startTime) setStartTime(fmtT(today));
                        if (!endDate) setEndDate(fmt(tomorrow));
                        if (!endTime) setEndTime(fmtT(today));
                        setMissingFieldType("event");
                      } else {
                        if (!dueDate) setDueDate(fmt(today));
                        if (!dueTime) setDueTime(fmtT(today));
                        setMissingFieldType(
                          itemType === "task" ? "task" : "reminder",
                        );
                      }
                      setShowEndDateInModal(itemType === "event");
                      setDateModalIntent("set-date");
                      setShowMissingFieldsModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/30 active:scale-95 transition-all duration-150 shrink-0"
                  >
                    <CalendarIcon className="w-3 h-3 text-purple-400" />
                    <span className="font-semibold text-[11px] text-purple-300">
                      {itemType === "event"
                        ? startDate
                          ? format(new Date(startDate + "T00:00:00"), "MMM d")
                          : "Date"
                        : dueDate
                          ? format(new Date(dueDate + "T00:00:00"), "MMM d")
                          : "Date"}
                    </span>
                  </button>
                )}

                {/* 4. Assign Tag (public items only) */}
                {!isPrivate && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full active:scale-95 transition-all duration-150 shrink-0",
                          responsibleUserId || notifyAllHousehold
                            ? "bg-sky-500/20 hover:bg-sky-500/30"
                            : `${themeClasses.pillBg} ${themeClasses.pillBgHover}`,
                        )}
                      >
                        <svg
                          className={cn(
                            "w-3 h-3",
                            responsibleUserId || notifyAllHousehold
                              ? "text-sky-400"
                              : themeClasses.textMuted,
                          )}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span
                          className={cn(
                            "font-semibold text-[11px]",
                            responsibleUserId || notifyAllHousehold
                              ? "text-sky-300"
                              : themeClasses.textMuted,
                          )}
                        >
                          Assign
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      className="w-64 p-3 bg-bg-card-custom border border-slate-700/60 rounded-xl shadow-2xl z-[200]"
                    >
                      <Label className="text-xs text-white/60 mb-1.5 block">
                        Responsible User
                      </Label>
                      <ResponsibleUserPicker
                        value={responsibleUserId}
                        notifyAllHousehold={notifyAllHousehold}
                        onChange={(userId, allHousehold) => {
                          setResponsibleUserId(userId);
                          setNotifyAllHousehold(allHousehold);
                          setManualOverrides((prev) => ({
                            ...prev,
                            responsible: true,
                          }));
                        }}
                        isPublic={!isPrivate}
                        variant="compact"
                      />
                    </PopoverContent>
                  </Popover>
                )}

                {/* 5. Category Tag */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full active:scale-95 transition-all duration-150 shrink-0",
                        selectedCategoryIds.length > 1
                          ? "bg-gradient-to-r from-violet-500/40 to-pink-500/40 hover:from-violet-500/50 hover:to-pink-500/50 ring-1 ring-violet-400/50"
                          : "bg-violet-500/20 hover:bg-violet-500/30",
                      )}
                    >
                      <TagIcon className="w-3 h-3 text-violet-400" />
                      <span className="font-semibold text-[11px] text-violet-300">
                        {selectedCategoryIds.length > 0
                          ? (CATEGORIES.find(
                              (c) => c.id === selectedCategoryIds[0],
                            )?.name ?? "Category")
                          : "Category"}
                      </span>
                      {selectedCategoryIds.length > 1 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-pink-500/60 text-[9px] font-bold text-white shrink-0">
                          +{selectedCategoryIds.length - 1}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    sideOffset={6}
                    className="w-52 p-2 bg-bg-card-custom border border-slate-700/60 rounded-xl shadow-2xl z-[200]"
                  >
                    <div className="grid grid-cols-2 gap-1">
                      {CATEGORIES.map((cat) => {
                        const CatIcon = categoryIcons[cat.id];
                        const isSelected = selectedCategoryIds.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategoryIds(
                                isSelected
                                  ? selectedCategoryIds.filter(
                                      (id) => id !== cat.id,
                                    )
                                  : [...selectedCategoryIds, cat.id],
                              );
                              setManualOverrides((prev) => ({
                                ...prev,
                                categories: true,
                              }));
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs transition-all",
                              isSelected
                                ? "bg-white/10 font-semibold"
                                : `${themeClasses.textMuted} hover:bg-white/5`,
                            )}
                            style={
                              isSelected ? { color: cat.color_hex } : undefined
                            }
                          >
                            {CatIcon && (
                              <span style={{ color: cat.color_hex }}>
                                <CatIcon className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* 6. Repeat Tag — only when recurrence is set */}
                {recurrenceRule && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/20 hover:bg-green-500/30 active:scale-95 transition-all duration-150 shrink-0">
                        <RepeatIcon className="w-3 h-3 text-green-400" />
                        <span className="font-semibold text-[11px] text-green-300">
                          {recurrenceDisplayText}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      className="w-48 p-1 bg-bg-card-custom border border-slate-700/60 rounded-xl shadow-2xl z-[200]"
                    >
                      {RECURRENCE_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setRecurrenceRule(preset.value);
                            setManualOverrides((prev) => ({
                              ...prev,
                              type: true,
                            }));
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                            recurrenceRule === preset.value
                              ? "bg-green-500/20 text-green-300 font-semibold"
                              : `${themeClasses.textMuted} hover:bg-white/5`,
                          )}
                        >
                          <RepeatIcon className="w-3.5 h-3.5" />
                          {preset.label}
                        </button>
                      ))}
                      <div className="h-px bg-slate-700/40 my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomRecurrenceOpen(true);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                          `${themeClasses.textMuted} hover:bg-white/5`,
                        )}
                      >
                        <RepeatIcon className="w-3.5 h-3.5" />
                        Custom...
                      </button>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Alert Tag — only when alert is configured */}
                {(alertValue.offsetMinutes > 0 || alertValue.customTime) && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full active:scale-95 transition-all duration-150 shrink-0",
                          alertValue.offsetMinutes > 0
                            ? "bg-amber-500/20 hover:bg-amber-500/30"
                            : `${themeClasses.pillBg} ${themeClasses.pillBgHover}`,
                        )}
                      >
                        <BellIcon
                          className={cn(
                            "w-3 h-3",
                            alertValue.offsetMinutes > 0
                              ? "text-amber-400"
                              : themeClasses.textMuted,
                          )}
                        />
                        <span
                          className={cn(
                            "font-semibold text-[11px]",
                            alertValue.offsetMinutes > 0
                              ? "text-amber-300"
                              : themeClasses.textMuted,
                          )}
                        >
                          {alertValue.offsetMinutes > 0
                            ? alertValue.offsetMinutes >= 60
                              ? `${Math.floor(alertValue.offsetMinutes / 60)}h`
                              : `${alertValue.offsetMinutes}m`
                            : "Alert"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      className="w-64 p-3 bg-bg-card-custom border border-slate-700/60 rounded-xl shadow-2xl z-[200]"
                    >
                      <SmartAlertPicker
                        value={alertValue}
                        onChange={(val) => {
                          setAlertValue(val);
                          // If setting alert on a reminder, upgrade to task
                          if (
                            val.offsetMinutes > 0 &&
                            itemType === "reminder"
                          ) {
                            setItemType("task");
                            setManualOverrides((prev) => ({
                              ...prev,
                              type: true,
                            }));
                          }
                        }}
                        eventTime={itemType === "event" ? startTime : dueTime}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
            {/* Left fade hint */}
            <div
              className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-bg-card-custom to-transparent transition-opacity duration-200"
              style={{ opacity: canScrollLeft ? 1 : 0 }}
            />
            {/* Right fade hint */}
            <div
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-bg-card-custom to-transparent transition-opacity duration-200"
              style={{ opacity: canScrollRight ? 1 : 0 }}
            />
          </div>
        </div>

        {/* CONTENT */}
        <div
          className="fixed left-0 right-0 overflow-y-auto px-4 py-4 bg-bg-dark z-[45]"
          style={{ ...contentAreaStyles, top: `${headerHeight}px` }}
        >
          <motion.div
            initial={{ opacity: 0.8, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.08 }}
            className="space-y-3"
          >
            {/* ── Hero Input Card ── */}
            <div className="relative rounded-2xl bg-gradient-to-b from-slate-800/60 via-slate-900/40 to-transparent border border-slate-700/40 p-4 space-y-3 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-bl-full pointer-events-none" />

              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Remember to..."
                    value={smartInput}
                    onChange={(e) => setSmartInput(e.target.value)}
                    className={cn(
                      "text-base py-4 pl-4 pr-10 border bg-bg-dark/60 rounded-xl w-full",
                      themeClasses.border,
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
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={cn(
                    "flex-shrink-0 w-12 self-stretch flex items-center justify-center rounded-xl border transition-all active:scale-95",
                    isListening
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/30 border-red-500/50"
                      : `bg-bg-dark/60 ${themeClasses.border} ${themeClasses.text} hover:bg-opacity-80`,
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

              {/* Date Display Row */}
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
                  setShowEndDateInModal(itemType === "event");
                  setDateModalIntent("set-date");
                  setShowMissingFieldsModal(true);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:scale-[1.01] active:scale-[0.99]",
                  "bg-bg-dark/40 border",
                  themeClasses.border,
                  themeClasses.text,
                )}
              >
                <CalendarIcon className="w-4 h-4 text-purple-400" />
                <span className={themeClasses.textMuted}>Date:</span>
                <span className="font-semibold text-purple-300">
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

              {/* Controls Row: Left icons (location, notes, triggers) | Right (priority, privacy) */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {/* Location toggle */}
                  <button
                    type="button"
                    onClick={() => setShowLocation(!showLocation)}
                    className={cn(
                      "h-9 w-9 flex items-center justify-center rounded-xl border transition-colors duration-150 active:scale-90",
                      showLocation || location
                        ? "bg-teal-500/15 border-teal-500/30 text-teal-400"
                        : "bg-bg-dark/40 border-white/10 text-white/30 hover:text-teal-400/50",
                    )}
                    title="Location"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>

                  {/* Notes toggle */}
                  <button
                    type="button"
                    onClick={() => setShowDescription(!showDescription)}
                    className={cn(
                      "h-9 w-9 flex items-center justify-center rounded-xl border transition-colors duration-150 active:scale-90",
                      showDescription || description
                        ? "bg-white/10 border-white/20 text-white/80"
                        : "bg-bg-dark/40 border-white/10 text-white/30 hover:text-white/50",
                    )}
                    title="Notes"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>

                  {/* Triggers toggle */}
                  <button
                    type="button"
                    onClick={() => setShowTriggers(!showTriggers)}
                    className={cn(
                      "h-9 w-9 flex items-center justify-center rounded-xl border transition-colors duration-150 active:scale-90",
                      showTriggers || prerequisites.length > 0
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                        : "bg-bg-dark/40 border-white/10 text-white/30 hover:text-amber-400/50",
                    )}
                    title="Triggers"
                  >
                    <Zap className="w-4 h-4" />
                  </button>

                  {/* Recurrence toggle */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "h-9 w-9 flex items-center justify-center rounded-xl border transition-colors duration-150 active:scale-90",
                          recurrenceRule
                            ? "bg-green-500/15 border-green-500/30 text-green-400"
                            : "bg-bg-dark/40 border-white/10 text-white/30 hover:text-green-400/50",
                        )}
                        title="Recurrence"
                      >
                        <RepeatIcon className="w-4 h-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      sideOffset={6}
                      className="w-48 p-1 bg-bg-card-custom border border-slate-700/60 rounded-xl shadow-2xl z-[200]"
                    >
                      {RECURRENCE_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setRecurrenceRule(preset.value);
                            setManualOverrides((prev) => ({
                              ...prev,
                              type: true,
                            }));
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                            recurrenceRule === preset.value
                              ? "bg-green-500/20 text-green-300 font-semibold"
                              : `${themeClasses.textMuted} hover:bg-white/5`,
                          )}
                        >
                          <RepeatIcon className="w-3.5 h-3.5" />
                          {preset.label}
                        </button>
                      ))}
                      <div className="h-px bg-slate-700/40 my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomRecurrenceOpen(true);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                          `${themeClasses.textMuted} hover:bg-white/5`,
                        )}
                      >
                        <RepeatIcon className="w-3.5 h-3.5" />
                        Custom...
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Priority Dot Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "h-9 w-9 flex items-center justify-center rounded-xl border bg-bg-dark/40 transition-colors duration-150 active:scale-90 shrink-0",
                          themeClasses.border,
                        )}
                        title={`Priority: ${priority}`}
                      >
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full transition-colors duration-200",
                            priority === "urgent"
                              ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                              : priority === "high"
                                ? "bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]"
                                : priority === "normal"
                                  ? "bg-cyan-400"
                                  : "bg-blue-400/50",
                          )}
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      sideOffset={6}
                      className="w-auto p-1.5 bg-bg-card-custom border border-slate-700/60 rounded-xl shadow-2xl z-[200]"
                    >
                      <div className="flex items-center gap-2">
                        {(
                          [
                            {
                              p: "low" as ItemPriority,
                              color: "bg-blue-400/50",
                              label: "Low",
                            },
                            {
                              p: "normal" as ItemPriority,
                              color: "bg-cyan-400",
                              label: "Normal",
                            },
                            {
                              p: "high" as ItemPriority,
                              color:
                                "bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]",
                              label: "High",
                            },
                            {
                              p: "urgent" as ItemPriority,
                              color:
                                "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
                              label: "Urgent",
                            },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.p}
                            type="button"
                            onClick={() => {
                              setPriority(item.p);
                              setManualOverrides((prev) => ({
                                ...prev,
                                priority: true,
                              }));
                            }}
                            className={cn(
                              "h-8 w-8 flex items-center justify-center rounded-lg transition-all active:scale-90",
                              priority === item.p
                                ? "bg-white/10 ring-1 ring-white/20"
                                : "hover:bg-white/5",
                            )}
                            title={item.label}
                          >
                            <div
                              className={cn(
                                "w-3.5 h-3.5 rounded-full",
                                item.color,
                              )}
                            />
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Private/Public Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={cn(
                      "h-9 w-9 flex items-center justify-center rounded-xl border transition-all duration-200 active:scale-90 shrink-0",
                      isPrivate
                        ? `${themeClasses.borderActive} bg-gradient-to-br ${themeClasses.activeItemGradient} ${themeClasses.activeItemShadow}`
                        : `bg-bg-dark/40 ${themeClasses.border}`,
                    )}
                  >
                    <svg
                      className={cn(
                        "w-4 h-4 transition-colors duration-200",
                        isPrivate
                          ? `${themeClasses.textActive} drop-shadow-[0_0_8px_rgba(20,184,166,0.8)]`
                          : themeClasses.textFaint,
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      {isPrivate ? (
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
            </div>

            {/* ── Collapsible Sections (CSS grid transitions for smooth height) ── */}
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                showLocation ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-3 mb-3">
                  <Input
                    type="text"
                    placeholder="e.g. Office, Coffee Shop..."
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setManualOverrides((prev) => ({
                        ...prev,
                        location: true,
                      }));
                    }}
                    className="text-sm bg-bg-dark/60 border-slate-700/60"
                    autoFocus={showLocation}
                  />
                </div>
              </div>
            </div>

            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                showDescription ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-3 mb-3">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add more details..."
                    rows={3}
                    className={cn(
                      "w-full text-sm bg-bg-dark/60 border rounded-lg p-3 resize-none",
                      themeClasses.border,
                      themeClasses.text,
                      "placeholder:text-white/30",
                    )}
                    autoFocus={showDescription}
                  />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showTriggers && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-3 mb-3">
                    <p className="text-xs text-white/40 mb-2">
                      Items with triggers start as dormant and activate when
                      conditions are met.
                    </p>
                    <PrerequisitePicker
                      value={prerequisites}
                      onChange={setPrerequisites}
                      compact
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CREATE BUTTON */}
            <div className="mt-2">
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || isPending}
                className="w-full h-12 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 transition-all active:scale-[0.98] spring-bounce"
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
                    Create {prerequisites.length > 0 ? "(Dormant) " : ""}
                    {itemType === "event"
                      ? "Event"
                      : itemType === "task"
                        ? "Task"
                        : "Reminder"}
                  </span>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Custom Recurrence Picker Drawer */}
      <CustomRecurrencePicker
        open={customRecurrenceOpen}
        onOpenChange={setCustomRecurrenceOpen}
        value={recurrenceRule}
        onChange={(rule) => {
          setRecurrenceRule(rule);
          setManualOverrides((prev) => ({ ...prev, type: true }));
        }}
        referenceDate={
          itemType === "event" && startDate
            ? new Date(`${startDate}T12:00:00`)
            : dueDate
              ? new Date(`${dueDate}T12:00:00`)
              : new Date()
        }
      />

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
                  📅 Set Up Your{" "}
                  {itemType === "event"
                    ? "Event"
                    : itemType === "task"
                      ? "Task"
                      : "Reminder"}
                </h3>
                <p className={cn("text-sm", themeClasses.textSecondary)}>
                  {itemType === "event"
                    ? "Configure date, alert, and end time"
                    : itemType === "task"
                      ? "Configure date and alert"
                      : "Set the date and time"}
                </p>
              </div>

              <div className="space-y-3">
                {/* Start / Due Date */}
                <div className="bg-[#0d1f35] border border-cyan-500/20 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarIcon className="w-4 h-4 text-cyan-400" />
                    <Label className="text-sm font-semibold text-cyan-300">
                      {itemType === "event"
                        ? "Start Date & Time"
                        : "Date & Time"}
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      {editingDateField === "startDate_u" ? (
                        <Input
                          type="date"
                          value={itemType === "event" ? startDate : dueDate}
                          onChange={(e) => {
                            if (itemType === "event")
                              setStartDate(e.target.value);
                            else setDueDate(e.target.value);
                          }}
                          onBlur={() => setEditingDateField(null)}
                          autoFocus
                          className="py-3 h-11 bg-[#0a1628] border border-cyan-500/30 text-cyan-100 [color-scheme:dark]"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingDateField("startDate_u")}
                          className="w-full py-3 h-11 px-3 bg-[#0a1628] border border-cyan-500/20 rounded-md text-left text-cyan-100 hover:border-cyan-500/40 transition-colors text-sm"
                        >
                          {formatDateDisplay(
                            itemType === "event" ? startDate : dueDate,
                          )}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      {editingDateField === "startTime_u" ? (
                        <Input
                          type="time"
                          value={itemType === "event" ? startTime : dueTime}
                          onChange={(e) => {
                            if (itemType === "event")
                              setStartTime(e.target.value);
                            else setDueTime(e.target.value);
                          }}
                          onBlur={() => setEditingDateField(null)}
                          autoFocus
                          className="py-3 h-11 bg-[#0a1628] border border-cyan-500/30 text-cyan-100 [color-scheme:dark]"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingDateField("startTime_u")}
                          className="w-full py-3 h-11 px-3 bg-[#0a1628] border border-cyan-500/20 rounded-md text-left text-cyan-100 hover:border-cyan-500/40 transition-colors text-sm"
                        >
                          {formatTimeDisplay(
                            itemType === "event" ? startTime : dueTime,
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Alert Section — shown for task & event */}
                {itemType !== "reminder" && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <BellIcon className="w-4 h-4 text-amber-400" />
                      <Label className="text-sm font-semibold text-amber-300">
                        Alert
                      </Label>
                    </div>
                    <SmartAlertPicker
                      value={alertValue}
                      onChange={(val) => {
                        setAlertValue(val);
                      }}
                      eventTime={itemType === "event" ? startTime : dueTime}
                    />
                  </div>
                )}

                {/* Add Alert button — for reminders, upgrades to task */}
                {itemType === "reminder" && (
                  <button
                    type="button"
                    onClick={() => {
                      setItemType("task");
                      setManualOverrides((prev) => ({
                        ...prev,
                        type: true,
                        dates: true,
                      }));
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-amber-500/30 text-amber-400/60 hover:border-amber-500/50 hover:text-amber-400 transition-all active:scale-[0.99] text-sm"
                  >
                    <BellIcon className="w-4 h-4" />
                    <span>Add Alert</span>
                    <span className="text-xs opacity-60 ml-1">
                      → upgrades to Task
                    </span>
                  </button>
                )}

                {/* End Date (Events) */}
                {showEndDateInModal && (
                  <div className="bg-pink-500/10 border border-pink-500/40 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarIcon className="w-4 h-4 text-pink-400" />
                      <Label className="text-sm font-semibold text-pink-300">
                        End Date & Time
                      </Label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        {editingDateField === "endDate" ? (
                          <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            onBlur={() => setEditingDateField(null)}
                            autoFocus
                            className="py-3 h-11 bg-[#0a1628] border border-pink-500/30 text-pink-100 [color-scheme:dark]"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingDateField("endDate")}
                            className="w-full py-3 h-11 px-3 bg-[#0a1628] border border-pink-500/20 rounded-md text-left text-pink-100 hover:border-pink-500/40 transition-colors text-sm"
                          >
                            {endDate
                              ? formatDateDisplay(endDate)
                              : "No end date"}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        {editingDateField === "endTime" ? (
                          <Input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            onBlur={() => setEditingDateField(null)}
                            autoFocus
                            className="py-3 h-11 bg-[#0a1628] border border-pink-500/30 text-pink-100 [color-scheme:dark]"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingDateField("endTime")}
                            className="w-full py-3 h-11 px-3 bg-[#0a1628] border border-pink-500/20 rounded-md text-left text-pink-100 hover:border-pink-500/40 transition-colors text-sm"
                          >
                            {endTime
                              ? formatTimeDisplay(endTime)
                              : "No end time"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Add End Date button (non-events) */}
                {!showEndDateInModal && itemType !== "event" && (
                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      const tomorrow = new Date(today);
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const fmt = (d: Date) => d.toISOString().split("T")[0];
                      const fmtT = (d: Date) => d.toTimeString().slice(0, 5);
                      if (!startDate) setStartDate(dueDate || fmt(today));
                      if (!startTime) setStartTime(dueTime || fmtT(today));
                      if (!endDate) setEndDate(fmt(tomorrow));
                      if (!endTime) setEndTime(dueTime || fmtT(today));
                      setShowEndDateInModal(true);
                      setItemType("event");
                      setManualOverrides((prev) => ({
                        ...prev,
                        type: true,
                        dates: true,
                      }));
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-pink-500/30 text-pink-400/60 hover:border-pink-500/50 hover:text-pink-400 transition-all active:scale-[0.99] text-sm"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    <span>Add End Date</span>
                    <span className="text-xs opacity-60 ml-1">
                      → upgrades to Event
                    </span>
                  </button>
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
                    setManualOverrides((prev) => ({ ...prev, dates: true }));
                    if (dateModalIntent === "submit") {
                      setTimeout(() => handleSubmit(), 100);
                    }
                  }}
                  disabled={
                    itemType === "event"
                      ? !startDate || !startTime || !endDate || !endTime
                      : !dueDate || !dueTime
                  }
                  className="flex-1 h-11 neo-gradient text-white border-0 shadow-lg"
                >
                  {dateModalIntent === "submit"
                    ? `Create ${itemType === "event" ? "Event" : itemType === "task" ? "Task" : "Reminder"}`
                    : "Continue"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
