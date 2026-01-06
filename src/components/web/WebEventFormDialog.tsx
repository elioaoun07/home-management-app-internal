"use client";

import { ResponsibleUserPicker } from "@/components/items/ResponsibleUserPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useCreateEvent,
  useCreateReminder,
  useCreateTask,
  useDeleteItem,
  useUpdateEventDetails,
  useUpdateItem,
  useUpdateReminderDetails,
} from "@/features/items/useItems";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { checkAndNotifyAssignment } from "@/lib/notifications/sendAssignmentNotification";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type {
  CreateAlertInput,
  CreateEventInput,
  CreateRecurrenceInput,
  CreateReminderInput,
  CreateTaskInput,
  ItemPriority,
  ItemType,
  ItemWithDetails,
} from "@/types/items";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  Home,
  Infinity as InfinityIcon,
  ListTodo,
  MapPin,
  Repeat,
  Sparkles,
  Tag,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface WebEventFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
  editItem?: ItemWithDetails | null;
  defaultType?: ItemType;
  prefillTitle?: string;
  prefillCategory?: string;
}

// Priority configuration
const priorityConfig: Record<
  ItemPriority,
  { label: string; color: string; icon: React.ReactNode }
> = {
  low: {
    label: "Low",
    color: "text-gray-400 bg-gray-500/20 border-gray-500/30",
    icon: <span className="text-gray-400">○</span>,
  },
  normal: {
    label: "Normal",
    color: "text-cyan-400 bg-cyan-500/20 border-cyan-500/30",
    icon: <span className="text-cyan-400">◐</span>,
  },
  high: {
    label: "High",
    color: "text-orange-400 bg-orange-500/20 border-orange-500/30",
    icon: <AlertCircle className="w-4 h-4 text-orange-400" />,
  },
  urgent: {
    label: "Urgent",
    color: "text-red-400 bg-red-500/20 border-red-500/30",
    icon: <AlertCircle className="w-4 h-4 text-red-400" />,
  },
};

// Item type configuration
const typeConfig: Record<
  ItemType,
  { label: string; color: string; icon: React.ReactNode }
> = {
  event: {
    label: "Event",
    color: "text-pink-400 bg-pink-500/20 border-pink-500/30",
    icon: <Calendar className="w-4 h-4" />,
  },
  reminder: {
    label: "Reminder",
    color: "text-cyan-400 bg-cyan-500/20 border-cyan-500/30",
    icon: <Bell className="w-4 h-4" />,
  },
  task: {
    label: "Task",
    color: "text-purple-400 bg-purple-500/20 border-purple-500/30",
    icon: <ListTodo className="w-4 h-4" />,
  },
};

