"use client";

import { useTheme } from "@/contexts/ThemeContext";
import type { Checkpoint, DayPlan, DayPlanIntent } from "@/features/day-plan/types";
import {
  useCheckpointActions,
  useDayPlan,
  useDeleteDayPlan,
  useUpsertDayPlan,
} from "@/features/day-plan/useDayPlan";
import {
  useFlexibleRoutines,
  useScheduleRoutine,
  useUnscheduleRoutine,
  type FlexibleRoutineItem,
} from "@/features/items/useFlexibleRoutines";
import {
  useAllOccurrenceActions,
  useDeleteItemWithUndo,
  useItemActionsWithToast,
} from "@/features/items/useItemActions";
import { useCreateReminder, useItems } from "@/features/items/useItems";
import {
  getMemberDisplayName,
  useHouseholdMembers,
} from "@/hooks/useHouseholdMembers";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { getOccurrencesForDay } from "@/lib/utils/dayOccurrences";
import type {
  FlexibleSchedule,
  ItemType,
  ItemWithDetails,
} from "@/types/items";
import { addDays, format, parseISO, subDays } from "date-fns";
import {
  Bell,
  Calendar,
  CalendarOff,
  ChevronDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Inbox,
  ListTodo,
  Lock,
  Moon,
  PencilLine,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const typeIcons: Record<ItemType, typeof Calendar> = {
  reminder: Bell,
  event: Calendar,
  task: ListTodo,
};

const typeColor: Record<ItemType, { bg: string; text: string }> = {
  event: { bg: "bg-pink-500/10", text: "text-pink-400" },
  reminder: { bg: "bg-cyan-500/10", text: "text-cyan-400" },
  task: { bg: "bg-purple-500/10", text: "text-purple-400" },
};

const INTENT_OPTIONS: {
  value: DayPlanIntent;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "rest", label: "Rest", icon: Moon },
  { value: "balanced", label: "Balanced", icon: Sparkles },
  { value: "productive", label: "Productive", icon: Sun },
];

// item_flexible_schedules + period fields are injected onto FlexibleRoutineItem at
// runtime by getOccurrencesForDay/useFlexibleRoutines but ExpandedOccurrence types
// item as the plain ItemWithDetails — read them back out defensively.
function asFlexInfo(item: ItemWithDetails): {
  schedule: FlexibleSchedule | null;
  periodStart: string | null;
} {
  const flex = item as Partial<FlexibleRoutineItem>;
  return {
    schedule: flex.flexibleSchedule ?? null,
    periodStart: flex.periodStart ?? null,
  };
}

interface WebDayPlannerProps {
  initialDate?: string;
}

type PlannerMode = "preview" | "edit";

