// Chef face reply formatter
//
// Pools + slots, per `src/lib/era/phrasing.ts`.

import { ACK_DONE, errorReply, listOut, pick, plural, say } from "@/lib/era/phrasing";

export interface RecipeFoundData {
  name: string;
  totalMinutes: number | null;
  timesCooked: number;
}

/** Slots: {name} */
const RECIPE_FOUND = [
  "Found it — {name}.",
  "{name}, coming up.",
  "Got {name} in your library.",
  "Yep — {name} is in there.",
  "{name} it is.",
  "Here's {name}.",
] as const;

/** Slots: {minutes} */
const RECIPE_TIME = [
  "About {minutes} minutes start to finish.",
  "Roughly {minutes} minutes all in.",
  "Give it {minutes} minutes.",
  "{minutes} minutes, near enough.",
  "Should run you about {minutes} minutes.",
] as const;

/** Slots: {count} */
const RECIPE_HISTORY = [
  "You've made it {count} before.",
  "That's {count} on the board for this one.",
  "You've cooked this {count}.",
  "This one's been on the table {count}.",
] as const;

const RECIPE_HISTORY_ONCE = [
  "You've made it once before.",
  "You've cooked this one once.",
  "One outing for this so far.",
  "It's been on the table once.",
] as const;

const RECIPE_CLOSER = [
  "Ready when you are.",
  "Say the word.",
  "Want me to pull it up?",
  "Shall I open it?",
  "Ready to go.",
] as const;

export function formatRecipeFound(data: RecipeFoundData): string {
  const { name, totalMinutes, timesCooked } = data;
  const parts: string[] = [say(RECIPE_FOUND, { name })];

  if (totalMinutes) parts.push(say(RECIPE_TIME, { minutes: totalMinutes }));

  if (timesCooked === 1) {
    parts.push(pick(RECIPE_HISTORY_ONCE));
  } else if (timesCooked > 1) {
    parts.push(say(RECIPE_HISTORY, { count: plural(timesCooked, "time") }));
  }

  parts.push(pick(RECIPE_CLOSER));
  return parts.join(" ");
}

/** Slots: {dish} */
const RECIPE_NOT_FOUND = [
  'I don\'t have "{dish}" in your recipe library. Want me to look it up and add it? That feature goes live soon.',
  'Nothing for "{dish}" in there yet. I\'ll be able to fetch and add it before long.',
  '"{dish}" isn\'t in your collection. Say the word and I\'ll add it once that\'s wired up.',
  'No "{dish}" on file. Want it added? That\'s coming shortly.',
] as const;

export function formatRecipeNotFound(dish: string): string {
  return say(RECIPE_NOT_FOUND, { dish });
}

export function formatChefError(): string {
  return errorReply("I had trouble searching your recipes.");
}

// ---------------------------------------------------------------------------
// listRecipes
// ---------------------------------------------------------------------------

/** Slots: {count}, {list} */
const RECIPES_LIST = [
  "You've got {count}: {list}.",
  "{count} in your library: {list}.",
  "Your recipes: {list} — {count} in total.",
] as const;

const RECIPES_EMPTY = [
  "No recipes saved yet — add one and I'll be able to plan with it.",
  "Your recipe library is empty right now.",
] as const;

export function formatRecipesList(names: string[]): string {
  if (names.length === 0) return pick(RECIPES_EMPTY);
  const shown = names.slice(0, 8);
  const list = listOut(shown.length < names.length ? [...shown, `${names.length - shown.length} more`] : shown);
  return say(RECIPES_LIST, { count: plural(names.length, "recipe"), list });
}

// ---------------------------------------------------------------------------
// assignMeal
// ---------------------------------------------------------------------------

/** Slots: {ack}, {dish}, {when}, {mealType} */
const MEAL_ASSIGNED = [
  "{ack} {dish} is on for {when} ({mealType}).",
  "{ack} set — {dish}, {when}, {mealType}.",
  "Planned: {dish} for {when} {mealType}.",
  "{ack} {when}'s {mealType} is {dish}.",
] as const;

export function formatMealAssigned(data: { dishName: string; dateLabel: string; mealType: string }): string {
  return say(MEAL_ASSIGNED, {
    ack: pick(ACK_DONE),
    dish: data.dishName,
    when: data.dateLabel,
    mealType: data.mealType,
  });
}

const ASSIGN_MEAL_MISSING = [
  'I need a dish and a day — try "assign chicken to thursday dinner".',
  'Missing the day or the dish. Something like "put pasta on tomorrow for lunch" works.',
] as const;

/** Slots: {dish} */
const ASSIGN_MEAL_NO_RECIPE = [
  'I couldn\'t find "{dish}" in your recipes.',
  'Nothing matching "{dish}" in your library.',
] as const;

/** Slots: {day} */
const ASSIGN_MEAL_BAD_DAY = [
  "I didn't catch a day in \"{day}\".",
  "\"{day}\" isn't a day I recognize — try a weekday or \"tomorrow\".",
] as const;

const ASSIGN_MEAL_NO_HOUSEHOLD = [
  "Meal plans need a household set up first — head to Preferences to link one.",
] as const;

export function formatAssignMealError(
  reason: "missing-fields" | "no-recipe" | "bad-day" | "no-household" | "request-failed",
  detail?: string,
): string {
  switch (reason) {
    case "missing-fields":
      return pick(ASSIGN_MEAL_MISSING);
    case "no-recipe":
      return say(ASSIGN_MEAL_NO_RECIPE, { dish: detail ?? "" });
    case "bad-day":
      return say(ASSIGN_MEAL_BAD_DAY, { day: detail ?? "" });
    case "no-household":
      return pick(ASSIGN_MEAL_NO_HOUSEHOLD);
    default:
      return errorReply("I couldn't plan that meal.");
  }
}

// ---------------------------------------------------------------------------
// mealPlanGaps
// ---------------------------------------------------------------------------

/** Slots: {list} */
const MEAL_GAPS_SOME = [
  "Still open this week: {list}.",
  "No meal planned for: {list}.",
  "Gaps this week — {list}.",
] as const;

const MEAL_GAPS_NONE = [
  "This week's fully planned — nothing open.",
  "No gaps this week. Every day's covered.",
] as const;

export function formatMealPlanGaps(emptyDayLabels: string[]): string {
  if (emptyDayLabels.length === 0) return pick(MEAL_GAPS_NONE);
  return say(MEAL_GAPS_SOME, { list: listOut(emptyDayLabels) });
}
