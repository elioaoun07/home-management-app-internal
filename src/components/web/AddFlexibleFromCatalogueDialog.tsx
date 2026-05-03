"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { useCatalogueItems, useCatalogueModules } from "@/features/catalogue";
import { useUpdateItem as useUpdateCatalogueItem } from "@/features/catalogue/hooks";
import {
  flexibleRoutinesKeys,
  formatPeriodLabel,
  getPeriodBoundaries,
  useFlexibleRoutines,
  useScheduleRoutine,
  useSkipFlexibleRoutine,
  useUnscheduleRoutine,
  type FlexibleRoutineItem,
} from "@/features/items/useFlexibleRoutines";
import { useAllOccurrenceActions } from "@/features/items/useItemActions";
import {
  itemsKeys,
  useCreateReminder,
  useCreateTask,
  useDeleteItem,
  useItems,
} from "@/features/items/useItems";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { CatalogueItem } from "@/types/catalogue";
import type { FlexiblePeriod } from "@/types/items";
import type { CreateSubtaskInput } from "@/types/items";
import { addDays, format, isSameDay } from "date-fns";
import {
  AlertCircle,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  SkipForward,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  // Dormant templates skipped for this session (by `${tpl.id}:${periodStart}`)
  const [skippedDormant, setSkippedDormant] = useState<Set<string>>(new Set());

  const visibleEntries = activeEntries.filter((entry) => {
    if (entry.kind !== "dormant") return true;
    const period = (entry.tpl.recurrence_pattern ?? "weekly") as FlexiblePeriod;
    const key = `${entry.tpl.id}:${periodInfo[period].startStr}`;
    return !skippedDormant.has(key);
  });

  function skipDormantTemplate(tpl: CatalogueItem) {
    const period = (tpl.recurrence_pattern ?? "weekly") as FlexiblePeriod;
    const key = `${tpl.id}:${periodInfo[period].startStr}`;
    setSkippedDormant((prev) => new Set([...prev, key]));
    toast.success("Skipped for this period", {
      icon: <SkipForward className="w-4 h-4 text-white/60" />,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () =>
          setSkippedDormant((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          }),
      },
    });
  }

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
  const skipRoutine = useSkipFlexibleRoutine();
  const createTask = useCreateTask();
  const createReminder = useCreateReminder();
  const updateCatalogueItem = useUpdateCatalogueItem();
  const deleteItem = useDeleteItem();
  const queryClient = useQueryClient();

  async function handleSkip(item: FlexibleRoutineItem) {
    const skipKey = `skip-item-${item.id}`;
    const periodStartDate = item.periodStart;
    setPending(skipKey);
    try {
      const result = await skipRoutine.mutateAsync({
        itemId: item.id,
        periodStartDate,
        reason: "user_skipped",
      });
      const skipId = (result as { id?: string })?.id;
      toast.success("Skipped for this period", {
        icon: <SkipForward className="w-4 h-4 text-white/60" />,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (!skipId) return;
            try {
              const supabase = supabaseBrowser();
              await supabase
                .from("item_occurrence_actions")
                .delete()
                .eq("id", skipId);
              queryClient.invalidateQueries({
                queryKey: itemsKeys.allActions(),
              });
              queryClient.invalidateQueries({
                queryKey: flexibleRoutinesKeys.all,
              });
              toast.success("Skip undone", { icon: <Undo2 className="w-4 h-4" /> });
            } catch {
              toast.error("Failed to undo skip");
            }
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to skip");
    } finally {
      setPending(null);
    }
  }

  async function handleScheduleExisting(
    item: FlexibleRoutineItem,
    occurrenceIndex = 0,
  ) {
    const period = (
      (item.recurrence_rule?.flexible_period as FlexiblePeriod) ?? "weekly"
    ) as FlexiblePeriod;
    const key = `item-${item.id}-${occurrenceIndex}`;
    const time = getTime(key);
    const dayStr = getScheduledDate(key, period);
    const periodStartDate = item.periodStart;

    setPending(key);
    try {
      await scheduleRoutine.mutateAsync({
        itemId: item.id,
        periodStartDate,
        scheduledForDate: dayStr,
        scheduledForTime: time || null,
        occurrenceIndex,
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
                  occurrenceIndex,
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

  async function handleUnscheduleSlot(
    item: FlexibleRoutineItem,
    occurrenceIndex: number,
  ) {
    const key = `unsched-${item.id}-${occurrenceIndex}`;
    setPending(key);
    try {
      await unscheduleRoutine.mutateAsync({
        itemId: item.id,
        periodStartDate: item.periodStart,
        occurrenceIndex,
      });
      toast.success("Slot cleared", {
        icon: <Undo2 className="w-4 h-4 text-white/60" />,
        duration: 4000,
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to clear slot",
      );
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

  // ── Theme palette (centralised) ───────────────────────────────────────────
  const accentText = isFrost
    ? "text-indigo-600"
    : isPink
      ? "text-pink-300"
      : "text-cyan-300";

  const accentBg = isFrost
    ? "bg-indigo-50"
    : isPink
      ? "bg-pink-500/10"
      : "bg-cyan-500/10";

  const accentRing = isFrost
    ? "ring-indigo-200"
    : isPink
      ? "ring-pink-400/40"
      : "ring-cyan-400/40";

  const accentStripe = isFrost
    ? "bg-amber-400"
    : "bg-amber-400/80";

  const dialogBorderClass = isFrost
    ? "border-slate-200"
    : "border-white/10";

  const segmentBg = isFrost
    ? "bg-slate-100"
    : "bg-white/5";

  const segmentActive = isFrost
    ? "bg-white text-slate-900 shadow-sm"
    : isPink
      ? "bg-pink-500/25 text-pink-50 ring-1 ring-pink-400/50"
      : "bg-cyan-500/25 text-cyan-50 ring-1 ring-cyan-400/50";

  const segmentInactive = isFrost
    ? "text-slate-500 hover:text-slate-700"
    : "text-white/55 hover:text-white/85";

  const primaryBtn = isFrost
    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
    : isPink
      ? "bg-pink-500/25 text-pink-50 hover:bg-pink-500/35 ring-1 ring-pink-400/50"
      : "bg-cyan-500/25 text-cyan-50 hover:bg-cyan-500/35 ring-1 ring-cyan-400/50";

  // back-compat aliases used below
  const borderClass = dialogBorderClass;

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
        <DialogHeader
          className={cn(
            "p-5 pb-4 border-b",
            dialogBorderClass,
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                accentBg,
                "ring-1",
                accentRing,
              )}
            >
              <CalendarPlus className={cn("w-5 h-5", accentText)} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle
                className={cn(
                  "text-[17px] font-semibold leading-tight",
                  isFrost ? "text-slate-900" : "text-white",
                )}
              >
                Plan flexible routines
              </DialogTitle>
              <p
                className={cn(
                  "mt-0.5 text-[12px] leading-snug",
                  isFrost ? "text-slate-500" : "text-white/55",
                )}
              >
                {totalUnscheduled === 0
                  ? "Nothing left to plan — you're all set."
                  : `Pick a day for ${totalUnscheduled} routine${totalUnscheduled === 1 ? "" : "s"} this ${PERIOD_LABELS[currentTab].toLowerCase()}.`}
              </p>
              <div
                className={cn(
                  "mt-1.5 inline-flex items-center gap-1.5 text-[11px]",
                  isFrost ? "text-slate-400" : "text-white/40",
                )}
              >
                <Calendar className="w-3 h-3" />
                <span>
                  {availablePeriods.length > 0
                    ? periodInfo[currentTab]?.label
                    : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-5 space-y-4">
            {/* ── Segmented period selector ── */}
            {availablePeriods.length > 1 && (
              <div
                className={cn(
                  "inline-flex p-1 rounded-xl gap-0.5",
                  segmentBg,
                )}
              >
                {availablePeriods.map((period) => {
                  const count = entriesByPeriod[period]?.length ?? 0;
                  const isActive = period === currentTab;
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setActiveTab(period)}
                      className={cn(
                        "relative px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-2",
                        isActive ? segmentActive : segmentInactive,
                      )}
                    >
                      <span>{PERIOD_LABELS[period]}</span>
                      <span
                        className={cn(
                          "text-[10px] min-w-[18px] h-[18px] px-1.5 rounded-full flex items-center justify-center font-semibold",
                          isActive
                            ? isFrost
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-white/15 text-white/85"
                            : isFrost
                              ? "bg-white text-slate-500"
                              : "bg-white/10 text-white/60",
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
              {visibleEntries.length === 0 ? (
                <div
                  className={cn(
                    "py-12 px-6 text-center rounded-2xl border border-dashed",
                    isFrost
                      ? "bg-slate-50/60 border-slate-200 text-slate-500"
                      : "bg-white/[0.02] border-white/10 text-white/50",
                  )}
                >
                  <div
                    className={cn(
                      "mx-auto w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                      isFrost ? "bg-white" : "bg-white/5",
                    )}
                  >
                    <Sparkles className={cn("w-5 h-5", accentText)} />
                  </div>
                  <p
                    className={cn(
                      "text-[14px] font-medium",
                      isFrost ? "text-slate-700" : "text-white/80",
                    )}
                  >
                    All caught up
                  </p>
                  <p className="text-[12px] mt-1">
                    Every flexible routine has a day this period.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {visibleEntries.map((entry) => {
                    if (entry.kind === "existing") {
                      const { item } = entry;
                      const period = (
                        (item.recurrence_rule
                          ?.flexible_period as FlexiblePeriod) ?? "weekly"
                      ) as FlexiblePeriod;
                      const target = Math.max(1, item.targetOccurrences ?? 1);
                      const scheduledSlots = item.scheduledOccurrences ?? [];
                      const scheduledByIndex = new Map<number, typeof scheduledSlots[number]>();
                      for (const s of scheduledSlots) {
                        scheduledByIndex.set(s.occurrence_index ?? 0, s);
                      }
                      const completedCount = item.completedCount ?? 0;
                      const skippedCount = item.skippedCount ?? 0;
                      const filledCount =
                        scheduledSlots.length + completedCount + skippedCount;
                      const isHighlighted =
                        initialItemId && initialItemId === item.id;

                      const slotIndices: number[] = [];
                      const usedIndices = new Set<number>();
                      for (let s = 0; s < target; s++) {
                        if (!scheduledByIndex.has(s) && !usedIndices.has(s)) {
                          slotIndices.push(s);
                          usedIndices.add(s);
                        }
                      }
                      // Always show at least one row even when fully filled (for visual symmetry)
                      const renderedSlotsCount = Math.max(
                        target - filledCount,
                        target === 1 ? 1 : 0,
                      );

                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "relative rounded-2xl border overflow-hidden transition-all",
                            isHighlighted
                              ? cn(
                                  isFrost
                                    ? "border-indigo-300 bg-indigo-50/40"
                                    : isPink
                                      ? "border-pink-400/50 bg-pink-500/[0.06]"
                                      : "border-cyan-400/50 bg-cyan-500/[0.06]",
                                  "ring-2",
                                  accentRing,
                                )
                              : isFrost
                                ? "border-slate-200 bg-white"
                                : "border-white/10 bg-white/[0.025]",
                          )}
                        >
                          {/* Left accent stripe */}
                          <div
                            className={cn(
                              "absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full",
                              accentStripe,
                            )}
                          />

                          <div className="px-4 py-3.5 pl-5">
                            {/* Title row */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0 flex-1">
                                <h4
                                  className={cn(
                                    "text-[15px] font-semibold leading-tight truncate",
                                    isFrost ? "text-slate-900" : "text-white",
                                  )}
                                >
                                  {item.title}
                                </h4>
                                <div
                                  className={cn(
                                    "flex items-center gap-2 mt-1 text-[11px]",
                                    isFrost ? "text-slate-500" : "text-white/45",
                                  )}
                                >
                                  <span className="capitalize">{period}</span>
                                  {item.subtasks && item.subtasks.length > 0 && (
                                    <>
                                      <span aria-hidden>·</span>
                                      <span>
                                        {item.subtasks.length} subtask
                                        {item.subtasks.length !== 1 ? "s" : ""}
                                      </span>
                                    </>
                                  )}
                                  {target > 1 && (
                                    <>
                                      <span aria-hidden>·</span>
                                      <span
                                        className={cn(
                                          "font-medium",
                                          filledCount >= target
                                            ? isFrost
                                              ? "text-green-700"
                                              : "text-green-300"
                                            : isFrost
                                              ? "text-amber-700"
                                              : "text-amber-300",
                                        )}
                                      >
                                        {filledCount} of {target} planned
                                      </span>
                                    </>
                                  )}
                                </div>
                                {target > 1 && (
                                  <div
                                    className={cn(
                                      "mt-2 h-1 rounded-full overflow-hidden",
                                      isFrost ? "bg-slate-100" : "bg-white/5",
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        isFrost
                                          ? "bg-indigo-500"
                                          : isPink
                                            ? "bg-pink-400"
                                            : "bg-cyan-400",
                                      )}
                                      style={{
                                        width: `${Math.min(100, (filledCount / target) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                              {item.isOverdue && (
                                <span
                                  className={cn(
                                    "shrink-0 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 font-medium",
                                    isFrost
                                      ? "bg-red-50 text-red-600 ring-1 ring-red-100"
                                      : "bg-red-500/10 text-red-300 ring-1 ring-red-400/20",
                                  )}
                                >
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  {item.overduePeriodsCount &&
                                  item.overduePeriodsCount > 1
                                    ? `${item.overduePeriodsCount}× missed`
                                    : "Missed"}
                                </span>
                              )}
                            </div>

                            {/* Already-scheduled slots (for N>1) */}
                            {target > 1 && scheduledSlots.length > 0 && (
                              <div className="mb-3 space-y-1">
                                {scheduledSlots.map((sched) => {
                                  const idx = sched.occurrence_index ?? 0;
                                  const dayLabel = format(
                                    new Date(
                                      `${sched.scheduled_for_date}T12:00:00`,
                                    ),
                                    "EEE, MMM d",
                                  );
                                  return (
                                    <div
                                      key={`s-${idx}`}
                                      className={cn(
                                        "flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[12px]",
                                        isFrost
                                          ? "bg-green-50 ring-1 ring-green-100"
                                          : "bg-green-500/[0.08] ring-1 ring-green-400/20",
                                      )}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <CheckCircle2
                                          className={cn(
                                            "w-3.5 h-3.5 shrink-0",
                                            isFrost
                                              ? "text-green-600"
                                              : "text-green-400",
                                          )}
                                        />
                                        <span
                                          className={cn(
                                            "font-medium truncate",
                                            isFrost
                                              ? "text-green-800"
                                              : "text-green-200",
                                          )}
                                        >
                                          {dayLabel}
                                          {sched.scheduled_for_time
                                            ? ` · ${sched.scheduled_for_time}`
                                            : ""}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={!!pending}
                                        onClick={() =>
                                          handleUnscheduleSlot(item, idx)
                                        }
                                        className={cn(
                                          "text-[11px] px-2 py-0.5 rounded-md transition-all disabled:opacity-50",
                                          isFrost
                                            ? "text-slate-500 hover:bg-white"
                                            : "text-white/45 hover:bg-white/10 hover:text-white/75",
                                        )}
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Picker rows for remaining slots */}
                            {renderedSlotsCount > 0 &&
                              slotIndices
                                .slice(0, renderedSlotsCount)
                                .map((idx, rowIdx) => {
                                  const key = `item-${item.id}-${idx}`;
                                  const showSlotLabel = target > 1;
                                  const showDivider =
                                    showSlotLabel && rowIdx > 0;
                                  return (
                                    <div
                                      key={`p-${idx}`}
                                      className={cn(
                                        "space-y-2.5",
                                        showDivider &&
                                          (isFrost
                                            ? "pt-3 mt-3 border-t border-slate-100"
                                            : "pt-3 mt-3 border-t border-white/5"),
                                      )}
                                    >
                                      {showSlotLabel && (
                                        <div
                                          className={cn(
                                            "text-[10px] uppercase tracking-[0.12em] font-semibold",
                                            isFrost
                                              ? "text-slate-400"
                                              : "text-white/35",
                                          )}
                                        >
                                          Slot {idx + 1}
                                        </div>
                                      )}
                                      {period === "weekly" ? (
                                        <DayTimePicker
                                          weekDays={weekDays}
                                          dayIndex={getDay(key)}
                                          time={getTime(key)}
                                          onDayChange={(i) =>
                                            setDaySel((s) => ({
                                              ...s,
                                              [key]: i,
                                            }))
                                          }
                                          onTimeChange={(t) =>
                                            setTimeSel((s) => ({
                                              ...s,
                                              [key]: t,
                                            }))
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
                                            format(
                                              periodInfo[period].start,
                                              "yyyy-MM-dd",
                                            )
                                          }
                                          time={getTime(key)}
                                          onChange={(d) =>
                                            setDateSel((s) => ({
                                              ...s,
                                              [key]: d,
                                            }))
                                          }
                                          onTimeChange={(t) =>
                                            setTimeSel((s) => ({
                                              ...s,
                                              [key]: t,
                                            }))
                                          }
                                        />
                                      )}
                                      <div className="flex items-center justify-between gap-2 pt-1">
                                        <button
                                          type="button"
                                          disabled={!!pending}
                                          onClick={() => handleSkip(item)}
                                          className={cn(
                                            "text-[12px] font-medium transition-all disabled:opacity-40 inline-flex items-center gap-1",
                                            isFrost
                                              ? "text-slate-400 hover:text-slate-600"
                                              : "text-white/40 hover:text-white/70",
                                          )}
                                        >
                                          <SkipForward className="w-3 h-3" />
                                          {target > 1
                                            ? "Skip the rest"
                                            : pending === `skip-item-${item.id}`
                                              ? "Skipping…"
                                              : "Skip this period"}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={!!pending}
                                          onClick={() =>
                                            handleScheduleExisting(item, idx)
                                          }
                                          className={cn(
                                            "px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-50 inline-flex items-center gap-1.5",
                                            primaryBtn,
                                          )}
                                        >
                                          <CalendarPlus className="w-3.5 h-3.5" />
                                          {pending === key
                                            ? "Saving…"
                                            : target > 1
                                              ? `Plan slot ${idx + 1}`
                                              : "Plan it"}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
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
                          "relative rounded-2xl border overflow-hidden transition-all",
                          isFrost
                            ? "border-slate-200 bg-white"
                            : "border-white/10 bg-white/[0.025]",
                        )}
                      >
                        {/* Left accent stripe — amber for new/dormant */}
                        <div
                          className={cn(
                            "absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full",
                            accentStripe,
                          )}
                        />

                        <div className="px-4 py-3.5 pl-5 space-y-2.5">
                          {/* Title row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h4
                                className={cn(
                                  "text-[15px] font-semibold leading-tight truncate",
                                  isFrost ? "text-slate-900" : "text-white",
                                )}
                              >
                                {tpl.name}
                              </h4>
                              <div
                                className={cn(
                                  "flex items-center gap-2 mt-1 text-[11px]",
                                  isFrost ? "text-slate-500" : "text-white/45",
                                )}
                              >
                                <span className="capitalize">{period}</span>
                                {tpl.flexible_occurrences &&
                                tpl.flexible_occurrences > 1 ? (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>
                                      {tpl.flexible_occurrences}× per {period.replace("ly", "")}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                              {tpl.description && (
                                <p
                                  className={cn(
                                    "text-[12px] mt-1.5 line-clamp-2",
                                    isFrost
                                      ? "text-slate-600"
                                      : "text-white/55",
                                  )}
                                >
                                  {tpl.description}
                                </p>
                              )}
                            </div>
                            <span
                              className={cn(
                                "shrink-0 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium",
                                isFrost
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                                  : "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20",
                              )}
                            >
                              New
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
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              disabled={!!pending}
                              onClick={() => skipDormantTemplate(tpl)}
                              className={cn(
                                "text-[12px] font-medium transition-all disabled:opacity-40 inline-flex items-center gap-1",
                                isFrost
                                  ? "text-slate-400 hover:text-slate-600"
                                  : "text-white/40 hover:text-white/70",
                              )}
                            >
                              <SkipForward className="w-3 h-3" />
                              Not this period
                            </button>
                            <button
                              type="button"
                              disabled={pending === key}
                              onClick={() => handleActivateAndSchedule(tpl)}
                              className={cn(
                                "px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-50 inline-flex items-center gap-1.5",
                                primaryBtn,
                              )}
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                              {pending === key ? "Adding…" : "Plan it"}
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className={cn(
            "px-5 py-3 border-t flex justify-end",
            dialogBorderClass,
          )}
        >
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all inline-flex items-center gap-1.5",
              isFrost
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-white/[0.06] text-white/70 hover:bg-white/10",
            )}
          >
            <X className="w-3.5 h-3.5" />
            Done
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
  const today = new Date();
  const selectedDay = weekDays[dayIndex];
  const selectedDayLabel = selectedDay
    ? format(selectedDay, "EEE, MMM d")
    : "";

  const trackBg = isFrost ? "bg-slate-50" : "bg-white/[0.04]";
  const dayBase = isFrost
    ? "text-slate-600 hover:bg-white"
    : "text-white/55 hover:bg-white/[0.06]";
  const daySelected = isFrost
    ? "bg-indigo-600 text-white shadow-sm"
    : isPink
      ? "bg-pink-500/30 text-pink-50 ring-1 ring-pink-400/55"
      : "bg-cyan-500/30 text-cyan-50 ring-1 ring-cyan-400/55";
  const todayRing = isFrost
    ? "ring-1 ring-indigo-200"
    : isPink
      ? "ring-1 ring-pink-400/25"
      : "ring-1 ring-cyan-400/25";

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "text-[10px] uppercase tracking-[0.12em] font-semibold flex items-center justify-between",
          isFrost ? "text-slate-400" : "text-white/35",
        )}
      >
        <span>Pick a day</span>
        {selectedDayLabel && (
          <span
            className={cn(
              "normal-case tracking-normal text-[11px] font-medium",
              isFrost ? "text-slate-600" : "text-white/65",
            )}
          >
            {selectedDayLabel}
          </span>
        )}
      </div>
      <div className={cn("grid grid-cols-7 gap-1 p-1 rounded-xl", trackBg)}>
        {weekDays.map((d, i) => {
          const selected = i === dayIndex;
          const isToday = isSameDay(d, today);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayChange(i)}
              className={cn(
                "flex flex-col items-center justify-center h-12 rounded-lg text-[10px] font-medium transition-all",
                selected
                  ? daySelected
                  : cn(dayBase, isToday && !selected && todayRing),
              )}
            >
              <span className="uppercase tracking-wider opacity-70">
                {format(d, "EEE")}
              </span>
              <span className="text-[14px] font-bold leading-none mt-0.5">
                {format(d, "d")}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-[10px] uppercase tracking-[0.12em] font-semibold",
            isFrost ? "text-slate-400" : "text-white/35",
          )}
        >
          At
        </span>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
            isFrost
              ? "bg-slate-50 ring-1 ring-slate-200"
              : "bg-white/[0.04] ring-1 ring-white/10",
          )}
        >
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
              "bg-transparent outline-none text-[12px] font-medium w-[80px]",
              isFrost ? "text-slate-700" : "text-white/85",
            )}
          />
        </div>
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
  const fieldClass = cn(
    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg",
    isFrost
      ? "bg-slate-50 ring-1 ring-slate-200"
      : "bg-white/[0.04] ring-1 ring-white/10",
  );
  const inputClass = cn(
    "bg-transparent outline-none text-[12px] font-medium",
    isFrost ? "text-slate-700" : "text-white/85",
  );
  const iconClass = cn(
    "w-3.5 h-3.5",
    isFrost ? "text-slate-400" : "text-white/40",
  );
  return (
    <div className="space-y-2">
      <div
        className={cn(
          "text-[10px] uppercase tracking-[0.12em] font-semibold",
          isFrost ? "text-slate-400" : "text-white/35",
        )}
      >
        Pick a date & time
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className={fieldClass}>
          <Calendar className={iconClass} />
          <input
            type="date"
            min={minDate}
            max={maxDate}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(inputClass, "min-w-[130px]")}
          />
        </div>
        <div className={fieldClass}>
          <Clock className={iconClass} />
          <input
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className={cn(inputClass, "w-[80px]")}
          />
        </div>
      </div>
    </div>
  );
}
