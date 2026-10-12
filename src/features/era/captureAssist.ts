// src/features/era/captureAssist.ts
// HUB-113 — what the composer says and offers while a capture is typed: the
// one question it asks, the choices that answer it, the ghost completion, the
// summary of what it understood and the phrases it highlights. Pure: the hook
// supplies the state and the components render it.

import { getCurrencySymbol } from "@/lib/currency";
import {
  memoryKey,
  recall,
  recallExpense,
  type MemoryExpense,
  type MemoryShopping,
  type MemoryTitle,
} from "@/lib/era/captureMemory";
import { locateAmount } from "@/lib/nlp/amount";
import { parseRelativeDate, parseTime } from "@/lib/smartTextParser";
import { formatDate } from "@/lib/utils/date";
import { mentionedAccount, type CaptureKind } from "./capture";
import { completeCaptureText, type CaptureStep } from "./captureProgress";
import { eventWhen } from "./intents/eventText";

type Named = { id: string; name: string };

export interface AssistState {
  kind: CaptureKind;
  text: string;
  fields: Record<string, string>;
  step: CaptureStep;
  now: Date;
  accounts: ReadonlyArray<Named & { currency?: string }>;
  parents: readonly Named[];
  children: readonly Named[];
  threads: ReadonlyArray<{
    id: string;
    title?: string | null;
    last_message?: { content?: string | null } | null;
  }>;
  groups: readonly Named[];
  items: readonly string[];
  memory: {
    expenses: readonly MemoryExpense[];
    titles: readonly MemoryTitle[];
    shopping: readonly MemoryShopping[];
  };
  dateChosen?: boolean;
  timeChosen?: boolean;
}

export type SentenceSlot =
  | "date"
  | "time"
  | "when"
  | "amount"
  | "title"
  | "description"
  | "items";

export interface AssistChoice {
  label: string;
  /** A field value, or the words a sentence choice writes. */
  value: string;
  detail?: string;
  /** Set when the choice completes the sentence instead of setting a field. */
  sentence?: SentenceSlot;
}

