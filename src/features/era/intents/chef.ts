// Per-face intent router — Chef face
import type { FaceIntentRouter } from "./schedule";

/**
 * A captured "dish"/target must plausibly be food. The old cook-verb
 * patterns (`^(?:cook|make|prepare) (.+)$`) had no such check at all, so
 * "make it 11" became a recipe search for "it 11" and "make a reservation
 * for tonight" became one for "a reservation for tonight". Reject and fall
 * through — never return — so the utterance can still resolve elsewhere
 * (Schedule's own "make it <time>" reschedule ellipsis, in the first case).
 * Applied to both recipeSearch's dish and assignMeal's dish.
 */
function isPlausibleDish(dish: string): boolean {
  if (dish.length < 2 || dish.length > 60) return false;
  if (/^(?:it|that|this|them|one|those|these)\b/i.test(dish)) return false;
  if (/^\d/.test(dish)) return false;
  if (
    /\b(?:reminder|reminders|appointment|appointments|meeting|meetings|task|tasks|todo|to-do|alarm|alarms|transfer|payment|payments|account|accounts|balance|draft|drafts|expense|expenses|transaction|transactions|note|budget|reservation|reservations|table|tables)\b/i.test(
      dish,
    )
  ) {
    return false;
  }
  return true;
}

/**
 * "I want to cook X", "cook X", "recipe for X", "how do I make X", "make X",
 * "get me the recipe for X", "search for X recipe", etc. — consolidated
 * into semantic families rather than one-off anchored sentences (the old
 * array had 10 entries and still missed "show me a recipe for pasta").
 * RECIPE_FOR_RE is deliberately unanchored so it catches "recipe for X"
 * regardless of the sentence's own lead-in phrasing.
 */
const RECIPE_FOR_RE =
  /\brecipes?\s+(?:for|of|to\s+(?:make|cook|bake|prepare))\s+(.+?)[.?!]*$/i;
const HOW_TO_RE =
  /\bhow\s+(?:do\s+i|to|does\s+one)\s+(?:make|cook|bake|prepare)\s+(.+?)[.?!]*$/i;
const COOK_VERB_RE =
  /^(?:i(?:'m|\s+am)?\s*(?:want|would\s+like|'?d\s+like)?\s*to\s+)?(?:cook|make|bake|prepare)\s+(?:some\s+)?(.+?)(?:\s+(?:tonight|today|tomorrow|for\s+(?:dinner|lunch|breakfast|me|us)))?[.?!]?$/i;
const RECIPE_SEARCH_VERB_RE =
  /\b(?:search|look\s+up|find)\s+(?:for\s+)?(.+?)\s+recipe\b/i;

/**
 * Vocabulary owned by Schedule. `assignMeal`'s captured dish/day span is
 * otherwise unbounded, and dropping the verb "schedule" from the verb list
 * alone doesn't stop "add the dentist to Monday" — this blocks the
 * schedule domain lexically instead of relying on the meal-type/keyword
 * check to always catch it.
 */
const SCHEDULE_DOMAIN_RE =
  /\b(?:reminder|reminders|appointment|appointments|meeting|meetings|dentist|doctor|task|tasks|todo|to-do|alarm|deadline)\b/i;

export const chefRouter: FaceIntentRouter = {
  parse(text) {
    const lo = text.toLowerCase();

    for (const re of [RECIPE_FOR_RE, HOW_TO_RE, COOK_VERB_RE, RECIPE_SEARCH_VERB_RE]) {
      const m = text.match(re);
      if (m) {
        const dish = m[1].trim().replace(/[.?!]+$/, "");
        if (isPlausibleDish(dish)) {
          return { kind: "recipeSearch", face: "chef", dish, rawText: text };
        }
      }
    }

    // Assign a meal — "assign chicken to thursday dinner", "put pasta on
    // tomorrow for lunch". "schedule" is deliberately NOT a trigger verb
    // here (it collided with Schedule's own event/appointment vocabulary);
    // "assign" is unambiguous on its own, but put/plan/add require either
    // an explicit meal type or a meal-domain word so "plan the dentist for
    // Monday" doesn't get read as a meal assignment. Checked before the
    // plain "what recipes" listing pattern since both can mention
    // "recipes"/dish names loosely.
    const assignMatch = text.match(
      /\b(assign|put|plan|add)\s+(.+?)\s+(?:to|on|for)\s+(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|today|tomorrow|tonight|this\s+weekend)(?:\s+(?:for\s+)?(breakfast|lunch|dinner|snack))?\b/i,
    );
    if (assignMatch && !SCHEDULE_DOMAIN_RE.test(text)) {
      const verb = assignMatch[1].toLowerCase();
      const mealType = assignMatch[4]?.toLowerCase() as
        | "breakfast"
        | "lunch"
        | "dinner"
        | "snack"
        | undefined;
      const hasMealSignal =
        Boolean(mealType) || /\b(meal|meals|menu|dinner|lunch|breakfast|snack)\b/i.test(text);
      if (verb === "assign" || hasMealSignal) {
        const dish = assignMatch[2].trim().replace(/^(?:the|a|an)\s+/i, "");
        if (isPlausibleDish(dish)) {
          return {
            kind: "assignMeal",
            face: "chef",
            dish,
            dayHint: assignMatch[3],
            mealType,
            rawText: text,
          };
        }
      }
    }

    // What's unassigned this week — "what's unassigned this week", "any
    // gaps in the meal plan", "what meals are missing", "nothing planned".
    if (
      (/\b(unassigned|missing|empty|gap|gaps)\b/i.test(lo) &&
        /\b(meal|meals|week|plan|planning|day|days)\b/i.test(lo)) ||
      /\bnothing\s+(?:is\s+)?planned\b/i.test(lo) ||
      /\bno\s+meals?\s+(?:planned|assigned)?\b/i.test(lo)
    ) {
      return { kind: "mealPlanGaps", face: "chef", rawText: text };
    }

    // List recipes — "what recipes do I have", "show my recipes", "what
    // can I cook", "do I have any recipes". Plural "recipes" (first
    // pattern) keeps this from colliding with the singular "recipe for X"
    // patterns above.
    if (
      /\b(what|show|list|see)\b.{0,15}\brecipes\b/i.test(text) ||
      /\bwhat\s+can\s+i\s+(?:cook|make)\b/i.test(text) ||
      /\bdo\s+i\s+have\s+any\s+recipes\b/i.test(text)
    ) {
      return { kind: "listRecipes", face: "chef", rawText: text };
    }

    // Generic chef face switch
    if (
      /\b(recipe|recipes|cook|cooking|bake|baking|meal|meals|menu|dinner|lunch|breakfast|snack|ingredient|ingredients|kitchen|chef|dish|dishes)\b/i.test(
        text,
      )
    ) {
      return { kind: "switchFace", face: "chef", rawText: text };
    }

    return null;
  },
};
