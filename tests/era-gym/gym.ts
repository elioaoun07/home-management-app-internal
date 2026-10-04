// tests/era-gym/gym.ts
// HUB-77 — the ERA Gym harness (plan §7).
//
// Scores each case's EFFECT-LEVEL FINAL STATE: what the turn sequence would
// write or put on a confirm card, bound to the fake household in
// understand.ts. It runs the real router and the real pure resolvers
// (prepareTransfer / prepareRecordDebt / prepareReminderDelete,
// parseSpeechExpense + pickDraftAccount, parseSmartText's date test) — it
// does not execute routes against a database; nativeActions.test.ts covers
// execution, Undo and the uncertain outcome.
//
// Paths:
//   A — today: router (with the HUB-76 gate) → Ask AI on a language-gap miss
//   B — gated fast path alone: router, no model
//   C — gated fast path, then the Understand prototype on every
//       non-confident result (miss, weak guess, speech act)
//
// Model responses are recorded once by record.test.ts and replayed here, so
// CI never calls the network.

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { resolveFocusRef } from "@/features/era/focusMemory";
import { rootIntentRouter } from "@/features/era/intents";
import {
  prepareRecordDebt,
  prepareTransfer,
} from "@/features/era/intents/resolvers/budget";
import { prepareReminderDelete } from "@/features/era/intents/resolvers/schedule";
import {
  resolveNamedReminder,
  resolvePendingSlot,
  type SlotResult,
} from "@/features/era/intents/resolvers/slots";
import { prepareCoverRecurring } from "@/features/era/intents/resolvers/budgetFamilies";
import {
  resolveAmend,
  resolveAmendByName,
} from "@/features/era/intents/resolvers/amend";
import { resolveAddContact } from "@/features/era/intents/resolvers/contacts";
import { resolveDraftEvent } from "@/features/era/intents/resolvers/events";
import { resolveAddPlace } from "@/features/era/intents/resolvers/places";
import { FREE_TEXT_SLOTS, isNewRequest } from "@/features/era/intents/freeTextAnswer";
import { resolveAddShopping } from "@/features/era/intents/resolvers/shopping";
import type { FocusEntity } from "@/features/era/focusMemory";
import type { EraPendingTurn } from "@/features/era/types";
import { classifyMiss } from "@/features/era/missTracking";
import type { FaceKey, Intent } from "@/features/era/types";
import { pickDraftAccount } from "@/features/era/useEraBudgetSubmit";
import { useEraStore } from "@/features/era/useEraStore";
import { buildSystemPrompt, parseAskAIResponse } from "@/lib/ai/eraAskProposal";
import { parseSpeechExpense } from "@/lib/nlp/speechExpense";
import { parseSmartText } from "@/lib/smartTextParser";
import { buildUnderstandPrompt, HOUSEHOLD } from "./understand";

// ───────────────────────────── types ─────────────────────────────

export type Outcome =
  | "answered"
  | "done"
  | "drafted"
  | "awaiting_confirm"
  | "needs_input"
  | "handed_off"
  | "honest_limit"
  | "no_action";
export type Tier = "answer" | "act" | "confirm";
export type GymEffect = { cap: string } & Record<string, unknown>;

export interface Expectation {
  outcome: Outcome;
  effect?: GymEffect;
  tier?: Tier;
  acceptable?: Array<{ outcome: Outcome; effect?: GymEffect }>;
}

export interface GymCase {
  id: string;
  slice: string;
  split: "dev" | "heldout";
  source: string;
  turns: string[];
  context: {
    face: FaceKey;
    page: string;
    turnState: unknown;
    focus: Array<{ id: string; type: "reminder"; title: string }>;
    lexicon: unknown[];
    clock: string;
    timezone: string;
    actor: "owner" | "partner";
  };
  expect: Expectation;
  note?: string;
  /** A gap owned by a later ID (e.g. corrections → HUB-78). Reported, not gated. */
  knownGap?: string;
}

export interface PathResult {
  outcome: Outcome;
  effect?: GymEffect;
  tier?: Tier;
  /** How the result was produced — "router", "model", "model-unrecorded". */
  via: "router" | "model" | "model-unrecorded";
  model?: { ms: number; inTok: number; outTok: number };
  /** HUB-78 — an open chip question the next turn may answer. */
  pending?: EraPendingTurn;
  /** HUB-84 — the result a follow-up may edit next. */
  focus?: FocusEntity;
}

export interface ModelCall {
  key: string;
  system: string;
  user: string;
  schema: "askai" | "understand";
}
export interface ModelReply {
  text: string;
  ms: number;
  inTok: number;
  outTok: number;
  model: string;
}
export type ModelFn = (call: ModelCall) => Promise<ModelReply | null>;

// ───────────────────────────── corpus ─────────────────────────────

const GYM_DIR = path.resolve(__dirname);

export function loadCorpus(): GymCase[] {
  return fs
    .readdirSync(GYM_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .flatMap((f) =>
      fs
        .readFileSync(path.join(GYM_DIR, f), "utf-8")
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as GymCase),
    );
}

// ───────────────────────────── caps ─────────────────────────────

