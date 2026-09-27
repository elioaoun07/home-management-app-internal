// src/features/era/reach.ts
// HUB-81 — ERA's reach across every Feature Index module (plan §7 "reach is
// reported per module at four levels"). One row per module; the matrix in the
// vault is GENERATED from this list (reach.test.ts), never hand-edited.
//
// Levels: navigation (ERA opens the right page) · prefill (the form opens
// with resolved fields) · inline (ERA finishes it; capability ids listed) ·
// verified (Gym-covered final state). Page context is a ranking signal only
// and never decides an intent (plan §4).

export interface ReachRow {
  /** Exactly the Feature Index module name. */
  module: string;
  /** Page ERA opens; null = no user-facing page (reason given). */
  route: string | null;
  label: string;
  /** Words that name the module after an explicit "open / go to". */
  words: string[];
  prefill: boolean;
  inline: string[];
  /** Covered by an ERA Gym final-state case. */
  verified: boolean;
  note?: string;
}

export const ERA_REACH: ReachRow[] = [
  { module: "Accounts & Balance", route: "/dashboard", label: "Accounts", words: ["accounts", "account", "balances"], prefill: false, inline: ["balance.read"], verified: true },
  { module: "Transactions", route: "/expense", label: "Expense", words: ["expense", "expenses form", "add expense"], prefill: true, inline: ["transaction.draft"], verified: true },
  { module: "Categories", route: "/expense", label: "Categories", words: ["categories"], prefill: false, inline: [], verified: false },
  { module: "Recurring Payments", route: "/recurring", label: "Recurring", words: ["recurring", "bills", "subscriptions"], prefill: true, inline: ["recurring.cover"], verified: true },
  { module: "Recipes", route: "/recipe", label: "Recipes", words: ["recipes", "recipe book"], prefill: false, inline: ["recipe.search", "recipe.list"], verified: true },
  { module: "Meal Planning", route: "/meal-plan", label: "Meal plan", words: ["meal plan", "meals", "menu"], prefill: false, inline: ["meal.assign", "meal.gaps"], verified: true },
  { module: "Inventory", route: "/catalogue", label: "Inventory", words: ["inventory", "pantry", "stock"], prefill: false, inline: [], verified: false },
  { module: "Debts", route: "/expense", label: "Debts", words: ["debts", "who owes"], prefill: false, inline: ["debt.record"], verified: true, note: "Settle waits on BUD-68." },
  { module: "Catalogue", route: "/catalogue", label: "Catalogue", words: ["catalogue", "catalog", "wishlist", "wish list"], prefill: false, inline: [], verified: false, note: "Search waits on HUB-69 (KIT-20/22)." },
  { module: "Future Purchases", route: "/dashboard", label: "Future purchases", words: ["future purchases", "planned purchases"], prefill: false, inline: ["purchases.read"], verified: false },
  { module: "Budget Allocation", route: "/dashboard", label: "Budget", words: ["budget allocation", "envelopes"], prefill: false, inline: ["spend.month"], verified: true },
  { module: "Preferences (LBP, theme)", route: "/settings", label: "Settings", words: ["settings", "preferences", "theme"], prefill: false, inline: [], verified: false },
  { module: "Statement Import", route: "/statement-import", label: "Statement import", words: ["statement import", "import statement", "statements"], prefill: false, inline: [], verified: false },
  { module: "Transfers", route: "/expense", label: "Transfers", words: ["transfers"], prefill: true, inline: ["transfer.create"], verified: true },
  { module: "Hub Chat", route: "/chat", label: "Chat", words: ["chat", "hub", "messages"], prefill: false, inline: [], verified: false },
  { module: "Shopping List", route: "/chat", label: "Shopping list", words: ["shopping list", "grocery list", "groceries"], prefill: false, inline: ["shopping.add"], verified: true },
  { module: "Message Actions", route: "/chat", label: "Chat", words: [], prefill: false, inline: [], verified: false, note: "Reached through Hub Chat." },
  { module: "Items / Reminders", route: "/reminders", label: "Reminders", words: ["reminders", "schedule", "calendar", "tasks"], prefill: false, inline: ["reminder.create", "reminder.reschedule", "reminder.complete", "reminder.delete", "reminder.skip", "schedule.forDay"], verified: true },
  { module: "AI Assistant", route: "/era", label: "ERA", words: ["era", "assistant"], prefill: false, inline: [], verified: true },
  { module: "Notifications", route: "/alerts", label: "Alerts", words: ["alerts", "notifications"], prefill: false, inline: [], verified: false },
  { module: "Household Sharing", route: "/settings", label: "Household", words: ["household"], prefill: false, inline: [], verified: false },
  { module: "Analytics", route: "/dashboard", label: "Analytics", words: ["analytics", "dashboard", "reports"], prefill: false, inline: ["analytics.show", "spend.month", "spend.day"], verified: true },
  { module: "Drafts", route: "/expense/drafts", label: "Drafts", words: ["drafts"], prefill: false, inline: ["draft.list", "draft.confirm"], verified: true },
  { module: "Watch UI", route: "/watch", label: "Watch", words: ["watch view"], prefill: false, inline: [], verified: false },
  { module: "Guest Portal", route: null, label: "Guest portal", words: [], prefill: false, inline: [], verified: false, note: "Guest-only surface behind an NFC slug; not an owner page." },
  { module: "Sync & Offline", route: null, label: "Sync", words: [], prefill: false, inline: [], verified: false, note: "Background system; no page to open." },
  { module: "Error Logs", route: "/error-logs", label: "Error logs", words: ["error logs", "errors"], prefill: false, inline: [], verified: false },
  { module: "NFC Tags", route: "/nfc", label: "NFC", words: ["nfc", "tags"], prefill: false, inline: [], verified: false },
  { module: "Prerequisites", route: "/reminders", label: "Reminders", words: [], prefill: false, inline: [], verified: false, note: "Set on an item inside Reminders." },
  { module: "Chores", route: "/reminders?tab=chores", label: "Chores", words: ["chores", "chore"], prefill: false, inline: [], verified: false },
  { module: "Focus", route: "/reminders?tab=focus", label: "Focus", words: ["focus"], prefill: false, inline: [], verified: false },
  { module: "Trips", route: "/trips", label: "Trips", words: ["trips", "trip", "travel"], prefill: false, inline: [], verified: false, note: "Reads wait on TRIP-1–3." },
  { module: "Dashboard", route: "/dashboard", label: "Dashboard", words: ["dashboard", "home"], prefill: false, inline: [], verified: false },
  { module: "Recycle Bin", route: "/recycle-bin", label: "Recycle bin", words: ["recycle bin", "trash", "deleted"], prefill: false, inline: [], verified: false },
  { module: "Plan My Day", route: "/today", label: "Plan my day", words: ["plan my day", "day plan", "today plan"], prefill: false, inline: [], verified: false },
  { module: "Healthcare", route: "/healthcare", label: "Healthcare", words: ["healthcare", "health", "medications", "meds"], prefill: false, inline: [], verified: false, note: "Dose log waits on HLTH-19/25." },
  { module: "Outfits", route: "/outfits", label: "Outfits", words: ["outfits", "wardrobe", "closet"], prefill: false, inline: [], verified: false },
  { module: "Activity Log", route: "/activity-log", label: "Activity", words: ["activity", "activity log", "history"], prefill: false, inline: ["activity.read"], verified: false, note: "Needs HUB-72's owner SQL." },
];

