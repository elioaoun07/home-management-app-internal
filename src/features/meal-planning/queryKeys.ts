export const mealPlanKeys = {
  all: ["meal-plans"] as const,
  byWeek: (startDate: string) =>
    [...mealPlanKeys.all, "week", startDate] as const,
  byDate: (date: string) => [...mealPlanKeys.all, "date", date] as const,
  byDateRange: (start: string, end: string) =>
    [...mealPlanKeys.all, "range", start, end] as const,
};