/** Capabilities ERA can execute today (native intents + registry). */
export const EXECUTABLE = new Set([
  "transaction.draft",
  "transfer.create",
  "debt.record",
  "draft.list",
  "draft.confirm",
  "spend.month",
  "analytics.show",
  "reminder.create",
  "reminder.reschedule",
  "reminder.complete",
  "reminder.delete",
  "schedule.forDay",
  "recipe.search",
  "recipe.list",
  "meal.assign",
  "meal.gaps",
  "memory.save",
  "memory.recall",
  "shopping.add",
]);

const READS = new Set([
  "greeting",
  "time.now",
  "spend.day",
  "draft.list",
  "spend.month",
  "analytics.show",
  "schedule.forDay",
  "recipe.search",
  "recipe.list",
  "meal.gaps",
  "memory.recall",
  "navigate",
  "balance.read",
  "pantry.query",
]);

const MONEY = new Set([
  "transaction.draft",
  "transfer.create",
  "debt.record",
  "debt.settle",
  "draft.confirm",
  "recurring.cover",
  "split.create",
  "income.record",
]);

/** Money movement: plan §5 "Confirm always". */
const CONFIRM_ALWAYS = new Set([
  "transfer.create",
  "debt.record",
  "debt.settle",
  "draft.confirm",
  "recurring.cover",
  "split.create",
]);

const TIER_RANK: Record<Tier, number> = { answer: 0, act: 1, confirm: 2 };

export function isSupported(c: GymCase): boolean {
  const cap = c.expect.effect?.cap;
  return cap === undefined || EXECUTABLE.has(cap);
}

// ───────────────────────── fast path (router + pure resolvers) ─────────────────────────

let gymSeq = 0;

const DRAFT_ACCOUNTS = HOUSEHOLD.accounts
  .filter((a) => a.owner === "owner")
  .map((a) => ({
    id: a.handle,
    currency: a.currency,
    is_default: a.isDefault,
    type: "expense",
  }));

function accountName(handle: string): string | undefined {
  return HOUSEHOLD.accounts.find((a) => a.handle === handle)?.name;
}

/** HUB-94 — saved places (Catalogue → Places); `parents` is an alias tag. */
const HOUSEHOLD_PLACES = [
  { id: "pl-parents", name: "Parents' house", tags: ["parents"] },
  { id: "pl-church", name: "Church", tags: [] },
];

/** Fake `/api/accounts?own=true` for prepareTransfer. Install with vi.stubGlobal("fetch", gymFetch). */
export async function gymFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = String(input);
  const body = url.startsWith("/api/accounts")
    ? HOUSEHOLD.accounts
        .filter((a) => a.owner === "owner")
        .map((a) => ({ id: a.handle, name: a.name, currency: a.currency }))
    : url.startsWith("/api/recurring-payments")
      ? { recurring_payments: HOUSEHOLD.recurring }
      : url.startsWith("/api/transactions")
        ? HOUSEHOLD.transactions
        : url.startsWith("/api/hub/threads")
          ? {
              threads: [
                { id: "t-shop", purpose: "shopping", is_private: false },
              ],
            }
          : url.startsWith("/api/hub/messages?thread_id=")
            ? {
                messages: [
                  {
                    id: "m-salt",
                    content: "Salt",
                    created_at: "2026-09-27T10:00:00Z",
                    shopping_group_id: null,
                  },
                ],
              }
            : url.startsWith("/api/hub/shopping-groups")
              ? init?.method === "POST"
                ? {
                    group: {
                      id: `g-${++gymSeq}`,
                      name: JSON.parse(String(init.body)).name,
                    },
                  }
                : { groups: HOUSEHOLD.shoppingGroups }
              : url === "/api/catalogue/modules"
                ? init?.method === "POST"
                  ? { id: `mod-${++gymSeq}` }
                  : [
                      { id: "mod-contacts", type: "contacts" },
                      // HUB-94 — the Places module ERA creates (era_role marker).
                      { id: "mod-places", type: "custom", name: "Places", settings_json: { era_role: "places" } },
                    ]
                : url === "/api/catalogue/items?module_id=mod-places"
                  ? HOUSEHOLD_PLACES
                : url === "/api/catalogue/items" && init?.method === "POST"
                  ? { id: `c-${++gymSeq}` }
                : url === "/api/items" && init?.method === "POST"
                  ? { item: { id: `ev-${++gymSeq}` } }
                  : url === "/api/hub/messages" && init?.method === "POST"
                ? { message: { id: `m-${++gymSeq}` } }
                : url === "/api/drafts" && init?.method === "POST"
                  ? { draft: { id: `gym-draft-${++gymSeq}` } }
                  : {};
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function hasDate(text: string): boolean {
  const p = parseSmartText(text);
  return p.confidence.date > 0 && Boolean(p.dueDate);
}

