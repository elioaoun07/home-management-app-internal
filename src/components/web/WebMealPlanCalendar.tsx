"use client";

import MealPlanDropSheet from "@/components/web/MealPlanDropSheet";
import RecipeSidePanel, {
  RecipeDragOverlay,
} from "@/components/web/RecipeSidePanel";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useDeleteMealPlan,
  useHousehold,
  useMealPlansForWeek,
  useUpdateMealPlan,
} from "@/features/meal-planning/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type { MealPlanWithRecipe, MealType, RecipeListItem } from "@/types/recipe";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import { ChefHat, ChevronLeft, ChevronRight, X } from "lucide-react";
import React from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const MEAL_SLOTS: MealType[] = ["breakfast", "lunch", "dinner"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};
const MEAL_ICONS: Record<MealType, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🫐",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getMealActiveDates(mp: MealPlanWithRecipe): string[] {
  const dates: string[] = [mp.planned_date];
  if (mp.eats_through_date && mp.eats_through_date > mp.planned_date) {
    const cur = new Date(mp.planned_date + "T12:00:00");
    const end = new Date(mp.eats_through_date + "T12:00:00");
    cur.setDate(cur.getDate() + 1);
    while (cur <= end) {
      dates.push(fmtDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }
  return dates;
}

// ─── Meal plan card ───────────────────────────────────────────────────────────

function MealPlanCard({
  plan,
  isLeftover,
  currentUserId,
  partnerId,
  theme,
  isFrost,
  onClick,
}: {
  plan: MealPlanWithRecipe;
  isLeftover: boolean;
  currentUserId?: string;
  partnerId?: string | null;
  theme: string;
  isFrost: boolean;
  onClick: () => void;
}) {
  const isPink = theme === "pink";
  const isPartner = plan.for_user_id !== null && plan.for_user_id === partnerId;
  const isMe = plan.for_user_id !== null && plan.for_user_id === currentUserId;

  // Hard Rule 14: blue-theme user = blue, partner = pink; pink-theme = reverse
  const dotClass =
    plan.for_user_id === null
      ? ""
      : isMe
        ? isPink
          ? "border-l-2 border-pink-400"
          : "border-l-2 border-blue-400"
        : isPink
          ? "border-l-2 border-blue-400"
          : "border-l-2 border-pink-400";

  const isCooked = plan.status === "cooked";
  const isSkipped = plan.status === "skipped";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-1.5 rounded-lg text-xs mb-1 transition-all neo-card hover:scale-[1.02] active:scale-95",
        dotClass,
        isLeftover && "opacity-50",
        (isCooked || isSkipped) && "opacity-40",
      )}
    >
      <div className="flex items-center gap-1.5">
        {plan.recipe.image_url ? (
          <img
            src={plan.recipe.image_url}
            alt=""
            className="w-6 h-6 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <ChefHat className="w-3 h-3 text-amber-400" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "font-medium truncate leading-tight",
              isFrost ? "text-gray-900" : "text-white",
              isCooked && "line-through",
              isSkipped && "line-through opacity-60",
            )}
          >
            {plan.recipe.name}
          </div>
          {isLeftover && (
            <span className="text-amber-400/70 text-[10px]">Leftover</span>
          )}
          {isCooked && !isLeftover && (
            <span className="text-green-400/70 text-[10px]">Cooked ✓</span>
          )}
          {isPartner && !isMe && (
            <span
              className={cn(
                "text-[10px]",
                isPink ? "text-blue-400/70" : "text-pink-400/70",
              )}
            >
              Partner
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Droppable slot cell ───────────────────────────────────────────────────────

function MealSlotCell({
  id,
  plans,
  isToday,
  currentUserId,
  partnerId,
  theme,
  isFrost,
  onPlanClick,
}: {
  id: string;
  plans: (MealPlanWithRecipe & { _isLeftover: boolean })[];
  isToday: boolean;
  currentUserId?: string;
  partnerId?: string | null;
  theme: string;
  isFrost: boolean;
  onPlanClick: (plan: MealPlanWithRecipe) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[80px] p-1.5 border-r border-b transition-colors",
        isFrost ? "border-gray-100" : "border-white/5",
        isOver && (isFrost ? "bg-amber-50" : "bg-amber-500/10"),
        isToday && !isOver && (isFrost ? "bg-amber-50/50" : "bg-amber-500/[0.04]"),
      )}
    >
      {plans.map((plan) => (
        <MealPlanCard
          key={`${plan.id}-${plan._isLeftover ? "leftover" : "primary"}`}
          plan={plan}
          isLeftover={plan._isLeftover}
          currentUserId={currentUserId}
          partnerId={partnerId}
          theme={theme}
          isFrost={isFrost}
          onClick={() => onPlanClick(plan)}
        />
      ))}
    </div>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function MealPlanDetailSheet({
  plan,
  isFrost,
  onClose,
}: {
  plan: MealPlanWithRecipe;
  isFrost: boolean;
  onClose: () => void;
}) {
  const updateMealPlan = useUpdateMealPlan();
  const deleteMealPlan = useDeleteMealPlan();

  const handleStatusChange = async (status: "cooked" | "skipped" | "planned") => {
    await updateMealPlan.mutateAsync({ id: plan.id, status });
    toast.success(
      status === "cooked"
        ? "Marked as cooked!"
        : status === "skipped"
          ? "Meal skipped"
          : "Reset to planned",
      { icon: ToastIcons.update, duration: 3000, action: { label: "Undo", onClick: () => updateMealPlan.mutate({ id: plan.id, status: plan.status }) } },
    );
    onClose();
  };

  const handleDelete = () => {
    deleteMealPlan.mutate(plan.id, {
      onSuccess: () => {
        toast.success("Removed from plan", {
          icon: ToastIcons.delete,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () => {
              // Invalidation only — full undo would require re-creating the plan
              void null;
            },
          },
        });
      },
    });
    onClose();
  };

  const dateLabel = new Date(plan.planned_date + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" },
  );

  const btn = cn(
    "flex-1 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 border",
    isFrost
      ? "border-gray-200 text-gray-700 hover:bg-gray-100"
      : "border-white/10 text-white/70 hover:bg-white/10",
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          "w-full max-w-lg rounded-t-2xl p-6 space-y-4",
          isFrost
            ? "bg-white shadow-2xl"
            : "bg-[#0f1d2e] border-t border-white/10",
        )}
      >
        <div className="flex items-start gap-4">
          {plan.recipe.image_url ? (
            <img
              src={plan.recipe.image_url}
              alt=""
              className="w-14 h-14 rounded-xl object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <ChefHat className="w-7 h-7 text-amber-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "font-bold text-lg",
                isFrost ? "text-gray-900" : "text-white",
              )}
            >
              {plan.recipe.name}
            </h3>
            <p
              className={cn(
                "text-sm",
                isFrost ? "text-gray-500" : "text-white/50",
              )}
            >
              {MEAL_LABELS[plan.meal_type]} · {dateLabel}
            </p>
          </div>
          <button onClick={onClose} className={cn("p-1 rounded-lg", isFrost ? "text-gray-400 hover:text-gray-700" : "text-white/40 hover:text-white/80")}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status actions */}
        <div className="flex gap-2">
          {plan.status !== "cooked" && (
            <button onClick={() => handleStatusChange("cooked")} className={btn}>
              ✓ Cooked
            </button>
          )}
          {plan.status !== "skipped" && (
            <button onClick={() => handleStatusChange("skipped")} className={btn}>
              Skip
            </button>
          )}
          {plan.status !== "planned" && (
            <button onClick={() => handleStatusChange("planned")} className={btn}>
              Reset
            </button>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-red-400 border border-red-400/20 hover:bg-red-400/10 active:scale-95 transition-all"
        >
          Remove from plan
        </button>
      </div>
    </div>
  );
}

