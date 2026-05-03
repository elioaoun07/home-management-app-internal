"use client";

/**
 * FocusPage - AI-Powered Personal Assistant
 *
 * Key features:
 * - AI-generated daily briefing (cached, refreshed once per day)
 * - Smart insights and priority suggestions
 * - Living avatar that reacts to user actions
 * - Celebration effects on task completion
 * - Ambient life through subtle animations
 */

import { FlexibleRoutinesPool } from "@/components/focus/FlexibleRoutinesPool";
import { ScheduleRoutineSheet } from "@/components/focus/ScheduleRoutineSheet";
import EditItemDialog from "@/components/items/EditItemDialog";
import ItemDetailModal from "@/components/items/ItemDetailModal";
import { MOBILE_CONTENT_BOTTOM_OFFSET } from "@/constants/layout";
import {
  useFlexibleRoutines,
  type FlexibleRoutineItem,
} from "@/features/items/useFlexibleRoutines";
import {
  generateFallbackInsights,
  useFocusInsights,
  type FocusItem,
} from "@/features/items/useFocusInsights";
import {
  isOccurrenceCompleted,
  useAllOccurrenceActions,
  useItemActionsWithToast,
} from "@/features/items/useItemActions";
import { useItems } from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import {
  adjustOccurrenceToWallClock,
  getOccurrencesInRange,
} from "@/lib/utils/date";
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
  Brain,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Lightbulb,
  ListTodo,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Zap,
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

// buildFullRRuleString imported from @/lib/utils/date

