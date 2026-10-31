// Shared meal-plan date contract for the meal calendar and ERA Chef (KIT-4).
// Days are local calendar dates (YYYY-MM-DD). A meal appears from planned_date
// through eats_through_date inclusive; display and coverage are different
// questions — a skipped meal still shows, but feeds nobody.
import type { MealPlan, MealType } from "@/types/recipe";

type MealDates = Pick<MealPlan, "planned_date" | "eats_through_date">;
type MealFacts = MealDates & Pick<MealPlan, "status" | "for_user_id" | "meal_type">;

const EDIBLE_STATUSES: ReadonlySet<string> = new Set(["planned", "shopping_added", "cooked"]);

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastDay(plan: MealDates): string {
  return plan.eats_through_date && plan.eats_through_date > plan.planned_date
    ? plan.eats_through_date
    : plan.planned_date;
}

/** Every day the meal shows on the calendar, leftovers and skipped rows included. */
export function getMealActiveDates(plan: MealDates): string[] {
  const dates = [plan.planned_date];
  const end = lastDay(plan);
  // Noon anchor: stepping a day never lands on a DST gap or the previous date.
  const cursor = new Date(`${plan.planned_date}T12:00:00`);
  for (;;) {
    cursor.setDate(cursor.getDate() + 1);
    const day = localDay(cursor);
    if (day > end) return dates;
    dates.push(day);
  }
}

/** Whether the meal feeds `viewerId` on `day`, optionally in one meal slot. */
export function mealCoversDate(plan: MealFacts, day: string, viewerId: string, mealType?: MealType): boolean {
  if (!EDIBLE_STATUSES.has(plan.status)) return false;
  if (plan.for_user_id != null && plan.for_user_id !== viewerId) return false;
  if (mealType && plan.meal_type !== mealType) return false;
  return day >= plan.planned_date && day <= lastDay(plan);
}
