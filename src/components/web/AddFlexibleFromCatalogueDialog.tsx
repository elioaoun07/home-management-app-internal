"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/contexts/ThemeContext";
import { useCatalogueItems, useCatalogueModules } from "@/features/catalogue";
import { useUpdateItem as useUpdateCatalogueItem } from "@/features/catalogue/hooks";
import {
  useFlexibleRoutines,
  useScheduleRoutine,
  useUnscheduleRoutine,
} from "@/features/items/useFlexibleRoutines";
import { useAllOccurrenceActions } from "@/features/items/useItemActions";
import {
  useCreateReminder,
  useCreateTask,
  useDeleteItem,
  useItems,
} from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { CatalogueItem } from "@/types/catalogue";
import type { CreateSubtaskInput } from "@/types/items";
import { addDays, format, isSameDay } from "date-fns";
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Inbox,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface AddFlexibleFromCatalogueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  weekStart: Date;
  weekEnd: Date;
  defaultDate?: Date;
  initialItemId?: string | null;
}

function parseSubtasks(text: string | null | undefined): CreateSubtaskInput[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => ({
      title: line.replace(/^[-*•]\s*|\d+\.\s*/g, "").trim(),
      order_index: index,
    }))
    .filter((s) => s.title.length > 0);
}

export function AddFlexibleFromCatalogueDialog({
  isOpen,
  onClose,
  weekStart,
  weekEnd,
  defaultDate,
  initialItemId,
}: AddFlexibleFromCatalogueDialogProps) {
  const { theme } = useTheme();
  const tc = useThemeClasses();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekNumber = format(weekStart, "w");
  const periodStartStr = format(weekStart, "yyyy-MM-dd");

  const { data: items = [] } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();
  const { data: routines } = useFlexibleRoutines(
    items,
    occurrenceActions,
    weekStart,
  );
  const { data: catalogueModules = [] } = useCatalogueModules();
  const { data: catalogueItemsData = [] } = useCatalogueItems();

  const tasksModuleId = useMemo(
    () => catalogueModules.find((m) => m.type === "tasks")?.id,
    [catalogueModules],
  );

  // Dormant weekly-flexible catalogue templates
  const dormantTemplates = useMemo(() => {
    return catalogueItemsData.filter(
      (it) =>
        it.module_id === tasksModuleId &&
        it.is_flexible_routine === true &&
        it.flexible_period === "weekly" &&
        it.is_active_on_calendar === false,
    );
  }, [catalogueItemsData, tasksModuleId]);

  const unscheduled = routines?.unscheduled ?? [];

  const scheduleRoutine = useScheduleRoutine();
  const unscheduleRoutine = useUnscheduleRoutine();
  const createTask = useCreateTask();
  const createReminder = useCreateReminder();
  const updateCatalogueItem = useUpdateCatalogueItem();
  const deleteItem = useDeleteItem();

  // Per-row state: selected day index (0-6) and time
  const [daySel, setDaySel] = useState<Record<string, number>>({});
  const [timeSel, setTimeSel] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);

  const defaultDayIndex = useMemo(() => {
    if (!defaultDate) return 0;
    const idx = weekDays.findIndex((d) => isSameDay(d, defaultDate));
    return idx >= 0 ? idx : 0;
  }, [defaultDate, weekDays]);

  const getDay = (key: string) => daySel[key] ?? defaultDayIndex;
  const getTime = (key: string, fallback?: string | null) =>
    timeSel[key] ?? fallback ?? "09:00";

  async function handleScheduleExisting(itemId: string) {
    const dayIdx = getDay(`item-${itemId}`);
    const time = getTime(`item-${itemId}`);
    const day = weekDays[dayIdx];
    setPending(`item-${itemId}`);
    try {
      await scheduleRoutine.mutateAsync({
        itemId,
        periodStartDate: periodStartStr,
        scheduledForDate: format(day, "yyyy-MM-dd"),
        scheduledForTime: time || null,
      });
      toast.success(
        `Scheduled for ${format(day, "EEE MMM d")}${time ? ` at ${time}` : ""}`,
        {
          icon: <CheckCircle2 className="w-4 h-4 text-green-400" />,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await unscheduleRoutine.mutateAsync({
                  itemId,
                  periodStartDate: periodStartStr,
                });
                toast.success("Schedule removed", {
                  icon: <Undo2 className="w-4 h-4" />,
                });
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule");
    } finally {
      setPending(null);
    }
  }

  async function handleActivateAndSchedule(template: CatalogueItem) {
    const key = `tpl-${template.id}`;
    const dayIdx = getDay(key);
    const time = getTime(key, template.preferred_time);
    const day = weekDays[dayIdx];
    const dayStr = format(day, "yyyy-MM-dd");
    const weekStartAnchorISO = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate(),
      0,
      0,
      0,
    ).toISOString();

    setPending(key);
    try {
      const itemType: "reminder" | "task" =
        template.item_type === "reminder" ? "reminder" : "task";
      const subtasks = parseSubtasks(template.subtasks_text);
      const priority =
        template.priority === "critical"
          ? "urgent"
          : (template.priority as "low" | "normal" | "high" | "urgent");

      const recurrence_rule = {
        rrule: "RRULE:FREQ=WEEKLY",
        start_anchor: weekStartAnchorISO,
        is_flexible: true,
        flexible_period: "weekly" as const,
      };

      let createdItemId: string | undefined;
      if (itemType === "reminder") {
        const res = await createReminder.mutateAsync({
          type: "reminder",
          title: template.name,
          description: template.description || undefined,
          priority,
          is_public: template.is_public,
          recurrence_rule,
          has_checklist: subtasks.length > 0,
          subtasks,
          source_catalogue_item_id: template.id,
          is_template_instance: true,
        });
        createdItemId = (res as { id?: string } | undefined)?.id;
      } else {
        const res = await createTask.mutateAsync({
          type: "task",
          title: template.name,
          description: template.description || undefined,
          priority,
          is_public: template.is_public,
          recurrence_rule,
          source_catalogue_item_id: template.id,
          is_template_instance: true,
        });
        createdItemId = (res as { id?: string } | undefined)?.id;
      }

      if (!createdItemId) throw new Error("Item creation failed");
      const newItemId = createdItemId;

      await updateCatalogueItem.mutateAsync({
        id: template.id,
        is_active_on_calendar: true,
        linked_item_id: newItemId,
      });

      await scheduleRoutine.mutateAsync({
        itemId: newItemId,
        periodStartDate: periodStartStr,
        scheduledForDate: dayStr,
        scheduledForTime: time || null,
      });

      toast.success(
        `"${template.name}" scheduled for ${format(day, "EEE MMM d")}${time ? ` at ${time}` : ""}`,
        {
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await unscheduleRoutine.mutateAsync({
                  itemId: newItemId,
                  periodStartDate: periodStartStr,
                });
                await updateCatalogueItem.mutateAsync({
                  id: template.id,
                  is_active_on_calendar: false,
                  linked_item_id: null,
                });
                await deleteItem.mutateAsync(newItemId);
                toast.success("Reverted", {
                  icon: <Undo2 className="w-4 h-4" />,
                });
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        },
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add from catalogue",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0",
          tc.bgPage,
          isFrost
            ? "border-indigo-200"
            : isPink
              ? "border-pink-500/30"
              : "border-cyan-500/30",
        )}
      >
        <DialogHeader className="p-4 pb-3 border-b border-white/10">
          <DialogTitle
            className={cn(
              "flex items-center gap-2 text-base",
              isFrost ? "text-slate-900" : "text-white",
            )}
          >
            <CalendarPlus
              className={cn(
                "w-5 h-5",
                isFrost
                  ? "text-indigo-600"
                  : isPink
                    ? "text-pink-400"
                    : "text-cyan-400",
              )}
            />
            Add from Catalogue
          </DialogTitle>
          <div
            className={cn(
              "flex items-center gap-2 mt-1 text-xs",
              isFrost ? "text-slate-500" : "text-white/60",
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Week {weekNumber} · {format(weekStart, "MMM d")} –{" "}
              {format(weekEnd, "MMM d, yyyy")}
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Section A: Unscheduled this week */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3
                  className={cn(
                    "text-sm font-semibold flex items-center gap-1.5",
                    isFrost ? "text-slate-700" : "text-white/80",
                  )}
                >
                  <Inbox className="w-4 h-4" />
                  Unscheduled this week
                </h3>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    isFrost
                      ? "bg-slate-100 text-slate-500"
                      : "bg-white/5 text-white/50",
                  )}
                >
                  {unscheduled.length}
                </span>
              </div>

              {unscheduled.length === 0 ? (
                <p
                  className={cn(
                    "text-xs py-3 text-center rounded-lg",
                    isFrost
                      ? "bg-slate-50 text-slate-400"
                      : "bg-white/[0.02] text-white/40",
                  )}
                >
                  Nothing unscheduled — all flexible routines are placed.
                </p>
              ) : (
                <ul className="space-y-2">
                  {unscheduled.map((item) => {
                    const key = `item-${item.id}`;
                    const initialItemMatch =
                      initialItemId && initialItemId === item.id;
                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "p-3 rounded-xl border",
                          initialItemMatch
                            ? isPink
                              ? "border-pink-400/60 bg-pink-500/10"
                              : "border-cyan-400/60 bg-cyan-500/10"
                            : isFrost
                              ? "border-slate-200 bg-white"
                              : "border-white/10 bg-white/[0.03]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div
                              className={cn(
                                "text-sm font-medium truncate",
                                isFrost ? "text-slate-900" : "text-white",
                              )}
                            >
                              {item.title}
                            </div>
                            {item.subtasks && item.subtasks.length > 0 && (
                              <div
                                className={cn(
                                  "text-[11px] mt-0.5",
                                  isFrost ? "text-slate-500" : "text-white/50",
                                )}
                              >
                                {item.subtasks.length} subtask
                                {item.subtasks.length !== 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider",
                              isFrost
                                ? "bg-amber-100 text-amber-700"
                                : "bg-amber-500/15 text-amber-300",
                            )}
                          >
                            Flexible
                          </span>
                        </div>
                        <DayTimePicker
                          weekDays={weekDays}
                          dayIndex={getDay(key)}
                          time={getTime(key)}
                          onDayChange={(i) =>
                            setDaySel((s) => ({ ...s, [key]: i }))
                          }
                          onTimeChange={(t) =>
                            setTimeSel((s) => ({ ...s, [key]: t }))
                          }
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            type="button"
                            disabled={pending === key}
                            onClick={() => handleScheduleExisting(item.id)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50",
                              isFrost
                                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                : isPink
                                  ? "bg-pink-500/20 text-pink-200 hover:bg-pink-500/30 ring-1 ring-pink-500/40"
                                  : "bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 ring-1 ring-cyan-500/40",
                            )}
                          >
                            {pending === key ? "Scheduling…" : "Schedule"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Section B: From Catalogue (dormant templates) */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3
                  className={cn(
                    "text-sm font-semibold flex items-center gap-1.5",
                    isFrost ? "text-slate-700" : "text-white/80",
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  From Catalogue
                </h3>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    isFrost
                      ? "bg-slate-100 text-slate-500"
                      : "bg-white/5 text-white/50",
                  )}
                >
                  {dormantTemplates.length}
                </span>
              </div>

              {dormantTemplates.length === 0 ? (
                <p
                  className={cn(
                    "text-xs py-3 text-center rounded-lg",
                    isFrost
                      ? "bg-slate-50 text-slate-400"
                      : "bg-white/[0.02] text-white/40",
                  )}
                >
                  No dormant weekly-flexible templates in the Tasks catalogue.
                </p>
              ) : (
                <ul className="space-y-2">
                  {dormantTemplates.map((tpl) => {
                    const key = `tpl-${tpl.id}`;
                    return (
                      <li
                        key={tpl.id}
                        className={cn(
                          "p-3 rounded-xl border",
                          isFrost
                            ? "border-slate-200 bg-white"
                            : "border-white/10 bg-white/[0.03]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div
                              className={cn(
                                "text-sm font-medium truncate",
                                isFrost ? "text-slate-900" : "text-white",
                              )}
                            >
                              {tpl.name}
                            </div>
                            {tpl.description && (
                              <div
                                className={cn(
                                  "text-[11px] mt-0.5 line-clamp-1",
                                  isFrost ? "text-slate-500" : "text-white/50",
                                )}
                              >
                                {tpl.description}
                              </div>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider",
                              isFrost
                                ? "bg-slate-100 text-slate-600"
                                : "bg-white/5 text-white/50",
                            )}
                          >
                            Dormant
                          </span>
                        </div>
                        <DayTimePicker
                          weekDays={weekDays}
                          dayIndex={getDay(key)}
                          time={getTime(key, tpl.preferred_time)}
                          onDayChange={(i) =>
                            setDaySel((s) => ({ ...s, [key]: i }))
                          }
                          onTimeChange={(t) =>
                            setTimeSel((s) => ({ ...s, [key]: t }))
                          }
                        />
                        <div className="flex justify-end mt-2">
                          <button
                            type="button"
                            disabled={pending === key}
                            onClick={() => handleActivateAndSchedule(tpl)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50",
                              isFrost
                                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                : isPink
                                  ? "bg-pink-500/20 text-pink-200 hover:bg-pink-500/30 ring-1 ring-pink-500/40"
                                  : "bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 ring-1 ring-cyan-500/40",
                            )}
                          >
                            {pending === key
                              ? "Adding…"
                              : "Activate & Schedule"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              isFrost
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                : "bg-white/5 text-white/70 hover:bg-white/10",
            )}
          >
            <span className="flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" />
              Close
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper re-exported for default export consumers; primary export above.
export default AddFlexibleFromCatalogueDialog;

interface DayTimePickerProps {
  weekDays: Date[];
  dayIndex: number;
  time: string;
  onDayChange: (index: number) => void;
  onTimeChange: (time: string) => void;
}

function DayTimePicker({
  weekDays,
  dayIndex,
  time,
  onDayChange,
  onTimeChange,
}: DayTimePickerProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        {weekDays.map((d, i) => {
          const selected = i === dayIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayChange(i)}
              className={cn(
                "flex flex-col items-center w-9 h-11 rounded-lg text-[10px] font-medium transition-all",
                selected
                  ? isFrost
                    ? "bg-indigo-600 text-white shadow"
                    : isPink
                      ? "bg-pink-500/30 text-pink-100 ring-1 ring-pink-400/60"
                      : "bg-cyan-500/30 text-cyan-100 ring-1 ring-cyan-400/60"
                  : isFrost
                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    : "bg-white/5 text-white/60 hover:bg-white/10",
              )}
            >
              <span className="uppercase tracking-wider">
                {format(d, "EEE")}
              </span>
              <span className="text-[13px] font-bold leading-none mt-0.5">
                {format(d, "d")}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <Clock
          className={cn(
            "w-3.5 h-3.5",
            isFrost ? "text-slate-400" : "text-white/40",
          )}
        />
        <input
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className={cn(
            "px-2 py-1 rounded-md text-xs border outline-none",
            isFrost
              ? "bg-white border-slate-200 text-slate-700"
              : "bg-white/5 border-white/10 text-white/80",
          )}
        />
      </div>
    </div>
  );
}