export interface AssistToken {
  key: string;
  label: string;
  /** Tapping opens this step's choices. */
  step?: CaptureStep;
  icon?: "alert" | "silent" | "place" | "priority";
  /** Joins this part to the previous one as prose ("Today at 5 PM"). */
  joiner?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const clockLabel = (h: number, m = 0) =>
  `${h % 12 || 12}${m ? `:${pad(m)}` : ""} ${h < 12 ? "AM" : "PM"}`;
const clockPhrase = (h: number, m = 0) =>
  `at ${h % 12 || 12}${m ? `:${pad(m)}` : ""}${h < 12 ? "am" : "pm"}`;
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const addDays = (d: Date, n: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};

/** "Today", "Tomorrow", "Friday" within the week, else "Fri, Oct 16". */
export function dayLabel(date: string, now = new Date()): string {
  const value = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(value.getTime())) return "";
  const days = Math.round(
    (value.getTime() - new Date(`${formatDate(now)}T12:00:00`).getTime()) /
      86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return WEEKDAYS[value.getDay()];
  return value.toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** "Today at 5 PM", "Fri, Oct 16 at 9:30 AM". */
export function readableWhen(date: string, time: string, now = new Date()): string {
  const [h, m] = time.split(":").map(Number);
  if (!date || !Number.isFinite(h) || !Number.isFinite(m)) return "";
  const day = dayLabel(date, now);
  return day ? `${day} at ${clockLabel(h, m)}` : "";
}

/** "$4.50", "500,000 LBP" — the account's own currency. */
export function amountLabel(value: number, currency?: string): string {
  const symbol = getCurrencySymbol(currency);
  const n = value.toLocaleString("en-US", {
    minimumFractionDigits: Math.round(value * 100) % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return symbol.length === 1 ? `${symbol}${n}` : `${n} ${symbol}`;
}

/** How the amount extractor reads a currency back from a sentence. */
function amountPhrase(value: number, currency?: string): string | null {
  const code = currency ?? "USD";
  if (code === "USD") return `${value}$`;
  if (code === "EUR") return `${value}€`;
  if (code === "GBP") return `£${value}`;
  if (code === "LBP") return `${value} lbp`;
  return null;
}

const SLOT_STEP = { title: "title", description: "description", items: "items" } as const;
type FieldSlot = keyof typeof SLOT_STEP;

/** The field the person is still typing at the end of the sentence, if any. */
export function typingFragment(
  s: AssistState,
): { slot: FieldSlot; fragment: string } | null {
  const slot: FieldSlot =
    s.kind === "expense" ? "description" : s.kind === "shopping" ? "items" : "title";
  const value = slot === "items" ? (s.items.at(-1) ?? "") : (s.fields[slot] ?? "");
  if (!value.trim()) return { slot, fragment: "" };
  const tail = memoryKey(s.text);
  const key = memoryKey(value);
  const atEnd =
    key !== "" &&
    tail.endsWith(key) &&
    (tail.length === key.length || tail[tail.length - key.length - 1] === " ");
  return atEnd ? { slot, fragment: value } : null;
}

function memoryCompletions(
  s: AssistState,
  slot: FieldSlot,
  fragment: string,
  limit: number,
): AssistChoice[] {
  if (slot === "title")
    return recall(fragment, s.memory.titles, limit).map((t) => ({
      label: t.text,
      value: t.text,
      sentence: "title",
    }));
  if (slot === "description")
    return recall(fragment, s.memory.expenses, limit).map((e) => ({
      label: e.text,
      value: e.text,
      sentence: "description",
    }));
  const typed = new Set(s.items.map(memoryKey));
  const pool = s.memory.shopping.filter(
    (x) =>
      !typed.has(memoryKey(x.text)) &&
      (!s.fields.threadId || x.threadId === s.fields.threadId) &&
      // Already on the list: only worth offering when the person is typing it.
      (fragment !== "" || !x.open),
  );
  return recall(fragment, pool, limit).map((x) => ({
    label: x.text,
    value: x.text,
    sentence: "items",
    ...(x.open ? { detail: "On list" } : {}),
  }));
}

/**
 * What the helper talks about: the field being typed when memory can finish
 * it ("remind me to ca" → titles), otherwise the next gap.
 */
export function captureFocus(s: AssistState): { step: CaptureStep; fragment: string } {
  // A new line (or comma) on a list is room for the next item.
  if (s.kind === "shopping" && s.fields.threadId && s.items.length && /(?:\n|,\s*)$/.test(s.text))
    return { step: "items", fragment: "" };
  const typing = typingFragment(s);
  if (
    typing?.fragment &&
    !/\s$/.test(s.text) &&
    memoryCompletions(s, typing.slot, typing.fragment, 1).length > 0
  )
    return { step: SLOT_STEP[typing.slot], fragment: typing.fragment };
  return {
    step: s.step,
    fragment: typing && SLOT_STEP[typing.slot] === s.step ? typing.fragment : "",
  };
}

const ALERTS: AssistChoice[] = [
  { label: "At the time", value: "0" },
  { label: "5 min before", value: "5" },
  { label: "15 min before", value: "15" },
  { label: "No alert", value: "none" },
];
const PRIORITIES = ["low", "normal", "high", "urgent"].map((value) => ({
  label: value[0].toUpperCase() + value.slice(1),
  value,
}));

function whenChoices(s: AssistState): AssistChoice[] {
  const minutes = s.now.getHours() * 60 + s.now.getMinutes();
  if (parseTime(s.text) || s.timeChosen) {
    const [h, m] = (s.fields.time || "12:00").split(":").map(Number);
    const days: AssistChoice[] = [];
    if (h * 60 + m > minutes + 5)
      days.push({ label: "Today", value: "today", sentence: "date" });
    days.push({ label: "Tomorrow", value: "tomorrow", sentence: "date" });
    for (let i = 2; days.length < 4; i++) {
      const name = WEEKDAYS[addDays(s.now, i).getDay()];
      days.push({ label: name, value: `on ${name}`, sentence: "date" });
    }
    return days;
  }
  // Neither day nor time yet: one tap sets both.
  const out: AssistChoice[] = [
    { label: "Tomorrow 9 AM", value: "tomorrow at 9am", sentence: "when" },
  ];
  const evening = [18, 20, 21].find((h) => h * 60 >= minutes + 45);
  if (evening)
    out.push({
      label: `Today ${clockLabel(evening)}`,
      value: `today ${clockPhrase(evening)}`,
      sentence: "when",
    });
  const soon = new Date(s.now.getTime() + 60 * 60_000);
  soon.setMinutes(Math.ceil(soon.getMinutes() / 5) * 5, 0, 0);
  if (formatDate(soon) === formatDate(s.now))
    out.push({
      label: "In 1 hour",
      value: `today ${clockPhrase(soon.getHours(), soon.getMinutes())}`,
      sentence: "when",
    });
  const weekday = s.now.getDay();
  const later =
    weekday >= 1 && weekday <= 4
      ? { name: "Saturday", h: 10 }
      : weekday !== 0
        ? { name: "Monday", h: 9 }
        : null;
  if (later)
    out.push({
      label: `${later.name} ${clockLabel(later.h)}`,
      value: `on ${later.name} ${clockPhrase(later.h)}`,
      sentence: "when",
    });
  return out.slice(0, 4);
}

function timeChoices(s: AssistState): AssistChoice[] {
  const minutes = s.now.getHours() * 60 + s.now.getMinutes();
  const today = s.fields.date === formatDate(s.now);
  const hours = today
    ? [9, 12, 15, 17, 18, 20, 21, 22].filter((h) => h * 60 >= minutes + 30)
    : [9, 12, 18, 20];
  return hours.slice(0, 4).map((h) => ({
    label: clockLabel(h),
    value: clockPhrase(h),
    sentence: "time",
  }));
}

/** Most-used first for this account; the person's own order breaks ties. */
function byUse(
  options: readonly Named[],
  s: AssistState,
  pick: (e: MemoryExpense) => string | null,
): AssistChoice[] {
  const uses = new Map<string, number>();
  for (const e of s.memory.expenses)
    if (e.accountId === s.fields.accountId) {
      const id = pick(e);
      if (id) uses.set(id, (uses.get(id) ?? 0) + e.count);
    }
  return options
    .map((o, i) => ({ o, i, n: uses.get(o.id) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map(({ o }) => ({ label: o.name, value: o.id }));
}

export function captureChoices(
  s: AssistState,
  step: CaptureStep,
  fragment = "",
): AssistChoice[] {
  switch (step) {
    case "title":
      return memoryCompletions(s, "title", fragment, 8);
    case "description":
      return memoryCompletions(s, "description", fragment, 8);
    case "items":
      return memoryCompletions(s, "items", fragment, 8);
    case "date":
      return whenChoices(s);
    case "time":
      return timeChoices(s);
    case "amount": {
      // The usual price of a remembered purchase.
      const usual = recallExpense(s.fields.description ?? "", s.memory.expenses);
      const currency = s.accounts.find((a) => a.id === usual?.accountId)?.currency;
      const phrase = usual && amountPhrase(usual.amount, currency);
      return usual && phrase
        ? [{ label: amountLabel(usual.amount, currency), value: phrase, sentence: "amount" }]
        : [];
    }
    case "accountId":
      return s.accounts.map((a) => ({ label: a.name, value: a.id, detail: a.currency }));
    case "categoryId":
      return byUse(s.parents, s, (e) => e.categoryId);
    case "subcategoryId":
      return byUse(s.children, s, (e) => e.subcategoryId);
    case "threadId": {
      const uses = new Map<string, number>();
      for (const x of s.memory.shopping)
        uses.set(x.threadId, (uses.get(x.threadId) ?? 0) + x.count);
      return [...s.threads]
        .map((t, i) => ({ t, i, n: uses.get(t.id) ?? 0 }))
        .sort((a, b) => b.n - a.n || a.i - b.i)
        .map(({ t }) => ({
          label: t.title || "Shopping",
          value: t.id,
          detail: t.last_message?.content || undefined,
        }));
    }
    case "groupId":
      return [
        { label: "General", value: "" },
        ...s.groups.map((g) => ({ label: g.name, value: g.id })),
      ];
    case "alert":
      return ALERTS;
    case "priority":
      return PRIORITIES;
    default:
      return [];
  }
}

export function captureQuestion(
  kind: CaptureKind,
  step: CaptureStep,
  { more = false }: { more?: boolean } = {},
): string {
  switch (step) {
    case "title":
      return kind === "event" ? "Event?" : "Remind you of?";
    case "date":
      return "When?";
    case "time":
      return "Time?";
    case "amount":
      return "Amount?";
    case "description":
      return "For?";
    case "accountId":
      return "Account?";
    case "categoryId":
      return "Category?";
    case "subcategoryId":
      return "Subcategory?";
    case "threadId":
      return "List?";
    case "groupId":
      return "Group?";
    case "items":
      return more ? "More?" : "Items?";
    case "alert":
      return "Alert?";
    case "priority":
      return "Priority?";
    default:
      return "";
  }
}

/** Remove a typed fragment at the end of the text, tolerant of spacing and case. */
function withoutTail(text: string, fragment: string): string | null {
  const words = memoryKey(fragment).split(" ").filter(Boolean);
  if (!words.length) return null;
  const pattern = words
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^\\p{L}\\p{N}]+");
  const match = new RegExp(`(^|[^\\p{L}\\p{N}])${pattern}[^\\p{L}\\p{N}]*$`, "iu").exec(text);
  return match ? text.slice(0, match.index + match[1].length) : null;
}

/** The sentence after a sentence choice; field choices never touch the text. */
export function applySentenceChoice(
  text: string,
  choice: AssistChoice,
  fragment = "",
): string {
  const slot = choice.sentence;
  if (slot === "date" || slot === "time")
    return completeCaptureText(text, choice.value, slot);
  if (slot === "title" || slot === "description" || slot === "items") {
    // Mid-sentence words read as prose ("remind me to call mom"); list items
    // keep their capital, as they appear on the list.
    const word =
      slot !== "items" && /^[A-Z][a-z]/.test(choice.value)
        ? choice.value.charAt(0).toLowerCase() + choice.value.slice(1)
        : choice.value;
    if (fragment) {
      // Typed "call mo" + "Call mom" keeps the typed words and adds the rest.
      if (memoryKey(choice.value).startsWith(memoryKey(fragment)))
        return completeCaptureText(text, choice.value);
      const head = withoutTail(text, fragment);
      if (head !== null) return `${head}${head.trim() ? word : choice.value} `;
    }
    const trimmed = text.trimEnd();
    if (slot === "items")
      // A list started line by line (or just named) continues line by line.
      return /\n/.test(text) || /shopping(?: list)?\s*:?$/i.test(trimmed)
        ? `${trimmed}\n${choice.value}`
        : `${trimmed}, ${choice.value}`;
    const joiner =
      slot === "description" && !/\b(?:for|on|at)$/i.test(trimmed) ? " for" : "";
    return trimmed ? `${trimmed}${joiner} ${word} ` : `${choice.value} `;
  }
  return completeCaptureText(text, choice.value);
}

const DAY_WORDS = [
  "today",
  "tomorrow",
  "tonight",
  "this weekend",
  "next week",
  ...WEEKDAYS.map((d) => d.toLowerCase()),
];
const LEAD_INS = [
  "remind me to ",
  "add to shopping list ",
  "add an event ",
  "paid ",
  "spent ",
];

export interface Ghost {
  /** Faint text shown after the caret. */
  suffix: string;
  /** The sentence once the completion is accepted. */
  text: string;
}

function ghostFrom(text: string, completed: string): Ghost | null {
  if (!completed.startsWith(text)) return null;
  const suffix = completed.slice(text.length).trimEnd();
  return suffix.trim() ? { suffix, text: completed } : null;
}

/** Before any action is recognised: finish the lead-in ("rem" → "remind me to"). */
export function leadInGhost(text: string): Ghost | null {
  const lower = text.toLowerCase();
  if (lower.trim().length < 3 || lower.includes("\n")) return null;
  const lead = LEAD_INS.find((l) => l.length > lower.length && l.startsWith(lower));
  return lead ? ghostFrom(text, text + lead.slice(lower.length)) : null;
}

/** The single best completion: a remembered field first, then the next gap's top phrase. */
export function captureGhost(s: AssistState): Ghost | null {
  const focus = captureFocus(s);
  const choices = captureChoices(s, focus.step, focus.fragment);
  if (focus.fragment) {
    const best = choices.find((c) =>
      memoryKey(c.value).startsWith(memoryKey(focus.fragment)),
    );
    return best
      ? ghostFrom(s.text, applySentenceChoice(s.text, best, focus.fragment))
      : null;
  }
  if (focus.step !== "date" && focus.step !== "time" && focus.step !== "amount")
    return null;
  const endsOpen = /\s$/.test(s.text);
  const tail = s.text.match(/(\S+)$/)?.[1]?.toLowerCase() ?? "";
  const vocabulary = [
    ...choices.map((c) => c.value),
    ...(focus.step === "date" ? DAY_WORDS : []),
  ];
  // Finish a word being typed ("tom" → "tomorrow"), or offer the top phrase after a space.
  const phrase = endsOpen
    ? choices[0]?.value
    : tail.length > 1
      ? vocabulary.find((v) => v.length > tail.length && v.toLowerCase().startsWith(tail))
      : undefined;
  return phrase ? ghostFrom(s.text, completeCaptureText(s.text, phrase)) : null;
}

const ALERT_LABEL: Record<string, string> = {
  none: "No alert",
  "0": "At time",
};

/** What ERA understood, as short readable parts; most are tappable corrections. */
export function captureTokens(s: AssistState): AssistToken[] {
  const f = s.fields;
  const tokens: AssistToken[] = [];
  // While ERA offers to finish the word being typed, that word is not yet
  // understood; it joins the summary once finished.
  const focus = captureFocus(s);
  const unfinished = focus.fragment ? focus.step : null;
  if (s.kind === "reminder" || s.kind === "event") {
    if (f.title?.trim() && unfinished !== "title")
      tokens.push({ key: "title", label: f.title });
    const typed = eventWhen(s.text, s.now);
    const hasDate = Boolean(typed.date) || s.dateChosen;
    const hasTime = Boolean(typed.time) || s.timeChosen;
    const [h, m] = (f.time ?? "").split(":").map(Number);
    const day = hasDate ? dayLabel(f.date, s.now) : "";
    if (day) tokens.push({ key: "day", label: day, step: "date" });
    if (hasTime && Number.isFinite(h) && Number.isFinite(m))
      tokens.push({
        key: "time",
        label: clockLabel(h, m),
        step: "time",
        ...(day ? { joiner: "at" } : {}),
      });
    // The alert means something once there is a time (or was said outright).
    if (f.alert && ((hasDate && hasTime) || f.alertSpecified === "true"))
      tokens.push({
        key: "alert",
        label: ALERT_LABEL[f.alert] ?? `${f.alert} min before`,
        step: "alert",
        icon: f.alert === "none" ? "silent" : "alert",
      });
    if (f.priority && f.priority !== "normal")
      tokens.push({
        key: "priority",
        label: `${f.priority[0].toUpperCase()}${f.priority.slice(1)}`,
        step: "priority",
        icon: "priority",
      });
    if (f.location) tokens.push({ key: "location", label: f.location, icon: "place" });
    return tokens;
  }
  if (s.kind === "expense") {
    const account = s.accounts.find((a) => a.id === f.accountId);
    const amount = Number(f.amount);
    if (amount > 0) tokens.push({ key: "amount", label: amountLabel(amount, account?.currency) });
    if (f.description?.trim() && unfinished !== "description")
      tokens.push({ key: "description", label: f.description });
    if (account) tokens.push({ key: "account", label: account.name, step: "accountId" });
    const category = s.parents.find((c) => c.id === f.categoryId);
    const sub = s.children.find((c) => c.id === f.subcategoryId);
    if (category)
      tokens.push({
        key: "category",
        label: sub ? `${category.name} › ${sub.name}` : category.name,
        step: "categoryId",
      });
    if (f.date && f.date !== formatDate(s.now))
      tokens.push({ key: "date", label: dayLabel(f.date, s.now) });
    return tokens;
  }
  // Every line is shown, finished or not: each one is what Send would add.
  if (s.items.length)
    tokens.push({
      key: "items",
      label:
        s.items.length <= 3
          ? s.items.join(", ")
          : `${s.items.slice(0, 2).join(", ")} +${s.items.length - 2}`,
    });
  const thread = s.threads.find((t) => t.id === f.threadId);
  if (thread) tokens.push({ key: "list", label: thread.title || "Shopping", step: "threadId" });
  if (thread && s.groups.length)
    tokens.push({
      key: "group",
      label: s.groups.find((g) => g.id === f.groupId)?.name ?? "General",
      step: "groupId",
    });
  return tokens;
}

export interface CaptureMark {
  start: number;
  end: number;
}

function wordSpan(text: string, part: string | undefined): CaptureMark | null {
  const value = part?.trim();
  if (!value) return null;
  const match = new RegExp(
    `(^|[^\\p{L}\\p{N}])${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  ).exec(text);
  if (!match) return null;
  const start = match.index + match[1].length;
  return { start, end: start + value.length };
}

/** The phrases ERA read as data — amount, day, time, place, account — for highlighting. */
export function captureMarks(
  kind: CaptureKind,
  text: string,
  now = new Date(),
  context: { accounts?: ReadonlyArray<Named>; location?: string } = {},
): CaptureMark[] {
  const marks: Array<CaptureMark | null> = [];
  if (kind === "expense") {
    const amount = locateAmount(text) ?? locateAmount(text, { allowBare: true });
    if (amount) marks.push({ start: amount.index, end: amount.index + amount.length });
    const account = context.accounts && mentionedAccount(text, context.accounts);
    if (account) marks.push({ start: account.start, end: account.end });
  } else if (kind === "reminder" || kind === "event") {
    marks.push(wordSpan(text, parseRelativeDate(text, now)?.matched));
    marks.push(wordSpan(text, parseTime(text)?.matched));
    marks.push(wordSpan(text, context.location));
  }
  const sorted = marks
    .filter((m): m is CaptureMark => m !== null && m.end > m.start)
    .sort((a, b) => a.start - b.start);
  return sorted.filter((m, i) => i === 0 || m.start >= sorted[i - 1].end);
}
