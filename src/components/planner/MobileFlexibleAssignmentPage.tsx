"use client";

import type {
  RecurringFilter,
  TypeFilter,
  UserFilter,
} from "@/components/activity/FilterBar";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useTheme } from "@/contexts/ThemeContext";
import { useCatalogueItems, useCatalogueModules } from "@/features/catalogue";
import { usePartnerId } from "@/features/hub/usePartnerId";
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
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { localToISO } from "@/lib/utils/date";
import type { CatalogueItem } from "@/types/catalogue";
import type {
  CreateSubtaskInput,
  FlexiblePeriod,
  ItemPriority,
  ItemType,
  ItemWithDetails,
} from "@/types/items";
import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from "date-fns";
import {
  Bell,
  BookMarked,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  ListTodo,
  Moon,
  Sparkles,
  Sun,
  Sunrise,
  Timer,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

const PERIOD_ORDER: FlexiblePeriod[] = ["weekly", "biweekly", "monthly"];

const periodLabels: Record<FlexiblePeriod, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

const typeIcons: Record<ItemType, typeof CalendarCheck2> = {
  reminder: Bell,
  event: CalendarCheck2,
  task: ListTodo,
};

const typeColor: Record<ItemType, { bg: string; text: string }> = {
  event: { bg: "bg-pink-500/10", text: "text-pink-400" },
  reminder: { bg: "bg-cyan-500/10", text: "text-cyan-400" },
  task: { bg: "bg-purple-500/10", text: "text-purple-400" },
};

type CatalogueFlexibleEntry = {
  tpl: CatalogueItem;
  period: FlexiblePeriod;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  target: number;
  scheduled: ItemWithDetails[];
  flexibleScheduledCount: number;
  scheduledCount: number;
  needsCount: number;
};

interface MobileFlexibleAssignmentPageProps {
  selectedDate: Date;
  onSelectedDateChange: Dispatch<SetStateAction<Date>>;
  userFilter?: UserFilter;
  currentUserId?: string;
  typeFilter?: TypeFilter;
  recurringFilter?: RecurringFilter;
}

function isFlexiblePeriod(value: unknown): value is FlexiblePeriod {
  return (
    typeof value === "string" && PERIOD_ORDER.includes(value as FlexiblePeriod)
  );
}

function parseSubtasks(text: string | null | undefined): CreateSubtaskInput[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      title: line.replace(/^[-*\u2022]\s*|\d+\.\s*/g, "").trim(),
      order_index: index,
    }))
    .filter((subtask) => subtask.title.length > 0);
}

function normalizeTime(time: string | null | undefined): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}

function scheduledAt(item: ItemWithDetails): string | null {
  return item.reminder_details?.due_at ?? item.event_details?.start_at ?? null;
}

function toItemType(type: CatalogueItem["item_type"]): "reminder" | "task" {
  return type === "reminder" ? "reminder" : "task";
}

function toItemPriority(priority: CatalogueItem["priority"]): ItemPriority {
  return priority === "critical" ? "urgent" : priority;
}

function getTimeLabel(time?: string | null): string {
  const normalized = normalizeTime(time);
  if (!normalized) return "Template time";
  const [hours, minutes] = normalized.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return format(date, "h:mm a");
}