export default function WebDayPlanner({ initialDate }: WebDayPlannerProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const partnerAccent = isPink ? "text-blue-400" : "text-pink-400";

  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    initialDate ? parseISO(initialDate) : new Date(),
  );
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const [pushOffOpenKey, setPushOffOpenKey] = useState<string | null>(null);
  const [customDateDraft, setCustomDateDraft] = useState("");
  const [landingSectionOpen, setLandingSectionOpen] = useState(false);
  const [preponePoolOpen, setPreponePoolOpen] = useState(false);
  const [mode, setMode] = useState<PlannerMode>("edit");
  const [titleDraft, setTitleDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [intentDraft, setIntentDraft] = useState<DayPlanIntent | null>(null);
  const [isPublicDraft, setIsPublicDraft] = useState(false);
  const [checkpointsDraft, setCheckpointsDraft] = useState<Checkpoint[]>([]);
  const [checkpointTime, setCheckpointTime] = useState("");
  const [checkpointLabel, setCheckpointLabel] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const draftPlanKeyRef = useRef<string | null>(null);

  const { data: allItems = [], isLoading: itemsLoading } = useItems();
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();
  const { data: householdData } = useHouseholdMembers();
  const members = householdData?.members ?? [];

  const { data: dayPlanData, isLoading: dayPlanLoading } = useDayPlan(dateStr);
  const plan = dayPlanData?.mine ?? null;
  const partnerPlan = dayPlanData?.partner ?? null;
  const partnerName = partnerPlan
    ? getMemberDisplayName(members, partnerPlan.user_id)
    : null;

  // Re-seed drafts only when the date or the saved plan identity changes — not on every
  // keystroke, and not on the live checkpoint-toggle refetch (same plan.id, new array ref).
  useEffect(() => {
    const planKey = `${dateStr}:${plan?.id ?? "new"}`;
    if (draftPlanKeyRef.current === planKey) return;
    draftPlanKeyRef.current = planKey;
    setTitleDraft(plan?.title ?? "");
    setNotesDraft(plan?.notes ?? "");
    setIntentDraft(plan?.intent ?? null);
    setIsPublicDraft(plan?.is_public ?? false);
    setCheckpointsDraft(plan?.checkpoints ?? []);
    setMode(plan?.id ? "preview" : "edit");
  }, [
    dateStr,
    plan?.id,
    plan?.intent,
    plan?.notes,
    plan?.title,
    plan?.is_public,
    plan?.checkpoints,
  ]);

  const upsertDayPlan = useUpsertDayPlan();
  const deleteDayPlan = useDeleteDayPlan();
  const { toggleCheckpoint } = useCheckpointActions(plan, dateStr);

  const seedDraftsFrom = (source: DayPlan | null) => {
    setTitleDraft(source?.title ?? "");
    setNotesDraft(source?.notes ?? "");
    setIntentDraft(source?.intent ?? null);
    setIsPublicDraft(source?.is_public ?? false);
    setCheckpointsDraft(source?.checkpoints ?? []);
  };

  const handleStartEdit = () => {
    seedDraftsFrom(plan);
    setMode("edit");
  };

  const handleCancelEdit = () => {
    seedDraftsFrom(plan);
    setMode("preview");
  };

  // One POST per Save — never on individual field edits (Private/Shared, intent, etc. used to
  // fire a request per click; now they only mutate local draft state until this fires).
  const handleSave = async () => {
    const previousPlan = plan;
    try {
      const saved = await upsertDayPlan.mutateAsync({
        plan_date: dateStr,
        title: titleDraft || null,
        intent: intentDraft,
        notes: notesDraft || null,
        is_public: isPublicDraft,
        checkpoints: checkpointsDraft,
      });
      setMode("preview");
      toast.success(`"${saved.title || "Day plan"}" saved`, {
        icon: ToastIcons.success,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () =>
            previousPlan
              ? upsertDayPlan.mutate({
                  plan_date: previousPlan.plan_date,
                  title: previousPlan.title,
                  intent: previousPlan.intent,
                  notes: previousPlan.notes,
                  is_public: previousPlan.is_public,
                  checkpoints: previousPlan.checkpoints,
                })
              : deleteDayPlan.mutate({ id: saved.id, planDate: saved.plan_date }),
        },
      });
    } catch {
      toast.error("Failed to save day plan");
    }
  };

  const handleDelete = () => {
    if (!plan) return;
    const deletedPlan = plan;
    deleteDayPlan.mutate(
      { id: plan.id, planDate: dateStr },
      {
        onSuccess: () => {
          setMode("edit");
          toast.success(`"${deletedPlan.title || "Day plan"}" deleted`, {
            icon: ToastIcons.delete,
            duration: 4000,
            action: {
              label: "Undo",
              onClick: () =>
                upsertDayPlan.mutate({
                  plan_date: deletedPlan.plan_date,
                  title: deletedPlan.title,
                  intent: deletedPlan.intent,
                  notes: deletedPlan.notes,
                  is_public: deletedPlan.is_public,
                  checkpoints: deletedPlan.checkpoints,
                }),
            },
          });
        },
        onError: () => toast.error("Failed to delete day plan"),
      },
    );
  };

  const activeItems = useMemo(
    () =>
      allItems.filter(
        (item) =>
          item.status !== "archived" &&
          item.status !== "cancelled" &&
          !item.archived_at,
      ),
    [allItems],
  );

  const { data: flexibleRoutines } = useFlexibleRoutines(
    activeItems,
    occurrenceActions,
    selectedDate,
  );
  const scheduledFlexible = useMemo(
    () => flexibleRoutines?.scheduled ?? [],
    [flexibleRoutines?.scheduled],
  );

  const dayOccurrences = useMemo(
    () =>
      getOccurrencesForDay(
        activeItems,
        selectedDate,
        occurrenceActions,
        scheduledFlexible,
      )
        .filter((o) => !o.isCompleted)
        .sort(
          (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime(),
        ),
    [activeItems, selectedDate, occurrenceActions, scheduledFlexible],
  );

  // Both prepone directions: flexible items still unscheduled this period, plus
  // ones already scheduled on a different day within the period — both pullable here.
  const preponeCandidates = useMemo(() => {
    const unscheduled = flexibleRoutines?.unscheduled ?? [];
    const elsewhere = scheduledFlexible.filter(
      (s) => s.flexibleSchedule?.scheduled_for_date !== dateStr,
    );
    return [...unscheduled, ...elsewhere];
  }, [flexibleRoutines, scheduledFlexible, dateStr]);

  const landingCount = dayOccurrences.length;
  const preponeCount = preponeCandidates.length;

  useEffect(() => {
    if (itemsLoading) return;
    setLandingSectionOpen(landingCount > 0);
    setPreponePoolOpen(preponeCount > 0);
  }, [dateStr, itemsLoading, landingCount, preponeCount]);

  const itemActions = useItemActionsWithToast();
  const scheduleRoutine = useScheduleRoutine();
  const unscheduleRoutine = useUnscheduleRoutine();
  const createReminder = useCreateReminder();
  const deleteItemWithUndo = useDeleteItemWithUndo();

  const pullOntoDay = async (item: FlexibleRoutineItem) => {
    const { schedule, periodStart } = asFlexInfo(item);
    if (!periodStart) return;
    const occurrenceIndex =
      schedule?.occurrence_index ?? item.scheduledOccurrences?.length ?? 0;
    const previous = schedule
      ? { date: schedule.scheduled_for_date, time: schedule.scheduled_for_time }
      : null;

    try {
      await scheduleRoutine.mutateAsync({
        itemId: item.id,
        periodStartDate: periodStart,
        scheduledForDate: dateStr,
        scheduledForTime: schedule?.scheduled_for_time ?? undefined,
        occurrenceIndex,
      });
      toast.success(
        `"${item.title}" pulled onto ${format(selectedDate, "EEE, MMM d")}`,
        {
          icon: ToastIcons.update,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () =>
              previous
                ? scheduleRoutine.mutate({
                    itemId: item.id,
                    periodStartDate: periodStart,
                    scheduledForDate: previous.date,
                    scheduledForTime: previous.time,
                    occurrenceIndex,
                  })
                : unscheduleRoutine.mutate({
                    itemId: item.id,
                    periodStartDate: periodStart,
                    occurrenceIndex,
                  }),
          },
        },
      );
    } catch {
      toast.error("Failed to move item");
    }
  };

  const pushOffFlexible = async (item: ItemWithDetails) => {
    const { schedule, periodStart } = asFlexInfo(item);
    if (!schedule || !periodStart) return;
    const { scheduled_for_date, scheduled_for_time, occurrence_index } =
      schedule;

    try {
      await unscheduleRoutine.mutateAsync({
        itemId: item.id,
        periodStartDate: periodStart,
        occurrenceIndex: occurrence_index,
      });
      toast.success(
        `"${item.title}" pushed off — pull it onto a free day later`,
        {
          icon: ToastIcons.update,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () =>
              scheduleRoutine.mutate({
                itemId: item.id,
                periodStartDate: periodStart,
                scheduledForDate: scheduled_for_date,
                scheduledForTime: scheduled_for_time,
                occurrenceIndex: occurrence_index,
              }),
          },
        },
      );
    } catch {
      toast.error("Failed to push off item");
    }
  };

  const addAdHocTask = async () => {
    if (!taskTitle.trim()) return;
    const dueAt = new Date(selectedDate);
    if (taskTime) {
      const [hh, mm] = taskTime.split(":").map(Number);
      dueAt.setHours(hh, mm, 0, 0);
    } else {
      dueAt.setHours(9, 0, 0, 0);
    }

    try {
      const created = await createReminder.mutateAsync({
        type: "reminder",
        title: taskTitle.trim(),
        due_at: dueAt.toISOString(),
      });
      setTaskTitle("");
      setTaskTime("");
      toast.success(
        `"${created.title}" added to ${format(selectedDate, "EEE, MMM d")}`,
        {
          icon: ToastIcons.create,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () => deleteItemWithUndo.mutate(created.id),
          },
        },
      );
    } catch {
      toast.error("Failed to add task");
    }
  };

  const cardBg = isFrost
    ? "bg-white border-slate-200"
    : "bg-white/[0.04] border-white/[0.08]";
  const subtleText = isFrost ? "text-slate-400" : "text-white/40";
  const mainText = isFrost ? "text-slate-700" : "text-white/90";
  const fieldBg = isFrost
    ? "bg-slate-50 border-slate-200"
    : "bg-white/[0.04] border-white/[0.08]";
  const activeBadge = isPink
    ? "bg-pink-500/20 text-pink-300"
    : "bg-cyan-500/20 text-cyan-300";
  const mutedBadge = isFrost
    ? "bg-slate-100 text-slate-400"
    : "bg-white/5 text-white/30";
  const ghostButton = isFrost
    ? "bg-slate-100 text-slate-500"
    : "bg-white/5 text-white/60";

  const sortedCheckpoints = (checkpoints: Checkpoint[]) =>
    checkpoints.slice().sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="min-h-screen pb-24">
      {/* Day nav + plan header */}
      <div
        className={cn(
          "px-4 pt-20 pb-4 border-b",
          isFrost ? "border-slate-100" : "border-white/[0.06]",
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setSelectedDate((d) => subDays(d, 1))}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center",
              ghostButton,
            )}
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className={cn("text-lg font-semibold", mainText)}>
              {format(selectedDate, "EEEE")}
            </p>
            <input
              type="date"
              value={dateStr}
              onChange={(e) =>
                e.target.value && setSelectedDate(parseISO(e.target.value))
              }
              className={cn("text-xs bg-transparent text-center", subtleText)}
            />
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center",
              ghostButton,
            )}
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {dayPlanLoading ? (
          <div className="flex items-center justify-center py-6">
            <div
              className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                isPink ? "bg-pink-400" : "bg-cyan-400",
              )}
            />
          </div>
        ) : mode === "edit" ? (
          <>
            <label className="block mb-3">
              <span
                className={cn(
                  "mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider",
                  subtleText,
                )}
              >
                <PencilLine className="w-3 h-3" />
                Day title
              </span>
              <span
                className={cn(
                  "flex items-center rounded-xl border px-3 py-2.5",
                  fieldBg,
                )}
              >
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="Wedding day, errands, reset..."
                  className={cn(
                    "w-full bg-transparent text-sm font-semibold focus:outline-none",
                    isFrost
                      ? "text-slate-700 placeholder:text-slate-300"
                      : "text-white/90 placeholder:text-white/25",
                  )}
                />
              </span>
            </label>

            <div className="flex items-center gap-2 mb-3">
              {INTENT_OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = intentDraft === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setIntentDraft(active ? null : value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      active
                        ? isPink
                          ? "bg-pink-500/20 text-pink-300"
                          : "bg-cyan-500/20 text-cyan-300"
                        : isFrost
                          ? "bg-slate-100 text-slate-500"
                          : "bg-white/5 text-white/40",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Notes for this day..."
              rows={2}
              className={cn(
                "w-full text-xs rounded-lg p-2.5 resize-none focus:outline-none",
                isFrost
                  ? "bg-slate-50 text-slate-600 placeholder:text-slate-300"
                  : "bg-white/[0.03] text-white/70 placeholder:text-white/20",
              )}
            />

            <button
              type="button"
              onClick={() => setIsPublicDraft((v) => !v)}
              aria-pressed={isPublicDraft}
              className={cn(
                "mt-2 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors",
                isPublicDraft ? activeBadge : mutedBadge,
              )}
            >
              {isPublicDraft ? (
                <Users className="w-3 h-3" />
              ) : (
                <Lock className="w-3 h-3" />
              )}
              {isPublicDraft ? "Shared with household" : "Private"}
            </button>
          </>
        ) : (
          plan && (
            <div className={cn("rounded-2xl border p-4", cardBg)}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className={cn("text-base font-semibold truncate", mainText)}>
                    {plan.title || "Untitled day"}
                  </p>
                  {plan.intent && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                        activeBadge,
                      )}
                    >
                      {(() => {
                        const opt = INTENT_OPTIONS.find(
                          (o) => o.value === plan.intent,
                        );
                        const Icon = opt?.icon ?? Sparkles;
                        return <Icon className="w-3 h-3" />;
                      })()}
                      {INTENT_OPTIONS.find((o) => o.value === plan.intent)?.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    aria-label="Edit day plan"
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      ghostButton,
                    )}
                  >
                    <PencilLine className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    aria-label="Delete day plan"
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      ghostButton,
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {plan.notes && (
                <p className={cn("text-xs mb-2 whitespace-pre-wrap", subtleText)}>
                  {plan.notes}
                </p>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full",
                  plan.is_public ? activeBadge : mutedBadge,
                )}
              >
                {plan.is_public ? (
                  <Users className="w-3 h-3" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
                {plan.is_public ? "Shared with household" : "Private"}
              </span>
            </div>
          )
        )}

        {partnerPlan && (partnerPlan.title || partnerPlan.intent) && (
          <p className={cn("mt-2 text-xs", subtleText)}>
            <span className={cn("font-medium", partnerAccent)}>
              {partnerName}
            </span>
            {partnerPlan.title
              ? ` is planning: ${partnerPlan.title}`
              : ` set this day to ${partnerPlan.intent}`}
          </p>
        )}
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* Landing on this day */}
        <div>
          <button
            type="button"
            onClick={() => setLandingSectionOpen((v) => !v)}
            className="flex items-center justify-between w-full mb-3"
          >
            <span
              className={cn(
                "flex items-center gap-2 text-xs font-bold uppercase tracking-wider",
                subtleText,
              )}
            >
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 transition-transform",
                  !landingSectionOpen && "-rotate-90",
                )}
              />
              Landing on this day
            </span>
            {landingCount > 0 && (
              <span
                className={cn(
                  "min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center",
                  activeBadge,
                )}
              >
                {landingCount}
              </span>
            )}
          </button>
          {(landingSectionOpen || itemsLoading) &&
            (itemsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    isPink ? "bg-pink-400" : "bg-cyan-400",
                  )}
                />
              </div>
            ) : dayOccurrences.length === 0 ? (
              <div
                className={cn("text-center py-10 rounded-xl border", cardBg)}
              >
                <Calendar className={cn("w-7 h-7 mx-auto mb-2", subtleText)} />
                <p className={cn("text-sm font-medium", subtleText)}>
                  Nothing landing here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayOccurrences.map((occ) => {
                  const { item, occurrenceDate, isPostponed } = occ;
                  const Icon = typeIcons[item.type];
                  const colors = typeColor[item.type];
                  const { schedule } = asFlexInfo(item);
                  const isFlexible =
                    !!schedule || !!item.recurrence_rule?.is_flexible;
                  const rowKey = `${item.id}-${occurrenceDate.toISOString()}`;
                  const isPushOpen = pushOffOpenKey === rowKey;

                  return (
                    <div
                      key={rowKey}
                      className={cn("rounded-xl border p-3", cardBg)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            colors.bg,
                            colors.text,
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              mainText,
                            )}
                          >
                            {item.title}
                          </p>
                          <p className={cn("text-xs", subtleText)}>
                            {format(occurrenceDate, "h:mm a")}
                            {isFlexible && " · Flexible"}
                            {isPostponed && " · Postponed"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            itemActions.handleComplete(
                              item,
                              occurrenceDate.toISOString(),
                            )
                          }
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            isFrost
                              ? "bg-emerald-50 text-emerald-500"
                              : "bg-emerald-500/10 text-emerald-400",
                          )}
                          aria-label="Complete"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPushOffOpenKey(isPushOpen ? null : rowKey)
                          }
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            isFrost
                              ? "bg-amber-50 text-amber-500"
                              : "bg-amber-500/10 text-amber-400",
                          )}
                          aria-label="Push off"
                        >
                          <CalendarOff className="w-4 h-4" />
                        </button>
                      </div>

                      {isPushOpen && (
                        <div
                          className={cn(
                            "mt-3 pt-3 border-t flex items-center gap-2 flex-wrap",
                            isFrost
                              ? "border-slate-100"
                              : "border-white/[0.06]",
                          )}
                        >
                          {isFlexible ? (
                            <button
                              type="button"
                              onClick={() => {
                                pushOffFlexible(item);
                                setPushOffOpenKey(null);
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium",
                                isFrost
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-white/5 text-white/70",
                              )}
                            >
                              Move off this day
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  itemActions.handlePostpone(
                                    item,
                                    occurrenceDate.toISOString(),
                                    "tomorrow",
                                  );
                                  setPushOffOpenKey(null);
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-medium",
                                  isFrost
                                    ? "bg-slate-100 text-slate-600"
                                    : "bg-white/5 text-white/70",
                                )}
                              >
                                Tomorrow
                              </button>
                              <input
                                type="date"
                                value={customDateDraft}
                                onChange={(e) =>
                                  setCustomDateDraft(e.target.value)
                                }
                                className={cn(
                                  "text-xs rounded-lg px-2 py-1.5",
                                  isFrost
                                    ? "bg-slate-100 text-slate-600"
                                    : "bg-white/5 text-white/70",
                                )}
                              />
                              <button
                                type="button"
                                disabled={!customDateDraft}
                                onClick={() => {
                                  itemActions.handlePostpone(
                                    item,
                                    occurrenceDate.toISOString(),
                                    "custom",
                                    undefined,
                                    parseISO(customDateDraft).toISOString(),
                                  );
                                  setCustomDateDraft("");
                                  setPushOffOpenKey(null);
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40",
                                  isPink
                                    ? "bg-pink-500/20 text-pink-300"
                                    : "bg-cyan-500/20 text-cyan-300",
                                )}
                              >
                                Move
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
        </div>

        {/* Prepone pool */}
        <div>
          <button
            type="button"
            onClick={() => setPreponePoolOpen((v) => !v)}
            className="flex items-center justify-between w-full mb-3"
          >
            <span
              className={cn(
                "flex items-center gap-2 text-xs font-bold uppercase tracking-wider",
                subtleText,
              )}
            >
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 transition-transform",
                  !preponePoolOpen && "-rotate-90",
                )}
              />
              Prepone pool{" "}
              {flexibleRoutines?.periodLabel
                ? `· ${flexibleRoutines.periodLabel}`
                : ""}
            </span>
            {preponeCount > 0 && (
              <span
                className={cn(
                  "min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center",
                  activeBadge,
                )}
              >
                {preponeCount}
              </span>
            )}
          </button>

          {preponePoolOpen &&
            (preponeCandidates.length === 0 ? (
              <div className={cn("text-center py-8 rounded-xl border", cardBg)}>
                <Inbox className={cn("w-6 h-6 mx-auto mb-2", subtleText)} />
                <p className={cn("text-xs", subtleText)}>
                  No flexible items to pull in
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {preponeCandidates.map((item) => {
                  const { schedule } = asFlexInfo(item);
                  return (
                    <div
                      key={`${item.id}-${schedule?.occurrence_index ?? 0}`}
                      className={cn(
                        "rounded-xl border p-3 flex items-center gap-3",
                        cardBg,
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium truncate",
                            mainText,
                          )}
                        >
                          {item.title}
                        </p>
                        <p className={cn("text-xs", subtleText)}>
                          {schedule
                            ? `Scheduled ${format(parseISO(schedule.scheduled_for_date), "EEE, MMM d")}`
                            : "Unscheduled this period"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => pullOntoDay(item)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0",
                          isPink
                            ? "bg-pink-500/20 text-pink-300"
                            : "bg-cyan-500/20 text-cyan-300",
                        )}
                      >
                        Pull here
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
        </div>

        {/* Checkpoints */}
        <div>
          <h3
            className={cn(
              "text-xs font-bold uppercase tracking-wider mb-3",
              subtleText,
            )}
          >
            Checkpoints
          </h3>

          {mode === "preview" ? (
            <div className="space-y-2">
              {(plan?.checkpoints ?? []).length === 0 ? (
                <p className={cn("text-xs", subtleText)}>No checkpoints yet</p>
              ) : (
                sortedCheckpoints(plan?.checkpoints ?? []).map((cp) => (
                  <div
                    key={cp.id}
                    className={cn(
                      "rounded-xl border p-2.5 flex items-center gap-3",
                      cardBg,
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCheckpoint(cp.id)}
                      aria-label={cp.done_at ? "Mark not done" : "Mark done"}
                    >
                      {cp.done_at ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className={cn("w-4 h-4", subtleText)} />
                      )}
                    </button>
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        subtleText,
                      )}
                    >
                      {cp.time}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        cp.done_at ? cn(subtleText, "line-through") : mainText,
                      )}
                    >
                      {cp.label}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-3">
                {sortedCheckpoints(checkpointsDraft).map((cp) => (
                  <div
                    key={cp.id}
                    className={cn(
                      "rounded-xl border p-2.5 flex items-center gap-3",
                      cardBg,
                    )}
                  >
                    {cp.done_at ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className={cn("w-4 h-4", subtleText)} />
                    )}
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        subtleText,
                      )}
                    >
                      {cp.time}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        cp.done_at ? cn(subtleText, "line-through") : mainText,
                      )}
                    >
                      {cp.label}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCheckpointsDraft((cps) =>
                          cps.filter((c) => c.id !== cp.id),
                        )
                      }
                      aria-label="Delete checkpoint"
                    >
                      <Trash2 className={cn("w-3.5 h-3.5", subtleText)} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={checkpointTime}
                  onChange={(e) => setCheckpointTime(e.target.value)}
                  className={cn(
                    "text-xs rounded-lg px-2 py-2",
                    isFrost
                      ? "bg-slate-100 text-slate-600"
                      : "bg-white/5 text-white/70",
                  )}
                />
                <input
                  type="text"
                  value={checkpointLabel}
                  onChange={(e) => setCheckpointLabel(e.target.value)}
                  placeholder="e.g. Get dressed"
                  className={cn(
                    "flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none",
                    isFrost
                      ? "bg-slate-100 text-slate-700 placeholder:text-slate-400"
                      : "bg-white/5 text-white/80 placeholder:text-white/25",
                  )}
                />
                <button
                  type="button"
                  disabled={!checkpointTime || !checkpointLabel.trim()}
                  onClick={() => {
                    setCheckpointsDraft((cps) => [
                      ...cps,
                      {
                        id: crypto.randomUUID(),
                        time: checkpointTime,
                        label: checkpointLabel.trim(),
                        done_at: null,
                      },
                    ]);
                    setCheckpointTime("");
                    setCheckpointLabel("");
                  }}
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-40 flex-shrink-0",
                    isPink
                      ? "bg-pink-500/20 text-pink-300"
                      : "bg-cyan-500/20 text-cyan-300",
                  )}
                  aria-label="Add checkpoint"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-4">
                {plan && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-medium",
                      isFrost
                        ? "bg-slate-100 text-slate-600"
                        : "bg-white/5 text-white/70",
                    )}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={upsertDayPlan.isPending}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50",
                    isPink
                      ? "bg-pink-500/20 text-pink-300"
                      : "bg-cyan-500/20 text-cyan-300",
                  )}
                >
                  {upsertDayPlan.isPending ? "Saving..." : "Save day plan"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Ad-hoc task */}
        <div>
          <h3
            className={cn(
              "text-xs font-bold uppercase tracking-wider mb-3",
              subtleText,
            )}
          >
            Add a task for this day
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={taskTime}
              onChange={(e) => setTaskTime(e.target.value)}
              className={cn(
                "text-xs rounded-lg px-2 py-2",
                isFrost
                  ? "bg-slate-100 text-slate-600"
                  : "bg-white/5 text-white/70",
              )}
            />
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Prepare outfit"
              className={cn(
                "flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none",
                isFrost
                  ? "bg-slate-100 text-slate-700 placeholder:text-slate-400"
                  : "bg-white/5 text-white/80 placeholder:text-white/25",
              )}
            />
            <button
              type="button"
              disabled={!taskTitle.trim()}
              onClick={addAdHocTask}
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-40 flex-shrink-0",
                isPink
                  ? "bg-pink-500/20 text-pink-300"
                  : "bg-cyan-500/20 text-cyan-300",
              )}
              aria-label="Add task"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