const NAV_VERB = /^\s*(?:please\s+)?(?:open|go\s+to|take\s+me\s+to|launch|bring\s+up|show\s+me)\s+(?:the\s+|my\s+)?(.+?)[\s.!?]*$/i;

/** "open trips" → Trips. Longest matching word wins; null when nothing matches. */
export function explicitNavTarget(text: string): ReachRow | null {
  const m = text.match(NAV_VERB);
  if (!m) return null;
  const said = m[1].toLowerCase().replace(/\s+(?:page|screen|tab)$/, "");
  let best: { row: ReachRow; len: number } | null = null;
  for (const row of ERA_REACH) {
    if (!row.route) continue;
    for (const w of row.words) {
      if (said === w || said.startsWith(`${w} `) || said.endsWith(` ${w}`)) {
        if (!best || w.length > best.len) best = { row, len: w.length };
      }
    }
  }
  return best?.row ?? null;
}

/**
 * Implicit doors from real usage (owner export + synthetic corpus) — only
 * consulted after every router missed, so they never steal a real intent.
 */
const IMPLICIT: Array<{ re: RegExp; module: string }> = [
  { re: /\bwhat\s+(?:should|do|can)\s+i\s+wear\b|\boutfit\b/i, module: "Outfits" },
  { re: /\b(?:we(?:'re|\s+are)|i(?:'m|\s+am))\s+(?:going|flying|travell?ing)\s+to\s+[A-Z]/, module: "Trips" },
  { re: /\bwish\s?list\b/i, module: "Catalogue" },
  { re: /\b(?:vitamin|pill|pills|medication|meds|dose|doses)\b/i, module: "Healthcare" },
  { re: /\b(?:chores?|dishes|laundry\s+duty)\b/i, module: "Chores" },
  { re: /\bpantry\b|\bdo\s+we\s+have\b/i, module: "Inventory" },
];

export function implicitNavTarget(text: string): ReachRow | null {
  const hit = IMPLICIT.find((i) => i.re.test(text));
  return hit ? (ERA_REACH.find((r) => r.module === hit.module) ?? null) : null;
}

export function renderReachMatrix(): string {
  const yes = (b: boolean) => (b ? "✓" : "–");
  const rows = ERA_REACH.map(
    (r) =>
      `| ${r.module} | ${r.route ? `${yes(true)} \`${r.route}\`` : "n/a"} | ${yes(r.prefill)} | ${r.inline.length ? r.inline.join(", ") : "–"} | ${yes(r.verified)} | ${r.note ?? ""} |`,
  );
  return [
    "| Module | Navigation | Useful prefill | Inline | Verified (Gym) | Note |",
    "|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}
