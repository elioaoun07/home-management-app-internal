"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getPostponedOccurrencesForDate,
  isOccurrenceCompleted,
  normalizeToLocalDateString,
  useAllOccurrenceActions,
  useItemActionsWithToast,
  useUndoOccurrenceAction,
  type ItemOccurrenceAction,
  type PostponeType,
} from "@/features/items/useItemActions";
import {
  useAddSubtask,
  useAllSubtaskCompletions,
  useDeleteSubtask,
  useItems,
  useToggleSubtask,
  useToggleSubtaskForOccurrence,
  useUpdateSubtask,
  type SubtaskCompletion,
} from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type { ItemType, ItemWithDetails, Subtask } from "@/types/items";
import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  formatDistanceToNow,
  isBefore,
  isPast,
  isSameDay,
  isToday,
  isTomorrow,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Expand,
  Eye,
  EyeOff,
  FastForward,
  Flame,
  ListTodo,
  Plus,
  Repeat,
  RotateCcw,
  Square,
  Target,
  Trash2,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RRule } from "rrule";
import { toast } from "sonner";
import { TaskFocusModal } from "./TaskFocusModal";
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

// ============================================
// CONSTANTS
// ============================================

const typeColors: Record<
  ItemType,
  { bg: string; border: string; text: string; icon: typeof Calendar }
> = {
  reminder: {
    bg: "bg-cyan-500/20",
    border: "border-l-cyan-400",
    text: "text-cyan-400",
    icon: Bell,
  },
  event: {
    bg: "bg-pink-500/20",
    border: "border-l-pink-400",
    text: "text-pink-400",
    icon: Calendar,
  },
  task: {
    bg: "bg-purple-500/20",
    border: "border-l-purple-400",
    text: "text-purple-400",
    icon: ListTodo,
  },
};