function expandRecurringItems(
  items: ItemWithDetails[],
  startDate: Date,
  endDate: Date,
  actions: any[],
): ExpandedOccurrence[] {
  const result: ExpandedOccurrence[] = [];

  for (const item of items) {
    // Skip legacy is_flexible container items
    if (item.recurrence_rule?.is_flexible) continue;

    const itemDate = getItemDate(item);
    if (!itemDate) continue;

    const isRecurring =
      item.recurrence_rule?.rrule && item.recurrence_rule.rrule.length > 0;

    if (isRecurring) {
      try {
        const exceptions = new Set(
          (item.recurrence_rule?.exceptions || []).map((e: any) =>
            format(parseISO(e.exception_date), "yyyy-MM-dd"),
          ),
        );
        const occurrences = getOccurrencesInRange(
          item.recurrence_rule!,
          itemDate,
          startDate,
          endDate,
        );
        for (const occ of occurrences) {
          const occDateKey = format(occ, "yyyy-MM-dd");
          if (exceptions.has(occDateKey)) continue;
          const adjusted = adjustOccurrenceToWallClock(occ, itemDate);
          const completed = isOccurrenceCompleted(item.id, occ, actions);
          result.push({
            item,
            occurrenceDate: adjusted,
            isCompleted: completed,
          });
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

// Convert ExpandedOccurrence to FocusItem for AI
function toFocusItem(occ: ExpandedOccurrence, today: Date): FocusItem {
  return {
    id: occ.item.id,
    type: occ.item.type,
    title: occ.item.title,
    description: occ.item.description || undefined,
    dueAt: occ.occurrenceDate.toISOString(),
    priority: occ.item.priority,
    isCompleted: occ.isCompleted,
    isOverdue: isBefore(occ.occurrenceDate, today) && !occ.isCompleted,
  };
}

// ============================================
// ASSISTANT NAME
// ============================================
const ASSISTANT_NAME = "Focus";

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
  isGenerating,
}: {
  mood: AssistantMood;
  isGenerating?: boolean;
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

  const currentMood = isGenerating ? "thinking" : mood;

  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      {/* Outer glow */}
      <motion.div
        variants={glowVariants}
        animate={currentMood}
        className="absolute inset-0 rounded-full bg-[var(--primary)]/30 blur-xl"
      />

      {/* Middle ring */}
      <motion.div
        variants={pulseVariants}
        animate={currentMood}
        className="absolute inset-1 rounded-full border-2 border-[var(--primary)]/30"
      />

      {/* Core orb */}
      <motion.div
        variants={pulseVariants}
        animate={currentMood}
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
          key={currentMood}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {currentMood === "celebrating" ? (
            <Sparkles className="w-5 h-5 text-white" />
          ) : currentMood === "thinking" ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            />
          ) : (
            <Brain className="w-5 h-5 text-white" />
          )}
        </motion.div>
      </motion.div>

      {/* Orbiting particles when happy/celebrating */}
      {(currentMood === "happy" || currentMood === "celebrating") && (
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
// AI BRIEFING CARD
// ============================================
function AIBriefingCard({
  insight,
  isLoading,
  isStale,
  canRefresh,
  onRefresh,
  themeClasses,
}: {
  insight: {
    greeting: string;
    summary: string;
    focusTip: string | null;
    encouragement: string | null;
    newItemsSinceGeneration?: number;
  } | null;
  isLoading: boolean;
  isStale: boolean;
  canRefresh: boolean;
  onRefresh: () => void;
  themeClasses: ReturnType<typeof useThemeClasses>;
}) {
  const { displayedText, isTyping } = useTypingAnimation(
    insight?.summary || "",
    25,
  );

  if (isLoading && !insight) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "p-4 rounded-2xl border",
          "bg-bg-card-custom/50",
          themeClasses.border,
        )}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className={cn(
              "w-5 h-5 border-2 rounded-full",
              "border-[var(--primary)]/30 border-t-[var(--primary)]",
            )}
          />
          <span className={cn("text-sm", themeClasses.textMuted)}>
            Analyzing your schedule...
          </span>
        </div>
      </motion.div>
    );
  }

  if (!insight) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border",
        "bg-gradient-to-br from-bg-card-custom/80 to-bg-card-custom/40",
        isStale ? "border-amber-500/30" : themeClasses.border,
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative p-4 space-y-3">
        {/* Header with greeting */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className={cn("text-lg font-semibold", themeClasses.headerText)}>
              {insight.greeting}
            </p>
          </div>
          {canRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className={cn(
                "p-2 rounded-lg transition-all",
                "hover:bg-[var(--primary)]/10",
                themeClasses.textMuted,
              )}
              title={isStale ? "Refresh insights" : "Insights are up to date"}
            >
              <RefreshCw
                className={cn("w-4 h-4", isLoading && "animate-spin")}
              />
            </button>
          )}
        </div>

        {/* Summary with typing effect */}
        <div
          className={cn(
            "p-3 rounded-xl",
            "bg-bg-dark/30 border",
            themeClasses.border,
          )}
        >
          <div className="flex items-start gap-2">
            <Zap
              className={cn("w-4 h-4 mt-0.5 flex-shrink-0", themeClasses.text)}
            />
            <p className={cn("text-sm leading-relaxed", themeClasses.text)}>
              {displayedText}
              {isTyping && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="ml-0.5"
                >
                  |
                </motion.span>
              )}
            </p>
          </div>
        </div>

        {/* Focus Tip */}
        {insight.focusTip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "flex items-start gap-2 p-3 rounded-xl",
              "bg-[var(--primary)]/10 border border-[var(--primary)]/20",
            )}
          >
            <Lightbulb
              className={cn("w-4 h-4 mt-0.5 flex-shrink-0", themeClasses.text)}
            />
            <p className={cn("text-sm", themeClasses.text)}>
              {insight.focusTip}
            </p>
          </motion.div>
        )}

        {/* Encouragement */}
        {insight.encouragement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2 pt-1"
          >
            <Sparkles className={cn("w-3.5 h-3.5", "text-emerald-400")} />
            <p className="text-xs text-emerald-400">{insight.encouragement}</p>
          </motion.div>
        )}

        {/* New items indicator */}
        {insight.newItemsSinceGeneration &&
          insight.newItemsSinceGeneration > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Plus className={cn("w-3.5 h-3.5", themeClasses.textFaint)} />
              <p className={cn("text-xs", themeClasses.textFaint)}>
                {insight.newItemsSinceGeneration} new item
                {insight.newItemsSinceGeneration > 1 ? "s" : ""} since last
                analysis
              </p>
            </div>
          )}

        {/* Stale indicator */}
        {isStale && (
          <div className="flex items-center gap-2 pt-1">
            <Clock className="w-3.5 h-3.5 text-amber-400/70" />
            <p className="text-xs text-amber-400/70">
              Insights from earlier today • Tap refresh for fresh analysis
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// PRIORITY INSIGHTS SECTION
// ============================================
function PriorityInsightsSection({
  insights,
  items,
  onItemClick,
  themeClasses,
}: {
  insights: Array<{
    itemId: string | null;
    reason: string;
    suggestedAction?: string;
  }>;
  items: ExpandedOccurrence[];
  onItemClick: (item: ItemWithDetails, date: Date) => void;
  themeClasses: ReturnType<typeof useThemeClasses>;
}) {
  if (!insights || insights.length === 0) return null;

  const validInsights = insights.filter((i) => i.itemId);

  if (validInsights.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-2"
    >
      <div className="flex items-center gap-2">
        <Target className={cn("w-4 h-4", themeClasses.text)} />
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            themeClasses.textMuted,
          )}
        >
          AI Priorities
        </span>
      </div>

      <div className="space-y-2">
        {validInsights.map((insight, idx) => {
          const matchedOcc = items.find((i) => i.item.id === insight.itemId);
          if (!matchedOcc) return null;

          return (
            <motion.button
              key={insight.itemId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * idx }}
              onClick={() =>
                onItemClick(matchedOcc.item, matchedOcc.occurrenceDate)
              }
              className={cn(
                "w-full text-left p-3 rounded-xl transition-all",
                "bg-bg-card-custom/50 border",
                themeClasses.border,
                "hover:bg-bg-card-custom/80 hover:border-[var(--primary)]/30",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                    "bg-[var(--primary)]/20",
                  )}
                >
                  <span className={cn("text-xs font-bold", themeClasses.text)}>
                    {idx + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium truncate",
                      themeClasses.headerText,
                    )}
                  >
                    {matchedOcc.item.title}
                  </p>
                  <p className={cn("text-xs mt-0.5", themeClasses.textMuted)}>
                    {insight.reason}
                  </p>
                  {insight.suggestedAction && (
                    <p className={cn("text-xs mt-1", themeClasses.text)}>
                      → {insight.suggestedAction}
                    </p>
                  )}
                </div>
                <ChevronRight
                  className={cn(
                    "w-4 h-4 flex-shrink-0",
                    themeClasses.textFaint,
                  )}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
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

  // Flexible routines state
  const [scheduleSheetItem, setScheduleSheetItem] =
    useState<FlexibleRoutineItem | null>(null);
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAssistantMood("happy");
    const timeout = setTimeout(() => setAssistantMood("neutral"), 2000);
    return () => clearTimeout(timeout);
  }, []);

  // Update current time every minute so overdue detection stays fresh
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();
  const itemActions = useItemActionsWithToast();

  // Flexible routines hook
  const { data: flexibleRoutines } = useFlexibleRoutines(
    allItems,
    occurrenceActions,
    new Date(),
  );

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

      // Compare against current time so today's past-due items are overdue
      if (isBefore(occ.occurrenceDate, now)) {
        overdue.push(occ);
      } else if (
        isToday(occ.occurrenceDate) ||
        (timeScope === "week" && occ.occurrenceDate <= scopeEnd)
      ) {
        upcoming.push(occ);
      }
    }

    return { overdue, upcoming, completed };
  }, [
    activeItems,
    occurrenceActions,
    today,
    now,
    weekStart,
    weekEnd,
    timeScope,
  ]);

  // Convert to FocusItems for AI
  const focusItemsForAI = useMemo(() => {
    const all = [
      ...organizedTasks.overdue,
      ...organizedTasks.upcoming,
      ...organizedTasks.completed,
    ];
    return all.map((occ) => toFocusItem(occ, now));
  }, [organizedTasks, now]);

  // AI Insights hook
  const {
    insight: aiInsight,
    isLoading: insightLoading,
    isGenerating,
    isStale,
    refresh: refreshInsight,
    canRefresh,
  } = useFocusInsights(focusItemsForAI);

  // Fallback insights when AI is not available
  const fallbackInsight = useMemo(() => {
    return generateFallbackInsights(
      focusItemsForAI,
      organizedTasks.completed.length,
      organizedTasks.overdue.length,
    );
  }, [
    focusItemsForAI,
    organizedTasks.completed.length,
    organizedTasks.overdue.length,
  ]);

  // Use AI insight if available, otherwise fallback
  const displayInsight = useMemo(() => {
    if (aiInsight) {
      return {
        greeting: aiInsight.greeting,
        summary: aiInsight.summary,
        focusTip: aiInsight.focusTip,
        encouragement: aiInsight.encouragement,
        priorityInsights: aiInsight.priorityInsights,
        newItemsSinceGeneration: aiInsight.newItemsSinceGeneration,
      };
    }
    return {
      ...fallbackInsight,
      priorityInsights: [],
      newItemsSinceGeneration: 0,
    };
  }, [aiInsight, fallbackInsight]);

  const currentItem = organizedTasks.upcoming[0] || null;

  const stats = useMemo(
    () => ({
      remaining: organizedTasks.upcoming.length,
      overdueCount: organizedTasks.overdue.length,
      completedCount: organizedTasks.completed.length,
    }),
    [organizedTasks],
  );

  useEffect(() => {
    if (isLoading || insightLoading) {
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
  }, [isLoading, insightLoading, stats]);

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
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <AssistantAvatar
                mood={assistantMood}
                isGenerating={isGenerating}
              />
              <div>
                <h1
                  className={cn("text-xl font-bold", themeClasses.headerText)}
                >
                  {ASSISTANT_NAME}
                </h1>
                <p className={cn("text-xs", themeClasses.textMuted)}>
                  {format(new Date(), "EEEE, MMMM d")}
                </p>
              </div>
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

          {/* AI Briefing Card */}
          <div className="mb-4">
            <AIBriefingCard
              insight={displayInsight}
              isLoading={insightLoading || isGenerating}
              isStale={isStale}
              canRefresh={canRefresh}
              onRefresh={() => refreshInsight(true)}
              themeClasses={themeClasses}
            />
          </div>

          {/* Flexible Routines Pool */}
          {flexibleRoutines && (
            <div className="mb-4">
              <FlexibleRoutinesPool
                unscheduled={flexibleRoutines.unscheduled}
                scheduled={flexibleRoutines.scheduled}
                periodLabel={flexibleRoutines.periodLabel}
                periodStart={flexibleRoutines.periodStart}
                periodEnd={flexibleRoutines.periodEnd}
                onSchedule={(item) => {
                  setScheduleSheetItem(item);
                  setScheduleSheetOpen(true);
                }}
                onViewItem={(item) => {
                  setSelectedItem(item);
                  setSelectedOccurrenceDate(new Date());
                }}
              />
            </div>
          )}

          {/* Stats Bar */}
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
          ) : (
            <>
              {/* AI Priority Insights */}
              {displayInsight.priorityInsights &&
                displayInsight.priorityInsights.length > 0 && (
                  <div className="mb-6">
                    <PriorityInsightsSection
                      insights={displayInsight.priorityInsights}
                      items={[
                        ...organizedTasks.overdue,
                        ...organizedTasks.upcoming,
                      ]}
                      onItemClick={handleItemClick}
                      themeClasses={themeClasses}
                    />
                  </div>
                )}

              {/* Current Focus */}
              {currentItem ? (
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
                        className={cn(
                          "rounded-2xl border",
                          themeClasses.border,
                        )}
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
                            <span
                              className={cn("text-xs", themeClasses.textFaint)}
                            >
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
            </>
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

      {/* Schedule Flexible Routine Sheet */}
      <ScheduleRoutineSheet
        item={scheduleSheetItem}
        open={scheduleSheetOpen}
        onOpenChange={setScheduleSheetOpen}
        onScheduled={() => {
          setScheduleSheetItem(null);
        }}
      />
    </div>
  );
}
