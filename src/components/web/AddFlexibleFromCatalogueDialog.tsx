"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { useCatalogueItems, useCatalogueModules } from "@/features/catalogue";
import {
  formatPeriodLabel,
  getPeriodBoundaries,
} from "@/features/items/useFlexibleRoutines";
import {
  useCreateReminder,
  useCreateTask,
  useDeleteItem,
  useItems,
} from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { CatalogueItem } from "@/types/catalogue";
import type {
  CreateSubtaskInput,
  FlexiblePeriod,
  ItemWithDetails,
} from "@/types/items";
import { addDays, format, isSameDay, isWithinInterval } from "date-fns";
import {
  AlertCircle,
  BellOff,
  BellRing,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Clock,
  SkipForward,
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

// Alert offset options (minutes before due_at). null = no alert.
type AlertOption = { value: number | null; label: string; short: string };
const ALERT_OPTIONS: AlertOption[] = [
  { value: null, label: "No alert", short: "Off" },
  { value: 0, label: "At time", short: "On time" },
  { value: 15, label: "15 min before", short: "15m" },
  { value: 30, label: "30 min before", short: "30m" },
  { value: 60, label: "1 hour before", short: "1h" },
  { value: 1440, label: "1 day before", short: "1d" },
];

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

function combineDateAndTime(dateStr: string, time: string): string {
  // Local datetime → ISO. Time format HH:MM.
  const [h, m] = time.split(":").map((v) => parseInt(v, 10));
  const [y, mo, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(y, mo - 1, d, h || 0, m || 0, 0, 0);
  return dt.toISOString();
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddFlexibleFromCatalogueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  weekStart: Date;
  weekEnd: Date;
  defaultDate?: Date;
  initialItemId?: string | null; // catalogue template id to highlight
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
  const { data: catalogueModules = [] } = useCatalogueModules();
  const { data: catalogueItemsData = [] } = useCatalogueItems();

  const tasksModuleId = useMemo(
    () => catalogueModules.find((m) => m.type === "tasks")?.id,
    [catalogueModules],
  );

  // All catalogue templates that are flexible routines
  const flexibleTemplates = useMemo(() => {
    return catalogueItemsData.filter(
      (it) =>
        it.module_id === tasksModuleId &&
        it.is_flexible_routine === true &&
        it.recurrence_pattern !== null,
    );
  }, [catalogueItemsData, tasksModuleId]);

  // ── Group templates by period ─────────────────────────────────────────────
  // For each template, also compute "items already scheduled in this period"
  // = items with source_catalogue_item_id === tpl.id and due_at inside period.
  type TemplateEntry = {
    tpl: CatalogueItem;
    period: FlexiblePeriod;
    target: number;
    scheduled: ItemWithDetails[]; // already-created items in this period
    needsCount: number; // remaining slots
  };

  const templatesByPeriod = useMemo<
    Partial<Record<FlexiblePeriod, TemplateEntry[]>>
  >(() => {
    const map: Partial<Record<FlexiblePeriod, TemplateEntry[]>> = {};
    for (const tpl of flexibleTemplates) {
      const period = (tpl.recurrence_pattern ?? "weekly") as FlexiblePeriod;
      const { start, end } = periodInfo[period];
      const target = Math.max(1, tpl.flexible_occurrences ?? 1);

      const scheduled = items.filter((item) => {
        if (item.source_catalogue_item_id !== tpl.id) return false;
        const dueAt =
          item.reminder_details?.due_at ?? item.event_details?.start_at;
        if (!dueAt) return false;
        const d = new Date(dueAt);
        return isWithinInterval(d, { start, end });
      });

      const needsCount = Math.max(0, target - scheduled.length);
      const entry: TemplateEntry = {
        tpl,
        period,
        target,
        scheduled,
        needsCount,
      };
      (map[period] ??= []).push(entry);
    }
    return map;
  }, [flexibleTemplates, items, periodInfo]);

  const availablePeriods = PERIOD_ORDER.filter(
    (p) => (templatesByPeriod[p]?.length ?? 0) > 0,
  );

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<FlexiblePeriod | null>(null);
  const currentTab =
    activeTab && availablePeriods.includes(activeTab)
      ? activeTab
      : (availablePeriods[0] ?? "weekly");
  const activeEntries = templatesByPeriod[currentTab] ?? [];

  // ── Selection state (per template+slot key) ───────────────────────────────
  const [daySel, setDaySel] = useState<Record<string, number>>({});
  const [dateSel, setDateSel] = useState<Record<string, string>>({});
  const [timeSel, setTimeSel] = useState<Record<string, string>>({});
  const [alertSel, setAlertSel] = useState<Record<string, number | null>>({});
  // Per-slot duration override (in minutes). Empty / undefined = use template default.
  const [durationSel, setDurationSel] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);

  // Templates skipped this period (session-only)
  const [skippedTemplates, setSkippedTemplates] = useState<Set<string>>(
    new Set(),
  );

  // Completed = all slots filled for the period; collapsed section
  const [completedOpen, setCompletedOpen] = useState(false);

  // Which pending entry is expanded (null = first one auto-expands via effectiveExpanded)
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(
    initialItemId ?? null,
  );

  const visibleEntries = activeEntries.filter((e) => {
    const key = `${e.tpl.id}:${periodInfo[e.period].startStr}`;
    if (skippedTemplates.has(key)) return false;
    // Hide once all slots are filled (they go to completedEntries)
    return e.needsCount > 0;
  });

  // Only move to "Already added" once ALL slots are planned (needsCount === 0)
  const completedEntries = activeEntries.filter((e) => e.needsCount === 0);

  function handleSkipTemplate(tpl: CatalogueItem, period: FlexiblePeriod) {
    const key = `${tpl.id}:${periodInfo[period].startStr}`;
    setSkippedTemplates((prev) => new Set([...prev, key]));
    toast.success(`Skipped "${tpl.name}" for this period`, {
      icon: <SkipForward className="w-4 h-4 text-white/60" />,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () =>
          setSkippedTemplates((prev) => {
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
  const getAlert = (key: string, fallback: number | null = 0): number | null =>
    key in alertSel ? alertSel[key] : fallback;
  const getDuration = (
    key: string,
    fallback: number | undefined,
  ): number | undefined => {
    const raw = durationSel[key];
    if (raw == null) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  function getScheduledDate(key: string, period: FlexiblePeriod): string {
    if (period === "weekly") {
      return format(weekDays[getDay(key)] ?? weekDays[0], "yyyy-MM-dd");
    }
    return dateSel[key] ?? format(periodInfo[period].start, "yyyy-MM-dd");
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createTask = useCreateTask();
  const createReminder = useCreateReminder();
  const deleteItem = useDeleteItem();

  async function handlePlanSlot(
    tpl: CatalogueItem,
    slotIndex: number,
    period: FlexiblePeriod,
  ) {
    const key = `${tpl.id}:${slotIndex}`;
    const time = getTime(key, tpl.preferred_time);
    const dayStr = getScheduledDate(key, period);
    const dueAtIso = combineDateAndTime(dayStr, time);
    const alertOffset = getAlert(key, 0);

    setPending(key);
    try {
      const itemType: "reminder" | "task" =
        tpl.item_type === "reminder" ? "reminder" : "task";
      const subtasks = parseSubtasks(tpl.subtasks_text);
      const priority =
        tpl.priority === "critical"
          ? "urgent"
          : (tpl.priority as "low" | "normal" | "high" | "urgent");

      // Catalogue-derived fields (apply to all spawned types)
      const tplDurationDefault =
        typeof tpl.preferred_duration_minutes === "number" &&
        tpl.preferred_duration_minutes > 0
          ? tpl.preferred_duration_minutes
          : undefined;
      // Per-slot override takes precedence over template default
      const tplDuration = getDuration(key, tplDurationDefault);
      const tplCategoryIds = tpl.item_category_ids?.length
        ? tpl.item_category_ids
        : undefined;
      const tplLocContext =
        (tpl.location_context as
          | "home"
          | "outside"
          | "anywhere"
          | null
          | undefined) || undefined;
      const tplLocText =
        (tpl as { location_url?: string | null }).location_url || undefined;
      const tplPrereqs =
        (tpl.metadata_json?.trigger_conditions as
          | import("@/types/prerequisites").CreatePrerequisiteInput[]
          | undefined) || undefined;

      // Build optional alert override.
      // null = no alert; the create hook auto-creates an absolute alert at
      // due_at when alerts is omitted, which is "At time". For other offsets
      // we pass an explicit relative alert.
      const alertsInput =
        alertOffset === null
          ? [] // explicit "no alert"
          : alertOffset === 0
            ? undefined // let auto-alert kick in (= at time)
            : [
                {
                  kind: "relative" as const,
                  offset_minutes: alertOffset,
                  relative_to: "due" as const,
                  channel: "push" as const,
                },
              ];

      let createdId: string | undefined;
      if (itemType === "reminder") {
        const res = await createReminder.mutateAsync({
          type: "reminder",
          title: tpl.name,
          description: tpl.description || undefined,
          priority,
          is_public: tpl.is_public,
          due_at: dueAtIso,
          estimate_minutes: tplDuration,
          has_checklist: subtasks.length > 0,
          subtasks,
          category_ids: tplCategoryIds,
          location_context: tplLocContext,
          location_text: tplLocText,
          prerequisites: tplPrereqs,
          source_catalogue_item_id: tpl.id,
          is_template_instance: true,
          alerts: alertsInput,
        });
        createdId = (res as { id?: string } | undefined)?.id;
      } else {
        const res = await createTask.mutateAsync({
          type: "task",
          title: tpl.name,
          description: tpl.description || undefined,
          priority,
          is_public: tpl.is_public,
          due_at: dueAtIso,
          estimate_minutes: tplDuration,
          subtasks: subtasks.length > 0 ? subtasks : undefined,
          category_ids: tplCategoryIds,
          location_context: tplLocContext,
          location_text: tplLocText,
          prerequisites: tplPrereqs,
          source_catalogue_item_id: tpl.id,
          is_template_instance: true,
          alerts: alertsInput,
        });
        createdId = (res as { id?: string } | undefined)?.id;
      }

      if (!createdId) throw new Error("Item creation failed");
      const newItemId = createdId;

      const dayLabel = format(new Date(`${dayStr}T12:00:00`), "EEE, MMM d");
      toast.success(
        `"${tpl.name}" planned for ${dayLabel}${time ? ` at ${time}` : ""}`,
        {
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
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
      toast.error(err instanceof Error ? err.message : "Failed to plan");
    } finally {
      setPending(null);
    }
  }

  async function handleClearScheduled(item: ItemWithDetails) {
    const key = `clear-${item.id}`;
    setPending(key);
    try {
      await deleteItem.mutateAsync(item.id);
      toast.success(`"${item.title}" removed`, {
        icon: <Undo2 className="w-4 h-4 text-white/60" />,
        duration: 4000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setPending(null);
    }
  }

  // ── Theme palette ────────────────────────────────────────────────────────
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

  const accentStripe = isFrost ? "bg-amber-400" : "bg-amber-400/80";

  const dialogBorderClass = isFrost ? "border-slate-200" : "border-white/10";

  const segmentBg = isFrost ? "bg-slate-100" : "bg-white/5";

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

  const totalNeeding = availablePeriods.reduce(
    (acc, p) =>
      acc + (templatesByPeriod[p]?.filter((e) => e.needsCount > 0).length ?? 0),
    0,
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0",
          tc.bgPage,
          dialogBorderClass,
        )}
      >
        {/* ── Header ── */}
        <DialogHeader className={cn("p-5 pb-4 border-b", dialogBorderClass)}>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ring-1",
                accentBg,
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
                {totalNeeding === 0
                  ? "Nothing left to plan — you're all set."
                  : `Pick a day for ${totalNeeding} routine${totalNeeding === 1 ? "" : "s"} this ${PERIOD_LABELS[currentTab].toLowerCase()}.`}
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
                className={cn("inline-flex p-1 rounded-xl gap-0.5", segmentBg)}
              >
                {availablePeriods.map((period) => {
                  const count =
                    templatesByPeriod[period]?.filter((e) => e.needsCount > 0)
                      .length ?? 0;
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

            {/* ── Templates needing scheduling ── */}
            <section className="space-y-4">
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
                <ul
                  className={cn(
                    "rounded-2xl border overflow-hidden divide-y",
                    isFrost
                      ? "border-slate-200 divide-slate-100 bg-white"
                      : "border-white/10 divide-white/5 bg-white/[0.02]",
                  )}
                >
                  {visibleEntries.map((entry, entryIdx) => {
                    const { tpl, period, target, scheduled, needsCount } =
                      entry;
                    const filledCount = scheduled.length;
                    // First item auto-expands if nothing is explicitly selected
                    const isExpanded =
                      (expandedEntryId ?? visibleEntries[0]?.tpl.id) === tpl.id;

                    return (
                      <li key={tpl.id} className="relative">
                        {/* ── Compact header row (always visible) ── */}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEntryId(isExpanded ? `__none__` : tpl.id)
                          }
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                            isExpanded
                              ? isFrost
                                ? "bg-indigo-50/60"
                                : isPink
                                  ? "bg-pink-500/[0.06]"
                                  : "bg-cyan-500/[0.05]"
                              : isFrost
                                ? "hover:bg-slate-50"
                                : "hover:bg-white/[0.03]",
                          )}
                        >
                          {/* Left accent pip */}
                          <div
                            className={cn(
                              "shrink-0 w-[3px] h-8 rounded-full",
                              isExpanded
                                ? accentStripe
                                : isFrost
                                  ? "bg-slate-200"
                                  : "bg-white/10",
                            )}
                          />

                          {/* Title + meta */}
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "text-[14px] font-semibold leading-tight truncate",
                                isFrost ? "text-slate-900" : "text-white",
                              )}
                            >
                              {tpl.name}
                            </p>
                            <div
                              className={cn(
                                "flex items-center gap-2 mt-0.5 text-[11px]",
                                isFrost ? "text-slate-500" : "text-white/45",
                              )}
                            >
                              <span className="capitalize">{period}</span>
                              {target > 1 && (
                                <>
                                  <span aria-hidden>·</span>
                                  <span
                                    className={cn(
                                      "font-medium",
                                      filledCount > 0
                                        ? isFrost
                                          ? "text-amber-700"
                                          : "text-amber-300"
                                        : "",
                                    )}
                                  >
                                    {filledCount}/{target} planned
                                  </span>
                                </>
                              )}
                              {filledCount > 0 && target === 1 && (
                                <>
                                  <span aria-hidden>·</span>
                                  <span
                                    className={cn(
                                      isFrost
                                        ? "text-green-700"
                                        : "text-green-400",
                                    )}
                                  >
                                    partial
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Progress dots for multi-slot */}
                          {target > 1 && (
                            <div className="flex items-center gap-1 shrink-0">
                              {Array.from({ length: target }).map((_, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    i < filledCount
                                      ? isFrost
                                        ? "bg-green-500"
                                        : "bg-green-400"
                                      : isFrost
                                        ? "bg-slate-200"
                                        : "bg-white/15",
                                  )}
                                />
                              ))}
                            </div>
                          )}

                          <ChevronDown
                            className={cn(
                              "w-4 h-4 shrink-0 transition-transform duration-200",
                              isExpanded && "rotate-180",
                              isFrost ? "text-slate-400" : "text-white/35",
                            )}
                          />
                        </button>

                        {/* ── Expanded body: pickers ── */}
                        {isExpanded && (
                          <div
                            className={cn(
                              "px-4 pb-4 pt-3 space-y-4",
                              isFrost
                                ? "bg-indigo-50/40 border-t border-indigo-100"
                                : isPink
                                  ? "bg-pink-500/[0.04] border-t border-white/5"
                                  : "bg-cyan-500/[0.03] border-t border-white/5",
                            )}
                          >
                            {/* Already-scheduled chips */}
                            {scheduled.length > 0 && (
                              <div className="space-y-1">
                                {scheduled.map((item) => {
                                  const dueAt =
                                    item.reminder_details?.due_at ??
                                    item.event_details?.start_at;
                                  if (!dueAt) return null;
                                  const d = new Date(dueAt);
                                  return (
                                    <div
                                      key={item.id}
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
                                          {format(d, "EEE, MMM d")} ·{" "}
                                          {format(d, "h:mm a")}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={
                                          pending === `clear-${item.id}`
                                        }
                                        onClick={() =>
                                          handleClearScheduled(item)
                                        }
                                        className={cn(
                                          "text-[11px] px-2 py-0.5 rounded-md transition-all disabled:opacity-50",
                                          isFrost
                                            ? "text-slate-500 hover:bg-white"
                                            : "text-white/45 hover:bg-white/10 hover:text-white/75",
                                        )}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Picker rows for remaining slots */}
                            {Array.from({ length: needsCount }).map(
                              (_, slotIdx) => {
                                const realIdx = filledCount + slotIdx;
                                const key = `${tpl.id}:${realIdx}`;
                                const showSlotLabel = target > 1;
                                const showDivider = slotIdx > 0;
                                return (
                                  <div
                                    key={key}
                                    className={cn(
                                      "space-y-2.5",
                                      showDivider &&
                                        (isFrost
                                          ? "pt-3 border-t border-slate-100"
                                          : "pt-3 border-t border-white/5"),
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
                                        Slot {realIdx + 1}
                                      </div>
                                    )}
                                    {period === "weekly" ? (
                                      <DayTimePicker
                                        weekDays={weekDays}
                                        dayIndex={getDay(key)}
                                        time={getTime(key, tpl.preferred_time)}
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
                                        time={getTime(key, tpl.preferred_time)}
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
                                    <AlertOffsetPicker
                                      value={getAlert(key, 0)}
                                      onChange={(v) =>
                                        setAlertSel((s) => ({
                                          ...s,
                                          [key]: v,
                                        }))
                                      }
                                    />
                                    {tpl.item_type !== "reminder" && (
                                      <div
                                        className={cn(
                                          "flex items-center gap-2 rounded-lg px-2 py-1.5",
                                          isFrost
                                            ? "bg-slate-100 border border-slate-200"
                                            : "bg-white/5 border border-white/10",
                                        )}
                                      >
                                        <Clock
                                          className={cn(
                                            "w-3.5 h-3.5 shrink-0",
                                            isFrost
                                              ? "text-slate-500"
                                              : "text-white/55",
                                          )}
                                        />
                                        <span
                                          className={cn(
                                            "text-[11px] font-medium shrink-0",
                                            isFrost
                                              ? "text-slate-600"
                                              : "text-white/65",
                                          )}
                                        >
                                          Duration
                                        </span>
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={
                                            durationSel[key] ??
                                            (tpl.preferred_duration_minutes
                                              ? String(
                                                  tpl.preferred_duration_minutes,
                                                )
                                              : "")
                                          }
                                          onChange={(e) =>
                                            setDurationSel((s) => ({
                                              ...s,
                                              [key]: e.target.value.replace(
                                                /[^0-9]/g,
                                                "",
                                              ),
                                            }))
                                          }
                                          placeholder="60"
                                          className={cn(
                                            "w-14 rounded-md px-1.5 py-0.5 text-[12px] font-medium bg-transparent outline-none",
                                            isFrost
                                              ? "text-slate-800 border border-slate-300"
                                              : "text-white border border-white/15 focus:border-white/30",
                                          )}
                                        />
                                        <span
                                          className={cn(
                                            "text-[11px]",
                                            isFrost
                                              ? "text-slate-500"
                                              : "text-white/45",
                                          )}
                                        >
                                          min
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between gap-2 pt-1">
                                      {slotIdx === 0 ? (
                                        <button
                                          type="button"
                                          disabled={!!pending}
                                          onClick={() =>
                                            handleSkipTemplate(tpl, period)
                                          }
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
                                            : "Skip this period"}
                                        </button>
                                      ) : (
                                        <span />
                                      )}
                                      <button
                                        type="button"
                                        disabled={!!pending}
                                        onClick={() =>
                                          handlePlanSlot(tpl, realIdx, period)
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
                                            ? `Plan slot ${realIdx + 1}`
                                            : "Plan it"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* ── Already added (collapsible) ── */}
              {completedEntries.length > 0 && (
                <div
                  className={cn(
                    "rounded-2xl border overflow-hidden",
                    isFrost ? "border-slate-200" : "border-white/10",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setCompletedOpen((v) => !v)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
                      isFrost
                        ? "hover:bg-slate-50 text-slate-700"
                        : "hover:bg-white/[0.03] text-white/70",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2
                        className={cn(
                          "w-4 h-4",
                          isFrost ? "text-green-600" : "text-green-400",
                        )}
                      />
                      <span className="text-[13px] font-medium">
                        Already added
                      </span>
                      <span
                        className={cn(
                          "text-[11px] px-1.5 py-0.5 rounded-full font-semibold",
                          isFrost
                            ? "bg-green-100 text-green-700"
                            : "bg-green-500/15 text-green-300",
                        )}
                      >
                        {completedEntries.length}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform duration-200",
                        completedOpen && "rotate-180",
                        isFrost ? "text-slate-400" : "text-white/35",
                      )}
                    />
                  </button>

                  {completedOpen && (
                    <ul
                      className={cn(
                        "divide-y",
                        isFrost ? "divide-slate-100" : "divide-white/5",
                      )}
                    >
                      {completedEntries.map((entry) => {
                        const { tpl, scheduled, target } = entry;
                        return (
                          <li key={tpl.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "text-[13px] font-semibold truncate",
                                    isFrost
                                      ? "text-slate-800"
                                      : "text-white/85",
                                  )}
                                >
                                  {tpl.name}
                                </p>
                                {target > 1 && (
                                  <p
                                    className={cn(
                                      "text-[11px]",
                                      isFrost
                                        ? "text-green-700"
                                        : "text-green-400",
                                    )}
                                  >
                                    {scheduled.length} of {target} planned
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              {scheduled.map((item) => {
                                const dueAt =
                                  item.reminder_details?.due_at ??
                                  item.event_details?.start_at;
                                if (!dueAt) return null;
                                const d = new Date(dueAt);
                                return (
                                  <div
                                    key={item.id}
                                    className={cn(
                                      "flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-[12px]",
                                      isFrost
                                        ? "bg-green-50 ring-1 ring-green-100"
                                        : "bg-green-500/[0.07] ring-1 ring-green-400/15",
                                    )}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <CheckCircle2
                                        className={cn(
                                          "w-3 h-3 shrink-0",
                                          isFrost
                                            ? "text-green-600"
                                            : "text-green-400",
                                        )}
                                      />
                                      <span
                                        className={cn(
                                          "truncate",
                                          isFrost
                                            ? "text-green-800"
                                            : "text-green-200",
                                        )}
                                      >
                                        {format(d, "EEE, MMM d")} ·{" "}
                                        {format(d, "h:mm a")}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={pending === `clear-${item.id}`}
                                      onClick={() => handleClearScheduled(item)}
                                      className={cn(
                                        "text-[11px] px-2 py-0.5 rounded-md transition-all disabled:opacity-50 shrink-0",
                                        isFrost
                                          ? "text-slate-500 hover:bg-white"
                                          : "text-white/40 hover:bg-white/10 hover:text-white/70",
                                      )}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
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

// ─── DayTimePicker (weekly: 7-day grid + time) ───────────────────────────────

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
  const selectedDayLabel = selectedDay ? format(selectedDay, "EEE, MMM d") : "";

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

// ─── DateTimePicker (biweekly/monthly) ───────────────────────────────────────

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

// ─── AlertOffsetPicker ────────────────────────────────────────────────────────

interface AlertOffsetPickerProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

function AlertOffsetPicker({ value, onChange }: AlertOffsetPickerProps) {
  const { theme } = useTheme();
  const isFrost = theme === "frost";
  const isPink = theme === "pink";

  // The whole bar shows label + scrollable chips — small but clear.
  const baseChip = isFrost
    ? "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-white"
    : "bg-white/[0.04] text-white/55 ring-1 ring-white/10 hover:bg-white/[0.07]";
  const activeChip = isFrost
    ? "bg-indigo-600 text-white ring-1 ring-indigo-600 shadow-sm"
    : isPink
      ? "bg-pink-500/25 text-pink-50 ring-1 ring-pink-400/55"
      : "bg-cyan-500/25 text-cyan-50 ring-1 ring-cyan-400/55";
  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "text-[10px] uppercase tracking-[0.12em] font-semibold inline-flex items-center gap-1.5",
          isFrost ? "text-slate-400" : "text-white/35",
        )}
      >
        {value === null ? (
          <BellOff className="w-3 h-3" />
        ) : (
          <BellRing className="w-3 h-3" />
        )}
        Alert
      </div>
      <div className="flex flex-wrap gap-1">
        {ALERT_OPTIONS.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all",
                isActive ? activeChip : baseChip,
              )}
            >
              {opt.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// keep export for misc consumers
export type { AlertOffsetPickerProps };

// Suppress unused imports complaint (these may be referenced later in icons row)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unusedIcons = AlertCircle;
