// src/components/web/WebMealPlanner.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useCreateMealPlan,
  useDeleteMealPlan,
  useMealPlansForWeek,
  useRecipes,
} from "@/features/recipes/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type {
  MealPlanWithRecipe,
  RecipeListItem,
  WeekDay,
} from "@/types/recipe";
import { RECIPE_TAGS } from "@/types/recipe";
import {
  CalendarDays,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import AddToShoppingDialog from "./AddToShoppingDialog";

// Helper to get week start (Sunday)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Helper to get day name
function getDayName(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

// Helper to format date display
function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WebMealPlanner() {
  const themeClasses = useThemeClasses();

  // Current week state
  const [weekStartDate, setWeekStartDate] = useState(() =>
    getWeekStart(new Date()),
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  const [showShoppingDialog, setShowShoppingDialog] = useState(false);
  const [selectedMealPlan, setSelectedMealPlan] =
    useState<MealPlanWithRecipe | null>(null);

  // Generate week days
  const weekDays = useMemo<WeekDay[]>(() => {
    const days: WeekDay[] = [];
    const today = formatDate(new Date());

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(date.getDate() + i);
      days.push({
        date: formatDate(date),
        dayName: getDayName(date),
        isToday: formatDate(date) === today,
        mealPlan: null, // Will be populated from query
      });
    }
    return days;
  }, [weekStartDate]);

  // Fetch meal plans for the week
  const { data: mealPlans = [], isLoading: plansLoading } = useMealPlansForWeek(
    formatDate(weekStartDate),
  );

  // Fetch recipes for selection
  const { data: recipes = [], isLoading: recipesLoading } = useRecipes();

  // Mutations
  const createMealPlan = useCreateMealPlan();
  const deleteMealPlan = useDeleteMealPlan();

  // Map meal plans to days
  const weekDaysWithPlans = useMemo(() => {
    return weekDays.map((day) => ({
      ...day,
      mealPlan: mealPlans.find((mp) => mp.planned_date === day.date) || null,
    }));
  }, [weekDays, mealPlans]);

  // Navigation
  const goToPreviousWeek = () => {
    const newDate = new Date(weekStartDate);
    newDate.setDate(newDate.getDate() - 7);
    setWeekStartDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(weekStartDate);
    newDate.setDate(newDate.getDate() + 7);
    setWeekStartDate(newDate);
  };

  const goToCurrentWeek = () => {
    setWeekStartDate(getWeekStart(new Date()));
  };

  // Handlers
  const handleDayClick = (day: WeekDay) => {
    if (day.mealPlan) {
      // If there's already a meal plan, show options
      setSelectedMealPlan(day.mealPlan);
      setShowShoppingDialog(true);
    } else {
      // Open recipe selector for this day
      setSelectedDay(day.date);
      setShowRecipeSelector(true);
    }
  };

  const handleSelectRecipe = async (recipe: RecipeListItem) => {
    if (!selectedDay) return;

    await createMealPlan.mutateAsync({
      recipe_id: recipe.id,
      planned_date: selectedDay,
      meal_type: "lunch",
    });

    setShowRecipeSelector(false);
    setSelectedDay(null);
  };

  const handleRemoveMealPlan = async (
    mealPlan: MealPlanWithRecipe,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (confirm("Remove this meal from the plan?")) {
      await deleteMealPlan.mutateAsync(mealPlan.id);
    }
  };

  // Week range display
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekRangeText = `${formatDateDisplay(weekStartDate)} - ${formatDateDisplay(weekEndDate)}`;

  const isCurrentWeek =
    formatDate(getWeekStart(new Date())) === formatDate(weekStartDate);

  return (
    <div className={`min-h-full ${themeClasses.pageBg}`}>
      {/* Header */}
      <div
        className={`sticky top-0 z-10 ${themeClasses.headerGradient} backdrop-blur-xl border-b ${themeClasses.border}`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-green-500/20">
                <CalendarDays className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  Meal Planner
                </h1>
                <p className="text-sm text-white/60">Plan your weekly meals</p>
              </div>
            </div>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousWeek}
                className="text-white/60 hover:text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="text-white font-medium min-w-[180px] text-center">
                {weekRangeText}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextWeek}
                className="text-white/60 hover:text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
            {!isCurrentWeek && (
              <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                Today
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Week Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {plansLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-3">
            {weekDaysWithPlans.map((day) => (
              <DayCard
                key={day.date}
                day={day}
                onClick={() => handleDayClick(day)}
                onRemove={(e) =>
                  day.mealPlan && handleRemoveMealPlan(day.mealPlan, e)
                }
                themeClasses={themeClasses}
              />
            ))}
          </div>
        )}

        {/* Weekly Summary */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className={cn("p-4", themeClasses.surfaceBg, "border-white/10")}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <ChefHat className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {mealPlans.length}
                </p>
                <p className="text-sm text-white/60">Meals planned</p>
              </div>
            </div>
          </Card>

          <Card
            className={cn("p-4", themeClasses.surfaceBg, "border-white/10")}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <ShoppingCart className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {
                    mealPlans.filter((mp) => mp.status === "shopping_added")
                      .length
                  }
                </p>
                <p className="text-sm text-white/60">Added to shopping</p>
              </div>
            </div>
          </Card>

          <Card
            className={cn("p-4", themeClasses.surfaceBg, "border-white/10")}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Clock className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {mealPlans.reduce(
                    (acc, mp) =>
                      acc +
                      (mp.recipe?.prep_time_minutes || 0) +
                      (mp.recipe?.cook_time_minutes || 0),
                    0,
                  )}
                </p>
                <p className="text-sm text-white/60">Total cook time (min)</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Recipe Selector Modal */}
      {showRecipeSelector && (
        <RecipeSelectorModal
          recipes={recipes}
          isLoading={recipesLoading || createMealPlan.isPending}
          selectedDate={selectedDay}
          onSelect={handleSelectRecipe}
          onClose={() => {
            setShowRecipeSelector(false);
            setSelectedDay(null);
          }}
          themeClasses={themeClasses}
        />
      )}

      {/* Add to Shopping Dialog */}
      {showShoppingDialog && selectedMealPlan && (
        <AddToShoppingDialog
          open={showShoppingDialog}
          onOpenChange={setShowShoppingDialog}
          mealPlan={selectedMealPlan}
        />
      )}
    </div>
  );
}

// Day Card Component
interface DayCardProps {
  day: WeekDay;
  onClick: () => void;
  onRemove: (e: React.MouseEvent) => void;
  themeClasses: ReturnType<typeof useThemeClasses>;
}

function DayCard({ day, onClick, onRemove, themeClasses }: DayCardProps) {
  const hasMeal = !!day.mealPlan;
  const date = new Date(day.date);
  const dayNum = date.getDate();

  return (
    <Card
      className={cn(
        "min-h-[180px] p-3 cursor-pointer transition-all group",
        themeClasses.surfaceBg,
        "border-white/10 hover:border-white/20",
        day.isToday && "ring-2 ring-primary",
      )}
      onClick={onClick}
    >
      {/* Day Header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            "text-sm",
            day.isToday ? "text-primary" : "text-white/60",
          )}
        >
          {day.dayName.slice(0, 3)}
        </span>
        <span
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-sm",
            day.isToday ? "bg-primary text-white" : "bg-white/10 text-white/80",
          )}
        >
          {dayNum}
        </span>
      </div>

      {/* Meal Content */}
      {hasMeal ? (
        <div className="relative">
          {/* Recipe Card */}
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {day.mealPlan!.recipe.name}
                </p>
                {day.mealPlan!.recipe.cuisine && (
                  <p className="text-xs text-white/50 truncate">
                    {day.mealPlan!.recipe.cuisine}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onRemove}
                className="p-1 rounded text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Status Badge */}
            {day.mealPlan!.status !== "planned" && (
              <Badge
                variant="secondary"
                className={cn(
                  "mt-2 text-xs",
                  day.mealPlan!.status === "shopping_added" &&
                    "bg-green-500/20 text-green-400",
                  day.mealPlan!.status === "cooked" &&
                    "bg-blue-500/20 text-blue-400",
                )}
              >
                {day.mealPlan!.status === "shopping_added" && "In Shopping"}
                {day.mealPlan!.status === "cooked" && "Cooked"}
              </Badge>
            )}

            {/* Tags preview */}
            {day.mealPlan!.recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {day.mealPlan!.recipe.tags.slice(0, 2).map((tag) => {
                  const tagInfo = RECIPE_TAGS.find((t) => t.value === tag);
                  return (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded text-[10px]"
                      style={{
                        backgroundColor: `${tagInfo?.color || "#3b82f6"}20`,
                        color: tagInfo?.color || "#3b82f6",
                      }}
                    >
                      {tagInfo?.label || tag}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-center">
            <Plus className="w-6 h-6 text-white/30 mx-auto" />
            <span className="text-xs text-white/30">Add meal</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// Recipe Selector Modal
interface RecipeSelectorModalProps {
  recipes: RecipeListItem[];
  isLoading: boolean;
  selectedDate: string | null;
  onSelect: (recipe: RecipeListItem) => void;
  onClose: () => void;
  themeClasses: ReturnType<typeof useThemeClasses>;
}

function RecipeSelectorModal({
  recipes,
  isLoading,
  selectedDate,
  onSelect,
  onClose,
  themeClasses,
}: RecipeSelectorModalProps) {
  const [search, setSearch] = useState("");

  const filteredRecipes = useMemo(() => {
    if (!search) return recipes;
    const query = search.toLowerCase();
    return recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.cuisine?.toLowerCase().includes(query) ||
        r.tags.some((t) => t.toLowerCase().includes(query)),
    );
  }, [recipes, search]);

  const dateDisplay = selectedDate
    ? new Date(selectedDate).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={cn(
          "w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden",
          themeClasses.surfaceBg,
          "border border-white/10",
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-white">Select Recipe</h2>
            <p className="text-sm text-white/60">{dateDisplay}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/10">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes..."
            className={cn(
              "w-full px-4 py-2 rounded-lg",
              themeClasses.inputBg,
              "border border-white/10 text-white placeholder:text-white/40",
            )}
            autoFocus
          />
        </div>

        {/* Recipe List */}
        <div className="p-4 max-h-[50vh] overflow-y-auto">
          {filteredRecipes.length === 0 ? (
            <div className="text-center py-8">
              <ChefHat className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60">No recipes found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onSelect(recipe)}
                  disabled={isLoading}
                  className={cn(
                    "w-full p-3 rounded-lg text-left transition-all",
                    "bg-white/5 hover:bg-white/10 border border-white/10",
                    "flex items-center gap-3",
                    isLoading && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {/* Recipe Image/Icon */}
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center shrink-0">
                    {recipe.image_url ? (
                      <img
                        src={recipe.image_url}
                        alt=""
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <ChefHat className="w-6 h-6 text-orange-400/60" />
                    )}
                  </div>

                  {/* Recipe Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {recipe.name}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-white/50">
                      {recipe.cuisine && <span>{recipe.cuisine}</span>}
                      {(recipe.prep_time_minutes ||
                        recipe.cook_time_minutes) && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(recipe.prep_time_minutes || 0) +
                            (recipe.cook_time_minutes || 0)}
                          m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {recipe.tags.length > 0 && (
                    <div className="flex gap-1">
                      {recipe.tags.slice(0, 2).map((tag) => {
                        const tagInfo = RECIPE_TAGS.find(
                          (t) => t.value === tag,
                        );
                        return (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full text-xs"
                            style={{
                              backgroundColor: `${tagInfo?.color || "#3b82f6"}20`,
                              color: tagInfo?.color || "#3b82f6",
                            }}
                          >
                            {tagInfo?.label || tag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
