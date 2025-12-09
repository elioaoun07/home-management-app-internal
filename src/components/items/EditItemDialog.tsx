"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useUpdateEventDetails,
  useUpdateItem,
  useUpdateReminderDetails,
} from "@/features/items/useItems";
import { cn } from "@/lib/utils";
import type { ItemPriority, ItemWithDetails } from "@/types/items";
import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface EditItemDialogProps {
  item: ItemWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditItemDialog({
  item,
  open,
  onOpenChange,
}: EditItemDialogProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ItemPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [saving, setSaving] = useState(false);

  // Mutations
  const updateItem = useUpdateItem();
  const updateReminderDetails = useUpdateReminderDetails();
  const updateEventDetails = useUpdateEventDetails();

  // Initialize form when item changes
  useEffect(() => {
    if (!item) return;

    setTitle(item.title);
    setDescription(item.description || "");
    setPriority(item.priority);

    // Parse date/time based on item type
    if (item.type === "reminder" || item.type === "task") {
      const dueAt = item.reminder_details?.due_at;
      if (dueAt) {
        const date = parseISO(dueAt);
        setDueDate(format(date, "yyyy-MM-dd"));
        setDueTime(format(date, "HH:mm"));
      }
    } else if (item.type === "event") {
      const startAt = item.event_details?.start_at;
      if (startAt) {
        const date = parseISO(startAt);
        setDueDate(format(date, "yyyy-MM-dd"));
        setDueTime(format(date, "HH:mm"));
      }
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSaving(true);
    try {
      // Update base item
      await updateItem.mutateAsync({
        id: item.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
      });

      // Update type-specific details
      if (item.type === "reminder" || item.type === "task") {
        if (dueDate && dueTime) {
          const dueAt = `${dueDate}T${dueTime}:00`;
          await updateReminderDetails.mutateAsync({
            itemId: item.id,
            due_at: new Date(dueAt).toISOString(),
          });
        }
      } else if (item.type === "event") {
        if (dueDate && dueTime) {
          const startAt = `${dueDate}T${dueTime}:00`;
          await updateEventDetails.mutateAsync({
            itemId: item.id,
            start_at: new Date(startAt).toISOString(),
          });
        }
      }

      toast.success("Item updated!");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update item:", error);
      toast.error("Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const priorities: { value: ItemPriority; label: string; color: string }[] = [
    { value: "low", label: "Low", color: "bg-gray-500" },
    { value: "normal", label: "Normal", color: "bg-blue-500" },
    { value: "high", label: "High", color: "bg-orange-500" },
    { value: "urgent", label: "Urgent", color: "bg-red-500" },
  ];

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
          isPink
            ? "bg-gray-900 border-pink-500/30"
            : "bg-gray-900 border-cyan-500/30"
        )}
      >
        <DialogHeader>
          <DialogTitle className={isPink ? "text-pink-400" : "text-cyan-400"}>
            Edit{" "}
            {item.type === "task"
              ? "Task"
              : item.type === "reminder"
                ? "Reminder"
                : "Event"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-white/70">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white/70">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description (optional)"
              className="bg-white/5 border-white/10 text-white resize-none"
              rows={3}
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-white/70">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time" className="text-white/70">
                Time
              </Label>
              <Input
                id="time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label className="text-white/70">Priority</Label>
            <div className="flex gap-2">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    priority === p.value
                      ? cn(p.color, "text-white")
                      : "bg-white/5 text-white/50 hover:bg-white/10"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              isPink
                ? "bg-pink-500 hover:bg-pink-600"
                : "bg-cyan-500 hover:bg-cyan-600"
            )}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
