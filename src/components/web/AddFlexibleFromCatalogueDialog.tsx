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
  formatPeriodLabel,
  getPeriodBoundaries,
  useFlexibleRoutines,
  useScheduleRoutine,
  useUnscheduleRoutine,
  type FlexibleRoutineItem,
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
import type { FlexiblePeriod } from "@/types/items";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_ORDER: FlexiblePeriod[] = ["weekly", "biweekly", "monthly"];

const PERIOD_LABELS: Record<FlexiblePeriod, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

const PERIOD_RRULE: Record<FlexiblePeriod, string> = {
  weekly: "RRULE:FREQ=WEEKLY",
  biweekly: "RRULE:FREQ=WEEKLY;INTERVAL=2",
  monthly: "RRULE:FREQ=MONTHLY",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type UnscheduledEntry =
  | { kind: "existing"; item: FlexibleRoutineItem }
  | { kind: "dormant"; tpl: CatalogueItem };

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddFlexibleFromCatalogueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  weekStart: Date;
  weekEnd: Date;
  defaultDate?: Date;
  initialItemId?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

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

  // ── Period boundaries (computed relative to viewed week) ──────────────────
  const periodInfo = useMemo(() => {
    const result = {} as Record<
      FlexiblePeriod,
      { start: Date; end: Date; startStr: string; label: string }
    >;
    for (const p of PERIOD_ORDER) {
      const { start, end } = getPeriodBoundaries(weekStart, p);
      result[p] = {
        start,
        end,
        startStr: format(start, "yyyy-MM-dd"),
        label: formatPeriodLabel(p, weekStart),
      };
    }
    return result;
  }, [weekStart]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // ── Data ──────────────────────────────────────────────────────────────────
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

  // Dormant catalogue templates — all flexible periods
  const dormantTemplates = useMemo(() => {
    return catalogueItemsData.filter(
      (it) =>
        it.module_id === tasksModuleId &&
        it.is_flexible_routine === true &&
        it.recurrence_pattern !== null &&
        it.is_active_on_calendar === false,
    );
  }, [catalogueItemsData, tasksModuleId]);

  const unscheduled = routines?.unscheduled ?? [];

  // ── Group all entries by period ───────────────────────────────────────────
  const entriesByPeriod = useMemo<
    Partial<Record<FlexiblePeriod, UnscheduledEntry[]>>
  >(() => {
    const map: Partial<Record<FlexiblePeriod, UnscheduledEntry[]>> = {};
    for (const item of unscheduled) {
      const p = (
        (item.recurrence_rule?.flexible_period as FlexiblePeriod) ?? "weekly"
      ) as FlexiblePeriod;
      (map[p] ??= []).push({ kind: "existing", item });
    }
    for (const tpl of dormantTemplates) {
      const p = (tpl.recurrence_pattern ?? "weekly") as FlexiblePeriod;
      (map[p] ??= []).push({ kind: "dormant", tpl });
    }
    return map;
  }, [unscheduled, dormantTemplates]);

  const availablePeriods = PERIOD_ORDER.filter(
    (p) => (entriesByPeriod[p]?.length ?? 0) > 0,
  );

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<FlexiblePeriod | null>(null);
  const currentTab =
    activeTab && availablePeriods.includes(activeTab)
      ? activeTab
      : (availablePeriods[0] ?? "weekly");
  const activeEntries = entriesByPeriod[currentTab] ?? [];

  // ── Selection state ───────────────────────────────────────────────────────
  // weekly items: day index (0–6)
  const [daySel, setDaySel] = useState<Record<string, number>>({});
  // biweekly/monthly items: explicit date string yyyy-MM-dd
  const [dateSel, setDateSel] = useState<Record<string, string>>({});
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

  function getScheduledDate(key: string, period: FlexiblePeriod): string {
    if (period === "weekly") {
      return format(weekDays[getDay(key)] ?? weekDays[0], "yyyy-MM-dd");
    }
    return dateSel[key] ?? format(periodInfo[period].start, "yyyy-MM-dd");
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const scheduleRoutine = useScheduleRoutine();
  const unscheduleRoutine = useUnscheduleRoutine();
  const createTask = useCreateTask();
  const createReminder = useCreateReminder();
  const updateCatalogueItem = useUpdateCatalogueItem();
  const deleteItem = useDeleteItem();

  async function handleScheduleExisting(item: FlexibleRoutineItem) {
    const period = (
      (item.recurrence_rule?.flexible_period as FlexiblePeriod) ?? "weekly"
    ) as FlexiblePeriod;
    const key = `item-${item.id}`;
    const time = getTime(key);
    const dayStr = getScheduledDate(key, period);
    // Each FlexibleRoutineItem already has the correct period start computed
    const periodStartDate = item.periodStart;

    setPending(key);
    try {
      await scheduleRoutine.mutateAsync({
        itemId: item.id,
        periodStartDate,
        scheduledForDate: dayStr,
        scheduledForTime: time || null,
      });
      const dayLabel = format(new Date(`${dayStr}T12:00:00`), "EEE MMM d");
      toast.success(
        `Scheduled for ${dayLabel}${time ? ` at ${time}` : ""}`,
        {
          icon: <CheckCircle2 className="w-4 h-4 text-green-400" />,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await unscheduleRoutine.mutateAsync({
                  itemId: item.id,
                  periodStartDate,
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
    const period = (template.recurrence_pattern ?? "weekly") as FlexiblePeriod;
    const key = `tpl-${template.id}`;
    const time = getTime(key, template.preferred_time);
    const dayStr = getScheduledDate(key, period);
    const thisPeriodInfo = periodInfo[period];
    const thisPeriodStartStr = thisPeriodInfo.startStr;
    const startAnchorISO = new Date(
      thisPeriodInfo.start.getFullYear(),
      thisPeriodInfo.start.getMonth(),
      thisPeriodInfo.start.getDate(),
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
        rrule: PERIOD_RRULE[period],
        start_anchor: startAnchorISO,
        is_flexible: true,
        flexible_period: period,
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
        periodStartDate: thisPeriodStartStr,
        scheduledForDate: dayStr,
        scheduledForTime: time || null,
      });

      const dayLabel = format(new Date(`${dayStr}T12:00:00`), "EEE MMM d");
      toast.success(
        `"${template.name}" scheduled for ${dayLabel}${time ? ` at ${time}` : ""}`,
        {
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await unscheduleRoutine.mutateAsync({
                  itemId: newItemId,
                  periodStartDate: thisPeriodStartStr,
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

  // ── Render ────────────────────────────────────────────────────────────────

  const accentClass = isFrost
    ? "text-indigo-600"
    : isPink
      ? "text-pink-400"
      : "text-cyan-400";

  const borderClass = isFrost
    ? "border-indigo-200"
    : isPink
      ? "border-pink-500/30"
      : "border-cyan-500/30";

  const activeTabClass = isFrost
    ? "bg-indigo-600 text-white"
    : isPink
      ? "bg-pink-500/30 text-pink-100 ring-1 ring-pink-400/60"
      : "bg-cyan-500/30 text-cyan-100 ring-1 ring-cyan-400/60";

  const inactiveTabClass = isFrost
    ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
    : "bg-white/5 text-white/60 hover:bg-white/10";

  const btnClass = isFrost
    ? "bg-indigo-600 text-white hover:bg-indigo-700"
    : isPink
      ? "bg-pink-500/20 text-pink-200 hover:bg-pink-500/30 ring-1 ring-pink-500/40"
      : "bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 ring-1 ring-cyan-500/40";

  const totalUnscheduled = availablePeriods.reduce(
    (acc, p) => acc + (entriesByPeriod[p]?.length ?? 0),
    0,
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0",
          tc.bgPage,
          borderClass,
        )}
      >
        {/* ── Header ── */}
        <DialogHeader className="p-4 pb-3 border-b border-white/10">
          <DialogTitle
            className={cn(
              "flex items-center gap-2 text-base",
              isFrost ? "text-slate-900" : "text-white",
            )}
          >
            <CalendarPlus className={cn("w-5 h-5", accentClass)} />
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
              {availablePeriods.length > 0
                ? periodInfo[currentTab]?.label
                : `Week ${format(weekStart, "w")} · ${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`}
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* ── Period tabs (only shown when >1 period has items) ── */}
            {availablePeriods.length > 1 && (
              <div className="flex gap-1.5">
                {availablePeriods.map((period) => {
                  const count = entriesByPeriod[period]?.length ?? 0;
                  const isActive = period === currentTab;
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setActiveTab(period)}
                      className={cn(
                        "relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                        isActive ? activeTabClass : inactiveTabClass,
                      )}
                    >
                      {PERIOD_LABELS[period]}
                      {/* count badge — amber when inactive, muted when active */}
                      <span
                        className={cn(
                          "text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center",
                          isActive
                            ? isFrost
                              ? "bg-white/20 text-white"
                              : "bg-white/15 text-white/80"
                            : "bg-amber-400/25 text-amber-400",
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Unscheduled items for active period ── */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3
                  className={cn(
                    "text-sm font-semibold flex items-center gap-1.5",
                    isFrost ? "text-slate-700" : "text-white/80",
                  )}
                >
                  <Inbox className="w-4 h-4" />
                  {availablePeriods.length > 1
                    ? `Unscheduled — ${PERIOD_LABELS[currentTab]}`
                    : "Unscheduled this period"}
                </h3>
                {availablePeriods.length <= 1 && (
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      isFrost
                        ? "bg-slate-100 text-slate-500"
                        : "bg-white/5 text-white/50",
                    )}
                  >
                    {totalUnscheduled}
                  </span>
                )}
              </div>

              {activeEntries.length === 0 ? (
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
                  {activeEntries.map((entry) => {
                    if (entry.kind === "existing") {
                      const { item } = entry;
                      const period = (
                        (item.recurrence_rule
                          ?.flexible_period as FlexiblePeriod) ?? "weekly"
                      ) as FlexiblePeriod;
                      const key = `item-${item.id}`;
                      const isHighlighted =
                        initialItemId && initialItemId === item.id;
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "p-3 rounded-xl border",
                            isHighlighted
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
                                    isFrost
                                      ? "text-slate-500"
                                      : "text-white/50",
                                  )}
                                >
                                  {item.subtasks.length} subtask
                                  {item.subtasks.length !== 1 ? "s" : ""}
                                </div>
                              )}
                            </div>
                            <span
                              className={cn(
                                "shrink-0 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider",
                                isFrost
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-amber-500/15 text-amber-300",
                              )}
                            >
                              Flexible
                            </span>
                          </div>
                          {period === "weekly" ? (
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
                          ) : (
                            <DateTimePicker
                              minDate={format(
                                periodInfo[period].start,
                                "yyyy-MM-dd",
                              )}
                              maxDate={format(
                                periodInfo[period].end,
                                "yyyy-MM-dd",
                              )}
                              value={
                                dateSel[key] ??
                                format(periodInfo[period].start, "yyyy-MM-dd")
                              }
                              time={getTime(key)}
                              onChange={(d) =>
                                setDateSel((s) => ({ ...s, [key]: d }))
                              }
                              onTimeChange={(t) =>
                                setTimeSel((s) => ({ ...s, [key]: t }))
                              }
                            />
                          )}
                          <div className="flex justify-end mt-2">
                            <button
                              type="button"
                              disabled={pending === key}
                              onClick={() => handleScheduleExisting(item)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50",
                                btnClass,
                              )}
                            >
                              {pending === key ? "Scheduling…" : "Schedule"}
                            </button>
                          </div>
                        </li>
                      );
                    }

                    // dormant catalogue template
                    const { tpl } = entry;
                    const period = (tpl.recurrence_pattern ?? "weekly") as FlexiblePeriod;
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
                                  isFrost
                                    ? "text-slate-500"
                                    : "text-white/50",
                                )}
                              >
                                {tpl.description}
                              </div>
                            )}
                          </div>
                          <span
                            className={cn(
                              "shrink-0 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider",
                              isFrost
                                ? "bg-amber-100 text-amber-700"
                                : "bg-amber-500/15 text-amber-300",
                            )}
                          >
                            Flexible
                          </span>
                        </div>
                        {period === "weekly" ? (
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
                        ) : (
                          <DateTimePicker
                            minDate={format(
                              periodInfo[period].start,
                              "yyyy-MM-dd",
                            )}
                            maxDate={format(
                              periodInfo[period].end,
                              "yyyy-MM-dd",
                            )}
                            value={
                              dateSel[key] ??
                              format(periodInfo[period].start, "yyyy-MM-dd")
                            }
                            time={getTime(key, tpl.preferred_time)}
                            onChange={(d) =>
                              setDateSel((s) => ({ ...s, [key]: d }))
                            }
                            onTimeChange={(t) =>
                              setTimeSel((s) => ({ ...s, [key]: t }))
                            }
                          />
                        )}
                        <div className="flex justify-end mt-2">
                          <button
                            type="button"
                            disabled={pending === key}
                            onClick={() => handleActivateAndSchedule(tpl)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50",
                              btnClass,
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

        {/* ── Footer ── */}
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

export default AddFlexibleFromCatalogueDialog;

// ─── DayTimePicker (weekly: 7-day button grid + time) ─────────────────────────

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

// ─── DateTimePicker (biweekly/monthly: date input + time) ────────────────────

interface DateTimePickerProps {
  minDate: string;
  maxDate: string;
  value: string;
  time: string;
  onChange: (date: string) => void;
  onTimeChange: (time: string) => void;
}

function DateTimePicker({
  minDate,
  maxDate,
  value,
  time,
  onChange,
  onTimeChange,
}: DateTimePickerProps) {
  const { theme } = useTheme();
  const isFrost = theme === "frost";
  const inputClass = cn(
    "px-2 py-1 rounded-md text-xs border outline-none",
    isFrost
      ? "bg-white border-slate-200 text-slate-700"
      : "bg-white/5 border-white/10 text-white/80",
  );
  const iconClass = cn(
    "w-3.5 h-3.5",
    isFrost ? "text-slate-400" : "text-white/40",
  );
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1">
        <Calendar className={iconClass} />
        <input
          type="date"
          min={minDate}
          max={maxDate}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-1">
        <Clock className={iconClass} />
        <input
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className={inputClass}
        />
      </div>
    </div>
  );
}
