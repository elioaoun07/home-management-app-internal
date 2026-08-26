// Central dispatcher — routes an intent to the appropriate resolver.
// Returns { text, metadata } to be persisted as the assistant message.
import { greeting } from "@/lib/era/phrasing";
import { formatReply } from "../replyFormatter";
import type { EraPendingTurn, Intent } from "../types";
import type { EraBudgetSubmitResult } from "../useEraBudgetSubmit";
import { resolveMemoryRecall, resolveMemorySave } from "./resolvers/brain";
import {
  resolveConfirmDraft,
  resolveDraftTransaction,
  resolveListDrafts,
  resolveMonthSpend,
  resolveRecordDebt,
  resolveShowAnalytics,
  resolveTransfer,
} from "./resolvers/budget";
import {
  resolveAssignMeal,
  resolveListRecipes,
  resolveMealPlanGaps,
  resolveRecipeSearch,
} from "./resolvers/chef";
import {
  resolveDraftReminder,
  resolveTodaySchedule,
} from "./resolvers/schedule";

export interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
  /**
   * Set when ERA is waiting on an answer (Slice 3) — see EraPendingTurn.
   * Only `resolveDraftReminder`'s ask-path sets this; every other intent
   * leaves it absent, which `useEraTurn` treats the same as `null` (nothing
   * pending) — `resolveIntent` is never even called while a question is
   * already outstanding, since `useEraTurn` intercepts that turn first.
   */
  pending?: EraPendingTurn | null;
}

/**
 * Capabilities the dispatcher can only get from a React tree.
 *
 * Everything ERA resolves is a plain async function so it can be unit-tested
 * and reused outside the hub — but drafting a transaction needs the user's
 * accounts, categories, the React Query client, and the Undo toast, all of
 * which live in `useEraBudgetSubmit`. Rather than special-case that intent in
 * the caller (which is what CommandBar used to do), the caller passes the
 * hook's `submit` in here and the dispatcher stays the single owner of
 * "intent → reply". Omit it and `draftTransaction` degrades to a clear
 * "no account available" reply instead of silently doing nothing.
 */
export interface ResolveDeps {
  submitBudgetDraft?: (sentence: string) => Promise<EraBudgetSubmitResult>;
}

export async function resolveIntent(
  intent: Intent,
  deps: ResolveDeps = {},
): Promise<ResolveResult> {
  switch (intent.kind) {
    // Time-aware and varied — see src/lib/era/phrasing.ts. A greeting is the
    // line a user hears most often, so a fixed string here is what makes the
    // whole assistant sound canned.
    case "greeting":
      return { text: greeting() };

    case "todaySchedule":
      return resolveTodaySchedule();

    case "monthSpend":
      return resolveMonthSpend(intent.scope, intent.categoryHint);

    case "showAnalytics":
      return resolveShowAnalytics();

    case "draftTransaction":
      return resolveDraftTransaction(intent.rawText, deps.submitBudgetDraft);

    case "transfer":
      return resolveTransfer(intent.amount, intent.fromHint, intent.toHint);

    case "recordDebt":
      return resolveRecordDebt(intent.debtorName, intent.amount, intent.notes);

    case "listDrafts":
      return resolveListDrafts();

    case "confirmDraft":
      return resolveConfirmDraft(intent.hint);

    case "draftReminder":
      return resolveDraftReminder(intent.rawText, intent.title);

    case "recipeSearch":
      return resolveRecipeSearch(intent.dish);

    case "listRecipes":
      return resolveListRecipes();

    case "assignMeal":
      return resolveAssignMeal(intent.dish, intent.dayHint, intent.mealType);

    case "mealPlanGaps":
      return resolveMealPlanGaps();

    case "recipeOfferGenerate":
      return {
        text: `I don't have "${intent.dish}" in your library. Want me to look it up and add it? That feature will be live soon — stay tuned.`,
        metadata: { dish: intent.dish },
      };

    case "memorySave":
      return resolveMemorySave(intent.label, intent.value);

    case "memoryRecall":
      return resolveMemoryRecall(intent.query);

    // Graceful fallback (HUB-1): surface the clarifying prompt, fire no action.
    case "clarify":
      return { text: formatReply(intent) };

    // Legacy kinds handled by replyFormatter
    default:
      return { text: formatReply(intent) };
  }
}
