// Central dispatcher — routes an intent to the appropriate resolver.
// Returns { text, metadata } to be persisted as the assistant message.
import type { EraArtifact } from "@/lib/era/artifacts";
import { greeting } from "@/lib/era/phrasing";
import { getCapability } from "../capabilities/registry";
import { formatReply } from "../replyFormatter";
import { bumpTemplateMatch } from "../templates/useEraTemplates";
import type { EraHandoff } from "../engine";
import type { FocusEntity } from "../focusMemory";
import type { EraActiveProposal, EraPendingTurn, Intent } from "../types";
import type { EraBudgetSubmitResult } from "../useEraBudgetSubmit";
import { resolveMemoryRecall, resolveMemorySave } from "./resolvers/brain";
import {
  resolveConfirmDraft,
  resolveDraftTransaction,
  prepareRecordDebt,
  prepareTransfer,
  resolveListDrafts,
  resolveMonthSpend,
  resolveShowAnalytics,
} from "./resolvers/budget";
import {
  resolveAssignMeal,
  resolveListRecipes,
  resolveMealPlanGaps,
  resolveRecipeSearch,
} from "./resolvers/chef";
import {
  resolveDraftReminder,
  prepareReminderDelete,
  resolveReminderComplete,
  resolveReminderReschedule,
  resolveScheduleForDay,
} from "./resolvers/schedule";
import { resolveAddContact } from "./resolvers/contacts";
import { resolveDraftEvent } from "./resolvers/events";
import { resolveAddPlace } from "./resolvers/places";
import { resolveAddShopping } from "./resolvers/shopping";
import { resolveAmend, resolveAmendByName } from "./resolvers/amend";
import { useEraStore } from "../useEraStore";
import { forgetLexiconRule } from "../useEraLexicon";
import { resolveActivityRead, resolveFuturePurchases } from "./resolvers/estate";
import { resolveDefineAlias } from "./resolvers/budget";
import {
  prepareCoverRecurring,
  resolveBalance,
  resolveIncome,
  resolveSplit,
} from "./resolvers/budgetFamilies";
import { proceedWithReminder, resolveNamedReminder } from "./resolvers/slots";

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
  /**
   * Explicit success signal — absent (or `true`) means success; `false`
   * means the resolver returned a graceful error reply rather than throwing
   * (safeFetch failure, unparseable slot, ambiguous match, …). A resolver
   * that fails this way still returns normally with error text in `text`,
   * so a caller can't tell success from failure by catching — this field is
   * the only reliable signal. Read by `useEraAskAI.confirmProposal` (HUB-34):
   * a taught template is learned ONLY when `ok !== false`, so a phrasing
   * that didn't actually work never gets memorized as if it did.
   */
  ok?: boolean;
  /**
   * HUB-76 — set when the intent's effect tier requires Confirm (money
   * movement, deletes). Nothing has been written; `useEraTurn` shows this as
   * the confirm card and `useEraAskAI.confirmProposal` executes it on tap.
   */
  proposal?: EraActiveProposal;
  /** HUB-78 — a spend the precision form should finish (plan §4 component 9). */
  handoff?: EraHandoff;
  /** HUB-81 — a page to open (reach level "navigation"). */
  navigate?: string;
  /** HUB-84 — the result a follow-up may edit next ("it"). */
  focus?: FocusEntity;
  /** HUB-84 — inverse for the receipt's Undo (only where demonstrated). */
  undo?: () => Promise<boolean>;
  /**
   * What this write left behind — every create/update/delete returns one per
   * row (src/lib/era/artifacts.ts). The turn pipeline logs them to Artifacts
   * and the Activity Log opens the item from them.
   */
  artifacts?: EraArtifact[];
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
      return resolveScheduleForDay(intent.dateISO);

    case "monthSpend":
      return resolveMonthSpend(intent.scope, intent.categoryHint, intent.period);

    // HUB-79 — core Budget families.
    case "captureIncome":
      return resolveIncome(intent.amount, intent.currency, intent.rawText);

    case "splitExpense":
      return resolveSplit(intent.amount, intent.withName, intent.rawText);

    case "balanceRead":
      return resolveBalance(intent.accountHint);

    case "coverRecurring":
      return prepareCoverRecurring(intent.nameHint, intent.rawText);

    // HUB-80 — revoke whatever rule the last turn applied.
    case "forgetRule": {
      const id = useEraStore.getState().lastAppliedRuleId;
      if (!id) return { text: "Nothing to forget.", ok: false };
      await forgetLexiconRule(id);
      useEraStore.getState().setLastAppliedRuleId(null);
      return { text: "Forgotten.", metadata: { revokedRuleId: id } };
    }

    case "defineAlias":
      return resolveDefineAlias(intent.phrase, intent.target);

    case "activityRead":
      return resolveActivityRead(intent.actor, intent.window);

    case "futurePurchasesRead":
      return resolveFuturePurchases();

    // HUB-81 — the Open card takes the person to the page.
    case "navigate":
      return { text: intent.label, navigate: intent.to, metadata: { module: intent.module, to: intent.to } };

    case "timeNow":
      return { text: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) };

    case "showAnalytics":
      return resolveShowAnalytics();

    case "draftTransaction":
      return resolveDraftTransaction(intent.rawText, deps.submitBudgetDraft);

    // HUB-76 — money movement always confirms: these return a proposal, no write.
    case "transfer":
      return prepareTransfer(
        intent.amount,
        intent.currency,
        intent.fromHint,
        intent.toHint,
        intent.rawText,
      );

    case "recordDebt":
      return prepareRecordDebt(
        intent.debtorName,
        intent.amount,
        intent.notes,
        intent.currency,
        intent.rawText,
      );

    case "listDrafts":
      return resolveListDrafts();

    case "confirmDraft":
      return resolveConfirmDraft(intent.hint);

    case "draftReminder":
      return resolveDraftReminder(intent.rawText, intent.title);

    // HUB-78 — a named target not in focus is looked up by name.
    case "reminderReschedule":
      if (!intent.itemId && intent.targetHint) {
        return resolveNamedReminder("reschedule", intent.targetHint, intent.whenText, intent.rawText);
      }
      return resolveReminderReschedule(intent.itemId, intent.title, intent.whenText);

    case "reminderComplete":
      if (!intent.itemId && intent.targetHint) {
        return resolveNamedReminder("complete", intent.targetHint, undefined, intent.rawText);
      }
      return resolveReminderComplete(intent.itemId, intent.title);

    // HUB-76 — deletes confirm.
    case "reminderDelete":
      if (!intent.itemId && intent.targetHint) {
        return resolveNamedReminder("delete", intent.targetHint, undefined, intent.rawText);
      }
      return prepareReminderDelete(intent.itemId, intent.title, intent.rawText);

    case "addShopping":
      return resolveAddShopping(intent.items, intent.groupHint);

    case "addContact":
      return resolveAddContact(intent.name);

    // HUB-88 / HUB-94 — places and events.
    case "addPlace":
      return resolveAddPlace(intent.name);

    case "draftEvent":
      return resolveDraftEvent(intent);

    // HUB-84 — follow-ups edit the last result through its type's contract.
    case "amendLast": {
      if (intent.targetHint) return resolveAmendByName(intent.targetHint, intent.rawText);
      const focus = intent.focusId
        ? (useEraStore.getState().focusEntities.find((e) => e.id === intent.focusId) ?? null)
        : null;
      return resolveAmend(focus, intent.rawText);
    }

    case "reminderSkip":
      if (intent.itemId) {
        return proceedWithReminder("skip", { id: intent.itemId, title: intent.title ?? "reminder", recurring: true }, undefined, intent.rawText);
      }
      if (intent.targetHint) return resolveNamedReminder("skip", intent.targetHint, undefined, intent.rawText);
      return { text: "Skip which one?", ok: false };

    // Stage 4 (HUB-30) — Layer 2 taught-phrase match. Slots were captured
    // from stored template text (and any entity reference already resolved
    // from focus memory by the matcher — see intents/index.ts), so they
    // still go through the SAME Zod validation an Ask AI proposal would
    // (Stage 3's gate, reused rather than duplicated): a stale or malformed
    // template degrades to the normal "unknown" reply instead of executing.
    case "capabilityAction": {
      const capability = getCapability(intent.capabilityId);
      if (!capability) return { text: formatReply({ kind: "unknown", rawText: intent.rawText }) };
      const parsed = capability.slots.safeParse(intent.slots);
      if (!parsed.success) return { text: formatReply({ kind: "unknown", rawText: intent.rawText }) };
      // HUB-76 — a taught phrase must not bypass the delete tier either.
      if (capability.destructive) {
        const slots = parsed.data as Record<string, unknown>;
        const title = typeof slots.title === "string" ? slots.title : null;
        return prepareReminderDelete(
          typeof slots.itemId === "string" ? slots.itemId : null,
          title,
          intent.rawText,
          capability.id,
        );
      }
      const result = await capability.execute(parsed.data);
      if (intent.sourceTemplateId) bumpTemplateMatch(intent.sourceTemplateId);
      return { text: result.text, metadata: result.metadata, artifacts: result.artifacts };
    }

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
