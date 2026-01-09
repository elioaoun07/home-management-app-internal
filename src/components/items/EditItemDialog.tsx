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
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { checkAndNotifyAssignment } from "@/lib/notifications/sendAssignmentNotification";
import { cn } from "@/lib/utils";
import type { ItemPriority, ItemWithDetails } from "@/types/items";
import { format, parseISO } from "date-fns";
import { Bell, MapPin, Tag, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ResponsibleUserPicker } from "./ResponsibleUserPicker";

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

  // Household members for responsible user picker
  const { data: householdData } = useHouseholdMembers();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ItemPriority>("normal");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [alertMinutes, setAlertMinutes] = useState(0);
  const [saving, setSaving] = useState(false);
  const [responsibleUserId, setResponsibleUserId] = useState<
    string | undefined
  >(undefined);
  const [originalResponsibleUserId, setOriginalResponsibleUserId] = useState<
    string | undefined
  >(undefined);

  // Category options
  const CATEGORIES = [
    { id: "personal", name: "Personal", color: "#8B5CF6" },
    { id: "home", name: "Home", color: "#1E90FF" },
    { id: "family", name: "Family", color: "#FFA500" },
    { id: "community", name: "Community", color: "#22C55E" },
    { id: "friends", name: "Friends", color: "#EC4899" },
    { id: "work", name: "Work", color: "#FF3B30" },
  ];

  // Alert presets
  const alertPresets = [
    { label: "None", value: 0 },
    { label: "At time", value: 0, atTime: true },
    { label: "5 min", value: 5 },
    { label: "15 min", value: 15 },
    { label: "30 min", value: 30 },
    { label: "1 hour", value: 60 },
    { label: "1 day", value: 1440 },
  ];

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
    setIsPublic(item.is_public ?? true);
    setSelectedCategories(item.categories || []);
    setResponsibleUserId(item.responsible_user_id);
    setOriginalResponsibleUserId(item.responsible_user_id);

    // Initialize alert
    if (item.alerts && item.alerts.length > 0) {
      const firstAlert = item.alerts[0];
      if (firstAlert.kind === "relative") {
        setAlertMinutes(firstAlert.offset_minutes || 15);
      } else {
        setAlertMinutes(15);
      }
    } else {
      setAlertMinutes(0);
    }

    // Parse date/time based on item type
    if (item.type === "reminder" || item.type === "task") {
      const dueAt = item.reminder_details?.due_at;
      if (dueAt) {
        const date = parseISO(dueAt);
        setStartDate(format(date, "yyyy-MM-dd"));
        setStartTime(format(date, "HH:mm"));
        setEndDate(format(date, "yyyy-MM-dd"));
        setEndTime(format(date, "HH:mm"));
      }
    } else if (item.type === "event") {
      const startAt = item.event_details?.start_at;
      const endAt = item.event_details?.end_at;
      if (startAt) {
        const start = parseISO(startAt);
        setStartDate(format(start, "yyyy-MM-dd"));
        setStartTime(format(start, "HH:mm"));
      }
      if (endAt) {
        const end = parseISO(endAt);
        setEndDate(format(end, "yyyy-MM-dd"));
        setEndTime(format(end, "HH:mm"));
      }
      setAllDay(item.event_details?.all_day || false);
      setLocation(item.event_details?.location_text || "");
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    // Store original data for undo
    const originalData = {
      id: item.id,
      title: item.title,
      description: item.description,
      priority: item.priority,
      is_public: item.is_public,
      categories: item.categories,
      responsible_user_id: item.responsible_user_id,
    };

    setSaving(true);
    try {
      const supabase = await import("@/lib/supabase/client").then((m) =>
        m.supabaseBrowser()
      );

      // Update base item
      await updateItem.mutateAsync({
        id: item.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        is_public: isPublic,
        categories: selectedCategories,
        responsible_user_id: responsibleUserId,
      });

      // Check if responsible user changed and send notification
      if (
        responsibleUserId &&
        responsibleUserId !== originalResponsibleUserId &&
        householdData?.currentUserId &&
        responsibleUserId !== householdData.currentUserId
      ) {
        await checkAndNotifyAssignment({
          itemId: item.id,
          itemTitle: title.trim(),
          itemType: item.type,
          newResponsibleUserId: responsibleUserId,
          previousResponsibleUserId: originalResponsibleUserId,
          currentUserId: householdData.currentUserId,
          currentUserName: "Me",
        });
      }

      // Update type-specific details
      if (item.type === "reminder" || item.type === "task") {
        if (startDate && startTime) {
          const dueAt = new Date(`${startDate}T${startTime}:00`).toISOString();
          await updateReminderDetails.mutateAsync({
            itemId: item.id,
            due_at: dueAt,
          });
        }
      } else if (item.type === "event") {
        if (startDate && startTime) {
          const startAtIso = allDay
            ? new Date(`${startDate}T00:00:00`).toISOString()
            : new Date(`${startDate}T${startTime}:00`).toISOString();

          let endAtIso: string;
          if (allDay) {
            endAtIso = new Date(`${endDate}T23:59:59`).toISOString();
          } else {
            const startDateTime = new Date(`${startDate}T${startTime}:00`);
            let endDateTime = new Date(`${endDate}T${endTime}:00`);
            if (startDate === endDate && endDateTime <= startDateTime) {
              endDateTime = new Date(
                endDateTime.getTime() + 24 * 60 * 60 * 1000
              );
            }
            endAtIso = endDateTime.toISOString();
          }

          await updateEventDetails.mutateAsync({
            itemId: item.id,
            start_at: startAtIso,
            end_at: endAtIso,
            all_day: allDay,
            location_text: location.trim() || undefined,
          });
        }
      }

      toast.success("Item updated!", {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await updateItem.mutateAsync(originalData);
              toast.success("Update undone");
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
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

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
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

          {/* Start Date & Time */}
          <div className="space-y-2">
            <Label className="text-white/70 flex items-center justify-between">
              <span>{item.type === "event" ? "Start" : "Due Date & Time"}</span>
              {item.type === "event" && (
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-white/50">All day</span>
                </label>
              )}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
              {!allDay && (
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              )}
            </div>
          </div>

          {/* End Date & Time (Events only) */}
          {item.type === "event" && (
            <div className="space-y-2">
              <Label className="text-white/70">End</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
                {!allDay && (
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                )}
              </div>
            </div>
          )}

          {/* Location (Events only) */}
          {item.type === "event" && (
            <div className="space-y-2">
              <Label
                htmlFor="location"
                className="text-white/70 flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Location
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add location"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          )}

          {/* Categories */}
          <div className="space-y-2">
            <Label className="text-white/70 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Categories ({selectedCategories.length})
            </Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategories((prev) =>
                        isSelected
                          ? prev.filter((id) => id !== cat.id)
                          : [...prev, cat.id]
                      );
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isSelected
                        ? "text-white"
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    )}
                    style={{
                      backgroundColor: isSelected
                        ? `${cat.color}40`
                        : undefined,
                      borderColor: isSelected ? `${cat.color}60` : undefined,
                      borderWidth: isSelected ? "1px" : "0",
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alert */}
          <div className="space-y-2">
            <Label className="text-white/70 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Alert
            </Label>
            <div className="flex flex-wrap gap-2">
              {alertPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setAlertMinutes(preset.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    alertMinutes === preset.value
                      ? isPink
                        ? "bg-pink-500/30 border-pink-500/50 text-pink-200"
                        : "bg-cyan-500/30 border-cyan-500/50 text-cyan-200"
                      : "bg-white/5 text-white/50 hover:bg-white/10"
                  )}
                  style={{
                    borderWidth: alertMinutes === preset.value ? "1px" : "0",
                  }}
                >
                  {preset.label}
                </button>
              ))}
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
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1",
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

          {/* Visibility */}
          <div className="space-y-2">
            <Label className="text-white/70 flex items-center gap-2">
              {isPublic ? (
                <Users className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
              Visibility
            </Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsPublic(!isPublic);
                  // Reset responsible user to self when making private
                  if (isPublic && householdData?.currentUserId) {
                    setResponsibleUserId(householdData.currentUserId);
                  }
                }}
                className={cn(
                  "relative w-11 h-6 rounded-full transition-colors",
                  isPublic
                    ? isPink
                      ? "bg-pink-500/50"
                      : "bg-cyan-500/50"
                    : "bg-white/20"
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all",
                    isPublic ? "left-[calc(100%-20px)]" : "left-1"
                  )}
                />
              </button>
              <span className="text-sm text-white/50">
                {isPublic
                  ? "Public (visible to household)"
                  : "Private (only you)"}
              </span>
            </div>
          </div>

          {/* Responsible User */}
          {householdData?.hasPartner && (
            <div className="space-y-2">
              <Label className="text-white/70 flex items-center gap-2">
                <User className="w-4 h-4" />
                Responsible
              </Label>
              <ResponsibleUserPicker
                value={responsibleUserId}
                onChange={(userId) => {
                  setResponsibleUserId(userId);
                  // If assigning to someone else, ensure item is public
                  if (userId !== householdData.currentUserId && !isPublic) {
                    setIsPublic(true);
                  }
                }}
                isPublic={isPublic}
                disabled={!isPublic}
              />
              {isPublic &&
                responsibleUserId &&
                responsibleUserId !== householdData.currentUserId &&
                responsibleUserId !== originalResponsibleUserId && (
                  <p className="text-xs text-pink-300/70">
                    ✨{" "}
                    {
                      householdData.members.find(
                        (m) => m.id === responsibleUserId
                      )?.displayName
                    }{" "}
                    will be notified
                  </p>
                )}
            </div>
          )}
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
