"use client";

import { useTheme } from "@/contexts/ThemeContext";
import {
  getPostponedOccurrencesForDate,
  isOccurrenceCompleted,
  useAllOccurrenceActions,
  useItemActionsWithToast,
  type ItemOccurrenceAction,
} from "@/features/items/useItemActions";
import { useItems } from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type { ItemType, ItemWithDetails } from "@/types/items";
import {
  addDays,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock,
  Layers,
  ListTodo,
  Sparkles,
  Star,
  Target,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RRule } from "rrule";

// ============================================
// TYPES
// ============================================
interface ExpandedOccurrence {
  item: ItemWithDetails;
  occurrenceDate: Date;
  isCompleted: boolean;
  isPostponed?: boolean;
  originalDate?: Date;
}

// Type icons
const typeIcons: Record<ItemType, typeof Calendar> = {
  reminder: Bell,
  event: Calendar,
  task: ListTodo,
};

// Time scope for Today/This Week
type TimeScope = "today" | "week";

const timeScopeLabels: Record<TimeScope, string> = {
  today: "Today",
  week: "This Week",
};

// Sort modes
type SortMode = "time" | "priority" | "category";

// View modes for testing
type ViewMode =
  | "briefing"
  | "timeline"
  | "cards"
  | "editorial"
  | "minimal"
  | "grid"
  | "agenda"
  | "list"
  | "focus"
  | "kanban";

const viewModeLabels: Record<ViewMode, string> = {
  briefing: "Briefing",
  timeline: "Timeline",
  cards: "Cards",
  editorial: "Editorial",
  minimal: "Minimal",
  grid: "Grid",
  agenda: "Agenda",
  list: "List",
  focus: "Focus",
  kanban: "Kanban",
};

// Priority levels (inferred from keywords)
const getPriorityLevel = (item: ItemWithDetails): number => {
  const title = item.title.toLowerCase();
  const desc = (item.description || "").toLowerCase();
  const combined = `${title} ${desc}`;

  // High priority indicators
  if (
    combined.includes("urgent") ||
    combined.includes("asap") ||
    combined.includes("important") ||
    combined.includes("critical")
  )
    return 3;
  if (
    combined.includes("meeting") ||
    combined.includes("call") ||
    combined.includes("deadline")
  )
    return 2;
  return 1;
};

// Category groupings
const getCategoryGroup = (item: ItemWithDetails): string => {
  const title = item.title.toLowerCase();
  if (
    title.includes("meeting") ||
    title.includes("call") ||
    title.includes("sync")
  )
    return "Meetings";
  if (
    title.includes("gym") ||
    title.includes("workout") ||
    title.includes("exercise")
  )
    return "Health";
  if (
    title.includes("birthday") ||
    title.includes("family") ||
    title.includes("mom") ||
    title.includes("dad")
  )
    return "Personal";
  if (
    title.includes("deadline") ||
    title.includes("project") ||
    title.includes("proposal") ||
    title.includes("draft")
  )
    return "Work";
  return "Other";
};

// Morning greetings based on time
const getGreeting = (hour: number): { emoji: string; text: string } => {
  if (hour < 5) return { emoji: "🌙", text: "Working late?" };
  if (hour < 12) return { emoji: "👋", text: "Good Morning!" };
  if (hour < 17) return { emoji: "☀️", text: "Good Afternoon!" };
  if (hour < 21) return { emoji: "🌆", text: "Good Evening!" };
  return { emoji: "🌙", text: "Winding Down" };
};

// ============================================
// HELPERS
// ============================================
function getItemDate(item: ItemWithDetails): Date | null {
  const dateStr =
    item.type === "reminder" || item.type === "task"
      ? item.reminder_details?.due_at
      : item.type === "event"
        ? item.event_details?.start_at
        : null;
  return dateStr ? parseISO(dateStr) : null;
}

function buildFullRRuleString(
  startDate: Date,
  recurrenceRule: { rrule: string }
): string {
  const dtstart = `DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss")}`;
  const rrule = recurrenceRule.rrule.startsWith("RRULE:")
    ? recurrenceRule.rrule
    : `RRULE:${recurrenceRule.rrule}`;
  return `${dtstart}\n${rrule}`;
}

function expandRecurringItems(
  items: ItemWithDetails[],
  startDate: Date,
  endDate: Date,
  actions: ItemOccurrenceAction[]
): ExpandedOccurrence[] {
  const result: ExpandedOccurrence[] = [];

  for (const item of items) {
    const itemDate = getItemDate(item);
    if (!itemDate) continue;

    if (item.recurrence_rule?.rrule) {
      try {
        const rruleString = buildFullRRuleString(
          itemDate,
          item.recurrence_rule
        );
        const rule = RRule.fromString(rruleString);
        const occurrences = rule.between(startDate, endDate, true);

        for (const occ of occurrences) {
          const isCompleted = isOccurrenceCompleted(item.id, occ, actions);
          result.push({
            item,
            occurrenceDate: occ,
            isCompleted,
          });
        }
      } catch (error) {
        console.error("Error parsing RRULE:", error);
      }
    } else if (isWithinInterval(itemDate, { start: startDate, end: endDate })) {
      const isCompleted =
        item.status === "completed" ||
        isOccurrenceCompleted(item.id, itemDate, actions);
      result.push({
        item,
        occurrenceDate: itemDate,
        isCompleted,
      });
    }
  }

  // Add postponed occurrences
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayPostponed = getPostponedOccurrencesForDate(
      items,
      currentDate,
      actions
    );
    for (const p of dayPostponed) {
      const alreadyExists = result.some(
        (r) =>
          r.item.id === p.item.id &&
          isSameDay(r.occurrenceDate, p.occurrenceDate)
      );
      if (!alreadyExists) {
        result.push({
          item: p.item,
          occurrenceDate: p.occurrenceDate,
          isCompleted: false,
          isPostponed: true,
          originalDate: p.originalDate,
        });
      }
    }
    currentDate = addDays(currentDate, 1);
  }

  return result.sort(
    (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime()
  );
}