/** HUB-78 — map a resolver's SlotResult (proposal, question or write) to a Gym result. */
export function fromResolution(r: SlotResult, cap: string): PathResult {
  const via = "router" as const;
  if (r.proposal?.kind === "native_action") {
    const a = r.proposal.action;
    if (a.type === "transfer") {
      return {
        outcome: "awaiting_confirm",
        tier: "confirm",
        via,
        effect: {
          cap: "transfer.create",
          amount: a.amount,
          from: a.fromName,
          to: a.toName,
        },
      };
    }
    if (a.type === "reminderSeries" || a.type === "reminderOccurrence") {
      return {
        outcome: "awaiting_confirm",
        tier: "confirm",
        via,
        effect: {
          cap: "reminder.reschedule",
          target: a.title,
          scope: a.type === "reminderSeries" ? "series" : "one",
        },
      };
    }
    if (a.type === "reminderSkip") {
      return {
        outcome: "awaiting_confirm",
        tier: "confirm",
        via,
        effect: { cap: "reminder.skip", target: a.title },
      };
    }
    if (a.type === "capability") {
      return {
        outcome: "awaiting_confirm",
        tier: "confirm",
        via,
        effect: { cap: a.capabilityId, target: a.slots.title },
      };
    }
    return {
      outcome: "awaiting_confirm",
      tier: "confirm",
      via,
      effect: { cap },
    };
  }
  if (r.pending) {
    const args = r.pending.kind === "slot" ? r.pending.args : {};
    return {
      outcome: "needs_input",
      via,
      pending: r.pending,
      effect: {
        cap,
        ...(typeof args.amount === "number" ? { amount: args.amount } : {}),
        ...(typeof args.fromName === "string" ? { from: args.fromName } : {}),
        ...(typeof args.toName === "string" ? { to: args.toName } : {}),
      },
    };
  }
  const m = r.metadata ?? {};
  if (r.ok !== false && typeof m.itemId === "string") {
    return {
      outcome: "done",
      tier: "act",
      via,
      effect: { cap, target: m.title, itemId: m.itemId },
    };
  }
  return { outcome: r.ok === false ? "honest_limit" : "answered", via };
}

/** HUB-94 — events and places: a write may come with one follow-up question. */
export function fromEvent(r: SlotResult): PathResult {
  const via = "router" as const;
  const m = r.metadata ?? {};
  const pending = r.pending ?? undefined;
  const place = typeof m.place === "string" ? { place: m.place } : {};
  if (r.ok !== false && typeof m.eventId === "string") {
    return {
      outcome: "done",
      tier: "act",
      via,
      pending,
      effect: { cap: m.locationSet ? "event.location" : "event.create", title: m.title, ...place },
    };
  }
  if (r.ok !== false && typeof m.placeId === "string") {
    return { outcome: "done", tier: "act", via, pending, effect: { cap: "place.create", name: m.place } };
  }
  if (r.navigate) return { outcome: "handed_off", via, effect: { cap: "navigate", to: r.navigate } };
  if (r.pending) {
    const args = r.pending.kind === "slot" ? r.pending.args : {};
    return {
      outcome: "needs_input",
      via,
      pending: r.pending,
      effect: { cap: "event.create", ...(typeof args.title === "string" ? { title: args.title } : {}) },
    };
  }
  return { outcome: r.ok === false ? "honest_limit" : "answered", via };
}

/** HUB-84 — map an edit-contract result to a Gym result. */
function mapAmend(
  r: Awaited<ReturnType<typeof resolveAmend>>,
  focus: FocusEntity | null,
): PathResult {
  const via = "router" as const;
  if (
    r.proposal?.kind === "native_action" &&
    r.proposal.action.type === "transfer"
  ) {
    useEraStore.setState({ activeProposal: r.proposal });
    return {
      ...fromResolution(r, "transfer.create"),
      focus: {
        id: "transfer-card",
        type: "transfer_card",
        title: r.proposal.text,
        addedAt: Date.now(),
        meta: { ...r.proposal.action },
      },
    };
  }
  if (
    r.proposal?.kind === "native_action" &&
    r.proposal.action.type === "shoppingGroupCreate"
  ) {
    return {
      outcome: "awaiting_confirm",
      tier: "confirm",
      via,
      effect: { cap: "shopping.group.create", name: r.proposal.action.name },
    };
  }
  if (r.proposal || r.pending) return fromResolution(r, "result.amend");
  if (r.ok === false) return { outcome: "needs_input", via };
  const m = r.metadata ?? {};
  if (focus?.type === "draft") {
    return {
      outcome: "drafted",
      tier: "act",
      via,
      effect: { cap: "transaction.draft", amount: m.amount },
      focus: r.focus,
    };
  }
  const group = HOUSEHOLD.shoppingGroups.find((g) => g.id === m.groupId)?.name;
  return {
    outcome: "done",
    tier: "act",
    via,
    effect: {
      cap: "shopping.edit",
      ...(group ? { group } : {}),
      edited: m.edited,
    },
    focus: r.focus,
  };
}

