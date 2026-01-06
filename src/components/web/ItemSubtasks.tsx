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
import type { Subtask } from "@/types/items";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Helper to get the occurrence date a subtask belongs to
function getSubtaskOccurrenceDate(subtask: Subtask): Date | null {
  if (!subtask.occurrence_date) return null;
  return new Date(subtask.occurrence_date);
}

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

  // Sort children by order_index at each level
  const sortChildren = (nodes: SubtaskWithChildren[]) => {
    nodes.sort((a, b) => a.order_index - b.order_index);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}

// Get count of completed children (recursive)
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
// SUBTASK ITEM COMPONENT (supports nesting)
// ============================================
export function SubtaskItem({
  subtask,
  isRecurring,
  occurrenceDate,
  isCompletedForOccurrence,
  isOverdue,
  overdueFromDate,
  onToggle,
  onDelete,
  onAddSubtask,
  onUpdate,
  isSubtaskCompleted,
  depth = 0,
  maxDepth = 3,
}: {
  subtask: SubtaskWithChildren;
  isRecurring: boolean;
  occurrenceDate: Date;
  isCompletedForOccurrence: boolean;
  isOverdue?: boolean;
  overdueFromDate?: Date;
  onToggle: () => void;
  onDelete: () => void;
  onAddSubtask?: (parentSubtaskId: string, title: string) => void;
  onUpdate?: (title: string) => void;
  isSubtaskCompleted?: (id: string) => boolean;
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
  const canAddChildren = depth < maxDepth && onAddSubtask;

  // Child completion count
  const childCounts = isSubtaskCompleted
    ? getChildCompletionCount(subtask, isSubtaskCompleted)
    : { completed: 0, total: 0 };

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
    if (childTitle.trim() && onAddSubtask) {
      onAddSubtask(subtask.id, childTitle.trim());
      setChildTitle("");
      setIsAddingChild(false);
    }
  };

  const handleSaveEdit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== subtask.title && onUpdate) {
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
    <div>
      <div
        className={cn(
          "group/subtask flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors",
          isOverdue && "bg-red-500/10 border border-red-500/20"
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
        <div className="flex-1 min-w-0">
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
                "w-full bg-transparent border-b outline-none text-sm",
                isPink
                  ? "border-pink-400/50 focus:border-pink-400"
                  : "border-cyan-400/50 focus:border-cyan-400"
              )}
            />
          ) : (
            <div className="flex items-center gap-2">
              <span
                onClick={() =>
                  !isCompletedForOccurrence && onUpdate && setIsEditing(true)
                }
                className={cn(
                  "text-sm",
                  isCompletedForOccurrence
                    ? "line-through text-white/40"
                    : isOverdue
                      ? "text-red-300 cursor-text hover:text-red-200"
                      : "text-white/80 cursor-text hover:text-white"
                )}
              >
                {subtask.title}
              </span>
              {/* Child count indicator */}
              {childCounts.total > 0 && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
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
          {isOverdue && overdueFromDate && !isEditing && (
            <span className="text-[10px] text-red-400/70 flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              Overdue from {format(overdueFromDate, "MMM d")}
            </span>
          )}
        </div>

        {/* Add child subtask button */}
        {canAddChildren && !isCompletedForOccurrence && !isEditing && (
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

        {!isEditing && (
          <button
            type="button"
            onClick={onDelete}
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
    </div>
  );
}

// ============================================
// NESTED SUBTASK ITEM (wrapper with proper callbacks)
// ============================================
function NestedSubtaskItem({
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

  // Child completion count
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
      <div
        className="group/subtask flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors"
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
              : isPink
                ? "border-pink-400/50 hover:border-pink-400"
                : "border-cyan-400/50 hover:border-cyan-400"
          )}
        >
          {isCompleted && <Check className="w-3 h-3 text-white" />}
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
              className="w-full bg-transparent border-none outline-none text-sm text-white"
            />
          ) : (
            <div
              className="flex items-center gap-2 cursor-text"
              onClick={() => !isCompleted && setIsEditing(true)}
            >
              <span
                className={cn(
                  "text-sm",
                  isCompleted ? "line-through text-white/40" : "text-white/80"
                )}
              >
                {subtask.title}
              </span>
              {/* Child count indicator */}
              {childCounts.total > 0 && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
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

        {/* Delete button - always on far right */}
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

// ============================================
// ADD SUBTASK INPUT COMPONENT
// ============================================
export function AddSubtaskInput({
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

// ============================================
// ITEM SUBTASKS LIST COMPONENT
// ============================================
interface ItemSubtasksProps {
  itemId: string;
  subtasks: Subtask[];
  isRecurring: boolean;
  occurrenceDate: Date;
  subtaskCompletions?: SubtaskCompletion[];
  onAllCompleted?: () => void;
  defaultExpanded?: boolean;
  showToggle?: boolean;
}

export function ItemSubtasksList({
  itemId,
  subtasks,
  isRecurring,
  occurrenceDate,
  subtaskCompletions = [],
  onAllCompleted,
  defaultExpanded = false,
  showToggle = true,
}: ItemSubtasksProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";

  const [showSubtasks, setShowSubtasks] = useState(
    defaultExpanded || subtasks.length > 0
  );

  // Subtask mutations
  const toggleSubtask = useToggleSubtask();
  const toggleSubtaskForOccurrence = useToggleSubtaskForOccurrence();
  const addSubtask = useAddSubtask();
  const deleteSubtask = useDeleteSubtask();
  const updateSubtask = useUpdateSubtask();

  const today = startOfDay(new Date());
  const currentOcc = startOfDay(occurrenceDate);
  const isViewingPast = isBefore(currentOcc, today);
  const isViewingToday = isSameDay(currentOcc, today);

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

  // Subtasks for THIS occurrence:
  // - For recurring: subtasks where occurrence_date matches this occurrence
  // - For non-recurring: all subtasks (occurrence_date is null)
  const currentOccurrenceSubtasks = useMemo(() => {
    if (!isRecurring) {
      return subtasks; // Non-recurring: all subtasks belong to the item
    }
    const occDateStr = normalizeToLocalDateString(occurrenceDate);
    return subtasks.filter((s) => {
      if (!s.occurrence_date) return false; // Should not happen for recurring items
      return (
        normalizeToLocalDateString(new Date(s.occurrence_date)) === occDateStr
      );
    });
  }, [subtasks, isRecurring, occurrenceDate]);

  // Check if a subtask is completed for THIS occurrence
  const isSubtaskCompleted = useCallback(
    (subtaskId: string) => isSubtaskCompletedForDate(subtaskId, occurrenceDate),
    [isSubtaskCompletedForDate, occurrenceDate]
  );

  // Overdue subtasks: subtasks from PAST occurrences that weren't completed
  // Only show when viewing today or future occurrence
  const overdueSubtasksWithDates = useMemo((): Array<{
    subtask: Subtask;
    homeOccurrence: Date;
  }> => {
    if (!isRecurring) return [];

    // Only show overdue when viewing today or future occurrence
    if (isViewingPast) return [];

    const overdueList: Array<{ subtask: Subtask; homeOccurrence: Date }> = [];

    for (const subtask of subtasks) {
      const subtaskOccDate = getSubtaskOccurrenceDate(subtask);
      if (!subtaskOccDate) continue;

      const subtaskOcc = startOfDay(subtaskOccDate);

      // Only consider subtasks from past occurrences (not this one)
      if (isSameDay(subtaskOcc, currentOcc)) continue; // This occurrence's subtask
      if (!isBefore(subtaskOcc, currentOcc)) continue; // Future occurrence

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

  // Count completed subtasks for current occurrence (only top-level for display)
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

    // Check if all top-level subtasks for current occurrence are now completed -> auto-complete the task
    const willAllBeCompleted = topLevelSubtasks.every((s) =>
      s.id === subtask.id ? !currentlyCompleted : isSubtaskCompleted(s.id)
    );

    if (willAllBeCompleted && topLevelSubtasks.length > 0 && onAllCompleted) {
      // Small delay for visual feedback before auto-completing
      setTimeout(() => {
        onAllCompleted();
      }, 500);
    }
  };

  // Handle add subtask - links to THIS occurrence for recurring items
  const handleAddSubtask = async (title: string) => {
    await addSubtask.mutateAsync({
      parentItemId: itemId,
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
      parentItemId: itemId,
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

  const hasCurrentSubtasks = topLevelSubtasks.length > 0;
  const hasOverdueSubtasks = overdueSubtasksWithDates.length > 0;

  return (
    <div>
      {/* Subtasks Toggle */}
      {showToggle && (
        <button
          type="button"
          onClick={() => setShowSubtasks(!showSubtasks)}
          className={cn(
            "flex items-center gap-1 text-xs transition-colors",
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
              ? `${completedSubtasksCount}/${topLevelSubtasks.length} subtask${topLevelSubtasks.length !== 1 ? "s" : ""}${hasOverdueSubtasks ? ` (+${overdueSubtasksWithDates.length} overdue)` : ""}`
              : "Add subtasks"}
          </span>
        </button>
      )}

      {/* Subtasks List */}
      <AnimatePresence>
        {showSubtasks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={cn("pt-2", showToggle && "mt-1")}>
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
                            subtask={{ ...subtask, children: [] }}
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
                    onAddSubtask={handleAddNestedSubtask}
                    onUpdate={handleUpdateSubtask}
                  />
                ))}
                <AddSubtaskInput itemId={itemId} onAdd={handleAddSubtask} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// SUBTASK COUNT BADGE (for inline display)
// ============================================
export function SubtaskCountBadge({
  subtasks,
  isRecurring,
  occurrenceDate,
  subtaskCompletions = [],
}: {
  subtasks: Subtask[];
  isRecurring: boolean;
  occurrenceDate: Date;
  subtaskCompletions?: SubtaskCompletion[];
}) {
  const { theme } = useTheme();
  const isPink = theme === "pink";

  if (!subtasks || subtasks.length === 0) return null;

  // Count completed subtasks
  const completedCount = subtasks.filter((s) => {
    if (isRecurring && subtaskCompletions) {
      const targetDateStr = normalizeToLocalDateString(occurrenceDate);
      return subtaskCompletions.some(
        (c) =>
          c.subtask_id === s.id &&
          normalizeToLocalDateString(new Date(c.occurrence_date)) ===
            targetDateStr
      );
    }
    return !!s.done_at;
  }).length;

  const allDone = completedCount === subtasks.length;

  return (
    <span
      className={cn(
        "text-xs font-medium",
        allDone ? "text-green-400" : isPink ? "text-pink-400" : "text-cyan-400"
      )}
    >
      {completedCount}/{subtasks.length} subtasks
    </span>
  );
}