function getSlotLabel(date: Date): string {
  if (isSameDay(date, new Date())) return "Today";
  if (isSameDay(date, addDays(new Date(), 1))) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

function getRoutineSourceId(item: FlexibleRoutineItem): string | null {
  return (
    (item as ItemWithDetails & { source_catalogue_item_id?: string | null })
      .source_catalogue_item_id ?? null
  );
}

function getRoutineScheduleKey(item: FlexibleRoutineItem): string | null {
  const schedule = item.flexibleSchedule;
  if (!schedule) return null;
  return `${item.id}:${schedule.period_start_date}:${schedule.occurrence_index ?? 0}`;
}

export default function MobileFlexibleAssignmentPage({
  selectedDate,
  onSelectedDateChange,
  userFilter = "all",
  currentUserId,
  typeFilter = "all",
  recurringFilter = "all",
}: MobileFlexibleAssignmentPageProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [plannedOpen, setPlannedOpen] = useState(false);
  const [schedulingEntry, setSchedulingEntry] =
    useState<CatalogueFlexibleEntry | null>(null);
  const [pickedDate, setPickedDate] = useState(new Date());
  const [pickedTime, setPickedTime] = useState("09:00");
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [showOtherDate, setShowOtherDate] = useState(false);

  const { data: allItems = [], isLoading: itemsLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();
  const { data: catalogueModules = [], isLoading: modulesLoading } =
    useCatalogueModules();
  const { data: catalogueItems = [], isLoading: catalogueLoading } =
    useCatalogueItems();
  const { data: partnerUserId = null } = usePartnerId();
  const { data: flexibleRoutines } = useFlexibleRoutines(
    allItems.filter((item) => item.recurrence_rule?.is_flexible === true),
    occurrenceActions,
    selectedDate,
  );
  const scheduleRoutine = useScheduleRoutine();
  const unscheduleRoutine = useUnscheduleRoutine();
  const createReminder = useCreateReminder();
  const createTask = useCreateTask();
  const deleteItem = useDeleteItem();

  const selectedWeekStart = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 1 }),
    [selectedDate],
  );
  const selectedWeekEnd = useMemo(
    () => endOfWeek(selectedWeekStart, { weekStartsOn: 1 }),
    [selectedWeekStart],
  );
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        addDays(selectedWeekStart, index),
      ),
    [selectedWeekStart],
  );

  const tasksModuleId = useMemo(
    () => catalogueModules.find((module) => module.type === "tasks")?.id,
    [catalogueModules],
  );

  const flexibleTemplates = useMemo(() => {
    if (!tasksModuleId) return [];
    return catalogueItems.filter((item) => {
      if (item.module_id !== tasksModuleId) return false;
      if (!item.is_flexible_routine) return false;
      if (!isFlexiblePeriod(item.recurrence_pattern)) return false;
      if (item.archived_at || item.status === "archived") return false;
      if (typeFilter !== "all" && item.item_type !== typeFilter) return false;
      if (recurringFilter === "one-time") return false;
      return true;
    });
  }, [catalogueItems, recurringFilter, tasksModuleId, typeFilter]);

  const flexibleScheduledByTemplate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const routines = [
      ...(flexibleRoutines?.scheduled ?? []),
      ...(flexibleRoutines?.completed ?? []),
    ];

    for (const routine of routines) {
      const sourceId = getRoutineSourceId(routine);
      const scheduleKey = getRoutineScheduleKey(routine);
      if (!sourceId || !scheduleKey) continue;
      const list = map.get(sourceId) ?? new Set<string>();
      list.add(scheduleKey);
      map.set(sourceId, list);
    }

    return map;
  }, [flexibleRoutines?.completed, flexibleRoutines?.scheduled]);

  const unscheduledRoutineByTemplate = useMemo(() => {
    const map = new Map<string, FlexibleRoutineItem>();
    for (const routine of flexibleRoutines?.unscheduled ?? []) {
      const sourceId = getRoutineSourceId(routine);
      if (sourceId && !map.has(sourceId)) {
        map.set(sourceId, routine);
      }
    }
    return map;
  }, [flexibleRoutines?.unscheduled]);

  const catalogueEntries = useMemo<CatalogueFlexibleEntry[]>(() => {
    return flexibleTemplates
      .map((tpl) => {
        const period = tpl.recurrence_pattern as FlexiblePeriod;
        const { start, end } = getPeriodBoundaries(selectedWeekStart, period);
        const target = Math.max(1, tpl.flexible_occurrences ?? 1);
        const scheduled = allItems.filter((item) => {
          if (item.source_catalogue_item_id !== tpl.id) return false;
          if (item.recurrence_rule?.is_flexible) return false;
          const startsAt = scheduledAt(item);
          if (!startsAt) return false;
          return isWithinInterval(parseISO(startsAt), { start, end });
        });
        const flexibleScheduledCount =
          flexibleScheduledByTemplate.get(tpl.id)?.size ?? 0;
        const scheduledCount = scheduled.length + flexibleScheduledCount;

        return {
          tpl,
          period,
          periodStart: format(start, "yyyy-MM-dd"),
          periodEnd: format(end, "yyyy-MM-dd"),
          periodLabel: formatPeriodLabel(period, selectedWeekStart),
          target,
          scheduled,
          flexibleScheduledCount,
          scheduledCount,
          needsCount: Math.max(0, target - scheduledCount),
        };
      })
      .sort((a, b) => {
        const periodDiff =
          PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period);
        return periodDiff || a.tpl.name.localeCompare(b.tpl.name);
      });
  }, [
    allItems,
    flexibleScheduledByTemplate,
    flexibleTemplates,
    selectedWeekStart,
  ]);

  const entriesNeedingSlots = useMemo(
    () => catalogueEntries.filter((entry) => entry.needsCount > 0),
    [catalogueEntries],
  );

  const alreadyPlannedEntries = useMemo(
    () => catalogueEntries.filter((entry) => entry.scheduledCount > 0),
    [catalogueEntries],
  );

  const totalNeeded = entriesNeedingSlots.reduce(
    (total, entry) => total + entry.needsCount,
    0,
  );
  const totalPlanned = alreadyPlannedEntries.reduce(
    (total, entry) => total + entry.scheduledCount,
    0,
  );

  const defaultResponsibleUserId = (tpl: CatalogueItem) => {
    if (!tpl.is_public) return undefined;
    if (userFilter === "partner" && partnerUserId) return partnerUserId;
    if (userFilter === "mine" && currentUserId) return currentUserId;
    return undefined;
  };

  const getNextRoutineOccurrenceIndex = (routine: FlexibleRoutineItem) => {
    const usedIndexes = new Set<number>();
    const routines = [
      ...(flexibleRoutines?.scheduled ?? []),
      ...(flexibleRoutines?.completed ?? []),
    ];

    for (const candidate of routines) {
      if (candidate.id !== routine.id || !candidate.flexibleSchedule) continue;
      usedIndexes.add(candidate.flexibleSchedule.occurrence_index ?? 0);
    }

    const target = routine.targetOccurrences ?? 1;
    for (let index = 0; index < target; index++) {
      if (!usedIndexes.has(index)) return index;
    }
    return usedIndexes.size;
  };

  const openScheduler = (entry: CatalogueFlexibleEntry) => {
    const periodStart = parseISO(entry.periodStart);
    const periodEnd = parseISO(entry.periodEnd);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const fallsInPeriod = isWithinInterval(selectedDate, {
      start: periodStart,
      end: periodEnd,
    });
    const defaultDate = fallsInPeriod
      ? selectedDate
      : periodStart > todayStart
        ? periodStart
        : todayStart;

    setPickedDate(defaultDate);
    setPickedTime(normalizeTime(entry.tpl.preferred_time) || "09:00");
    setShowCustomTime(false);
    setShowOtherDate(false);
    setInlineError(null);
    setSchedulingEntry(entry);
  };

  const planEntry = async (
    entry: CatalogueFlexibleEntry,
    date: Date,
    time: string,
  ) => {
    const { tpl } = entry;
    const key = `${tpl.id}:${entry.periodStart}`;
    const dateForEntry = format(date, "yyyy-MM-dd");
    const routine = unscheduledRoutineByTemplate.get(tpl.id);

    setInlineError(null);
    setPendingKey(key);
    try {
      if (routine) {
        const occurrenceIndex = getNextRoutineOccurrenceIndex(routine);
        await scheduleRoutine.mutateAsync({
          itemId: routine.id,
          periodStartDate: routine.periodStart,
          scheduledForDate: dateForEntry,
          scheduledForTime: time,
          occurrenceIndex,
        });

        toast.success(`"${tpl.name}" added to ${getSlotLabel(date)}`, {
          icon: ToastIcons.create,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () =>
              unscheduleRoutine.mutate(
                {
                  itemId: routine.id,
                  periodStartDate: routine.periodStart,
                  occurrenceIndex,
                },
                {
                  onError: () => setInlineError("Could not undo that slot."),
                },
              ),
          },
        });
        setSchedulingEntry(null);
        return;
      }

      const dueAtIso = localToISO(dateForEntry, time);
      const subtasks = parseSubtasks(tpl.subtasks_text);
      const duration =
        typeof tpl.preferred_duration_minutes === "number" &&
        tpl.preferred_duration_minutes > 0
          ? tpl.preferred_duration_minutes
          : undefined;
      const priority = toItemPriority(tpl.priority);
      const categoryIds = tpl.item_category_ids?.length
        ? tpl.item_category_ids
        : undefined;
      const locationContext = tpl.location_context ?? undefined;
      const locationText = tpl.location_url ?? undefined;
      const prerequisites =
        (tpl.metadata_json?.trigger_conditions as
          | import("@/types/prerequisites").CreatePrerequisiteInput[]
          | undefined) || undefined;
      const alerts = [
        {
          kind: "absolute" as const,
          trigger_at: dueAtIso,
          channel: "push" as const,
        },
      ];

      let createdId: string | undefined;
      if (toItemType(tpl.item_type) === "reminder") {
        const created = await createReminder.mutateAsync({
          type: "reminder",
          title: tpl.name,
          description: tpl.description || undefined,
          priority,
          is_public: tpl.is_public,
          responsible_user_id: defaultResponsibleUserId(tpl),
          due_at: dueAtIso,
          estimate_minutes: duration,
          has_checklist: subtasks.length > 0,
          subtasks,
          alerts,
          category_ids: categoryIds,
          location_context: locationContext,
          location_text: locationText,
          prerequisites,
          source_catalogue_item_id: tpl.id,
          is_template_instance: true,
          is_chore: tpl.is_chore || false,
        });
        createdId = created?.id;
      } else {
        const created = await createTask.mutateAsync({
          type: "task",
          title: tpl.name,
          description: tpl.description || undefined,
          priority,
          is_public: tpl.is_public,
          responsible_user_id: defaultResponsibleUserId(tpl),
          due_at: dueAtIso,
          estimate_minutes: duration,
          subtasks: subtasks.length > 0 ? subtasks : undefined,
          alerts,
          category_ids: categoryIds,
          location_context: locationContext,
          location_text: locationText,
          prerequisites,
          source_catalogue_item_id: tpl.id,
          is_template_instance: true,
          is_chore: tpl.is_chore || false,
        });
        createdId = created?.id;
      }

      if (!createdId) throw new Error("Item creation failed");

      toast.success(`"${tpl.name}" added to ${getSlotLabel(date)}`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () =>
            deleteItem.mutate(createdId, {
              onError: () => setInlineError("Could not undo that slot."),
            }),
        },
      });
      setSchedulingEntry(null);
    } catch {
      setInlineError("Could not add that routine to the calendar.");
    } finally {
      setPendingKey(null);
    }
  };

  const isLoading = itemsLoading || catalogueLoading || modulesLoading;
  const isMutating =
    createReminder.isPending ||
    createTask.isPending ||
    deleteItem.isPending ||
    scheduleRoutine.isPending ||
    unscheduleRoutine.isPending;

  const dayChipOptions = useMemo(() => {
    if (!schedulingEntry) return [];
    const periodStart = parseISO(schedulingEntry.periodStart);
    const periodEnd = parseISO(schedulingEntry.periodEnd);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const base = periodStart > todayStart ? periodStart : todayStart;
    const days: Date[] = [];
    for (let i = 0; days.length < 6; i++) {
      const day = addDays(base, i);
      if (day > periodEnd) break;
      days.push(day);
    }
    return days;
  }, [schedulingEntry]);

  const timeChipOptions = useMemo(() => {
    if (!schedulingEntry) return [];
    const usual = normalizeTime(schedulingEntry.tpl.preferred_time);
    const options: { label: string; value: string; icon: typeof Clock }[] = [];
    if (usual) {
      options.push({
        label: `Usual · ${getTimeLabel(usual)}`,
        value: usual,
        icon: Clock,
      });
    }
    const standard: { label: string; value: string; icon: typeof Clock }[] = [
      { label: "Morning", value: "08:00", icon: Sunrise },
      { label: "Midday", value: "12:00", icon: Sun },
      { label: "Evening", value: "18:00", icon: Moon },
    ];
    for (const option of standard) {
      if (option.value !== usual) options.push(option);
    }
    return options;
  }, [schedulingEntry]);

  const cardBg = isFrost
    ? "bg-white border-slate-200"
    : "bg-white/[0.04] border-white/[0.08]";
  const fieldBg = isFrost
    ? "bg-slate-50 border-slate-200"
    : "bg-white/[0.04] border-white/[0.08]";
  const mainText = isFrost ? "text-slate-800" : "text-white/90";
  const softText = isFrost ? "text-slate-500" : "text-white/55";
  const subtleText = isFrost ? "text-slate-400" : "text-white/35";
  const ghostButton = isFrost
    ? "bg-slate-100 text-slate-600"
    : "bg-white/5 text-white/60";
  const accentButton = isPink
    ? "bg-pink-500/25 text-pink-50 ring-1 ring-pink-400/45"
    : isFrost
      ? "bg-indigo-600 text-white"
      : "bg-cyan-500/25 text-cyan-50 ring-1 ring-cyan-400/45";
  const activeBadge = isPink
    ? "bg-pink-500/20 text-pink-300"
    : isFrost
      ? "bg-indigo-50 text-indigo-600"
      : "bg-cyan-500/20 text-cyan-300";

  const renderEmptyState = () => (
    <div className={cn("text-center py-9 rounded-2xl border", cardBg)}>
      <Inbox className={cn("w-7 h-7 mx-auto mb-2", subtleText)} />
      <p className={cn("text-sm font-semibold", mainText)}>
        {flexibleTemplates.length === 0
          ? "No flexible catalogue routines"
          : "Everything flexible is planned"}
      </p>
      <p className={cn("mt-1 text-xs", subtleText)}>
        {flexibleTemplates.length === 0
          ? "Mark task catalogue items as flexible to schedule them here."
          : "This week already has the slots it needs."}
      </p>
    </div>
  );

  const renderEntryCard = (entry: CatalogueFlexibleEntry, index: number) => {
    const { tpl } = entry;
    const itemType = toItemType(tpl.item_type);
    const Icon = typeIcons[itemType];
    const colors = typeColor[itemType];
    const key = `${tpl.id}:${entry.periodStart}`;
    const pending = pendingKey === key;

    return (
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: Math.min(index, 6) * 0.03 }}
        className={cn("rounded-2xl border p-3.5 space-y-3", cardBg)}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
              colors.bg,
              colors.text,
            )}
          >
            <Icon className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className={cn("text-sm font-semibold truncate", mainText)}>
                {tpl.name}
              </p>
              <Sparkles
                className={cn("w-3.5 h-3.5 flex-shrink-0", subtleText)}
              />
            </div>
            {tpl.description && (
              <p className={cn("mt-0.5 text-xs line-clamp-2", softText)}>
                {tpl.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span
            className={cn("rounded-full px-2 py-1 text-[11px]", activeBadge)}
          >
            {periodLabels[entry.period]}
          </span>
          <span
            className={cn("rounded-full px-2 py-1 text-[11px]", ghostButton)}
          >
            {entry.needsCount} left
          </span>
          {entry.target > 1 && (
            <span
              className={cn("rounded-full px-2 py-1 text-[11px]", ghostButton)}
            >
              {entry.scheduledCount}/{entry.target} planned
            </span>
          )}
          {tpl.preferred_duration_minutes ? (
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[11px] inline-flex items-center gap-1",
                ghostButton,
              )}
            >
              <Timer className="w-3 h-3" />
              {tpl.preferred_duration_minutes}m
            </span>
          ) : null}
          {tpl.preferred_time ? (
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[11px] inline-flex items-center gap-1",
                ghostButton,
              )}
            >
              <Clock className="w-3 h-3" />
              Usual {getTimeLabel(tpl.preferred_time)}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          disabled={isMutating || pending}
          onClick={() => openScheduler(entry)}
          className={cn(
            "w-full h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-45",
            accentButton,
          )}
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          {pending
            ? "Adding…"
            : entry.target > 1
              ? "Schedule a slot"
              : "Schedule"}
        </button>
      </motion.div>
    );
  };

  return (
    <>
      <div className="min-h-full p-4 pb-28 space-y-5">
        <section className={cn("rounded-2xl border p-4 space-y-4", cardBg)}>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onSelectedDateChange((date) => addDays(date, -7))}
              aria-label="Previous week"
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                ghostButton,
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center min-w-0">
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  subtleText,
                )}
              >
                This week
              </p>
              <p className={cn("text-base font-semibold", mainText)}>
                {format(selectedWeekStart, "MMM d")} -{" "}
                {format(selectedWeekEnd, "MMM d")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onSelectedDateChange((date) => addDays(date, 7))}
              aria-label="Next week"
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                ghostButton,
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const selected = isSameDay(day, selectedDate);
              return (
                <button
                  key={format(day, "yyyy-MM-dd")}
                  type="button"
                  onClick={() => onSelectedDateChange(day)}
                  className={cn(
                    "h-12 rounded-xl flex flex-col items-center justify-center text-[10px] font-semibold",
                    selected ? activeBadge : ghostButton,
                  )}
                >
                  <span className="uppercase opacity-70">
                    {format(day, "EEE")}
                  </span>
                  <span className="text-sm leading-none mt-0.5">
                    {format(day, "d")}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className={cn("rounded-xl px-3 py-2", activeBadge)}>
              <p className="text-lg font-bold">{totalNeeded}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider">
                To add
              </p>
            </div>
            <div className={cn("rounded-xl px-3 py-2", ghostButton)}>
              <p className="text-lg font-bold">{totalPlanned}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider">
                Planned
              </p>
            </div>
          </div>

          {inlineError && (
            <p className="text-xs text-amber-400 px-1">{inlineError}</p>
          )}
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div
              className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                isPink ? "bg-pink-400" : "bg-cyan-400",
              )}
            />
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      subtleText,
                    )}
                  >
                    Flexible catalogue
                  </h2>
                  <p className={cn("mt-0.5 text-xs", subtleText)}>
                    {entriesNeedingSlots.length > 0
                      ? "Pick a routine and add it to the selected day."
                      : "No flexible routines are waiting for this period."}
                  </p>
                </div>
                <BookMarked className={cn("w-4 h-4", subtleText)} />
              </div>

              {entriesNeedingSlots.length === 0
                ? renderEmptyState()
                : entriesNeedingSlots.map(renderEntryCard)}
            </section>

            {alreadyPlannedEntries.length > 0 && (
              <section className="rounded-2xl border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPlannedOpen((open) => !open)}
                  className={cn(
                    "w-full px-4 py-3 flex items-center justify-between",
                    cardBg,
                  )}
                >
                  <span className={cn("text-sm font-semibold", mainText)}>
                    Already on calendar
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px]",
                      activeBadge,
                    )}
                  >
                    {totalPlanned}
                  </span>
                </button>

                {plannedOpen && (
                  <div className={cn("border-t px-4 py-3 space-y-3", cardBg)}>
                    {alreadyPlannedEntries.map((entry) => (
                      <div
                        key={`${entry.tpl.id}:planned`}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              mainText,
                            )}
                          >
                            {entry.tpl.name}
                          </p>
                          <span className={cn("text-[11px]", subtleText)}>
                            {entry.scheduledCount}/{entry.target}
                          </span>
                        </div>

                        {entry.scheduled.slice(0, 3).map((item) => {
                          const startsAt = scheduledAt(item);
                          if (!startsAt) return null;
                          const parsed = parseISO(startsAt);
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "rounded-xl px-3 py-2 text-xs flex items-center gap-2",
                                fieldBg,
                              )}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span className={cn("truncate", softText)}>
                                {format(parsed, "EEE, MMM d")} at{" "}
                                {format(parsed, "h:mm a")}
                              </span>
                            </div>
                          );
                        })}

                        {entry.flexibleScheduledCount > 0 && (
                          <div
                            className={cn(
                              "rounded-xl px-3 py-2 text-xs flex items-center gap-2",
                              fieldBg,
                            )}
                          >
                            <CalendarCheck2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span className={cn("truncate", softText)}>
                              {entry.flexibleScheduledCount} active flexible
                              slot
                              {entry.flexibleScheduledCount === 1 ? "" : "s"}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <Drawer
        open={schedulingEntry !== null}
        onOpenChange={(open) => {
          if (!open) setSchedulingEntry(null);
        }}
      >
        <DrawerContent
          className={cn(
            "border-t",
            isFrost
              ? "bg-white border-slate-200"
              : cn(
                  "bg-gray-900/95 backdrop-blur-xl",
                  isPink ? "border-pink-500/30" : "border-cyan-500/30",
                ),
          )}
        >
          <DrawerHeader>
            <DrawerTitle
              className={cn("flex items-center gap-2 text-base", mainText)}
            >
              <CalendarPlus
                className={cn(
                  "w-5 h-5",
                  isPink
                    ? "text-pink-400"
                    : isFrost
                      ? "text-indigo-600"
                      : "text-cyan-400",
                )}
              />
              <span className="truncate">
                Schedule &quot;{schedulingEntry?.tpl.name}&quot;
              </span>
            </DrawerTitle>
            {schedulingEntry && (
              <p className={cn("text-xs", subtleText)}>
                {periodLabels[schedulingEntry.period]} ·{" "}
                {schedulingEntry.scheduledCount}/{schedulingEntry.target}{" "}
                planned
              </p>
            )}
          </DrawerHeader>

          {schedulingEntry && (
            <div className="px-4 pb-2 space-y-5 max-h-[55vh] overflow-y-auto">
              <div className="space-y-2">
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    subtleText,
                  )}
                >
                  When
                </p>
                <div className="flex flex-wrap gap-2">
                  {dayChipOptions.map((day) => {
                    const active = !showOtherDate && isSameDay(day, pickedDate);
                    return (
                      <button
                        key={format(day, "yyyy-MM-dd")}
                        type="button"
                        onClick={() => {
                          setPickedDate(day);
                          setShowOtherDate(false);
                        }}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-semibold",
                          active ? accentButton : ghostButton,
                        )}
                      >
                        {getSlotLabel(day)}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setShowOtherDate(true)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5",
                      showOtherDate ? accentButton : ghostButton,
                    )}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    Other date
                  </button>
                </div>
                {showOtherDate && (
                  <input
                    type="date"
                    value={format(pickedDate, "yyyy-MM-dd")}
                    min={schedulingEntry.periodStart}
                    max={schedulingEntry.periodEnd}
                    onChange={(event) => {
                      if (event.target.value)
                        setPickedDate(parseISO(event.target.value));
                    }}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-sm focus:outline-none",
                      fieldBg,
                      mainText,
                    )}
                  />
                )}
              </div>

              <div className="space-y-2">
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    subtleText,
                  )}
                >
                  What time
                </p>
                <div className="flex flex-wrap gap-2">
                  {timeChipOptions.map((option) => {
                    const active =
                      !showCustomTime && pickedTime === option.value;
                    const OptionIcon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setPickedTime(option.value);
                          setShowCustomTime(false);
                        }}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5",
                          active ? accentButton : ghostButton,
                        )}
                      >
                        <OptionIcon className="w-3.5 h-3.5" />
                        {option.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setShowCustomTime(true)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5",
                      showCustomTime ? accentButton : ghostButton,
                    )}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Custom
                  </button>
                </div>
                {showCustomTime && (
                  <input
                    type="time"
                    value={pickedTime}
                    onChange={(event) =>
                      setPickedTime(event.target.value || pickedTime)
                    }
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-sm focus:outline-none",
                      fieldBg,
                      mainText,
                    )}
                  />
                )}
              </div>

              <div
                className={cn(
                  "rounded-xl px-3 py-2 text-xs flex items-center gap-2",
                  fieldBg,
                )}
              >
                <Clock
                  className={cn("w-3.5 h-3.5 flex-shrink-0", subtleText)}
                />
                <span className={cn("truncate", softText)}>
                  Adding for {getSlotLabel(pickedDate)},{" "}
                  {format(pickedDate, "MMM d")} at {getTimeLabel(pickedTime)}
                </span>
              </div>

              {inlineError && (
                <p className="text-xs text-amber-400">{inlineError}</p>
              )}
            </div>
          )}

          <DrawerFooter className="flex-row gap-2">
            <DrawerClose asChild>
              <button
                type="button"
                className={cn(
                  "flex-1 h-10 rounded-xl text-xs font-semibold",
                  ghostButton,
                )}
              >
                Cancel
              </button>
            </DrawerClose>
            <button
              type="button"
              disabled={isMutating}
              onClick={() =>
                schedulingEntry &&
                planEntry(schedulingEntry, pickedDate, pickedTime)
              }
              className={cn(
                "flex-1 h-10 rounded-xl text-xs font-semibold disabled:opacity-50",
                accentButton,
              )}
            >
              {isMutating ? "Adding…" : "Add to plan"}
            </button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