/** Map one routed intent to the effect it would have, using the real resolvers. */
export async function resolveRouted(
  intent: Intent,
  text: string,
): Promise<PathResult> {
  const via = "router" as const;
  switch (intent.kind) {
    case "draftTransaction": {
      const target = pickDraftAccount(DRAFT_ACCOUNTS, text);
      if (!target.ok) {
        // HUB-78 — resolveDraftTransaction hands an unresolvable spend to /expense.
        return {
          outcome: "handed_off",
          tier: "answer",
          via,
          effect: { cap: "navigate", to: "/expense" },
        };
      }
      const parsed = parseSpeechExpense(text, []);
      if (!parsed.amount) return { outcome: "needs_input", via };
      const currency = HOUSEHOLD.accounts.find(
        (a) => a.handle === target.accountId,
      )?.currency;
      const draftId = `gym-draft-${++gymSeq}`;
      return {
        outcome: "drafted",
        tier: "act",
        via,
        effect: { cap: "transaction.draft", amount: parsed.amount, currency },
        focus: {
          id: draftId,
          type: "draft",
          title: "Draft",
          addedAt: Date.now(),
          meta: {
            draftId,
            accountId: target.accountId,
            amount: parsed.amount,
            currency,
            description: text,
          },
        },
      };
    }
    case "transfer": {
      const r = await prepareTransfer(
        intent.amount,
        intent.currency,
        intent.fromHint,
        intent.toHint,
        text,
      );
      if (
        r.proposal?.kind === "native_action" &&
        r.proposal.action.type === "transfer"
      ) {
        useEraStore.setState({ activeProposal: r.proposal });
      }
      const mapped = fromResolution(r, "transfer.create");
      if (
        r.proposal?.kind === "native_action" &&
        r.proposal.action.type === "transfer"
      ) {
        mapped.focus = {
          id: "transfer-card",
          type: "transfer_card",
          title: r.proposal.text,
          addedAt: Date.now(),
          meta: { ...r.proposal.action },
        };
      }
      return mapped.outcome === "honest_limit" || mapped.outcome === "answered"
        ? {
            outcome: "needs_input",
            via,
            effect: { cap: "transfer.create", amount: intent.amount },
          }
        : mapped;
    }
    case "reminderSkip":
      if (!intent.itemId && intent.targetHint) {
        return fromResolution(
          await resolveNamedReminder(
            "skip",
            intent.targetHint,
            undefined,
            text,
          ),
          "reminder.skip",
        );
      }
      return intent.itemId
        ? {
            outcome: "awaiting_confirm",
            tier: "confirm",
            via,
            effect: { cap: "reminder.skip", target: intent.title },
          }
        : { outcome: "needs_input", via };
    case "addShopping": {
      const r = await resolveAddShopping(intent.items, intent.groupHint);
      if (r.proposal)
        return { ...fromResolution(r, "shopping.add"), focus: r.focus };
      if (r.pending)
        return { ...fromResolution(r, "shopping.group"), focus: r.focus };
      const groupId = r.metadata?.groupId as string | null | undefined;
      const group = HOUSEHOLD.shoppingGroups.find(
        (g) => g.id === groupId,
      )?.name;
      return {
        outcome: r.ok === false ? "honest_limit" : "done",
        tier: "act",
        via,
        effect: {
          cap: "shopping.add",
          items: intent.items.join(", "),
          ...(group ? { group } : {}),
        },
        focus: r.focus,
      };
    }
    case "addPlace":
      return fromEvent(await resolveAddPlace(intent.name));
    case "draftEvent":
      return fromEvent(await resolveDraftEvent(intent));
    case "addContact": {
      const r = await resolveAddContact(intent.name);
      return {
        outcome: r.ok === false ? "honest_limit" : "done",
        tier: "act",
        via,
        effect: { cap: "contact.create", name: intent.name },
      };
    }
    case "amendLast": {
      const focus = intent.focusId
        ? (useEraStore
            .getState()
            .focusEntities.find((e) => e.id === intent.focusId) ?? null)
        : null;
      const r = intent.targetHint
        ? await resolveAmendByName(intent.targetHint, text)
        : await resolveAmend(focus, text);
      return mapAmend(r, focus);
    }
    case "recordDebt": {
      const r = prepareRecordDebt(
        intent.debtorName,
        intent.amount,
        intent.notes,
        intent.currency,
        text,
      );
      return r.proposal
        ? {
            outcome: "awaiting_confirm",
            tier: "confirm",
            via,
            effect: {
              cap: "debt.record",
              debtor: intent.debtorName,
              amount: intent.amount,
            },
          }
        : { outcome: "honest_limit", via };
    }
    case "reminderDelete": {
      if (!intent.itemId && intent.targetHint) {
        return fromResolution(
          await resolveNamedReminder(
            "delete",
            intent.targetHint,
            undefined,
            text,
          ),
          "reminder.delete",
        );
      }
      const r = prepareReminderDelete(intent.itemId, intent.title, text);
      return r.proposal
        ? {
            outcome: "awaiting_confirm",
            tier: "confirm",
            via,
            effect: { cap: "reminder.delete", target: intent.title },
          }
        : { outcome: "needs_input", via };
    }
    case "reminderReschedule":
    case "reminderComplete": {
      const cap =
        intent.kind === "reminderReschedule"
          ? "reminder.reschedule"
          : "reminder.complete";
      if (!intent.itemId && intent.targetHint) {
        const action =
          intent.kind === "reminderReschedule" ? "reschedule" : "complete";
        const when =
          intent.kind === "reminderReschedule" ? intent.whenText : undefined;
        return fromResolution(
          await resolveNamedReminder(action, intent.targetHint, when, text),
          cap,
        );
      }
      return intent.itemId
        ? {
            outcome: "done",
            tier: "act",
            via,
            effect: { cap, target: intent.title },
          }
        : { outcome: "needs_input", via };
    }
    case "draftReminder": {
      const title = intent.title ?? parseSmartText(text).title;
      return hasDate(text)
        ? {
            outcome: "done",
            tier: "act",
            via,
            effect: { cap: "reminder.create", title },
          }
        : {
            outcome: "needs_input",
            via,
            effect: { cap: "reminder.create", title },
          };
    }
    case "confirmDraft":
      return {
        outcome: "done",
        tier: "confirm",
        via,
        effect: { cap: "draft.confirm" },
      };
    case "listDrafts":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "draft.list" },
      };
    case "monthSpend":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: {
          cap: intent.period ? "spend.day" : "spend.month",
          scope: intent.scope,
        },
      };
    case "balanceRead":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "balance.read" },
      };
    case "activityRead":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "activity.read" },
      };
    case "futurePurchasesRead":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "purchases.read" },
      };
    case "navigate":
      return {
        outcome: "handed_off",
        tier: "answer",
        via,
        effect: { cap: "navigate", to: intent.to },
      };
    case "timeNow":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "time.now" },
      };
    case "captureIncome":
    case "splitExpense":
      return {
        outcome: "handed_off",
        tier: "answer",
        via,
        effect: { cap: "navigate", to: "/expense" },
      };
    case "coverRecurring": {
      const r = await prepareCoverRecurring(intent.nameHint, text);
      if (r.handoff)
        return {
          outcome: "handed_off",
          tier: "answer",
          via,
          effect: { cap: "navigate", to: "/expense" },
        };
      return fromResolution(r, "recurring.cover");
    }
    case "showAnalytics":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "analytics.show" },
      };
    case "todaySchedule":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "schedule.forDay" },
      };
    case "recipeSearch":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "recipe.search", dish: intent.dish },
      };
    case "listRecipes":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "recipe.list" },
      };
    case "mealPlanGaps":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "meal.gaps" },
      };
    case "assignMeal":
      return {
        outcome: "done",
        tier: "act",
        via,
        effect: { cap: "meal.assign", dish: intent.dish },
      };
    case "memorySave":
      return {
        outcome: "done",
        tier: "act",
        via,
        effect: { cap: "memory.save" },
      };
    case "memoryRecall":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "memory.recall" },
      };
    case "recipeOfferGenerate":
      return { outcome: "honest_limit", via };
    case "greeting":
      return {
        outcome: "answered",
        tier: "answer",
        via,
        effect: { cap: "greeting" },
      };
    case "capabilityAction":
      return {
        outcome: "done",
        tier: "act",
        via,
        effect: { cap: intent.capabilityId },
      };
    case "clarify":
      if (intent.reason === "speechAct") return { outcome: "no_action", via };
      return { outcome: "needs_input", via };
    default:
      // unknown, greeting, switchFace: no door, no action.
      return { outcome: "no_action", via };
  }
}

