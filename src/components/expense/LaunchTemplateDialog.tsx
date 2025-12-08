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
import type { ReminderTemplate } from "@/types/items";
import { addMinutes, format, parse } from "date-fns";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface LaunchTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ReminderTemplate | null;
  onLaunch: (
    templateId: string,
    startAt: string,
    durationMinutes?: number
  ) => Promise<void>;
}

export default function LaunchTemplateDialog({
  open,
  onOpenChange,
  template,
  onLaunch,
}: LaunchTemplateDialogProps) {
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [launching, setLaunching] = useState(false);

  // Reset form when template changes
  useEffect(() => {
    if (!open || !template) return;

    const now = new Date();
    setStartDate(format(now, "yyyy-MM-dd"));

    // Use default start time if available, otherwise use current time rounded to next 30 min
    if (template.default_start_time) {
      setStartTime(template.default_start_time);
    } else {
      const minutes = now.getMinutes();
      const roundedMinutes = Math.ceil(minutes / 30) * 30;
      const roundedTime = new Date(now);
      roundedTime.setMinutes(roundedMinutes);
      roundedTime.setSeconds(0);
      setStartTime(format(roundedTime, "HH:mm"));
    }

    // Use default duration if available
    setDurationMinutes(template.default_duration_minutes?.toString() || "60");
  }, [open, template]);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template || !startDate || !startTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLaunching(true);
    try {
      // Ensure startTime is in HH:mm format (remove seconds if present)
      const timeOnly = startTime.substring(0, 5);
      const startAt = `${startDate}T${timeOnly}:00`;
      const duration = durationMinutes ? parseInt(durationMinutes) : undefined;
      await onLaunch(template.id, startAt, duration);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to launch template";
      toast.error(msg);
    } finally {
      setLaunching(false);
    }
  };

  // Calculate end time for display
  const getEndTime = () => {
    if (!startDate || !startTime || !durationMinutes) return "";
    try {
      // Ensure time is in HH:mm format
      const timeOnly = startTime.substring(0, 5);
      const start = parse(
        `${startDate} ${timeOnly}`,
        "yyyy-MM-dd HH:mm",
        new Date()
      );
      const end = addMinutes(start, parseInt(durationMinutes));
      return format(end, "HH:mm");
    } catch {
      return "";
    }
  };

  if (!template) return null;

  const endTime = getEndTime();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            Launch: {template.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleLaunch} className="space-y-4">
          {/* Template Info */}
          <div className="neo-card p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Task Title</span>
              <span className="font-medium">{template.title}</span>
            </div>
            {template.description && (
              <div className="flex items-start justify-between">
                <span className="text-sm text-muted-foreground">
                  Description
                </span>
                <span className="text-sm text-right max-w-[60%]">
                  {template.description}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <span className="capitalize">{template.item_type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Priority</span>
              <span className="capitalize">{template.priority}</span>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          {/* Start Time */}
          <div>
            <Label>Start Time</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          {/* Duration */}
          <div>
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="60"
              min="1"
              className="mt-1"
            />
            {endTime && (
              <p className="text-xs text-muted-foreground mt-1">
                Will end at approximately {endTime}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={launching}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={launching || !startDate || !startTime}
              className="neo-gradient"
            >
              {launching ? "Launching..." : "Launch Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