const priorityColors: Record<string, string> = {
  urgent: "text-red-400 bg-red-500/20",
  high: "text-orange-400 bg-orange-500/20",
  normal: "text-blue-400 bg-blue-500/20",
  low: "text-gray-400 bg-gray-500/20",
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Build a full RRULE string including COUNT and UNTIL from recurrence_rule
function buildFullRRuleString(
  dtstart: Date,
  recurrenceRule: {
    rrule: string;
    count?: number | null;
    end_until?: string | null;
  }
): string {
  let rrulePart = recurrenceRule.rrule;

  // Add COUNT if specified
  if (recurrenceRule.count && !rrulePart.includes("COUNT=")) {
    rrulePart += `;COUNT=${recurrenceRule.count}`;
  }

  // Add UNTIL if specified (and no COUNT)
  if (
    recurrenceRule.end_until &&
    !recurrenceRule.count &&
    !rrulePart.includes("UNTIL=")
  ) {
    const untilDate = parseISO(recurrenceRule.end_until);
    const untilStr =
      untilDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    rrulePart += `;UNTIL=${untilStr}`;
  }

  return `DTSTART:${dtstart.toISOString().replace(/[-:]/g, "").split(".")[0]}Z\nRRULE:${rrulePart}`;
}

function getItemDate(item: ItemWithDetails): Date | null {
  const dateStr =
    item.type === "reminder" || item.type === "task"
      ? item.reminder_details?.due_at
      : item.type === "event"
        ? item.event_details?.start_at
        : null;
  return dateStr ? parseISO(dateStr) : null;
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
          // Include completed items but mark them as completed
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
      // Include completed items but mark them as completed
      result.push({
        item,
        occurrenceDate: itemDate,
        isCompleted,
      });
    }
  }

  // Add postponed occurrences that fall within this date range
  // Check each day in the range for postponed items
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayPostponed = getPostponedOccurrencesForDate(
      items,
      currentDate,
      actions
    );
    for (const p of dayPostponed) {
      // Check if this item+date combo is already in results (avoid duplicates)
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
// SUB-COMPONENTS
// ============================================

// Helper to build nested subtask tree
interface SubtaskWithChildren extends Subtask {
  children: SubtaskWithChildren[];
}

function buildSubtaskTree(subtasks: Subtask[]): SubtaskWithChildren[] {
  const map = new Map<string, SubtaskWithChildren>();
  const roots: SubtaskWithChildren[] = [];

  // Initialize map
  for (const s of subtasks) {
    map.set(s.id, { ...s, children: [] });
  }

  // Build tree
  for (const s of subtasks) {
    const node = map.get(s.id)!;
    if (s.parent_subtask_id && map.has(s.parent_subtask_id)) {
      map.get(s.parent_subtask_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by order_index
  const sortChildren = (nodes: SubtaskWithChildren[]) => {
    nodes.sort((a, b) => a.order_index - b.order_index);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}

// Nested Subtask Item Component (with full nesting support)
function NestedSubtaskItem({
  subtask,
  isRecurring,
  occurrenceDate,
  isSubtaskCompleted,
  onToggle,
  onDelete,
  onUpdate,
  onAddSubtask,
  depth = 0,
  maxDepth = 3,
  isOverdue,
  overdueFromDate,
}: {
  subtask: SubtaskWithChildren;
  isRecurring: boolean;
  occurrenceDate: Date;
  isSubtaskCompleted: (id: string) => boolean;
  onToggle: (subtask: Subtask) => void;
  onDelete: (subtaskId: string) => void;
  onUpdate: (subtaskId: string, title: string) => void;
  onAddSubtask: (parentSubtaskId: string, title: string) => void;
  depth?: number;
  maxDepth?: number;
  isOverdue?: boolean;
  overdueFromDate?: Date;
}) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [showChildren, setShowChildren] = useState(true);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);
  const [childTitle, setChildTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const hasChildren = subtask.children.length > 0;
  const canAddChildren = depth < maxDepth;
  const isCompleted = isSubtaskCompleted(subtask.id);

  useEffect(() => {
    if (isAddingChild && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingChild]);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== subtask.title) {
      onUpdate(subtask.id, trimmed);
    } else {
      setEditTitle(subtask.title);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(subtask.title);
    setIsEditing(false);
  };

  const handleAddChild = () => {
    if (childTitle.trim()) {
      onAddSubtask(subtask.id, childTitle.trim());
      setChildTitle("");
      setIsAddingChild(false);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "group/subtask flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors",
          isOverdue && "border border-red-500/30 bg-red-500/5"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand/collapse for parent subtasks */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setShowChildren(!showChildren)}
            className="w-4 h-4 flex items-center justify-center text-white/50 hover:text-white/80 flex-shrink-0"
          >
            {showChildren ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        <button
          type="button"
          onClick={() => onToggle(subtask)}
          className={cn(
            "w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0",
            isCompleted
              ? "bg-green-500 border-green-500"
              : isOverdue
                ? "border-red-400/50 hover:border-red-400"
                : isPink
                  ? "border-pink-400/50 hover:border-pink-400"
                  : "border-cyan-400/50 hover:border-cyan-400"
          )}
        >
          {isCompleted && <Check className="w-3 h-3 text-white" />}
        </button>

        {/* Title - inline editable */}
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit();
              if (e.key === "Escape") handleCancelEdit();
            }}
            className={cn(
              "flex-1 text-sm bg-transparent border-b outline-none",
              isPink
                ? "border-pink-400/50 focus:border-pink-400"
                : "border-cyan-400/50 focus:border-cyan-400"
            )}
          />
        ) : (
          <span
            onClick={() => !isCompleted && setIsEditing(true)}
            className={cn(
              "flex-1 text-sm",
              isCompleted
                ? "line-through text-white/40"
                : isOverdue
                  ? "text-red-400 cursor-text hover:text-red-300"
                  : "text-white/80 cursor-text hover:text-white"
            )}
          >
            {subtask.title}
          </span>
        )}

        {/* Add child subtask button */}
        {canAddChildren && !isCompleted && !isEditing && (
          <button
            type="button"
            onClick={() => setIsAddingChild(true)}
            className={cn(
              "p-1 rounded transition-all",
              isPink
                ? "text-pink-400/70 hover:text-pink-400 hover:bg-pink-500/20"
                : "text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/20"
            )}
            title="Add sub-item"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {/* Delete button */}
        {!isEditing && (
          <button
            type="button"
            onClick={() => onDelete(subtask.id)}
            className="p-1 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 rounded transition-all"
            title="Delete subtask"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Add child input */}
      <AnimatePresence>
        {isAddingChild && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-2 py-1 px-2"
              style={{ paddingLeft: `${24 + (depth + 1) * 16}px` }}
            >
              <Square className="w-4 h-4 text-white/30 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={childTitle}
                onChange={(e) => setChildTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddChild();
                  if (e.key === "Escape") {
                    setIsAddingChild(false);
                    setChildTitle("");
                  }
                }}
                onBlur={() => {
                  if (!childTitle.trim()) {
                    setIsAddingChild(false);
                  }
                }}
                placeholder="Sub-item title..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={handleAddChild}
                disabled={!childTitle.trim()}
                className="p-1 text-green-400 hover:bg-green-500/20 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Children */}
      <AnimatePresence>
        {showChildren && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {subtask.children.map((child) => (
              <NestedSubtaskItem
                key={child.id}
                subtask={child}
                isRecurring={isRecurring}
                occurrenceDate={occurrenceDate}
                isSubtaskCompleted={isSubtaskCompleted}
                onToggle={onToggle}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onAddSubtask={onAddSubtask}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Simple Subtask Item (for overdue display only - no nesting)
function SubtaskItem({
  subtask,
  isRecurring,
  occurrenceDate,
  isCompletedForOccurrence,
  onToggle,
  onDelete,
  onUpdate,
  isOverdue,
  overdueFromDate,
}: {
  subtask: Subtask;
  isRecurring: boolean;
  occurrenceDate: Date;
  isCompletedForOccurrence: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (title: string) => void;
  isOverdue?: boolean;
  overdueFromDate?: Date;
}) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== subtask.title) {
      onUpdate(trimmed);
    } else {
      setEditTitle(subtask.title);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(subtask.title);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "group/subtask flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors",
        isOverdue && "border border-red-500/30 bg-red-500/5"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0",
          isCompletedForOccurrence
            ? "bg-green-500 border-green-500"
            : isOverdue
              ? "border-red-400/50 hover:border-red-400"
              : isPink
                ? "border-pink-400/50 hover:border-pink-400"
                : "border-cyan-400/50 hover:border-cyan-400"
        )}
      >
        {isCompletedForOccurrence && <Check className="w-3 h-3 text-white" />}
      </button>
      {isEditing ? (
        <input
          ref={editInputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSaveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSaveEdit();
            if (e.key === "Escape") handleCancelEdit();
          }}
          className={cn(
            "flex-1 text-sm bg-transparent border-b outline-none",
            isPink
              ? "border-pink-400/50 focus:border-pink-400"
              : "border-cyan-400/50 focus:border-cyan-400"
          )}
        />
      ) : (
        <span
          onClick={() => !isCompletedForOccurrence && setIsEditing(true)}
          className={cn(
            "flex-1 text-sm",
            isCompletedForOccurrence
              ? "line-through text-white/40"
              : isOverdue
                ? "text-red-400 cursor-text hover:text-red-300"
                : "text-white/80 cursor-text hover:text-white"
          )}
        >
          {subtask.title}
        </span>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="p-1 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 rounded transition-all"
        title="Delete subtask"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// Add Subtask Input
function AddSubtaskInput({
  itemId,
  onAdd,
}: {
  itemId: string;
  onAdd: (title: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const isPink = theme === "pink";

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleSubmit = () => {
    if (title.trim()) {
      onAdd(title.trim());
      setTitle("");
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm transition-colors w-full",
          isPink
            ? "text-pink-400/70 hover:bg-pink-500/10 hover:text-pink-400"
            : "text-cyan-400/70 hover:bg-cyan-500/10 hover:text-cyan-400"
        )}
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add subtask</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1 px-2">
      <Square className="w-4 h-4 text-white/30 flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") {
            setIsAdding(false);
            setTitle("");
          }
        }}
        onBlur={() => {
          if (!title.trim()) {
            setIsAdding(false);
          }
        }}
        placeholder="Subtask title..."
        className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/30"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!title.trim()}
        className="p-1 text-green-400 hover:bg-green-500/20 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Today Focus Card - Quick action card for immediate tasks
function TodayTaskCard({
  occurrence,
  onComplete,
  onCancel,
  onPostpone,
  onUndo,
  onExpand,
  subtaskCompletions,
}: {
  occurrence: ExpandedOccurrence;
  onComplete: (notes?: string) => void;
  onCancel: (notes?: string) => void;
  onPostpone: () => void;
  onUndo?: () => void;
  onExpand?: () => void;
  subtaskCompletions?: SubtaskCompletion[];
}) {
  const { item, occurrenceDate, isCompleted, isPostponed, originalDate } =
    occurrence;
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const colors = typeColors[item.type];
  const Icon = colors.icon;
  const isOverdue = isPast(occurrenceDate) && !isCompleted;
  const [showSubtasks, setShowSubtasks] = useState(
    (item.subtasks?.length ?? 0) > 0
  );
  const [notes, setNotes] = useState("");

  // Subtask mutations
  const toggleSubtask = useToggleSubtask();
  const toggleSubtaskForOccurrence = useToggleSubtaskForOccurrence();
  const addSubtask = useAddSubtask();
  const deleteSubtask = useDeleteSubtask();
  const updateSubtask = useUpdateSubtask();

  const isRecurring = !!item.recurrence_rule;
  const subtasks = item.subtasks || [];

  const today = startOfDay(new Date());
  const currentOcc = startOfDay(occurrenceDate);
  const isViewingPast = isBefore(currentOcc, today);

  // Check if a subtask is completed for a specific occurrence date
  const isSubtaskCompletedForDate = useCallback(
    (subtaskId: string, date: Date) => {
      if (isRecurring && subtaskCompletions) {
        const targetDateStr = normalizeToLocalDateString(date);
        return subtaskCompletions.some(
          (c) =>
            c.subtask_id === subtaskId &&
            normalizeToLocalDateString(new Date(c.occurrence_date)) ===
              targetDateStr
        );
      }
      // For one-time items, check done_at
      const subtask = subtasks.find((s) => s.id === subtaskId);
      return !!subtask?.done_at;
    },
    [isRecurring, subtaskCompletions, subtasks]
  );

  // Check if a subtask is completed for THIS occurrence
  const isSubtaskCompleted = useCallback(
    (subtaskId: string) => isSubtaskCompletedForDate(subtaskId, occurrenceDate),
    [isSubtaskCompletedForDate, occurrenceDate]
  );

  // Helper to get occurrence date from subtask
  const getSubtaskOccDate = (subtask: Subtask): Date | null => {
    if (!subtask.occurrence_date) return null;
    return new Date(subtask.occurrence_date);
  };

  // Subtasks for THIS occurrence:
  // - For recurring: subtasks where occurrence_date matches this occurrence
  // - For non-recurring: all subtasks (occurrence_date is null)
  const currentOccurrenceSubtasks = useMemo(() => {
    if (!isRecurring) {
      return subtasks; // Non-recurring: all subtasks belong to the item
    }
    const occDateStr = normalizeToLocalDateString(occurrenceDate);
    return subtasks.filter((s) => {
      if (!s.occurrence_date) return false;
      return (
        normalizeToLocalDateString(new Date(s.occurrence_date)) === occDateStr
      );
    });
  }, [subtasks, isRecurring, occurrenceDate]);

  // Overdue subtasks: subtasks from PAST occurrences that weren't completed
  // Only show when viewing today or future occurrence
  const overdueSubtasksWithDates = useMemo((): Array<{
    subtask: Subtask;
    homeOccurrence: Date;
  }> => {
    if (!isRecurring) return [];

    // Only show overdue when viewing today or future
    if (isViewingPast) return [];

    const overdueList: Array<{ subtask: Subtask; homeOccurrence: Date }> = [];

    for (const subtask of subtasks) {
      const subtaskOccDate = getSubtaskOccDate(subtask);
      if (!subtaskOccDate) continue;

      const subtaskOcc = startOfDay(subtaskOccDate);

      // Only consider subtasks from past occurrences (not this one)
      if (isSameDay(subtaskOcc, currentOcc)) continue;
      if (!isBefore(subtaskOcc, currentOcc)) continue;

      // Only show if the subtask's occurrence is in the past (before today)
      if (!isBefore(subtaskOcc, today)) continue;

      // Check if NOT completed for its occurrence
      if (!isSubtaskCompletedForDate(subtask.id, subtaskOccDate)) {
        overdueList.push({ subtask, homeOccurrence: subtaskOccDate });
      }
    }

    // Sort by date (oldest first)
    return overdueList.sort(
      (a, b) => a.homeOccurrence.getTime() - b.homeOccurrence.getTime()
    );
  }, [
    isRecurring,
    isViewingPast,
    subtasks,
    currentOcc,
    today,
    isSubtaskCompletedForDate,
  ]);

  // Count completed subtasks for current occurrence (only top-level)
  const topLevelSubtasks = currentOccurrenceSubtasks.filter(
    (s) => !s.parent_subtask_id
  );
  const completedSubtasksCount = topLevelSubtasks.filter((s) =>
    isSubtaskCompleted(s.id)
  ).length;

  // Build nested tree from flat subtasks
  const subtaskTree = useMemo(
    () => buildSubtaskTree(currentOccurrenceSubtasks),
    [currentOccurrenceSubtasks]
  );

  const hasCurrentSubtasks = topLevelSubtasks.length > 0;
  const hasOverdueSubtasks = overdueSubtasksWithDates.length > 0;

  // Handle subtask toggle
  const handleSubtaskToggle = async (subtask: Subtask) => {
    const currentlyCompleted = isSubtaskCompleted(subtask.id);

    if (isRecurring) {
      await toggleSubtaskForOccurrence.mutateAsync({
        subtaskId: subtask.id,
        occurrenceDate: occurrenceDate.toISOString(),
        completed: !currentlyCompleted,
      });
    } else {
      await toggleSubtask.mutateAsync({
        id: subtask.id,
        done: !currentlyCompleted,
      });
    }

    // Check if all subtasks for current occurrence are now completed -> auto-complete the task
    const willAllBeCompleted = currentOccurrenceSubtasks.every((s) =>
      s.id === subtask.id ? !currentlyCompleted : isSubtaskCompleted(s.id)
    );

    if (willAllBeCompleted && currentOccurrenceSubtasks.length > 0) {
      // Small delay for visual feedback before auto-completing
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  };

  // Handle add subtask - links to THIS occurrence for recurring items
  const handleAddSubtask = async (title: string) => {
    await addSubtask.mutateAsync({
      parentItemId: item.id,
      title,
      occurrenceDate: isRecurring ? occurrenceDate.toISOString() : undefined,
    });
  };

  // Handle add nested subtask
  const handleAddNestedSubtask = async (
    parentSubtaskId: string,
    title: string
  ) => {
    await addSubtask.mutateAsync({
      parentItemId: item.id,
      parentSubtaskId,
      title,
      occurrenceDate: isRecurring ? occurrenceDate.toISOString() : undefined,
    });
  };

  // Handle delete subtask
  const handleDeleteSubtask = async (subtaskId: string) => {
    await deleteSubtask.mutateAsync(subtaskId);
  };

  // Handle update subtask
  const handleUpdateSubtask = async (subtaskId: string, title: string) => {
    await updateSubtask.mutateAsync({ id: subtaskId, title });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        "group relative rounded-xl border-l-4 backdrop-blur-sm transition-all overflow-hidden",
        colors.border,
        isCompleted
          ? "bg-green-500/10 opacity-60"
          : isPostponed
            ? "bg-amber-500/10 border-l-amber-400"
            : isOverdue
              ? "bg-red-500/10 border-l-red-400"
              : "bg-white/5 hover:bg-white/10"
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Type Icon */}
          <div className={cn("p-2 rounded-lg", colors.bg)}>
            <Icon className={cn("w-5 h-5", colors.text)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3
                className={cn(
                  "font-medium text-white truncate",
                  isCompleted && "line-through text-white/50"
                )}
              >
                {item.title}
              </h3>
              {item.recurrence_rule && (
                <Repeat className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
              )}
              {item.priority === "urgent" && (
                <Zap className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Clock className="w-3 h-3" />
              <span>{format(occurrenceDate, "h:mm a")}</span>
              {(hasCurrentSubtasks || hasOverdueSubtasks) && (
                <span
                  className={cn(
                    "font-medium",
                    completedSubtasksCount === topLevelSubtasks.length
                      ? "text-green-400"
                      : isPink
                        ? "text-pink-400"
                        : "text-cyan-400"
                  )}
                >
                  • {completedSubtasksCount}/{topLevelSubtasks.length} subtasks
                  {hasOverdueSubtasks &&
                    ` (+${overdueSubtasksWithDates.length} overdue)`}
                </span>
              )}
              {isPostponed && originalDate && (
                <span className="text-amber-400 font-medium">
                  • moved from {format(originalDate, "MMM d")}
                </span>
              )}
              {isOverdue && !isPostponed && (
                <span className="text-red-400 font-medium">
                  • {formatDistanceToNow(occurrenceDate)} overdue
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions - always visible for better touch/click support */}
          {!isCompleted && (
            <div className="flex items-center gap-1">
              {onExpand && (
                <button
                  type="button"
                  onClick={onExpand}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isPink
                      ? "bg-pink-500/20 text-pink-400 hover:bg-pink-500/30"
                      : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                  )}
                  title="Focus Mode"
                >
                  <Expand className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onPostpone}
                className="p-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                title="Postpone"
              >
                <FastForward className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onCancel(notes || undefined)}
                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="Cancel this occurrence"
              >
                <XCircle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onComplete(notes || undefined)}
                className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                title="Mark complete"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-2">
              {onUndo && (
                <button
                  type="button"
                  onClick={onUndo}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors opacity-0 group-hover:opacity-100"
                  title="Undo completion"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="text-xs">Undo</span>
                </button>
              )}
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            </div>
          )}
        </div>

        {/* Notes textarea - show on hover/focus */}
        {!isCompleted && (
          <div className="mt-2 ml-11 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note (optional)..."
              rows={1}
              className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/70 placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                }
              }}
            />
          </div>
        )}

        {/* Subtasks Toggle */}
        {!isCompleted && (
          <button
            type="button"
            onClick={() => setShowSubtasks(!showSubtasks)}
            className={cn(
              "flex items-center gap-1 mt-2 ml-11 text-xs transition-colors",
              isPink
                ? "text-pink-400/70 hover:text-pink-400"
                : "text-cyan-400/70 hover:text-cyan-400"
            )}
          >
            {showSubtasks ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>
              {hasCurrentSubtasks || hasOverdueSubtasks
                ? `${topLevelSubtasks.length} subtask${topLevelSubtasks.length !== 1 ? "s" : ""}${hasOverdueSubtasks ? ` (+${overdueSubtasksWithDates.length} overdue)` : ""}`
                : "Add subtasks"}
            </span>
          </button>
        )}
      </div>

      {/* Subtasks List */}
      <AnimatePresence>
        {showSubtasks && !isCompleted && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 ml-8 border-t border-white/5 pt-2">
              <div className="space-y-0.5">
                {/* Overdue subtasks from previous occurrences */}
                {overdueSubtasksWithDates.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs font-medium text-red-400">
                        Overdue
                      </span>
                    </div>
                    <div className="space-y-0.5 pl-1 border-l-2 border-red-500/30">
                      {overdueSubtasksWithDates.map(
                        ({ subtask, homeOccurrence }) => (
                          <SubtaskItem
                            key={`overdue-${subtask.id}`}
                            subtask={subtask}
                            isRecurring={isRecurring}
                            occurrenceDate={homeOccurrence}
                            isCompletedForOccurrence={false}
                            onToggle={async () => {
                              // Complete the subtask for its home occurrence
                              if (isRecurring) {
                                await toggleSubtaskForOccurrence.mutateAsync({
                                  subtaskId: subtask.id,
                                  occurrenceDate: homeOccurrence.toISOString(),
                                  completed: true,
                                });
                              }
                            }}
                            onDelete={() => handleDeleteSubtask(subtask.id)}
                            onUpdate={(title) =>
                              handleUpdateSubtask(subtask.id, title)
                            }
                            isOverdue={true}
                            overdueFromDate={homeOccurrence}
                          />
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Current occurrence subtasks (nested tree) */}
                {subtaskTree.map((subtask) => (
                  <NestedSubtaskItem
                    key={subtask.id}
                    subtask={subtask}
                    isRecurring={isRecurring}
                    occurrenceDate={occurrenceDate}
                    isSubtaskCompleted={isSubtaskCompleted}
                    onToggle={handleSubtaskToggle}
                    onDelete={handleDeleteSubtask}
                    onUpdate={handleUpdateSubtask}
                    onAddSubtask={handleAddNestedSubtask}
                  />
                ))}
                <AddSubtaskInput itemId={item.id} onAdd={handleAddSubtask} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Mini Timeline Item
function TimelineItem({ occurrence }: { occurrence: ExpandedOccurrence }) {
  const { item, occurrenceDate, isCompleted } = occurrence;
  const colors = typeColors[item.type];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs",
        isCompleted ? "opacity-50" : "",
        colors.bg
      )}
    >
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isCompleted ? "bg-green-400" : colors.text.replace("text-", "bg-")
        )}
      />
      <span
        className={cn(
          "truncate",
          isCompleted && "line-through",
          "text-white/80"
        )}
      >
        {item.title}
      </span>
      {item.recurrence_rule && (
        <Repeat className="w-2.5 h-2.5 text-white/40 flex-shrink-0" />
      )}
    </div>
  );
}

// Enhanced Timeline Item with time
function EnhancedTimelineItem({
  occurrence,
}: {
  occurrence: ExpandedOccurrence;
}) {
  const { item, occurrenceDate, isCompleted } = occurrence;
  const colors = typeColors[item.type];
  const Icon = colors.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[11px]",
        isCompleted ? "opacity-50 bg-green-500/10" : colors.bg
      )}
    >
      <Icon
        className={cn(
          "w-3 h-3 flex-shrink-0",
          isCompleted ? "text-green-400" : colors.text
        )}
      />
      <span
        className={cn(
          "truncate flex-1",
          isCompleted ? "line-through text-green-400/70" : "text-white/90"
        )}
      >
        {item.title}
      </span>
      <span className="text-[10px] text-white/40 flex-shrink-0">
        {format(occurrenceDate, "h:mma").toLowerCase()}
      </span>
    </div>
  );
}

// Compact Stat Badge
function StatBadge({
  value,
  label,
  icon: Icon,
  color,
}: {
  value: number | string;
  label: string;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    green: { bg: "bg-green-500/20", text: "text-green-400" },
    red: { bg: "bg-red-500/20", text: "text-red-400" },
    amber: { bg: "bg-amber-500/20", text: "text-amber-400" },
    purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
    cyan: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
    orange: { bg: "bg-orange-500/20", text: "text-orange-400" },
  };

  const { bg, text } = colorClasses[color] || colorClasses.cyan;

  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg", bg)}>
      <Icon className={cn("w-3.5 h-3.5", text)} />
      <span className={cn("text-sm font-semibold", text)}>{value}</span>
      <span className="text-xs text-white/40">{label}</span>
    </div>
  );
}

// Day Row for Weekly Timeline (horizontal layout)
function DayRow({
  date,
  occurrences,
  isToday: isDayToday,
  isSelected,
  onClick,
}: {
  date: Date;
  occurrences: ExpandedOccurrence[];
  isToday: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const completedCount = occurrences.filter((o) => o.isCompleted).length;
  const totalCount = occurrences.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer",
        isSelected && !isDayToday
          ? isPink
            ? "bg-pink-500/20 border-pink-500/50 ring-1 ring-pink-500/30"
            : "bg-cyan-500/20 border-cyan-500/50 ring-1 ring-cyan-500/30"
          : isDayToday
            ? isPink
              ? "bg-pink-500/15 border-pink-500/40"
              : "bg-cyan-500/15 border-cyan-500/40"
            : "bg-white/5 border-white/10 hover:bg-white/[0.07]",
        allDone &&
          !isDayToday &&
          !isSelected &&
          "border-green-500/30 bg-green-500/5"
      )}
    >
      {/* Date Badge */}
      <div
        className={cn(
          "flex-shrink-0 w-14 text-center py-1.5 rounded-lg",
          isDayToday
            ? isPink
              ? "bg-pink-500/20"
              : "bg-cyan-500/20"
            : "bg-white/5"
        )}
      >
        <div
          className={cn(
            "text-[10px] font-medium uppercase",
            isDayToday
              ? isPink
                ? "text-pink-400"
                : "text-cyan-400"
              : "text-white/50"
          )}
        >
          {format(date, "EEE")}
        </div>
        <div
          className={cn(
            "text-lg font-bold",
            isDayToday ? "text-white" : "text-white/80"
          )}
        >
          {format(date, "d")}
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 min-w-0">
        {occurrences.length === 0 ? (
          <div className="text-white/30 text-sm py-2">No tasks</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {occurrences.map((occ, idx) => {
              const colors = typeColors[occ.item.type];
              const Icon = colors.icon;
              return (
                <div
                  key={`${occ.item.id}-${idx}`}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
                    occ.isCompleted
                      ? "bg-green-500/15 text-green-400"
                      : colors.bg
                  )}
                >
                  <Icon
                    className={cn(
                      "w-3 h-3 flex-shrink-0",
                      occ.isCompleted ? "text-green-400" : colors.text
                    )}
                  />
                  <span
                    className={cn(
                      "truncate max-w-[120px]",
                      occ.isCompleted && "line-through opacity-60"
                    )}
                  >
                    {occ.item.title}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {format(occ.occurrenceDate, "h:mma").toLowerCase()}
                  </span>
                  {occ.isCompleted && <Check className="w-3 h-3" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Badge */}
      {totalCount > 0 && (
        <div
          className={cn(
            "flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full",
            allDone
              ? "bg-green-500/20 text-green-400"
              : "bg-white/10 text-white/50"
          )}
        >
          {completedCount}/{totalCount}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface WebTabletMissionControlProps {
  onItemClick?: (item: ItemWithDetails, event: React.MouseEvent) => void;
  onAddEvent?: (date: Date) => void;
}

export default function WebTabletMissionControl({
  onItemClick,
  onAddEvent,
}: WebTabletMissionControlProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const itemActions = useItemActionsWithToast();
  const [showRoutines, setShowRoutines] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCompleted, setShowCompleted] = useState(true);

  // Focus modal state
  const [focusOccurrence, setFocusOccurrence] =
    useState<ExpandedOccurrence | null>(null);

  // Postpone dialog state
  const [postponeOccurrence, setPostponeOccurrence] =
    useState<ExpandedOccurrence | null>(null);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customPostponeDate, setCustomPostponeDate] = useState("");
  const [actionReason, setActionReason] = useState("");

  // Fetch data
  const { data: allItems = [], isLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();
  const { data: subtaskCompletions = [] } = useAllSubtaskCompletions();

  // Date ranges
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  // Helper: Get dynamic title for selected date
  const getFocusTitle = useCallback(
    (date: Date) => {
      if (isToday(date)) return "Today's Focus";
      if (isTomorrow(date)) return "Tomorrow's Focus";

      const diffDays = differenceInCalendarDays(date, today);
      if (diffDays > 0 && diffDays <= 6) {
        return `${format(date, "EEEE")}'s Focus`;
      }
      if (diffDays === -1) return "Yesterday";
      if (diffDays < -1 && diffDays >= -6) {
        return `${format(date, "EEEE")} (Past)`;
      }

      return format(date, "EEEE, MMM d");
    },
    [today]
  );

  // Filter active items (not archived, not cancelled)
  const activeItems = useMemo(() => {
    return allItems.filter(
      (item) =>
        item.status !== "archived" &&
        item.status !== "cancelled" &&
        !item.archived_at
    );
  }, [allItems]);

  // Expand all occurrences for the week
  const weekOccurrences = useMemo(() => {
    const expanded = expandRecurringItems(
      activeItems,
      weekStart,
      addDays(weekEnd, 1),
      occurrenceActions
    );
    const byDay = new Map<string, ExpandedOccurrence[]>();

    for (const occ of expanded) {
      const dateKey = format(occ.occurrenceDate, "yyyy-MM-dd");
      if (!byDay.has(dateKey)) {
        byDay.set(dateKey, []);
      }
      byDay.get(dateKey)!.push(occ);
    }

    return byDay;
  }, [activeItems, occurrenceActions, weekStart, weekEnd]);

  // Selected date's tasks (replaces todayTasks)
  const focusTasks = useMemo(() => {
    const dateKey = format(startOfDay(selectedDate), "yyyy-MM-dd");
    const allTasks = weekOccurrences.get(dateKey) || [];
    // Filter out completed if showCompleted is false
    return showCompleted ? allTasks : allTasks.filter((o) => !o.isCompleted);
  }, [weekOccurrences, selectedDate, showCompleted]);

  // Overdue tasks
  const overdueTasks = useMemo(() => {
    const result: ExpandedOccurrence[] = [];
    weekOccurrences.forEach((occs, dateKey) => {
      const date = parseISO(dateKey);
      if (isBefore(date, today)) {
        result.push(...occs.filter((o) => !o.isCompleted));
      }
    });
    return result;
  }, [weekOccurrences, today]);

  // Stats calculations
  const stats = useMemo(() => {
    let completed = 0;
    let pending = 0;
    let overdue = overdueTasks.length;

    weekOccurrences.forEach((occs) => {
      for (const occ of occs) {
        if (occ.isCompleted) {
          completed++;
        } else if (!isPast(occ.occurrenceDate)) {
          pending++;
        }
      }
    });

    // Calculate streak (consecutive days with all tasks completed)
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const checkDate = subDays(today, i);
      const dateKey = format(checkDate, "yyyy-MM-dd");
      const dayOccs = weekOccurrences.get(dateKey) || [];

      if (dayOccs.length === 0) continue; // Skip days with no tasks

      const allDone = dayOccs.every((o) => o.isCompleted);
      if (allDone) {
        streak++;
      } else {
        break;
      }
    }

    const completionRate =
      completed + pending + overdue > 0
        ? Math.round((completed / (completed + pending + overdue)) * 100)
        : 0;

    return { completed, pending, overdue, streak, completionRate };
  }, [weekOccurrences, overdueTasks, today]);

  // Action handlers
  const handleComplete = useCallback(
    (occurrence: ExpandedOccurrence, notes?: string) => {
      itemActions.handleComplete(
        occurrence.item,
        occurrence.occurrenceDate.toISOString(),
        notes
      );
    },
    [itemActions]
  );

  const handleSkip = useCallback(
    (occurrence: ExpandedOccurrence, notes?: string) => {
      itemActions.handleCancel(
        occurrence.item,
        occurrence.occurrenceDate.toISOString(),
        notes || "Skipped"
      );
    },
    [itemActions]
  );

  // Open postpone dialog
  const openPostponeDialog = useCallback((occurrence: ExpandedOccurrence) => {
    setPostponeOccurrence(occurrence);
    setShowCustomDatePicker(false);
    setCustomPostponeDate("");
    setActionReason("");
  }, []);

  // Handle postpone action from dialog
  const handlePostponeAction = useCallback(
    (postponeType: PostponeType, customDate?: string) => {
      if (!postponeOccurrence) return;

      itemActions.handlePostpone(
        postponeOccurrence.item,
        postponeOccurrence.occurrenceDate.toISOString(),
        postponeType,
        actionReason || undefined,
        customDate
      );

      // Reset dialog state
      setPostponeOccurrence(null);
      setShowCustomDatePicker(false);
      setCustomPostponeDate("");
      setActionReason("");
    },
    [postponeOccurrence, itemActions, actionReason]
  );

  // Undo action mutation
  const undoAction = useUndoOccurrenceAction();

  // Handler to get action ID for a completed occurrence
  const getCompletedActionId = useCallback(
    (occurrence: ExpandedOccurrence): string | null => {
      if (!occurrence.isCompleted) return null;
      const targetDateStr = occurrence.occurrenceDate
        .toISOString()
        .split("T")[0];
      const action = occurrenceActions.find(
        (a) =>
          a.item_id === occurrence.item.id &&
          a.action_type === "completed" &&
          a.occurrence_date.split("T")[0] === targetDateStr
      );
      return action?.id || null;
    },
    [occurrenceActions]
  );

  // Undo handler
  const handleUndo = useCallback(
    async (occurrence: ExpandedOccurrence) => {
      const actionId = getCompletedActionId(occurrence);
      if (!actionId) return;

      try {
        await undoAction.mutateAsync(actionId);
        toast.success("Action undone");
      } catch (error) {
        toast.error("Failed to undo action");
        console.error(error);
      }
    },
    [getCompletedActionId, undoAction]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full" />
      </div>
    );
  }

  // Compute recurring items for routines section
  const recurringWithDates = activeItems
    .filter((item) => item.recurrence_rule?.rrule)
    .map((item) => {
      const itemDate = getItemDate(item);
      let nextOccurrence: ExpandedOccurrence | undefined;
      let isOverdueItem = false;
      let isCompletedItem = false;

      weekOccurrences.forEach((occs) => {
        const occ = occs.find((o) => o.item.id === item.id);
        if (
          occ &&
          (!nextOccurrence ||
            occ.occurrenceDate < nextOccurrence.occurrenceDate)
        ) {
          nextOccurrence = occ;
        }
      });

      if (nextOccurrence) {
        isCompletedItem = nextOccurrence.isCompleted;
        isOverdueItem =
          !isCompletedItem && isPast(nextOccurrence.occurrenceDate);
      }

      return {
        item,
        nextOccurrence,
        sortDate: nextOccurrence?.occurrenceDate || itemDate || new Date(),
        isCompleted: isCompletedItem,
        isOverdue: isOverdueItem,
      };
    })
    .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Mission Control</h1>
          <p className="text-white/50 text-sm">
            {format(today, "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        {/* Stats as subheader badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/20 text-orange-400 text-xs font-medium">
            <Flame className="w-3 h-3" />
            <span>{stats.streak}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/20 text-green-400 text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span>{stats.completed} done</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/20 text-amber-400 text-xs font-medium">
            <Clock className="w-3 h-3" />
            <span>{stats.pending} pending</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/20 text-purple-400 text-xs font-medium">
            <TrendingUp className="w-3 h-3" />
            <span>{stats.completionRate}%</span>
          </div>
          {/* Show/Hide Completed toggle */}
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
              showCompleted
                ? "bg-green-500/30 text-green-300"
                : "bg-white/10 text-white/50 hover:bg-white/15"
            )}
            title={showCompleted ? "Hide completed" : "Show completed"}
          >
            {showCompleted ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
            <span>{showCompleted ? "Showing" : "Hiding"}</span>
          </button>
          {/* Routines toggle */}
          {recurringWithDates.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRoutines(!showRoutines)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                showRoutines
                  ? "bg-cyan-500/30 text-cyan-300"
                  : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/25"
              )}
            >
              <Repeat className="w-3 h-3" />
              <span>{recurringWithDates.length} routines</span>
              {showRoutines ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Routines Panel */}
      <AnimatePresence>
        {showRoutines && recurringWithDates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white/5 rounded-xl border border-white/10 p-3">
              <div className="flex flex-wrap gap-2">
                {recurringWithDates
                  .slice(0, 10)
                  .map(({ item, nextOccurrence, isCompleted, isOverdue }) => {
                    const colors = typeColors[item.type];
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs",
                          isCompleted
                            ? "bg-green-500/10 border-green-500/40 text-green-400"
                            : isOverdue
                              ? "bg-red-500/10 border-red-500/40 text-red-300"
                              : cn(
                                  colors.bg,
                                  "border-transparent",
                                  "text-white/80"
                                )
                        )}
                      >
                        <span className={cn(isCompleted && "line-through")}>
                          {item.title}
                        </span>
                        <span className="text-[10px] text-white/40">
                          {nextOccurrence
                            ? isToday(nextOccurrence.occurrenceDate)
                              ? format(nextOccurrence.occurrenceDate, "h:mm a")
                              : format(nextOccurrence.occurrenceDate, "EEE")
                            : ""}
                        </span>
                        {isCompleted && <Check className="w-3 h-3" />}
                      </div>
                    );
                  })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main layout: Today (5 cols) + This Week (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Today's Focus + Overdue */}
        <div className="lg:col-span-5 space-y-4">
          {/* Focus Section */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className={cn(
                  "p-2 rounded-lg",
                  isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                )}
              >
                <Target
                  className={cn(
                    "w-5 h-5",
                    isPink ? "text-pink-400" : "text-cyan-400"
                  )}
                />
              </div>
              <div>
                <h2 className="font-semibold text-white">
                  {getFocusTitle(selectedDate)}
                </h2>
                <p className="text-xs text-white/50">
                  {focusTasks.filter((t) => t.isCompleted).length}/
                  {focusTasks.length} completed
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              <AnimatePresence mode="popLayout">
                {focusTasks.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-white/30"
                  >
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>
                      No tasks for{" "}
                      {isToday(selectedDate)
                        ? "today"
                        : format(selectedDate, "EEEE")}
                      !
                    </p>
                    <p className="text-xs mt-1">Enjoy your free time 🎉</p>
                  </motion.div>
                ) : (
                  focusTasks.map((occ, idx) => (
                    <TodayTaskCard
                      key={`${occ.item.id}-${idx}`}
                      occurrence={occ}
                      onComplete={(notes) => handleComplete(occ, notes)}
                      onCancel={(notes) => handleSkip(occ, notes)}
                      onPostpone={() => openPostponeDialog(occ)}
                      onUndo={() => handleUndo(occ)}
                      onExpand={() => setFocusOccurrence(occ)}
                      subtaskCompletions={subtaskCompletions}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Overdue Section */}
          {overdueTasks.length > 0 && (
            <div className="bg-red-500/10 rounded-2xl border border-red-500/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Clock className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-red-400">Overdue</h2>
                  <p className="text-xs text-red-300/50">
                    {overdueTasks.length} tasks need attention
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                {overdueTasks.map((occ, idx) => (
                  <TodayTaskCard
                    key={`overdue-${occ.item.id}-${idx}`}
                    occurrence={occ}
                    onComplete={(notes) => handleComplete(occ, notes)}
                    onCancel={(notes) => handleSkip(occ, notes)}
                    onPostpone={() => openPostponeDialog(occ)}
                    onUndo={() => handleUndo(occ)}
                    onExpand={() => setFocusOccurrence(occ)}
                    subtaskCompletions={subtaskCompletions}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: This Week Timeline */}
        <div className="lg:col-span-7 bg-white/5 rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="font-semibold text-white">This Week</h2>
            <span className="text-xs text-white/40 ml-auto">
              {format(weekStart, "MMM d")} -{" "}
              {format(addDays(weekStart, 6), "MMM d")}
            </span>
          </div>

          {/* Week as horizontal rows */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
            {Array.from({ length: 7 }, (_, i) => {
              const date = addDays(weekStart, i);
              const dateKey = format(date, "yyyy-MM-dd");
              const dayOccurrences = weekOccurrences.get(dateKey) || [];
              return (
                <DayRow
                  key={dateKey}
                  date={date}
                  occurrences={dayOccurrences}
                  isToday={isToday(date)}
                  isSelected={isSameDay(date, selectedDate)}
                  onClick={() => setSelectedDate(date)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Postpone Options Dialog */}
      {postponeOccurrence && (
        <Dialog
          open={!!postponeOccurrence}
          onOpenChange={(open) => !open && setPostponeOccurrence(null)}
        >
          <DialogContent
            className={cn(
              "sm:max-w-md neo-card border",
              isPink ? "border-pink-500/30" : "border-cyan-500/30"
            )}
          >
            <DialogHeader>
              <DialogTitle
                className={cn(
                  "flex items-center gap-2 text-xl",
                  isPink ? "text-pink-300" : "text-cyan-300"
                )}
              >
                <FastForward className="w-5 h-5" />
                Postpone "{postponeOccurrence.item.title}"
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-4">
              {/* Skip to next occurrence - only for recurring items */}
              {postponeOccurrence.item.recurrence_rule && (
                <button
                  type="button"
                  onClick={() => handlePostponeAction("next_occurrence")}
                  className={cn(
                    "w-full p-4 rounded-xl border text-left transition-all",
                    "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  <div className="font-semibold text-white mb-1">
                    Skip to next occurrence
                  </div>
                  <div className="text-sm text-white/60">
                    Cancel this time and wait for the next scheduled occurrence
                  </div>
                </button>
              )}

              {/* Tomorrow */}
              <button
                type="button"
                onClick={() => handlePostponeAction("tomorrow")}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all",
                  "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                )}
              >
                <div className="font-semibold text-white mb-1">
                  Tomorrow, same time
                </div>
                <div className="text-sm text-white/60">
                  Reschedule to tomorrow at the same time
                </div>
              </button>

              {/* Custom Date Option */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                  className={cn(
                    "w-full p-4 rounded-xl border text-left transition-all",
                    showCustomDatePicker
                      ? isPink
                        ? "border-pink-500/50 bg-pink-500/10"
                        : "border-cyan-500/50 bg-cyan-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-white/70" />
                    <div>
                      <div className="font-semibold text-white mb-1">
                        Pick a specific date
                      </div>
                      <div className="text-sm text-white/60">
                        Choose exactly when to reschedule
                      </div>
                    </div>
                  </div>
                </button>

                {showCustomDatePicker && (
                  <div className="pl-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={
                          customPostponeDate
                            ? customPostponeDate.split("T")[0]
                            : ""
                        }
                        min={format(new Date(), "yyyy-MM-dd")}
                        onChange={(e) => {
                          const dateValue = e.target.value;
                          if (dateValue) {
                            const time = postponeOccurrence.occurrenceDate;
                            const newDate = new Date(dateValue);
                            newDate.setHours(
                              time.getHours(),
                              time.getMinutes(),
                              0,
                              0
                            );
                            setCustomPostponeDate(newDate.toISOString());
                          }
                        }}
                        className={cn(
                          "flex-1 p-2 rounded-lg bg-white/5 border border-white/10",
                          "text-white text-sm",
                          "focus:outline-none focus:border-white/30"
                        )}
                      />
                      <input
                        type="time"
                        value={
                          customPostponeDate
                            ? format(new Date(customPostponeDate), "HH:mm")
                            : format(postponeOccurrence.occurrenceDate, "HH:mm")
                        }
                        onChange={(e) => {
                          const timeValue = e.target.value;
                          if (timeValue && customPostponeDate) {
                            const [hours, minutes] = timeValue
                              .split(":")
                              .map(Number);
                            const newDate = new Date(customPostponeDate);
                            newDate.setHours(hours, minutes, 0, 0);
                            setCustomPostponeDate(newDate.toISOString());
                          }
                        }}
                        className={cn(
                          "w-24 p-2 rounded-lg bg-white/5 border border-white/10",
                          "text-white text-sm",
                          "focus:outline-none focus:border-white/30"
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        if (customPostponeDate) {
                          handlePostponeAction("custom", customPostponeDate);
                        }
                      }}
                      disabled={!customPostponeDate}
                      className={cn(
                        "w-full",
                        isPink
                          ? "bg-pink-500 hover:bg-pink-600"
                          : "bg-cyan-500 hover:bg-cyan-600"
                      )}
                    >
                      Postpone to{" "}
                      {customPostponeDate
                        ? format(
                            new Date(customPostponeDate),
                            "MMM d 'at' h:mm a"
                          )
                        : "..."}
                    </Button>
                  </div>
                )}
              </div>

              {/* AI option (coming soon) */}
              <button
                type="button"
                disabled
                className={cn(
                  "w-full p-4 rounded-xl border text-left opacity-50 cursor-not-allowed",
                  "border-white/10 bg-white/5"
                )}
              >
                <div className="font-semibold text-white/60 mb-1">
                  Find next available slot (AI)
                </div>
                <div className="text-sm text-white/40">
                  Coming soon - AI will find the best time for you
                </div>
              </button>

              {/* Reason input */}
              <div className="pt-2">
                <label className="block text-sm text-white/60 mb-2">
                  Reason (optional)
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Why are you postponing this?"
                  className={cn(
                    "w-full p-3 rounded-lg bg-white/5 border border-white/10",
                    "text-white placeholder:text-white/30 resize-none",
                    "focus:outline-none focus:border-white/30"
                  )}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPostponeOccurrence(null);
                  setActionReason("");
                  setCustomPostponeDate("");
                  setShowCustomDatePicker(false);
                }}
                className="border-white/20 text-white/70 hover:bg-white/10"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Task Focus View (Full Screen) */}
      <AnimatePresence>
        {focusOccurrence && (
          <TaskFocusModal
            occurrence={focusOccurrence}
            subtaskCompletions={subtaskCompletions}
            onClose={() => setFocusOccurrence(null)}
            onComplete={(notes) => {
              handleComplete(focusOccurrence, notes);
              setFocusOccurrence(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