function isConfident(intent: Intent): boolean {
  return !["clarify", "unknown", "greeting", "switchFace"].includes(
    intent.kind,
  );
}

function routerHint(intent: Intent): string | null {
  if (intent.kind === "switchFace") return `face switch to ${intent.face}`;
  if (intent.kind === "clarify")
    return intent.reason === "speechAct"
      ? `speech act: ${intent.act}`
      : `clarify (${intent.reason})`;
  return null;
}

// ───────────────────────────── model paths ─────────────────────────────

export function promptHash(
  call: Pick<ModelCall, "system" | "user" | "schema">,
): string {
  return createHash("sha256")
    .update(`${call.schema}\n${call.system}\n${call.user}`)
    .digest("hex")
    .slice(0, 16);
}

async function askAIPath(
  c: GymCase,
  text: string,
  key: string,
  model: ModelFn,
): Promise<PathResult> {
  const focus =
    useEraStore.getState().focusEntities.find((e) => e.type === "reminder") ??
    null;
  const system = buildSystemPrompt({
    face: c.context.face,
    focusEntity: focus,
  });
  const reply = await model({ key, system, user: text, schema: "askai" });
  if (!reply) return { outcome: "needs_input", via: "model-unrecorded" };
  const m = { ms: reply.ms, inTok: reply.inTok, outTok: reply.outTok };
  const parsed = parseAskAIResponse(reply.text, undefined, focus);
  if (parsed?.kind === "propose_action") {
    const slots = parsed.slots as Record<string, unknown>;
    return {
      outcome: "awaiting_confirm",
      tier: "confirm",
      via: "model",
      model: m,
      effect: { cap: parsed.capabilityId, target: slots.title, ...slots },
    };
  }
  return { outcome: "answered", tier: "answer", via: "model", model: m };
}

