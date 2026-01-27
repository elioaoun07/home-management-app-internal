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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUpdateItem } from "@/features/catalogue/hooks";
import {
  useCreateEvent,
  useCreateReminder,
  useCreateTask,
} from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { CatalogueItem, RecurrencePattern } from "@/types/catalogue";
import { RECURRENCE_PATTERN_LABELS } from "@/types/catalogue";
import type { CreateRecurrenceInput, CreateSubtaskInput } from "@/types/items";
import { addDays, format, setHours, setMinutes } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Repeat,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogueItem: CatalogueItem;
  onSuccess?: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

/**
 * Generates an RRULE string from the recurrence pattern and days
 */
function generateRRule(
  pattern: RecurrencePattern,
  daysOfWeek: number[],
  customRrule?: string,
): string {
  if (pattern === "custom" && customRrule) {
    return customRrule;
  }

  switch (pattern) {
    case "daily":
      return "FREQ=DAILY";
    case "weekly":
      if (daysOfWeek.length > 0) {
        const dayMap: Record<number, string> = {
          0: "SU",
          1: "MO",
          2: "TU",
          3: "WE",
          4: "TH",
          5: "FR",
          6: "SA",
        };
        const byDay = daysOfWeek.map((d) => dayMap[d]).join(",");
        return `FREQ=WEEKLY;BYDAY=${byDay}`;
      }
      return "FREQ=WEEKLY";
    case "biweekly":
      if (daysOfWeek.length > 0) {
        const dayMap: Record<number, string> = {
          0: "SU",
          1: "MO",
          2: "TU",
          3: "WE",
          4: "TH",
          5: "FR",
          6: "SA",
        };
        const byDay = daysOfWeek.map((d) => dayMap[d]).join(",");
        return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${byDay}`;
      }
      return "FREQ=WEEKLY;INTERVAL=2";
    case "monthly":
      return "FREQ=MONTHLY";
    case "quarterly":
      return "FREQ=MONTHLY;INTERVAL=3";
    case "yearly":
      return "FREQ=YEARLY";
    default:
      return "";
  }
}

/**
 * Parses subtasks from bullet point text
 */
function parseSubtasks(text: string): CreateSubtaskInput[] {
  if (!text) return [];

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      // Remove leading bullet points, dashes, asterisks, numbers
      const cleanLine = line.replace(/^[-*•]\s*|\d+\.\s*/g, "").trim();
      return {
        title: cleanLine,
        order_index: index,
      };
    })
    .filter((s) => s.title.length > 0);
}

export default function AddToCalendarDialog({
  open,
  onOpenChange,
  catalogueItem,
  onSuccess,
}: Props) {
  const themeClasses = useThemeClasses();
  const createReminder = useCreateReminder();
  const createEvent = useCreateEvent();
  const createTask = useCreateTask();
  const updateCatalogueItem = useUpdateItem();

  // Form state - initialized from catalogue item
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [recurrencePattern, setRecurrencePattern] =
    useState<RecurrencePattern | null>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [locationText, setLocationText] = useState("");

  const isLoading =
    createReminder.isPending ||
    createEvent.isPending ||
    createTask.isPending ||
    updateCatalogueItem.isPending;

  const itemType = catalogueItem.item_type || "task";

  // Initialize form from catalogue item
  useEffect(() => {
    if (open) {
      // Default to tomorrow
      const tomorrow = addDays(new Date(), 1);
      setStartDate(format(tomorrow, "yyyy-MM-dd"));

      // Use preferred time or default to 9 AM
      // Handle both HH:mm and HH:mm:ss formats from database
      const preferredTime = catalogueItem.preferred_time
        ? catalogueItem.preferred_time.substring(0, 5)
        : "09:00";
      setStartTime(preferredTime);

      // Calculate end time based on duration
      if (catalogueItem.preferred_duration_minutes) {
        const [hours, mins] = preferredTime.split(":").map(Number);
        const startDateCalc = setMinutes(
          setHours(new Date(), hours || 9),
          mins || 0,
        );
        const endDateCalc = new Date(
          startDateCalc.getTime() +
            catalogueItem.preferred_duration_minutes * 60000,
        );
        setEndTime(format(endDateCalc, "HH:mm"));
      } else {
        const [hours, mins] = preferredTime.split(":").map(Number);
        setEndTime(
          format(
            setMinutes(setHours(new Date(), (hours || 9) + 1), mins || 0),
            "HH:mm",
          ),
        );
      }

      // Recurrence
      setRecurrencePattern(catalogueItem.recurrence_pattern || null);
      setRecurrenceDays(catalogueItem.recurrence_days_of_week || []);

      // Location
      setLocationText(catalogueItem.location_url || "");

      // End date
      setHasEndDate(false);
      setEndDate("");
    }
  }, [open, catalogueItem]);

  // Parsed subtasks preview
  const parsedSubtasks = useMemo(() => {
    return parseSubtasks(catalogueItem.subtasks_text || "");
  }, [catalogueItem.subtasks_text]);

  const toggleDay = (day: number) => {
    if (recurrenceDays.includes(day)) {
      setRecurrenceDays(recurrenceDays.filter((d) => d !== day));
    } else {
      setRecurrenceDays([...recurrenceDays, day].sort());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !startTime) {
      toast.error("Please set a start date and time");
      return;
    }

    try {
      // Parse and validate date/time - handle both HH:mm and HH:mm:ss formats
      const normalizedStartTime = startTime.substring(0, 5); // Take only HH:mm
      const normalizedEndTime = endTime
        ? endTime.substring(0, 5)
        : normalizedStartTime;

      const startDateTime = new Date(`${startDate}T${normalizedStartTime}:00`);
      if (isNaN(startDateTime.getTime())) {
        toast.error("Invalid start date or time format");
        return;
      }

      const startAt = startDateTime.toISOString();
      const endAt = new Date(
        `${startDate}T${normalizedEndTime}:00`,
      ).toISOString();

      // Build recurrence rule if pattern is set
      let recurrenceRule: CreateRecurrenceInput | undefined;
      if (recurrencePattern) {
        const rrule = generateRRule(
          recurrencePattern,
          recurrenceDays,
          catalogueItem.recurrence_custom_rrule || undefined,
        );

        if (rrule) {
          recurrenceRule = {
            rrule,
            start_anchor: startAt,
            end_until:
              hasEndDate && endDate
                ? new Date(`${endDate}T23:59:59`).toISOString()
                : undefined,
          };
        }
      }

      let createdItemId: string | undefined;

      // Create the appropriate item type
      if (itemType === "event") {
        const result = await createEvent.mutateAsync({
          type: "event",
          title: catalogueItem.name,
          description: catalogueItem.description || undefined,
          priority:
            catalogueItem.priority === "critical"
              ? "urgent"
              : (catalogueItem.priority as any),
          is_public: false,
          start_at: startAt,
          end_at: endAt,
          location_text: locationText || undefined,
          recurrence_rule: recurrenceRule,
        });
        createdItemId = result?.id;
      } else if (itemType === "reminder") {
        const result = await createReminder.mutateAsync({
          type: "reminder",
          title: catalogueItem.name,
          description: catalogueItem.description || undefined,
          priority:
            catalogueItem.priority === "critical"
              ? "urgent"
              : (catalogueItem.priority as any),
          is_public: false,
          due_at: startAt,
          has_checklist: parsedSubtasks.length > 0,
          subtasks: parsedSubtasks,
          recurrence_rule: recurrenceRule,
        });
        createdItemId = result?.id;
      } else {
        // Task
        const result = await createTask.mutateAsync({
          type: "task",
          title: catalogueItem.name,
          description: catalogueItem.description || undefined,
          priority:
            catalogueItem.priority === "critical"
              ? "urgent"
              : (catalogueItem.priority as any),
          is_public: false,
          due_at: startAt,
          recurrence_rule: recurrenceRule,
        });
        createdItemId = result?.id;
      }

      // Update the catalogue item to mark it as active on calendar
      if (createdItemId) {
        await updateCatalogueItem.mutateAsync({
          id: catalogueItem.id,
          is_active_on_calendar: true,
          linked_item_id: createdItemId,
        });
      }

      toast.success("Added to calendar!", {
        description: recurrencePattern
          ? `Recurring ${RECURRENCE_PATTERN_LABELS[recurrencePattern].toLowerCase()}`
          : `Scheduled for ${format(new Date(startAt), "MMM d, yyyy 'at' h:mm a")}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to add to calendar:", error);
      toast.error("Failed to add to calendar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-lg max-h-[90vh] overflow-y-auto",
          themeClasses.surfaceBg,
          themeClasses.border,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-emerald-400" />
            Add to Calendar
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Item Preview */}
          <div className={cn("p-4 rounded-xl", themeClasses.bgHover)}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-white">{catalogueItem.name}</h3>
                {catalogueItem.description && (
                  <p className="text-sm text-white/60 mt-1 line-clamp-2">
                    {catalogueItem.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-white/50">
                  <span className="capitalize">{itemType}</span>
                  {catalogueItem.location_context && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {catalogueItem.location_context === "home"
                        ? "At Home"
                        : "Outside"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Start Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="startDate"
                className="text-white/80 text-sm font-medium flex items-center gap-2"
              >
                <Calendar className="w-4 h-4 text-cyan-400" />
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
                required
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="startTime"
                className="text-white/80 text-sm font-medium flex items-center gap-2"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                Time
              </Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
                required
              />
            </div>
          </div>

          {/* End Time (for events) */}
          {itemType === "event" && (
            <div className="space-y-2">
              <Label
                htmlFor="endTime"
                className="text-white/80 text-sm font-medium"
              >
                End Time
              </Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              />
            </div>
          )}

          {/* Location (for events) */}
          {itemType === "event" && (
            <div className="space-y-2">
              <Label
                htmlFor="location"
                className="text-white/80 text-sm font-medium flex items-center gap-2"
              >
                <MapPin className="w-4 h-4 text-pink-400" />
                Location
              </Label>
              <Input
                id="location"
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Location or Maps URL..."
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white placeholder:text-white/40",
                )}
              />
            </div>
          )}

          {/* Recurrence */}
          <div className="space-y-3">
            <Label className="text-white/80 text-sm font-medium flex items-center gap-2">
              <Repeat className="w-4 h-4 text-emerald-400" />
              Recurrence
            </Label>
            <Select
              value={recurrencePattern || "none"}
              onValueChange={(v) =>
                setRecurrencePattern(
                  v === "none" ? null : (v as RecurrencePattern),
                )
              }
            >
              <SelectTrigger
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white",
                )}
              >
                <SelectValue placeholder="One-time only" />
              </SelectTrigger>
              <SelectContent
                className={cn(themeClasses.surfaceBg, themeClasses.border)}
              >
                <SelectItem value="none" className="text-white/60">
                  One-time only
                </SelectItem>
                {Object.entries(RECURRENCE_PATTERN_LABELS)
                  .filter(([key]) => key !== "custom")
                  .map(([value, label]) => (
                    <SelectItem
                      key={value}
                      value={value}
                      className="text-white"
                    >
                      {label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Days of Week (for weekly) */}
            {recurrencePattern === "weekly" && (
              <div className="space-y-2">
                <Label className="text-white/60 text-xs">Repeat on:</Label>
                <div className="flex gap-1">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = recurrenceDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={cn(
                          "w-9 h-9 rounded-full text-xs font-medium transition-all",
                          isSelected
                            ? "bg-emerald-500 text-white"
                            : "bg-white/5 text-white/60 hover:bg-white/10",
                        )}
                        title={day.label}
                      >
                        {day.short.charAt(0)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* End Date Toggle */}
            {recurrencePattern && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-white/80 text-sm">Set end date?</Label>
                  <Switch
                    checked={hasEndDate}
                    onCheckedChange={setHasEndDate}
                  />
                </div>
                {hasEndDate && (
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className={cn(
                      themeClasses.inputBg,
                      "border-white/10 text-white",
                    )}
                  />
                )}
                {!hasEndDate && recurrencePattern && (
                  <p className="text-xs text-amber-400/80 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    This will repeat forever until you stop it
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Subtasks Preview */}
          {parsedSubtasks.length > 0 && (
            <div className="space-y-2">
              <Label className="text-white/80 text-sm font-medium">
                Subtasks ({parsedSubtasks.length})
              </Label>
              <div className={cn("p-3 rounded-xl", themeClasses.bgHover)}>
                <ul className="space-y-1.5">
                  {parsedSubtasks.slice(0, 5).map((subtask, idx) => (
                    <li
                      key={idx}
                      className="flex items-center gap-2 text-sm text-white/70"
                    >
                      <div className="w-4 h-4 rounded border border-white/20" />
                      {subtask.title}
                    </li>
                  ))}
                  {parsedSubtasks.length > 5 && (
                    <li className="text-xs text-white/50 pl-6">
                      +{parsedSubtasks.length - 5} more...
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="text-white/70 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !startDate || !startTime}
              className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <CalendarClock className="w-4 h-4 mr-2" />
                  Add to Calendar
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
