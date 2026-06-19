"use client";

import type {
  RecurringFilter,
  TypeFilter,
  UserFilter,
} from "@/components/activity/FilterBar";
import ItemActionsSheet from "@/components/items/ItemActionsSheet";
import ItemDetailModal from "@/components/items/ItemDetailModal";
import {
  RecurringEditChoiceDialog,
  type RecurringEditMode,
} from "@/components/items/RecurringEditChoiceDialog";
import EditOccurrenceDialog from "@/components/web/EditOccurrenceDialog";
import { WebEventFormDialog } from "@/components/web/WebEventFormDialog";
import { useTheme } from "@/contexts/ThemeContext";
import type { ChecklistItem, DayPlan, DayPlanIntent } from "@/features/day-plan/types";
import {
  useChecklistActions,
  useDayPlan,
  useDeleteDayPlan,
  useUpsertDayPlan,
} from "@/features/day-plan/useDayPlan";
import { usePartnerId } from "@/features/hub/usePartnerId";
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
  type PostponeType,
} from "@/features/items/useItemActions";
import {
  useCreateReminder,
  useItems,
  useUpdateItem,
  useUpdateRecurrenceRule,
} from "@/features/items/useItems";
import {
  getMemberDisplayName,
  useHouseholdMembers,
} from "@/hooks/useHouseholdMembers";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { firstBiweeklyFlippedAnchor } from "@/lib/utils/date";
import {
  expandOccurrencesInRange,
  getOccurrencesForDay,
  type ExpandedOccurrence,
} from "@/lib/utils/dayOccurrences";
import type {
  FlexibleSchedule,
  ItemType,
  ItemWithDetails,
} from "@/types/items";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addDays,
  format,
  isBefore,
  isToday as isDateToday,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import {
  Bell,
  Calendar,
  CalendarOff,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  GripVertical,
  Inbox,
  ListTodo,
  Lock,
  Moon,
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
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

// ============================================
// SPARKLE CHECKBOX
// ============================================
function SparkleCheckbox({
  checked,
  justCompleted,
  onToggle,
}: {
  checked: boolean;
  justCompleted: boolean;
  onToggle: () => void;
}) {
  const showGreen = checked || justCompleted;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="relative w-6 h-6 flex-shrink-0"
    >
      {justCompleted && (
        <span className="absolute inset-0 pointer-events-none">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const tx = Math.cos(rad) * 14;
            const ty = Math.sin(rad) * 14;
            return (
              <span
                key={deg}
                className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full"
                style={{
                  marginLeft: -2,
                  marginTop: -2,
                  backgroundColor: i % 2 === 0 ? "#34d399" : "#6ee7b7",
                  animation: `sparkle-fly-xy 0.45s ease-out ${i * 0.02}s forwards`,
                  ["--tx" as string]: `${tx}px`,
                  ["--ty" as string]: `${ty}px`,
                }}
              />
            );
          })}
        </span>
      )}
      <span
        className={cn(
          "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200",
          showGreen
            ? "bg-emerald-500 border-emerald-500 scale-110"
            : "border-white/30 hover:border-white/50",
          justCompleted && "animate-[bounce-check_0.35s_ease-out]",
        )}
      >
        {showGreen && <CheckCircle2 className="w-4 h-4 text-white" />}
      </span>
    </button>
  );
}

// ============================================
// SWIPEABLE ITEM (Right → Complete, Left → Options)
// ============================================
const DEAD_ZONE = 20;
const CONFIRM_ZONE = 70;
const MAX_DRAG = 100;

function SwipeableItem({
  onComplete,
  onOptions,
  onClick,
  children,
}: {
  onComplete: () => void;
  onOptions: () => void;
  onClick: () => void;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const offsetRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    direction: "horizontal" | "vertical" | null;
    dragging: boolean;
    didSwipe: boolean;
  } | null>(null);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onOptionsRef = useRef(onOptions);
  onOptionsRef.current = onOptions;

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        direction: null,
        dragging: false,
        didSwipe: false,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const state = touchStateRef.current;
      if (!state) return;
      const touch = e.touches[0];
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (!state.direction) {
        if (absDx < 8 && absDy < 8) return;
        state.direction = absDx > absDy ? "horizontal" : "vertical";
      }
      if (state.direction === "vertical") return;

      e.preventDefault();

      if (!state.dragging && absDx > DEAD_ZONE) {
        state.dragging = true;
        state.didSwipe = true;
        setIsDragging(true);
      }

      if (absDx <= DEAD_ZONE) {
        offsetRef.current = 0;
        setOffsetX(0);
        return;
      }

      const sign = dx > 0 ? 1 : -1;
      const activeDist = absDx - DEAD_ZONE;
      const confirmDist = CONFIRM_ZONE - DEAD_ZONE;
      const mapped =
        activeDist <= confirmDist
          ? activeDist
          : confirmDist + (activeDist - confirmDist) * 0.3;
      const val = sign * Math.min(mapped, MAX_DRAG);
      offsetRef.current = val;
      setOffsetX(val);
    };

    const onTouchEnd = () => {
      const state = touchStateRef.current;
      if (!state) return;
      const currentOffset = offsetRef.current;
      const absOff = Math.abs(currentOffset);
      const confirmDist = CONFIRM_ZONE - DEAD_ZONE;

      offsetRef.current = 0;
      setOffsetX(0);

      if (absOff >= confirmDist) {
        if (navigator.vibrate) navigator.vibrate(15);
        if (currentOffset > 0) {
          onCompleteRef.current();
        } else {
          onOptionsRef.current();
        }
      }

      setIsDragging(false);
      setTimeout(() => {
        if (touchStateRef.current) touchStateRef.current = null;
      }, 50);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const absOffset = Math.abs(offsetX);
  const confirmedThreshold = CONFIRM_ZONE - DEAD_ZONE;
  const isConfirmed = absOffset >= confirmedThreshold;
  const previewOpacity = isDragging
    ? Math.min(absOffset / confirmedThreshold, 1)
    : 0;

  const handleClick = () => {
    if (touchStateRef.current?.didSwipe) return;
    onClick();
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {isDragging && offsetX > 0 && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start px-4 rounded-xl z-0",
            isConfirmed ? "bg-emerald-500/30" : "bg-emerald-500/10",
          )}
          style={{ width: `${absOffset + 16}px`, opacity: previewOpacity }}
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2
              className={cn(
                "w-4 h-4",
                isConfirmed ? "text-emerald-300" : "text-emerald-400/60",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                isConfirmed ? "text-emerald-300" : "text-emerald-400/60",
              )}
            >
              Done
            </span>
          </div>
        </div>
      )}
      {isDragging && offsetX < 0 && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end px-4 rounded-xl z-0",
            isConfirmed ? "bg-orange-500/30" : "bg-orange-500/10",
          )}
          style={{ width: `${absOffset + 16}px`, opacity: previewOpacity }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                isConfirmed ? "text-orange-300" : "text-orange-400/60",
              )}
            >
              Options
            </span>
            <MoreHorizontal
              className={cn(
                "w-4 h-4",
                isConfirmed ? "text-orange-300" : "text-orange-400/60",
              )}
            />
          </div>
        </div>
      )}
      <div
        ref={contentRef}
        onClick={handleClick}
        className="relative z-10"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 0.25s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// CHECKLIST DRAG ROW
