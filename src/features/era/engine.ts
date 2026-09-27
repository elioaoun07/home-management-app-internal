// src/features/era/engine.ts
// HUB-78 — the Understanding engine's shared contracts (plan §4):
//   component 7 (effect assessment) — `tierFor`
//   component 8 (outcome)           — `deriveOutcome`
//   component 9 (handoff)           — `EraHandoff` + `handoffUrl`
// Components 1–6 live where they already were: turn state in useEraTurn +
// EraPendingTurn, the speech-act gate and fast path in intents/, the model on
// misses in useEraAskAI (HUB-77 decision), and source-owned adapters in the
// resolvers + nativeActions.ts.

import type { EraActiveProposal, EraOutcome, EraPendingTurn, Intent } from "./types";

export type EraTier = "answer" | "act" | "confirm" | "handoff";

/** Plan §5 minimum tier per capability (escalators raise it at call sites). */
const MIN_TIER: Record<string, EraTier> = {
  "transaction.draft": "act",
  "transfer.create": "confirm",
  "debt.record": "confirm",
  "draft.confirm": "confirm",
  "reminder.create": "act",
  "reminder.reschedule": "act",
  "reminder.complete": "act",
  "reminder.delete": "confirm",
  "reminder.series": "confirm",
  "reminder.occurrence": "confirm",
  "reminder.skip": "confirm",
  "shopping.add": "act",
  "meal.assign": "act",
  "memory.save": "act",
  "recurring.cover": "confirm",
  "result.amend": "act",
  "income.record": "handoff",
  "split.create": "handoff",
};

export function tierFor(capability: string | null, escalate = false): EraTier {
  if (!capability) return "answer";
  const t = MIN_TIER[capability] ?? "answer";
  return escalate && t === "act" ? "confirm" : t;
}

const INTENT_CAPABILITY: Partial<Record<Intent["kind"], string>> = {
  draftTransaction: "transaction.draft",
  transfer: "transfer.create",
  recordDebt: "debt.record",
  confirmDraft: "draft.confirm",
  listDrafts: "draft.list",
  monthSpend: "spend.month",
  showAnalytics: "analytics.show",
  draftReminder: "reminder.create",
  reminderReschedule: "reminder.reschedule",
  reminderComplete: "reminder.complete",
  reminderDelete: "reminder.delete",
  todaySchedule: "schedule.forDay",
  recipeSearch: "recipe.search",
  listRecipes: "recipe.list",
  assignMeal: "meal.assign",
  mealPlanGaps: "meal.gaps",
  memorySave: "memory.save",
  memoryRecall: "memory.recall",
  addShopping: "shopping.add",
  captureIncome: "income.record",
  splitExpense: "split.create",
  balanceRead: "balance.read",
  coverRecurring: "recurring.cover",
  timeNow: "time.now",
  navigate: "navigate",
  forgetRule: "lexicon.forget",
  defineAlias: "lexicon.alias",
  amendLast: "result.amend",
  activityRead: "activity.read",
  futurePurchasesRead: "purchases.read",
  reminderSkip: "reminder.skip",
};

export function capabilityOf(intent: Intent): string | null {
  if (intent.kind === "capabilityAction") return intent.capabilityId;
  if (intent.kind === "slotAnswer") return intent.capability;
  return INTENT_CAPABILITY[intent.kind] ?? null;
}

/** Derive the single outcome of a turn from what its resolver returned. */
export function deriveOutcome(
  intent: Intent,
  r: {
    ok?: boolean;
    metadata?: Record<string, unknown>;
    pending?: EraPendingTurn | null;
    proposal?: EraActiveProposal;
    handoff?: EraHandoff;
    navigate?: string;
    undo?: () => Promise<boolean>;
  },
): EraOutcome {
  const capability = capabilityOf(intent);
  const m = r.metadata ?? {};
  const ids = ["draftId", "itemId", "transferId", "debtId", "transactionId", "messageId", "memoryId", "mealPlanId"]
    .map((k) => m[k])
    .filter((v): v is string => typeof v === "string");
  if (r.proposal?.kind === "native_action") return { status: "awaiting_confirm", capability, entityIds: ids, inverse: null };
  if (r.pending) return { status: "needs_input", capability, entityIds: ids, inverse: null };
  if (r.handoff || r.navigate) return { status: "handed_off", capability, entityIds: ids, inverse: null };
  if (m.uncertain === true) return { status: "uncertain", capability, entityIds: ids, inverse: null };
  if (r.ok === false) return { status: "failed", capability, entityIds: ids, inverse: null };
  if (typeof m.draftId === "string") return { status: "drafted", capability, entityIds: ids, inverse: "draft.delete" };
  if (tierFor(capability) === "answer") return { status: "answered", capability, entityIds: ids, inverse: null };
  if (r.undo) return { status: "done", capability, entityIds: ids, inverse: "result.undo" };
  const inverse =
    typeof m.previousDueAt === "string"
      ? "reminder.patchDue"
      : intent.kind === "draftReminder" && typeof m.itemId === "string"
        ? "reminder.delete"
        : typeof m.messageIds !== "undefined"
          ? "shopping.remove"
          : null;
  return { status: "done", capability, entityIds: ids, inverse };
}

/**
 * Component 9 — a proposal the precision form finishes. Persisted in the
 * assistant `era_messages` row (owner-only RLS: `auth.uid() = user_id`), so
 * `?era=<messageId>` carries no sensitive text in the URL and survives a
 * reload. `expiresAt` bounds it; consumption is an appended system row.
 */
export interface EraHandoff {
  kind: "spend" | "income" | "split";
  /** split only — the whole bill; the form's Split toggle is turned on. */
  totalBill?: number;
  amount?: number;
  currency?: string;
  accountId?: string;
  categoryId?: string;
  subcategoryId?: string;
  description?: string;
  date?: string;
  /** A draft already created for this capture; the form deletes it on save. */
  draftId?: string;
  expiresAt: string;
}

export const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

export function handoffUrl(messageId: string): string {
  return `/expense?era=${encodeURIComponent(messageId)}`;
}
