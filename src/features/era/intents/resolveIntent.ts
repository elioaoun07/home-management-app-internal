// Central dispatcher — routes an intent to the appropriate resolver.
// Returns { text, metadata } to be persisted as the assistant message.
import { formatReply } from "../replyFormatter";
import type { Intent } from "../types";
import { resolveMemoryRecall, resolveMemorySave } from "./resolvers/brain";
import { resolveMonthSpend } from "./resolvers/budget";
import { resolveRecipeSearch } from "./resolvers/chef";
import { resolveTodaySchedule } from "./resolvers/schedule";

export interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
}

const GREETING_REPLIES = [
  "Hey! I'm ERA — your household assistant. Ask me about your budget, schedule, recipes, or anything you want to remember.",
  "Hello! What can I do for you? I can check your spending, pull up today's schedule, find a recipe, or save a note.",
  "Hey there! Budget, schedule, chef, brain — pick one, or just ask freely.",
  "Hi! I'm listening. Ask about your finances, what's on today, what to cook, or tell me something to remember.",
  "Hey! Good to hear from you. What's on your mind?",
  "Hello — ready when you are. Speak to any of my four modules.",
];

export async function resolveIntent(intent: Intent): Promise<ResolveResult> {
  switch (intent.kind) {
    case "greeting":
      return {
        text: GREETING_REPLIES[
          Math.floor(Math.random() * GREETING_REPLIES.length)
        ],
      };

    case "todaySchedule":
      return resolveTodaySchedule();

    case "monthSpend":
      return resolveMonthSpend(intent.scope, intent.categoryHint);

    case "recipeSearch":
      return resolveRecipeSearch(intent.dish);

    case "recipeOfferGenerate":
      return {
        text: `I don't have "${intent.dish}" in your library. Want me to look it up and add it? That feature will be live soon — stay tuned.`,
        metadata: { dish: intent.dish },
      };

    case "memorySave":
      return resolveMemorySave(intent.label, intent.value);

    case "memoryRecall":
      return resolveMemoryRecall(intent.query);

    // Legacy kinds handled by replyFormatter
    default:
      return { text: formatReply(intent) };
  }
}
