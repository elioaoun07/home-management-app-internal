"use client";

/**
 * FocusPage - Personal AI Assistant Experience
 *
 * Key innovations:
 * - Living avatar that breathes and reacts
 * - Typing animation for messages (character by character)
 * - Conversational personality with contextual awareness
 * - Celebration effects on task completion
 * - Proactive suggestions
 * - Ambient life through subtle animations
 */

import EditItemDialog from "@/components/items/EditItemDialog";
import ItemDetailModal from "@/components/items/ItemDetailModal";
import { MOBILE_CONTENT_BOTTOM_OFFSET } from "@/constants/layout";
import {
  isOccurrenceCompleted,
  useAllOccurrenceActions,
  useItemActionsWithToast,
} from "@/features/items/useItemActions";
import { useItems } from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import {
  addDays,
  endOfWeek,
  format,
  isBefore,
  isToday,
  isTomorrow,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  ListTodo,
  Plus,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { RRule } from "rrule";

// ============================================
// TYPES
// ============================================
interface ExpandedOccurrence {
  item: ItemWithDetails;
  occurrenceDate: Date;
  isCompleted: boolean;
}

type TimeScope = "today" | "week";
type AssistantMood = "neutral" | "happy" | "thinking" | "celebrating";

// ============================================
// HELPER FUNCTIONS
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
  recurrenceRule: { rrule: string },
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
  actions: any[],
): ExpandedOccurrence[] {
  const result: ExpandedOccurrence[] = [];

  for (const item of items) {
    const itemDate = getItemDate(item);
    if (!itemDate) continue;

    const isRecurring =
      item.recurrence_rule?.rrule && item.recurrence_rule.rrule.length > 0;

    if (isRecurring) {
      try {
        const fullRruleStr = buildFullRRuleString(
          itemDate,
          item.recurrence_rule!,
        );
        const rule = RRule.fromString(fullRruleStr);
        const exceptions = new Set(
          (item.recurrence_rule?.exceptions || []).map((e: any) =>
            format(parseISO(e.exception_date), "yyyy-MM-dd"),
          ),
        );
        const occurrences = rule.between(startDate, endDate, true);
        for (const occ of occurrences) {
          const occDateKey = format(occ, "yyyy-MM-dd");
          if (exceptions.has(occDateKey)) continue;
          const completed = isOccurrenceCompleted(item.id, occ, actions);
          result.push({ item, occurrenceDate: occ, isCompleted: completed });
        }
      } catch {
        if (isWithinInterval(itemDate, { start: startDate, end: endDate })) {
          result.push({
            item,
            occurrenceDate: itemDate,
            isCompleted: item.status === "completed",
          });
        }
      }
    } else {
      if (isWithinInterval(itemDate, { start: startDate, end: endDate })) {
        result.push({
          item,
          occurrenceDate: itemDate,
          isCompleted: item.status === "completed",
        });
      }
    }
  }

  result.sort(
    (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime(),
  );
  return result;
}

// ============================================
// ASSISTANT NAME
// ============================================
const ASSISTANT_NAME = "Focus";

// ============================================
// AI PERSONALITY - Contextual Messages
// ============================================
interface Message {
  text: string;
  suggestion?: { text: string; action: () => void };
}

function generateGreeting(): string {
  const hour = new Date().getHours();
  const greetings = {
    earlyMorning: [
      "Early bird! Let's make today extraordinary.",
      "Up before the sun? I like your style.",
      "The quiet hours are perfect for focus.",
    ],
    morning: [
      "Good morning! Ready to conquer the day?",
      "Rise and shine! Here's your game plan.",
      "Morning! Let's turn plans into progress.",
    ],
    midday: [
      "Midday check-in! How's the flow going?",
      "Keeping the momentum strong!",
      "Perfect time to tackle what matters most.",
    ],
    afternoon: [
      "Afternoon push! You've got this.",
      "Let's power through the rest of the day.",
      "Sun's still up, and so are we!",
    ],
    evening: [
      "Evening wrap-up time. Let's review.",
      "Winding down but staying sharp.",
      "End the day on a high note!",
    ],
    night: [
      "Night owl mode activated.",
      "Burning the midnight oil, I see!",
      "Late night productivity session.",
    ],
  };

  let pool: string[];
  if (hour < 5) pool = greetings.earlyMorning;
  else if (hour < 9) pool = greetings.morning;
  else if (hour < 12) pool = greetings.midday;
  else if (hour < 17) pool = greetings.afternoon;
  else if (hour < 21) pool = greetings.evening;
  else pool = greetings.night;

  return pool[Math.floor(Math.random() * pool.length)];
}

function generateContextualMessage(
  currentItem: ExpandedOccurrence | null,
  remaining: number,
  overdueCount: number,
  completedCount: number,
): Message {
  if (!currentItem && remaining === 0 && overdueCount === 0) {
    if (completedCount > 0) {
      const celebrations = [
        `Amazing work! You've cleared ${completedCount} item${completedCount > 1 ? "s" : ""} today.`,
        `${completedCount} down, zero to go! You're on fire.`,
        `A clean slate! ${completedCount} task${completedCount > 1 ? "s" : ""} conquered.`,
      ];
      return {
        text: celebrations[Math.floor(Math.random() * celebrations.length)],
      };
    }
    return {
      text: "Your canvas is blank. What will you create today?",
      suggestion: {
        text: "Add a task",
        action: () => {},
      },
    };
  }

  if (!currentItem && overdueCount > 0) {
    return {
      text: `I noticed ${overdueCount} item${overdueCount > 1 ? "s" : ""} need${overdueCount === 1 ? "s" : ""} your attention from before.`,
    };
  }

  if (currentItem) {
    const typeWords = {
      reminder: "reminder",
      task: "task",
      event: "event",
    };
    const type = typeWords[currentItem.item.type] || "item";

    const phrases =
      remaining > 1
        ? [
            `Here's your next ${type}. ${remaining - 1} more waiting in the wings.`,
            `Focus on this ${type} first. You've got ${remaining - 1} more after.`,
            `One step at a time. This ${type}, then ${remaining - 1} more.`,
          ]
        : [
            `This is it—your final ${type} for now!`,
            `Last one on the list. Make it count!`,
            `Just this ${type} stands between you and freedom.`,
          ];

    return {
      text: phrases[Math.floor(Math.random() * phrases.length)],
    };
  }

  return { text: "I'm here when you need me." };
}

// ============================================
// TYPING ANIMATION HOOK
// ============================================
function useTypingAnimation(text: string, speed: number = 30) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const prevTextRef = useRef("");

  useEffect(() => {
    if (text === prevTextRef.current) return;
    prevTextRef.current = text;

    setIsTyping(true);
    setDisplayedText("");

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayedText, isTyping };
}

// ============================================
// CELEBRATION PARTICLES
// ============================================
function CelebrationParticles({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; color: string }>
  >([]);

  useEffect(() => {
    if (trigger === 0) return;

    const colors = [
      "var(--primary)",
      "#10b981",
      "#f59e0b",
      "#ec4899",
      "#8b5cf6",
    ];
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: Date.now() + i,
      x: 50 + (Math.random() - 0.5) * 30,
      y: 50,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    setParticles(newParticles);
    const timeout = setTimeout(() => setParticles([]), 1000);
    return () => clearTimeout(timeout);
  }, [trigger]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            x: `${p.x}vw`,
            y: `${p.y}vh`,
            scale: 1,
            opacity: 1,
          }}
          animate={{
            x: `${p.x + (Math.random() - 0.5) * 60}vw`,
            y: `${p.y - 30 - Math.random() * 40}vh`,
            scale: 0,
            opacity: 0,
          }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute w-3 h-3 rounded-full"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

// ============================================
// ASSISTANT AVATAR - The Living Core
// ============================================
function AssistantAvatar({
  mood,
  themeClasses,
}: {
  mood: AssistantMood;
  themeClasses: ReturnType<typeof useThemeClasses>;
}) {
  const pulseVariants = {
    neutral: {
      scale: [1, 1.05, 1],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
    },
    happy: {
      scale: [1, 1.1, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
    thinking: {
      scale: [1, 1.02, 1],
      rotate: [0, 5, -5, 0],
      transition: { duration: 1, repeat: Infinity, ease: "easeInOut" as const },
    },
    celebrating: {
      scale: [1, 1.2, 0.9, 1.1, 1],
      rotate: [0, -10, 10, -5, 0],
      transition: { duration: 0.6, ease: "easeOut" as const },
    },
  };

  const glowVariants = {
    neutral: {
      opacity: [0.3, 0.5, 0.3],
      scale: [1, 1.2, 1],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
    },
    happy: {
      opacity: [0.5, 0.8, 0.5],
      scale: [1, 1.3, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
    thinking: {
      opacity: [0.4, 0.6, 0.4],
      scale: [1, 1.1, 1],
      transition: {
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
    celebrating: {
      opacity: [0.6, 1, 0.6],
      scale: [1, 1.5, 1],
      transition: { duration: 0.5, ease: "easeOut" as const },
    },
  };

  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      {/* Outer glow */}
      <motion.div
        variants={glowVariants}
        animate={mood}
        className="absolute inset-0 rounded-full bg-[var(--primary)]/30 blur-xl"
      />

      {/* Middle ring */}
      <motion.div
        variants={pulseVariants}
        animate={mood}
        className="absolute inset-1 rounded-full border-2 border-[var(--primary)]/30"
      />

      {/* Core orb */}
      <motion.div
        variants={pulseVariants}
        animate={mood}
        className={cn(
          "relative w-12 h-12 rounded-full flex items-center justify-center",
          "bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/60",
          "shadow-[0_0_30px_var(--primary)]",
        )}
      >
        {/* Inner highlight */}
        <div className="absolute top-1 left-2 w-4 h-4 rounded-full bg-white/30 blur-sm" />

        {/* Icon based on mood */}
        <motion.div
          key={mood}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {mood === "celebrating" ? (
            <Sparkles className="w-5 h-5 text-white" />
          ) : mood === "thinking" ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            />
          ) : (
            <Sparkles className="w-5 h-5 text-white" />
          )}
        </motion.div>
      </motion.div>

      {/* Orbiting particles when happy/celebrating */}
      {(mood === "happy" || mood === "celebrating") && (
        <>
          {[0, 120, 240].map((angle, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-[var(--primary)]"
              animate={{
                rotate: [angle, angle + 360],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.2,
              }}
              style={{
                transformOrigin: "32px 32px",
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ============================================
// MESSAGE BUBBLE
// ============================================
function MessageBubble({
  message,
  isTyping,
  displayedText,
  themeClasses,
}: {
  message: Message;
  isTyping: boolean;
  displayedText: string;
  themeClasses: ReturnType<typeof useThemeClasses>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative p-4 rounded-2xl rounded-tl-sm",
        "bg-bg-card-custom/80 border",
        themeClasses.border,
      )}
    >
      <p
        className={cn(
          "text-sm leading-relaxed relative z-10",
          themeClasses.headerText,
        )}
      >
        {displayedText}
        {isTyping && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className={cn("ml-0.5", themeClasses.text)}
          >
            |
          </motion.span>
        )}
      </p>

      {message.suggestion && !isTyping && (
        <motion.button
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={message.suggestion.action}
          className={cn(
            "mt-3 px-3 py-1.5 rounded-full text-xs font-medium",
            "bg-[var(--primary)]/10 border border-[var(--primary)]/20",
            themeClasses.text,
            "hover:bg-[var(--primary)]/20 transition-colors",
          )}
        >
          {message.suggestion.text}
        </motion.button>
      )}
    </motion.div>
  );
}

// ============================================
// TASK CARD
// ============================================
function TaskCard({
  occ,
  onComplete,
  onDetails,
  themeClasses,
  isHighlighted = false,
}: {
  occ: ExpandedOccurrence;
  onComplete: () => void;
  onDetails: () => void;
  themeClasses: ReturnType<typeof useThemeClasses>;
  isHighlighted?: boolean;
}) {
  const { item, occurrenceDate, isCompleted } = occ;
  const TypeIcon =
    item.type === "event" ? Calendar : item.type === "task" ? ListTodo : Bell;
  const timeStr = format(occurrenceDate, "h:mm a");
  const dateLabel = isToday(occurrenceDate)
    ? "Today"
    : isTomorrow(occurrenceDate)
      ? "Tomorrow"
      : format(occurrenceDate, "EEE, MMM d");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      className={cn(
        "relative rounded-2xl overflow-hidden",
        isHighlighted
          ? "bg-bg-card-custom border-2 border-[var(--primary)]/40 shadow-[0_0_30px_-10px_var(--primary)]"
          : cn("bg-bg-card-custom/50 border", themeClasses.border),
      )}
    >
      {isHighlighted && (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/10 via-transparent to-transparent pointer-events-none" />
      )}

      <div className="relative p-5 cursor-pointer" onClick={onDetails}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                isHighlighted ? "bg-[var(--primary)]/20" : "bg-bg-medium",
              )}
            >
              <TypeIcon
                className={cn(
                  "w-5 h-5",
                  isHighlighted ? themeClasses.text : themeClasses.textMuted,
                )}
              />
            </div>
            <div>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  themeClasses.textMuted,
                )}
              >
                {item.type}
              </span>
              <div className="flex items-center gap-1">
                <Clock className={cn("w-3 h-3", themeClasses.textFaint)} />
                <span className={cn("text-xs", themeClasses.textMuted)}>
                  {timeStr}
                </span>
              </div>
            </div>
          </div>
          <span className={cn("text-xs", themeClasses.textFaint)}>
            {dateLabel}
          </span>
        </div>

        <h3
          className={cn(
            "text-lg font-semibold mb-2",
            isCompleted && "line-through opacity-50",
            themeClasses.headerText,
          )}
        >
          {item.title}
        </h3>

        {item.description && (
          <p
            className={cn("text-sm line-clamp-2 mb-4", themeClasses.textMuted)}
          >
            {item.description}
          </p>
        )}

        <div className="flex gap-3">
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all",
              isCompleted
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400",
            )}
          >
            <Check className="w-5 h-5" />
            <span>{isCompleted ? "Done!" : "Mark Done"}</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDetails();
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "px-4 py-3 rounded-xl",
              "bg-bg-medium",
              themeClasses.textMuted,
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// MINI TASK ROW
// ============================================
function MiniTaskRow({
  occ,
  onClick,
  themeClasses,
}: {
  occ: ExpandedOccurrence;
  onClick: () => void;
  themeClasses: ReturnType<typeof useThemeClasses>;
}) {
  const TypeIcon =
    occ.item.type === "event"
      ? Calendar
      : occ.item.type === "task"
        ? ListTodo
        : Bell;
  const timeStr = format(occ.occurrenceDate, "h:mm a");

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: 4 }}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
        "hover:bg-bg-card-custom/50",
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          occ.isCompleted ? "bg-emerald-500/10" : "bg-bg-medium",
        )}
      >
        {occ.isCompleted ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : (
          <TypeIcon className={cn("w-4 h-4", themeClasses.textMuted)} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            occ.isCompleted && "line-through opacity-50",
            themeClasses.headerText,
          )}
        >
          {occ.item.title}
        </p>
        <p className={cn("text-xs", themeClasses.textFaint)}>{timeStr}</p>
      </div>
      <ArrowRight
        className={cn("w-4 h-4 flex-shrink-0", themeClasses.textFaint)}
      />
    </motion.button>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
interface FocusPageProps {
  standalone?: boolean;
}

export default function FocusPage({ standalone = false }: FocusPageProps) {
  const themeClasses = useThemeClasses();
  const router = useRouter();

  const [timeScope, setTimeScope] = useState<TimeScope>("today");
  const [showOverdue, setShowOverdue] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemWithDetails | null>(
    null,
  );
  const [editingItem, setEditingItem] = useState<ItemWithDetails | null>(null);
  const [selectedOccurrenceDate, setSelectedOccurrenceDate] =
    useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [assistantMood, setAssistantMood] = useState<AssistantMood>("neutral");
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);
  const [greeting] = useState(() => generateGreeting());

  useEffect(() => {
    setMounted(true);
    setAssistantMood("happy");
    const timeout = setTimeout(() => setAssistantMood("neutral"), 2000);
    return () => clearTimeout(timeout);
  }, []);

  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();
  const itemActions = useItemActionsWithToast();

  const activeItems = useMemo(() => {
    return allItems.filter(
      (item) =>
        item.status !== "archived" &&
        !item.archived_at &&
        item.status !== "cancelled",
    );
  }, [allItems]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekStart = useMemo(
    () => startOfWeek(today, { weekStartsOn: 1 }),
    [today],
  );
  const weekEnd = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);

  const organizedTasks = useMemo(() => {
    const todayEnd = addDays(today, 1);
    const scopeEnd = timeScope === "today" ? todayEnd : addDays(weekEnd, 1);
    const pastStart = addDays(today, -30);

    const allExpanded = expandRecurringItems(
      activeItems,
      pastStart,
      scopeEnd,
      occurrenceActions,
    );

    const overdue: ExpandedOccurrence[] = [];
    const upcoming: ExpandedOccurrence[] = [];
    const completed: ExpandedOccurrence[] = [];

    for (const occ of allExpanded) {
      if (occ.isCompleted) {
        if (occ.occurrenceDate >= weekStart) completed.push(occ);
        continue;
      }

      if (isBefore(occ.occurrenceDate, today)) {
        overdue.push(occ);
      } else if (
        isToday(occ.occurrenceDate) ||
        (timeScope === "week" && occ.occurrenceDate <= scopeEnd)
      ) {
        upcoming.push(occ);
      }
    }

    return { overdue, upcoming, completed };
  }, [activeItems, occurrenceActions, today, weekStart, weekEnd, timeScope]);

  const currentItem = organizedTasks.upcoming[0] || null;

  const stats = useMemo(
    () => ({
      remaining: organizedTasks.upcoming.length,
      overdueCount: organizedTasks.overdue.length,
      completedCount: organizedTasks.completed.length,
    }),
    [organizedTasks],
  );

  const message = useMemo(
    () =>
      generateContextualMessage(
        currentItem,
        stats.remaining,
        stats.overdueCount,
        stats.completedCount,
      ),
    [currentItem, stats],
  );

  const { displayedText, isTyping } = useTypingAnimation(message.text, 25);

  useEffect(() => {
    if (isLoading) {
      setAssistantMood("thinking");
    } else if (
      stats.remaining === 0 &&
      stats.overdueCount === 0 &&
      stats.completedCount > 0
    ) {
      setAssistantMood("happy");
    } else {
      setAssistantMood("neutral");
    }
  }, [isLoading, stats]);

  const handleQuickEntry = useCallback(() => {
    localStorage.setItem("fab-last-selection", "reminder");
    window.dispatchEvent(new Event("fab-selection-changed"));
    localStorage.setItem("initial-active-tab", "reminder");
    router.push("/expense");
  }, [router]);

  const handleItemClick = useCallback((item: ItemWithDetails, date: Date) => {
    setSelectedItem(item);
    setSelectedOccurrenceDate(date);
  }, []);

  const handleComplete = useCallback(
    async (item: ItemWithDetails, date: Date) => {
      setAssistantMood("celebrating");
      setCelebrationTrigger((t) => t + 1);
      setTimeout(() => setAssistantMood("happy"), 600);
      setTimeout(() => setAssistantMood("neutral"), 2000);

      await itemActions.handleComplete(item, date.toISOString());
    },
    [itemActions],
  );

  const handleEdit = useCallback((item: ItemWithDetails) => {
    setSelectedItem(null);
    setEditingItem(item);
  }, []);

  const handleDelete = useCallback(
    async (item: ItemWithDetails, date?: Date) => {
      const isRecurring = !!item.recurrence_rule?.rrule;
      if (isRecurring && date) {
        await itemActions.handleCancel(item, date.toISOString());
      } else {
        await itemActions.handleDelete(item);
      }
      setSelectedItem(null);
    },
    [itemActions],
  );

  const contentStyle: CSSProperties = {
    paddingBottom: standalone
      ? "40px"
      : `${MOBILE_CONTENT_BOTTOM_OFFSET + 40}px`,
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen h-screen flex flex-col bg-bg-dark overflow-hidden">
      <CelebrationParticles trigger={celebrationTrigger} />

      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="px-5 pt-16 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className={cn("text-sm", themeClasses.textMuted)}>
                {format(new Date(), "EEEE, MMMM d")}
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setTimeScope("today")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  timeScope === "today"
                    ? cn(
                        "bg-[var(--primary)]/20 border border-[var(--primary)]/40",
                        themeClasses.text,
                      )
                    : cn("bg-bg-card-custom", themeClasses.textMuted),
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setTimeScope("week")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  timeScope === "week"
                    ? cn(
                        "bg-[var(--primary)]/20 border border-[var(--primary)]/40",
                        themeClasses.text,
                      )
                    : cn("bg-bg-card-custom", themeClasses.textMuted),
                )}
              >
                Week
              </button>
            </div>
          </div>

          <div className="flex items-start gap-4 mb-6">
            <AssistantAvatar mood={assistantMood} themeClasses={themeClasses} />

            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-lg font-semibold mb-2",
                  themeClasses.headerText,
                )}
              >
                {greeting}
              </p>

              <MessageBubble
                message={message}
                isTyping={isTyping}
                displayedText={displayedText}
                themeClasses={themeClasses}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
              <span className={cn("text-xs", themeClasses.textMuted)}>
                <span className={cn("font-semibold", themeClasses.text)}>
                  {stats.remaining}
                </span>{" "}
                upcoming
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className={cn("text-xs", themeClasses.textMuted)}>
                <span className={cn("font-semibold", themeClasses.text)}>
                  {stats.completedCount}
                </span>{" "}
                done
              </span>
            </div>
            {stats.overdueCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className={cn("text-xs", themeClasses.textMuted)}>
                  <span className={cn("font-semibold", themeClasses.text)}>
                    {stats.overdueCount}
                  </span>{" "}
                  overdue
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-5" style={contentStyle}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className={cn(
                  "w-8 h-8 border-2 rounded-full mb-4",
                  "border-[var(--primary)]/30 border-t-[var(--primary)]",
                )}
              />
              <p className={cn("text-sm", themeClasses.textMuted)}>
                Getting your tasks...
              </p>
            </div>
          ) : currentItem ? (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className={cn("w-4 h-4", themeClasses.text)} />
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      themeClasses.textMuted,
                    )}
                  >
                    Current Focus
                  </span>
                </div>
                <AnimatePresence mode="wait">
                  <TaskCard
                    key={`${currentItem.item.id}-${currentItem.occurrenceDate.toISOString()}`}
                    occ={currentItem}
                    onComplete={() =>
                      handleComplete(
                        currentItem.item,
                        currentItem.occurrenceDate,
                      )
                    }
                    onDetails={() =>
                      handleItemClick(
                        currentItem.item,
                        currentItem.occurrenceDate,
                      )
                    }
                    themeClasses={themeClasses}
                    isHighlighted
                  />
                </AnimatePresence>
              </div>

              {organizedTasks.upcoming.length > 1 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRight
                      className={cn("w-4 h-4", themeClasses.textMuted)}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wider",
                        themeClasses.textMuted,
                      )}
                    >
                      Up Next
                    </span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full",
                        "bg-bg-card-custom",
                        themeClasses.textFaint,
                      )}
                    >
                      {organizedTasks.upcoming.length - 1}
                    </span>
                  </div>
                  <div
                    className={cn("rounded-2xl border", themeClasses.border)}
                  >
                    {organizedTasks.upcoming.slice(1, 4).map((occ, idx) => (
                      <div
                        key={`${occ.item.id}-${occ.occurrenceDate.toISOString()}`}
                        className={cn(
                          idx > 0 && "border-t",
                          themeClasses.border,
                        )}
                      >
                        <MiniTaskRow
                          occ={occ}
                          onClick={() =>
                            handleItemClick(occ.item, occ.occurrenceDate)
                          }
                          themeClasses={themeClasses}
                        />
                      </div>
                    ))}
                    {organizedTasks.upcoming.length > 4 && (
                      <div
                        className={cn(
                          "p-3 text-center border-t",
                          themeClasses.border,
                        )}
                      >
                        <span className={cn("text-xs", themeClasses.textFaint)}>
                          +{organizedTasks.upcoming.length - 4} more
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className={cn(
                  "w-20 h-20 rounded-2xl flex items-center justify-center mb-4",
                  "bg-[var(--primary)]/10 border border-[var(--primary)]/20",
                )}
              >
                <Check className={cn("w-10 h-10", themeClasses.text)} />
              </motion.div>
              <h3
                className={cn(
                  "text-lg font-semibold mb-2",
                  themeClasses.headerText,
                )}
              >
                All Clear!
              </h3>
              <p
                className={cn(
                  "text-sm max-w-[240px] mb-6",
                  themeClasses.textMuted,
                )}
              >
                {stats.completedCount > 0
                  ? "You've crushed it today. Time to relax or dream up something new."
                  : "Nothing on the agenda. Perfect time to plan ahead!"}
              </p>
              <motion.button
                type="button"
                onClick={handleQuickEntry}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-xl font-medium",
                  "bg-[var(--primary)]/20 border border-[var(--primary)]/30",
                  themeClasses.text,
                )}
              >
                <Plus className="w-5 h-5" />
                <span>Add Something</span>
              </motion.button>
            </motion.div>
          )}

          {stats.overdueCount > 0 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowOverdue(!showOverdue)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl",
                  "bg-amber-500/10 border border-amber-500/20",
                )}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">
                    {stats.overdueCount} Overdue
                  </span>
                </div>
                {showOverdue ? (
                  <EyeOff className="w-4 h-4 text-amber-400/70" />
                ) : (
                  <Eye className="w-4 h-4 text-amber-400/70" />
                )}
              </button>

              <AnimatePresence>
                {showOverdue && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div
                      className={cn(
                        "mt-2 rounded-xl border divide-y",
                        themeClasses.border,
                      )}
                    >
                      {organizedTasks.overdue.map((occ) => (
                        <MiniTaskRow
                          key={`${occ.item.id}-${occ.occurrenceDate.toISOString()}`}
                          occ={occ}
                          onClick={() =>
                            handleItemClick(occ.item, occ.occurrenceDate)
                          }
                          themeClasses={themeClasses}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {currentItem && (
            <motion.button
              type="button"
              onClick={handleQuickEntry}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={cn(
                "w-full mt-6 flex items-center justify-center gap-2 p-4 rounded-xl",
                "bg-bg-card-custom/30 border border-dashed",
                themeClasses.border,
                themeClasses.textFaint,
              )}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add something new</span>
            </motion.button>
          )}
        </div>
      </div>

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={() => handleEdit(selectedItem)}
          onComplete={() => {
            handleComplete(selectedItem, selectedOccurrenceDate || new Date());
            setSelectedItem(null);
          }}
          onDelete={() => {
            handleDelete(selectedItem, selectedOccurrenceDate || undefined);
          }}
        />
      )}

      <EditItemDialog
        item={editingItem}
        open={!!editingItem}
        onOpenChange={(open: boolean) => !open && setEditingItem(null)}
      />
    </div>
  );
}
