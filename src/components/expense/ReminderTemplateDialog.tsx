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
import type {
  CreateReminderTemplateInput,
  ItemPriority,
  ItemType,
  ReminderTemplate,
} from "@/types/items";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ReminderTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<ReminderTemplate>;
  onSave: (tpl: CreateReminderTemplateInput) => Promise<void>;
  onDelete?: () => void;
}

const PRIORITY_OPTIONS: {
  value: ItemPriority;
  label: string;
  color: string;
}[] = [
  { value: "low", label: "Low", color: "bg-gray-500" },
  { value: "normal", label: "Normal", color: "bg-blue-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
];

const TYPE_OPTIONS: { value: ItemType; label: string; icon: string }[] = [
  { value: "task", label: "Task", icon: "✅" },
  { value: "reminder", label: "Reminder", icon: "⏰" },
  { value: "event", label: "Event", icon: "📅" },
];

export default function ReminderTemplateDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
}: ReminderTemplateDialogProps) {
  const [name, setName] = useState(initial?.name || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [priority, setPriority] = useState<ItemPriority>(
    initial?.priority || "normal"
  );
  const [itemType, setItemType] = useState<ItemType>(
    initial?.item_type || "task"
  );
  const [durationMinutes, setDurationMinutes] = useState<string>(
    initial?.default_duration_minutes?.toString() || ""
  );
  const [startTime, setStartTime] = useState(initial?.default_start_time || "");
  const [location, setLocation] = useState(initial?.location_text || "");
  const [saving, setSaving] = useState(false);

  // Sync local state when opening or when the provided initial template changes
  useEffect(() => {
    if (!open) return;
    setName(initial?.name || "");
    setTitle(initial?.title || "");
    setDescription(initial?.description || "");
    setPriority(initial?.priority || "normal");
    setItemType(initial?.item_type || "task");
    setDurationMinutes(initial?.default_duration_minutes?.toString() || "");
    setStartTime(initial?.default_start_time || "");
    setLocation(initial?.location_text || "");
  }, [open, initial]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !title.trim()) {
      toast.error("Please provide a name and title");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        title: title.trim(),
        description: description.trim() || null,
        priority,
        item_type: itemType,
        default_duration_minutes: durationMinutes
          ? parseInt(durationMinutes)
          : null,
        default_start_time: startTime || null,
        location_text: location.trim() || null,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save template";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-md">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {initial?.id ? "Edit Task Template" : "New Task Template"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSave}
          className="space-y-4 overflow-y-auto flex-1 px-1"
        >
          {/* Template Name */}
          <div>
            <Label>Template Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Laundry"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Display name in the templates list
            </p>
          </div>

          {/* Item Title */}
          <div>
            <Label>Task Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Do the laundry"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Title of the task when launched
            </p>
          </div>

          {/* Item Type */}
          <div>
            <Label>Type</Label>
            <div className="flex gap-2 mt-1">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setItemType(opt.value)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                    itemType === opt.value
                      ? "neo-gradient text-white border-transparent"
                      : "border-[hsl(var(--header-border)/0.3)] hover:border-[hsl(var(--nav-text-primary)/0.5)]"
                  }`}
                >
                  <span className="mr-1">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <Label>Priority</Label>
            <div className="flex gap-2 mt-1">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                    priority === opt.value
                      ? `${opt.color} text-white border-transparent`
                      : "border-[hsl(var(--header-border)/0.3)] hover:border-[hsl(var(--nav-text-primary)/0.5)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <Label>Default Duration (minutes)</Label>
            <Input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="e.g., 90 for 1.5 hours"
              min="1"
            />
          </div>

          {/* Default Start Time */}
          <div>
            <Label>Default Start Time</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="e.g., 19:00"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Suggested time of day for this task
            </p>
          </div>

          {/* Location (for events) */}
          {itemType === "event" && (
            <div>
              <Label>Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Home, Office"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes or details..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            {onDelete && initial?.id && (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={saving}
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name || !title}>
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
