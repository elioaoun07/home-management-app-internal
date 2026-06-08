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

import { CustomRecurrencePicker } from "@/components/items/CustomRecurrencePicker";
import ItemDetailModal from "@/components/items/ItemDetailModal";
import { PrerequisitePicker } from "@/components/items/PrerequisitePicker";
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
import { WebEventFormDialog } from "@/components/web/WebEventFormDialog";
import { MOBILE_CONTENT_BOTTOM_OFFSET } from "@/constants/layout";
import { useTabSafe } from "@/contexts/TabContext";
import { useItemActionsWithToast } from "@/features/items/useItemActions";
import {
  useCreateEvent,
  useCreateReminder,
  useCreateTask,
  useItem,
} from "@/features/items/useItems";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  getRecurrenceDescription,
  parseSmartText,
  type ParsedItem,
} from "@/lib/smartTextParser";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { localToISO } from "@/lib/utils/date";
import type {
  CreateAlertInput,
  CreateEventInput,
  CreateRecurrenceInput,
  CreateReminderInput,
  ItemPriority,
  ItemStatus,
  ItemType,
} from "@/types/items";
import type { CreatePrerequisiteInput } from "@/types/prerequisites";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckIcon,
  Circle,
  Clock,
  Home,
  Link,
  MapPin,
  Repeat,
  SparklesIcon,
  Users,
  Zap,
} from "lucide-react";
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
  const { data: householdData } = useHouseholdMembers();
  const createReminder = useCreateReminder();
  const createEvent = useCreateEvent();
  const createTask = useCreateTask();
  const inputRef = useRef<HTMLInputElement>(null);
  const dueTimeRef = useRef<HTMLInputElement>(null);

  // ── Notification deep-link: open quick view for the targeted item ──
  const tabCtx = useTabSafe();
  const pendingItemId = tabCtx?.pendingItemId ?? null;
  const setPendingItemId = tabCtx?.setPendingItemId;
  const { data: pendingItem } = useItem(pendingItemId || undefined);
  const itemActions = useItemActionsWithToast();
  const closeQuickView = useCallback(() => {
    setPendingItemId?.(null);
  }, [setPendingItemId]);
  // Edit dialog (opened from quick-view Edit button)
  const [editingItemForDialog, setEditingItemForDialog] = useState<
    typeof pendingItem | null
  >(null);

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
  const [isPrivate, setIsPrivate] = useState(true);
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
  const [locationContext, setLocationContext] = useState<"home" | null>(null);
  const [locationMode, setLocationMode] = useState<"none" | "home" | "map">(
    "none",
  );
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

  // Native date/time field styling (filled = themed highlight)
  const nativeFieldCls = (filled: boolean) =>
    cn(
      "px-2.5 py-2 rounded-lg text-xs font-medium border bg-bg-dark/40 [color-scheme:dark] outline-none transition-all active:scale-95",
      filled
        ? "border-purple-400/50 text-purple-200"
        : "border-white/10 text-white/50",
    );

  // Time-of-day presets (the fuzzy chips). Anything else = an "exact" time.
  const TIME_PRESETS = ["09:00", "12:00", "15:00", "19:00"];
  const hasExactTime = !!dueTime && !TIME_PRESETS.includes(dueTime);
  const formatTimeLabel = (t: string) => {
    try {
      return format(new Date(`2000-01-01T${t}`), "h:mm a");
    } catch {
      return t;
    }
  };
  // Open the OS time picker from the hidden <input type="time">
  const openTimePicker = () => {
    const el = dueTimeRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
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
      if (!manualOverrides.location) {
        setLocation("");
        setLocationContext(null);
        setLocationMode("none");
      }
      setTitle("");
      if (!manualOverrides.type) setRecurrenceRule("");
      return;
    }

    const timer = setTimeout(() => {
      const parsed = parseSmartText(smartInput);
      setParsedItem(parsed);
      setTitle(parsed.title);

      // Task is retired in the UI — only Reminder or Event
      if (!manualOverrides.type)
        setItemType(parsed.type === "task" ? "reminder" : parsed.type);
      if (!manualOverrides.priority) setPriority(parsed.priority);

      // Categories apply to events only — reminders have no categories
      if (!manualOverrides.categories) {
        if (parsed.type === "event") {
          setSelectedCategoryIds(
            parsed.categoryIds && parsed.categoryIds.length > 0
              ? parsed.categoryIds
              : ["personal"],
          );
        } else {
          setSelectedCategoryIds([]);
        }
      }

      if (parsed.recurrenceRule && !manualOverrides.type) {
        setRecurrenceRule(parsed.recurrenceRule);
      } else if (!manualOverrides.type) {
        setRecurrenceRule("");
      }

      // Location parsing: "home"/"when I get home" → At Home (only home is auto-detected)
      if (!manualOverrides.location) {
        const homeMatch =
          /\b(?:get(?:ting)?\s+(?:back\s+)?home|back\s+home|at\s+home|reach(?:ing)?\s+home|arriv(?:e|es|ing)\s+home|head(?:ing)?\s+home|go(?:ing)?\s+home|when\s+i'?m\s+home|home)\b/i.test(
            smartInput,
          );
        if (homeMatch) {
          setLocationContext("home");
          setLocationMode("home");
          setLocation("");
          // Drop the trailing "when I get home"-style clause from the title
          setTitle((prev) => {
            const cleaned = prev
              .replace(
                /\b(?:when|once|after|whenever|as\s+soon\s+as)\s+i'?m?\b.*$/i,
                "",
              )
              .replace(/\bat\s+home\b/gi, "")
              .replace(/\s{2,}/g, " ")
              .replace(/^[\s,.–-]+|[\s,.–-]+$/g, "")
              .trim();
            return cleaned || prev;
          });
        } else {
          setLocation("");
          setLocationContext(null);
          setLocationMode("none");
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
    setIsPrivate(true);
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
    setLocationContext(null);
    setLocationMode("none");
    setResponsibleUserId(undefined);
    setNotifyAllHousehold(false);
    setPrerequisites([]);
    setShowTriggers(false);
    setShowLocation(false);
    setManualOverrides({
      type: false,
      priority: false,
      categories: false,
      dates: false,
      location: false,
      responsible: false,
    });
  }, []);

  // Quick date chips (Today / Tomorrow) — tapping the active one again clears the date
  const applyQuickDate = useCallback(
    (mode: "today" | "tomorrow") => {
      setManualOverrides((prev) => ({ ...prev, dates: true }));
      const base = new Date();
      if (mode === "tomorrow") base.setDate(base.getDate() + 1);
      const dateStr = format(base, "yyyy-MM-dd");
      if (itemType === "event") {
        if (startDate === dateStr) {
          setStartDate("");
          setStartTime("");
          setEndDate("");
          setEndTime("");
        } else {
          setStartDate(dateStr);
          setStartTime((t) => t || "09:00");
          setEndDate(dateStr);
          setEndTime((t) => t || "10:00");
        }
      } else {
        // Reminder: set the day only — time stays optional (time-of-day chips below)
        if (dueDate === dateStr) {
          setDueDate("");
          setDueTime("");
        } else {
          setDueDate(dateStr);
        }
      }
    },
    [itemType, startDate, dueDate],
  );

  // Time-of-day presets for reminders (tap active again to clear → all-day)
  const applyTimeOfDay = useCallback((time: string) => {
    setManualOverrides((prev) => ({ ...prev, dates: true }));
    setDueTime((prev) => (prev === time ? "" : time));
  }, []);

  // Location mode selector (At Home / Map link)
  const selectLocationMode = useCallback((mode: "home" | "map") => {
    setManualOverrides((prev) => ({ ...prev, location: true }));
    setLocationMode((prev) => {
      const next = prev === mode ? "none" : mode;
      if (next === "home") {
        setLocationContext("home");
        setLocation("");
      } else {
        setLocationContext(null);
      }
      return next;
    });
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
      const startingStatus: ItemStatus =
        prerequisites.length > 0 ? "dormant" : status;

      if (itemType === "event") {
        if (!startDate || !startTime || !endDate || !endTime) {
          toast.error("Add a start and end date & time for the event", {
            icon: ToastIcons.error,
          });
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
          priority,
          status: startingStatus,
          is_public: !isPrivate,
          start_at: startAtIso,
          end_at: endAtIso,
          location_context: locationContext ?? undefined,
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
      } else {
        // Reminder
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
        const input: CreateReminderInput = {
          type: "reminder",
          title: title.trim(),
          priority,
          status: startingStatus,
          is_public: !isPrivate,
          due_at: dueAtIso,
          alerts: alertInput && dueAtIso ? [alertInput] : undefined,
          recurrence_rule,
          responsible_user_id: responsibleUserId || undefined,
          notify_all_household: notifyAllHousehold || undefined,
          prerequisites: prerequisites.length > 0 ? prerequisites : undefined,
          location_context: locationContext ?? undefined,
          location_text: locationTrimmed || undefined,
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

  // Live summary chips — SVG-iconed, readable, and clickable to jump to their editor.
  // They mirror the structured fields that are currently set (not just the raw parse).
  type SummaryChip = {
    key: string;
    Icon: React.FC<{ className?: string }>;
    iconClass: string;
    label: string;
    onClick: () => void;
  };
  const buildSummaryChips = (): SummaryChip[] => {
    const chips: SummaryChip[] = [];

    if (recurrenceRule) {
      chips.push({
        key: "repeat",
        Icon: Repeat,
        iconClass: "text-green-300",
        label: getRecurrenceDescription(recurrenceRule) || "Repeats",
        onClick: () => setCustomRecurrenceOpen(true),
      });
    }
    if (locationContext === "home") {
      chips.push({
        key: "loc",
        Icon: Home,
        iconClass: "text-teal-300",
        label: "Home",
        onClick: () => setShowLocation(true),
      });
    } else if (locationMode === "map" && location) {
      chips.push({
        key: "loc",
        Icon: MapPin,
        iconClass: "text-teal-300",
        label: "Map link",
        onClick: () => setShowLocation(true),
      });
    }
    return chips;
  };

  const summaryChips = buildSummaryChips();

  // Quick-date chip active state
  const activeDateStr = itemType === "event" ? startDate : dueDate;
  const todayDateStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowDateStr = format(
    new Date(Date.now() + 24 * 60 * 60 * 1000),
    "yyyy-MM-dd",
  );
  const quickDateMode: "today" | "tomorrow" | "none" | "custom" = !activeDateStr
    ? "none"
    : activeDateStr === todayDateStr
      ? "today"
      : activeDateStr === tomorrowDateStr
        ? "tomorrow"
        : "custom";

  // ── Privacy / responsibility ──
  // Colors are person-absolute (Hard Rule #14): the current user wears the active
  // theme accent, the partner wears the opposite — so "me" follows the theme.
  const partnerMember = householdData?.members?.find((m) => !m.isCurrentUser);
  const currentUserId = householdData?.currentUserId;
  const sharedMode: "me" | "partner" | "both" = notifyAllHousehold
    ? "both"
    : responsibleUserId && responsibleUserId === partnerMember?.id
      ? "partner"
      : "me";
  const meSelectedCls = themeClasses.isPink
    ? "border-pink-400 bg-pink-500/15 text-pink-200"
    : "border-cyan-400 bg-cyan-500/15 text-cyan-200";
  const partnerSelectedCls = themeClasses.isPink
    ? "border-cyan-400 bg-cyan-500/15 text-cyan-200"
    : "border-pink-400 bg-pink-500/15 text-pink-200";

  return (
    <>
      <div className="fixed inset-0 top-16 bg-bg-dark flex flex-col">
        {/* HEADER */}
        <div
          ref={headerRef}
          className={cn(
            "fixed top-0 left-0 right-0 z-[100] bg-gradient-to-b from-bg-card-custom to-bg-medium border-b px-3 pb-2 shadow-2xl shadow-black/10 backdrop-blur-xl slide-in-top",
            themeClasses.border,
          )}
        >
          {/* ── Context chip row + close ── */}
          <div className="pt-16 flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0 -mx-1">
              <div
                ref={tagsScrollRef}
                className="overflow-x-auto scrollbar-none"
              >
                <div className="flex items-center gap-1.5 px-1 min-w-max pb-1">
                  {/* Reminder | Event toggle */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-dark/40 border border-white/10">
                    {(
                      [
                        {
                          type: "reminder" as ItemType,
                          Icon: BellIcon,
                          label: "Reminder",
                          activeCls: "bg-cyan-500/20 text-cyan-300",
                          iconCls: "text-cyan-400",
                        },
                        {
                          type: "event" as ItemType,
                          Icon: CalendarIcon,
                          label: "Event",
                          activeCls: "bg-pink-500/20 text-pink-300",
                          iconCls: "text-pink-400",
                        },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => {
                          setItemType(t.type);
                          setManualOverrides((prev) => ({ ...prev, type: true }));
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium transition-all active:scale-95",
                          itemType === t.type
                            ? t.activeCls
                            : "text-white/50 hover:bg-white/5",
                        )}
                      >
                        <t.Icon
                          className={cn(
                            "w-4 h-4",
                            itemType === t.type ? t.iconCls : "text-white/40",
                          )}
                        />
                        {t.label}
                      </button>
                    ))}
                  </div>

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
            <button
              type="button"
              onClick={resetForm}
              className={cn(
                "shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-95",
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

              {/* Summary chips — tap any to edit it */}
              {summaryChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {summaryChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onClick}
                      className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg text-xs font-medium border border-white/10 bg-bg-dark/50 text-white/90 active:scale-95 transition-transform"
                    >
                      <chip.Icon className={cn("w-3.5 h-3.5", chip.iconClass)} />
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Extracted Title Preview */}
              {parsedItem && title && (
                <div className={cn("text-sm px-1", themeClasses.textSecondary)}>
                  <span className="font-medium">Title:</span> {title}
                </div>
              )}

              {itemType === "event" ? (
                /* ── Event: Starts / Ends, presets + native pickers (no modal) ── */
                <div className="space-y-2">
                  {/* Quick day presets — set the start day (end defaults alongside) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { key: "today", label: "Today" },
                        { key: "tomorrow", label: "Tomorrow" },
                      ] as const
                    ).map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => applyQuickDate(chip.key)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-transform active:scale-95",
                          quickDateMode === chip.key
                            ? "bg-purple-500/25 border-purple-400/50 text-purple-200"
                            : "bg-bg-dark/40 border-white/10 text-white/50 hover:bg-white/5",
                        )}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  {/* Starts / Ends — aligned columns (label · date · time) */}
                  <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                      Starts
                    </span>
                    <input
                      type="date"
                      aria-label="Start date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setManualOverrides((p) => ({ ...p, dates: true }));
                      }}
                      className={cn(nativeFieldCls(!!startDate), "flex-1 min-w-0")}
                    />
                    <input
                      type="time"
                      aria-label="Start time"
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value);
                        setManualOverrides((p) => ({ ...p, dates: true }));
                      }}
                      className={cn(nativeFieldCls(!!startTime), "flex-1 min-w-0")}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                      Ends
                    </span>
                    <input
                      type="date"
                      aria-label="End date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setManualOverrides((p) => ({ ...p, dates: true }));
                      }}
                      className={cn(nativeFieldCls(!!endDate), "flex-1 min-w-0")}
                    />
                    <input
                      type="time"
                      aria-label="End time"
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value);
                        setManualOverrides((p) => ({ ...p, dates: true }));
                      }}
                      className={cn(nativeFieldCls(!!endTime), "flex-1 min-w-0")}
                    />
                  </div>
                </div>
              ) : (
                /* ── Reminder: pick a day (presets + native), then a time ── */
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { key: "today", label: "Today" },
                        { key: "tomorrow", label: "Tomorrow" },
                      ] as const
                    ).map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => applyQuickDate(chip.key)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-transform active:scale-95",
                          quickDateMode === chip.key
                            ? "bg-purple-500/25 border-purple-400/50 text-purple-200"
                            : "bg-bg-dark/40 border-white/10 text-white/50 hover:bg-white/5",
                        )}
                      >
                        {chip.label}
                      </button>
                    ))}
                    <input
                      type="date"
                      aria-label="Pick a date"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        setManualOverrides((p) => ({ ...p, dates: true }));
                      }}
                      className={nativeFieldCls(!!dueDate)}
                    />
                  </div>

                  {dueDate && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { label: "Morning", time: "09:00" },
                          { label: "Noon", time: "12:00" },
                          { label: "Afternoon", time: "15:00" },
                          { label: "Evening", time: "19:00" },
                        ] as const
                      ).map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => applyTimeOfDay(slot.time)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-transform active:scale-95",
                            dueTime === slot.time
                              ? "bg-amber-500/20 border-amber-400/50 text-amber-200"
                              : "bg-bg-dark/40 border-white/10 text-white/50 hover:bg-white/5",
                          )}
                        >
                          {slot.label}
                        </button>
                      ))}
                      {/* The time itself — shows the picked hour; tap to fine-tune.
                          Gold only when it holds a hand-picked (non-preset) time,
                          so a selected preset stays the single highlighted chip. */}
                      <button
                        type="button"
                        onClick={openTimePicker}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-transform active:scale-95",
                          hasExactTime
                            ? "bg-amber-500/20 border-amber-400/50 text-amber-200"
                            : "bg-bg-dark/40 border-white/10 text-white/50 hover:bg-white/5",
                        )}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {dueTime ? formatTimeLabel(dueTime) : "Set time"}
                      </button>
                      <input
                        ref={dueTimeRef}
                        type="time"
                        aria-hidden="true"
                        tabIndex={-1}
                        value={dueTime}
                        onChange={(e) => {
                          setDueTime(e.target.value);
                          setManualOverrides((p) => ({ ...p, dates: true }));
                        }}
                        className="sr-only"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Quick controls — big, thumb-friendly, icon-first */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  {/* Priority — color flag */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="Priority"
                      className="h-11 w-11 flex items-center justify-center rounded-xl bg-bg-dark/40 border border-white/10 active:scale-90 transition-all"
                    >
                      <FlagIcon
                        className={cn(
                          "w-5 h-5",
                          priority === "urgent"
                            ? "text-red-500"
                            : priority === "high"
                              ? "text-orange-500"
                              : priority === "low"
                                ? "text-gray-300"
                                : "text-cyan-400",
                        )}
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="center"
                    sideOffset={8}
                    className="w-auto p-2 bg-bg-card-custom border border-slate-700/60 rounded-xl shadow-2xl z-[200]"
                  >
                    <div className="flex items-center gap-2">
                      {(
                        [
                          { p: "low" as ItemPriority, color: "text-gray-300" },
                          { p: "normal" as ItemPriority, color: "text-cyan-400" },
                          { p: "high" as ItemPriority, color: "text-orange-500" },
                          { p: "urgent" as ItemPriority, color: "text-red-500" },
                        ] as const
                      ).map((it) => (
                        <button
                          key={it.p}
                          type="button"
                          title={priorityConfig[it.p].label}
                          onClick={() => {
                            setPriority(it.p);
                            setManualOverrides((prev) => ({
                              ...prev,
                              priority: true,
                            }));
                          }}
                          className={cn(
                            "h-10 w-10 flex items-center justify-center rounded-lg transition-all active:scale-90",
                            priority === it.p
                              ? "bg-white/10 ring-1 ring-white/20"
                              : "hover:bg-white/5",
                          )}
                        >
                          <FlagIcon className={cn("w-5 h-5", it.color)} />
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Location pin — toggles the At Home / Place / Map panel */}
                <button
                  type="button"
                  title="Location"
                  onClick={() => setShowLocation((v) => !v)}
                  className={cn(
                    "h-11 w-11 flex items-center justify-center rounded-xl border active:scale-90 transition-all",
                    locationContext || location
                      ? "bg-teal-500/15 border-teal-400/40"
                      : "bg-bg-dark/40 border-white/10",
                  )}
                >
                  <MapPin
                    className={cn(
                      "w-5 h-5",
                      locationContext || location
                        ? "text-teal-300"
                        : "text-white/60",
                    )}
                  />
                </button>

                {/* More — alert, repeat, triggers */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="More options"
                      className={cn(
                        "h-11 w-11 flex items-center justify-center rounded-xl border active:scale-90 transition-all",
                        alertValue.offsetMinutes > 0 ||
                        alertValue.customTime ||
                        recurrenceRule ||
                        prerequisites.length > 0
                          ? "bg-white/10 border-white/20"
                          : "bg-bg-dark/40 border-white/10",
                      )}
                    >
                      <svg
                        className="w-5 h-5 text-white/60"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <circle cx="5" cy="12" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="19" cy="12" r="2" />
                      </svg>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={8}
                    className="w-72 p-3 bg-bg-card-custom border border-slate-700/60 rounded-xl shadow-2xl z-[200] space-y-3"
                  >
                    {/* Alert */}
                    <div>
                      <Label className="text-xs text-white/60 mb-1.5 block">
                        Alert
                      </Label>
                      <SmartAlertPicker
                        value={alertValue}
                        onChange={setAlertValue}
                        eventTime={itemType === "event" ? startTime : dueTime}
                      />
                    </div>
                    {/* Repeat */}
                    <div>
                      <Label className="text-xs text-white/60 mb-1.5 block">
                        Repeat
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
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
                              "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                              recurrenceRule === preset.value
                                ? "bg-green-500/20 border-green-400/50 text-green-300"
                                : "bg-white/5 border-transparent text-white/60 hover:bg-white/10",
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setCustomRecurrenceOpen(true)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border border-transparent bg-white/5 text-white/60 hover:bg-white/10"
                        >
                          Custom…
                        </button>
                      </div>
                    </div>
                    <div className="h-px bg-slate-700/40" />
                    {/* Triggers */}
                    <button
                      type="button"
                      onClick={() => setShowTriggers((v) => !v)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-all",
                        showTriggers || prerequisites.length > 0
                          ? "text-amber-300 bg-amber-500/10"
                          : "text-white/70 hover:bg-white/5",
                      )}
                    >
                      <Zap className="w-4 h-4 text-amber-400" />
                      Triggers
                    </button>
                  </PopoverContent>
                </Popover>
                </div>

                {/* Privacy — Private ⇄ Shared, then who's responsible (partner only) */}
                {householdData?.hasPartner && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Private | Shared segmented toggle */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-dark/40 border border-white/10">
                      <button
                        type="button"
                        onClick={() => setIsPrivate(true)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium transition-all active:scale-95",
                          isPrivate
                            ? "bg-white/10 text-white"
                            : "text-white/50 hover:bg-white/5",
                        )}
                      >
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Private
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Switching to Shared defaults to "Both" responsible
                          setIsPrivate(false);
                          setNotifyAllHousehold(true);
                          if (currentUserId) setResponsibleUserId(currentUserId);
                          setManualOverrides((prev) => ({
                            ...prev,
                            responsible: true,
                          }));
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium transition-all active:scale-95",
                          !isPrivate
                            ? "bg-white/10 text-white"
                            : "text-white/50 hover:bg-white/5",
                        )}
                      >
                        <Users className="w-4 h-4" />
                        Shared
                      </button>
                    </div>

                    {/* Responsible — Me / Partner / Both (only when shared) */}
                    {!isPrivate && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setNotifyAllHousehold(false);
                            if (currentUserId)
                              setResponsibleUserId(currentUserId);
                            setManualOverrides((prev) => ({
                              ...prev,
                              responsible: true,
                            }));
                          }}
                          className={cn(
                            "px-3 h-9 rounded-lg text-sm font-medium border transition-all active:scale-95",
                            sharedMode === "me"
                              ? meSelectedCls
                              : "bg-bg-dark/40 border-white/10 text-white/50 hover:bg-white/5",
                          )}
                        >
                          Me
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifyAllHousehold(false);
                            if (partnerMember)
                              setResponsibleUserId(partnerMember.id);
                            setManualOverrides((prev) => ({
                              ...prev,
                              responsible: true,
                            }));
                          }}
                          className={cn(
                            "px-3 h-9 rounded-lg text-sm font-medium border transition-all active:scale-95",
                            sharedMode === "partner"
                              ? partnerSelectedCls
                              : "bg-bg-dark/40 border-white/10 text-white/50 hover:bg-white/5",
                          )}
                        >
                          {partnerMember?.displayName || "Partner"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifyAllHousehold(true);
                            if (currentUserId)
                              setResponsibleUserId(currentUserId);
                            setManualOverrides((prev) => ({
                              ...prev,
                              responsible: true,
                            }));
                          }}
                          className={cn(
                            "px-3 h-9 rounded-lg text-sm font-medium border transition-all active:scale-95",
                            sharedMode === "both"
                              ? "border-white/40 bg-white/10 text-white"
                              : "bg-bg-dark/40 border-white/10 text-white/50 hover:bg-white/5",
                          )}
                        >
                          Both
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── List Selector Card — events only (reminders have no categories) ── */}
            {itemType === "event" && (
            <div className="relative rounded-2xl bg-gradient-to-b from-slate-800/60 via-slate-900/40 to-transparent border border-slate-700/40 p-4 overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-violet-500/5 to-transparent rounded-bl-full pointer-events-none" />
              <div className="grid grid-cols-3 gap-2">
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
                            ? selectedCategoryIds.filter((id) => id !== cat.id)
                            : [...selectedCategoryIds, cat.id],
                        );
                        setManualOverrides((prev) => ({
                          ...prev,
                          categories: true,
                        }));
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all active:scale-95",
                        isSelected
                          ? "border-transparent"
                          : `bg-bg-dark/40 border-slate-700/30 ${themeClasses.textMuted} hover:bg-white/5`,
                      )}
                      style={
                        isSelected
                          ? {
                              background: `${cat.color_hex}18`,
                              borderColor: `${cat.color_hex}60`,
                              boxShadow: `0 0 12px ${cat.color_hex}20`,
                            }
                          : undefined
                      }
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          background: `${cat.color_hex}20`,
                          border: `1px solid ${cat.color_hex}40`,
                        }}
                      >
                        {CatIcon && (
                          <span style={{ color: cat.color_hex }}>
                            <CatIcon className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      <span
                        className="text-[11px] font-medium"
                        style={
                          isSelected ? { color: cat.color_hex } : undefined
                        }
                      >
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* ── Collapsible Sections (CSS grid transitions for smooth height) ── */}
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                showLocation ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-3 mb-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { key: "home", label: "At Home", Icon: Home },
                        { key: "map", label: "Map link", Icon: Link },
                      ] as const
                    ).map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectLocationMode(key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-95",
                          locationMode === key
                            ? "bg-teal-500/20 border-teal-400/50 text-teal-200"
                            : "bg-bg-dark/40 border-white/10 text-white/50 hover:bg-white/5",
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                  {locationMode === "map" && (
                    <Input
                      type="url"
                      inputMode="url"
                      placeholder="Paste a maps link"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setManualOverrides((prev) => ({
                          ...prev,
                          location: true,
                        }));
                      }}
                      className="text-sm bg-bg-dark/60 border-slate-700/60"
                      autoFocus
                    />
                  )}
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

      {/* Quick view modal opened from notification deep link */}
      {pendingItem && (
        <ItemDetailModal
          item={pendingItem}
          onClose={closeQuickView}
          onEdit={() => {
            setEditingItemForDialog(pendingItem);
            closeQuickView();
          }}
          onDelete={() => {
            itemActions.handleDelete(pendingItem);
            closeQuickView();
          }}
        />
      )}

      {/* Edit dialog */}
      {editingItemForDialog && (
        <WebEventFormDialog
          isOpen={!!editingItemForDialog}
          onClose={() => setEditingItemForDialog(null)}
          editItem={editingItemForDialog}
        />
      )}
    </>
  );
}
