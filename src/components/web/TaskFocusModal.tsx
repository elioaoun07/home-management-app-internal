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
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns3,
  List,
  ListTodo,
  Plus,
  Repeat,
  Square,
  Target,
  Trash2,
  Undo2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Default kanban stages (main workflow)
const DEFAULT_KANBAN_STAGES = ["To Do", "In Progress", "Done"];
// "Later" is a special stage for low-priority items, shown as collapsible section
const LATER_STAGE = "Later";

/**
 * Sort subtasks by priority first (if set), then by order_index.
 * Priority 1 = highest (comes first). Null priority = use order_index.
 */
function sortByPriorityThenOrder(a: Subtask, b: Subtask): number {
  if (a.priority != null && b.priority != null) {
    return a.priority - b.priority;
  }
  if (a.priority != null) return -1;
  if (b.priority != null) return 1;
  return a.order_index - b.order_index;
}

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
    nodes.sort(sortByPriorityThenOrder);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  };
  sortChildren(roots);

  return roots;
}

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

// Collapsible section for past/dragged subtasks
function CollapsiblePastSubtasks({
  title,
  subtitle,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { theme } = useTheme();
  const isPink = theme === "pink";

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-500/10 transition-colors"
      >
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-amber-400" />
        </motion.div>
        <AlertCircle className="w-5 h-5 text-amber-400" />
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-400">{title}</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-300 rounded-full">
              {count}
            </span>
          </div>
          {subtitle && (
            <span className="text-xs text-amber-400/60">{subtitle}</span>
          )}
        </div>
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
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  onPriorityChange,
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
  onMoveToLater?: (subtask: Subtask) => void;
  isOverdue?: boolean;
  depth?: number;
  maxDepth?: number;
}) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
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
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className={cn(
          "group/subtask flex items-center gap-4 py-4 px-5 rounded-xl transition-all",
          isCompleted
            ? "bg-green-500/10 border border-green-500/20"
            : isOverdue
              ? "bg-amber-500/10 border-2 border-amber-500/50"
              : "bg-white/5 hover:bg-white/10 border border-white/10",
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
                : "border-cyan-400/50 hover:border-cyan-400 hover:bg-cyan-500/20",
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
                  isCompleted ? "line-through text-white/40" : "text-white",
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
                    onClick={(e) => e.stopPropagation()}
                    className="w-12 text-center text-sm px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 outline-none"
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
                      "text-sm px-2 py-0.5 rounded-lg font-medium transition-colors",
                      subtask.priority
                        ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
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
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    childCounts.completed === childCounts.total
                      ? "bg-green-500/20 text-green-400"
                      : isPink
                        ? "bg-pink-500/20 text-pink-400"
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
              "p-2 rounded-lg transition-all",
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
            className="p-2 rounded-lg transition-all text-white/30 hover:text-white/60 hover:bg-white/10 opacity-0 group-hover/subtask:opacity-100"
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
                onPriorityChange={onPriorityChange}
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
        isCompletedForOccurrence
          ? "bg-green-500/10 border border-green-500/20"
          : "bg-white/5 hover:bg-white/10 border border-white/10",
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
            : isPink
              ? "border-pink-400/50 hover:border-pink-400 hover:bg-pink-500/20"
              : "border-cyan-400/50 hover:border-cyan-400 hover:bg-cyan-500/20",
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
              : "text-white",
          )}
        >
          {subtask.title}
        </span>
        {isOverdue && overdueFromDate && (
          <p className="text-sm text-white/40 mt-0.5">
            from {format(overdueFromDate, "MMM d")}
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
            : "text-cyan-400/70 border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/50",
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
  const updateSubtaskPriority = useUpdateSubtaskPriority();
  const updateSubtaskKanbanStage = useUpdateSubtaskKanbanStage();
  const updateKanbanSettings = useUpdateItemKanbanSettings();

  // Kanban view state
  const [isKanbanView, setIsKanbanView] = useState(
    item.subtask_kanban_enabled || false,
  );
  const allKanbanStages = item.subtask_kanban_stages || [
    "To Do",
    "In Progress",
    "Done",
  ];
  // Main kanban stages (excludes "Later" which is displayed separately)
  const kanbanStages = allKanbanStages.filter((s: string) => s !== LATER_STAGE);
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [showLater, setShowLater] = useState(false);
  const [showOverdueInKanban, setShowOverdueInKanban] = useState(true);

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
              targetDateStr,
        );
      }
      // For one-time items, check done_at
      const subtask = subtasks.find((s) => s.id === subtaskId);
      return !!subtask?.done_at;
    },
    [isRecurring, subtaskCompletions, subtasks],
  );

  // Check if a subtask is completed for THIS occurrence
  const isSubtaskCompleted = useCallback(
    (subtaskId: string) => isSubtaskCompletedForDate(subtaskId, occurrenceDate),
    [isSubtaskCompletedForDate, occurrenceDate],
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

  // Dragged/orphaned subtasks: subtasks with NULL occurrence_date for recurring items
  // These are subtasks that were created without being tied to a specific occurrence
  const draggedSubtasks = useMemo(() => {
    if (!isRecurring) return [];
    return subtasks.filter((s) => !s.occurrence_date && !s.done_at);
  }, [subtasks, isRecurring]);

  // Overdue subtasks from past occurrences (with occurrence_date set)
  const overdueSubtasksWithDates = useMemo((): Array<{
    subtask: Subtask;
    homeOccurrence: Date;
  }> => {
    if (!isRecurring) return [];

    const overdueList: Array<{ subtask: Subtask; homeOccurrence: Date }> = [];

    for (const subtask of subtasks) {
      const subtaskOccDate = getSubtaskOccDate(subtask);
      if (!subtaskOccDate) continue;

      const subtaskOcc = startOfDay(subtaskOccDate);

      // Skip subtasks for current occurrence (they show in currentOccurrenceSubtasks)
      if (isSameDay(subtaskOcc, currentOcc)) continue;
      // Skip future occurrences
      if (!isBefore(subtaskOcc, currentOcc)) continue;

      // Check if NOT completed for its home occurrence
      if (!isSubtaskCompletedForDate(subtask.id, subtaskOccDate)) {
        overdueList.push({ subtask, homeOccurrence: subtaskOccDate });
      }
    }

    return overdueList.sort(
      (a, b) => a.homeOccurrence.getTime() - b.homeOccurrence.getTime(),
    );
  }, [isRecurring, subtasks, currentOcc, isSubtaskCompletedForDate]);

  // Combined count of all incomplete subtasks from past
  const hasDraggedSubtasks = draggedSubtasks.length > 0;

  // Count completed subtasks (only top-level for progress display)
  const topLevelSubtasks = currentOccurrenceSubtasks.filter(
    (s) => !s.parent_subtask_id,
  );
  const completedSubtasksCount = topLevelSubtasks.filter((s) =>
    isSubtaskCompleted(s.id),
  ).length;

  // Build nested tree from flat subtasks (excludes Later stage)
  const subtaskTree = useMemo(() => {
    const mainSubtasks = currentOccurrenceSubtasks.filter(
      (s) => s.kanban_stage !== LATER_STAGE,
    );
    return buildSubtaskTree(mainSubtasks);
  }, [currentOccurrenceSubtasks]);

  // Overdue subtasks for list view (when toggle is on)
  const overdueSubtasksForList = useMemo(() => {
    if (!showOverdueInKanban) return [];
    return overdueSubtasksWithDates
      .filter(({ subtask }) => subtask.kanban_stage !== LATER_STAGE)
      .map(({ subtask, homeOccurrence }) => ({ subtask, homeOccurrence }));
  }, [showOverdueInKanban, overdueSubtasksWithDates]);

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
      s.id === subtask.id ? !currentlyCompleted : isSubtaskCompleted(s.id),
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
    homeOccurrence: Date,
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
    title: string,
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

  // Handle priority change
  const handlePriorityChange = async (
    subtaskId: string,
    priority: number | null,
  ) => {
    await updateSubtaskPriority.mutateAsync({
      subtaskId,
      parentItemId: item.id,
      newPriority: priority,
    });
  };

  // Handle kanban stage change - React Query handles optimistic update
  const handleKanbanStageChange = async (subtaskId: string, stage: string) => {
    await updateSubtaskKanbanStage.mutateAsync({
      subtaskId,
      kanbanStage: stage,
      parentItemId: item.id,
    });
  };

  // Get effective kanban stage
  const getEffectiveKanbanStage = (subtask: Subtask): string => {
    return subtask.kanban_stage ?? kanbanStages[0];
  };

  // Handle kanban toggle
  const handleKanbanToggle = async (enabled: boolean) => {
    setIsKanbanView(enabled);
    await updateKanbanSettings.mutateAsync({
      itemId: item.id,
      kanbanEnabled: enabled,
      kanbanStages: kanbanStages,
    });
  };

  // Handle kanban move forward (to next stage)
  const handleKanbanMoveForward = async (subtask: Subtask) => {
    const currentStage = getEffectiveKanbanStage(subtask);
    const currentIndex = kanbanStages.indexOf(currentStage);

    if (currentIndex < kanbanStages.length - 1) {
      // Move to next stage
      const nextStage = kanbanStages[currentIndex + 1];
      await handleKanbanStageChange(subtask.id, nextStage);

      // If moved to final stage, mark as complete
      if (currentIndex + 1 === kanbanStages.length - 1) {
        await handleSubtaskToggle(subtask);
      }
    }
  };

  // Handle kanban move backward (to previous stage)
  const handleKanbanMoveBackward = async (subtask: Subtask) => {
    const currentStage = getEffectiveKanbanStage(subtask);
    const currentIndex = kanbanStages.indexOf(currentStage);

    if (currentIndex > 0) {
      // Move to previous stage
      const prevStage = kanbanStages[currentIndex - 1];
      await handleKanbanStageChange(subtask.id, prevStage);
    }
  };

  // Ref for custom drag image
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, subtaskId: string) => {
    setDraggedSubtaskId(subtaskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", subtaskId);

    // Create custom drag image
    const subtask = currentOccurrenceSubtasks.find((s) => s.id === subtaskId);
    if (subtask) {
      const dragImage = document.createElement("div");
      dragImage.className = cn(
        "fixed z-[200] px-4 py-2 rounded-lg shadow-2xl max-w-[200px] truncate border-2",
        isPink
          ? "bg-pink-900/90 border-pink-500 text-pink-100"
          : "bg-cyan-900/90 border-cyan-500 text-cyan-100",
      );
      dragImage.style.cssText = "position: fixed; top: -1000px; left: -1000px;";
      dragImage.textContent = subtask.title;
      document.body.appendChild(dragImage);
      dragImageRef.current = dragImage;

      e.dataTransfer.setDragImage(
        dragImage,
        dragImage.offsetWidth / 2,
        dragImage.offsetHeight / 2,
      );

      // Clean up after a brief delay
      setTimeout(() => {
        if (dragImageRef.current) {
          document.body.removeChild(dragImageRef.current);
          dragImageRef.current = null;
        }
      }, 0);
    }
  };

  // Handle drag over a stage column
  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stage);
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  // Handle drop on a stage column
  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverStage(null);

    const subtaskId = e.dataTransfer.getData("text/plain") || draggedSubtaskId;
    if (!subtaskId) return;

    const subtask = currentOccurrenceSubtasks.find((s) => s.id === subtaskId);
    if (!subtask) return;

    const currentStage = getEffectiveKanbanStage(subtask);
    if (currentStage === targetStage) {
      setDraggedSubtaskId(null);
      return;
    }

    setDraggedSubtaskId(null);

    // Move to target stage (optimistic update happens inside)
    await handleKanbanStageChange(subtaskId, targetStage);

    // If moved to final stage, mark as complete
    const targetIndex = kanbanStages.indexOf(targetStage);
    if (targetIndex === kanbanStages.length - 1) {
      await handleSubtaskToggle(subtask);
    }
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedSubtaskId(null);
    setDragOverStage(null);
  };

  // Touch event handlers for mobile drag and drop
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchSubtaskId = useRef<string | null>(null);
  const [dragGhostPos, setDragGhostPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [dragGhostTitle, setDragGhostTitle] = useState<string>("");

  const handleTouchStart = (e: React.TouchEvent, subtaskId: string) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    touchSubtaskId.current = subtaskId;
    setDraggedSubtaskId(subtaskId);

    // Set up ghost element
    const subtask = currentOccurrenceSubtasks.find((s) => s.id === subtaskId);
    if (subtask) {
      setDragGhostTitle(subtask.title);
      setDragGhostPos({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchSubtaskId.current) return;

    const touch = e.touches[0];

    // Update ghost position
    setDragGhostPos({ x: touch.clientX, y: touch.clientY });

    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    // Find which stage column we're over
    const stageColumn = element?.closest("[data-kanban-stage]");
    if (stageColumn) {
      const stage = stageColumn.getAttribute("data-kanban-stage");
      if (stage) setDragOverStage(stage);
    } else {
      setDragOverStage(null);
    }
  };

  const handleTouchEnd = async () => {
    const subtaskId = touchSubtaskId.current;
    const targetStage = dragOverStage;

    // Reset touch state
    touchStartPos.current = null;
    touchSubtaskId.current = null;
    setDraggedSubtaskId(null);
    setDragOverStage(null);
    setDragGhostPos(null);
    setDragGhostTitle("");

    if (!subtaskId || !targetStage) return;

    const subtask = currentOccurrenceSubtasks.find((s) => s.id === subtaskId);
    if (!subtask) return;

    const currentStage = getEffectiveKanbanStage(subtask);
    if (currentStage === targetStage) return;

    // Move to target stage
    await handleKanbanStageChange(subtaskId, targetStage);

    // If moved to final stage, mark as complete
    const targetIndex = kanbanStages.indexOf(targetStage);
    if (targetIndex === kanbanStages.length - 1) {
      await handleSubtaskToggle(subtask);
    }
  };

  // Get subtasks by kanban stage (using optimistic local state)
  const getSubtasksByStage = (stage: string) => {
    return currentOccurrenceSubtasks
      .filter((s) => !s.parent_subtask_id) // Only top-level for kanban
      .filter((s) => getEffectiveKanbanStage(s) === stage)
      .sort((a, b) => {
        const aPriority = a.priority ?? null;
        const bPriority = b.priority ?? null;
        if (aPriority === null && bPriority === null) return 0;
        if (aPriority === null) return 1;
        if (bPriority === null) return -1;
        return aPriority - bPriority;
      });
  };

  // Set of overdue subtask IDs for quick lookup
  const overdueSubtaskIds = useMemo(() => {
    return new Set(overdueSubtasksWithDates.map(({ subtask }) => subtask.id));
  }, [overdueSubtasksWithDates]);

  // Get subtasks by kanban stage (includes overdue when toggled)
  const getSubtasksByStageWithOverdue = (stage: string) => {
    const current = currentOccurrenceSubtasks
      .filter((s) => !s.parent_subtask_id) // Only top-level for kanban
      .filter((s) => getEffectiveKanbanStage(s) === stage);

    const overdue = showOverdueInKanban
      ? overdueSubtasksWithDates
          .filter(({ subtask }) => !subtask.parent_subtask_id)
          .filter(({ subtask }) => getEffectiveKanbanStage(subtask) === stage)
          .map(({ subtask }) => subtask)
      : [];

    return [...current, ...overdue].sort((a, b) => {
      const aPriority = a.priority ?? null;
      const bPriority = b.priority ?? null;
      if (aPriority === null && bPriority === null) return 0;
      if (aPriority === null) return 1;
      if (bPriority === null) return -1;
      return aPriority - bPriority;
    });
  };

  // Subtasks in "Later" stage (shown as collapsible section, includes overdue when toggled)
  const laterSubtasks = useMemo(() => {
    const currentLater = currentOccurrenceSubtasks
      .filter((s) => !s.parent_subtask_id)
      .filter((s) => getEffectiveKanbanStage(s) === LATER_STAGE);

    const overdueLater = showOverdueInKanban
      ? overdueSubtasksWithDates
          .filter(({ subtask }) => !subtask.parent_subtask_id)
          .filter(
            ({ subtask }) => getEffectiveKanbanStage(subtask) === LATER_STAGE,
          )
          .map(({ subtask }) => subtask)
      : [];

    return [...currentLater, ...overdueLater].sort(sortByPriorityThenOrder);
  }, [
    currentOccurrenceSubtasks,
    showOverdueInKanban,
    overdueSubtasksWithDates,
  ]);

  // Move to "Later" stage - saves current stage for undo
  const handleMoveToLater = async (subtask: Subtask) => {
    const currentStage = getEffectiveKanbanStage(subtask);
    await updateSubtaskKanbanStage.mutateAsync({
      subtaskId: subtask.id,
      kanbanStage: LATER_STAGE,
      parentItemId: item.id,
      previousKanbanStage: currentStage, // Save where it came from
    });
  };

  // Move from "Later" back to previous stage (or first stage if unknown)
  const handleMoveFromLater = async (subtask: Subtask) => {
    const targetStage = subtask.previous_kanban_stage || kanbanStages[0];
    // Validate the target stage exists in current stages
    const validStage = kanbanStages.includes(targetStage)
      ? targetStage
      : kanbanStages[0];
    await updateSubtaskKanbanStage.mutateAsync({
      subtaskId: subtask.id,
      kanbanStage: validStage,
      parentItemId: item.id,
      previousKanbanStage: null, // Clear the previous stage after restoring
    });
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
              : "border-white/10 bg-white/5",
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
              : "text-cyan-400 hover:bg-cyan-500/20",
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
                  isCompleted && "line-through text-white/50",
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
                        : "text-cyan-400",
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
                        : "bg-cyan-500",
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
              {/* Dragged/Orphaned Subtasks - Collapsible */}
              {hasDraggedSubtasks && (
                <CollapsiblePastSubtasks
                  title="Incomplete Subtasks"
                  subtitle="Carried forward from previous occurrences"
                  count={draggedSubtasks.length}
                  defaultOpen={true}
                >
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {draggedSubtasks.map((subtask) => (
                        <FocusSubtaskItem
                          key={`dragged-${subtask.id}`}
                          subtask={subtask}
                          isRecurring={isRecurring}
                          occurrenceDate={occurrenceDate}
                          isCompletedForOccurrence={false}
                          onToggle={() => handleSubtaskToggle(subtask)}
                          onDelete={() => handleDeleteSubtask(subtask.id)}
                          isOverdue={true}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </CollapsiblePastSubtasks>
              )}

              {/* Current Subtasks */}
              <div>
                {(hasCurrentSubtasks || !hasOverdueSubtasks) && (
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Target
                        className={cn(
                          "w-5 h-5",
                          isPink ? "text-pink-400" : "text-cyan-400",
                        )}
                      />
                      <h2
                        className={cn(
                          "text-xl font-semibold",
                          isPink ? "text-pink-400" : "text-cyan-400",
                        )}
                      >
                        {hasOverdueSubtasks ? "Today's Subtasks" : "Subtasks"}
                      </h2>
                    </div>
                    {/* Kanban Toggle */}
                    <div className="flex items-center gap-2">
                      {/* Show Overdue Toggle - show in both views when there are overdue items */}
                      {hasOverdueSubtasks && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowOverdueInKanban(!showOverdueInKanban)
                          }
                          title={
                            showOverdueInKanban
                              ? "Hide overdue items from kanban"
                              : `Show ${overdueSubtasksWithDates.length} overdue items in kanban`
                          }
                          className={cn(
                            "p-1.5 rounded-lg transition-colors flex items-center gap-1",
                            showOverdueInKanban
                              ? "bg-amber-500/20 text-amber-400"
                              : "text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10",
                          )}
                        >
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">
                            {overdueSubtasksWithDates.length}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleKanbanToggle(false)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          !isKanbanView
                            ? isPink
                              ? "bg-pink-500/20 text-pink-400"
                              : "bg-cyan-500/20 text-cyan-400"
                            : "text-white/40 hover:text-white/60 hover:bg-white/10",
                        )}
                        title="List view"
                      >
                        <List className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKanbanToggle(true)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          isKanbanView
                            ? isPink
                              ? "bg-pink-500/20 text-pink-400"
                              : "bg-cyan-500/20 text-cyan-400"
                            : "text-white/40 hover:text-white/60 hover:bg-white/10",
                        )}
                        title="Kanban view"
                      >
                        <Columns3 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* List View */}
                {!isKanbanView && (
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
                          onPriorityChange={handlePriorityChange}
                          onMoveToLater={handleMoveToLater}
                          isOverdue={overdueSubtaskIds.has(subtask.id)}
                        />
                      ))}
                    </AnimatePresence>

                    {/* Overdue subtasks from past occurrences - shown inline when toggle is on */}
                    {overdueSubtasksForList.map(
                      ({ subtask, homeOccurrence }) => (
                        <motion.div
                          key={`overdue-${subtask.id}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="group/subtask flex items-center gap-4 py-4 px-5 rounded-xl transition-all bg-amber-500/10 border-2 border-amber-500/50"
                        >
                          <div className="w-5 flex-shrink-0" />
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
                              "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0",
                              isPink
                                ? "border-pink-400/50 hover:border-pink-400 hover:bg-pink-500/20"
                                : "border-cyan-400/50 hover:border-cyan-400 hover:bg-cyan-500/20",
                            )}
                          />
                          <span className="flex-1 text-lg text-white/90">
                            {subtask.title}
                          </span>
                          <span className="text-sm text-amber-500">
                            {format(homeOccurrence, "MMM d")}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMoveToLater(subtask)}
                            className="p-2 rounded-lg transition-all text-white/30 hover:text-white/60 hover:bg-white/10 opacity-0 group-hover/subtask:opacity-100"
                            title="Move to Later"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubtask(subtask.id)}
                            className="p-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                            title="Delete subtask"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ),
                    )}

                    {/* Later section for list view */}
                    {laterSubtasks.length > 0 && (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => setShowLater(!showLater)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                          <motion.div
                            animate={{ rotate: showLater ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-4 h-4 text-white/50" />
                          </motion.div>
                          <Clock className="w-4 h-4 text-white/50" />
                          <span className="text-sm font-medium text-white/70">
                            Later
                          </span>
                          <span className="px-1.5 py-0.5 text-xs rounded-full bg-white/10 text-white/50">
                            {laterSubtasks.length}
                          </span>
                          <span className="text-xs text-white/40 ml-auto">
                            Low priority
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
                              <div className="mt-2 space-y-2 pl-2">
                                {laterSubtasks.map((subtask) => {
                                  const isOverdueItem = overdueSubtaskIds.has(
                                    subtask.id,
                                  );
                                  return (
                                    <motion.div
                                      key={subtask.id}
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      className={cn(
                                        "group/subtask flex items-center gap-4 py-3 px-4 rounded-xl transition-all",
                                        isOverdueItem
                                          ? "bg-amber-500/10 border-2 border-amber-500/50"
                                          : "bg-white/5 hover:bg-white/10 border border-white/10",
                                      )}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMoveFromLater(subtask)
                                        }
                                        className={cn(
                                          "flex-shrink-0 w-5 h-5 flex items-center justify-center transition-all",
                                          isPink
                                            ? "text-pink-400/50 hover:text-pink-400"
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
                                      <span className="flex-1 text-base text-white/70">
                                        {subtask.title}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteSubtask(subtask.id)
                                        }
                                        className="p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all opacity-0 group-hover/subtask:opacity-100"
                                        title="Delete subtask"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <FocusAddSubtaskInput onAdd={handleAddSubtask} />
                  </div>
                )}

                {/* Kanban View */}
                {isKanbanView && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {kanbanStages.map((stage, stageIndex) => (
                        <div
                          key={stage}
                          data-kanban-stage={stage}
                          onDragOver={(e) => handleDragOver(e, stage)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, stage)}
                          className={cn(
                            "rounded-xl p-3 min-h-[200px] transition-all",
                            stageIndex === kanbanStages.length - 1
                              ? "bg-green-500/10 border border-green-500/20"
                              : "bg-white/5 border border-white/10",
                            dragOverStage === stage && "ring-2",
                            dragOverStage === stage &&
                              (stageIndex === kanbanStages.length - 1
                                ? "ring-green-500/50"
                                : isPink
                                  ? "ring-pink-500/50"
                                  : "ring-cyan-500/50"),
                          )}
                        >
                          <h3
                            className={cn(
                              "font-semibold mb-3 text-sm",
                              stageIndex === kanbanStages.length - 1
                                ? "text-green-400"
                                : isPink
                                  ? "text-pink-400"
                                  : "text-cyan-400",
                            )}
                          >
                            {stage} (
                            {getSubtasksByStageWithOverdue(stage).length})
                          </h3>
                          <div className="space-y-2">
                            {getSubtasksByStageWithOverdue(stage).map(
                              (subtask) => {
                                const isOverdue = overdueSubtaskIds.has(
                                  subtask.id,
                                );
                                return (
                                  <div
                                    key={subtask.id}
                                    draggable
                                    onDragStart={(e) =>
                                      handleDragStart(e, subtask.id)
                                    }
                                    onDragEnd={handleDragEnd}
                                    onTouchStart={(e) =>
                                      handleTouchStart(e, subtask.id)
                                    }
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                    className={cn(
                                      "p-3 rounded-lg",
                                      "hover:bg-white/10 transition-all cursor-grab active:cursor-grabbing",
                                      "touch-none",
                                      isOverdue
                                        ? "border-2 border-amber-500/50 bg-amber-500/10"
                                        : "bg-white/5 border border-white/10",
                                      draggedSubtaskId === subtask.id &&
                                        "opacity-50 scale-95",
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      {/* Back arrow - only show if not in first stage */}
                                      {stageIndex > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleKanbanMoveBackward(subtask)
                                          }
                                          className={cn(
                                            "flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all",
                                            "hover:bg-white/10",
                                            isPink
                                              ? "text-pink-400/50 hover:text-pink-400"
                                              : "text-cyan-400/50 hover:text-cyan-400",
                                          )}
                                          title="Move to previous stage"
                                        >
                                          <ChevronLeft className="w-4 h-4" />
                                        </button>
                                      )}
                                      {/* Spacer when in first stage for alignment */}
                                      {stageIndex === 0 && (
                                        <div className="w-5" />
                                      )}

                                      <div className="flex-1 min-w-0">
                                        <span
                                          className={cn(
                                            "text-sm",
                                            stageIndex ===
                                              kanbanStages.length - 1
                                              ? "text-white/50 line-through"
                                              : "text-white",
                                          )}
                                        >
                                          {subtask.title}
                                        </span>
                                        {subtask.priority !== null &&
                                          subtask.priority !== undefined && (
                                            <span
                                              className={cn(
                                                "ml-2 px-1.5 py-0.5 text-xs rounded font-medium",
                                                isPink
                                                  ? "bg-pink-500/20 text-pink-400"
                                                  : "bg-cyan-500/20 text-cyan-400",
                                              )}
                                            >
                                              #{subtask.priority}
                                            </span>
                                          )}
                                      </div>

                                      {/* Move to Later button */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMoveToLater(subtask)
                                        }
                                        className={cn(
                                          "flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all",
                                          "hover:bg-white/10 text-white/30 hover:text-white/60",
                                        )}
                                        title="Move to Later"
                                      >
                                        <Clock className="w-3.5 h-3.5" />
                                      </button>

                                      {/* Forward arrow / check button */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleKanbanMoveForward(subtask)
                                        }
                                        className={cn(
                                          "flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                          stageIndex === kanbanStages.length - 1
                                            ? "border-green-500 bg-green-500"
                                            : isPink
                                              ? "border-pink-400/50 hover:border-pink-400"
                                              : "border-cyan-400/50 hover:border-cyan-400",
                                        )}
                                        title={
                                          stageIndex === kanbanStages.length - 1
                                            ? "Move to first stage"
                                            : "Move to next stage"
                                        }
                                      >
                                        {stageIndex ===
                                          kanbanStages.length - 1 && (
                                          <Check className="w-3 h-3 text-white" />
                                        )}
                                        {stageIndex <
                                          kanbanStages.length - 1 && (
                                          <ChevronRight className="w-3 h-3 text-white/40" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Later Section - collapsible for low-priority items */}
                    {laterSubtasks.length > 0 && (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => setShowLater(!showLater)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                          <motion.div
                            animate={{ rotate: showLater ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-4 h-4 text-white/50" />
                          </motion.div>
                          <Clock className="w-4 h-4 text-white/50" />
                          <span className="text-sm font-medium text-white/70">
                            Later
                          </span>
                          <span className="px-1.5 py-0.5 text-xs rounded-full bg-white/10 text-white/50">
                            {laterSubtasks.length}
                          </span>
                          <span className="text-xs text-white/40 ml-auto">
                            Low priority
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
                              <div className="mt-2 space-y-2 pl-2">
                                {laterSubtasks.map((subtask) => {
                                  const isOverdue = overdueSubtaskIds.has(
                                    subtask.id,
                                  );
                                  return (
                                    <div
                                      key={subtask.id}
                                      className={cn(
                                        "p-3 rounded-lg hover:bg-white/10 transition-colors",
                                        isOverdue
                                          ? "border-2 border-amber-500/50 bg-amber-500/10"
                                          : "bg-white/5 border border-white/10",
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        {/* Move back to To Do */}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleMoveFromLater(subtask)
                                          }
                                          className={cn(
                                            "flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all",
                                            "hover:bg-white/10",
                                            isPink
                                              ? "text-pink-400/50 hover:text-pink-400"
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

                                        <span className="flex-1 text-sm text-white/70">
                                          {subtask.title}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </>
                )}
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

      {/* Drag Ghost Element - follows finger during touch drag */}
      <AnimatePresence>
        {dragGhostPos && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "fixed z-[200] pointer-events-none px-4 py-2 rounded-lg shadow-2xl max-w-[200px] truncate",
              "border-2",
              isPink
                ? "bg-pink-900/90 border-pink-500 text-pink-100"
                : "bg-cyan-900/90 border-cyan-500 text-cyan-100",
            )}
            style={{
              left: dragGhostPos.x,
              top: dragGhostPos.y,
              transform: "translate(-50%, -120%)",
            }}
          >
            <span className="text-sm font-medium">{dragGhostTitle}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