// ============================================
function ChecklistSortableRow({
  item,
  mainText,
  subtleText,
  cardBg,
  onRemove,
}: {
  item: ChecklistItem;
  mainText: string;
  subtleText: string;
  cardBg: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border p-2.5 flex items-center gap-2.5 touch-none",
        cardBg,
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <GripVertical className={cn("w-4 h-4", subtleText)} />
      </button>
      <span className={cn("flex-1 text-sm", mainText)}>{item.label}</span>
      <button type="button" onClick={onRemove} aria-label="Delete checklist item">
        <Trash2 className={cn("w-3.5 h-3.5", subtleText)} />
      </button>
    </div>
  );
}

interface WebDayPlannerProps {
  initialDate?: string;
  initialPlanning?: boolean;
  selectedDate: Date;
  onSelectedDateChange: Dispatch<SetStateAction<Date>>;
  showOverdue?: boolean;
  showCompleted?: boolean;
  planningCommandToken?: number;
  onToolbarStateChange?: (state: PlannerToolbarState) => void;
  userFilter?: UserFilter;
  currentUserId?: string;
  typeFilter?: TypeFilter;
  recurringFilter?: RecurringFilter;
}

export type PlannerMode = "browsing" | "planning" | "preview";

export interface PlannerToolbarState {
  mode: PlannerMode;
  dayPlanLoading: boolean;
  overdueCount: number;
  selectedIsToday: boolean;
}

