// src/lib/era/captureMemory.ts
// HUB-113 — what ERA remembers about how this household words its three
// everyday captures: spends, reminders/events and shopping items.
//
// `GET /api/era/capture-memory` folds the person's own recent history into
// this compact shape (aggregate* below); the composer recalls from it to
// finish a sentence the way the person usually finishes it and to pre-fill
// the account, category or shopping group they used last time. Pure and
// read-only: nothing here writes, and an empty memory only means fewer
// suggestions.

import { locateAmount } from "@/lib/nlp/amount";

export interface MemoryExpense {
  text: string;
  count: number;
  /** yyyy-MM-dd of the latest use. */
  last: string;
  /** Latest amount, in the account's native currency. */
  amount: number;
  accountId: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
}

export interface MemoryTitle {
  text: string;
  count: number;
  last: string;
  type: "reminder" | "event";
}

export interface MemoryShopping {
  text: string;
  count: number;
  last: string;
  threadId: string;
  groupId: string | null;
  /** Still unchecked on the list. */
  open: boolean;
}

export interface CaptureMemory {
  expenses: MemoryExpense[];
  titles: MemoryTitle[];
  shopping: MemoryShopping[];
}

export const EMPTY_CAPTURE_MEMORY: CaptureMemory = {
  expenses: [],
  titles: [],
  shopping: [],
};

/** Case-, accent- and punctuation-free comparison key; keeps Arabic letters. */
export function memoryKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const SPEND_LEAD_RE =
  /^(?:(?:i|we)\s+)?(?:just\s+)?(?:paid|spent|bought|pay|spend|buy)\b\s*/i;
const EXPENSE_COMMAND_RE =
  /^(?:log|add|record)\s+(?:an?\s+)?expense\b\s*(?:of\s+)?/i;
