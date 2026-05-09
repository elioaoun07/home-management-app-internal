// Central dispatcher — routes an intent to the appropriate resolver.
// Returns { text, metadata } to be persisted as the assistant message.
import { formatReply } from "../replyFormatter";
import type { Intent } from "../types";
import { resolveMonthSpend } from "./resolvers/budget";
import { resolveMemoryRecall, resolveMemorySave } from "./resolvers/brain";
import { resolveRecipeSearch } from "./resolvers/chef";
import { resolveTodaySchedule } from "./resolvers/schedule";

export interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
}

export async function resolveIntent(intent: Intent): Promise<ResolveResult> {
  switch (intent.kind) {
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
