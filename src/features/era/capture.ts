import { z } from "zod";
import { extractAmount, locateAmount, parseAmountToken } from "@/lib/nlp/amount";
import {
  parseRelativeDate,
  parseSmartText,
  parseTime,
} from "@/lib/smartTextParser";
import { formatDate } from "@/lib/utils/date";
import {
  cleanExpenseDescription,
  memoryKey,
  recall,
  type MemoryExpense,
  type MemoryShopping,
  type MemoryTitle,
} from "@/lib/era/captureMemory";
import { classifySpeechAct } from "./intents/speechAct";
import { eventLead, eventWhen, parseEvent } from "./intents/eventText";
import { budgetRouter } from "./intents/budget";
import { chefRouter } from "./intents/chef";
import { scheduleRouter } from "./intents/schedule";
import { splitShoppingItems } from "./intents/resolvers/shopping";
import type { Intent } from "./types";

export type CaptureKind = "reminder" | "event" | "expense" | "shopping";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00`);
    return Number.isFinite(d.getTime()) && formatDate(d) === v;
  }, "Choose a date");
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const scheduleFields = {
  title: z.string().trim().min(1, "Add a title").max(1000),
  date,
  time,
  priority: z.enum(["low", "normal", "high", "urgent"]),
  location: z.string().trim().max(300),
  alert: z.enum(["none", "0", "5", "15", "30", "60"]),
};
export const captureSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("reminder"), ...scheduleFields }),
  z.object({
    kind: z.literal("event"),
    ...scheduleFields,
    endDate: date,
    endTime: time,
  }),
  z.object({
    kind: z.literal("expense"),
    accountId: z.string().min(1, "Choose an account"),
    amount: z.number().finite().positive("Add an amount"),
    categoryId: z.string().min(1, "Choose a category"),
    subcategoryId: z.string(),
    description: z.string().trim().min(1, "Add a description"),
    date,
  }),
  z.object({
    kind: z.literal("shopping"),
    threadId: z.string().min(1, "Choose a list"),
    groupId: z.string().nullable(),
    items: z
      .array(z.string().trim().min(1).max(1000))
      .min(1, "Add an item")
      .max(50),
  }),
]);
export type NativeCapture = z.infer<typeof captureSchema>;
export type ExpenseCapture = Extract<NativeCapture, { kind: "expense" }>;
export type ScheduleCapture = Extract<
  NativeCapture,
  { kind: "reminder" | "event" }
>;

/** What ERA remembers, so detection can recognise the household's own phrasing. */
export interface CaptureHints {
  expenses?: readonly MemoryExpense[];
  titles?: readonly MemoryTitle[];
  shopping?: readonly MemoryShopping[];
}

export function commandText(text: string): string {
  return text
    .trim()
    .replace(
      /^(?:please\s+)?(?:(?:can|could|would) you\s+)?(?:please\s+)?/i,
      "",
    );
}

const MONEY_MARK_RE = /[$€£]|\b(?:usd|lbp|dollars?|bucks|euros?|lira)\b/i;
/** A number that measures something else: "2 hours", "5 km", "3 pieces". */
const UNIT_RE =
  /\b\d+(?:[.,]\d+)?\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?|months?|years?|km|kg|g|ml|l|liters?|litres?|pieces?|pcs|times?|percent|%)(?![\p{L}])/iu;
/** Words that start many commands, never a shopping item on their own. */
const NOT_AN_ITEM_RE =
  /^(?:a|an|the|to|my|our|some|more|it|this|that|reminder|event|expense|task|note)\b/i;

const hasWhen = (text: string, now?: Date) =>
  Boolean(parseRelativeDate(text, now) || parseTime(text));

/** Suggest a helper only from a creation phrase, never from incidental nouns. */
export function detectCapture(
  text: string,
  hints: CaptureHints = {},
): CaptureKind | null {
  const t = commandText(text);
  if (classifySpeechAct(text) !== "command") return null;
  if (
    /^(?:i\s+)?(?:paid|spent|bought)\b|^(?:log|add|record)\s+(?:an?\s+)?expense\b/i.test(
      t,
    )
  )
    // "spent 2 hours studying" measures time, not money.
    return classifySpeechAct(text, { strict: true }) === "command" &&
      (MONEY_MARK_RE.test(t) || !UNIT_RE.test(t))
      ? "expense"
      : null;
  if (/^(?:add|create|schedule)\s+(?:an?\s+)?event\b/i.test(t)) return "event";
  if (
    /^(?:add|create|set)\s+(?:an?\s+)?reminder\b|^remind me\b|^don['’]?t forget\b/i.test(
      t,
    )
  )
    return "reminder";
  if (/^(?:add|put)\b[\s\S]*\bshopping(?: list)?\b|^shopping list\b/i.test(t))
    return "shopping";
  return routedCapture(t) ?? rememberedCapture(t, hints);
}

/**
 * The module grammars ERA already runs on Send, asked as if their face were
 * active: "15$ pharmacy" (Budget), "remember to …" (Schedule), "we're out of
 * milk" (Chef). The composer previews before anything is written, so it may
 * understand a face's phrasing anywhere.
 */
function routedCapture(text: string): CaptureKind | null {
  const budget = budgetRouter.parse(text, { activeFaceKey: "budget" });
  // The Budget face's bare-number shorthand ("Gaz yaris 38") stays there:
  // the composer needs a currency, a money verb or `k` before it says Expense.
  if (
    budget?.kind === "draftTransaction" &&
    (extractAmount(text) || extractAmount(text, { allowBare: true })?.kShorthand)
  )
    return classifySpeechAct(text, { strict: true }) === "command"
      ? "expense"
      : null;
  const schedule = scheduleRouter.parse(text, { activeFaceKey: "schedule" });
  if (schedule?.kind === "draftEvent") return "event";
  if (schedule?.kind === "draftReminder") return "reminder";
  if (chefRouter.parse(text, { activeFaceKey: "chef" })?.kind === "addShopping")
    return "shopping";
  if (/^buy\s+\S/i.test(text) && !MONEY_MARK_RE.test(text) && !hasWhen(text))
    return "shopping";
  return null;
}

/** Phrasing only this household uses: its own items, spends and reminders. */
function rememberedCapture(t: string, hints: CaptureHints): CaptureKind | null {
  if (t.includes("?") || t.includes("\n")) return null;
  const words = t.split(/\s+/).length;

  // "add milk", "add mil" → the lists already know Milk.
  const add = t.match(/^(?:add|put)\s+(.+)$/i)?.[1];
  if (add && hints.shopping?.length && !MONEY_MARK_RE.test(t) && !hasWhen(t)) {
    const items = shoppingItems(add, hints.shopping);
    const known = new Set(hints.shopping.map((s) => memoryKey(s.text)));
    const last = items.at(-1) ?? "";
    if (
      items.length > 0 &&
      items.slice(0, -1).every((item) => known.has(memoryKey(item))) &&
      (known.has(memoryKey(last)) ||
        (last.length >= 3 &&
          !NOT_AN_ITEM_RE.test(last) &&
          recall(last, hints.shopping, 1).some((s) =>
            memoryKey(s.text).startsWith(memoryKey(last)),
          )))
    )
      return "shopping";
  }

  // "coffee 4" → a spend made before, with a plain number.
  if (hints.expenses?.length && words <= 6 && !UNIT_RE.test(t) && !hasWhen(t)) {
    const bare = locateAmount(t, { allowBare: true });
    const description = memoryKey(cleanExpenseDescription(t, { allowBare: true }));
    if (
      bare &&
      description &&
      hints.expenses.some((e) => memoryKey(e.text) === description)
    )
      return "expense";
  }

  // "call mom tomorrow at 5" → a reminder written before, now with a time.
  if (hints.titles?.length && !MONEY_MARK_RE.test(t) && hasWhen(t)) {
    const rest = memoryKey(eventWhen(t).rest);
    const hit = hints.titles.find((title) => memoryKey(title.text) === rest);
    if (rest && hit) return hit.type;
  }
  return null;
}

/**
 * One-line items: commas and "and" separate, except where the whole phrase is
 * an item the lists already know ("mac and cheese").
 */
export function shoppingItems(
  raw: string,
  known: readonly MemoryShopping[] = [],
): string[] {
  const keys = new Set(known.map((s) => memoryKey(s.text)));
  return raw.split(/\s*,\s*/).flatMap((part) => {
    const item = part
      .trim()
      .replace(/^(?:some|a|an|the|more)\s+/i, "")
      .replace(/[\s.;:!?]+$/, "");
    return keys.has(memoryKey(item))
      ? [item.charAt(0).toUpperCase() + item.slice(1)]
      : splitShoppingItems(part);
  });
}

export function shoppingLines(text: string): string[] {
  // Newlines are explicit item boundaries; preserve commas and "and" in names.
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** An own account named in the sentence: "… from Cash LBP", "paid with Wallet". */
export function mentionedAccount<T extends { id: string; name: string }>(
  text: string,
  accounts: readonly T[],
): { account: T; start: number; end: number } | null {
  const hits = accounts
    .filter((a) => a.name.trim().length >= 3)
    .map((account) => {
      const name = account.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = new RegExp(
        `(^|\\s)(?:from|with|using|via|by)\\s+(?:(?:my|the|our)\\s+)?${name}(?=$|[^\\p{L}\\p{N}])`,
        "iu",
      ).exec(text);
      return match
        ? {
            account,
            start: match.index + match[1].length,
            end: match.index + match[0].length,
          }
        : null;
    })
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((a, b) => b.account.name.length - a.account.name.length);
  if (
    hits.length === 0 ||
    (hits.length > 1 && hits[0].account.name.length === hits[1].account.name.length)
  )
    return null;
  return hits[0];
}

export interface SeedContext {
  /** Own expense accounts, for "from <account>". */
  accounts?: ReadonlyArray<{ id: string; name: string; currency?: string }>;
  /** Remembered shopping items, for one-line splitting. */
  shopping?: readonly MemoryShopping[];
}

export function captureSeed(
  kind: CaptureKind,
  text: string,
  now = new Date(),
  context: SeedContext = {},
): Record<string, string> {
  text = commandText(text);
  const parsed = parseSmartText(text, now);
  const today = formatDate(now);
  if (kind === "shopping") {
    if (!text.includes("\n")) {
      const intent = chefRouter.parse(text, { activeFaceKey: "chef" });
      if (intent?.kind === "addShopping")
        return { items: intent.items.join("\n") };
      // "buy milk and eggs", "add milk" (remembered items).
      const loose = text.match(/^(?:add|put|buy)\s+(?!to\b)(.+)$/i)?.[1];
      if (loose && !/\bshopping\b/i.test(text))
        return { items: shoppingItems(loose, context.shopping).join("\n") };
    }
    return {
      items: text
        .replace(
          /^(?:add|put)\s+(?:to\s+)?(?:the\s+)?shopping(?: list)?\s*[:\-]?\s*/i,
          "",
        )
        .replace(/^shopping list\s*[:\-]?\s*/i, "")
        .replace(
          /^(?:add|put)\s+(?=[\s\S]*\b(?:to|on|in)\s+(?:the\s+)?shopping list\b)/i,
          "",
        )
        .replace(/\s+(?:to|on|in)\s+(?:the\s+)?shopping list\s*$/i, "")
        // "buy milk" / "add milk" continued line by line: the verb is not an item.
        .replace(/^(?:buy|add|put)\s+(?!to\b)/i, ""),
    };
  }
  if (kind === "expense") {
    const located = locateAmount(text) ?? locateAmount(text, { allowBare: true });
    // A named account wins when it agrees with the amount's currency.
    const marker = extractAmount(text)?.currency;
    const mention = context.accounts
      ? mentionedAccount(text, context.accounts)
      : null;
    const usable =
      mention && (!marker || (mention.account.currency ?? "USD") === marker)
        ? mention
        : null;
    // "from <account>" is never part of what was bought.
    const body = mention
      ? `${text.slice(0, mention.start)} ${text.slice(mention.end)}`
      : text;
    return {
      amount: located ? String(located.value) : "",
      description: cleanExpenseDescription(body, { allowBare: true }),
      date: today,
      ...(usable ? { accountId: usable.account.id } : {}),
    };
  }
  const leadless = text
    .replace(
      /^(?:add|create|set|make|new)\s+(?:an?\s+|the\s+)?(?:new\s+)?(?:reminders?|alarms?|tasks?|to-?dos?)\b\s*(?:(?:to|for|about)\b\s*)?/i,
      "",
    )
    .replace(/^remind me(?:\s+(?:to|about)\b)?\s*/i, "")
    .replace(/^(?:remember|don['’]?t forget|do not forget)(?:\s+to\b)?\s*/i, "")
    .replace(/^(?:alert|notify|ping|buzz)\s+me(?:\s+(?:to|about)\b)?\s*/i, "")
    .replace(/^note\s+to\s+(?:my)?self\b[\s:,-]*/i, "")
    .replace(/^wake\s+me(?:\s+up)?\b\s*/i, "")
    .replace(/^(?:set|put)\s+an?\s+alarm\b\s*(?:(?:for|to)\b\s*)?/i, "");
  const emptyLead =
    /^(?:(?:add|create|set|schedule)\s+(?:an?\s+)?(?:reminder|event)|remind me(?: to)?)\s*$/i.test(
      text.trim(),
    );
  const noAlert = /\b(?:no\s+alerts?|without\s+(?:an?\s+)?alerts?)\b/i.test(
    text,
  );
  const body = (kind === "event" ? (eventLead(text)?.body ?? text) : leadless)
    .replace(/\b(?:no\s+alerts?|without\s+(?:an?\s+)?alerts?)\b/gi, "")
    .replace(
      /\b(?:(?:low|normal|medium|high|urgent)\s+priority|priority\s+(?:low|normal|medium|high|urgent)|p[1-4])\b/gi,
      "",
    )
    .replace(/\b(?:urgent(?:ly)?|asap)\s*$/i, "")
    .trim();
  const event = parseEvent(`Add an event ${body}`, now);
  const titleText = eventWhen(body, now)
    .rest.replace(/(?:^|\s+)(?:at|@)\s+(?![\d:]).+$/i, "")
    .trim();
  const title =
    emptyLead || !titleText
      ? ""
      : (event?.title ?? parsed.title)
          .replace(
            /^(?:add|create|set|schedule)\s+(?:an?\s+)?(?:reminder|event)\s*/i,
            "",
          )
          .replace(/^to\s+/i, "");
  const startDate = event?.date ?? parsed.dueDate ?? parsed.startDate ?? today;
  const startTime =
    event?.time ?? parsed.dueTime ?? parsed.startTime ?? "12:00";
  const end = new Date(`${startDate}T${startTime}:00`);
  end.setHours(end.getHours() + 1);
  const defaultEndTime = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
  return {
    title,
    date: startDate,
    time: startTime,
    priority: parsed.priority,
    location: event?.placeHint ?? "",
    alert: noAlert ? "none" : kind === "reminder" ? "0" : "none",
    ...(noAlert ? { alertSpecified: "true" } : {}),
    // The shared parser's one-hour default wraps its clock, but not its day.
    // Preserve other parsed ends; repair only that same-day default rollover.
    endDate:
      parsed.endDate === startDate && parsed.endTime === defaultEndTime
        ? formatDate(end)
        : (parsed.endDate ?? formatDate(end)),
    endTime: parsed.endTime ?? defaultEndTime,
  };
}

export function captureIntent(input: NativeCapture, rawText: string): Intent {
  const capture = captureSchema.parse(input);
  if (capture.kind === "expense")
    return { kind: "draftTransaction", face: "budget", rawText, capture };
  if (capture.kind === "shopping")
    return {
      kind: "addShopping",
      face: "chef",
      rawText,
      items: capture.items,
      target: capture,
    };
  return capture.kind === "event"
    ? {
        kind: "draftEvent",
        face: "schedule",
        rawText,
        title: capture.title,
        capture,
      }
    : {
        kind: "draftReminder",
        face: "schedule",
        rawText,
        title: capture.title,
        capture,
      };
}

export function captureAmount(value: string): number {
  return parseAmountToken(value) ?? 0;
}
