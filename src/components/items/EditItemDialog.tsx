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
  useCreatePause,
  useDeletePause,
  useItemPauses,
  useUpdateEventDetails,
  useUpdateItem,
  useUpdateRecurrenceRule,
  useUpdateReminderDetails,
} from "@/features/items/useItems";
import { useNfcTags } from "@/features/nfc/hooks";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { checkAndNotifyAssignment } from "@/lib/notifications/sendAssignmentNotification";
import { safeFetch } from "@/lib/safeFetch";
import { cn } from "@/lib/utils";
import type { ItemPriority, ItemWithDetails } from "@/types/items";
import type {
  CreatePrerequisiteInput,
  ItemPrerequisite,
} from "@/types/prerequisites";
import { format, parseISO } from "date-fns";
import { buildFullRRuleString, localToISO } from "@/lib/utils/date";
import {
  Bell,
  MapPin,
  Nfc,
  PauseCircle,
  PlayCircle,
  Repeat,
  Sparkles,
  Tag,
  Trash2,
  User,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CustomRecurrencePicker,
  describeRRule,
} from "./CustomRecurrencePicker";
import { PrerequisitePicker } from "./PrerequisitePicker";
import { ResponsibleUserPicker } from "./ResponsibleUserPicker";
import { SmartAlertPicker, type SmartAlertValue } from "./SmartAlertPicker";

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
  const [alertValue, setAlertValue] = useState<SmartAlertValue>({
    offsetMinutes: 0,
    customTime: null,
  });
  const [saving, setSaving] = useState(false);
  const [responsibleUserId, setResponsibleUserId] = useState<
    string | undefined
  >(undefined);
  const [notifyAllHousehold, setNotifyAllHousehold] = useState(false);
  const [originalResponsibleUserId, setOriginalResponsibleUserId] = useState<
    string | undefined
  >(undefined);
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [customRecurrenceOpen, setCustomRecurrenceOpen] = useState(false);

  // Recurrence pause state
  const [showPauseForm, setShowPauseForm] = useState(false);
  const [pauseStart, setPauseStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pauseEnd, setPauseEnd] = useState("");
  const [pauseReason, setPauseReason] = useState("");

  // Prerequisites
  const [existingPrerequisites, setExistingPrerequisites] = useState<
    ItemPrerequisite[]
  >([]);
  const [newPrerequisites, setNewPrerequisites] = useState<
    CreatePrerequisiteInput[]
  >([]);
  const { data: nfcTags = [] } = useNfcTags();

  // Fetch existing prerequisites when item changes
  useEffect(() => {
    if (!item?.id) {
      setExistingPrerequisites([]);
      setNewPrerequisites([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/items/${item.id}/prerequisites`);
        if (res.ok && !cancelled) {
          setExistingPrerequisites(await res.json());
        }
      } catch {
        // Ignore fetch errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  const removeExistingPrerequisite = useCallback(
    async (prereqId: string) => {
      if (!item) return;
      try {
        const res = await safeFetch(
          `/api/items/${item.id}/prerequisites?prerequisiteId=${prereqId}`,
          { method: "DELETE" },
        );
        if (res.ok) {
          setExistingPrerequisites((prev) =>
            prev.filter((p) => p.id !== prereqId),
          );
          toast.success("Prerequisite removed");
        }
      } catch {
        toast.error("Failed to remove prerequisite");
      }
    },
    [item],
  );

  const addNewPrerequisite = useCallback(
    async (prereq: CreatePrerequisiteInput) => {
      if (!item) return;
      try {
        const res = await safeFetch(`/api/items/${item.id}/prerequisites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prereq),
        });
        if (res.ok) {
          const created = await res.json();
          setExistingPrerequisites((prev) => [...prev, created]);
          toast.success("Prerequisite added");
        }
      } catch {
        toast.error("Failed to add prerequisite");
      }
    },
    [item],
  );

  // Category options
  const CATEGORIES = [
    { id: "personal", name: "Personal", color: "#8B5CF6" },
    { id: "home", name: "Home", color: "#1E90FF" },
    { id: "family", name: "Family", color: "#FFA500" },
    { id: "community", name: "Community", color: "#22C55E" },
    { id: "friends", name: "Friends", color: "#EC4899" },
    { id: "work", name: "Work", color: "#FF3B30" },
  ];

  // Mutations
  const updateItem = useUpdateItem();
  const updateReminderDetails = useUpdateReminderDetails();
  const updateEventDetails = useUpdateEventDetails();
  const updateRecurrenceRule = useUpdateRecurrenceRule();
  const { data: pauses = [] } = useItemPauses(item?.id);
  const createPause = useCreatePause();
  const deletePause = useDeletePause();

  const today = format(new Date(), "yyyy-MM-dd");
  const activePause = pauses.find(
    (p) => p.pause_start <= today && (p.pause_end === null || p.pause_end >= today),
  );

  // Initialize form when item changes
  useEffect(() => {
    if (!item) return;

    setTitle(item.title);
    setDescription(item.description || "");
    setPriority(item.priority);
    setIsPublic(item.is_public ?? true);
    setSelectedCategories(item.categories || []);
    setResponsibleUserId(item.responsible_user_id);
    setNotifyAllHousehold(item.notify_all_household ?? false);
    setOriginalResponsibleUserId(item.responsible_user_id);

    // Initialize alert
    if (item.alerts && item.alerts.length > 0) {
      const firstAlert = item.alerts[0];
      if (firstAlert.kind === "relative") {
        setAlertValue({
          offsetMinutes: firstAlert.offset_minutes || 0,
          customTime: firstAlert.custom_time || null,
        });
      } else {
        // absolute alert fires at event time — treat as "At time"
        setAlertValue({ offsetMinutes: 0, customTime: null });
      }
    } else {
      setAlertValue({ offsetMinutes: 0, customTime: null });
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

    // Initialize recurrence rule
    setRecurrenceRule(item.recurrence_rule?.rrule || "");
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
      notify_all_household: item.notify_all_household,
    };

    setSaving(true);
    try {
      const supabase = await import("@/lib/supabase/client").then((m) =>
        m.supabaseBrowser(),
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
        notify_all_household: notifyAllHousehold,
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
          const dueAt = localToISO(startDate, startTime);
          await updateReminderDetails.mutateAsync({
            itemId: item.id,
            due_at: dueAt,
          });
        }
      } else if (item.type === "event") {
        if (startDate && startTime) {
          const startAtIso = allDay
            ? localToISO(startDate, "00:00")
            : localToISO(startDate, startTime);

          let endAtIso: string;
          if (allDay) {
            endAtIso = localToISO(endDate, "23:59");
          } else {
            const startDateTime = new Date(`${startDate}T${startTime}:00`);
            let endDateTime = new Date(`${endDate}T${endTime}:00`);
            if (startDate === endDate && endDateTime <= startDateTime) {
              endDateTime = new Date(
                endDateTime.getTime() + 24 * 60 * 60 * 1000,
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

      // Update recurrence rule if changed (for reminders, events, and tasks)
      if (
        item.type === "reminder" ||
        item.type === "event" ||
        item.type === "task"
      ) {
        const originalRrule = item.recurrence_rule?.rrule || "";
        if (recurrenceRule !== originalRrule) {
          const startAnchor =
            startDate && startTime
              ? localToISO(startDate, startTime)
              : new Date().toISOString();

          await updateRecurrenceRule.mutateAsync({
            itemId: item.id,
            rrule: recurrenceRule || null,
            start_anchor: startAnchor,
          });
        }
      }

      // Upsert alert
      {
        const enableAlert =
          alertValue.offsetMinutes > 0 || Boolean(alertValue.customTime);
        const originalAlert = item.alerts?.[0];
        const alertChanged = !originalAlert
          ? enableAlert
          : originalAlert.offset_minutes !== alertValue.offsetMinutes ||
            ((originalAlert as unknown as Record<string, unknown>)
              .custom_time ?? null) !== alertValue.customTime;

        if (alertChanged) {
          await supabase
            .from("item_alerts")
            .delete()
            .eq("item_id", item.id)
            .eq("kind", "relative");

          if (enableAlert) {
            let triggerAt: string | null = null;
            const rule = item.recurrence_rule;
            if (rule) {
              const { RRule } = await import("rrule");
              const anchor = new Date(rule.start_anchor);
              const rruleStr = buildFullRRuleString(anchor, rule);
              const nextOcc = RRule.fromString(rruleStr).after(
                new Date(),
                true,
              );
              if (nextOcc) {
                if (alertValue.customTime) {
                  const days = Math.floor(
                    (alertValue.offsetMinutes || 0) / 1440,
                  );
                  const alertDate = new Date(nextOcc);
                  alertDate.setDate(alertDate.getDate() - days);
                  const [h, m] = alertValue.customTime.split(":").map(Number);
                  alertDate.setHours(h, m, 0, 0);
                  triggerAt = alertDate.toISOString();
                } else {
                  triggerAt = new Date(
                    nextOcc.getTime() - alertValue.offsetMinutes * 60 * 1000,
                  ).toISOString();
                }
              }
            } else {
              const baseTimeStr =
                item.event_details?.start_at ??
                item.reminder_details?.due_at ??
                null;
              if (baseTimeStr) {
                triggerAt = new Date(
                  new Date(baseTimeStr).getTime() -
                    alertValue.offsetMinutes * 60 * 1000,
                ).toISOString();
              }
            }

            const alertRow: Record<string, unknown> = {
              item_id: item.id,
              kind: "relative",
              offset_minutes: alertValue.offsetMinutes || null,
              relative_to: item.type === "event" ? "start" : "due",
              trigger_at: triggerAt,
              channel: "push",
              active: true,
            };
            if (alertValue.customTime) {
              alertRow.custom_time = alertValue.customTime;
            }
            await supabase.from("item_alerts").insert(alertRow);
          }
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
            : "bg-gray-900 border-cyan-500/30",
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

          {/* Alert */}
          <div className="space-y-2">
            <Label className="text-white/70 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Alert
            </Label>
            <SmartAlertPicker
              value={alertValue}
              onChange={setAlertValue}
              eventTime={startTime}
            />
          </div>

          {/* Recurrence - for events, reminders, and tasks */}
          {(item.type === "event" ||
            item.type === "reminder" ||
            item.type === "task") && (
            <div className="space-y-2">
              <Label className="text-white/70 flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Repeat
              </Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Never", value: "" },
                  { label: "Daily", value: "FREQ=DAILY" },
                  { label: "Weekly", value: "FREQ=WEEKLY" },
                  { label: "Monthly", value: "FREQ=MONTHLY" },
                  { label: "Yearly", value: "FREQ=YEARLY" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setRecurrenceRule(preset.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      recurrenceRule === preset.value
                        ? isPink
                          ? "bg-pink-500/30 text-pink-300 border border-pink-400/50"
                          : "bg-cyan-500/30 text-cyan-300 border border-cyan-400/50"
                        : "bg-white/5 text-white/50 hover:bg-white/10",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomRecurrenceOpen(true)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    recurrenceRule &&
                      ![
                        "",
                        "FREQ=DAILY",
                        "FREQ=WEEKLY",
                        "FREQ=MONTHLY",
                        "FREQ=YEARLY",
                      ].includes(recurrenceRule)
                      ? isPink
                        ? "bg-pink-500/30 text-pink-300 border border-pink-400/50"
                        : "bg-cyan-500/30 text-cyan-300 border border-cyan-400/50"
                      : "bg-white/5 text-white/50 hover:bg-white/10",
                  )}
                >
                  Custom...
                </button>
              </div>
              {recurrenceRule &&
                ![
                  "",
                  "FREQ=DAILY",
                  "FREQ=WEEKLY",
                  "FREQ=MONTHLY",
                  "FREQ=YEARLY",
                ].includes(recurrenceRule) && (
                  <p
                    className={cn(
                      "text-xs mt-1",
                      isPink ? "text-pink-300/80" : "text-cyan-300/80",
                    )}
                  >
                    {describeRRule(recurrenceRule)}
                  </p>
                )}
              <CustomRecurrencePicker
                open={customRecurrenceOpen}
                onOpenChange={setCustomRecurrenceOpen}
                value={recurrenceRule}
                onChange={setRecurrenceRule}
                referenceDate={
                  startDate ? new Date(`${startDate}T12:00:00`) : new Date()
                }
              />

              {/* Recurrence Pause */}
              {recurrenceRule && (
                <div className="mt-3 space-y-2">
                  {activePause ? (
                    <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <PauseCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-amber-300">
                            Paused
                            {activePause.pause_end
                              ? ` until ${activePause.pause_end}`
                              : " indefinitely"}
                          </p>
                          {activePause.reason && (
                            <p className="text-xs text-white/50">
                              {activePause.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          deletePause.mutate(
                            { itemId: item!.id, pauseId: activePause.id },
                            {
                              onSuccess: () => toast.success("Recurrence resumed", {
                                duration: 4000,
                                action: { label: "Undo", onClick: () => createPause.mutate({ itemId: item!.id, input: { pause_start: activePause.pause_start, pause_end: activePause.pause_end, reason: activePause.reason } }) },
                              }),
                            },
                          );
                        }}
                        disabled={deletePause.isPending}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        Resume
                      </button>
                    </div>
                  ) : showPauseForm ? (
                    <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-3">
                      <p className="text-xs font-medium text-white/70 flex items-center gap-1">
                        <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                        Pause recurrence
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-white/50">
                            Pause from
                          </label>
                          <input
                            type="date"
                            value={pauseStart}
                            onChange={(e) => setPauseStart(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/50">
                            Resume on (optional)
                          </label>
                          <input
                            type="date"
                            value={pauseEnd}
                            min={pauseStart}
                            onChange={(e) => setPauseEnd(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={pauseReason}
                        onChange={(e) => setPauseReason(e.target.value)}
                        placeholder='Label, e.g. "Summer break", "Travelling"'
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/30"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPauseForm(false)}
                          className="flex-1 px-3 py-1.5 rounded text-xs text-white/50 hover:text-white hover:bg-white/5"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!pauseStart || createPause.isPending}
                          onClick={() => {
                            createPause.mutate(
                              {
                                itemId: item!.id,
                                input: {
                                  pause_start: pauseStart,
                                  pause_end: pauseEnd || null,
                                  reason: pauseReason || null,
                                },
                              },
                              {
                                onSuccess: () => {
                                  setShowPauseForm(false);
                                  setPauseReason("");
                                  setPauseEnd("");
                                  toast.success("Recurrence paused", {
                                    duration: 4000,
                                    action: {
                                      label: "Undo",
                                      onClick: () => {
                                        const latest = pauses[pauses.length - 1];
                                        if (latest) deletePause.mutate({ itemId: item!.id, pauseId: latest.id });
                                      },
                                    },
                                  });
                                },
                                onError: () => toast.error("Failed to pause recurrence"),
                              },
                            );
                          }}
                          className="flex-1 px-3 py-1.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-40"
                        >
                          {createPause.isPending ? "Pausing…" : "Pause"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPauseStart(format(new Date(), "yyyy-MM-dd"));
                        setPauseEnd("");
                        setPauseReason("");
                        setShowPauseForm(true);
                      }}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-amber-400 transition-colors"
                    >
                      <PauseCircle className="w-3.5 h-3.5" />
                      Pause recurrence
                    </button>
                  )}
                </div>
              )}
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
                          : [...prev, cat.id],
                      );
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isSelected
                        ? "text-white"
                        : "bg-white/5 text-white/50 hover:bg-white/10",
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
                      : "bg-white/5 text-white/50 hover:bg-white/10",
                  )}
                >
                  {p.label}
                </button>
              ))}
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
                notifyAllHousehold={notifyAllHousehold}
                onChange={(userId, allHousehold) => {
                  setResponsibleUserId(userId);
                  setNotifyAllHousehold(allHousehold);
                  // If assigning to someone else or all household, ensure item is public
                  if (
                    (allHousehold || userId !== householdData.currentUserId) &&
                    !isPublic
                  ) {
                    setIsPublic(true);
                  }
                }}
                isPublic={isPublic}
                disabled={!isPublic}
              />
              {isPublic && notifyAllHousehold && (
                <p className="text-xs text-amber-300/70">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Both
                    household members will be notified
                  </span>
                </p>
              )}
              {isPublic &&
                !notifyAllHousehold &&
                responsibleUserId &&
                responsibleUserId !== householdData.currentUserId &&
                responsibleUserId !== originalResponsibleUserId && (
                  <p className="text-xs text-pink-300/70">
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    </span>{" "}
                    {
                      householdData.members.find(
                        (m) => m.id === responsibleUserId,
                      )?.displayName
                    }{" "}
                    will be notified
                  </p>
                )}
            </div>
          )}

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
                    : "bg-white/20",
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all",
                    isPublic ? "left-[calc(100%-20px)]" : "left-1",
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

          {/* Prerequisites (Trigger Conditions) */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white/70">
              <Zap className="w-4 h-4" />
              <span>
                Trigger Conditions{" "}
                {existingPrerequisites.length > 0 && (
                  <span className="text-white/40">
                    ({existingPrerequisites.length})
                  </span>
                )}
              </span>
            </div>

            {existingPrerequisites.map((prereq) => {
              const config = prereq.condition_config as unknown as Record<
                string,
                unknown
              >;
              const tagName =
                prereq.condition_type === "nfc_state_change"
                  ? (nfcTags.find((t) => t.id === config.tag_id)?.label ??
                    "Unknown tag")
                  : prereq.condition_type;

              return (
                <div
                  key={prereq.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Nfc className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-white/80">{tagName}</span>
                    <span className="text-white/40">→</span>
                    <span className="text-amber-300/80">
                      {(config.target_state as string) ?? "?"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExistingPrerequisite(prereq.id)}
                    className="p-1 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            <PrerequisitePicker
              value={newPrerequisites}
              onChange={(prereqs) => {
                if (prereqs.length > newPrerequisites.length) {
                  const latest = prereqs[prereqs.length - 1];
                  addNewPrerequisite(latest);
                  return;
                }
                setNewPrerequisites(prereqs);
              }}
              compact
            />

            {(existingPrerequisites.length > 0 ||
              newPrerequisites.length > 0) && (
              <p className="text-xs text-amber-300/60">
                Item is dormant — activates when conditions are met.
              </p>
            )}
          </div>

          {/* Description / Notes */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-white/70">
              Notes
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes (optional)"
              className="bg-white/5 border-white/10 text-white resize-none"
              rows={3}
            />
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
                : "bg-cyan-500 hover:bg-cyan-600",
            )}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
