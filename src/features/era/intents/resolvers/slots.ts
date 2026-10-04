// src/features/era/intents/resolvers/slots.ts
// HUB-78 — plan §4 component 1: ask ONE question as chips, then finish the
// request from the structured answer. Three pilot capabilities:
//   transfer.create  — a missing source or destination account
//   reminder.pick    — two reminders share the spoken name
//   reminder.scope   — the reminder repeats: this one or the series
// A chip tap is structured and never re-parsed. Typed text is matched against
// the options; anything else returns `unmatched` and the caller handles it
// as a new request.

import type { EraChipOption, EraPendingSlot } from "../../types";
import { formatReminderActionError } from "../formatters/schedule";
import { prepareTransfer, type WithProposalResult } from "./budget";
import { slot, type SlotResult } from "./slotBuilders";
import { shouldOfferAlways } from "../../lexicon";
import { useEraStore } from "../../useEraStore";
import { saveLexiconRule, type LexiconRuleInput } from "../../useEraLexicon";

/** Examples are evidence only; failures (e.g. table not yet created) are silent. */
async function recordExample(input: LexiconRuleInput): Promise<void> {
  await saveLexiconRule(input).catch(() => null);
}
import { coverCard } from "./budgetFamilies";
import { answerEventLocation, answerEventWhen, answerPlaceSave } from "./events";
import { answerAmendTarget, moveToGroup } from "./amend";
import { findReminderCandidates, normalizeTitle, type ReminderCandidate } from "./reminderLookup";
import {
  prepareReminderDelete,
  resolveReminderComplete,
  resolveReminderReschedule,
} from "./schedule";

export type { SlotResult };

export type ReminderAction = "reschedule" | "complete" | "delete" | "skip";

/** Typed answer → option: exact label, then a unique partial match. */
export function matchOption(options: EraChipOption[], text: string): EraChipOption | null {
  const t = normalizeTitle(text);
  if (!t) return null;
  const exact = options.find((o) => normalizeTitle(o.label) === t);
  if (exact) return exact;
  const partial = options.filter((o) => {
    const l = normalizeTitle(o.label);
    return l && (l.includes(t) || t.includes(l));
  });
  return partial.length === 1 ? partial[0] : null;
}

// ───────────────────────────── reminders ─────────────────────────────

/** Named target not in focus: look it up, ask only when it is ambiguous. */
export async function resolveNamedReminder(
  action: ReminderAction,
  hint: string,
  whenText: string | undefined,
  rawText: string,
): Promise<SlotResult> {
  const found = await findReminderCandidates(hint);
  if (found === null) return { text: formatReminderActionError(hint, action === "skip" ? "reschedule" : action), ok: false };
  const mine = found.filter((c) => c.mine);
  if (mine.length === 0) {
    return {
      text: found.length ? `"${found[0].title}" isn't yours.` : `No reminder called "${hint}".`,
      ok: false,
      metadata: { lookup: hint, matches: found.length },
    };
  }
  if (mine.length > 1) {
    return slot(
      "reminder.pick",
      "itemId",
      "Which one?",
      mine.slice(0, 4).map((c) => ({ label: c.title, value: c.id })),
      { action, whenText, candidates: mine.slice(0, 4) },
      rawText,
    );
  }
  return proceedWithReminder(action, mine[0], whenText, rawText);
}

export async function proceedWithReminder(
  action: ReminderAction,
  c: Pick<ReminderCandidate, "id" | "title" | "recurring">,
  whenText: string | undefined,
  rawText: string,
): Promise<SlotResult> {
  if (action === "delete") return prepareReminderDelete(c.id, c.title, rawText);
  if (action === "skip") {
    if (!c.recurring) return { text: `${c.title} doesn't repeat.`, ok: false };
    const text = `Skip · ${c.title} · next`;
    return {
      text,
      metadata: { proposed: "reminderSkip", itemId: c.id },
      proposal: { kind: "native_action", text, sourceText: rawText, action: { type: "reminderSkip", itemId: c.id, title: c.title } },
    };
  }
  if (action === "complete") return resolveReminderComplete(c.id, c.title);
  if (!whenText) return { text: formatReminderActionError(c.title, "reschedule"), ok: false };
  if (c.recurring) {
    return slot(
      "reminder.scope",
      "scope",
      `${c.title} repeats.`,
      [
        { label: "This one", value: "one" },
        { label: "Series", value: "series" },
      ],
      { itemId: c.id, title: c.title, whenText },
      rawText,
    );
  }
  return resolveReminderReschedule(c.id, c.title, whenText);
}

// ───────────────────────────── answers ─────────────────────────────

