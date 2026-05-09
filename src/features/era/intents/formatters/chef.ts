// Chef face reply formatter

export interface RecipeFoundData {
  name: string;
  totalMinutes: number | null;
  timesCooked: number;
}

export function formatRecipeFound(data: RecipeFoundData): string {
  const { name, totalMinutes, timesCooked } = data;
  const parts: string[] = [];

  parts.push(`Found it — ${name}.`);

  if (totalMinutes) {
    parts.push(`About ${totalMinutes} minutes total.`);
  }

  if (timesCooked > 0) {
    parts.push(
      timesCooked === 1
        ? "You've made it once before."
        : `You've made it ${timesCooked} times before.`
    );
  }

  parts.push("Ready when you are.");
  return parts.join(" ");
}

export function formatRecipeNotFound(dish: string): string {
  return `I don't have "${dish}" in your recipe library. Want me to look it up and add it? Just say yes — that feature will be live soon.`;
}

export function formatChefError(): string {
  return "I had trouble searching your recipes right now. Try again in a moment.";
}
