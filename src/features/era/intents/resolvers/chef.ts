// Chef resolver — searches recipes by dish name
import { safeFetch } from "@/lib/safeFetch";
import { parseSmartText } from "@/lib/smartTextParser";
import { formatDate } from "@/lib/utils/date";
import {
  formatAssignMealError,
  formatChefError,
  formatMealAssigned,
  formatMealPlanGaps,
  formatRecipeFound,
  formatRecipeNotFound,
  formatRecipesList,
} from "../formatters/chef";

interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
}

export async function resolveRecipeSearch(dish: string): Promise<ResolveResult> {
  try {
    const res = await safeFetch(
      `/api/recipes?search=${encodeURIComponent(dish)}&limit=1`,
      { timeoutMs: 8_000 },
    );
    if (!res.ok) return { text: formatChefError() };

    const recipes: Array<{
      id: string;
      name: string;
      prep_time_minutes?: number | null;
      cook_time_minutes?: number | null;
      times_cooked?: number;
    }> = await res.json();

    if (!recipes.length) {
      return {
        text: formatRecipeNotFound(dish),
        metadata: { found: false, dish },
      };
    }

    const recipe = recipes[0];
    const totalMinutes =
      (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0) || null;

    return {
      text: formatRecipeFound({
        name: recipe.name,
        totalMinutes,
        timesCooked: recipe.times_cooked ?? 0,
      }),
      metadata: { found: true, recipeId: recipe.id, dish },
    };
  } catch {
    return { text: formatChefError() };
  }
}

// ---------------------------------------------------------------------------
// listRecipes
// ---------------------------------------------------------------------------

export async function resolveListRecipes(): Promise<ResolveResult> {
  try {
    const res = await safeFetch("/api/recipes", { timeoutMs: 8_000 });
    if (!res.ok) return { text: formatChefError() };

    const recipes: Array<{ id: string; name: string }> = await res.json();

    return {
      text: formatRecipesList(recipes.map((r) => r.name)),
      metadata: { count: recipes.length, recipeIds: recipes.map((r) => r.id) },
    };
  } catch {
    return { text: formatChefError() };
  }
}

// ---------------------------------------------------------------------------
// assignMeal
// ---------------------------------------------------------------------------

const DAY_LABEL = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });

/**
 * "Assign chicken to thursday dinner" -> resolves the dish against the
 * recipe library, the day against `parseSmartText` (reused rather than
 * writing a second day-of-week parser), and upserts via `POST
 * /api/meal-plans` -- that route already updates-in-place if the slot is
 * taken, and already returns a clear 400 if there's no household, so this
 * resolver doesn't duplicate either check.
 */
export async function resolveAssignMeal(
  dish: string | undefined,
  dayHint: string | undefined,
  mealType: "breakfast" | "lunch" | "dinner" | "snack" | undefined,
): Promise<ResolveResult> {
  if (!dish || !dayHint) {
    return { text: formatAssignMealError("missing-fields") };
  }

  const parsedDay = parseSmartText(dayHint);
  if (parsedDay.confidence.date === 0 || !parsedDay.dueDate) {
    return { text: formatAssignMealError("bad-day", dayHint) };
  }
  const plannedDate = parsedDay.dueDate; // YYYY-MM-DD

  try {
    const searchRes = await safeFetch(
      `/api/recipes?search=${encodeURIComponent(dish)}&limit=1`,
      { timeoutMs: 8_000 },
    );
    if (!searchRes.ok) return { text: formatChefError() };
    const recipes: Array<{ id: string; name: string }> = await searchRes.json();
    if (!recipes.length) return { text: formatAssignMealError("no-recipe", dish) };
    const recipe = recipes[0];

    const res = await safeFetch("/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipe_id: recipe.id,
        planned_date: plannedDate,
        meal_type: mealType || "lunch",
      }),
      timeoutMs: 8_000,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: undefined as string | undefined }));
      if (res.status === 400 && err.error?.toLowerCase().includes("household")) {
        return { text: formatAssignMealError("no-household") };
      }
      return { text: formatAssignMealError("request-failed", err.error) };
    }

    const mealPlan = await res.json();
    // Anchor at noon before formatting -- planned_date is a bare YYYY-MM-DD
    // and `new Date("2026-08-27")` parses as UTC midnight, which renders as
    // the PREVIOUS day in any negative-UTC-offset timezone (the module's
    // documented drift gotcha).
    const dateLabel = DAY_LABEL.format(new Date(`${plannedDate}T12:00:00`));

    return {
      text: formatMealAssigned({
        dishName: recipe.name,
        dateLabel,
        mealType: mealType || "lunch",
      }),
      metadata: {
        mealPlanId: mealPlan.id,
        recipeId: recipe.id,
        plannedDate,
        mealType: mealType || "lunch",
      },
    };
  } catch {
    return { text: formatChefError() };
  }
}

// ---------------------------------------------------------------------------
// mealPlanGaps
// ---------------------------------------------------------------------------

const WEEKDAY_LABEL = new Intl.DateTimeFormat("en-US", { weekday: "long" });

/**
 * "What's unassigned this week" -> the next 7 days (today included) with no
 * meal_plans row at all. Pure client compute over one already-scoped fetch --
 * no new aggregation engine, matching the module's existing week-view pattern.
 */
export async function resolveMealPlanGaps(): Promise<ResolveResult> {
  try {
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const res = await safeFetch(
      `/api/meal-plans?start=${formatDate(today)}&end=${formatDate(weekEnd)}`,
      { timeoutMs: 8_000 },
    );
    if (!res.ok) return { text: formatChefError() };

    const mealPlans: Array<{ planned_date: string }> = await res.json();
    const plannedDates = new Set(mealPlans.map((mp) => mp.planned_date));

    const emptyDayLabels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const key = formatDate(d);
      if (!plannedDates.has(key)) emptyDayLabels.push(WEEKDAY_LABEL.format(d));
    }

    return {
      text: formatMealPlanGaps(emptyDayLabels),
      metadata: { emptyDays: emptyDayLabels },
    };
  } catch {
    return { text: formatChefError() };
  }
}