// ============================================
// MAIN TODAY VIEW - Multi-Mode Experience
// ============================================
export default function WebTodayView() {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const itemActions = useItemActionsWithToast();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>("briefing");
  const [timeScope, setTimeScope] = useState<TimeScope>("today");
  const [sortMode, setSortMode] = useState<SortMode>("time");
  const [showOverdue, setShowOverdue] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechQueueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const currentUtteranceIndexRef = useRef(0);

  // Get the best available US English voice
  const getPreferredVoice = useCallback(() => {
    if (!("speechSynthesis" in window)) return null;

    const voices = window.speechSynthesis.getVoices();

    // Prioritize high-quality natural US English voices
    const preferredVoices = [
      "Samantha", // macOS - very natural US female
      "Allison", // macOS - US female
      "Ava", // macOS - US female
      "Google US English", // Chrome - good quality
      "Microsoft Jenny", // Windows 11 - US conversational
      "Microsoft Aria", // Windows 11 - US natural
      "Microsoft Zira", // Windows - US clear female
    ];

    for (const pv of preferredVoices) {
      const found = voices.find((v) => v.name.includes(pv));
      if (found) return found;
    }

    // Fallback to first US English voice, then any English
    return (
      voices.find((v) => v.lang === "en-US") ||
      voices.find((v) => v.lang.startsWith("en")) ||
      null
    );
  }, []);

  // Transform text into natural, human-like conversational speech
  const prepareTextForSpeech = useCallback((text: string): string => {
    // Step 1: Remove all emojis completely
    const emojiRegex =
      /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
    let speech = text.replace(emojiRegex, "");

    // Step 2: Handle quoted task names - replace quotes with spoken emphasis
    // "test 7" becomes: the task called test 7
    speech = speech.replace(/"([^"]+)"/g, (_, taskName) => {
      return taskName; // Just use the task name without quotes
    });

    // Step 3: Clean up formatting
    speech = speech.replace(/[•●▸▹►]/g, "");
    speech = speech.replace(/\s*[–—]\s*/g, ", ");

    // Step 4: Handle times naturally
    // 7:00 PM -> 7 PM, 11:01 PM -> 11 oh 1 PM
    speech = speech.replace(/(\d+):00\s*(AM|PM)/gi, "$1 $2");
    speech = speech.replace(/(\d+):0(\d)\s*(AM|PM)/gi, "$1 oh $2 $3"); // 11:01 -> 11 oh 1
    speech = speech.replace(/(\d+):(\d{2})\s*(AM|PM)/gi, "$1 $2 $3");

    // Step 5: Handle the "at X:XX PM:" pattern - remove the trailing colon
    speech = speech.replace(/at (\d+(?::\d+)?\s*(?:AM|PM)):/gi, "at $1,");

    // Step 6: Transform numbered lists into flowing speech
    // "1. test\n2. test 2\n3. test 3" -> "test, then test 2, and finally test 3"
    speech = speech.replace(/\n\s*1\.\s*/g, "\n");
    speech = speech.replace(/\n\s*2\.\s*/g, ", then ");
    speech = speech.replace(/\n\s*3\.\s*/g, ", and ");
    speech = speech.replace(/\n\s*(\d+)\.\s*/g, ", also ");

    // Step 7: Clean up newlines into natural pauses (commas)
    speech = speech.replace(/\n+/g, ", ");

    // Step 8: Make phrases conversational and warm
    const conversationalMap: [RegExp, string][] = [
      // Opening/status
      [
        /(\d+) items? remains? for the rest of today/gi,
        "you've got $1 more things to get through today",
      ],
      [/(\d+) items? remain/gi, "$1 things left to go"],
      [/You have (\d+) items?/gi, "you've got $1 things"],
      [/No scheduled/gi, "nothing scheduled"],
      [/Your schedule is clear/gi, "you're all clear"],

      // Current/Next indicators
      [/Currently:\s*/gi, "Right now you're on "],
      [/Next up at/gi, "After that, at"],
      [/Next up/gi, "Up next is"],

      // Priority section
      [/Key priorities for today:\s*/gi, "And your top priorities are: "],
      [/Top priorities:\s*/gi, "The main things are: "],

      // Reminders
      [/Don't forget/gi, "Oh and don't forget"],
      [/Heads up/gi, "Just a heads up"],

      // Polish
      [/First up at/gi, "First thing at"],
      [/Starting at/gi, "kicking off at"],
    ];

    for (const [pattern, replacement] of conversationalMap) {
      speech = speech.replace(pattern, replacement);
    }

    // Step 9: Clean up multiple spaces and punctuation
    speech = speech.replace(/,\s*,/g, ",");
    speech = speech.replace(/\.\s*\./g, ".");
    speech = speech.replace(/,\s*\./g, ".");
    speech = speech.replace(/\s+/g, " ");
    speech = speech.replace(/^\s*,\s*/g, "");
    speech = speech.replace(/\s*,\s*$/g, "");

    // Step 10: Add natural breathing points (longer pauses) at key transitions
    // These will create natural paragraph-like breaks
    speech = speech.replace(
      /(today|tonight|this morning)[.,]\s*/gi,
      "$1. ... "
    );
    speech = speech.replace(/(And your top priorities are:)/gi, "... $1");
    speech = speech.replace(/(Up next is)/gi, "... $1");
    speech = speech.replace(/(After that)/gi, "... $1");

    return speech.trim();
  }, []);

  // Speak the briefing naturally as one flowing conversation
  const speakBriefing = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) {
        console.warn("Text-to-speech not supported in this browser");
        return;
      }

      // Stop any ongoing speech
      window.speechSynthesis.cancel();

      if (isSpeaking) {
        setIsSpeaking(false);
        return;
      }

      const speechText = prepareTextForSpeech(text);
      const voice = getPreferredVoice();

      const utterance = new SpeechSynthesisUtterance(speechText);

      if (voice) {
        utterance.voice = voice;
      }

      // Natural, warm, conversational settings
      // Like a friendly assistant chatting with you
      utterance.rate = 1.0; // Natural speaking pace
      utterance.pitch = 1.0; // Natural pitch
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [isSpeaking, prepareTextForSpeech, getPreferredVoice]
  );

  // Stop speaking when component unmounts or view changes
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [viewMode]);

  // Load voices (needed for some browsers)
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Update time every minute for live updates
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();

  const today = startOfDay(new Date());
  const currentHour = new Date().getHours();

  // Filter active items
  const activeItems = useMemo(() => {
    return allItems.filter(
      (item) =>
        item.status !== "archived" &&
        item.status !== "cancelled" &&
        !item.archived_at
    );
  }, [allItems]);

  // Get tasks based on time scope (today or week)
  const { scopedTasks, overdueTasks, weekStart, weekEnd } = useMemo(() => {
    // Calculate date ranges
    const todayEnd = addDays(today, 1);
    const wStart = startOfWeek(today, { weekStartsOn: 1 });
    const wEnd = endOfWeek(today, { weekStartsOn: 1 });

    // Get tasks for the selected scope
    const scopeStart = timeScope === "today" ? today : wStart;
    const scopeEnd = timeScope === "today" ? todayEnd : addDays(wEnd, 1);

    const scopedOccs = expandRecurringItems(
      activeItems,
      scopeStart,
      scopeEnd,
      occurrenceActions
    );

    const pastStart = addDays(today, -30);
    const allPastOccs = expandRecurringItems(
      activeItems,
      pastStart,
      today,
      occurrenceActions
    );
    const overdueOccs = allPastOccs.filter(
      (occ) => isBefore(occ.occurrenceDate, today) && !occ.isCompleted
    );

    // Sort based on selected mode
    let sortedTasks = scopedOccs.filter((o) => !o.isCompleted);

    if (sortMode === "time") {
      sortedTasks.sort(
        (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime()
      );
    } else if (sortMode === "priority") {
      sortedTasks.sort((a, b) => {
        const priorityDiff =
          getPriorityLevel(b.item) - getPriorityLevel(a.item);
        if (priorityDiff !== 0) return priorityDiff;
        return a.occurrenceDate.getTime() - b.occurrenceDate.getTime();
      });
    } else if (sortMode === "category") {
      sortedTasks.sort((a, b) => {
        const catA = getCategoryGroup(a.item);
        const catB = getCategoryGroup(b.item);
        if (catA !== catB) return catA.localeCompare(catB);
        return a.occurrenceDate.getTime() - b.occurrenceDate.getTime();
      });
    }

    return {
      scopedTasks: sortedTasks,
      overdueTasks: overdueOccs,
      weekStart: wStart,
      weekEnd: wEnd,
    };
  }, [activeItems, occurrenceActions, today, timeScope, sortMode]);

  // Alias for backward compatibility with existing views
  const todayTasks = scopedTasks;

  // Compute day/week boundaries
  const dayInfo = useMemo(() => {
    if (scopedTasks.length === 0) return null;
    const firstTask = scopedTasks[0];
    const lastTask = scopedTasks[scopedTasks.length - 1];
    return {
      startsAt: format(firstTask.occurrenceDate, "h:mm a"),
      endsAt: format(lastTask.occurrenceDate, "h:mm a"),
      totalItems: scopedTasks.length,
    };
  }, [scopedTasks]);

  // AI Briefing Data - JARVIS style
  const briefingData = useMemo(() => {
    const now = currentTime;
    const hour = now.getHours();
    const greeting = getGreeting(hour);

    // Get today's tasks only for the briefing
    const todayEnd = addDays(today, 1);
    const todayOnly = expandRecurringItems(
      activeItems,
      today,
      todayEnd,
      occurrenceActions
    )
      .filter((o) => !o.isCompleted)
      .sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime());

    // Find NOW (current or most recent past task today)
    // and NEXT (upcoming task)
    let nowTask: ExpandedOccurrence | null = null;
    let nextTask: ExpandedOccurrence | null = null;

    for (let i = 0; i < todayOnly.length; i++) {
      const task = todayOnly[i];
      const taskTime = task.occurrenceDate.getTime();
      const nowTime = now.getTime();

      // Task is in the past or happening now (within 30 min window)
      if (taskTime <= nowTime && taskTime >= nowTime - 30 * 60 * 1000) {
        nowTask = task;
        nextTask = todayOnly[i + 1] || null;
        break;
      }
      // Task is in the future
      if (taskTime > nowTime) {
        if (i === 0) {
          // First task is in the future, no "now" task
          nextTask = task;
        } else {
          // Previous task might be "now"
          nowTask = todayOnly[i - 1];
          nextTask = task;
        }
        break;
      }
    }

    // If all tasks are in the past
    if (!nowTask && !nextTask && todayOnly.length > 0) {
      nowTask = todayOnly[todayOnly.length - 1];
    }

    // Top 3 priorities (by priority level, then time)
    const topPriorities = [...todayOnly]
      .sort((a, b) => {
        const priorityDiff =
          getPriorityLevel(b.item) - getPriorityLevel(a.item);
        if (priorityDiff !== 0) return priorityDiff;
        return a.occurrenceDate.getTime() - b.occurrenceDate.getTime();
      })
      .slice(0, 3);

    // Time-sensitive items (happening in next 2 hours)
    const timeSensitive = todayOnly.filter((t) => {
      const taskTime = t.occurrenceDate.getTime();
      return (
        taskTime > now.getTime() &&
        taskTime <= now.getTime() + 2 * 60 * 60 * 1000
      );
    });

    // Group by category
    const byCategory = todayOnly.reduce(
      (acc, task) => {
        const cat = getCategoryGroup(task.item);
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(task);
        return acc;
      },
      {} as Record<string, ExpandedOccurrence[]>
    );

    return {
      greeting,
      now: nowTask,
      next: nextTask,
      topPriorities,
      timeSensitive,
      byCategory,
      totalToday: todayOnly.length,
      completedToday: 0, // Would need completion tracking
      hour,
    };
  }, [currentTime, activeItems, occurrenceActions, today]);

  // Generate JARVIS-style narrative briefing
  const narrative = useMemo(() => {
    const {
      greeting,
      now,
      next,
      topPriorities,
      timeSensitive,
      totalToday,
      hour,
    } = briefingData;

    if (totalToday === 0) {
      const freeMessages = [
        "Your schedule is clear. A perfect opportunity to focus on what matters most to you.",
        "No scheduled commitments ahead. You have complete freedom to shape this time.",
        "All clear on the horizon. Perhaps a good moment for deep work or strategic planning.",
      ];
      return freeMessages[Math.floor(hour / 8) % 3];
    }

    const parts: string[] = [];

    // Opening with context
    if (hour < 12) {
      parts.push(
        `You have ${totalToday} ${totalToday === 1 ? "item" : "items"} on your agenda today.`
      );
    } else {
      const remaining = scopedTasks.filter(
        (t) => t.occurrenceDate > currentTime
      ).length;
      if (remaining > 0) {
        parts.push(
          `${remaining} ${remaining === 1 ? "item remains" : "items remain"} for the rest of today.`
        );
      } else {
        parts.push("You've made it through today's schedule. Well done.");
      }
    }

    // Current focus
    if (now) {
      parts.push(
        `\n\n🎯 Currently: "${now.item.title}" at ${format(now.occurrenceDate, "h:mm a")}.`
      );
    }

    // What's next
    if (next) {
      const timeUntil = Math.round(
        (next.occurrenceDate.getTime() - currentTime.getTime()) / (1000 * 60)
      );
      if (timeUntil <= 60) {
        parts.push(`\n\n⏰ In ${timeUntil} minutes: "${next.item.title}".`);
      } else {
        parts.push(
          `\n\n📍 Next up at ${format(next.occurrenceDate, "h:mm a")}: "${next.item.title}".`
        );
      }
    }

    // Top priorities callout
    if (topPriorities.length > 0 && totalToday > 1) {
      parts.push("\n\n⭐ Key priorities for today:");
      topPriorities.forEach((task, idx) => {
        parts.push(`\n  ${idx + 1}. ${task.item.title}`);
      });
    }

    // Time-sensitive warning
    if (timeSensitive.length > 1) {
      parts.push(
        `\n\n💡 Heads up: You have ${timeSensitive.length} items coming up in the next 2 hours.`
      );
    }

    // Things to prepare
    const thingsToTake = scopedTasks.filter(
      (t) =>
        t.item.title.toLowerCase().includes("give") ||
        t.item.title.toLowerCase().includes("bring") ||
        t.item.title.toLowerCase().includes("take") ||
        t.item.title.toLowerCase().includes("deliver") ||
        t.item.title.toLowerCase().includes("birthday")
    );

    if (thingsToTake.length > 0) {
      parts.push("\n\n📦 Don't forget to prepare:");
      thingsToTake.forEach((t) => {
        parts.push(
          `\n  • ${t.item.title} (${format(t.occurrenceDate, "h:mm a")})`
        );
      });
    }

    return parts.join("");
  }, [briefingData, scopedTasks, currentTime]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            isFrost ? "bg-indigo-400" : isPink ? "bg-pink-400" : "bg-cyan-400"
          )}
        />
      </div>
    );
  }

  const accentColor = isFrost ? "indigo" : isPink ? "pink" : "cyan";

  // ==========================================
  // BRIEFING VIEW - JARVIS-style Day at a Glance
  // ==========================================
  const renderBriefingView = () => {
    const {
      greeting,
      now,
      next,
      topPriorities,
      byCategory,
      totalToday,
      timeSensitive,
    } = briefingData;

    return (
      <div className="px-4 py-4 space-y-4">
        {/* Greeting Section - Clean and minimal */}
        <div className="mb-2">
          <p
            className={cn(
              "text-lg font-medium mb-1",
              isFrost ? "text-slate-700" : "text-white/90"
            )}
          >
            {greeting.emoji} {greeting.text}
          </p>
          <h1
            className={cn(
              "text-sm",
              isFrost ? "text-slate-500" : "text-white/50"
            )}
          >
            {totalToday === 0 ? (
              "Your schedule is clear. A perfect opportunity for focused work."
            ) : (
              <>
                You have{" "}
                <span className="font-medium">
                  {totalToday} {totalToday === 1 ? "item" : "items"}
                </span>{" "}
                scheduled
                {timeScope === "today" ? " today" : " this week"}.
                {dayInfo && ` First up at ${dayInfo.startsAt}.`}
              </>
            )}
          </h1>
        </div>

        {/* NOW / NEXT / TOP 3 Widget Row */}
        {totalToday > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* NOW Card */}
            <div
              className={cn(
                "rounded-xl p-4 border-l-4",
                isFrost
                  ? "bg-white border-l-emerald-500 shadow-sm"
                  : "bg-white/[0.04] border-l-emerald-500 border border-white/[0.08]"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    isFrost
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-emerald-500/20 text-emerald-400"
                  )}
                >
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    isFrost ? "text-emerald-600" : "text-emerald-400"
                  )}
                >
                  NOW
                </span>
              </div>
              {now ? (
                <>
                  <h3
                    className={cn(
                      "font-semibold text-sm mb-1 line-clamp-2",
                      isFrost ? "text-slate-800" : "text-white"
                    )}
                  >
                    {now.item.title}
                  </h3>
                  <p
                    className={cn(
                      "text-xs",
                      isFrost ? "text-slate-500" : "text-white/50"
                    )}
                  >
                    @ {format(now.occurrenceDate, "h:mm a")}
                  </p>
                </>
              ) : (
                <p
                  className={cn(
                    "text-sm",
                    isFrost ? "text-slate-400" : "text-white/40"
                  )}
                >
                  Nothing active right now
                </p>
              )}
            </div>

            {/* NEXT Card */}
            <div
              className={cn(
                "rounded-xl p-4 border-l-4",
                isFrost
                  ? "bg-white border-l-blue-500 shadow-sm"
                  : "bg-white/[0.04] border-l-blue-500 border border-white/[0.08]"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    isFrost
                      ? "bg-blue-100 text-blue-600"
                      : "bg-blue-500/20 text-blue-400"
                  )}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    isFrost ? "text-blue-600" : "text-blue-400"
                  )}
                >
                  NEXT
                </span>
              </div>
              {next ? (
                <>
                  <h3
                    className={cn(
                      "font-semibold text-sm mb-1 line-clamp-2",
                      isFrost ? "text-slate-800" : "text-white"
                    )}
                  >
                    {next.item.title}
                  </h3>
                  <p
                    className={cn(
                      "text-xs",
                      isFrost ? "text-slate-500" : "text-white/50"
                    )}
                  >
                    @ {format(next.occurrenceDate, "h:mm a")}
                  </p>
                </>
              ) : (
                <p
                  className={cn(
                    "text-sm",
                    isFrost ? "text-slate-400" : "text-white/40"
                  )}
                >
                  Nothing coming up
                </p>
              )}
            </div>

            {/* Top 3 Priorities Card */}
            <div
              className={cn(
                "rounded-xl p-4 border-l-4",
                isFrost
                  ? "bg-white border-l-amber-500 shadow-sm"
                  : "bg-white/[0.04] border-l-amber-500 border border-white/[0.08]"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    isFrost
                      ? "bg-amber-100 text-amber-600"
                      : "bg-amber-500/20 text-amber-400"
                  )}
                >
                  <Star className="w-3.5 h-3.5" />
                </div>
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    isFrost ? "text-amber-600" : "text-amber-400"
                  )}
                >
                  Top Priorities
                </span>
              </div>
              {topPriorities.length > 0 ? (
                <ul className="space-y-1">
                  {topPriorities.slice(0, 3).map((task, idx) => (
                    <li
                      key={`priority-${task.item.id}-${idx}`}
                      className={cn(
                        "text-xs flex items-start gap-1.5",
                        isFrost ? "text-slate-600" : "text-white/70"
                      )}
                    >
                      <span
                        className={cn(
                          "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold",
                          isFrost
                            ? "bg-slate-100 text-slate-500"
                            : "bg-white/10 text-white/50"
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span className="line-clamp-1">{task.item.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p
                  className={cn(
                    "text-sm",
                    isFrost ? "text-slate-400" : "text-white/40"
                  )}
                >
                  No priorities set
                </p>
              )}
            </div>
          </div>
        )}

        {/* Time-Sensitive Alert */}
        {timeSensitive.length > 0 && (
          <div
            className={cn(
              "rounded-xl p-4 flex items-start gap-3",
              isFrost
                ? "bg-orange-50 border border-orange-100"
                : "bg-orange-500/10 border border-orange-500/20"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                isFrost
                  ? "bg-orange-100 text-orange-600"
                  : "bg-orange-500/20 text-orange-400"
              )}
            >
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4
                className={cn(
                  "font-semibold text-sm mb-1",
                  isFrost ? "text-orange-800" : "text-orange-300"
                )}
              >
                Don't miss these coming up
              </h4>
              <div className="space-y-1">
                {timeSensitive.slice(0, 3).map((task, idx) => (
                  <p
                    key={`urgent-${task.item.id}-${idx}`}
                    className={cn(
                      "text-xs flex items-center gap-2",
                      isFrost ? "text-orange-700" : "text-orange-300/80"
                    )}
                  >
                    <span className="font-medium">
                      {format(task.occurrenceDate, "h:mm a")}
                    </span>
                    <ChevronRight className="w-3 h-3 opacity-50" />
                    <span>{task.item.title}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Summary Section - Immersive Reading */}
        <div
          className={cn(
            "rounded-xl p-5",
            isFrost
              ? "bg-gradient-to-br from-slate-50 to-indigo-50/50 border border-slate-100"
              : "bg-gradient-to-br from-white/[0.03] to-cyan-500/[0.03] border border-white/[0.06]"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  isFrost
                    ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white"
                    : isPink
                      ? "bg-gradient-to-br from-pink-500 to-purple-500 text-white"
                      : "bg-gradient-to-br from-cyan-500 to-blue-500 text-white"
                )}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <h3
                className={cn(
                  "font-semibold text-sm",
                  isFrost ? "text-slate-700" : "text-white/90"
                )}
              >
                Your Personal Briefing
              </h3>
            </div>

            {/* Speak Button */}
            <button
              type="button"
              onClick={() => speakBriefing(narrative)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                isSpeaking
                  ? isFrost
                    ? "bg-indigo-100 text-indigo-600"
                    : isPink
                      ? "bg-pink-500/20 text-pink-400"
                      : "bg-cyan-500/20 text-cyan-400"
                  : isFrost
                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    : "bg-white/[0.05] text-white/60 hover:bg-white/[0.1]"
              )}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Listen</span>
                </>
              )}
            </button>
          </div>
          <p
            className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap",
              isFrost ? "text-slate-600" : "text-white/70"
            )}
            style={{ fontFamily: "'Georgia', serif" }}
          >
            {narrative}
          </p>
        </div>

        {/* Category Breakdown */}
        {Object.keys(byCategory).length > 0 && (
          <div>
            <h3
              className={cn(
                "text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2",
                isFrost ? "text-slate-400" : "text-white/40"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              By Category
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(byCategory).map(([category, tasks]) => (
                <div
                  key={category}
                  className={cn(
                    "rounded-lg p-3",
                    isFrost
                      ? "bg-white border border-slate-100 shadow-sm"
                      : "bg-white/[0.03] border border-white/[0.06]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isFrost ? "text-slate-600" : "text-white/70"
                      )}
                    >
                      {category}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        isFrost
                          ? "bg-slate-100 text-slate-500"
                          : "bg-white/10 text-white/50"
                      )}
                    >
                      {tasks.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {tasks.slice(0, 2).map((task, idx) => (
                      <p
                        key={`cat-${task.item.id}-${idx}`}
                        className={cn(
                          "text-[11px] truncate",
                          isFrost ? "text-slate-400" : "text-white/40"
                        )}
                      >
                        {task.item.title}
                      </p>
                    ))}
                    {tasks.length > 2 && (
                      <p
                        className={cn(
                          "text-[10px]",
                          isFrost ? "text-slate-300" : "text-white/20"
                        )}
                      >
                        +{tasks.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Schedule Preview */}
        {totalToday > 0 && (
          <div>
            <h3
              className={cn(
                "text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2",
                isFrost ? "text-slate-400" : "text-white/40"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {timeScope === "today" ? "Today's" : "This Week's"} Schedule
            </h3>
            <div
              className={cn(
                "rounded-xl overflow-hidden divide-y",
                isFrost
                  ? "bg-white border border-slate-100 divide-slate-50"
                  : "bg-white/[0.02] border border-white/[0.06] divide-white/[0.04]"
              )}
            >
              {scopedTasks.slice(0, 5).map((occ, idx) => {
                const { item, occurrenceDate } = occ;
                const Icon = typeIcons[item.type];
                const isTaskToday = isToday(occurrenceDate);

                return (
                  <div
                    key={`schedule-${item.id}-${idx}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      isFrost ? "hover:bg-slate-50" : "hover:bg-white/[0.02]"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        item.type === "event" &&
                          (isFrost
                            ? "bg-pink-50 text-pink-500"
                            : "bg-pink-500/10 text-pink-400"),
                        item.type === "reminder" &&
                          (isFrost
                            ? "bg-cyan-50 text-cyan-500"
                            : "bg-cyan-500/10 text-cyan-400"),
                        item.type === "task" &&
                          (isFrost
                            ? "bg-purple-50 text-purple-500"
                            : "bg-purple-500/10 text-purple-400")
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4
                        className={cn(
                          "text-sm font-medium truncate",
                          isFrost ? "text-slate-800" : "text-white"
                        )}
                      >
                        {item.title}
                      </h4>
                      {item.description && (
                        <p
                          className={cn(
                            "text-xs truncate",
                            isFrost ? "text-slate-400" : "text-white/40"
                          )}
                        >
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={cn(
                          "text-xs font-medium tabular-nums",
                          isFrost ? "text-slate-600" : "text-white/70"
                        )}
                      >
                        {format(occurrenceDate, "h:mm a")}
                      </p>
                      {timeScope === "week" && !isTaskToday && (
                        <p
                          className={cn(
                            "text-[10px]",
                            isFrost ? "text-slate-400" : "text-white/40"
                          )}
                        >
                          {format(occurrenceDate, "EEE")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {scopedTasks.length > 5 && (
                <div
                  className={cn(
                    "px-4 py-2 text-center",
                    isFrost ? "bg-slate-50" : "bg-white/[0.01]"
                  )}
                >
                  <p
                    className={cn(
                      "text-xs",
                      isFrost ? "text-slate-400" : "text-white/40"
                    )}
                  >
                    +{scopedTasks.length - 5} more items
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {totalToday === 0 && (
          <div
            className={cn(
              "text-center py-8 rounded-xl",
              isFrost
                ? "bg-white border border-slate-100"
                : "bg-white/[0.02] border border-white/[0.06]"
            )}
          >
            <div
              className={cn(
                "w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center",
                isFrost
                  ? "bg-slate-100 text-slate-400"
                  : "bg-white/5 text-white/20"
              )}
            >
              <Target className="w-8 h-8" />
            </div>
            <h3
              className={cn(
                "font-semibold mb-1",
                isFrost ? "text-slate-700" : "text-white/80"
              )}
            >
              All Clear
            </h3>
            <p
              className={cn(
                "text-sm",
                isFrost ? "text-slate-400" : "text-white/40"
              )}
            >
              No {timeScope === "today" ? "tasks for today" : "tasks this week"}
              . Enjoy your free time!
            </p>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // VIEW 1: TIMELINE - Visual journey of your day
  // ==========================================
  const renderTimelineView = () => (
    <div className="px-3 py-3 space-y-0">
      {todayTasks.length === 0 ? (
        <div
          className={cn(
            "text-center py-8",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          <p>Nothing scheduled</p>
        </div>
      ) : (
        todayTasks.map((occ, idx) => {
          const { item, occurrenceDate } = occ;
          const Icon = typeIcons[item.type];
          const isLast = idx === todayTasks.length - 1;

          return (
            <div key={`${item.id}-${idx}`} className="flex gap-3">
              {/* Timeline spine */}
              <div className="flex flex-col items-center w-10 flex-shrink-0">
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums",
                    isFrost ? "text-slate-500" : "text-white/60"
                  )}
                >
                  {format(occurrenceDate, "h:mm")}
                </span>
                <span
                  className={cn(
                    "text-[9px] uppercase",
                    isFrost ? "text-slate-400" : "text-white/30"
                  )}
                >
                  {format(occurrenceDate, "a")}
                </span>
                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "w-px flex-1 my-1.5 min-h-[24px]",
                      isFrost ? "bg-slate-200" : "bg-white/10"
                    )}
                  />
                )}
              </div>

              {/* Content card */}
              <div className={cn("flex-1 pb-3", isLast && "pb-0")}>
                <div
                  className={cn(
                    "rounded-xl p-3",
                    isFrost
                      ? "bg-white shadow-sm border border-slate-100"
                      : "bg-white/[0.03] border border-white/[0.06]"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
                        item.type === "event" &&
                          (isFrost
                            ? "bg-pink-50 text-pink-500"
                            : "bg-pink-500/10 text-pink-400"),
                        item.type === "reminder" &&
                          (isFrost
                            ? "bg-cyan-50 text-cyan-500"
                            : "bg-cyan-500/10 text-cyan-400"),
                        item.type === "task" &&
                          (isFrost
                            ? "bg-purple-50 text-purple-500"
                            : "bg-purple-500/10 text-purple-400")
                      )}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className={cn(
                          "text-sm font-medium leading-tight",
                          isFrost ? "text-slate-800" : "text-white"
                        )}
                      >
                        {item.title}
                      </h3>
                      {item.description && (
                        <p
                          className={cn(
                            "text-xs mt-0.5 line-clamp-2",
                            isFrost ? "text-slate-500" : "text-white/50"
                          )}
                        >
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // ==========================================
  // VIEW 2: CARDS - Compact stacked cards
  // ==========================================
  const renderCardsView = () => (
    <div className="px-3 py-3 space-y-2">
      {todayTasks.length === 0 ? (
        <div
          className={cn(
            "text-center py-8",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          <p>Nothing scheduled</p>
        </div>
      ) : (
        todayTasks.map((occ, idx) => {
          const { item, occurrenceDate } = occ;
          const Icon = typeIcons[item.type];

          return (
            <div
              key={`${item.id}-${idx}`}
              className={cn(
                "rounded-xl p-3",
                isFrost
                  ? "bg-white shadow-sm border border-slate-100"
                  : "bg-white/[0.04] border border-white/[0.08]"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
                      item.type === "event" &&
                        (isFrost
                          ? "bg-pink-50 text-pink-500"
                          : "bg-pink-500/10 text-pink-400"),
                      item.type === "reminder" &&
                        (isFrost
                          ? "bg-cyan-50 text-cyan-500"
                          : "bg-cyan-500/10 text-cyan-400"),
                      item.type === "task" &&
                        (isFrost
                          ? "bg-purple-50 text-purple-500"
                          : "bg-purple-500/10 text-purple-400")
                    )}
                  >
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className={cn(
                        "text-sm font-medium truncate",
                        isFrost ? "text-slate-800" : "text-white"
                      )}
                    >
                      {item.title}
                    </h3>
                    {item.description && (
                      <p
                        className={cn(
                          "text-xs truncate",
                          isFrost ? "text-slate-500" : "text-white/50"
                        )}
                      >
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums flex-shrink-0",
                    isFrost ? "text-slate-500" : "text-white/60"
                  )}
                >
                  {format(occurrenceDate, "h:mm a")}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // ==========================================
  // VIEW 3: EDITORIAL - Newspaper style (compact)
  // ==========================================
  const renderEditorialView = () => (
    <div className="px-3 py-4">
      {/* Masthead */}
      <div
        className={cn(
          "text-center pb-3 mb-3 border-b",
          isFrost ? "border-slate-200" : "border-white/10"
        )}
      >
        <p
          className={cn(
            "text-[10px] uppercase tracking-[0.15em] mb-0.5",
            isFrost ? "text-slate-400" : "text-white/30"
          )}
        >
          {format(today, "EEEE")}
        </p>
        <h1
          className={cn(
            "text-xl font-serif font-bold",
            isFrost ? "text-slate-800" : "text-white"
          )}
        >
          {format(today, "MMMM d, yyyy")}
        </h1>
      </div>

      {todayTasks.length === 0 ? (
        <p
          className={cn(
            "text-center italic py-6 text-sm",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          No appointments for today
        </p>
      ) : (
        <div className="space-y-3">
          {/* Headline */}
          <div
            className={cn(
              "pb-3 border-b",
              isFrost ? "border-slate-100" : "border-white/5"
            )}
          >
            <p
              className={cn(
                "text-xs mb-0.5",
                isFrost ? "text-slate-500" : "text-white/50"
              )}
            >
              {format(todayTasks[0].occurrenceDate, "h:mm a")}
            </p>
            <h2
              className={cn(
                "text-lg font-serif font-bold leading-tight",
                isFrost ? "text-slate-800" : "text-white"
              )}
            >
              {todayTasks[0].item.title}
            </h2>
            {todayTasks[0].item.description && (
              <p
                className={cn(
                  "mt-1 text-sm leading-relaxed",
                  isFrost ? "text-slate-600" : "text-white/60"
                )}
              >
                {todayTasks[0].item.description}
              </p>
            )}
          </div>

          {/* Secondary items */}
          {todayTasks.length > 1 && (
            <div className="space-y-1.5">
              <p
                className={cn(
                  "text-[10px] uppercase tracking-wider",
                  isFrost ? "text-slate-400" : "text-white/30"
                )}
              >
                Also Today
              </p>
              {todayTasks.slice(1).map((occ, idx) => (
                <div
                  key={`${occ.item.id}-${idx}`}
                  className="flex gap-2 py-1.5"
                >
                  <span
                    className={cn(
                      "text-xs tabular-nums w-12 flex-shrink-0",
                      isFrost ? "text-slate-400" : "text-white/40"
                    )}
                  >
                    {format(occ.occurrenceDate, "h:mm a")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isFrost ? "text-slate-700" : "text-white/90"
                      )}
                    >
                      {occ.item.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ==========================================
  // VIEW 4: MINIMAL - Ultra clean list
  // ==========================================
  const renderMinimalView = () => (
    <div className="px-3 py-3">
      {todayTasks.length === 0 ? (
        <p
          className={cn(
            "text-center py-8",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          Nothing today
        </p>
      ) : (
        <div className="space-y-0">
          {todayTasks.map((occ, idx) => (
            <div
              key={`${occ.item.id}-${idx}`}
              className={cn(
                "flex items-baseline gap-3 py-2",
                idx > 0 && "border-t",
                isFrost ? "border-slate-100" : "border-white/[0.04]"
              )}
            >
              <span
                className={cn(
                  "text-xs tabular-nums w-14 flex-shrink-0",
                  isFrost ? "text-slate-400" : "text-white/40"
                )}
              >
                {format(occ.occurrenceDate, "h:mm a")}
              </span>
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "text-sm",
                    isFrost ? "text-slate-800" : "text-white"
                  )}
                >
                  {occ.item.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ==========================================
  // VIEW 5: GRID - 2-column card grid (full width usage)
  // ==========================================
  const renderGridView = () => (
    <div className="px-3 py-3">
      {todayTasks.length === 0 ? (
        <div
          className={cn(
            "text-center py-8",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          <p>Nothing scheduled</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {todayTasks.map((occ, idx) => {
            const { item, occurrenceDate } = occ;
            const Icon = typeIcons[item.type];

            return (
              <div
                key={`${item.id}-${idx}`}
                className={cn(
                  "rounded-xl p-3 flex flex-col",
                  isFrost
                    ? "bg-white shadow-sm border border-slate-100"
                    : "bg-white/[0.04] border border-white/[0.08]",
                  item.type === "event" &&
                    (isFrost
                      ? "border-l-2 border-l-pink-400"
                      : "border-l-2 border-l-pink-500"),
                  item.type === "reminder" &&
                    (isFrost
                      ? "border-l-2 border-l-cyan-400"
                      : "border-l-2 border-l-cyan-500"),
                  item.type === "task" &&
                    (isFrost
                      ? "border-l-2 border-l-purple-400"
                      : "border-l-2 border-l-purple-500")
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={cn(
                      "text-[10px] font-medium tabular-nums",
                      isFrost ? "text-slate-400" : "text-white/50"
                    )}
                  >
                    {format(occurrenceDate, "h:mm a")}
                  </span>
                  <Icon
                    className={cn(
                      "w-3 h-3",
                      item.type === "event" &&
                        (isFrost ? "text-pink-400" : "text-pink-400"),
                      item.type === "reminder" &&
                        (isFrost ? "text-cyan-400" : "text-cyan-400"),
                      item.type === "task" &&
                        (isFrost ? "text-purple-400" : "text-purple-400")
                    )}
                  />
                </div>
                <h3
                  className={cn(
                    "text-sm font-medium leading-tight flex-1",
                    isFrost ? "text-slate-800" : "text-white"
                  )}
                >
                  {item.title}
                </h3>
                {item.description && (
                  <p
                    className={cn(
                      "text-[11px] mt-1 line-clamp-2",
                      isFrost ? "text-slate-500" : "text-white/40"
                    )}
                  >
                    {item.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ==========================================
  // VIEW 6: AGENDA - Horizontal time blocks
  // ==========================================
  const renderAgendaView = () => {
    // Group by morning/afternoon/evening
    const morning = todayTasks.filter((t) => t.occurrenceDate.getHours() < 12);
    const afternoon = todayTasks.filter(
      (t) =>
        t.occurrenceDate.getHours() >= 12 && t.occurrenceDate.getHours() < 17
    );
    const evening = todayTasks.filter((t) => t.occurrenceDate.getHours() >= 17);

    const renderBlock = (label: string, items: ExpandedOccurrence[]) => {
      if (items.length === 0) return null;
      return (
        <div className="mb-3">
          <div
            className={cn(
              "text-[10px] uppercase tracking-wider mb-1.5 px-1",
              isFrost ? "text-slate-400" : "text-white/30"
            )}
          >
            {label}{" "}
            <span className={cn(isFrost ? "text-slate-300" : "text-white/20")}>
              ({items.length})
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {items.map((occ, idx) => {
              const { item, occurrenceDate } = occ;
              const Icon = typeIcons[item.type];
              return (
                <div
                  key={`${item.id}-${idx}`}
                  className={cn(
                    "flex-shrink-0 w-36 rounded-xl p-2.5",
                    isFrost
                      ? "bg-white shadow-sm border border-slate-100"
                      : "bg-white/[0.04] border border-white/[0.08]"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div
                      className={cn(
                        "w-5 h-5 rounded flex items-center justify-center",
                        item.type === "event" &&
                          (isFrost
                            ? "bg-pink-50 text-pink-500"
                            : "bg-pink-500/10 text-pink-400"),
                        item.type === "reminder" &&
                          (isFrost
                            ? "bg-cyan-50 text-cyan-500"
                            : "bg-cyan-500/10 text-cyan-400"),
                        item.type === "task" &&
                          (isFrost
                            ? "bg-purple-50 text-purple-500"
                            : "bg-purple-500/10 text-purple-400")
                      )}
                    >
                      <Icon className="w-2.5 h-2.5" />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] tabular-nums",
                        isFrost ? "text-slate-400" : "text-white/50"
                      )}
                    >
                      {format(occurrenceDate, "h:mm a")}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-xs font-medium leading-tight line-clamp-2",
                      isFrost ? "text-slate-800" : "text-white"
                    )}
                  >
                    {item.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="px-3 py-3">
        {todayTasks.length === 0 ? (
          <div
            className={cn(
              "text-center py-8",
              isFrost ? "text-slate-400" : "text-white/40"
            )}
          >
            <p>Nothing scheduled</p>
          </div>
        ) : (
          <>
            {renderBlock("Morning", morning)}
            {renderBlock("Afternoon", afternoon)}
            {renderBlock("Evening", evening)}
          </>
        )}
      </div>
    );
  };

  // ==========================================
  // VIEW 7: LIST - Detailed rows
  // ==========================================
  const renderListView = () => (
    <div className="px-0 py-2">
      {todayTasks.length === 0 ? (
        <p
          className={cn(
            "text-center py-8",
            isFrost ? "text-slate-400" : "text-white/40"
          )}
        >
          Nothing scheduled
        </p>
      ) : (
        <div
          className={cn(
            "divide-y",
            isFrost ? "divide-slate-100" : "divide-white/[0.04]"
          )}
        >
          {todayTasks.map((occ, idx) => {
            const { item, occurrenceDate } = occ;
            const Icon = typeIcons[item.type];
            return (
              <div
                key={`${item.id}-${idx}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]",
                  isFrost ? "hover:bg-slate-50" : "hover:bg-white/[0.02]"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    item.type === "event" &&
                      (isFrost
                        ? "bg-pink-100/50 text-pink-600"
                        : "bg-pink-500/10 text-pink-400"),
                    item.type === "reminder" &&
                      (isFrost
                        ? "bg-cyan-100/50 text-cyan-600"
                        : "bg-cyan-500/10 text-cyan-400"),
                    item.type === "task" &&
                      (isFrost
                        ? "bg-purple-100/50 text-purple-600"
                        : "bg-purple-500/10 text-purple-400")
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3
                      className={cn(
                        "text-sm font-medium truncate",
                        isFrost ? "text-slate-900" : "text-white"
                      )}
                    >
                      {item.title}
                    </h3>
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded",
                        isFrost
                          ? "bg-slate-100 text-slate-500"
                          : "bg-white/10 text-white/50"
                      )}
                    >
                      {item.type}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-xs truncate",
                      isFrost ? "text-slate-500" : "text-white/50"
                    )}
                  >
                    {item.description || "No description"}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      isFrost ? "text-slate-700" : "text-white/80"
                    )}
                  >
                    {format(occurrenceDate, "h:mm a")}
                  </p>
                  <p
                    className={cn(
                      "text-[10px]",
                      isFrost ? "text-slate-400" : "text-white/30"
                    )}
                  >
                    {format(occurrenceDate, "MMM d")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ==========================================
  // VIEW 8: FOCUS - Spotlight on next task
  // ==========================================
  const renderFocusView = () => {
    // Determine the "active" task (next one based on current time)
    const now = new Date();
    // Assuming todayTasks are sorted by time already
    // Find first task that is active or in future
    // In a real app we might want to check if end time is passed, but here we just check start time vs now or just show first one
    const activeIndex =
      todayTasks.findIndex((t) => t.occurrenceDate > now) !== -1
        ? todayTasks.findIndex((t) => t.occurrenceDate > now)
        : todayTasks.length > 0
          ? todayTasks.length - 1
          : -1;

    // If all tasks passed today, show the last one, or a "done" state.
    // Let's just default to the first one if we can't decide, or the one closest to now.
    // Actually, simple logic: show the NEXT one.

    const nextTask =
      todayTasks.find((t) => t.occurrenceDate >= now) ||
      todayTasks[todayTasks.length - 1];

    // For the list below, show subsequent tasks
    const laterTasks = nextTask
      ? todayTasks.filter(
          (t) => t.occurrenceDate.getTime() > nextTask.occurrenceDate.getTime()
        )
      : [];

    if (!nextTask) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
          <div
            className={cn(
              "p-4 rounded-full mb-4",
              isFrost
                ? "bg-slate-100 text-slate-400"
                : "bg-white/5 text-white/20"
            )}
          >
            <Calendar className="w-8 h-8" />
          </div>
          <p className={cn(isFrost ? "text-slate-500" : "text-white/50")}>
            No upcoming tasks
          </p>
        </div>
      );
    }

    const Icon = typeIcons[nextTask.item.type];

    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex flex-col justify-center p-6 text-center">
          <div
            className={cn(
              "text-xs font-medium uppercase tracking-widest mb-4",
              isFrost ? "text-slate-400" : "text-white/40"
            )}
          >
            Up Next
          </div>
          <div
            className={cn(
              "w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg",
              nextTask.item.type === "event" &&
                (isFrost
                  ? "bg-pink-100 text-pink-500 shadow-pink-200"
                  : "bg-pink-500/20 text-pink-400 shadow-pink-900/20"),
              nextTask.item.type === "reminder" &&
                (isFrost
                  ? "bg-cyan-100 text-cyan-500 shadow-cyan-200"
                  : "bg-cyan-500/20 text-cyan-400 shadow-cyan-900/20"),
              nextTask.item.type === "task" &&
                (isFrost
                  ? "bg-purple-100 text-purple-500 shadow-purple-200"
                  : "bg-purple-500/20 text-purple-400 shadow-purple-900/20")
            )}
          >
            <Icon className="w-8 h-8" />
          </div>
          <h2
            className={cn(
              "text-2xl font-bold mb-2",
              isFrost ? "text-slate-800" : "text-white"
            )}
          >
            {nextTask.item.title}
          </h2>
          <p
            className={cn(
              "text-xl font-medium tabular-nums mb-4",
              isFrost ? "text-slate-500" : "text-white/60"
            )}
          >
            {format(nextTask.occurrenceDate, "h:mm a")}
          </p>
          {nextTask.item.description && (
            <p
              className={cn(
                "text-sm max-w-xs mx-auto",
                isFrost ? "text-slate-400" : "text-white/40"
              )}
            >
              {nextTask.item.description}
            </p>
          )}
        </div>

        {laterTasks.length > 0 && (
          <div
            className={cn(
              "flex-shrink-0 p-4 border-t",
              isFrost
                ? "bg-slate-50 border-slate-100"
                : "bg-black/20 border-white/5"
            )}
          >
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wider mb-3",
                isFrost ? "text-slate-400" : "text-white/30"
              )}
            >
              Later
            </p>
            <div className="space-y-2">
              {laterTasks.slice(0, 3).map((occ, idx) => (
                <div
                  key={`${occ.item.id}-${idx}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className={cn(isFrost ? "text-slate-600" : "text-white/70")}
                  >
                    {occ.item.title}
                  </span>
                  <span
                    className={cn(
                      isFrost ? "text-slate-400" : "text-white/30",
                      "text-xs tabular-nums"
                    )}
                  >
                    {format(occ.occurrenceDate, "h:mm a")}
                  </span>
                </div>
              ))}
              {laterTasks.length > 3 && (
                <p
                  className={cn(
                    "text-xs text-center pt-1",
                    isFrost ? "text-slate-400" : "text-white/30"
                  )}
                >
                  + {laterTasks.length - 3} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // VIEW 9: KANBAN - Columnar view
  // ==========================================
  const renderKanbanView = () => {
    // Group by morning/afternoon/evening
    const morning = todayTasks.filter((t) => t.occurrenceDate.getHours() < 12);
    const afternoon = todayTasks.filter(
      (t) =>
        t.occurrenceDate.getHours() >= 12 && t.occurrenceDate.getHours() < 17
    );
    const evening = todayTasks.filter((t) => t.occurrenceDate.getHours() >= 17);

    const renderColumn = (
      label: string,
      items: ExpandedOccurrence[],
      colorClass: string
    ) => (
      <div
        className={cn(
          "flex-shrink-0 w-64 flex flex-col rounded-xl h-full overflow-hidden border",
          isFrost
            ? "bg-slate-50 border-slate-200"
            : "bg-white/[0.02] border-white/[0.06]"
        )}
      >
        <div
          className={cn(
            "px-3 py-2 border-b flex items-center justify-between",
            isFrost ? "border-slate-200" : "border-white/[0.06]"
          )}
        >
          <span
            className={cn(
              "font-medium text-xs",
              isFrost ? "text-slate-600" : "text-white/70"
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full",
              isFrost
                ? "bg-slate-200 text-slate-600"
                : "bg-white/10 text-white/50"
            )}
          >
            {items.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {items.map((occ, idx) => {
            const { item, occurrenceDate } = occ;
            const Icon = typeIcons[item.type];
            return (
              <div
                key={`${item.id}-${idx}`}
                className={cn(
                  "p-2.5 rounded-lg border",
                  isFrost
                    ? "bg-white border-slate-200 shadow-sm"
                    : "bg-black/40 border-white/5"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded",
                      colorClass
                    )}
                  >
                    {format(occurrenceDate, "h:mm a")}
                  </span>
                  {occ.isCompleted && (
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  )}
                </div>
                <p
                  className={cn(
                    "text-sm font-medium leading-tight mb-1",
                    isFrost ? "text-slate-800" : "text-white"
                  )}
                >
                  {item.title}
                </p>
                {item.description && (
                  <p
                    className={cn(
                      "text-[10px] line-clamp-2",
                      isFrost ? "text-slate-400" : "text-white/40"
                    )}
                  >
                    {item.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="h-full overflow-x-auto p-3 flex gap-3 items-stretch">
        {renderColumn(
          "Morning",
          morning,
          isFrost
            ? "bg-amber-100 text-amber-700"
            : "bg-amber-500/20 text-amber-300"
        )}
        {renderColumn(
          "Afternoon",
          afternoon,
          isFrost ? "bg-sky-100 text-sky-700" : "bg-sky-500/20 text-sky-300"
        )}
        {renderColumn(
          "Evening",
          evening,
          isFrost
            ? "bg-indigo-100 text-indigo-700"
            : "bg-indigo-500/20 text-indigo-300"
        )}
      </div>
    );
  };

  // Render the active view
  const renderActiveView = () => {
    switch (viewMode) {
      case "briefing":
        return renderBriefingView();
      case "timeline":
        return renderTimelineView();
      case "cards":
        return renderCardsView();
      case "editorial":
        return renderEditorialView();
      case "minimal":
        return renderMinimalView();
      case "grid":
        return renderGridView();
      case "agenda":
        return renderAgendaView();
      case "list":
        return renderListView();
      case "focus":
        return renderFocusView();
      case "kanban":
        return renderKanbanView();
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with time scope toggle and controls */}
      <div
        className={cn(
          "flex-shrink-0 px-3 py-2 flex items-center justify-between gap-2",
          isFrost
            ? "bg-slate-50 border-b border-slate-100"
            : "bg-white/[0.02] border-b border-white/[0.04]"
        )}
      >
        {/* Time scope toggle (Today / This Week) */}
        <div className="flex items-center gap-1">
          <div
            className={cn(
              "flex rounded-lg p-0.5",
              isFrost ? "bg-slate-100" : "bg-white/[0.05]"
            )}
          >
            {(["today", "week"] as TimeScope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => setTimeScope(scope)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  timeScope === scope
                    ? isFrost
                      ? "bg-white text-slate-800 shadow-sm"
                      : isPink
                        ? "bg-pink-500/30 text-pink-300"
                        : "bg-cyan-500/30 text-cyan-300"
                    : isFrost
                      ? "text-slate-500 hover:text-slate-700"
                      : "text-white/40 hover:text-white/60"
                )}
              >
                {timeScopeLabels[scope]}
              </button>
            ))}
          </div>

          {/* Date display */}
          <div className="ml-2 hidden sm:block">
            <p
              className={cn(
                "text-xs",
                isFrost ? "text-slate-500" : "text-white/50"
              )}
            >
              {timeScope === "today"
                ? format(today, "EEEE, MMMM d")
                : `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`}
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1">
          {/* Sort mode dropdown */}
          <div className="relative group">
            <button
              type="button"
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                isFrost
                  ? "text-slate-500 hover:bg-slate-100"
                  : "text-white/50 hover:bg-white/[0.05]"
              )}
            >
              {sortMode === "time" && <Clock className="w-3 h-3" />}
              {sortMode === "priority" && <Star className="w-3 h-3" />}
              {sortMode === "category" && <Layers className="w-3 h-3" />}
              <span className="hidden sm:inline">
                {sortMode === "time" && "By Time"}
                {sortMode === "priority" && "By Priority"}
                {sortMode === "category" && "By Category"}
              </span>
            </button>
            {/* Dropdown menu */}
            <div
              className={cn(
                "absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all",
                isFrost
                  ? "bg-white border border-slate-200"
                  : "bg-slate-900 border border-white/10"
              )}
            >
              {(["time", "priority", "category"] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSortMode(mode)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-left transition-colors",
                    sortMode === mode
                      ? isFrost
                        ? "bg-indigo-50 text-indigo-600"
                        : "bg-cyan-500/10 text-cyan-400"
                      : isFrost
                        ? "text-slate-600 hover:bg-slate-50"
                        : "text-white/70 hover:bg-white/5"
                  )}
                >
                  {mode === "time" && <Clock className="w-3 h-3" />}
                  {mode === "priority" && <Star className="w-3 h-3" />}
                  {mode === "category" && <Layers className="w-3 h-3" />}
                  <span className="capitalize">{mode}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Overdue badge */}
          {overdueTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowOverdue(!showOverdue)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors",
                showOverdue
                  ? isFrost
                    ? "bg-amber-100 text-amber-700"
                    : "bg-amber-500/20 text-amber-300"
                  : isFrost
                    ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
                    : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              )}
            >
              <AlertCircle className="w-3 h-3" />
              {overdueTasks.length}
            </button>
          )}

          {/* Narrative toggle - only show when not in briefing mode */}
          {viewMode !== "briefing" && (
            <button
              type="button"
              onClick={() => setShowNarrative(!showNarrative)}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                showNarrative
                  ? isFrost
                    ? "bg-indigo-100 text-indigo-600"
                    : "bg-cyan-500/20 text-cyan-400"
                  : isFrost
                    ? "text-slate-400 hover:bg-slate-100"
                    : "text-white/40 hover:bg-white/[0.05]"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* View mode toggle (TEMPORARY) */}
      <div
        className={cn(
          "flex-shrink-0 px-3 py-1.5 flex gap-1 overflow-x-auto",
          isFrost ? "bg-slate-50/50" : "bg-white/[0.01]"
        )}
      >
        {(Object.keys(viewModeLabels) as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={cn(
              "px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
              viewMode === mode
                ? isFrost
                  ? "bg-indigo-500 text-white"
                  : isPink
                    ? "bg-pink-500 text-white"
                    : "bg-cyan-500 text-black"
                : isFrost
                  ? "text-slate-500 hover:bg-slate-100"
                  : "text-white/50 hover:bg-white/[0.05]"
            )}
          >
            {viewModeLabels[mode]}
          </button>
        ))}
      </div>

      {/* Overdue panel (expandable) */}
      {showOverdue && overdueTasks.length > 0 && (
        <div
          className={cn(
            "flex-shrink-0 mx-3 mt-2 rounded-lg overflow-hidden",
            isFrost
              ? "bg-amber-50 border border-amber-100"
              : "bg-amber-500/5 border border-amber-500/10"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between px-2.5 py-1.5",
              isFrost
                ? "border-b border-amber-100"
                : "border-b border-amber-500/10"
            )}
          >
            <span
              className={cn(
                "text-[11px] font-medium",
                isFrost ? "text-amber-700" : "text-amber-400"
              )}
            >
              Overdue Items
            </span>
            <button
              type="button"
              onClick={() => setShowOverdue(false)}
              className={cn(
                "p-0.5 rounded",
                isFrost
                  ? "hover:bg-amber-100 text-amber-500"
                  : "hover:bg-amber-500/10 text-amber-400"
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="max-h-24 overflow-y-auto px-2.5 py-1.5 space-y-0.5">
            {overdueTasks.map((occ, idx) => (
              <div
                key={`overdue-${occ.item.id}-${idx}`}
                className="flex items-center gap-2 text-xs py-0.5"
              >
                <span
                  className={cn(
                    "text-[10px] w-10 flex-shrink-0",
                    isFrost ? "text-amber-600" : "text-amber-400/70"
                  )}
                >
                  {format(occ.occurrenceDate, "MMM d")}
                </span>
                <span
                  className={cn(
                    "truncate",
                    isFrost ? "text-amber-800" : "text-amber-300"
                  )}
                >
                  {occ.item.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative panel (expandable) */}
      {showNarrative && (
        <div
          className={cn(
            "flex-shrink-0 mx-3 mt-2 rounded-lg p-3",
            isFrost
              ? "bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100"
              : isPink
                ? "bg-gradient-to-br from-pink-500/5 to-purple-500/5 border border-pink-500/10"
                : "bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/10"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-xs leading-relaxed whitespace-pre-wrap",
                isFrost ? "text-slate-600" : "text-white/70"
              )}
            >
              {narrative}
            </p>
            <button
              type="button"
              onClick={() => setShowNarrative(false)}
              className={cn(
                "p-0.5 rounded flex-shrink-0",
                isFrost
                  ? "hover:bg-indigo-100 text-indigo-400"
                  : "hover:bg-white/10 text-white/40"
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">{renderActiveView()}</div>
    </div>
  );
}
