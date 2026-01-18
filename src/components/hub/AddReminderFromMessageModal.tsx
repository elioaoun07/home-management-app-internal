// src/components/hub/AddReminderFromMessageModal.tsx
"use client";

import { SaveIcon, XIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateMessageAction } from "@/features/hub/messageActions";
import {
  useCreateEvent,
  useCreateReminder,
  useCreateTask,
} from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type {
  CreateEventInput,
  CreateReminderInput,
  CreateTaskInput,
  ItemPriority,
  ItemType,
} from "@/types/items";
import { format, parse } from "date-fns";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
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

const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

// ============================================
// PRIORITY CONFIG
// ============================================

const priorityConfig: Record<
  ItemPriority,
  { label: string; icon: string; gradient: string }
> = {
  low: {
    label: "Low",
    icon: "🔵",
    gradient: "from-gray-500/20 to-gray-600/20",
  },
  normal: {
    label: "Normal",
    icon: "⚪",
    gradient: "from-cyan-500/20 to-blue-500/20",
  },
  high: {
    label: "High",
    icon: "🟠",
    gradient: "from-orange-500/20 to-red-500/20",
  },
  urgent: {
    label: "Urgent",
    icon: "🔴",
    gradient: "from-red-500/30 to-pink-500/30",
  },
};

// Type configuration
const typeConfig: Record<
  ItemType,
  { label: string; icon: string; gradient: string }
> = {
  reminder: {
    label: "Reminder",
    icon: "⏰",
    gradient: "from-cyan-500/20 to-blue-500/20",
  },
  event: {
    label: "Event",
    icon: "📅",
    gradient: "from-purple-500/20 to-pink-500/20",
  },
  task: {
    label: "Task",
    icon: "✅",
    gradient: "from-green-500/20 to-emerald-500/20",
  },
};

// Categories
const CATEGORIES = [
  { id: "personal", name: "Personal", color_hex: "#8B5CF6" },
  { id: "home", name: "Home", color_hex: "#1E90FF" },
  { id: "family", name: "Family", color_hex: "#FFA500" },
  { id: "community", name: "Community", color_hex: "#22C55E" },
  { id: "friends", name: "Friends", color_hex: "#EC4899" },
  { id: "work", name: "Work", color_hex: "#FF3B30" },
] as const;

// ============================================
// PROPS
// ============================================

interface Props {
  messageId: string;
  initialTitle: string;
  initialDescription: string;
  onClose: () => void;
  onSuccess: (messageId: string) => void;
}

// ============================================
// COMPONENT
// ============================================

