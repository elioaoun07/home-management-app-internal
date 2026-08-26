// Per-face intent router — Chef face
import type { Intent } from "../types";
import type { FaceIntentRouter } from "./schedule";

export const chefRouter: FaceIntentRouter = {
  parse(text) {
    const lo = text.toLowerCase();

    // "I want to cook X", "cook X", "recipe for X", "how do I make X", "make X",
    // "get me the recipe for X", "show me the recipe for X", "find X recipe", etc.
    const cookPatterns = [
      /^(?:i (?:want|d like|would like) to (?:cook|make|prepare))\s+(?:some\s+)?(.+?)(?:\s+(?:tonight|today|for (?:dinner|lunch|breakfast|me|us)))?[.?!]?$/i,
      /^(?:cook|make|prepare)\s+(?:some\s+)?(.+?)(?:\s+(?:tonight|today|for (?:dinner|lunch|breakfast|me|us)))?[.?!]?$/i,
      /^(?:recipe for|how (?:do i|to) (?:make|cook|prepare))\s+(.+?)[.?!]?$/i,
      /^(?:can i make|can we make|can we cook)\s+(.+?)[.?!]?$/i,
      /^(?:i(?:'m| am) (?:cooking|making|preparing))\s+(.+?)[.?!]?$/i,
      // "get me the recipe for X", "show me the recipe for X", "find the recipe for X"
      /^(?:get|show|find|pull up|look up|give)\s+me\s+(?:the\s+)?recipe\s+(?:for|of|to make|to cook)\s+(.+?)[.?!]?$/i,
      /^(?:get|show|find|give)\s+(?:the\s+)?recipe\s+(?:for|of|to make|to cook)\s+(.+?)[.?!]?$/i,
      // "what's the recipe for X", "what is the recipe for X"
      /^what(?:'s| is)\s+(?:the\s+)?recipe\s+(?:for|of|to make)\s+(.+?)[.?!]?$/i,
      // "do I have a recipe for X", "do you have the recipe for X"
      /^(?:do i|do you|do we)\s+have\s+(?:a\s+|the\s+)?recipe\s+(?:for|of|to make)\s+(.+?)[.?!]?$/i,
      // "search for X recipe", "find X recipe"
      /^(?:search|look up|find)\s+(.+?)\s+recipe[.?!]?$/i,
    ];

    for (const re of cookPatterns) {
      const m = text.match(re);
      if (m) {
        const dish = m[1].trim().replace(/[.?!]+$/, "");
        if (dish.length >= 2 && dish.length <= 80) {
          return { kind: "recipeSearch", face: "chef", dish, rawText: text };
        }
      }
    }

    // Assign a meal — "assign chicken to thursday dinner", "put pasta on
    // tomorrow for lunch". Checked before the plain "what recipes" listing
    // pattern since both can mention "recipes"/dish names loosely.
    const assignMatch = text.match(
      /\b(?:assign|put|schedule|plan)\s+(.+?)\s+(?:to|on|for)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)(?:\s+(?:for\s+)?(breakfast|lunch|dinner|snack))?\b/i,
    );
    if (assignMatch) {
      return {
        kind: "assignMeal",
        face: "chef",
        dish: assignMatch[1].trim().replace(/^(?:the|a|an)\s+/i, ""),
        dayHint: assignMatch[2],
        mealType: assignMatch[3]?.toLowerCase() as
          | "breakfast"
          | "lunch"
          | "dinner"
          | "snack"
          | undefined,
        rawText: text,
      };
    }

    // What's unassigned this week — "what's unassigned this week", "any
    // gaps in the meal plan", "what meals are missing".
    if (
      /\b(unassigned|missing|empty|gap|gaps)\b/i.test(lo) &&
      /\b(meal|meals|week|plan|planning|day|days)\b/i.test(lo)
    ) {
      return { kind: "mealPlanGaps", face: "chef", rawText: text };
    }

    // List recipes — "what recipes do I have", "show my recipes". Plural
    // "recipes" keeps this from colliding with the singular "recipe for X"
    // cookPatterns above.
    if (/\b(what|show|list|see)\b.{0,15}\brecipes\b/i.test(text)) {
      return { kind: "listRecipes", face: "chef", rawText: text };
    }

    // Generic chef face switch
    if (/\b(recipe|cook|meal|dinner|lunch|breakfast|ingredient|kitchen|chef)\b/i.test(text)) {
      return { kind: "switchFace", face: "chef", rawText: text };
    }

    return null;
  },
};
