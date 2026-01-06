"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { normalizeToLocalDateString } from "@/features/items/useItemActions";
import {
  useAddSubtask,
  useDeleteSubtask,
  useToggleSubtask,
  useToggleSubtaskForOccurrence,
  useUpdateSubtask,
  type SubtaskCompletion,
} from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type { ItemType, ItemWithDetails, Subtask } from "@/types/items";
import {
  format,
  formatDistanceToNow,
  isBefore,
  isPast,
  isSameDay,
  startOfDay,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ListTodo,
  Plus,
  Repeat,
  Square,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Helper to build nested subtask tree
interface SubtaskWithChildren extends Subtask {
  children: SubtaskWithChildren[];
}

function buildSubtaskTree(subtasks: Subtask[]): SubtaskWithChildren[] {
  const map = new Map<string, SubtaskWithChildren>();
  const roots: SubtaskWithChildren[] = [];

  for (const s of subtasks) {
    map.set(s.id, { ...s, children: [] });
  }

  for (const s of subtasks) {
    const node = map.get(s.id)!;
    if (s.parent_subtask_id && map.has(s.parent_subtask_id)) {
      map.get(s.parent_subtask_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: SubtaskWithChildren[]) => {
    nodes.sort((a, b) => a.order_index - b.order_index);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}

function getChildCompletionCount(
  subtask: SubtaskWithChildren,
  isSubtaskCompleted: (id: string) => boolean
): { completed: number; total: number } {
  let completed = 0;
  let total = 0;

  for (const child of subtask.children) {
    total++;
    if (isSubtaskCompleted(child.id)) completed++;
    const childCounts = getChildCompletionCount(child, isSubtaskCompleted);
    completed += childCounts.completed;
    total += childCounts.total;
  }

  return { completed, total };
}

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

interface TaskFocusModalProps {
  occurrence: ExpandedOccurrence;
  subtaskCompletions?: SubtaskCompletion[];
  onClose: () => void;
  onComplete: (notes?: string) => void;
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

// ============================================
// SUB-COMPONENTS
// ============================================

// Nested Subtask Item Component (Enhanced for focus view with nesting support)
function NestedFocusSubtaskItem({
  subtask,
  isRecurring,
  occurrenceDate,
  isSubtaskCompleted,
  onToggle,
  onDelete,
  onAddSubtask,
  onUpdate,
  depth = 0,
  maxDepth = 3,
}: {
  subtask: SubtaskWithChildren;
  isRecurring: boolean;
  occurrenceDate: Date;
  isSubtaskCompleted: (id: string) => boolean;
  onToggle: (subtask: Subtask) => void;
  onDelete: (subtaskId: string) => void;
  onAddSubtask: (parentSubtaskId: string, title: string) => void;
  onUpdate: (subtaskId: string, title: string) => void;
  depth?: number;
  maxDepth?: number;
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
  const childCounts = getChildCompletionCount(subtask, isSubtaskCompleted);

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

  const handleAddChild = () => {
    if (childTitle.trim()) {
      onAddSubtask(subtask.id, childTitle.trim());
      setChildTitle("");
      setIsAddingChild(false);
    }
  };

  const handleSaveEdit = () => {
    if (editTitle.trim() && editTitle.trim() !== subtask.title) {
      onUpdate(subtask.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(subtask.title);
    setIsEditing(false);
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className={cn(
          "group/subtask flex items-center gap-4 py-4 px-5 rounded-xl transition-all",
          isCompleted
            ? "bg-green-500/10 border border-green-500/20"
            : "bg-white/5 hover:bg-white/10 border border-white/10"
        )}
        style={{ marginLeft: `${depth * 24}px` }}
      >
        {/* Expand/collapse for parent subtasks */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setShowChildren(!showChildren)}
            className="w-5 h-5 flex items-center justify-center text-white/50 hover:text-white/80 flex-shrink-0"
          >
            {showChildren ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-5 flex-shrink-0" />
        )}

        <button
          type="button"
          onClick={() => onToggle(subtask)}
          className={cn(
            "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0",
            isCompleted
              ? "bg-green-500 border-green-500"
              : isPink
                ? "border-pink-400/50 hover:border-pink-400 hover:bg-pink-500/20"
                : "border-cyan-400/50 hover:border-cyan-400 hover:bg-cyan-500/20"
          )}
        >
          {isCompleted && <Check className="w-4 h-4 text-white" />}
        </button>

        {/* Title - inline editable */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit();
                if (e.key === "Escape") handleCancelEdit();
              }}
              onBlur={handleSaveEdit}
              className="w-full bg-transparent border-none outline-none text-lg text-white"
            />
          ) : (
            <div
              className="flex items-center gap-3 cursor-text"
              onClick={() => !isCompleted && setIsEditing(true)}
            >
              <span
                className={cn(
                  "text-lg",
                  isCompleted ? "line-through text-white/40" : "text-white"
                )}
              >
                {subtask.title}
              </span>
              {/* Child count indicator */}
              {childCounts.total > 0 && (
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    childCounts.completed === childCounts.total
                      ? "bg-green-500/20 text-green-400"
                      : isPink
                        ? "bg-pink-500/20 text-pink-400"
                        : "bg-cyan-500/20 text-cyan-400"
                  )}
                >
                  {childCounts.completed}/{childCounts.total}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Add child subtask button */}
        {canAddChildren && !isCompleted && !isEditing && (
          <button
            type="button"
            onClick={() => setIsAddingChild(true)}
            className={cn(
              "p-2 rounded-lg transition-all",
              isPink
                ? "text-pink-400/70 hover:text-pink-400 hover:bg-pink-500/20"
                : "text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/20"
            )}
            title="Add sub-item"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {/* Delete button - always on far right */}
        {!isEditing && (
          <button
            type="button"
            onClick={() => onDelete(subtask.id)}
            className="p-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
            title="Delete subtask"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </motion.div>

      {/* Add child input */}
      <AnimatePresence>
        {isAddingChild && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            style={{ marginLeft: `${(depth + 1) * 24}px` }}
          >
            <div className="flex items-center gap-3 py-3 px-5 mt-2 rounded-xl bg-white/5 border border-dashed border-white/20">
              <div className="w-5 flex-shrink-0" />
              <Square className="w-6 h-6 text-white/30 flex-shrink-0" />
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
                className="flex-1 bg-transparent border-none outline-none text-lg text-white placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={handleAddChild}
                disabled={!childTitle.trim()}
                className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="w-5 h-5" />
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
            className="overflow-hidden space-y-2 mt-2"
          >
            {subtask.children.map((child) => (
              <NestedFocusSubtaskItem
                key={child.id}
                subtask={child}
                isRecurring={isRecurring}
                occurrenceDate={occurrenceDate}
                isSubtaskCompleted={isSubtaskCompleted}
                onToggle={onToggle}
                onDelete={onDelete}
                onAddSubtask={onAddSubtask}
                onUpdate={onUpdate}
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

// Simple Subtask Item (for overdue display - no nesting)
function FocusSubtaskItem({
  subtask,
  isRecurring,
  occurrenceDate,
  isCompletedForOccurrence,
  onToggle,
  onDelete,
  isOverdue,
  overdueFromDate,
}: {
  subtask: Subtask;
  isRecurring: boolean;
  occurrenceDate: Date;
  isCompletedForOccurrence: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isOverdue?: boolean;
  overdueFromDate?: Date;
}) {
  const { theme } = useTheme();
  const isPink = theme === "pink";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={cn(
        "group/subtask flex items-center gap-4 py-4 px-5 rounded-xl transition-all",
        isOverdue
          ? "border-2 border-red-500/40 bg-red-500/10"
          : isCompletedForOccurrence
            ? "bg-green-500/10 border border-green-500/20"
            : "bg-white/5 hover:bg-white/10 border border-white/10"
      )}
    >
      <div className="w-5 flex-shrink-0" />
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0",
          isCompletedForOccurrence
            ? "bg-green-500 border-green-500"
            : isOverdue
              ? "border-red-400/50 hover:border-red-400 hover:bg-red-500/20"
              : isPink
                ? "border-pink-400/50 hover:border-pink-400 hover:bg-pink-500/20"
                : "border-cyan-400/50 hover:border-cyan-400 hover:bg-cyan-500/20"
        )}
      >
        {isCompletedForOccurrence && <Check className="w-4 h-4 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-lg",
            isCompletedForOccurrence
              ? "line-through text-white/40"
              : isOverdue
                ? "text-red-300"
                : "text-white"
          )}
        >
          {subtask.title}
        </span>
        {isOverdue && overdueFromDate && (
          <p className="text-sm text-red-400/70 mt-0.5">
            From {format(overdueFromDate, "MMM d")}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover/subtask:opacity-100 p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
        title="Delete subtask"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// Add Subtask Input (Enhanced for focus view)
function FocusAddSubtaskInput({ onAdd }: { onAdd: (title: string) => void }) {
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
          "flex items-center justify-center gap-3 py-4 px-5 rounded-xl text-base transition-colors w-full border-2 border-dashed",
          isPink
            ? "text-pink-400/70 border-pink-500/30 hover:bg-pink-500/10 hover:text-pink-400 hover:border-pink-500/50"
            : "text-cyan-400/70 border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/50"
        )}
      >
        <Plus className="w-5 h-5" />
        <span>Add a subtask</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3 px-5 bg-white/5 rounded-xl border border-white/10">
      <Square className="w-6 h-6 text-white/30 flex-shrink-0" />
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
        placeholder="What needs to be done?"
        className="flex-1 bg-transparent border-none outline-none text-lg text-white placeholder:text-white/30"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!title.trim()}
        className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Check className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => {
          setIsAdding(false);
          setTitle("");
        }}
        className="p-2 text-white/50 hover:bg-white/10 rounded-lg transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function TaskFocusModal({
  occurrence,
  subtaskCompletions = [],
  onClose,
  onComplete,
}: TaskFocusModalProps) {
  const { item, occurrenceDate, isCompleted, isPostponed, originalDate } =
    occurrence;
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const colors = typeColors[item.type];
  const Icon = colors.icon;
  const isOverdue = isPast(occurrenceDate) && !isCompleted;

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

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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

  // Subtasks for THIS occurrence
  const currentOccurrenceSubtasks = useMemo(() => {
    if (!isRecurring) {
      return subtasks;
    }
    const occDateStr = normalizeToLocalDateString(occurrenceDate);
    return subtasks.filter((s) => {
      if (!s.occurrence_date) return false;
      return (
        normalizeToLocalDateString(new Date(s.occurrence_date)) === occDateStr
      );
    });
  }, [subtasks, isRecurring, occurrenceDate]);

  // Overdue subtasks from past occurrences
  const overdueSubtasksWithDates = useMemo((): Array<{
    subtask: Subtask;
    homeOccurrence: Date;
  }> => {
    if (!isRecurring) return [];
    if (isViewingPast) return [];

    const overdueList: Array<{ subtask: Subtask; homeOccurrence: Date }> = [];

    for (const subtask of subtasks) {
      const subtaskOccDate = getSubtaskOccDate(subtask);
      if (!subtaskOccDate) continue;

      const subtaskOcc = startOfDay(subtaskOccDate);

      if (isSameDay(subtaskOcc, currentOcc)) continue;
      if (!isBefore(subtaskOcc, currentOcc)) continue;
      if (!isBefore(subtaskOcc, today)) continue;

      if (!isSubtaskCompletedForDate(subtask.id, subtaskOccDate)) {
        overdueList.push({ subtask, homeOccurrence: subtaskOccDate });
      }
    }

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

  // Count completed subtasks (only top-level for progress display)
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
  const totalSubtasks =
    topLevelSubtasks.length + overdueSubtasksWithDates.length;
  const totalCompleted = completedSubtasksCount;
  const progress =
    totalSubtasks > 0 ? (totalCompleted / topLevelSubtasks.length) * 100 : 0;

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

    // Auto-complete when all top-level subtasks done
    const willAllBeCompleted = topLevelSubtasks.every((s) =>
      s.id === subtask.id ? !currentlyCompleted : isSubtaskCompleted(s.id)
    );

    if (willAllBeCompleted && topLevelSubtasks.length > 0) {
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  };

  // Handle overdue subtask toggle
  const handleOverdueSubtaskToggle = async (
    subtask: Subtask,
    homeOccurrence: Date
  ) => {
    if (isRecurring) {
      await toggleSubtaskForOccurrence.mutateAsync({
        subtaskId: subtask.id,
        occurrenceDate: homeOccurrence.toISOString(),
        completed: true,
      });
    }
  };

  // Handle add subtask
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
      initial={{ opacity: 0, x: "100%" }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden flex flex-col"
    >
      {/* Header - Back button + Task Icon */}
      <header
        className={cn(
          "flex-shrink-0 flex items-center gap-4 px-6 py-4 border-b",
          isCompleted
            ? "border-green-500/20 bg-green-500/5"
            : isPostponed
              ? "border-amber-500/20 bg-amber-500/5"
              : "border-white/10 bg-white/5"
        )}
      >
        {/* Back Button */}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl transition-colors",
            isPink
              ? "text-pink-400 hover:bg-pink-500/20"
              : "text-cyan-400 hover:bg-cyan-500/20"
          )}
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Task Type Icon */}
        <div className={cn("p-3 rounded-xl", colors.bg)}>
          <Icon className={cn("w-6 h-6", colors.text)} />
        </div>
      </header>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Task Title and Meta */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1
                className={cn(
                  "text-3xl font-bold text-white",
                  isCompleted && "line-through text-white/50"
                )}
              >
                {item.title}
              </h1>
              {item.recurrence_rule && (
                <Repeat className="w-5 h-5 text-white/40" />
              )}
              {item.priority === "urgent" && (
                <Zap className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-white/60">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>
                  {format(occurrenceDate, "EEEE, MMMM d 'at' h:mm a")}
                </span>
              </div>
              {isPostponed && originalDate && (
                <span className="text-amber-400 font-medium">
                  • Moved from {format(originalDate, "MMM d")}
                </span>
              )}
              {isOverdue && !isPostponed && (
                <span className="text-red-400 font-medium">
                  • {formatDistanceToNow(occurrenceDate)} overdue
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {(hasCurrentSubtasks || hasOverdueSubtasks) && !isCompleted && (
            <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-white/60 font-medium">Progress</span>
                <span
                  className={cn(
                    "font-semibold",
                    completedSubtasksCount === topLevelSubtasks.length &&
                      topLevelSubtasks.length > 0
                      ? "text-green-400"
                      : isPink
                        ? "text-pink-400"
                        : "text-cyan-400"
                  )}
                >
                  {completedSubtasksCount}/{topLevelSubtasks.length} subtasks
                  {hasOverdueSubtasks &&
                    ` (+${overdueSubtasksWithDates.length} overdue)`}
                </span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    progress === 100
                      ? "bg-green-500"
                      : isPink
                        ? "bg-pink-500"
                        : "bg-cyan-500"
                  )}
                />
              </div>
            </div>
          )}

          {/* Description if any */}
          {item.description && (
            <div className="mb-8 p-5 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-white/70 text-lg leading-relaxed">
                {item.description}
              </p>
            </div>
          )}

          {/* Subtasks Section */}
          {!isCompleted && (
            <div className="space-y-6">
              {/* Overdue Subtasks */}
              {overdueSubtasksWithDates.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <h2 className="text-xl font-semibold text-red-400">
                      Overdue Subtasks
                    </h2>
                  </div>
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {overdueSubtasksWithDates.map(
                        ({ subtask, homeOccurrence }) => (
                          <FocusSubtaskItem
                            key={`overdue-${subtask.id}`}
                            subtask={subtask}
                            isRecurring={isRecurring}
                            occurrenceDate={homeOccurrence}
                            isCompletedForOccurrence={false}
                            onToggle={() =>
                              handleOverdueSubtaskToggle(
                                subtask,
                                homeOccurrence
                              )
                            }
                            onDelete={() => handleDeleteSubtask(subtask.id)}
                            isOverdue={true}
                            overdueFromDate={homeOccurrence}
                          />
                        )
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Current Subtasks */}
              <div>
                {(hasCurrentSubtasks || !hasOverdueSubtasks) && (
                  <div className="flex items-center gap-2 mb-4">
                    <Target
                      className={cn(
                        "w-5 h-5",
                        isPink ? "text-pink-400" : "text-cyan-400"
                      )}
                    />
                    <h2
                      className={cn(
                        "text-xl font-semibold",
                        isPink ? "text-pink-400" : "text-cyan-400"
                      )}
                    >
                      {hasOverdueSubtasks ? "Today's Subtasks" : "Subtasks"}
                    </h2>
                  </div>
                )}
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {subtaskTree.map((subtask) => (
                      <NestedFocusSubtaskItem
                        key={subtask.id}
                        subtask={subtask}
                        isRecurring={isRecurring}
                        occurrenceDate={occurrenceDate}
                        isSubtaskCompleted={isSubtaskCompleted}
                        onToggle={handleSubtaskToggle}
                        onDelete={handleDeleteSubtask}
                        onAddSubtask={handleAddNestedSubtask}
                        onUpdate={handleUpdateSubtask}
                      />
                    ))}
                  </AnimatePresence>
                  <FocusAddSubtaskInput onAdd={handleAddSubtask} />
                </div>
              </div>
            </div>
          )}

          {/* Completed State */}
          {isCompleted && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500/20 mb-6">
                <Check className="w-12 h-12 text-green-400" />
              </div>
              <h2 className="text-2xl font-semibold text-green-400 mb-3">
                Task Completed!
              </h2>
              <p className="text-white/50 text-lg">
                Great job getting this done.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
