"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateRecurrenceException,
  useUpdateRecurrenceException,
} from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { ItemWithDetails } from "@/types/items";
import { format, isSameDay, parseISO } from "date-fns";
import {
  CalendarClock,
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemWithDetails;
  occurrenceDate: Date;
  onSuccess?: () => void;
}

/**
 * Dialog for editing a single occurrence of a recurring item.
 * Creates a recurrence exception with override data.
 */
export default function EditOccurrenceDialog({
  open,
  onOpenChange,
  item,
  occurrenceDate,
  onSuccess,
}: Props) {
  const themeClasses = useThemeClasses();
  const createException = useCreateRecurrenceException();
  const updateException = useUpdateRecurrenceException();

  // Form state - initialized from item
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newDate, setNewDate] = useState<Date>(occurrenceDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const isLoading = createException.isPending || updateException.isPending;

  // Get the original values from the item
  const originalTitle = item.title;
  const originalDescription = item.description || "";
  const originalLocation =
    item.type === "event" ? item.event_details?.location_text || "" : "";

  // Get original times
  const getOriginalTimes = () => {
    if (item.type === "event" && item.event_details) {
      return {
        start: format(parseISO(item.event_details.start_at), "HH:mm"),
        end: format(parseISO(item.event_details.end_at), "HH:mm"),
      };
    }
    if (item.type === "reminder" && item.reminder_details?.due_at) {
      const time = format(parseISO(item.reminder_details.due_at), "HH:mm");
      return { start: time, end: time };
    }
    return { start: "09:00", end: "10:00" };
  };

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      const times = getOriginalTimes();
      setTitle(originalTitle);
      setDescription(originalDescription);
      setNewDate(occurrenceDate);
      setStartTime(times.start);
      setEndTime(times.end);
      setLocation(originalLocation);
    }
  }, [open, item, occurrenceDate]);

  // Build the exdate ISO string from the occurrence date + original time
  const getExdateIso = () => {
    const originalTimes = getOriginalTimes();
    const [hours, mins] = originalTimes.start.split(":").map(Number);
    const exdate = new Date(occurrenceDate);
    exdate.setHours(hours, mins, 0, 0);
    return exdate.toISOString();
  };

  // Calculate which fields have changed
  const getModifiedFields = () => {
    const modified: string[] = [];
    const originalTimes = getOriginalTimes();

    if (title !== originalTitle) modified.push("title");
    if (description !== originalDescription) modified.push("description");
    if (!isSameDay(newDate, occurrenceDate)) modified.push("rescheduled_date");
    if (startTime !== originalTimes.start) modified.push("start_at");
    if (endTime !== originalTimes.end) modified.push("end_at");
    if (location !== originalLocation) modified.push("location_text");

    return modified;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!item.recurrence_rule) {
      console.error("No recurrence rule found");
      return;
    }

    const modifiedFields = getModifiedFields();

    // If nothing changed, just close
    if (modifiedFields.length === 0) {
      onOpenChange(false);
      return;
    }

    // Use the new date for time fields if rescheduled, otherwise use original date
    const targetDateStr = format(newDate, "yyyy-MM-dd");
    const override_payload_json: Record<string, unknown> = {
      modified_fields: modifiedFields,
    };

    if (modifiedFields.includes("title")) {
      override_payload_json.title = title;
    }
    if (modifiedFields.includes("description")) {
      override_payload_json.description = description;
    }
    // If rescheduled to a different date, store both the new date and update times to new date
    if (modifiedFields.includes("rescheduled_date")) {
      override_payload_json.rescheduled_to = targetDateStr;
      // Always include the times with the new date when rescheduling
      override_payload_json.start_at = `${targetDateStr}T${startTime}:00`;
      override_payload_json.end_at = `${targetDateStr}T${endTime}:00`;
    } else {
      // Not rescheduled, use original occurrence date for times
      const originalDateStr = format(occurrenceDate, "yyyy-MM-dd");
      if (modifiedFields.includes("start_at")) {
        override_payload_json.start_at = `${originalDateStr}T${startTime}:00`;
      }
      if (modifiedFields.includes("end_at")) {
        override_payload_json.end_at = `${originalDateStr}T${endTime}:00`;
      }
    }
    if (modifiedFields.includes("location_text")) {
      override_payload_json.location_text = location;
    }

    try {
      await createException.mutateAsync({
        rule_id: item.recurrence_rule.id,
        exdate: getExdateIso(),
        override_payload_json,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create occurrence exception:", error);
    }
  };

  const formattedDate = format(occurrenceDate, "EEEE, MMMM d, yyyy");
  const formattedNewDate = format(newDate, "EEEE, MMMM d, yyyy");
  const isRescheduled = !isSameDay(newDate, occurrenceDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[95vw] max-w-md mx-auto max-h-[90vh] overflow-y-auto",
          themeClasses.surfaceBg,
          themeClasses.border,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-purple-400" />
            Edit This Occurrence
          </DialogTitle>
          <div className="text-white/60 text-sm">
            <div>{formattedDate}</div>
            {isRescheduled && (
              <div className="text-cyan-400 mt-0.5">→ {formattedNewDate}</div>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-white/80 text-sm">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title..."
              className={cn(
                themeClasses.inputBg,
                "border-white/10 text-white placeholder:text-white/40",
              )}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white/80 text-sm">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes for this occurrence..."
              rows={2}
              className={cn(
                themeClasses.inputBg,
                "border-white/10 text-white placeholder:text-white/40 resize-none",
              )}
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-3 gap-2">
            {/* Date */}
            <div className="space-y-2">
              <Label className="text-white/80 text-sm flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-cyan-400" />
                Date
              </Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-center text-center font-normal h-10 px-2",
                      themeClasses.inputBg,
                      "border-white/10 text-white hover:bg-white/10",
                      isRescheduled && "border-cyan-500/50 text-cyan-300",
                    )}
                  >
                    {format(newDate, "MMM d")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className={cn(
                    "w-auto p-0",
                    themeClasses.surfaceBg,
                    themeClasses.border,
                  )}
                  align="center"
                >
                  <Calendar
                    mode="single"
                    selected={newDate}
                    defaultMonth={newDate}
                    onSelect={(date) => {
                      if (date) {
                        setNewDate(date);
                        setDatePickerOpen(false);
                      }
                    }}
                    initialFocus
                    className="rounded-md"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Start Time */}
            <div className="space-y-2">
              <Label
                htmlFor="startTime"
                className="text-white/80 text-sm flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Start
              </Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white text-center",
                )}
              />
            </div>

            {/* End Time */}
            <div className="space-y-2">
              <Label htmlFor="endTime" className="text-white/80 text-sm">
                End
              </Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white text-center",
                )}
              />
            </div>
          </div>

          {/* Location (for events) */}
          {item.type === "event" && (
            <div className="space-y-2">
              <Label
                htmlFor="location"
                className="text-white/80 text-sm flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-pink-400" />
                Location
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Event location..."
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white placeholder:text-white/40",
                )}
              />
            </div>
          )}

          {/* Info text */}
          <p className="text-xs text-white/40">
            {isRescheduled ? (
              <>
                This occurrence will be moved from {formattedDate} to{" "}
                <span className="text-cyan-400">{formattedNewDate}</span>. The
                rest of the series will remain unchanged.
              </>
            ) : (
              <>
                Changes will only apply to this specific occurrence (
                {formattedDate}). The rest of the series will remain unchanged.
              </>
            )}
          </p>

          <DialogFooter className="pt-2">
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
              disabled={isLoading}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