export default function WebDayPlanner({
  initialDate,
  initialPlanning,
  selectedDate,
  onSelectedDateChange,
  showOverdue = false,
  showCompleted = false,
  planningCommandToken = 0,
  onToolbarStateChange,
  userFilter = "all",
  currentUserId,
  typeFilter = "all",
  recurringFilter = "all",
}: WebDayPlannerProps) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost";
  const partnerAccent = isPink ? "text-blue-400" : "text-pink-400";

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const selectedIsToday = isDateToday(selectedDate);

  const [preponePoolOpen, setPreponePoolOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [completedSectionOpen, setCompletedSectionOpen] = useState(false);
  const [assignedToMeOpen, setAssignedToMeOpen] = useState(false);
  const [assignedOutOpen, setAssignedOutOpen] = useState(false);

  const [mode, setMode] = useState<PlannerMode>("browsing");
  const [titleDraft, setTitleDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [intentDraft, setIntentDraft] = useState<DayPlanIntent | null>(null);
  const [isPublicDraft, setIsPublicDraft] = useState(false);
  const [checklistDraft, setChecklistDraft] = useState<ChecklistItem[]>([]);
  const [checklistLabel, setChecklistLabel] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const draftPlanKeyRef = useRef<string | null>(null);
  const initialPlanningConsumedRef = useRef(false);
  const initialDateStrRef = useRef(initialDate ?? format(selectedDate, "yyyy-MM-dd"));
  const lastPlanningCommandRef = useRef(planningCommandToken);

  const [actionsState, setActionsState] = useState<{
    item: ItemWithDetails;
    occurrenceDate: string;
  } | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemWithDetails | null>(null);
  const [editingItem, setEditingItem] = useState<ItemWithDetails | null>(null);
  type EditFlow =
    | { step: "chooser"; item: ItemWithDetails; date: Date }
    | { step: "occurrence"; item: ItemWithDetails; date: Date }
    | null;
  const [editFlow, setEditFlow] = useState<EditFlow>(null);

  const { data: fetchedItems = [], isLoading: itemsLoading } = useItems();
  // Chores have their own tab (/reminders Chores tab) — never surface them here,
  // regardless of overdue/today/upcoming/postponed/assigned status.
  const allItems = useMemo(
    () => fetchedItems.filter((item) => !item.is_chore),
    [fetchedItems],
  );
  const { data: occurrenceActions = [] } = useAllOccurrenceActions();
  const { data: householdData } = useHouseholdMembers();
  const members = householdData?.members ?? [];
  const { data: partnerUserId = null } = usePartnerId();

  const { data: dayPlanData, isLoading: dayPlanLoading } = useDayPlan(dateStr);
  const plan = dayPlanData?.mine ?? null;
  const partnerPlan = dayPlanData?.partner ?? null;
  const partnerName = partnerPlan
    ? getMemberDisplayName(members, partnerPlan.user_id)
    : null;

  const seedDraftsFrom = useCallback((source: DayPlan | null) => {
    setTitleDraft(source?.title ?? "");
    setNotesDraft(source?.notes ?? "");
    setIntentDraft(source?.intent ?? null);
    setIsPublicDraft(source?.is_public ?? false);
    setChecklistDraft(source?.checklist ?? []);
  }, []);

  // Re-seed drafts only when the date or the saved plan identity changes — not on every
  // keystroke, and not on the live checklist-toggle refetch (same plan.id, new array ref).
  useEffect(() => {
    const planKey = `${dateStr}:${plan?.id ?? "new"}`;
    if (draftPlanKeyRef.current === planKey) return;
    draftPlanKeyRef.current = planKey;
    seedDraftsFrom(plan);
    setMode(plan?.id ? "preview" : "browsing");
  }, [dateStr, plan, seedDraftsFrom]);

  // URL-driven "jump straight into planning" (?plan=1) — fires once, after the
  // real plan data has settled, so it doesn't get clobbered by the effect above.
  useEffect(() => {
    if (!initialPlanning || initialPlanningConsumedRef.current) return;
    if (dayPlanLoading) return;
    if (dateStr !== initialDateStrRef.current) return;
    initialPlanningConsumedRef.current = true;
    seedDraftsFrom(plan);
    setMode("planning");
  }, [initialPlanning, dayPlanLoading, dateStr, plan, seedDraftsFrom]);

  const upsertDayPlan = useUpsertDayPlan();
  const deleteDayPlan = useDeleteDayPlan();
  const { toggleChecklistItem } = useChecklistActions(plan, dateStr);

  const handleOpenPlanning = useCallback(() => {
    seedDraftsFrom(plan);
    setMode("planning");
  }, [plan, seedDraftsFrom]);

  useEffect(() => {
    if (!planningCommandToken) return;
    if (lastPlanningCommandRef.current === planningCommandToken) return;
    lastPlanningCommandRef.current = planningCommandToken;
    if (mode === "planning") return;
    handleOpenPlanning();
  }, [handleOpenPlanning, mode, planningCommandToken]);

  const handleCancelEdit = () => {
    seedDraftsFrom(plan);
    setMode(plan ? "preview" : "browsing");
  };

  // One POST per Save — never on individual field edits.
  const handleSave = async () => {
    const previousPlan = plan;
    try {
      const saved = await upsertDayPlan.mutateAsync({
        plan_date: dateStr,
        title: titleDraft || null,
        intent: intentDraft,
        notes: notesDraft || null,
        is_public: isPublicDraft,
        checklist: checklistDraft,
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
                  checklist: previousPlan.checklist,
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
          setMode("browsing");
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
                  checklist: deletedPlan.checklist,
                }),
            },
          });
        },
        onError: () => toast.error("Failed to delete day plan"),
      },
    );
  };

  // Filter by who's *responsible*, then by type/recurring — matches the retired
  // StandaloneRemindersPage filter semantics so /reminders' FilterBar keeps working.
  const ownershipFiltered = useMemo(() => {
    if (userFilter === "all" || !currentUserId) return allItems;
    if (userFilter === "mine") {
      return allItems.filter((item) => item.responsible_user_id === currentUserId);
    }
    if (!partnerUserId) return [];
    return allItems.filter((item) => item.responsible_user_id === partnerUserId);
  }, [allItems, currentUserId, partnerUserId, userFilter]);

  const activeItems = useMemo(
    () =>
      ownershipFiltered.filter((item) => {
        if (
          item.status === "archived" ||
          item.status === "cancelled" ||
          item.archived_at
        )
          return false;
        if (typeFilter !== "all" && item.type !== typeFilter) return false;
        if (recurringFilter === "recurring" && !item.recurrence_rule?.rrule)
          return false;
        if (recurringFilter === "one-time" && item.recurrence_rule?.rrule)
          return false;
        return true;
      }),
    [ownershipFiltered, typeFilter, recurringFilter],
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
      getOccurrencesForDay(activeItems, selectedDate, occurrenceActions, scheduledFlexible).sort(
        (a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime(),
      ),
    [activeItems, selectedDate, occurrenceActions, scheduledFlexible],
  );

  const overdueOccurrences = useMemo(() => {
    if (!selectedIsToday) return [];
    const now = new Date();
    const todayStart = startOfDay(now);
    const pastStart = subDays(todayStart, 30);
    return expandOccurrencesInRange(
      activeItems,
      pastStart,
      todayStart,
      occurrenceActions,
      scheduledFlexible,
    )
      .filter((occ) => isBefore(occ.occurrenceDate, now) && !occ.isCompleted)
      .sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime());
  }, [activeItems, occurrenceActions, scheduledFlexible, selectedIsToday]);
  const overdueSectionVisible = showOverdue && selectedIsToday && overdueOccurrences.length > 0;
  const primaryOccurrenceIndex = useMemo(() => {
    if (dayOccurrences.length === 0) return -1;
    const nextOpenIndex = dayOccurrences.findIndex((occ) => !occ.isCompleted);
    return nextOpenIndex >= 0 ? nextOpenIndex : 0;
  }, [dayOccurrences]);
  const primaryOccurrence =
    primaryOccurrenceIndex >= 0 ? dayOccurrences[primaryOccurrenceIndex] : null;
  const remainingDayOccurrences = useMemo(
    () => dayOccurrences.filter((_, index) => index !== primaryOccurrenceIndex),
    [dayOccurrences, primaryOccurrenceIndex],
  );
  const openRemainingOccurrences = useMemo(
    () => remainingDayOccurrences.filter((occ) => !occ.isCompleted),
    [remainingDayOccurrences],
  );
  const completedRemainingOccurrences = useMemo(
    () => remainingDayOccurrences.filter((occ) => occ.isCompleted),
    [remainingDayOccurrences],
  );

  const upcomingOccurrences = useMemo(() => {
    if (!selectedIsToday) return [];
    const todayStart = startOfDay(new Date());
    const tomorrow = addDays(todayStart, 1);
    const weekFromNow = addDays(todayStart, 7);
    return expandOccurrencesInRange(
      activeItems,
      tomorrow,
      weekFromNow,
      occurrenceActions,
      scheduledFlexible,
    ).sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime());
  }, [activeItems, occurrenceActions, scheduledFlexible, selectedIsToday]);

  const assignedToMeItems = useMemo(() => {
    if (!selectedIsToday || !currentUserId || !partnerUserId) return [];
    return allItems.filter(
      (item) =>
        item.responsible_user_id === currentUserId &&
        item.user_id === partnerUserId &&
        !item.archived_at &&
        item.status !== "archived" &&
        item.status !== "cancelled" &&
        item.status !== "completed",
    );
  }, [allItems, currentUserId, partnerUserId, selectedIsToday]);

  const assignedOutItems = useMemo(() => {
    if (!selectedIsToday || !currentUserId || !partnerUserId) return [];
    return allItems.filter(
      (item) =>
        item.user_id === currentUserId &&
        item.responsible_user_id === partnerUserId &&
        !item.archived_at &&
        item.status !== "archived" &&
        item.status !== "cancelled" &&
        item.status !== "completed",
    );
  }, [allItems, currentUserId, partnerUserId, selectedIsToday]);

  // Both prepone directions: flexible items still unscheduled this period, plus
  // ones already scheduled on a different day within the period — both pullable here.
  const preponeCandidates = useMemo(() => {
    const unscheduled = flexibleRoutines?.unscheduled ?? [];
    const elsewhere = scheduledFlexible.filter(
      (s) => s.flexibleSchedule?.scheduled_for_date !== dateStr,
    );
    return [...unscheduled, ...elsewhere];
  }, [flexibleRoutines, scheduledFlexible, dateStr]);

  useEffect(() => {
    if (itemsLoading) return;
    setPreponePoolOpen(preponeCandidates.length > 0);
    if (selectedIsToday) {
      setAssignedToMeOpen(assignedToMeItems.length > 0);
      setAssignedOutOpen(assignedOutItems.length > 0);
    }
  }, [
    dateStr,
    itemsLoading,
    preponeCandidates.length,
    selectedIsToday,
    assignedToMeItems.length,
    assignedOutItems.length,
  ]);

  useEffect(() => {
    onToolbarStateChange?.({
      mode,
      dayPlanLoading,
      overdueCount: overdueOccurrences.length,
      selectedIsToday,
    });
  }, [dayPlanLoading, mode, onToolbarStateChange, overdueOccurrences.length, selectedIsToday]);

  const itemActions = useItemActionsWithToast();
  const scheduleRoutine = useScheduleRoutine();
  const unscheduleRoutine = useUnscheduleRoutine();
  const createReminder = useCreateReminder();
  const deleteItemWithUndo = useDeleteItemWithUndo();
  const updateItem = useUpdateItem();
  const updateRecurrence = useUpdateRecurrenceRule();

  const handleReassign = useCallback(
    (item: ItemWithDetails, toUserId: string) => {
      const previousResponsibleId = item.responsible_user_id;
      const toMe = toUserId === currentUserId;
      updateItem.mutate(
        { id: item.id, responsible_user_id: toUserId },
        {
          onSuccess: () => {
            toast.success(toMe ? "Taken back" : "Passed to partner", {
              duration: 4000,
              icon: ToastIcons.update,
              action: {
                label: "Undo",
                onClick: () =>
                  updateItem.mutate({
                    id: item.id,
                    responsible_user_id: previousResponsibleId,
                  }),
              },
            });
          },
        },
      );
    },
    [updateItem, currentUserId],
  );

  const handleReverseRecurrence = (item: ItemWithDetails) => {
    if (!item.recurrence_rule?.start_anchor || !item.recurrence_rule.rrule) return;
    const current = parseISO(item.recurrence_rule.start_anchor);
    const newAnchor = firstBiweeklyFlippedAnchor(current).toISOString();
    const flipTime = new Date().toISOString();
    updateRecurrence.mutate(
      {
        itemId: item.id,
        rrule: item.recurrence_rule.rrule,
        start_anchor: newAnchor,
        phase_changed_at: flipTime,
        previous_start_anchor: current.toISOString(),
      },
      {
        onSuccess: () =>
          toast.success("Bi-weekly phase flipped", {
            duration: 4000,
            icon: ToastIcons.update,
            action: {
              label: "Undo",
              onClick: () =>
                updateRecurrence.mutate({
                  itemId: item.id,
                  rrule: item.recurrence_rule!.rrule,
                  start_anchor: current.toISOString(),
                  phase_changed_at: null,
                  previous_start_anchor: null,
                }),
            },
          }),
      },
    );
  };

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
      toast.success(`"${item.title}" pulled onto ${format(selectedDate, "EEE, MMM d")}`, {
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
      });
    } catch {
      toast.error("Failed to move item");
    }
  };

  const pushOffFlexible = async (item: ItemWithDetails) => {
    const { schedule, periodStart } = asFlexInfo(item);
    if (!schedule || !periodStart) return;
    const { scheduled_for_date, scheduled_for_time, occurrence_index } = schedule;

    try {
      await unscheduleRoutine.mutateAsync({
        itemId: item.id,
        periodStartDate: periodStart,
        occurrenceIndex: occurrence_index,
      });
      toast.success(`"${item.title}" pushed off — pull it onto a free day later`, {
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
      });
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
      toast.success(`"${created.title}" added to ${format(selectedDate, "EEE, MMM d")}`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => deleteItemWithUndo.mutate(created.id),
        },
      });
    } catch {
      toast.error("Failed to add task");
    }
  };

  const addChecklistItem = () => {
    if (!checklistLabel.trim()) return;
    setChecklistDraft((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        label: checklistLabel.trim(),
        done_at: null,
        sort_order: items.length,
      },
    ]);
    setChecklistLabel("");
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedChecklistDraft = useMemo(
    () => checklistDraft.slice().sort((a, b) => a.sort_order - b.sort_order),
    [checklistDraft],
  );

  const handleChecklistDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setChecklistDraft((items) => {
      const sorted = items.slice().sort((a, b) => a.sort_order - b.sort_order);
      const oldIndex = sorted.findIndex((i) => i.id === active.id);
      const newIndex = sorted.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(sorted, oldIndex, newIndex).map((item, index) => ({
        ...item,
        sort_order: index,
      }));
    });
  };

  const sortedPlanChecklist = useMemo(
    () => (plan?.checklist ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [plan?.checklist],
  );

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

  const occKey = useCallback(
    (occ: ExpandedOccurrence) => `${occ.item.id}-${occ.occurrenceDate.getTime()}`,
    [],
  );

  const [optimisticCompleted, setOptimisticCompleted] = useState<Set<string>>(new Set());
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set());

  const handleOptimisticComplete = useCallback(
    (occ: ExpandedOccurrence) => {
      const key = occKey(occ);
      if (occ.isCompleted || optimisticCompleted.has(key)) {
        setOptimisticCompleted((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        itemActions.handleUncomplete(occ.item, occ.occurrenceDate.toISOString());
      } else {
        setOptimisticCompleted((prev) => new Set(prev).add(key));
        setJustCompleted((prev) => new Set(prev).add(key));
        setTimeout(() => {
          setJustCompleted((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }, 600);
        itemActions.handleComplete(occ.item, occ.occurrenceDate.toISOString());
      }
    },
    [itemActions, optimisticCompleted, occKey],
  );

  useEffect(() => {
    if (optimisticCompleted.size > 0) setOptimisticCompleted(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occurrenceActions]);

  const openActions = useCallback((occ: ExpandedOccurrence) => {
    setActionsState({ item: occ.item, occurrenceDate: occ.occurrenceDate.toISOString() });
  }, []);

  const renderOccurrenceRow = (occ: ExpandedOccurrence, showDate = false) => {
    const { item, occurrenceDate } = occ;
    const Icon = typeIcons[item.type];
    const colors = typeColor[item.type];
    const { schedule } = asFlexInfo(item);
    const isFlexible = !!schedule || !!item.recurrence_rule?.is_flexible;
    const isRecurring = !!item.recurrence_rule?.rrule;
    const key = occKey(occ);
    const isOptimistic = optimisticCompleted.has(key);
    const isVisuallyCompleted = occ.isCompleted || isOptimistic;
    const isSparkle = justCompleted.has(key);
    const isDimmed = isVisuallyCompleted || occ.isPostponed;

    return (
      <SwipeableItem
        key={key}
        onComplete={() => {
          if (!isVisuallyCompleted) handleOptimisticComplete(occ);
        }}
        onOptions={() => openActions(occ)}
        onClick={() => setSelectedItem(item)}
      >
        <div className={cn("flex items-center gap-3 p-3 rounded-xl border", cardBg)}>
          <SparkleCheckbox
            checked={isVisuallyCompleted}
            justCompleted={isSparkle}
            onToggle={() => handleOptimisticComplete(occ)}
          />
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
            <div className="flex items-center gap-1.5">
              <p
                className={cn(
                  "text-sm font-medium truncate",
                  isDimmed ? cn(subtleText, "line-through") : mainText,
                )}
              >
                {item.title}
              </p>
              {isRecurring && (
                <RefreshCw className={cn("w-3 h-3 flex-shrink-0", subtleText)} />
              )}
            </div>
            <div className={cn("flex items-center gap-2 text-xs", subtleText)}>
              {showDate && <span>{format(occurrenceDate, "EEE, MMM d")}</span>}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(occurrenceDate, "h:mm a")}
              </span>
              {isFlexible && <span>Flexible</span>}
              {occ.isPostponed && <span className="text-blue-400">Postponed</span>}
            </div>
          </div>
          {isFlexible && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pushOffFlexible(item);
              }}
              aria-label="Push off"
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                isFrost ? "bg-amber-50 text-amber-500" : "bg-amber-500/10 text-amber-400",
              )}
            >
              <CalendarOff className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openActions(occ);
            }}
            aria-label="More actions"
            className="p-1.5 rounded-lg flex-shrink-0"
          >
            <MoreHorizontal className={cn("w-4 h-4", subtleText)} />
          </button>
        </div>
      </SwipeableItem>
    );
  };

  const renderPrimaryOccurrenceCard = (occ: ExpandedOccurrence) => {
    const { item, occurrenceDate } = occ;
    const Icon = typeIcons[item.type];
    const colors = typeColor[item.type];
    const { schedule } = asFlexInfo(item);
    const isFlexible = !!schedule || !!item.recurrence_rule?.is_flexible;
    const isRecurring = !!item.recurrence_rule?.rrule;
    const key = occKey(occ);
    const isOptimistic = optimisticCompleted.has(key);
    const isVisuallyCompleted = occ.isCompleted || isOptimistic;
    const isSparkle = justCompleted.has(key);

    return (
      <SwipeableItem
        key={`primary-${key}`}
        onComplete={() => {
          if (!isVisuallyCompleted) handleOptimisticComplete(occ);
        }}
        onOptions={() => openActions(occ)}
        onClick={() => setSelectedItem(item)}
      >
        <div className={cn("rounded-2xl border p-4", cardBg)}>
          <div className="flex items-start gap-3">
            <SparkleCheckbox
              checked={isVisuallyCompleted}
              justCompleted={isSparkle}
              onToggle={() => handleOptimisticComplete(occ)}
            />
            <div
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                colors.bg,
                colors.text,
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1", subtleText)}>
                Next item
              </p>
              <div className="flex items-center gap-1.5">
                <h2
                  className={cn(
                    "text-base font-semibold truncate",
                    isVisuallyCompleted ? cn(subtleText, "line-through") : mainText,
                  )}
                >
                  {item.title}
                </h2>
                {isRecurring && (
                  <RefreshCw className={cn("w-3.5 h-3.5 flex-shrink-0", subtleText)} />
                )}
              </div>
              <div className={cn("mt-1.5 flex flex-wrap items-center gap-2 text-xs", subtleText)}>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(occurrenceDate, "h:mm a")}
                </span>
                {isFlexible && <span>Flexible</span>}
                {occ.isPostponed && <span className="text-blue-400">Postponed</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openActions(occ);
              }}
              aria-label="More actions"
              className="p-1.5 rounded-lg flex-shrink-0"
            >
              <MoreHorizontal className={cn("w-4 h-4", subtleText)} />
            </button>
          </div>
          {isFlexible && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pushOffFlexible(item);
              }}
              className={cn(
                "mt-3 w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5",
                isFrost ? "bg-amber-50 text-amber-500" : "bg-amber-500/10 text-amber-400",
              )}
            >
              <CalendarOff className="w-3.5 h-3.5" />
              Push off
            </button>
          )}
        </div>
      </SwipeableItem>
    );
  };

  const renderAssignmentItem = (
    item: ItemWithDetails,
    actionLabel: string,
    onAction: () => void,
  ) => {
    const Icon = typeIcons[item.type];
    const dateStrLabel =
      item.type === "event" ? item.event_details?.start_at : item.reminder_details?.due_at;
    const dateLabel = dateStrLabel ? format(parseISO(dateStrLabel), "MMM d") : null;

    return (
      <div key={item.id} className={cn("flex items-center gap-3 p-3 rounded-xl border", cardBg)}>
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            typeColor[item.type].bg,
            typeColor[item.type].text,
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium truncate", mainText)}>{item.title}</p>
          {dateLabel && (
            <p className={cn("text-xs flex items-center gap-1", subtleText)}>
              <Clock className="w-3 h-3" />
              {dateLabel}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300"
        >
          {actionLabel}
        </button>
      </div>
    );
  };

  const renderSectionToggle = (
    label: string,
    suffix: string | null,
    count: number,
    open: boolean,
    onToggle: () => void,
  ) => (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between w-full mb-3"
    >
      <span
        className={cn(
          "flex items-center gap-2 text-xs font-bold uppercase tracking-wider",
          subtleText,
        )}
      >
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", !open && "-rotate-90")} />
        {label}
        {suffix ? ` · ${suffix}` : ""}
      </span>
      {count > 0 && (
        <span
          className={cn(
            "min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center",
            activeBadge,
          )}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="pb-24">
      {/* Day nav + plan header */}
      <div
        className={cn("px-4 pt-4 pb-4 border-b", isFrost ? "border-slate-100" : "border-white/[0.06]")}
      >
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => onSelectedDateChange((d) => subDays(d, 1))}
            className={cn("w-9 h-9 rounded-xl flex items-center justify-center", ghostButton)}
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center min-w-0">
            <p className={cn("text-lg font-semibold", mainText)}>
              {format(selectedDate, "EEEE")}
            </p>
            <div className="mt-0.5 flex items-center justify-center gap-2">
              <input
                type="date"
                value={dateStr}
                onChange={(e) => e.target.value && onSelectedDateChange(parseISO(e.target.value))}
                className={cn("text-xs bg-transparent text-center", subtleText)}
              />
              {!selectedIsToday && (
                <button
                  type="button"
                  onClick={() => onSelectedDateChange(new Date())}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    activeBadge,
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  Today
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectedDateChange((d) => addDays(d, 1))}
            className={cn("w-9 h-9 rounded-xl flex items-center justify-center", ghostButton)}
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
        ) : mode === "planning" ? (
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
              <span className={cn("flex items-center rounded-xl border px-3 py-2.5", fieldBg)}>
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
              {isPublicDraft ? <Users className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
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
                        const opt = INTENT_OPTIONS.find((o) => o.value === plan.intent);
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
                    onClick={handleOpenPlanning}
                    aria-label="Edit day plan"
                    className={cn("w-8 h-8 rounded-lg flex items-center justify-center", ghostButton)}
                  >
                    <PencilLine className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    aria-label="Delete day plan"
                    className={cn("w-8 h-8 rounded-lg flex items-center justify-center", ghostButton)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {plan.notes && (
                <p className={cn("text-xs mb-2 whitespace-pre-wrap", subtleText)}>{plan.notes}</p>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full",
                  plan.is_public ? activeBadge : mutedBadge,
                )}
              >
                {plan.is_public ? <Users className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {plan.is_public ? "Shared with household" : "Private"}
              </span>

              {sortedPlanChecklist.length > 0 && (
                <div
                  className={cn(
                    "mt-3 pt-3 border-t space-y-2",
                    isFrost ? "border-slate-100" : "border-white/[0.06]",
                  )}
                >
                  {sortedPlanChecklist.map((ci) => (
                    <div key={ci.id} className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleChecklistItem(ci.id)}
                        aria-label={ci.done_at ? "Mark not done" : "Mark done"}
                      >
                        {ci.done_at ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className={cn("w-4 h-4", subtleText)} />
                        )}
                      </button>
                      <span
                        className={cn(
                          "flex-1 text-sm",
                          ci.done_at ? cn(subtleText, "line-through") : mainText,
                        )}
                      >
                        {ci.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {partnerPlan && (partnerPlan.title || partnerPlan.intent) && (
          <p className={cn("mt-2 text-xs", subtleText)}>
            <span className={cn("font-medium", partnerAccent)}>{partnerName}</span>
            {partnerPlan.title
              ? ` is planning: ${partnerPlan.title}`
              : ` set this day to ${partnerPlan.intent}`}
          </p>
        )}
      </div>

      <div className="px-4 py-5 space-y-6">
        {mode === "planning" && (
          <>
            {/* Prepone pool */}
            <div>
              {renderSectionToggle(
                "Prepone pool",
                flexibleRoutines?.periodLabel ?? null,
                preponeCandidates.length,
                preponePoolOpen,
                () => setPreponePoolOpen((v) => !v),
              )}
              {preponePoolOpen &&
                (preponeCandidates.length === 0 ? (
                  <div className={cn("text-center py-8 rounded-xl border", cardBg)}>
                    <Inbox className={cn("w-6 h-6 mx-auto mb-2", subtleText)} />
                    <p className={cn("text-xs", subtleText)}>No flexible items to pull in</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {preponeCandidates.map((item) => {
                      const { schedule } = asFlexInfo(item);
                      return (
                        <div
                          key={`${item.id}-${schedule?.occurrence_index ?? 0}`}
                          className={cn("rounded-xl border p-3 flex items-center gap-3", cardBg)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-medium truncate", mainText)}>
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

            {/* Checklist editor */}
            <div>
              <h3 className={cn("text-xs font-bold uppercase tracking-wider mb-3", subtleText)}>
                Checklist
              </h3>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleChecklistDragEnd}
              >
                <SortableContext
                  items={sortedChecklistDraft.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 mb-3">
                    {sortedChecklistDraft.map((item) => (
                      <ChecklistSortableRow
                        key={item.id}
                        item={item}
                        mainText={mainText}
                        subtleText={subtleText}
                        cardBg={cardBg}
                        onRemove={() =>
                          setChecklistDraft((items) =>
                            items
                              .filter((c) => c.id !== item.id)
                              .map((c, idx) => ({ ...c, sort_order: idx })),
                          )
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={checklistLabel}
                  onChange={(e) => setChecklistLabel(e.target.value)}
                  placeholder="e.g. Get dressed"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addChecklistItem();
                  }}
                  className={cn(
                    "flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none",
                    isFrost
                      ? "bg-slate-100 text-slate-700 placeholder:text-slate-400"
                      : "bg-white/5 text-white/80 placeholder:text-white/25",
                  )}
                />
                <button
                  type="button"
                  disabled={!checklistLabel.trim()}
                  onClick={addChecklistItem}
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-40 flex-shrink-0",
                    isPink ? "bg-pink-500/20 text-pink-300" : "bg-cyan-500/20 text-cyan-300",
                  )}
                  aria-label="Add checklist item"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-medium",
                    isFrost ? "bg-slate-100 text-slate-600" : "bg-white/5 text-white/70",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={upsertDayPlan.isPending}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50",
                    isPink ? "bg-pink-500/20 text-pink-300" : "bg-cyan-500/20 text-cyan-300",
                  )}
                >
                  {upsertDayPlan.isPending ? "Saving..." : "Save day plan"}
                </button>
              </div>
            </div>

            {/* Ad-hoc task */}
            <div>
              <h3 className={cn("text-xs font-bold uppercase tracking-wider mb-3", subtleText)}>
                Add a task for this day
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={taskTime}
                  onChange={(e) => setTaskTime(e.target.value)}
                  className={cn(
                    "text-xs rounded-lg px-2 py-2",
                    isFrost ? "bg-slate-100 text-slate-600" : "bg-white/5 text-white/70",
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
                    isPink ? "bg-pink-500/20 text-pink-300" : "bg-cyan-500/20 text-cyan-300",
                  )}
                  aria-label="Add task"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {itemsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div
              className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                isPink ? "bg-pink-400" : "bg-cyan-400",
              )}
            />
          </div>
        ) : (
          <>
            {/* Selected day */}
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider", subtleText)}>
                    {selectedIsToday ? "Today" : format(selectedDate, "EEE, MMM d")}
                  </p>
                  <h2 className={cn("text-lg font-semibold", mainText)}>
                    {dayOccurrences.length === 0
                      ? "Nothing scheduled"
                      : `${dayOccurrences.length} item${dayOccurrences.length === 1 ? "" : "s"}`}
                  </h2>
                </div>
                {openRemainingOccurrences.length > 0 && (
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", mutedBadge)}>
                    {openRemainingOccurrences.length} more
                  </span>
                )}
              </div>

              {primaryOccurrence ? (
                <>
                  {renderPrimaryOccurrenceCard(primaryOccurrence)}
                  {openRemainingOccurrences.length > 0 && (
                    <div className="space-y-2">
                      {openRemainingOccurrences.map((occ) => renderOccurrenceRow(occ))}
                    </div>
                  )}
                  {showCompleted && completedRemainingOccurrences.length > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setCompletedSectionOpen((open) => !open)}
                        className={cn(
                          "flex items-center gap-2 text-xs font-bold uppercase tracking-wider w-full",
                          subtleText,
                        )}
                      >
                        <ChevronDown
                          className={cn(
                            "w-3.5 h-3.5 transition-transform",
                            completedSectionOpen ? "rotate-0" : "-rotate-90",
                          )}
                        />
                        Completed ({completedRemainingOccurrences.length})
                      </button>
                      {completedSectionOpen && (
                        <div className="space-y-2 mt-2">
                          {completedRemainingOccurrences.map((occ) => renderOccurrenceRow(occ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className={cn("text-center py-10 rounded-2xl border", cardBg)}>
                  <Calendar className={cn("w-7 h-7 mx-auto mb-2", subtleText)} />
                  <p className={cn("text-sm font-medium", subtleText)}>
                    Nothing scheduled for this day
                  </p>
                </div>
              )}
            </section>

            {/* Overdue (today only, top-icon controlled) */}
            {overdueSectionVisible && (
              <section>
                <div className="flex items-center justify-between w-full mb-3">
                  <span
                    className={cn(
                      "flex items-center gap-2 text-xs font-bold uppercase tracking-wider",
                      subtleText,
                    )}
                  >
                    Overdue
                  </span>
                  <span
                    className={cn(
                      "min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center",
                      activeBadge,
                    )}
                  >
                    {overdueOccurrences.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {overdueOccurrences.map((occ) => renderOccurrenceRow(occ, true))}
                </div>
              </section>
            )}

            {/* Upcoming (today only) */}
            {selectedIsToday && (
              <div>
                {renderSectionToggle(
                  "Upcoming",
                  "next 7 days",
                  upcomingOccurrences.length,
                  upcomingOpen,
                  () => setUpcomingOpen((v) => !v),
                )}
                {upcomingOpen &&
                  (upcomingOccurrences.length === 0 ? (
                    <div className={cn("text-center py-8 rounded-xl border", cardBg)}>
                      <p className={cn("text-xs", subtleText)}>Nothing upcoming this week</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingOccurrences.map((occ) => renderOccurrenceRow(occ, true))}
                    </div>
                  ))}
              </div>
            )}

            {/* Assigned to me (today only) */}
            {selectedIsToday && assignedToMeItems.length > 0 && (
              <div>
                {renderSectionToggle(
                  "Assigned to me",
                  null,
                  assignedToMeItems.length,
                  assignedToMeOpen,
                  () => setAssignedToMeOpen((v) => !v),
                )}
                {assignedToMeOpen && (
                  <div className="space-y-2">
                    {assignedToMeItems.map((item) =>
                      renderAssignmentItem(item, "Return →", () =>
                        partnerUserId ? handleReassign(item, partnerUserId) : undefined,
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Assigned out (today only) */}
            {selectedIsToday && assignedOutItems.length > 0 && (
              <div>
                {renderSectionToggle(
                  "Assigned out",
                  null,
                  assignedOutItems.length,
                  assignedOutOpen,
                  () => setAssignedOutOpen((v) => !v),
                )}
                {assignedOutOpen && (
                  <div className="space-y-2">
                    {assignedOutItems.map((item) =>
                      renderAssignmentItem(item, "← Reclaim", () =>
                        currentUserId ? handleReassign(item, currentUserId) : undefined,
                      ),
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add New Reminder FAB */}
      <Link
        href="/expense"
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-20",
          isPink
            ? "bg-pink-500 hover:bg-pink-600 shadow-pink-500/30"
            : "bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/30",
        )}
      >
        <Plus className="w-6 h-6 text-white" />
      </Link>

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={() => {
            setEditingItem(selectedItem);
            setSelectedItem(null);
          }}
          onDelete={() => {
            itemActions.handleDelete(selectedItem);
            setSelectedItem(null);
          }}
          currentUserId={currentUserId}
        />
      )}

      {editingItem && (
        <WebEventFormDialog
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          editItem={editingItem}
        />
      )}

      {/* Item Actions Sheet (Complete, Postpone, Cancel, Delete) */}
      {actionsState && (
        <ItemActionsSheet
          item={actionsState.item}
          occurrenceDate={actionsState.occurrenceDate}
          isOpen={!!actionsState}
          onClose={() => setActionsState(null)}
          onComplete={(reason) => {
            itemActions.handleComplete(actionsState.item, actionsState.occurrenceDate, reason);
            setActionsState(null);
          }}
          onPostpone={(type: PostponeType, reason?: string) => {
            itemActions.handlePostpone(actionsState.item, actionsState.occurrenceDate, type, reason);
            setActionsState(null);
          }}
          onCancel={(reason) => {
            itemActions.handleCancel(actionsState.item, actionsState.occurrenceDate, reason);
            setActionsState(null);
          }}
          onSkip={(reason) => {
            itemActions.handleSkip(actionsState.item, actionsState.occurrenceDate, reason);
            setActionsState(null);
          }}
          onDelete={() => {
            itemActions.handleDelete(actionsState.item);
            setActionsState(null);
          }}
          onReassign={(toUserId) => {
            handleReassign(actionsState.item, toUserId);
            setActionsState(null);
          }}
          onFocus={() => {
            setSelectedItem(actionsState.item);
            setActionsState(null);
          }}
          onReverseRecurrence={() => {
            handleReverseRecurrence(actionsState.item);
            setActionsState(null);
          }}
          onEdit={() => {
            if (actionsState.item.recurrence_rule) {
              setEditFlow({
                step: "chooser",
                item: actionsState.item,
                date: parseISO(actionsState.occurrenceDate),
              });
            } else {
              setEditingItem(actionsState.item);
            }
            setActionsState(null);
          }}
          onEditOccurrence={() => {
            setEditFlow({
              step: "occurrence",
              item: actionsState.item,
              date: parseISO(actionsState.occurrenceDate),
            });
            setActionsState(null);
          }}
        />
      )}

      {/* Recurring edit chooser + per-occurrence dialog — both mounted whenever editFlow
           is non-null so transitioning between steps is a single state update. */}
      {editFlow && (
        <>
          <RecurringEditChoiceDialog
            open={editFlow.step === "chooser"}
            onOpenChange={(o) => !o && setEditFlow(null)}
            item={editFlow.item}
            hideFuture
            onChoose={(modeChoice: RecurringEditMode) => {
              const { item, date } = editFlow;
              if (modeChoice === "this") {
                setEditFlow({ step: "occurrence", item, date });
              } else {
                if (modeChoice === "future") {
                  toast.info(
                    "'This and all future' is coming soon — editing the whole series for now.",
                  );
                }
                setEditFlow(null);
                setEditingItem(item);
              }
            }}
          />

          <EditOccurrenceDialog
            open={editFlow.step === "occurrence"}
            onOpenChange={(o) => !o && setEditFlow(null)}
            item={editFlow.item}
            occurrenceDate={editFlow.date}
            onSuccess={() => setEditFlow(null)}
          />
        </>
      )}
    </div>
  );
}