export default function AddReminderFromMessageModal({
  messageId,
  initialTitle,
  initialDescription,
  onClose,
  onSuccess,
}: Props) {
  const [isClosing, setIsClosing] = useState(false);
  const createReminder = useCreateReminder();
  const createEvent = useCreateEvent();
  const createTask = useCreateTask();
  const createActionMutation = useCreateMessageAction();

  // Form state
  const [title, setTitle] = useState(initialTitle || initialDescription || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [itemType, setItemType] = useState<ItemType>("reminder");
  const [priority, setPriority] = useState<ItemPriority>("normal");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([
    "personal",
  ]);

  // Date/Time state
  const [dueDate, setDueDate] = useState(() => {
    const today = new Date();
    return format(today, "yyyy-MM-dd");
  });
  const [dueTime, setDueTime] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    return format(now, "HH:mm");
  });

  // For events
  const [startDate, setStartDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    return format(now, "HH:mm");
  });
  const [endDate, setEndDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return format(tomorrow, "yyyy-MM-dd");
  });
  const [endTime, setEndTime] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() + 2);
    now.setMinutes(0);
    return format(now, "HH:mm");
  });

  // Animated close handler
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
  }, [onClose]);

  // Handle save
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    try {
      let createdItemId: string | undefined;

      if (itemType === "event") {
        const startAtIso = new Date(
          `${startDate}T${startTime}:00`,
        ).toISOString();
        const endAtIso = new Date(`${endDate}T${endTime}:00`).toISOString();

        const input: CreateEventInput = {
          type: "event",
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          is_public: false,
          start_at: startAtIso,
          end_at: endAtIso,
          category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        };

        const result = await createEvent.mutateAsync(input);
        createdItemId = result?.id;
        toast.success("Event created!", { description: title });
      } else if (itemType === "task") {
        const dueAtIso = new Date(`${dueDate}T${dueTime}:00`).toISOString();

        const input: CreateTaskInput = {
          type: "task",
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          is_public: false,
          due_at: dueAtIso,
          category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        };

        const result = await createTask.mutateAsync(input);
        createdItemId = result?.id;
        toast.success("Task created!", { description: title });
      } else {
        const dueAtIso = new Date(`${dueDate}T${dueTime}:00`).toISOString();

        const input: CreateReminderInput = {
          type: "reminder",
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          is_public: false,
          due_at: dueAtIso,
          category_ids:
            selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        };

        const result = await createReminder.mutateAsync(input);
        createdItemId = result?.id;
        toast.success("Reminder created!", { description: title });
      }

      // Create message action linking to reminder
      try {
        await createActionMutation.mutateAsync({
          messageId,
          actionType: "reminder",
          metadata: { item_id: createdItemId, item_type: itemType },
        });
      } catch (err) {
        console.error("Action tracking failed:", err);
      }

      onSuccess(messageId);
      handleClose();
    } catch (error) {
      console.error("Failed to create item:", error);
      toast.error("Failed to create item");
    }
  };

  const isPending =
    createReminder.isPending || createEvent.isPending || createTask.isPending;

  // Helper to format date for display
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "Select date";
    try {
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      return format(date, "d MMM, yyyy");
    } catch {
      return dateStr;
    }
  };

  // Helper to format time for display
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

  // Toggle category
  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  };

  const modalContent = (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-end justify-center sm:items-center",
        isClosing
          ? "animate-out fade-out duration-200"
          : "animate-in fade-in duration-200",
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full max-w-md mx-4 mb-[88px] sm:mb-0 bg-bg-card-custom rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col",
          isClosing
            ? "animate-out slide-out-to-bottom-4 duration-200"
            : "animate-in slide-in-from-bottom-4 duration-300",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <h2 className="text-lg font-semibold text-white">
            Add {typeConfig[itemType].icon} {typeConfig[itemType].label} from
            Message
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <XIcon className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Type Selector */}
          <div>
            <label className="text-xs font-medium text-white/60 mb-2 block">
              Type
            </label>
            <div className="flex gap-2">
              {(Object.keys(typeConfig) as ItemType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setItemType(type)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                    itemType === type
                      ? `bg-gradient-to-br ${typeConfig[type].gradient} border border-white/20 text-white`
                      : "bg-white/5 text-white/60 hover:bg-white/10",
                  )}
                >
                  <span>{typeConfig[type].icon}</span>
                  <span>{typeConfig[type].label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-white/60 mb-2 block">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to remember?"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>

          {/* Date & Time for Reminder/Task */}
          {(itemType === "reminder" || itemType === "task") && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-white/60 mb-2 block">
                  Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-white/60 mb-2 block">
                  Time
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Date & Time for Event */}
          {itemType === "event" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-white/60 mb-2 block">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-2 block">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-white/60 mb-2 block">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-2 block">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="text-xs font-medium text-white/60 mb-2 block">
              Priority
            </label>
            <div className="flex gap-2">
              {(Object.keys(priorityConfig) as ItemPriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1",
                    priority === p
                      ? `bg-gradient-to-br ${priorityConfig[p].gradient} border border-white/20 text-white`
                      : "bg-white/5 text-white/60 hover:bg-white/10",
                  )}
                >
                  <span>{priorityConfig[p].icon}</span>
                  <span className="hidden sm:inline">
                    {priorityConfig[p].label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="text-xs font-medium text-white/60 mb-2 block">
              Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    selectedCategoryIds.includes(cat.id)
                      ? "text-white border-2"
                      : "bg-white/5 text-white/60 hover:bg-white/10 border border-transparent",
                  )}
                  style={
                    selectedCategoryIds.includes(cat.id)
                      ? {
                          backgroundColor: `${cat.color_hex}20`,
                          borderColor: cat.color_hex,
                        }
                      : undefined
                  }
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-white/60 mb-2 block">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-white/10 shrink-0">
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !title.trim()}
            className="flex-1 gap-2 neo-gradient text-white font-semibold"
          >
            <SaveIcon className="w-4 h-4" />
            {isPending ? "Creating..." : `Add ${typeConfig[itemType].label}`}
          </Button>
        </div>
      </div>
    </div>
  );

  // Render in portal
  if (typeof window === "undefined") return null;
  return createPortal(modalContent, document.body);
}
