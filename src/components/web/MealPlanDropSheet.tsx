"use client";

import {
  useCreateMealPlan,
  useDeleteMealPlan,
} from "@/features/meal-planning/hooks";
import { useTheme } from "@/contexts/ThemeContext";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type { MealPlan, MealType, RecipeListItem } from "@/types/recipe";
import { ChefHat, Clock, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Assignment = "both" | "me" | "partner";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

interface Props {
  recipe: RecipeListItem;
  targetDate: string;
  mealType: MealType;
  currentUserId?: string;
  partnerId?: string | null;
  onClose: () => void;
}

export default function MealPlanDropSheet({
  recipe,
  targetDate,
  mealType,
  currentUserId,
  partnerId,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const isPink = theme === "pink";
  const isFrost = theme === "frost" || theme === "calm";

  const householdSize = partnerId ? 2 : 1;
  const recipeServings = recipe.servings ?? 4;
  const defaultDays = Math.max(1, Math.floor(recipeServings / householdSize));

  const [assignment, setAssignment] = useState<Assignment>("both");
  const [spreadDays, setSpreadDays] = useState(defaultDays);
  const [servingsPlanned, setServingsPlanned] = useState(recipeServings);
  const [notes, setNotes] = useState("");

  const createMealPlan = useCreateMealPlan();
  const deleteMealPlan = useDeleteMealPlan();

  const eatsThroughDate = (() => {
    if (spreadDays <= 1) return null;
    const d = new Date(targetDate + "T12:00:00");
    d.setDate(d.getDate() + spreadDays - 1);
    return d.toISOString().split("T")[0];
  })();

  const spreadPreviewLabel = (() => {
    const cookLabel = new Date(targetDate + "T12:00:00").toLocaleDateString(
      "en-US",
      { weekday: "short", month: "short", day: "numeric" },
    );
    if (!eatsThroughDate) return `${MEAL_LABELS[mealType]}, ${cookLabel}`;
    const lastLabel = new Date(eatsThroughDate + "T12:00:00").toLocaleDateString(
      "en-US",
      { weekday: "short", month: "short", day: "numeric" },
    );
    return `${MEAL_LABELS[mealType]}, ${cookLabel} → ${lastLabel} (leftover)`;
  })();

  const forUserId = (() => {
    if (assignment === "both") return null;
    if (assignment === "me") return currentUserId ?? null;
    return partnerId ?? null;
  })();

  const handleConfirm = async () => {
    try {
      const plan = await createMealPlan.mutateAsync({
        recipe_id: recipe.id,
        planned_date: targetDate,
        meal_type: mealType,
        for_user_id: forUserId,
        eats_through_date: eatsThroughDate,
        servings_planned:
          servingsPlanned !== recipeServings ? servingsPlanned : null,
        notes: notes || null,
      });
      onClose();
      toast.success(`${recipe.name} planned for ${MEAL_LABELS[mealType]}!`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => deleteMealPlan.mutate((plan as MealPlan).id),
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to plan meal");
    }
  };

  // Color Identity per Hard Rule 14: blue-theme user = blue, partner = pink; pink-theme = reverse
  const meDotClass = isPink ? "bg-pink-400" : "bg-blue-400";
  const partnerDotClass = isPink ? "bg-blue-400" : "bg-pink-400";
  const meActiveClass = isPink
    ? "bg-pink-500/20 border-pink-400 text-pink-300"
    : "bg-blue-500/20 border-blue-400 text-blue-300";
  const partnerActiveClass = isPink
    ? "bg-blue-500/20 border-blue-400 text-blue-300"
    : "bg-pink-500/20 border-pink-400 text-pink-300";

  const dateLabel = new Date(targetDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "short", day: "numeric" },
  );

  const baseInput = cn(
    "w-full px-3 py-2 text-sm rounded-xl border resize-none focus:outline-none",
    isFrost
      ? "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-400"
      : "bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-amber-400/50",
  );

  const labelClass = cn(
    "text-xs font-semibold uppercase tracking-wider",
    isFrost ? "text-gray-500" : "text-white/50",
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          "w-full max-w-lg rounded-t-2xl p-6 space-y-5 overflow-y-auto max-h-[90dvh]",
          isFrost
            ? "bg-white shadow-2xl"
            : "bg-[#0f1d2e] border-t border-white/10 shadow-2xl shadow-black/50",
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-4">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt=""
              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <ChefHat className="w-7 h-7 text-amber-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "font-bold text-lg truncate",
                isFrost ? "text-gray-900" : "text-white",
              )}
            >
              {recipe.name}
            </h3>
            <p className={cn("text-sm", isFrost ? "text-gray-500" : "text-white/50")}>
              {MEAL_LABELS[mealType]} · {dateLabel}
            </p>
            {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
              <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                {recipe.prep_time_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {recipe.prep_time_minutes}m prep
                  </span>
                )}
                {recipe.cook_time_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {recipe.cook_time_minutes}m cook
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className={cn(
              "flex-shrink-0 p-1 rounded-lg",
              isFrost
                ? "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                : "text-white/40 hover:text-white/80 hover:bg-white/10",
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Who's eating — only show when household partner exists */}
        {partnerId && (
          <div>
            <label className={cn(labelClass, "flex items-center gap-1.5 mb-2")}>
              <Users className="w-3.5 h-3.5" />
              Who&apos;s eating
            </label>
            <div className="flex gap-2">
              {(["both", "me", "partner"] as Assignment[]).map((a) => {
                const isActive = assignment === a;
                let activeClass = "bg-amber-500/20 border-amber-400 text-amber-300";
                if (a === "me") activeClass = meActiveClass;
                if (a === "partner") activeClass = partnerActiveClass;

                return (
                  <button
                    key={a}
                    onClick={() => setAssignment(a)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-1.5",
                      isActive
                        ? activeClass
                        : isFrost
                          ? "border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100"
                          : "border-white/10 text-white/50 bg-white/5 hover:bg-white/10",
                    )}
                  >
                    {a === "me" && (
                      <span className={cn("w-2 h-2 rounded-full", meDotClass)} />
                    )}
                    {a === "partner" && (
                      <span className={cn("w-2 h-2 rounded-full", partnerDotClass)} />
                    )}
                    {a === "both" ? "Both" : a === "me" ? "Me" : "Partner"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Leftover spread */}
        <div>
          <label
            className={cn(
              labelClass,
              "mb-2 flex items-center justify-between",
            )}
          >
            <span>Leftover spread</span>
            <span
              className={cn(
                "font-normal normal-case text-sm",
                isFrost ? "text-gray-700" : "text-white/70",
              )}
            >
              {spreadDays} {spreadDays === 1 ? "day" : "days"}
            </span>
          </label>
          <input
            type="range"
            min={1}
            max={7}
            value={spreadDays}
            onChange={(e) => setSpreadDays(Number(e.target.value))}
            className="w-full accent-amber-400 mb-1.5"
          />
          <p className="text-xs text-amber-400/80">{spreadPreviewLabel}</p>
        </div>

        {/* Servings */}
        <div className="flex items-center gap-3">
          <label className={cn(labelClass, "flex-1")}>Servings to cook</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setServingsPlanned((s) => Math.max(1, s - 1))}
              className={cn(
                "w-8 h-8 rounded-lg border text-base font-bold transition-colors",
                isFrost
                  ? "border-gray-200 text-gray-600 hover:bg-gray-100"
                  : "border-white/20 text-white/70 hover:bg-white/10",
              )}
            >
              −
            </button>
            <span
              className={cn(
                "w-8 text-center font-bold text-lg",
                isFrost ? "text-gray-900" : "text-white",
              )}
            >
              {servingsPlanned}
            </span>
            <button
              onClick={() => setServingsPlanned((s) => s + 1)}
              className={cn(
                "w-8 h-8 rounded-lg border text-base font-bold transition-colors",
                isFrost
                  ? "border-gray-200 text-gray-600 hover:bg-gray-100"
                  : "border-white/20 text-white/70 hover:bg-white/10",
              )}
            >
              +
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={cn(labelClass, "block mb-1.5")}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any cooking notes..."
            rows={2}
            className={baseInput}
          />
        </div>

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          disabled={createMealPlan.isPending}
          className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
        >
          {createMealPlan.isPending ? "Planning…" : "Add to Plan"}
        </button>
      </div>
    </div>
  );
}