async function understandPath(
  c: GymCase,
  text: string,
  hint: string | null,
  key: string,
  model: ModelFn,
): Promise<PathResult> {
  const focus = useEraStore.getState().focusEntities;
  const system = buildUnderstandPrompt({
    face: c.context.face,
    clock: c.context.clock,
    timezone: c.context.timezone,
    actor: c.context.actor,
    focus,
    routerHint: hint,
  });
  const reply = await model({ key, system, user: text, schema: "understand" });
  if (!reply) return { outcome: "needs_input", via: "model-unrecorded" };
  const m = { ms: reply.ms, inTok: reply.inTok, outTok: reply.outTok };
  let tool = "answer";
  let args: Record<string, unknown> = {};
  try {
    const raw = JSON.parse(reply.text) as { tool: string; argsJson: string };
    tool = raw.tool;
    args = JSON.parse(raw.argsJson || "{}");
  } catch {
    return { outcome: "honest_limit", via: "model", model: m };
  }
  const base = { via: "model" as const, model: m };
  switch (tool) {
    case "answer":
      return { ...base, outcome: "answered", tier: "answer" };
    case "no_action":
      return { ...base, outcome: "no_action" };
    case "clarify":
      return { ...base, outcome: "needs_input" };
    case "navigate":
      return {
        ...base,
        outcome: "handed_off",
        tier: "answer",
        effect: { cap: "navigate", to: args.to },
      };
  }
  // Validation the real engine would do server-side: handles must exist and be own accounts.
  if (tool === "transfer.create") {
    const from = HOUSEHOLD.accounts.find((a) => a.handle === args.from);
    const to = HOUSEHOLD.accounts.find((a) => a.handle === args.to);
    if (
      !from ||
      !to ||
      from.owner !== "owner" ||
      to.owner !== "owner" ||
      from.currency !== to.currency
    ) {
      return { ...base, outcome: "honest_limit" };
    }
    return {
      ...base,
      outcome: "awaiting_confirm",
      tier: "confirm",
      effect: {
        cap: tool,
        amount: Number(args.amount),
        from: accountName(from.handle),
        to: accountName(to.handle),
      },
    };
  }
  const target =
    args.target === "FOCUS"
      ? resolveFocusRef("it", "reminder", focus)?.title
      : (args.target as string | undefined);
  const effect: GymEffect = {
    cap: tool,
    ...args,
    ...(target ? { target } : {}),
  };
  if (tool === "transaction.draft") effect.amount = Number(args.amount);
  // Plan §5 tiers for a model-interpreted proposal.
  const tier: Tier = READS.has(tool)
    ? "answer"
    : CONFIRM_ALWAYS.has(tool) ||
        tool.startsWith("reminder.") ||
        tool === "reminder.delete"
      ? "confirm"
      : "act";
  const outcome: Outcome =
    tier === "answer"
      ? "answered"
      : tier === "confirm"
        ? "awaiting_confirm"
        : tool === "transaction.draft"
          ? "drafted"
          : "done";
  return { ...base, outcome, tier, effect };
}

// ───────────────────────────── running a case ─────────────────────────────

function resetStore(c: GymCase) {
  const s = useEraStore.getState();
  s.reset();
  useEraStore.setState({
    activeFaceKey: c.context.face,
    templates: [],
    focusEntities: c.context.focus.map((f, i) => ({
      ...f,
      addedAt: Date.now() - i,
    })),
  });
}

function pushFocus(r: PathResult) {
  if (
    r.effect?.cap === "reminder.create" &&
    typeof r.effect.title === "string" &&
    r.outcome !== "needs_input"
  ) {
    useEraStore
      .getState()
      .pushFocusEntity({
        id: `gym-${r.effect.title}`,
        type: "reminder",
        title: r.effect.title,
        addedAt: Date.now(),
      });
  }
  // useEraTurn pushes whichever reminder a turn touched (pushFocusFromResult).
  if (
    r.outcome === "done" &&
    typeof r.effect?.itemId === "string" &&
    typeof r.effect.target === "string"
  ) {
    useEraStore
      .getState()
      .pushFocusEntity({
        id: r.effect.itemId,
        type: "reminder",
        title: r.effect.target,
        addedAt: Date.now(),
      });
  }
}