export async function resolvePendingSlot(
  pending: EraPendingSlot,
  text: string,
  chip?: string,
): Promise<SlotResult | { unmatched: true }> {
  // "Change what?" accepts any item NAME, not only the offered chips.
  if (pending.capability === "amend.target") {
    const r = await answerAmendTarget(String(pending.args.editText ?? ""), text, chip ?? matchOption(pending.options, text)?.value);
    if (!r) return { unmatched: true };
    return { ...r, pending: r.pending ?? null };
  }
  // HUB-94 — event date, event place and "save this place" take free text too.
  if (pending.capability === "event.when") return answerEventWhen(pending, text, chip);
  if (pending.capability === "event.location") return answerEventLocation(pending, text, chip);
  if (pending.capability === "place.save") return answerPlaceSave(pending, text, chip);
  const choice = chip ?? matchOption(pending.options, text)?.value;
  if (!choice || choice.startsWith("nav:")) return { unmatched: true };
  const a = pending.args;

  if (pending.capability === "transfer.create") {
    const from = pending.slot === "from" ? choice : (a.fromName as string | undefined);
    const to = pending.slot === "to" ? choice : (a.toName as string | undefined);
    const r: WithProposalResult = await prepareTransfer(
      a.amount as number,
      a.currency as string | undefined,
      from,
      to,
      pending.rawText,
    );
    // HUB-80 — the chosen side is an EXAMPLE (never a default by itself); a
    // repeat of the same choice makes the card offer "Always" once.
    if (r.proposal?.kind === "native_action" && r.proposal.action.type === "transfer") {
      const t = r.proposal.action;
      const conditions = pending.slot === "to" ? { from: t.fromAccountId } : { to: t.toAccountId };
      const value = pending.slot === "to" ? { accountId: t.toAccountId, name: t.toName } : { accountId: t.fromAccountId, name: t.fromName };
      const depends_on = [t.fromAccountId, t.toAccountId];
      const rules = useEraStore.getState().lexicon;
      const offer = shouldOfferAlways(rules, "transfer.create", pending.slot, conditions, value, new Set(depends_on));
      void recordExample({ kind: "example", capability: "transfer.create", slot: pending.slot, conditions, value, depends_on });
      if (offer) {
        r.proposal = { ...r.proposal, offerAlways: { capability: "transfer.create", slot: pending.slot, conditions, value, depends_on } };
      }
    }
    return { ...r, pending: null };
  }

  if (pending.capability === "reminder.pick") {
    const cands = (a.candidates as ReminderCandidate[]) ?? [];
    const c = cands.find((x) => x.id === choice);
    if (!c) return { unmatched: true };
    const r = await proceedWithReminder(a.action as ReminderAction, c, a.whenText as string | undefined, pending.rawText);
    return { ...r, pending: r.pending ?? null };
  }

  if (pending.capability === "shopping.group") {
    const meta = a as unknown as { messageIds: string[]; threadId: string; items: string[]; groupId: string | null };
    const opt = pending.options.find((o) => o.value === choice);
    if (!opt) return { unmatched: true };
    const focus = { id: meta.messageIds[0], type: "shopping" as const, title: meta.items.join(", "), addedAt: Date.now(), meta: a };
    const r = await moveToGroup(focus, meta, opt.value || null, opt.label);
    return { ...r, pending: null };
  }

  if (pending.capability === "recurring.link") {
    const cands = (a.candidates as Array<{ id: string; date: string }>) ?? [];
    const tx = cands.find((t) => t.id === choice);
    if (!tx) return { unmatched: true };
    const r = coverCard(
      {
        paymentId: a.paymentId as string,
        name: a.name as string,
        amount: a.amount as number,
        previousLastProcessed: (a.previousLastProcessed as string | null) ?? null,
        previousNextDue: a.previousNextDue as string,
        transactionId: tx.id,
        txDate: tx.date,
      },
      pending.rawText,
    );
    return { ...r, pending: null };
  }

  // reminder.scope — both choices are Confirm (plan §5: series scope
  // escalates; a single-occurrence postpone has no demonstrated inverse).
  const itemId = a.itemId as string;
  const title = a.title as string;
  const whenText = a.whenText as string;
  const series = choice === "series";
  const cardText = `${series ? "Series" : "This one"} · ${title} → ${whenText}`;
  return {
    text: cardText,
    pending: null,
    metadata: { proposed: series ? "reminderSeries" : "reminderOccurrence", itemId },
    proposal: {
      kind: "native_action",
      text: cardText,
      sourceText: pending.rawText,
      action: series
        ? { type: "reminderSeries", itemId, title, whenText }
        : { type: "reminderOccurrence", itemId, title, whenText },
    },
  };
}
