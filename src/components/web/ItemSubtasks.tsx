"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { normalizeToLocalDateString } from "@/features/items/useItemActions";
import {
  useAddSubtask,
  useDeleteSubtask,
  useToggleSubtask,
  useToggleSubtaskForOccurrence,
  useUpdateItemKanbanSettings,
  useUpdateSubtask,
  useUpdateSubtaskKanbanStage,
  useUpdateSubtaskPriority,
  type SubtaskCompletion,
} from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type { Item, Subtask } from "@/types/items";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns3,
  List,
  Plus,
  Square,
  Trash2,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Default kanban stages (main workflow)
const DEFAULT_KANBAN_STAGES = ["To Do", "In Progress", "Done"];
// "Later" is a special stage for low-priority items, shown as collapsible section
const LATER_STAGE = "Later";

// Helper to get the occurrence date a subtask belongs to
function getSubtaskOccurrenceDate(subtask: Subtask): Date | null {
  if (!subtask.occurrence_date) return null;
  return new Date(subtask.occurrence_date);
}

// Helper to build nested subtask tree
interface SubtaskWithChildren extends Subtask {
  children: SubtaskWithChildren[];
}

/**
 * Sort subtasks by priority first (if set), then by order_index.
 * Priority 1 = highest (comes first). Null priority = use order_index.
 */