export async function runCase(
  c: GymCase,
  p: "A" | "B" | "C",
  model: ModelFn,
): Promise<PathResult> {
  resetStore(c);
  let final: PathResult = { outcome: "no_action", via: "router" };
  const modelStats: Array<NonNullable<PathResult["model"]>> = [];
  let pendingTitle: string | null = null;
  let pendingSlot: EraPendingTurn | null = null;
  for (let t = 0; t < c.turns.length; t++) {
    const text = c.turns[t];
    // HUB-78 — an open chip question takes typed text that matches an option.
    // HUB-94 — a free-text question never swallows a real new request.
    if (pendingSlot?.kind === "slot" && FREE_TEXT_SLOTS.has(pendingSlot.capability) && isNewRequest(text)) {
      pendingSlot = null;
    }
    if (pendingSlot?.kind === "slot") {
      const isEvent: boolean =
        pendingSlot.capability === "event.when" ||
        pendingSlot.capability === "event.location" ||
        pendingSlot.capability === "place.save";
      const slotCap =
        pendingSlot.capability === "transfer.create"
          ? "transfer.create"
          : "reminder.reschedule";
      const isAmend: boolean =
        pendingSlot.capability === "amend.target" ||
        pendingSlot.capability === "shopping.group";
      const answered = await resolvePendingSlot(pendingSlot, text);
      pendingSlot = null;
      if (!("unmatched" in answered)) {
        const r: PathResult = isAmend
          ? mapAmend(answered as never, {
              id: "x",
              type: "shopping",
              title: "",
              addedAt: 0,
            })
          : isEvent
            ? fromEvent(answered as SlotResult)
            : fromResolution(answered, slotCap);
        if (r.pending) pendingSlot = r.pending;
        if (r.effect || !final.effect) final = r;
        continue;
      }
    }
    // useEraTurn: an outstanding "what time?" question takes the next turn
    // as its answer, before any router or model (all paths alike).
    if (pendingTitle) {
      const title = pendingTitle;
      pendingTitle = null;
      final = hasDate(text)
        ? {
            outcome: "done",
            tier: "act",
            via: "router",
            effect: { cap: "reminder.create", title },
          }
        : {
            outcome: "needs_input",
            via: "router",
            effect: { cap: "reminder.create", title },
          };
      continue;
    }
    const intent = rootIntentRouter.parse(text);
    let r: PathResult;
    const key = `${p}:${c.id}:${t}`;
    if (p === "B" || isConfident(intent)) {
      r = await resolveRouted(intent, text);
    } else if (p === "A") {
      const negated =
        intent.kind === "clarify" &&
        intent.reason === "speechAct" &&
        intent.act === "negated";
      const lang =
        (intent.kind === "clarify" || intent.kind === "unknown") &&
        classifyMiss(text).missKind === "language-gap";
      r =
        !negated && lang
          ? await askAIPath(c, text, key, model)
          : await resolveRouted(intent, text);
    } else {
      r = await understandPath(c, text, routerHint(intent), key, model);
    }
    if (r.model) modelStats.push(r.model);
    if (r.pending?.kind === "slot") pendingSlot = r.pending;
    if (r.focus) useEraStore.getState().pushFocusEntity(r.focus);
    if (
      r.outcome === "needs_input" &&
      r.effect?.cap === "reminder.create" &&
      typeof r.effect.title === "string" &&
      r.via === "router"
    ) {
      pendingTitle = r.effect.title;
    }
    pushFocus(r);
    // An open proposal or committed write persists through a later turn with
    // no effect; a confirm card on screen also survives a later READ (a new
    // request suspends a proposal, never consumes it — plan §4 component 1).
    const cardSurvives =
      final.outcome === "awaiting_confirm" &&
      r.effect !== undefined &&
      !isWrite(r.effect);
    if ((r.effect || !final.effect) && !cardSurvives) final = r;
  }
  if (modelStats.length) {
    final = {
      ...final,
      model: modelStats.reduce((a, b) => ({
        ms: a.ms + b.ms,
        inTok: a.inTok + b.inTok,
        outTok: a.outTok + b.outTok,
      })),
    };
  }
  return final;
}

// ───────────────────────────── scoring ─────────────────────────────

function norm(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "");
}

function effectMatches(expected: GymEffect, actual?: GymEffect): boolean {
  if (!actual || actual.cap !== expected.cap) return false;
  return Object.entries(expected).every(([k, v]) => {
    if (k === "cap" || k === "exactTitle") return true;
    if (k === "title" && expected.exactTitle)
      return norm(actual.title) === norm(v);
    const a = actual[k];
    if (typeof v === "number") return Number(a) === v;
    const nv = norm(v);
    const na = norm(a);
    return na !== "" && (na.includes(nv) || nv.includes(na));
  });
}

function isWrite(e?: GymEffect): boolean {
  return Boolean(e && !READS.has(e.cap));
}

function matchOne(
  exp: { outcome: Outcome; effect?: GymEffect; tier?: Tier },
  r: PathResult,
): boolean {
  switch (exp.outcome) {
    case "no_action":
      return (
        !isWrite(r.effect) &&
        ["no_action", "answered", "honest_limit"].includes(r.outcome)
      );
    case "needs_input":
      return (
        r.outcome === "needs_input" &&
        (!exp.effect || !r.effect || r.effect.cap === exp.effect.cap)
      );
    case "honest_limit":
      return (
        !isWrite(r.effect) &&
        (r.outcome === "honest_limit" || r.outcome === "answered")
      );
    case "answered":
      if (!exp.effect)
        return (
          !isWrite(r.effect) &&
          ["answered", "honest_limit", "no_action"].includes(r.outcome)
        );
      return effectMatches(exp.effect, r.effect);
    default: {
      if (!exp.effect || !effectMatches(exp.effect, r.effect)) return false;
      if (exp.tier && r.tier && TIER_RANK[r.tier] < TIER_RANK[exp.tier])
        return false;
      return !["needs_input", "no_action", "honest_limit"].includes(r.outcome);
    }
  }
}

export interface CaseScore {
  correct: boolean;
  wrongEffect: boolean;
  wrongMoney: boolean;
  question: boolean;
}

export function score(c: GymCase, r: PathResult): CaseScore {
  const correct =
    matchOne(c.expect, r) ||
    (c.expect.acceptable ?? []).some((a) => matchOne(a, r));
  const wrongEffect = !correct && isWrite(r.effect);
  const moneyTier =
    r.effect &&
    CONFIRM_ALWAYS.has(r.effect.cap) &&
    r.tier !== "confirm" &&
    r.outcome !== "needs_input";
  const wrongMoney =
    Boolean(moneyTier) ||
    (wrongEffect &&
      Boolean(
        (r.effect && MONEY.has(r.effect.cap)) ||
          (c.expect.effect && MONEY.has(c.expect.effect.cap)),
      ));
  return {
    correct,
    wrongEffect,
    wrongMoney,
    question: r.outcome === "needs_input",
  };
}

