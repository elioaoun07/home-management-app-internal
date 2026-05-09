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

    // Generic chef face switch
    if (/\b(recipe|cook|meal|dinner|lunch|breakfast|ingredient|kitchen|chef)\b/i.test(text)) {
      return { kind: "switchFace", face: "chef", rawText: text };
    }

    return null;
  },
};