/** The relative dates the spend parser reads; they are when, not what. */
const SPEND_DATE_RE =
  /\b(?:yesterday|today|tonight|this\s+morning|last\s+(?:week|month|business\s+day|working\s+day|(?:mon|tues|wednes|thurs|fri|satur|sun)day)|(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\s+ago)\b/gi;

/**
 * "I paid $5 for coffee yesterday" → "Coffee". The amount, the spend verb,
 * relative dates and dangling connectors are bookkeeping, not the purchase.
 * `allowBare` also removes an unmarked number ("coffee 4" → "Coffee").
 */
export function cleanExpenseDescription(
  text: string,
  opts: { allowBare?: boolean } = {},
): string {
  let t = text.trim();
  const amount =
    locateAmount(t) ?? (opts.allowBare ? locateAmount(t, { allowBare: true }) : undefined);
  if (amount)
    t = `${t.slice(0, amount.index)} ${t.slice(amount.index + amount.length)}`;
  t = t
    .replace(SPEND_DATE_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(EXPENSE_COMMAND_RE, "")
    .replace(SPEND_LEAD_RE, "")
    .replace(/^(?:for|on|at)\b\s*/i, "")
    .replace(/(?:\s+(?:for|on|at|from|with))+\s*$/i, "")
    .replace(/^[\s,;:.!-]+|[\s,;:.!-]+$/g, "");
  return cap(t);
}

type Ranked = { count: number; last: string };
const byUse = (a: Ranked, b: Ranked) =>
  b.count - a.count || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0);

/** Own spends, most recent first → one entry per description with its usual target. */
export function aggregateExpenses(
  rows: ReadonlyArray<{
    description: string | null;
    amount: number | string;
    account_id: string;
    category_id: string | null;
    subcategory_id: string | null;
    category_name?: string | null;
    subcategory_name?: string | null;
    date: string;
  }>,
  limit = 150,
): MemoryExpense[] {
  // Rows arrive most recent first, so the first combo seen is the latest use.
  const byKey = new Map<
    string,
    { count: number; latest: MemoryExpense; combos: Map<string, MemoryExpense> }
  >();
  for (const row of rows) {
    const text = cleanExpenseDescription(row.description ?? "");
    const key = memoryKey(text);
    if (!key || text.length > 60 || !/\p{L}/u.test(text)) continue;
    const comboKey = `${row.account_id}|${row.category_id ?? ""}|${row.subcategory_id ?? ""}`;
    const fresh: MemoryExpense = {
      text,
      count: 1,
      last: row.date,
      amount: Math.abs(Number(row.amount)) || 0,
      accountId: row.account_id,
      categoryId: row.category_id,
      categoryName: row.category_name ?? null,
      subcategoryId: row.subcategory_id,
      subcategoryName: row.subcategory_name ?? null,
    };
    const entry = byKey.get(key);
    if (!entry) {
      byKey.set(key, { count: 1, latest: fresh, combos: new Map([[comboKey, fresh]]) });
      continue;
    }
    entry.count++;
    const combo = entry.combos.get(comboKey);
    if (combo) combo.count++;
    else entry.combos.set(comboKey, fresh);
  }
  const out: MemoryExpense[] = [];
  for (const { count, latest, combos } of byKey.values()) {
    // The usual target wins; Map order breaks a tie toward the most recent.
    let best = latest;
    for (const combo of combos.values()) if (combo.count > best.count) best = combo;
    out.push({ ...best, text: latest.text, last: latest.last, count });
  }
  return out.sort(byUse).slice(0, limit);
}

/** Own reminder/event titles, most recent first. */
export function aggregateTitles(
  rows: ReadonlyArray<{ title: string | null; type: string; created_at: string }>,
  limit = 150,
): MemoryTitle[] {
  const byKey = new Map<string, MemoryTitle & { events: number }>();
  for (const row of rows) {
    const text = (row.title ?? "").trim().replace(/\s+/g, " ");
    const key = memoryKey(text);
    if (!key || text.length > 80) continue;
    if (row.type !== "reminder" && row.type !== "event") continue;
    const entry = byKey.get(key);
    if (entry) {
      entry.count++;
      if (row.type === "event") entry.events++;
    } else
      byKey.set(key, {
        text: cap(text),
        count: 1,
        last: row.created_at,
        type: "reminder",
        events: row.type === "event" ? 1 : 0,
      });
  }
  return [...byKey.values()]
    .map(({ events, ...title }) => ({
      ...title,
      type: events * 2 > title.count ? ("event" as const) : ("reminder" as const),
    }))
    .sort(byUse)
    .slice(0, limit);
}

/** Shopping-list rows (checked and cleared ones too), most recent first. */
export function aggregateShopping(
  rows: ReadonlyArray<{
    content: string | null;
    thread_id: string;
    shopping_group_id: string | null;
    archived_at: string | null;
    checked_at: string | null;
    created_at: string;
  }>,
  limit = 250,
): MemoryShopping[] {
  const byKey = new Map<string, MemoryShopping>();
  for (const row of rows) {
    const text = (row.content ?? "").trim();
    const key = memoryKey(text);
    if (!key || text.length > 60 || /[\r\n]|https?:\/\//i.test(text)) continue;
    const open = !row.archived_at && !row.checked_at;
    const entry = byKey.get(key);
    if (entry) {
      entry.count++;
      if (row.thread_id !== entry.threadId) continue;
      if (open) entry.open = true;
      if (!entry.groupId) entry.groupId = row.shopping_group_id;
    } else
      byKey.set(key, {
        text: cap(text),
        count: 1,
        last: row.created_at,
        threadId: row.thread_id,
        groupId: row.shopping_group_id,
        open,
      });
  }
  return [...byKey.values()].sort(byUse).slice(0, limit);
}

type Recallable = { text: string; count: number; last: string };

/**
 * Remembered entries the typed fragment could become, best first: whole-text
 * prefix matches ("ca" → "Call mom"), then word-prefix matches ("mom" →
 * "Call mom"). An empty fragment returns the most used. Exact matches are
 * already written, so they are not suggestions.
 */
export function recall<T extends Recallable>(
  fragment: string,
  entries: readonly T[],
  limit = 4,
): T[] {
  const f = memoryKey(fragment);
  if (!f) return [...entries].sort(byUse).slice(0, limit);
  const starts: T[] = [];
  const words: T[] = [];
  for (const entry of entries) {
    const key = memoryKey(entry.text);
    if (key === f) continue;
    if (key.startsWith(f)) starts.push(entry);
    else if (f.length >= 2 && ` ${key}`.includes(` ${f}`)) words.push(entry);
  }
  return [...starts.sort(byUse), ...words.sort(byUse)].slice(0, limit);
}

/** The usual target of a spend described like this, if the person has made it before. */
export function recallExpense(
  description: string,
  expenses: readonly MemoryExpense[],
): MemoryExpense | null {
  const key = memoryKey(description);
  if (key.length < 3) return null;
  const exact = expenses.find((e) => memoryKey(e.text) === key);
  if (exact) return exact;
  // A remembered description inside a longer one: "coffee with Sara" → Coffee.
  return (
    expenses
      .filter((e) => {
        const k = memoryKey(e.text);
        return k.length >= 3 && ` ${key} `.includes(` ${k} `);
      })
      .sort((a, b) => memoryKey(b.text).length - memoryKey(a.text).length || byUse(a, b))[0] ??
    null
  );
}

/** The list these items usually go to: item votes first, then overall use. */
export function preferredThread(
  threadIds: readonly string[],
  items: readonly string[],
  shopping: readonly MemoryShopping[],
): string | null {
  const allowed = new Set(threadIds);
  const tally = (rows: readonly MemoryShopping[]) => {
    const votes = new Map<string, number>();
    for (const row of rows)
      if (allowed.has(row.threadId))
        votes.set(row.threadId, (votes.get(row.threadId) ?? 0) + row.count);
    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    return ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1])
      ? ranked[0][0]
      : null;
  };
  const keys = new Set(items.map(memoryKey));
  return tally(shopping.filter((s) => keys.has(memoryKey(s.text)))) ?? tally(shopping);
}

/** The group these items were filed under last time in this list, when they agree. */
export function recallGroup(
  items: readonly string[],
  threadId: string,
  shopping: readonly MemoryShopping[],
): string | null {
  const votes = new Map<string, number>();
  for (const item of items) {
    const key = memoryKey(item);
    const hit = shopping.find(
      (s) => s.threadId === threadId && memoryKey(s.text) === key,
    );
    if (hit?.groupId) votes.set(hit.groupId, (votes.get(hit.groupId) ?? 0) + 1);
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || (ranked.length > 1 && ranked[0][1] === ranked[1][1]))
    return null;
  return ranked[0][0];
}