// Alert presets
const alertPresets = [
  { label: "None", value: 0 },
  { label: "At time", value: 0, atTime: true },
  { label: "5 min before", value: 5 },
  { label: "15 min before", value: 15 },
  { label: "30 min before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "1 day before", value: 1440 },
];

// Recurrence presets - using iCal RRULE format
const recurrencePresets = [
  { label: "Never", value: "" },
  { label: "Daily", value: "FREQ=DAILY" },
  { label: "Weekdays", value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { label: "Weekly", value: "FREQ=WEEKLY" },
  { label: "Bi-weekly", value: "FREQ=WEEKLY;INTERVAL=2" },
  { label: "Monthly", value: "FREQ=MONTHLY" },
  { label: "Quarterly", value: "FREQ=MONTHLY;INTERVAL=3" },
  { label: "Yearly", value: "FREQ=YEARLY" },
];

// Category configuration
const CATEGORIES = [
  { id: "personal", name: "Personal", color: "#8B5CF6", icon: User },
  { id: "home", name: "Home", color: "#1E90FF", icon: Home },
  { id: "family", name: "Family", color: "#FFA500", icon: Users },
  { id: "community", name: "Community", color: "#22C55E", icon: Heart },
  { id: "friends", name: "Friends", color: "#EC4899", icon: Users },
  { id: "work", name: "Work", color: "#FF3B30", icon: Briefcase },
] as const;

export function WebEventFormDialog({
  isOpen,
  onClose,
  initialDate,
  editItem,
  defaultType = "event",
  prefillTitle,
  prefillCategory,
}: WebEventFormDialogProps) {
  const { theme } = useTheme();
  const themeClasses = useThemeClasses();
  const isPink = theme === "pink";

  // Household members for responsible user picker
  const { data: householdData } = useHouseholdMembers();

  // Form state
  const [itemType, setItemType] = useState<ItemType>(defaultType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ItemPriority>("normal");

  // Common date/time state
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");

  // Alert state
  const [alertMinutes, setAlertMinutes] = useState(15);

  // Recurrence state
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [recurrenceCount, setRecurrenceCount] = useState<number | undefined>(
    undefined
  );
  const [recurrenceForever, setRecurrenceForever] = useState(true);

  // Categories state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "personal",
  ]);

  // Visibility state (default PUBLIC)
  const [isPublic, setIsPublic] = useState(true);

  // Responsible user state
  const [responsibleUserId, setResponsibleUserId] = useState<
    string | undefined
  >(undefined);

  // Mutations
  const createReminder = useCreateReminder();
  const createEvent = useCreateEvent();
  const createTask = useCreateTask();
  const updateItem = useUpdateItem();
  const updateEventDetails = useUpdateEventDetails();
  const updateReminderDetails = useUpdateReminderDetails();
  const deleteItem = useDeleteItem();

  const isEditing = !!editItem;

  // Initialize form when opening or editing
  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        // Edit mode - populate from existing item
        setItemType(editItem.type);
        setTitle(editItem.title);
        setDescription(editItem.description || "");
        setPriority(editItem.priority);
        setIsPublic(editItem.is_public ?? true);
        setResponsibleUserId(
          (editItem.responsible_user_id || householdData?.currentUserId) ?? undefined
        );

        // Initialize categories
        setSelectedCategories(editItem.categories || ["personal"]);

        // Initialize recurrence if exists
        if (editItem.recurrence_rule) {
          setRecurrenceRule(editItem.recurrence_rule.rrule || "");
          if (editItem.recurrence_rule.end_until) {
            setRecurrenceEndDate(
              format(parseISO(editItem.recurrence_rule.end_until), "yyyy-MM-dd")
            );
            setRecurrenceForever(false);
          } else if (editItem.recurrence_rule.count) {
            setRecurrenceCount(editItem.recurrence_rule.count);
            setRecurrenceForever(false);
          } else {
            setRecurrenceForever(true);
          }
        } else {
          setRecurrenceRule("");
          setRecurrenceForever(true);
          setRecurrenceEndDate("");
          setRecurrenceCount(undefined);
        }

        // Initialize alert - check if item has alerts
        if (editItem.alerts && editItem.alerts.length > 0) {
          const firstAlert = editItem.alerts[0];
          if (firstAlert.kind === "relative") {
            setAlertMinutes(firstAlert.offset_minutes || 15);
          } else {
            setAlertMinutes(15); // default
          }
        } else {
          setAlertMinutes(0); // No alert
        }

        if (editItem.type === "event" && editItem.event_details) {
          const start = parseISO(editItem.event_details.start_at);
          const end = parseISO(editItem.event_details.end_at);
          setStartDate(format(start, "yyyy-MM-dd"));
          setStartTime(format(start, "HH:mm"));
          setEndDate(format(end, "yyyy-MM-dd"));
          setEndTime(format(end, "HH:mm"));
          setAllDay(editItem.event_details.all_day);
          setLocation(editItem.event_details.location_text || "");
        } else if (editItem.reminder_details?.due_at) {
          const due = parseISO(editItem.reminder_details.due_at);
          setStartDate(format(due, "yyyy-MM-dd"));
          setStartTime(format(due, "HH:mm"));
          setEndDate(format(due, "yyyy-MM-dd"));
          setEndTime(format(due, "HH:mm"));
        }
      } else {
        // Create mode - reset form
        const date = initialDate || new Date();
        setItemType(defaultType);
        setTitle(prefillTitle || "");
        setDescription("");
        setPriority("normal");
        setStartDate(format(date, "yyyy-MM-dd"));
        setStartTime("09:00");
        setEndDate(format(date, "yyyy-MM-dd"));
        setEndTime("10:00");
        setAllDay(prefillTitle ? true : false);
        setLocation("");
        setAlertMinutes(15);
        setRecurrenceRule("");
        setRecurrenceEndDate("");
        setRecurrenceCount(undefined);
        setRecurrenceForever(true);
        setSelectedCategories(
          prefillCategory ? [prefillCategory] : ["personal"]
        );
        setIsPublic(true);
        setResponsibleUserId(householdData?.currentUserId ?? undefined);
      }
    }
  }, [
    isOpen,
    initialDate,
    editItem,
    defaultType,
    prefillTitle,
    prefillCategory,
    householdData?.currentUserId,
  ]);

  // Auto-update end date when start date changes
  useEffect(() => {
    if (startDate && !endDate) {
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    try {
      if (isEditing && editItem) {
        // Update existing item
        const supabase = await import("@/lib/supabase/client").then((m) =>
          m.supabaseBrowser()
        );

        // Update base fields (title, description, priority, visibility)
        await updateItem.mutateAsync({
          id: editItem.id,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          is_public: isPublic,
          categories: selectedCategories,
        });

        // Update type-specific details
        if (editItem.type === "event") {
          const startAtIso = allDay
            ? new Date(`${startDate}T00:00:00`).toISOString()
            : new Date(`${startDate}T${startTime}:00`).toISOString();

          let endAtIso: string;
          if (allDay) {
            endAtIso = new Date(`${endDate}T23:59:59`).toISOString();
          } else {
            // Check if end time is before start time on the same date
            const startDateTime = new Date(`${startDate}T${startTime}:00`);
            let endDateTime = new Date(`${endDate}T${endTime}:00`);

            // If end is before start and dates are the same, add a day to end
            if (startDate === endDate && endDateTime <= startDateTime) {
              endDateTime = new Date(
                endDateTime.getTime() + 24 * 60 * 60 * 1000
              );
            }

            endAtIso = endDateTime.toISOString();
          }

          await updateEventDetails.mutateAsync({
            itemId: editItem.id,
            start_at: startAtIso,
            end_at: endAtIso,
            all_day: allDay,
            location_text: location.trim() || undefined,
          });

          // Update recurrence rule's start_anchor if it exists
          if (editItem.recurrence_rule) {
            await supabase
              .from("item_recurrence_rules")
              .update({ start_anchor: startAtIso })
              .eq("item_id", editItem.id);
          }
        } else if (editItem.type === "reminder" && editItem.reminder_details) {
          const dueAtIso =
            startDate && startTime
              ? new Date(`${startDate}T${startTime}:00`).toISOString()
              : undefined;

          await updateReminderDetails.mutateAsync({
            itemId: editItem.id,
            due_at: dueAtIso,
          });

          // Update recurrence rule's start_anchor if it exists
          if (editItem.recurrence_rule && dueAtIso) {
            await supabase
              .from("item_recurrence_rules")
              .update({ start_anchor: dueAtIso })
              .eq("item_id", editItem.id);
          }

          // Update alert trigger_at if it exists
          if (dueAtIso) {
            await supabase
              .from("item_alerts")
              .update({ trigger_at: dueAtIso })
              .eq("item_id", editItem.id)
              .eq("kind", "absolute");
          }
        } else if (editItem.type === "task") {
          const dueAtIso =
            startDate && startTime
              ? new Date(`${startDate}T${startTime}:00`).toISOString()
              : undefined;

          await updateReminderDetails.mutateAsync({
            itemId: editItem.id,
            due_at: dueAtIso,
          });

          // Update recurrence rule's start_anchor if it exists
          if (editItem.recurrence_rule && dueAtIso) {
            await supabase
              .from("item_recurrence_rules")
              .update({ start_anchor: dueAtIso })
              .eq("item_id", editItem.id);
          }
        }

        toast.success("Updated successfully!", {
          icon: ToastIcons.create,
          action: {
            label: "Undo",
            onClick: () => {
              // Note: Implement undo edit when we store previous state
              toast.info("Undo edit coming soon");
            },
          },
        });
      } else {
        // Create new item
        const alerts: CreateAlertInput[] = [];
        if (alertMinutes > 0) {
          alerts.push({
            kind: "relative",
            offset_minutes: alertMinutes,
            relative_to: itemType === "event" ? "start" : "due",
            channel: "push",
          });
        }

        if (itemType === "reminder") {
          // Convert local date/time to ISO string (properly handles timezone)
          const dueAtIso =
            startDate && startTime
              ? new Date(`${startDate}T${startTime}:00`).toISOString()
              : undefined;

          const input: CreateReminderInput = {
            type: "reminder",
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            due_at: dueAtIso,
            alerts: alerts.length > 0 ? alerts : undefined,
            category_ids:
              selectedCategories.length > 0 ? selectedCategories : undefined,
            is_public: isPublic,
            responsible_user_id: responsibleUserId,
          };
          const newReminder = await createReminder.mutateAsync(input);

          // Send notification if assigned to someone else
          if (
            responsibleUserId &&
            householdData?.currentUserId &&
            responsibleUserId !== householdData.currentUserId
          ) {
            await checkAndNotifyAssignment({
              itemId: newReminder.id,
              itemTitle: title.trim(),
              itemType: "reminder",
              newResponsibleUserId: responsibleUserId,
              currentUserId: householdData.currentUserId,
              currentUserName: "Me",
            });
          }

          toast.success("Reminder created!", {
            icon: ToastIcons.create,
            action: {
              label: "Undo",
              onClick: async () => {
                try {
                  await deleteItem.mutateAsync(newReminder.id);
                  toast.success("Reminder creation undone");
                } catch (error) {
                  toast.error("Failed to undo");
                }
              },
            },
          });
        } else if (itemType === "event") {
          // Convert local date/time to ISO strings (properly handles timezone)
          const startAtIso = allDay
            ? new Date(`${startDate}T00:00:00`).toISOString()
            : new Date(`${startDate}T${startTime}:00`).toISOString();

          let endAtIso: string;
          if (allDay) {
            endAtIso = new Date(`${endDate}T23:59:59`).toISOString();
          } else {
            // Check if end time is before start time on the same date
            const startDateTime = new Date(`${startDate}T${startTime}:00`);
            let endDateTime = new Date(`${endDate}T${endTime}:00`);

            // If end is before start and dates are the same, add a day to end
            if (startDate === endDate && endDateTime <= startDateTime) {
              endDateTime = new Date(
                endDateTime.getTime() + 24 * 60 * 60 * 1000
              );
            }

            endAtIso = endDateTime.toISOString();
          }

          const endUntilIso = recurrenceEndDate
            ? new Date(`${recurrenceEndDate}T23:59:59`).toISOString()
            : undefined;

          // Build recurrence rule if set
          let recurrence_rule: CreateRecurrenceInput | undefined;
          if (recurrenceRule) {
            recurrence_rule = {
              rrule: recurrenceRule,
              start_anchor: startAtIso,
              end_until: !recurrenceForever ? endUntilIso : undefined,
              count: !recurrenceForever ? recurrenceCount : undefined,
            };
          }

          const input: CreateEventInput = {
            type: "event",
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            start_at: startAtIso,
            end_at: endAtIso,
            all_day: allDay,
            location_text: location.trim() || undefined,
            category_ids:
              selectedCategories.length > 0 ? selectedCategories : undefined,
            alerts: alerts.length > 0 ? alerts : undefined,
            recurrence_rule,
            is_public: isPublic,
            responsible_user_id: responsibleUserId,
          };
          const newEvent = await createEvent.mutateAsync(input);

          // Send notification if assigned to someone else
          if (
            responsibleUserId &&
            householdData?.currentUserId &&
            responsibleUserId !== householdData.currentUserId
          ) {
            await checkAndNotifyAssignment({
              itemId: newEvent.id,
              itemTitle: title.trim(),
              itemType: "event",
              newResponsibleUserId: responsibleUserId,
              currentUserId: householdData.currentUserId,
              currentUserName: "Me",
            });
          }

          toast.success("Event created!", {
            icon: ToastIcons.create,
            action: {
              label: "Undo",
              onClick: async () => {
                try {
                  await deleteItem.mutateAsync(newEvent.id);
                  toast.success("Event creation undone");
                } catch (error) {
                  toast.error("Failed to undo");
                }
              },
            },
          });
        } else if (itemType === "task") {
          // Convert local date/time to ISO string (properly handles timezone)
          const dueAtIso = new Date(
            `${startDate}T${startTime}:00`
          ).toISOString();
          const endUntilIso = recurrenceEndDate
            ? new Date(`${recurrenceEndDate}T23:59:59`).toISOString()
            : undefined;

          // Build recurrence rule if set
          let recurrence_rule: CreateRecurrenceInput | undefined;
          if (recurrenceRule) {
            recurrence_rule = {
              rrule: recurrenceRule,
              start_anchor: dueAtIso,
              end_until: !recurrenceForever ? endUntilIso : undefined,
              count: !recurrenceForever ? recurrenceCount : undefined,
            };
          }

          const input: CreateTaskInput = {
            type: "task",
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            due_at: dueAtIso,
            estimate_minutes: undefined,
            category_ids:
              selectedCategories.length > 0 ? selectedCategories : undefined,
            recurrence_rule,
            is_public: isPublic,
            responsible_user_id: responsibleUserId,
          };
          const newTask = await createTask.mutateAsync(input);

          // Send notification if assigned to someone else
          if (
            responsibleUserId &&
            householdData?.currentUserId &&
            responsibleUserId !== householdData.currentUserId
          ) {
            await checkAndNotifyAssignment({
              itemId: newTask.id,
              itemTitle: title.trim(),
              itemType: "task",
              newResponsibleUserId: responsibleUserId,
              currentUserId: householdData.currentUserId,
              currentUserName: "Me",
            });
          }

          toast.success("Task created!", {
            icon: ToastIcons.create,
            action: {
              label: "Undo",
              onClick: async () => {
                try {
                  await deleteItem.mutateAsync(newTask.id);
                  toast.success("Task creation undone");
                } catch (error) {
                  toast.error("Failed to undo");
                }
              },
            },
          });
        }
      }

      onClose();
    } catch (error) {
      console.error("Failed to save item:", error);
      toast.error("Failed to save", { icon: ToastIcons.error });
    }
  };

  const isPending =
    createReminder.isPending ||
    createEvent.isPending ||
    createTask.isPending ||
    updateItem.isPending ||
    updateEventDetails.isPending ||
    updateReminderDetails.isPending ||
    deleteItem.isPending;

  const handleDelete = async () => {
    if (!editItem) return;

    if (!confirm(`Are you sure you want to delete "${editItem.title}"?`)) {
      return;
    }

    try {
      const itemTitle = editItem.title;
      await deleteItem.mutateAsync(editItem.id);
      toast.success(`"${itemTitle}" deleted`, {
        icon: ToastIcons.delete,
        action: {
          label: "Undo",
          onClick: () => {
            // Note: Implement restore functionality when backend supports it
            toast.info("Undo delete coming soon");
          },
        },
      });
      onClose();
    } catch (error) {
      console.error("Failed to delete item:", error);
      toast.error("Failed to delete", { icon: ToastIcons.error });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "sm:max-w-[600px] neo-card border",
          isPink ? "border-pink-500/30" : "border-cyan-500/30"
        )}
      >
        <DialogHeader>
          <DialogTitle
            className={cn(
              "flex items-center gap-3 text-xl font-bold",
              isPink ? "text-pink-300" : "text-cyan-300"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-xl",
                isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
              )}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            {isEditing ? "Edit Item" : "Create New Item"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto pr-2">
          {/* Item Type Selector */}
          {!isEditing && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-white/80">
                Type
              </Label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(typeConfig) as ItemType[]).map((type) => {
                  const config = typeConfig[type];
                  const isSelected = itemType === type;
                  return (
                    <motion.button
                      key={type}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setItemType(type)}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3.5 rounded-xl border transition-all",
                        isSelected
                          ? cn(config.color, "shadow-lg")
                          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                      )}
                    >
                      {config.icon}
                      <span className="font-semibold">{config.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-white/80">Title</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                itemType === "event"
                  ? "Meeting with team..."
                  : itemType === "reminder"
                    ? "Pay electricity bill..."
                    : "Complete task..."
              }
              className={cn(
                "h-12 text-lg rounded-xl",
                themeClasses.inputBg,
                themeClasses.inputBorder,
                "text-white placeholder:text-white/40",
                "focus:ring-2",
                isPink ? "focus:ring-pink-500/30" : "focus:ring-cyan-500/30"
              )}
            />
          </div>

          {/* Date & Time */}
          <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-white/70">
                Date & Time
              </Label>
              {itemType === "event" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="rounded border-white/20 bg-white/10 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-white/60">All day</span>
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/60">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs">
                    {itemType === "event" ? "Start" : "Due Date"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={cn(
                      "flex-1",
                      themeClasses.inputBg,
                      themeClasses.inputBorder,
                      "text-white"
                    )}
                  />
                  {!allDay && (
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className={cn(
                        "w-32",
                        themeClasses.inputBg,
                        themeClasses.inputBorder,
                        "text-white"
                      )}
                    />
                  )}
                </div>
              </div>

              {itemType === "event" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-white/60">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">End</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={cn(
                        "flex-1",
                        themeClasses.inputBg,
                        themeClasses.inputBorder,
                        "text-white"
                      )}
                    />
                    {!allDay && (
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className={cn(
                          "w-32",
                          themeClasses.inputBg,
                          themeClasses.inputBorder,
                          "text-white"
                        )}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recurrence (Events, Reminders, and Tasks) */}
          {
            <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "p-1.5 rounded-lg",
                    isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                  )}
                >
                  <Repeat
                    className={cn(
                      "w-4 h-4",
                      isPink ? "text-pink-400" : "text-cyan-400"
                    )}
                  />
                </div>
                <Label className="text-sm font-semibold text-white">
                  Repeat
                </Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {recurrencePresets.map((preset) => (
                  <motion.button
                    key={preset.label}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setRecurrenceRule(preset.value)}
                    className={cn(
                      "px-4 py-2 rounded-xl border text-sm font-medium transition-all",
                      recurrenceRule === preset.value
                        ? isPink
                          ? "bg-gradient-to-r from-pink-500/30 to-pink-600/20 border-pink-500/50 text-pink-200 shadow-lg shadow-pink-500/20"
                          : "bg-gradient-to-r from-cyan-500/30 to-cyan-600/20 border-cyan-500/50 text-cyan-200 shadow-lg shadow-cyan-500/20"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:border-white/20"
                    )}
                  >
                    {preset.label}
                  </motion.button>
                ))}
              </div>

              {/* Recurrence end options - only show when recurrence is set */}
              {recurrenceRule && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="pt-3 mt-3 border-t border-white/10 space-y-3"
                >
                  {/* Forever toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <InfinityIcon
                        className={cn(
                          "w-4 h-4",
                          isPink ? "text-pink-400" : "text-cyan-400"
                        )}
                      />
                      <span className="text-sm text-white/80">
                        Repeat forever
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRecurrenceForever(!recurrenceForever);
                        if (!recurrenceForever) {
                          setRecurrenceEndDate("");
                          setRecurrenceCount(undefined);
                        }
                      }}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        recurrenceForever
                          ? isPink
                            ? "bg-gradient-to-r from-pink-500 to-pink-600 shadow-lg shadow-pink-500/30"
                            : "bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-lg shadow-cyan-500/30"
                          : "bg-white/20"
                      )}
                    >
                      <motion.div
                        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
                        animate={{
                          left: recurrenceForever ? "calc(100% - 20px)" : "4px",
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                        }}
                      />
                    </button>
                  </div>

                  {/* End options - only show when not forever */}
                  {!recurrenceForever && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="space-y-2">
                        <Label className="text-xs text-white/50">
                          End by date
                        </Label>
                        <Input
                          type="date"
                          value={recurrenceEndDate}
                          onChange={(e) => {
                            setRecurrenceEndDate(e.target.value);
                            if (e.target.value) setRecurrenceCount(undefined);
                          }}
                          className={cn(
                            themeClasses.inputBg,
                            themeClasses.inputBorder,
                            "text-white"
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-white/50">
                          Or after # times
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={999}
                          value={recurrenceCount ?? ""}
                          onChange={(e) => {
                            const val = e.target.value
                              ? parseInt(e.target.value)
                              : undefined;
                            setRecurrenceCount(val);
                            if (val) setRecurrenceEndDate("");
                          }}
                          placeholder="e.g. 10"
                          className={cn(
                            themeClasses.inputBg,
                            themeClasses.inputBorder,
                            "text-white placeholder:text-white/40"
                          )}
                        />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
          }

          {/* Categories */}
          {
            <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "p-1.5 rounded-lg",
                    isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                  )}
                >
                  <Tag
                    className={cn(
                      "w-4 h-4",
                      isPink ? "text-pink-400" : "text-cyan-400"
                    )}
                  />
                </div>
                <Label className="text-sm font-semibold text-white">
                  Categories
                </Label>
                <span className="text-xs text-white/40 ml-1">
                  ({selectedCategories.length} selected)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((category) => {
                  const isSelected = selectedCategories.includes(category.id);
                  const IconComponent = category.icon;
                  return (
                    <motion.button
                      key={category.id}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedCategories((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== category.id)
                            : [...prev, category.id]
                        );
                      }}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-xl border transition-all",
                        isSelected
                          ? "border-opacity-50 shadow-lg"
                          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                      )}
                      style={{
                        backgroundColor: isSelected
                          ? `${category.color}20`
                          : undefined,
                        borderColor: isSelected
                          ? `${category.color}50`
                          : undefined,
                        color: isSelected ? category.color : undefined,
                        boxShadow: isSelected
                          ? `0 4px 15px ${category.color}20`
                          : undefined,
                      }}
                    >
                      <IconComponent className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {category.name}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          }

          {/* Priority */}
          <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "p-1.5 rounded-lg",
                  isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                )}
              >
                <AlertCircle
                  className={cn(
                    "w-4 h-4",
                    isPink ? "text-pink-400" : "text-cyan-400"
                  )}
                />
              </div>
              <Label className="text-sm font-semibold text-white">
                Priority
              </Label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(priorityConfig) as ItemPriority[]).map((p) => {
                const config = priorityConfig[p];
                const isSelected = priority === p;
                return (
                  <motion.button
                    key={p}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setPriority(p)}
                    className={cn(
                      "flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all",
                      isSelected
                        ? cn(config.color, "shadow-lg")
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    {config.icon}
                    <span className="text-sm font-medium">{config.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Alert */}
          {
            <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "p-1.5 rounded-lg",
                    isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                  )}
                >
                  <Bell
                    className={cn(
                      "w-4 h-4",
                      isPink ? "text-pink-400" : "text-cyan-400"
                    )}
                  />
                </div>
                <Label className="text-sm font-semibold text-white">
                  Alert
                </Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {alertPresets.map((preset) => (
                  <motion.button
                    key={preset.label}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setAlertMinutes(preset.value)}
                    className={cn(
                      "px-4 py-2 rounded-xl border text-sm font-medium transition-all",
                      alertMinutes === preset.value
                        ? isPink
                          ? "bg-gradient-to-r from-pink-500/30 to-pink-600/20 border-pink-500/50 text-pink-200 shadow-lg shadow-pink-500/20"
                          : "bg-gradient-to-r from-cyan-500/30 to-cyan-600/20 border-cyan-500/50 text-cyan-200 shadow-lg shadow-cyan-500/20"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:border-white/20"
                    )}
                  >
                    {preset.label}
                  </motion.button>
                ))}
              </div>
            </div>
          }

          {/* Location (Events only) */}
          {itemType === "event" && (
            <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "p-1.5 rounded-lg",
                    isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                  )}
                >
                  <MapPin
                    className={cn(
                      "w-4 h-4",
                      isPink ? "text-pink-400" : "text-cyan-400"
                    )}
                  />
                </div>
                <Label className="text-sm font-semibold text-white">
                  Location
                </Label>
              </div>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add location..."
                className={cn(
                  "rounded-xl",
                  themeClasses.inputBg,
                  themeClasses.inputBorder,
                  "text-white placeholder:text-white/40"
                )}
              />
            </div>
          )}

          {/* Visibility (Public/Private) */}
          <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "p-1.5 rounded-lg",
                    isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                  )}
                >
                  {isPublic ? (
                    <Users
                      className={cn(
                        "w-4 h-4",
                        isPink ? "text-pink-400" : "text-cyan-400"
                      )}
                    />
                  ) : (
                    <User
                      className={cn(
                        "w-4 h-4",
                        isPink ? "text-pink-400" : "text-cyan-400"
                      )}
                    />
                  )}
                </div>
                <Label className="text-sm font-semibold text-white">
                  Visibility
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-white/50">
                  {isPublic ? "Public" : "Private"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors",
                    isPublic
                      ? isPink
                        ? "bg-pink-500/50"
                        : "bg-cyan-500/50"
                      : "bg-white/20"
                  )}
                >
                  <motion.div
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
                    animate={{
                      left: isPublic ? "calc(100% - 20px)" : "4px",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                </button>
              </div>
            </div>
            <p className="text-xs text-white/40">
              {isPublic
                ? "Visible to all household members"
                : "Only visible to you"}
            </p>
          </div>

          {/* Responsible User Picker */}
          {householdData?.hasPartner && (
            <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "p-1.5 rounded-lg",
                    isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                  )}
                >
                  <User
                    className={cn(
                      "w-4 h-4",
                      isPink ? "text-pink-400" : "text-cyan-400"
                    )}
                  />
                </div>
                <Label className="text-sm font-semibold text-white">
                  Responsible
                </Label>
              </div>
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
                responsibleUserId !== householdData.currentUserId && (
                  <p className="text-xs text-pink-300/70 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {
                      householdData.members.find(
                        (m) => m.id === responsibleUserId
                      )?.displayName
                    }{" "}
                    will be notified
                  </p>
                )}
              {!isPublic && (
                <p className="text-xs text-white/40">
                  Make item public to assign to your partner
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "p-1.5 rounded-lg",
                  isPink ? "bg-pink-500/20" : "bg-cyan-500/20"
                )}
              >
                <Sparkles
                  className={cn(
                    "w-4 h-4",
                    isPink ? "text-pink-400" : "text-cyan-400"
                  )}
                />
              </div>
              <Label className="text-sm font-semibold text-white">
                Description
              </Label>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes or details..."
              rows={3}
              className={cn(
                "rounded-xl",
                themeClasses.inputBg,
                themeClasses.inputBorder,
                "text-white placeholder:text-white/40 resize-none"
              )}
            />
          </div>
        </div>

        <DialogFooter className="gap-3 pt-2 border-t border-white/10">
          {isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={isPending}
              className="mr-auto border-red-500/30 text-red-400 hover:bg-red-500/10 px-6"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-white/20 text-white/70 hover:bg-white/10 px-6"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !title.trim()}
            className={cn(
              "neo-gradient text-white px-8 shadow-lg",
              isPink ? "shadow-pink-500/20" : "shadow-cyan-500/20",
              isPending && "opacity-50 cursor-not-allowed"
            )}
          >
            {isPending ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full"
                />
                {isEditing ? "Saving..." : "Creating..."}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {isEditing ? "Save Changes" : "Create"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