// ─── Main calendar ─────────────────────────────────────────────────────────────

interface PendingDrop {
  recipe: RecipeListItem;
  date: string;
  mealType: MealType;
}

export default function WebMealPlanCalendar({
  currentUserId,
}: {
  currentUserId?: string;
}) {
  const themeClasses = useThemeClasses();
  const { theme } = useTheme();
  const isFrost = theme === "frost" || theme === "calm";

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<MealPlanWithRecipe | null>(null);
  const [activeDragRecipe, setActiveDragRecipe] = useState<RecipeListItem | null>(null);

  const { data: household } = useHousehold(currentUserId);
  const partnerId = household?.partner_id ?? null;

  const weekDays = useMemo<string[]>(() => {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(fmtDate(d));
    }
    return days;
  }, [weekStart]);

  const weekStartStr = fmtDate(weekStart);
  const { data: mealPlans = [] } = useMealPlansForWeek(weekStartStr);

  // Build slot → plans lookup, expanding leftover dates
  const plansBySlot = useMemo(() => {
    const map: Record<string, (MealPlanWithRecipe & { _isLeftover: boolean })[]> = {};
    for (const mp of mealPlans) {
      const activeDates = getMealActiveDates(mp);
      for (const date of activeDates) {
        if (!weekDays.includes(date)) continue;
        const key = `${date}|${mp.meal_type}`;
        if (!map[key]) map[key] = [];
        map[key].push({ ...mp, _isLeftover: date !== mp.planned_date });
      }
    }
    return map;
  }, [mealPlans, weekDays]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragRecipe(
      (event.active.data.current as { recipe?: RecipeListItem })?.recipe ?? null,
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragRecipe(null);
    const { active, over } = event;
    if (!over) return;
    const [date, mealType] = String(over.id).split("|");
    const recipe = (active.data.current as { recipe?: RecipeListItem })?.recipe;
    if (recipe && date && mealType) {
      setPendingDrop({ recipe, date, mealType: mealType as MealType });
    }
  };

  const today = fmtDate(new Date());

  const weekEndDate = new Date(weekDays[6] + "T12:00:00");
  const weekLabel = `${new Date(weekDays[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEndDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const borderClass = isFrost ? "border-gray-100" : "border-white/[0.06]";

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className={cn("flex h-full relative overflow-hidden", themeClasses.pageBg)}
      >
        {/* Warm ambient backdrop for meal-plan mode */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-amber-500/[0.06] blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-orange-500/[0.05] blur-3xl" />
        </div>

        {/* Recipe side panel */}
        <RecipeSidePanel />

        {/* Main calendar area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Week navigation */}
          <div
            className={cn(
              "flex-shrink-0 flex items-center justify-between px-4 py-3 border-b",
              isFrost ? "border-gray-200 bg-white/50" : "border-white/10",
            )}
          >
            <button
              onClick={() => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() - 7);
                setWeekStart(d);
              }}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isFrost
                  ? "hover:bg-gray-100 text-gray-600"
                  : "hover:bg-white/10 text-white/60",
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span
              className={cn(
                "font-semibold text-sm",
                isFrost ? "text-gray-900" : "text-white",
              )}
            >
              {weekLabel}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekStart(getWeekStart(new Date()))}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-lg border transition-colors mr-1",
                  isFrost
                    ? "border-gray-200 text-gray-600 hover:bg-gray-100"
                    : "border-white/20 text-white/50 hover:bg-white/10",
                )}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() + 7);
                  setWeekStart(d);
                }}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isFrost
                    ? "hover:bg-gray-100 text-gray-600"
                    : "hover:bg-white/10 text-white/60",
                )}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto">
            <div
              className="grid min-w-[700px]"
              style={{
                gridTemplateColumns: "72px repeat(7, 1fr)",
              }}
            >
              {/* Corner */}
              <div
                className={cn(
                  "sticky top-0 z-10 p-2 border-r border-b",
                  borderClass,
                  isFrost ? "bg-gray-50" : "bg-[var(--page-bg,#0a1628)]",
                )}
              />

              {/* Day headers */}
              {weekDays.map((date) => {
                const d = new Date(date + "T12:00:00");
                const isToday = date === today;
                return (
                  <div
                    key={date}
                    className={cn(
                      "sticky top-0 z-10 p-2 text-center border-r border-b",
                      borderClass,
                      isFrost
                        ? "bg-gray-50 text-gray-700"
                        : "bg-[var(--page-bg,#0a1628)] text-white/80",
                      isToday && "text-amber-400",
                    )}
                  >
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        isToday && "text-amber-400",
                      )}
                    >
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div
                      className={cn(
                        "text-xs mt-0.5",
                        isToday
                          ? "text-amber-400"
                          : isFrost
                            ? "text-gray-400"
                            : "text-white/40",
                      )}
                    >
                      {d.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Meal rows */}
              {MEAL_SLOTS.map((mealType) => (
                <React.Fragment key={mealType}>
                  {/* Row label */}
                  <div
                    className={cn(
                      "p-2 flex flex-col items-center justify-center border-r border-b text-center",
                      borderClass,
                      isFrost ? "text-gray-500" : "text-white/40",
                    )}
                  >
                    <span className="text-xl leading-none mb-1">
                      {MEAL_ICONS[mealType]}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide">
                      {MEAL_LABELS[mealType]}
                    </span>
                  </div>

                  {/* Day cells */}
                  {weekDays.map((date) => {
                    const slotKey = `${date}|${mealType}`;
                    const plans = plansBySlot[slotKey] ?? [];
                    return (
                      <MealSlotCell
                        key={slotKey}
                        id={slotKey}
                        plans={plans}
                        isToday={date === today}
                        currentUserId={currentUserId}
                        partnerId={partnerId}
                        theme={theme}
                        isFrost={isFrost}
                        onPlanClick={setSelectedPlan}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDragRecipe && <RecipeDragOverlay recipe={activeDragRecipe} />}
      </DragOverlay>

      {/* Drop sheet */}
      {pendingDrop && (
        <MealPlanDropSheet
          recipe={pendingDrop.recipe}
          targetDate={pendingDrop.date}
          mealType={pendingDrop.mealType}
          currentUserId={currentUserId}
          partnerId={partnerId}
          onClose={() => setPendingDrop(null)}
        />
      )}

      {/* Detail sheet */}
      {selectedPlan && (
        <MealPlanDetailSheet
          plan={selectedPlan}
          isFrost={isFrost}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </DndContext>
  );
}
