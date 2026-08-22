// Chef face reply formatter
//
// Pools + slots, per `src/lib/era/phrasing.ts`.

import { errorReply, pick, plural, say } from "@/lib/era/phrasing";

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