function sortByPriorityThenOrder(a: Subtask, b: Subtask): number {
  // Both have priority: sort by priority ascending (1 = top)
  if (a.priority != null && b.priority != null) {
    return a.priority - b.priority;
  }
  // Only a has priority: a comes first
  if (a.priority != null) return -1;
  // Only b has priority: b comes first
  if (b.priority != null) return 1;
  // Neither has priority: sort by order_index
  return a.order_index - b.order_index;
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

  // Sort children by priority first, then order_index at each level
  const sortChildren = (nodes: SubtaskWithChildren[]) => {
    nodes.sort(sortByPriorityThenOrder);
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
  isSubtaskCompleted: (id: string) => boolean,
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

// Collapsible section for past/dragged subtasks (compact version)
function CollapsibleSubtaskSection({
  title,
  subtitle,
  count,
  variant = "warning",
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  count: number;
  variant?: "warning" | "danger" | "neutral";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colors =
    variant === "danger"
      ? {
          border: "border-red-500/30",
          bg: "bg-red-500/10",
          text: "text-red-400",
          badge: "bg-red-500/20 text-red-300",
        }
      : variant === "neutral"
        ? {
            border: "border-white/10",
            bg: "bg-white/[0.02]",
            text: "text-white/60",
            badge: "bg-white/10 text-white/50",
          }
        : {
            border: "border-amber-500/30",
            bg: "bg-amber-500/10",
            text: "text-amber-400",
            badge: "bg-amber-500/20 text-amber-300",
          };

  return (
    <div
      className={cn(
        "mb-3 rounded-lg border overflow-hidden",
        colors.border,
        colors.bg,
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 transition-colors",
        )}
      >
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className={cn("w-3.5 h-3.5", colors.text)} />
        </motion.div>
        <AlertCircle className={cn("w-3.5 h-3.5", colors.text)} />
        <span className={cn("text-xs font-medium", colors.text)}>{title}</span>
        <span
          className={cn(
            "px-1.5 py-0.5 text-[10px] font-medium rounded-full",
            colors.badge,
          )}
        >
          {count}
        </span>
        {subtitle && (
          <span className="text-[10px] text-white/40 ml-auto">{subtitle}</span>
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 px-2 pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  onPriorityChange,
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
  onPriorityChange?: (priority: number | null) => void;
  isSubtaskCompleted?: (id: string) => boolean;
  depth?: number;
  maxDepth?: number;
}) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const [showChildren, setShowChildren] = useState(true);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);
  const [editPriority, setEditPriority] = useState(
    subtask.priority?.toString() ?? "",
  );
  const [childTitle, setChildTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const priorityInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isEditingPriority && priorityInputRef.current) {
      priorityInputRef.current.focus();
      priorityInputRef.current.select();
    }
  }, [isEditingPriority]);

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

  const handleSavePriority = () => {
    const trimmed = editPriority.trim();
    if (trimmed === "") {
      // Clear priority
      if (onPriorityChange) onPriorityChange(null);
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && onPriorityChange) {
        onPriorityChange(num);
      }
    }
    setIsEditingPriority(false);
  };

  const handleCancelPriority = () => {
    setEditPriority(subtask.priority?.toString() ?? "");
    setIsEditingPriority(false);
  };

  return (
    <div>
      <div
        className={cn(
          "group/subtask flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors",
          isFrost ? "hover:bg-slate-100" : "hover:bg-white/5",
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
              : isPink
                ? "border-pink-400/50 hover:border-pink-400"
                : "border-cyan-400/50 hover:border-cyan-400",
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
                  : isFrost
                    ? "border-slate-400/50 focus:border-slate-500 text-slate-800"
                    : "border-cyan-400/50 focus:border-cyan-400",
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
                    ? isFrost
                      ? "line-through text-slate-400"
                      : "line-through text-white/40"
                    : isFrost
                      ? "text-slate-700 cursor-text hover:text-slate-900"
                      : "text-white/80 cursor-text hover:text-white",
                )}
              >
                {subtask.title}
              </span>
              {/* Priority badge */}
              {onPriorityChange &&
                !isCompletedForOccurrence &&
                (isEditingPriority ? (
                  <input
                    ref={priorityInputRef}
                    type="number"
                    min="1"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSavePriority();
                      if (e.key === "Escape") handleCancelPriority();
                    }}
                    onBlur={handleSavePriority}
                    placeholder="#"
                    className={cn(
                      "w-8 text-center text-[10px] px-1 py-0.5 rounded border outline-none",
                      isFrost
                        ? "bg-slate-100 border-slate-300 text-slate-600"
                        : "bg-white/10 border-white/20 text-white/80",
                    )}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingPriority(true)}
                    title={
                      subtask.priority
                        ? `Priority #${subtask.priority} (click to change)`
                        : "Set priority (click to add)"
                    }
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
                      subtask.priority
                        ? isFrost
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                        : isFrost
                          ? "bg-slate-100 text-slate-400 hover:bg-slate-200 opacity-0 group-hover/subtask:opacity-100"
                          : "bg-white/5 text-white/30 hover:bg-white/10 opacity-0 group-hover/subtask:opacity-100",
                    )}
                  >
                    {subtask.priority ? `#${subtask.priority}` : "#"}
                  </button>
                ))}
              {/* Child count indicator */}
              {childCounts.total > 0 && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    childCounts.completed === childCounts.total
                      ? "bg-green-500/20 text-green-400"
                      : isPink
                        ? "bg-pink-500/20 text-pink-400"
                        : isFrost
                          ? "bg-slate-200 text-slate-600"
                          : "bg-cyan-500/20 text-cyan-400",
                  )}
                >
                  {childCounts.completed}/{childCounts.total}
                </span>
              )}
            </div>
          )}
          {isOverdue && overdueFromDate && !isEditing && (
            <span
              className={cn(
                "text-[10px] flex items-center gap-1",
                isFrost ? "text-slate-400" : "text-white/40",
              )}
            >
              from {format(overdueFromDate, "MMM d")}
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
                : "text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/20",
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
  onPriorityChange,
  onKanbanStageChange,
  kanbanStages,
  onMoveToLater,
  isOverdue = false,
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
  onPriorityChange?: (subtaskId: string, priority: number | null) => void;
  onKanbanStageChange?: (
    subtaskId: string,
    stage: string,
    done?: boolean,
  ) => void;
  kanbanStages?: string[];
  onMoveToLater?: (subtask: Subtask) => void;
  isOverdue?: boolean;
  depth?: number;
  maxDepth?: number;
}) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const [showChildren, setShowChildren] = useState(true);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);
  const [editPriority, setEditPriority] = useState(
    subtask.priority?.toString() ?? "",
  );
  const [childTitle, setChildTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const priorityInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isEditingPriority && priorityInputRef.current) {
      priorityInputRef.current.focus();
      priorityInputRef.current.select();
    }
  }, [isEditingPriority]);

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

  const handleSavePriority = () => {
    const trimmed = editPriority.trim();
    if (trimmed === "") {
      if (onPriorityChange) onPriorityChange(subtask.id, null);
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && onPriorityChange) {
        onPriorityChange(subtask.id, num);
      }
    }
    setIsEditingPriority(false);
  };

  const handleCancelPriority = () => {
    setEditPriority(subtask.priority?.toString() ?? "");
    setIsEditingPriority(false);
  };

  return (
    <div>
      <div
        className={cn(
          "group/subtask flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors",
          isFrost ? "hover:bg-slate-100" : "hover:bg-white/5",
          isOverdue && "border-l-2 border-amber-500/50 bg-amber-500/10",
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand/collapse for parent subtasks */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setShowChildren(!showChildren)}
            className={cn(
              "w-4 h-4 flex items-center justify-center flex-shrink-0",
              isFrost
                ? "text-slate-400 hover:text-slate-600"
                : "text-white/50 hover:text-white/80",
            )}
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
                : isFrost
                  ? "border-slate-400/50 hover:border-slate-500"
                  : "border-cyan-400/50 hover:border-cyan-400",
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
              className={cn(
                "w-full bg-transparent border-none outline-none text-sm",
                isFrost ? "text-slate-800" : "text-white",
              )}
            />
          ) : (
            <div
              className="flex items-center gap-2 cursor-text"
              onClick={() => !isCompleted && setIsEditing(true)}
            >
              <span
                className={cn(
                  "text-sm",
                  isCompleted
                    ? isFrost
                      ? "line-through text-slate-400"
                      : "line-through text-white/40"
                    : isFrost
                      ? "text-slate-700"
                      : "text-white/80",
                )}
              >
                {subtask.title}
              </span>
              {/* Priority badge */}
              {onPriorityChange &&
                !isCompleted &&
                (isEditingPriority ? (
                  <input
                    ref={priorityInputRef}
                    type="number"
                    min="1"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSavePriority();
                      if (e.key === "Escape") handleCancelPriority();
                    }}
                    onBlur={handleSavePriority}
                    placeholder="#"
                    className={cn(
                      "w-8 text-center text-[10px] px-1 py-0.5 rounded border outline-none",
                      isFrost
                        ? "bg-slate-100 border-slate-300 text-slate-600"
                        : "bg-white/10 border-white/20 text-white/80",
                    )}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingPriority(true);
                    }}
                    title={
                      subtask.priority
                        ? `Priority #${subtask.priority} (click to change)`
                        : "Set priority"
                    }
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
                      subtask.priority
                        ? isFrost
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                        : isFrost
                          ? "bg-slate-100 text-slate-400 hover:bg-slate-200 opacity-0 group-hover/subtask:opacity-100"
                          : "bg-white/5 text-white/30 hover:bg-white/10 opacity-0 group-hover/subtask:opacity-100",
                    )}
                  >
                    {subtask.priority ? `#${subtask.priority}` : "#"}
                  </button>
                ))}
              {/* Child count indicator */}
              {childCounts.total > 0 && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    childCounts.completed === childCounts.total
                      ? "bg-green-500/20 text-green-400"
                      : isPink
                        ? "bg-pink-500/20 text-pink-400"
                        : isFrost
                          ? "bg-slate-200 text-slate-600"
                          : "bg-cyan-500/20 text-cyan-400",
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
                : "text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/20",
            )}
            title="Add sub-item"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {/* Move to Later button */}
        {onMoveToLater && !isCompleted && !isEditing && (
          <button
            type="button"
            onClick={() => onMoveToLater(subtask)}
            className={cn(
              "p-1 rounded transition-all opacity-0 group-hover/subtask:opacity-100",
              isFrost
                ? "text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                : "text-white/30 hover:text-white/60 hover:bg-white/10",
            )}
            title="Move to Later"
          >
            <Clock className="w-4 h-4" />
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
                onPriorityChange={onPriorityChange}
                onKanbanStageChange={onKanbanStageChange}
                kanbanStages={kanbanStages}
                onMoveToLater={onMoveToLater}
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
            : "text-cyan-400/70 hover:bg-cyan-500/10 hover:text-cyan-400",
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
  item?: Item; // The full item for kanban settings
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
  item,
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
  const isFrost = theme === "frost";

  const [showSubtasks, setShowSubtasks] = useState(
    defaultExpanded || subtasks.length > 0,
  );
  const [isKanbanView, setIsKanbanView] = useState(
    item?.subtask_kanban_enabled ?? false,
  );
  const [showOverdueInKanban, setShowOverdueInKanban] = useState(true);
  const [showLater, setShowLater] = useState(false);
  const [isEditingStages, setIsEditingStages] = useState(false);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(
    null,
  );
  const [editingStageName, setEditingStageName] = useState("");

  // Optimistic kanban stage overrides - for instant UI updates
  const [optimisticKanbanStages, setOptimisticKanbanStages] = useState<
    Map<string, string>
  >(new Map());

  // Apply optimistic kanban stage overrides to subtasks
  const effectiveSubtasks = useMemo(() => {
    if (optimisticKanbanStages.size === 0) return subtasks;
    return subtasks.map((subtask) => {
      const optimisticStage = optimisticKanbanStages.get(subtask.id);
      if (optimisticStage !== undefined) {
        return { ...subtask, kanban_stage: optimisticStage };
      }
      return subtask;
    });
  }, [subtasks, optimisticKanbanStages]);

  // Kanban stages from item settings or default (excluding "Later" which is shown separately)
  const allKanbanStages = useMemo(() => {
    if (
      item?.subtask_kanban_stages &&
      Array.isArray(item.subtask_kanban_stages) &&
      item.subtask_kanban_stages.length > 0
    ) {
      return item.subtask_kanban_stages;
    }
    return DEFAULT_KANBAN_STAGES;
  }, [item?.subtask_kanban_stages]);

  // Main kanban stages (excludes "Later" which is displayed separately)
  const kanbanStages = useMemo(() => {
    return allKanbanStages.filter((s) => s !== LATER_STAGE);
  }, [allKanbanStages]);

  // Subtask mutations
  const toggleSubtask = useToggleSubtask();
  const toggleSubtaskForOccurrence = useToggleSubtaskForOccurrence();
  const addSubtask = useAddSubtask();
  const deleteSubtask = useDeleteSubtask();
  const updateSubtask = useUpdateSubtask();
  const updateSubtaskPriority = useUpdateSubtaskPriority();
  const updateSubtaskKanbanStage = useUpdateSubtaskKanbanStage();
  const updateItemKanbanSettings = useUpdateItemKanbanSettings();

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
              targetDateStr,
        );
      }
      // For one-time items, check done_at
      const subtask = subtasks.find((s) => s.id === subtaskId);
      return !!subtask?.done_at;
    },
    [isRecurring, subtaskCompletions, subtasks],
  );

  // Subtasks for THIS occurrence:
  // - For recurring: subtasks where occurrence_date matches this occurrence
  // - For non-recurring: all subtasks (occurrence_date is null)
  const currentOccurrenceSubtasks = useMemo(() => {
    if (!isRecurring) {
      return effectiveSubtasks; // Non-recurring: all subtasks belong to the item
    }
    const occDateStr = normalizeToLocalDateString(occurrenceDate);
    return effectiveSubtasks.filter((s) => {
      if (!s.occurrence_date) return false;
      return (
        normalizeToLocalDateString(new Date(s.occurrence_date)) === occDateStr
      );
    });
  }, [effectiveSubtasks, isRecurring, occurrenceDate]);

  // Dragged/orphaned subtasks: subtasks with NULL occurrence_date for recurring items
  // These are subtasks that were created without being tied to a specific occurrence
  const draggedSubtasks = useMemo(() => {
    if (!isRecurring) return [];
    return effectiveSubtasks.filter((s) => !s.occurrence_date && !s.done_at);
  }, [effectiveSubtasks, isRecurring]);

  // Check if a subtask is completed for THIS occurrence
  const isSubtaskCompleted = useCallback(
    (subtaskId: string) => isSubtaskCompletedForDate(subtaskId, occurrenceDate),
    [isSubtaskCompletedForDate, occurrenceDate],
  );

  // Overdue subtasks: subtasks from PAST occurrences that weren't completed
  const overdueSubtasksWithDates = useMemo((): Array<{
    subtask: Subtask;
    homeOccurrence: Date;
  }> => {
    if (!isRecurring) return [];

    const overdueList: Array<{ subtask: Subtask; homeOccurrence: Date }> = [];

    for (const subtask of effectiveSubtasks) {
      const subtaskOccDate = getSubtaskOccurrenceDate(subtask);
      if (!subtaskOccDate) continue;

      const subtaskOcc = startOfDay(subtaskOccDate);

      // Only consider subtasks from past occurrences (not this one)
      if (isSameDay(subtaskOcc, currentOcc)) continue;
      if (!isBefore(subtaskOcc, currentOcc)) continue;

      // Check if NOT completed for its home occurrence
      if (!isSubtaskCompletedForDate(subtask.id, subtaskOccDate)) {
        overdueList.push({ subtask, homeOccurrence: subtaskOccDate });
      }
    }

    // Sort by date (oldest first)
    return overdueList.sort(
      (a, b) => a.homeOccurrence.getTime() - b.homeOccurrence.getTime(),
    );
  }, [isRecurring, effectiveSubtasks, currentOcc, isSubtaskCompletedForDate]);

  // Combined count of all incomplete subtasks from past
  const hasDraggedSubtasks = draggedSubtasks.length > 0;
  const hasOverdueSubtasks = overdueSubtasksWithDates.length > 0;

  // Count completed subtasks for current occurrence (only top-level for display)
  const topLevelSubtasks = currentOccurrenceSubtasks.filter(
    (s) => !s.parent_subtask_id,
  );
  const completedSubtasksCount = topLevelSubtasks.filter((s) =>
    isSubtaskCompleted(s.id),
  ).length;

  // Build nested tree from flat subtasks (excludes Later stage)
  const subtaskTree = useMemo(() => {
    // Filter out Later items for the main list
    const mainSubtasks = currentOccurrenceSubtasks.filter(
      (s) => s.kanban_stage !== LATER_STAGE,
    );
    return buildSubtaskTree(mainSubtasks);
  }, [currentOccurrenceSubtasks]);

  // Overdue subtasks for list view (when toggle is on)
  const overdueSubtasksForList = useMemo(() => {
    if (!showOverdueInKanban) return [];
    // Exclude Later stage overdue items (they go in the Later section)
    return overdueSubtasksWithDates
      .filter(({ subtask }) => subtask.kanban_stage !== LATER_STAGE)
      .map(({ subtask, homeOccurrence }) => ({ subtask, homeOccurrence }));
  }, [showOverdueInKanban, overdueSubtasksWithDates]);

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
      s.id === subtask.id ? !currentlyCompleted : isSubtaskCompleted(s.id),
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
    title: string,
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

  // Handle priority change
  const handlePriorityChange = async (
    subtaskId: string,
    priority: number | null,
  ) => {
    await updateSubtaskPriority.mutateAsync({
      subtaskId,
      parentItemId: itemId,
      newPriority: priority,
    });
  };

  // Handle kanban stage change - with optimistic UI update
  const handleKanbanStageChange = async (
    subtaskId: string,
    stage: string,
    markDone?: boolean,
  ) => {
    // Apply optimistic update immediately for instant UI feedback
    setOptimisticKanbanStages((prev) => {
      const next = new Map(prev);
      next.set(subtaskId, stage);
      return next;
    });

    try {
      await updateSubtaskKanbanStage.mutateAsync({
        subtaskId,
        kanbanStage: stage,
        parentItemId: itemId,
      });

      // If marking as done, toggle the subtask
      if (markDone) {
        const subtask = effectiveSubtasks.find((s) => s.id === subtaskId);
        if (subtask) {
          await handleSubtaskToggle(subtask);
        }
      }
    } finally {
      // Clear optimistic override after mutation settles (success or error)
      setOptimisticKanbanStages((prev) => {
        const next = new Map(prev);
        next.delete(subtaskId);
        return next;
      });
    }
  };

  // Get effective kanban stage
  const getEffectiveKanbanStage = (subtask: Subtask): string => {
    return subtask.kanban_stage ?? kanbanStages[0];
  };

  // Toggle kanban view and persist
  const handleToggleKanbanView = async () => {
    const newValue = !isKanbanView;
    setIsKanbanView(newValue);
    if (item) {
      await updateItemKanbanSettings.mutateAsync({
        itemId: item.id,
        kanbanEnabled: newValue,
      });
    }
  };

  // Update stage name
  const handleSaveStageName = async (index: number) => {
    const trimmed = editingStageName.trim();
    if (trimmed && trimmed !== kanbanStages[index]) {
      const newStages = [...kanbanStages];
      newStages[index] = trimmed;
      if (item) {
        await updateItemKanbanSettings.mutateAsync({
          itemId: item.id,
          kanbanStages: newStages,
        });
      }
    }
    setEditingStageIndex(null);
    setEditingStageName("");
  };

  // Handle checkbox in Kanban mode: move to next stage or complete if last stage
  const handleKanbanCheckboxClick = async (subtask: Subtask) => {
    const currentStage = getEffectiveKanbanStage(subtask);
    const currentIndex = kanbanStages.indexOf(currentStage);
    const isLastStage = currentIndex >= kanbanStages.length - 1;

    if (isLastStage) {
      // Already in last stage - toggle completion
      await handleSubtaskToggle(subtask);
    } else {
      // Move to next stage
      const nextStage = kanbanStages[currentIndex + 1];
      const isNextStageLast = currentIndex + 1 >= kanbanStages.length - 1;
      await handleKanbanStageChange(
        subtask.id,
        nextStage,
        isNextStageLast ? true : undefined,
      );
    }
  };

  // Move forward in kanban (next stage or wrap to first)
  const handleKanbanMoveForward = async (subtask: Subtask) => {
    const currentStage = getEffectiveKanbanStage(subtask);
    const currentIndex = kanbanStages.indexOf(currentStage);
    const nextIndex = (currentIndex + 1) % kanbanStages.length;
    const nextStage = kanbanStages[nextIndex];
    await handleKanbanStageChange(subtask.id, nextStage);
  };

  // Move backward in kanban (previous stage)
  const handleKanbanMoveBackward = async (subtask: Subtask) => {
    const currentStage = getEffectiveKanbanStage(subtask);
    const currentIndex = kanbanStages.indexOf(currentStage);
    if (currentIndex > 0) {
      const prevStage = kanbanStages[currentIndex - 1];
      await handleKanbanStageChange(subtask.id, prevStage);
    }
  };

  // Move to "Later" stage - saves current stage for undo
  const handleMoveToLater = async (subtask: Subtask) => {
    const currentStage = getEffectiveKanbanStage(subtask);

    // Apply optimistic update immediately
    setOptimisticKanbanStages((prev) => {
      const next = new Map(prev);
      next.set(subtask.id, LATER_STAGE);
      return next;
    });

    try {
      await updateSubtaskKanbanStage.mutateAsync({
        subtaskId: subtask.id,
        kanbanStage: LATER_STAGE,
        parentItemId: itemId,
        previousKanbanStage: currentStage, // Save where it came from
      });
    } finally {
      setOptimisticKanbanStages((prev) => {
        const next = new Map(prev);
        next.delete(subtask.id);
        return next;
      });
    }
  };

  // Move from "Later" back to previous stage (or first stage if unknown)
  const handleMoveFromLater = async (subtask: Subtask) => {
    const targetStage = subtask.previous_kanban_stage || kanbanStages[0];
    // Validate the target stage exists in current stages
    const validStage = kanbanStages.includes(targetStage)
      ? targetStage
      : kanbanStages[0];

    // Apply optimistic update immediately
    setOptimisticKanbanStages((prev) => {
      const next = new Map(prev);
      next.set(subtask.id, validStage);
      return next;
    });

    try {
      await updateSubtaskKanbanStage.mutateAsync({
        subtaskId: subtask.id,
        kanbanStage: validStage,
        parentItemId: itemId,
        previousKanbanStage: null, // Clear the previous stage after restoring
      });
    } finally {
      setOptimisticKanbanStages((prev) => {
        const next = new Map(prev);
        next.delete(subtask.id);
        return next;
      });
    }
  };

  const hasCurrentSubtasks = topLevelSubtasks.length > 0;

  // Set of overdue subtask IDs for quick lookup
  const overdueSubtaskIds = useMemo(() => {
    return new Set(overdueSubtasksWithDates.map(({ subtask }) => subtask.id));
  }, [overdueSubtasksWithDates]);

  // Group subtasks by kanban stage for kanban view (main stages only)
  // Includes overdue items when showOverdueInKanban is true
  const subtasksByStage = useMemo(() => {
    const grouped: Record<string, Subtask[]> = {};
    for (const stage of kanbanStages) {
      grouped[stage] = [];
    }

    // Add current occurrence subtasks
    for (const subtask of currentOccurrenceSubtasks) {
      const stage = subtask.kanban_stage ?? kanbanStages[0];
      // Skip "Later" subtasks - they're handled separately
      if (stage === LATER_STAGE) continue;
      if (grouped[stage]) {
        grouped[stage].push(subtask);
      } else {
        // Unknown stage, put in first stage
        grouped[kanbanStages[0]].push(subtask);
      }
    }

    // Add overdue subtasks when toggle is on
    if (showOverdueInKanban) {
      for (const { subtask } of overdueSubtasksWithDates) {
        const stage = subtask.kanban_stage ?? kanbanStages[0];
        // Skip "Later" subtasks - they're handled separately
        if (stage === LATER_STAGE) continue;
        if (grouped[stage]) {
          grouped[stage].push(subtask);
        } else {
          grouped[kanbanStages[0]].push(subtask);
        }
      }
    }

    // Sort each stage by priority then order_index
    for (const stage of kanbanStages) {
      grouped[stage].sort(sortByPriorityThenOrder);
    }
    return grouped;
  }, [
    currentOccurrenceSubtasks,
    kanbanStages,
    showOverdueInKanban,
    overdueSubtasksWithDates,
  ]);

  // Subtasks in "Later" stage (shown as collapsible section)
  // Includes overdue items when showOverdueInKanban is true
  const laterSubtasks = useMemo(() => {
    const currentLater = currentOccurrenceSubtasks.filter(
      (s) => s.kanban_stage === LATER_STAGE,
    );

    const overdueLater = showOverdueInKanban
      ? overdueSubtasksWithDates
          .filter(({ subtask }) => subtask.kanban_stage === LATER_STAGE)
          .map(({ subtask }) => subtask)
      : [];

    return [...currentLater, ...overdueLater].sort(sortByPriorityThenOrder);
  }, [
    currentOccurrenceSubtasks,
    showOverdueInKanban,
    overdueSubtasksWithDates,
  ]);

  return (
    <div>
      {/* Subtasks Toggle + Kanban Toggle */}
      <div className="flex items-center justify-between gap-2">
        {showToggle && (
          <button
            type="button"
            onClick={() => setShowSubtasks(!showSubtasks)}
            className={cn(
              "flex items-center gap-1 text-xs transition-colors",
              isPink
                ? "text-pink-400/70 hover:text-pink-400"
                : isFrost
                  ? "text-slate-500 hover:text-slate-700"
                  : "text-cyan-400/70 hover:text-cyan-400",
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

        {/* Kanban/List View Toggle + Overdue Toggle */}
        {showSubtasks && hasCurrentSubtasks && (
          <div className="flex items-center gap-1">
            {/* Show Overdue Toggle - show in both views when there are overdue items */}
            {hasOverdueSubtasks && (
              <button
                type="button"
                onClick={() => setShowOverdueInKanban(!showOverdueInKanban)}
                title={
                  showOverdueInKanban
                    ? "Hide overdue items from kanban"
                    : `Show ${overdueSubtasksWithDates.length} overdue items in kanban`
                }
                className={cn(
                  "p-1 rounded transition-colors flex items-center gap-1",
                  showOverdueInKanban
                    ? "bg-amber-500/20 text-amber-400"
                    : isFrost
                      ? "text-amber-500/60 hover:text-amber-600 hover:bg-amber-100"
                      : "text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10",
                )}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">
                  {overdueSubtasksWithDates.length}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleKanbanView}
              title={
                isKanbanView ? "Switch to List View" : "Switch to Kanban View"
              }
              className={cn(
                "p-1 rounded transition-colors",
                isKanbanView
                  ? isFrost
                    ? "bg-slate-200 text-slate-700"
                    : isPink
                      ? "bg-pink-500/20 text-pink-400"
                      : "bg-cyan-500/20 text-cyan-400"
                  : isFrost
                    ? "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5",
              )}
            >
              {isKanbanView ? (
                <Columns3 className="w-4 h-4" />
              ) : (
                <List className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Subtasks List/Kanban */}
      <AnimatePresence>
        {showSubtasks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={cn("pt-2", showToggle && "mt-1")}>
              {/* Kanban View */}
              {isKanbanView && hasCurrentSubtasks ? (
                <div className="space-y-3">
                  {/* Kanban Board */}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {kanbanStages.map((stage, stageIndex) => {
                      const stageSubtasks = subtasksByStage[stage] || [];
                      const isLastStage =
                        stageIndex === kanbanStages.length - 1;

                      return (
                        <div
                          key={stage}
                          className={cn(
                            "flex-shrink-0 w-48 flex flex-col rounded-lg border overflow-hidden",
                            isFrost
                              ? "bg-slate-50 border-slate-200"
                              : "bg-white/[0.02] border-white/[0.06]",
                          )}
                        >
                          {/* Stage Header - editable */}
                          <div
                            className={cn(
                              "px-2 py-1.5 border-b flex items-center justify-between gap-1",
                              isFrost
                                ? "border-slate-200 bg-slate-100"
                                : "border-white/[0.06] bg-white/[0.02]",
                            )}
                          >
                            {editingStageIndex === stageIndex ? (
                              <input
                                type="text"
                                value={editingStageName}
                                onChange={(e) =>
                                  setEditingStageName(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleSaveStageName(stageIndex);
                                  if (e.key === "Escape") {
                                    setEditingStageIndex(null);
                                    setEditingStageName("");
                                  }
                                }}
                                onBlur={() => handleSaveStageName(stageIndex)}
                                autoFocus
                                className={cn(
                                  "flex-1 text-xs font-medium bg-transparent border-none outline-none",
                                  isFrost ? "text-slate-700" : "text-white/80",
                                )}
                              />
                            ) : (
                              <span
                                className={cn(
                                  "flex-1 text-xs font-medium cursor-pointer hover:opacity-70",
                                  isFrost ? "text-slate-600" : "text-white/70",
                                )}
                                onClick={() => {
                                  setEditingStageIndex(stageIndex);
                                  setEditingStageName(stage);
                                }}
                                title="Click to rename"
                              >
                                {stage}
                              </span>
                            )}
                            <span
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full",
                                isFrost
                                  ? "bg-slate-200 text-slate-500"
                                  : "bg-white/10 text-white/50",
                              )}
                            >
                              {stageSubtasks.length}
                            </span>
                          </div>

                          {/* Stage Content */}
                          <div className="flex-1 p-1.5 space-y-1 min-h-[60px] max-h-[200px] overflow-y-auto">
                            {stageSubtasks.map((subtask) => {
                              const isCompleted = isSubtaskCompleted(
                                subtask.id,
                              );
                              const isOverdue = overdueSubtaskIds.has(
                                subtask.id,
                              );
                              return (
                                <div
                                  key={subtask.id}
                                  className={cn(
                                    "p-2 rounded border group/kanban-card cursor-pointer transition-colors",
                                    isOverdue
                                      ? "border-amber-500/50 bg-amber-500/10"
                                      : isFrost
                                        ? "bg-white border-slate-200 hover:border-slate-300"
                                        : "bg-black/30 border-white/5 hover:border-white/10",
                                  )}
                                >
                                  <div className="flex items-center gap-1.5">
                                    {/* Back arrow - only show if not in first stage */}
                                    {stageIndex > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleKanbanMoveBackward(subtask)
                                        }
                                        className={cn(
                                          "w-4 h-4 flex items-center justify-center transition-all flex-shrink-0",
                                          "hover:bg-white/10 rounded",
                                          isFrost
                                            ? "text-slate-400/50 hover:text-slate-600"
                                            : isPink
                                              ? "text-pink-400/50 hover:text-pink-400"
                                              : "text-cyan-400/50 hover:text-cyan-400",
                                        )}
                                        title={`Move to ${kanbanStages[stageIndex - 1]}`}
                                      >
                                        <ChevronLeft className="w-3 h-3" />
                                      </button>
                                    )}
                                    {/* Spacer when in first stage for alignment */}
                                    {stageIndex === 0 && (
                                      <div className="w-4" />
                                    )}

                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={cn(
                                          "text-xs leading-tight",
                                          isCompleted
                                            ? isFrost
                                              ? "line-through text-slate-400"
                                              : "line-through text-white/40"
                                            : isFrost
                                              ? "text-slate-700"
                                              : "text-white/80",
                                        )}
                                      >
                                        {subtask.title}
                                      </p>
                                      {/* Priority badge */}
                                      {subtask.priority && (
                                        <span
                                          className={cn(
                                            "inline-block mt-1 text-[9px] px-1 py-0.5 rounded",
                                            isFrost
                                              ? "bg-amber-100 text-amber-700"
                                              : "bg-amber-500/20 text-amber-400",
                                          )}
                                        >
                                          #{subtask.priority}
                                        </span>
                                      )}
                                    </div>

                                    {/* Move to Later button */}
                                    <button
                                      type="button"
                                      onClick={() => handleMoveToLater(subtask)}
                                      className={cn(
                                        "p-0.5 opacity-0 group-hover/kanban-card:opacity-100 transition-opacity",
                                        isFrost
                                          ? "text-slate-400/50 hover:text-slate-600"
                                          : "text-white/30 hover:text-white/60",
                                      )}
                                      title="Move to Later"
                                    >
                                      <Clock className="w-3 h-3" />
                                    </button>

                                    {/* Delete button */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteSubtask(subtask.id)
                                      }
                                      className="p-0.5 text-red-400/50 hover:text-red-400 opacity-0 group-hover/kanban-card:opacity-100 transition-opacity"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>

                                    {/* Forward arrow / check button */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleKanbanMoveForward(subtask)
                                      }
                                      className={cn(
                                        "w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0",
                                        isCompleted
                                          ? "bg-green-500 border-green-500"
                                          : isPink
                                            ? "border-pink-400/50 hover:border-pink-400"
                                            : isFrost
                                              ? "border-slate-400/50 hover:border-slate-500"
                                              : "border-cyan-400/50 hover:border-cyan-400",
                                      )}
                                      title={
                                        isLastStage
                                          ? "Move to first stage"
                                          : `Move to ${kanbanStages[stageIndex + 1]}`
                                      }
                                    >
                                      {isCompleted && (
                                        <Check className="w-3 h-3 text-white" />
                                      )}
                                      {!isCompleted && (
                                        <ChevronRight className="w-2 h-2 text-white/40" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Later Section - collapsible for low-priority items */}
                  {laterSubtasks.length > 0 && (
                    <div className="mt-3">
                      <CollapsibleSubtaskSection
                        title="Later"
                        subtitle="Low priority"
                        count={laterSubtasks.length}
                        variant="neutral"
                        defaultOpen={false}
                      >
                        <div className="space-y-1">
                          {laterSubtasks.map((subtask) => {
                            const isCompleted = isSubtaskCompleted(subtask.id);
                            const isOverdue = overdueSubtaskIds.has(subtask.id);
                            return (
                              <div
                                key={subtask.id}
                                className={cn(
                                  "p-2 rounded border group/later-card transition-colors",
                                  isOverdue
                                    ? "border-amber-500/50 bg-amber-500/10"
                                    : isFrost
                                      ? "bg-white border-slate-200 hover:border-slate-300"
                                      : "bg-black/30 border-white/5 hover:border-white/10",
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  {/* Move back to previous stage */}
                                  <button
                                    type="button"
                                    onClick={() => handleMoveFromLater(subtask)}
                                    className={cn(
                                      "p-0.5 transition-colors",
                                      isFrost
                                        ? "text-slate-400 hover:text-slate-600"
                                        : isPink
                                          ? "text-pink-400/50 hover:text-pink-400"
                                          : "text-cyan-400/50 hover:text-cyan-400",
                                    )}
                                    title={`Move back to ${subtask.previous_kanban_stage || kanbanStages[0]}`}
                                  >
                                    <Undo2 className="w-3 h-3" />
                                  </button>

                                  <p
                                    className={cn(
                                      "flex-1 text-xs leading-tight",
                                      isCompleted
                                        ? isFrost
                                          ? "line-through text-slate-400"
                                          : "line-through text-white/40"
                                        : isFrost
                                          ? "text-slate-700"
                                          : "text-white/80",
                                    )}
                                  >
                                    {subtask.title}
                                  </p>

                                  {/* Delete button */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteSubtask(subtask.id)
                                    }
                                    className="p-0.5 text-red-400/50 hover:text-red-400 opacity-0 group-hover/later-card:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleSubtaskSection>
                    </div>
                  )}

                  {/* Add Subtask Input for Kanban */}
                  <AddSubtaskInput itemId={itemId} onAdd={handleAddSubtask} />
                </div>
              ) : (
                /* List View */
                <div className="space-y-0.5">
                  {/* Dragged/orphaned subtasks */}
                  {hasDraggedSubtasks && (
                    <CollapsibleSubtaskSection
                      title="Incomplete"
                      subtitle="Carried forward"
                      count={draggedSubtasks.length}
                      variant="warning"
                      defaultOpen={true}
                    >
                      {draggedSubtasks.map((subtask) => (
                        <SubtaskItem
                          key={`dragged-${subtask.id}`}
                          subtask={{ ...subtask, children: [] }}
                          isRecurring={isRecurring}
                          occurrenceDate={occurrenceDate}
                          isCompletedForOccurrence={false}
                          onToggle={async () => {
                            await handleSubtaskToggle(subtask);
                          }}
                          onDelete={() => handleDeleteSubtask(subtask.id)}
                          onPriorityChange={(priority) =>
                            handlePriorityChange(subtask.id, priority)
                          }
                          isOverdue={true}
                        />
                      ))}
                    </CollapsibleSubtaskSection>
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
                      onPriorityChange={handlePriorityChange}
                      onKanbanStageChange={handleKanbanStageChange}
                      kanbanStages={kanbanStages}
                      onMoveToLater={handleMoveToLater}
                    />
                  ))}

                  {/* Overdue subtasks from past occurrences - shown inline when toggle is on */}
                  {overdueSubtasksForList.map(({ subtask, homeOccurrence }) => (
                    <div
                      key={`overdue-${subtask.id}`}
                      className={cn(
                        "group/subtask flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors",
                        isFrost ? "hover:bg-slate-100" : "hover:bg-white/5",
                        "border-l-2 border-amber-500/50 bg-amber-500/10",
                      )}
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          if (isRecurring) {
                            await toggleSubtaskForOccurrence.mutateAsync({
                              subtaskId: subtask.id,
                              occurrenceDate: homeOccurrence.toISOString(),
                              completed: true,
                            });
                          }
                        }}
                        className={cn(
                          "w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center",
                          isPink
                            ? "border-pink-400/50 hover:border-pink-400"
                            : isFrost
                              ? "border-slate-400 hover:border-slate-500"
                              : "border-cyan-400/50 hover:border-cyan-400",
                        )}
                      />
                      <span
                        className={cn(
                          "flex-1 text-sm",
                          isFrost ? "text-slate-700" : "text-white/90",
                        )}
                      >
                        {subtask.title}
                      </span>
                      <span className="text-xs text-amber-500">
                        {format(homeOccurrence, "MMM d")}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMoveToLater(subtask)}
                        className={cn(
                          "p-1 rounded transition-all opacity-0 group-hover/subtask:opacity-100",
                          isFrost
                            ? "text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                            : "text-white/30 hover:text-white/60 hover:bg-white/10",
                        )}
                        title="Move to Later"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubtask(subtask.id)}
                        className="p-1 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 rounded transition-all"
                        title="Delete subtask"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Later section for list view */}
                  {laterSubtasks.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setShowLater(!showLater)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
                          isFrost
                            ? "bg-slate-100 hover:bg-slate-200"
                            : "bg-white/5 border border-white/10 hover:bg-white/10",
                        )}
                      >
                        <motion.div
                          animate={{ rotate: showLater ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown
                            className={cn(
                              "w-4 h-4",
                              isFrost ? "text-slate-400" : "text-white/50",
                            )}
                          />
                        </motion.div>
                        <Clock
                          className={cn(
                            "w-4 h-4",
                            isFrost ? "text-slate-400" : "text-white/50",
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isFrost ? "text-slate-600" : "text-white/70",
                          )}
                        >
                          Later
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-xs rounded-full",
                            isFrost
                              ? "bg-slate-200 text-slate-500"
                              : "bg-white/10 text-white/50",
                          )}
                        >
                          {laterSubtasks.length}
                        </span>
                      </button>
                      <AnimatePresence>
                        {showLater && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-1 space-y-0.5 pl-2">
                              {laterSubtasks.map((subtask) => {
                                const isOverdueItem = overdueSubtaskIds.has(
                                  subtask.id,
                                );
                                return (
                                  <div
                                    key={subtask.id}
                                    className={cn(
                                      "group/subtask flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors",
                                      isFrost
                                        ? "hover:bg-slate-100"
                                        : "hover:bg-white/5",
                                      isOverdueItem &&
                                        "border-l-2 border-amber-500/50 bg-amber-500/10",
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleMoveFromLater(subtask)
                                      }
                                      className={cn(
                                        "flex-shrink-0 w-4 h-4 flex items-center justify-center transition-all",
                                        isPink
                                          ? "text-pink-400/50 hover:text-pink-400"
                                          : isFrost
                                            ? "text-slate-400 hover:text-slate-600"
                                            : "text-cyan-400/50 hover:text-cyan-400",
                                      )}
                                      title={
                                        subtask.previous_kanban_stage
                                          ? `Restore to ${subtask.previous_kanban_stage}`
                                          : "Move back to To Do"
                                      }
                                    >
                                      <Undo2 className="w-4 h-4" />
                                    </button>
                                    <span
                                      className={cn(
                                        "flex-1 text-sm",
                                        isFrost
                                          ? "text-slate-600"
                                          : "text-white/70",
                                      )}
                                    >
                                      {subtask.title}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteSubtask(subtask.id)
                                      }
                                      className="p-1 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 rounded transition-all opacity-0 group-hover/subtask:opacity-100"
                                      title="Delete subtask"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <AddSubtaskInput itemId={itemId} onAdd={handleAddSubtask} />
                </div>
              )}
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
            targetDateStr,
      );
    }
    return !!s.done_at;
  }).length;

  const allDone = completedCount === subtasks.length;

  return (
    <span
      className={cn(
        "text-xs font-medium",
        allDone ? "text-green-400" : isPink ? "text-pink-400" : "text-cyan-400",
      )}
    >
      {completedCount}/{subtasks.length} subtasks
    </span>
  );
}