// ───────────────────────────── recordings ─────────────────────────────

export const RECORDINGS = path.join(
  GYM_DIR,
  "recordings",
  "model-responses.json",
);

interface RecordingFile {
  meta: { recordedAt: string; model: string; calls: number };
  entries: Record<string, ModelReply & { hash: string }>;
}

export function loadRecordings(): RecordingFile | null {
  if (!fs.existsSync(RECORDINGS)) return null;
  return JSON.parse(fs.readFileSync(RECORDINGS, "utf-8")) as RecordingFile;
}

/** Replay-only model: a stale (prompt changed) or missing entry is "unrecorded". */
export function replayModel(rec: RecordingFile | null): ModelFn {
  return async (call) => {
    const e = rec?.entries[call.key];
    if (!e || e.hash !== promptHash(call)) return null;
    return e;
  };
}

// ───────────────────────────── report ─────────────────────────────

export interface PathSummary {
  path: "A" | "B" | "C";
  n: number;
  correct: number;
  correctHeldout: number;
  nHeldout: number;
  correctSupported: number;
  nSupported: number;
  wrongEffects: number;
  wrongMoney: number;
  questions: number;
  modelCalls: number;
  unrecorded: number;
  p50: number | null;
  p95: number | null;
  inTok: number;
  outTok: number;
}

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}

function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

export function summarize(
  p: "A" | "B" | "C",
  rows: Array<{ c: GymCase; r: PathResult; s: CaseScore }>,
): PathSummary {
  const lat = rows.filter((x) => x.r.model).map((x) => x.r.model!.ms);
  const held = rows.filter((x) => x.c.split === "heldout");
  const sup = rows.filter((x) => isSupported(x.c));
  return {
    path: p,
    n: rows.length,
    correct: rows.filter((x) => x.s.correct).length,
    correctHeldout: held.filter((x) => x.s.correct).length,
    nHeldout: held.length,
    correctSupported: sup.filter((x) => x.s.correct).length,
    nSupported: sup.length,
    wrongEffects: rows.filter((x) => x.s.wrongEffect).length,
    wrongMoney: rows.filter((x) => x.s.wrongMoney).length,
    questions: rows.filter((x) => x.s.question).length,
    modelCalls: lat.length,
    unrecorded: rows.filter((x) => x.r.via === "model-unrecorded").length,
    p50: quantile(lat, 0.5),
    p95: quantile(lat, 0.95),
    inTok: rows.reduce((a, x) => a + (x.r.model?.inTok ?? 0), 0),
    outTok: rows.reduce((a, x) => a + (x.r.model?.outTok ?? 0), 0),
  };
}

export type Decision =
  | { verdict: "adopt-C" | "keep-miss-only"; reasons: string[] }
  | { verdict: "undecided"; reasons: string[] };

/** Plan §7 decision rule, on the held-out split. */
export function decide(a: PathSummary, c: PathSummary): Decision {
  if (a.unrecorded || c.unrecorded || c.modelCalls === 0) {
    return {
      verdict: "undecided",
      reasons: [
        `model responses not recorded (A: ${a.unrecorded}, C: ${c.unrecorded} unrecorded)`,
      ],
    };
  }
  const delta =
    pct(c.correctHeldout, c.nHeldout) - pct(a.correctHeldout, a.nHeldout);
  const reasons = [
    `held-out correctness C − A = ${delta.toFixed(1)} points (need ≥ 20)`,
    `C wrong money effects = ${c.wrongMoney} (need 0)`,
    `C model-path p50 = ${c.p50 ?? "n/a"} ms (need ≤ 2500)`,
  ];
  const adopt =
    delta >= 20 && c.wrongMoney === 0 && c.p50 !== null && c.p50 <= 2500;
  return { verdict: adopt ? "adopt-C" : "keep-miss-only", reasons };
}

export function renderReport(
  summaries: PathSummary[],
  decision: Decision,
  meta: { model?: string; recordedAt?: string },
): string {
  const row = (s: PathSummary) =>
    `| ${s.path} | ${s.correct}/${s.n} (${pct(s.correct, s.n)}%) | ${s.correctHeldout}/${s.nHeldout} (${pct(s.correctHeldout, s.nHeldout)}%) | ${s.correctSupported}/${s.nSupported} (${pct(s.correctSupported, s.nSupported)}%) | ${s.wrongEffects} | ${s.wrongMoney} | ${(s.questions / s.n).toFixed(2)} | ${s.modelCalls}${s.unrecorded ? ` (+${s.unrecorded} unrecorded)` : ""} | ${s.p50 ?? "–"} / ${s.p95 ?? "–"} | ${s.inTok} / ${s.outTok} |`;
  return [
    "# ERA Gym report",
    "",
    `Model: ${meta.model ?? "not recorded"} · recorded: ${meta.recordedAt ?? "never"} · corpus: synthetic (owner export pending)`,
    "",
    "| Path | Correct (all) | Held-out | Supported caps | Wrong effects | Wrong money | Questions/task | Model calls | p50 / p95 ms | Tokens in / out |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...summaries.map(row),
    "",
    `**Decision (plan §7): ${decision.verdict}**`,
    ...decision.reasons.map((r) => `- ${r}`),
    "",
  ].join("\n");
}
