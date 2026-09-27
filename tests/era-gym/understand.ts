// tests/era-gym/understand.ts
// HUB-77 path C — a MEASUREMENT PROTOTYPE of plan §4 component 4
// ("Understand"): one structured model call over a catalog of what ERA can
// execute TODAY, plus meta tools (answer, clarify, navigate, no_action).
// Small domains go in as candidate handles (a1, a2 …) that are mapped back
// server-side; the model never sees or invents a real id.
//
// Dev/test only. It is not wired into the app: HUB-78 builds the real
// component if the §7 decision rule adopts route C.

import { Type, type Schema } from "@google/genai";

export interface GymAccount {
  handle: string;
  name: string;
  currency: string;
  owner: "owner" | "partner";
  isDefault?: boolean;
}

/** The fake household every Gym case runs against. */
export const HOUSEHOLD = {
  accounts: [
    { handle: "a1", name: "Wallet", currency: "USD", owner: "owner", isDefault: true },
    { handle: "a2", name: "Drawer", currency: "USD", owner: "owner" },
    { handle: "a3", name: "Savings", currency: "USD", owner: "owner" },
    { handle: "a4", name: "Cash LBP", currency: "LBP", owner: "owner" },
    { handle: "a5", name: "Rita's Card", currency: "USD", owner: "partner" },
  ] satisfies GymAccount[],
  people: ["Rita (partner)", "Karim", "John", "Mama"],
  /** Shopping groups in the household list (HUB-84). */
  shoppingGroups: [
    { id: "g-spinneys", name: "Spinneys" },
    { id: "g-pharmacy", name: "Pharmacy" },
  ],
  /** Recurring commitments + this period's transactions (HUB-79 recurring.cover). */
  recurring: [
    { id: "rp-rent", user_id: "owner-id", name: "Rent", amount: 500, account_id: "a1", category_id: null, subcategory_id: null,
      next_due_date: "2026-10-01", last_processed_date: "2026-09-01", is_active: true },
    { id: "rp-internet", user_id: "owner-id", name: "Internet", amount: 35, account_id: "a1", category_id: null, subcategory_id: null,
      next_due_date: "2026-09-30", last_processed_date: "2026-08-30", is_active: true },
  ],
  transactions: [{ id: "tx-internet", amount: 35, date: "2026-09-20", user_id: "owner-id", is_draft: false }],
  /** Open reminders for the by-name lookup (HUB-78). */
  reminders: [
    { id: "rem-dentist", title: "Dentist", owner: "owner", rrule: null },
    { id: "rem-laundry", title: "Laundry", owner: "owner", rrule: null },
    { id: "rem-test", title: "Test", owner: "owner", rrule: null },
    { id: "rem-gym", title: "Gym class", owner: "owner", rrule: "FREQ=WEEKLY;BYDAY=MO" },
    { id: "rem-water-1", title: "Water the plants", owner: "owner", rrule: null },
    { id: "rem-water-2", title: "Water the garden", owner: "owner", rrule: null },
    { id: "rem-kids", title: "Pick up the kids", owner: "partner", rrule: null },
  ],
  recipes: ["Lasagna", "Chicken curry", "Tabbouleh"],
  pages: ["/expense", "/dashboard", "/recurring", "/reminders", "/chat", "/catalogue", "/trips", "/healthcare", "/outfits", "/meal-plan"],
};

/** Tools = what ERA can execute today (native intents + registry) + meta. */
export const TOOLS: Array<{ id: string; args: string; note?: string }> = [
  { id: "transaction.draft", args: 'amount (number), currency ("USD"|"LBP"|"EUR", only if said), note', note: "a spend the user already made" },
  { id: "transfer.create", args: "amount (number), from (account handle), to (account handle)", note: "between the user's OWN accounts only" },
  { id: "debt.record", args: "debtor (name), amount (number)", note: "someone owes the user money (USD)" },
  { id: "draft.list", args: "(none)" },
  { id: "draft.confirm", args: "hint (optional)" },
  { id: "spend.month", args: 'scope ("self"|"partner"|"household"), categoryHint (optional)' },
  { id: "analytics.show", args: "(none)" },
  { id: "reminder.create", args: "title, when (free text, optional)" },
  { id: "reminder.reschedule", args: 'target ("FOCUS" or the reminder title), when (free text)' },
  { id: "reminder.complete", args: 'target ("FOCUS" or title)' },
  { id: "reminder.delete", args: 'target ("FOCUS" or title)' },
  { id: "schedule.forDay", args: "day (free text, optional)" },
  { id: "recipe.search", args: "dish" },
  { id: "recipe.list", args: "(none)" },
  { id: "meal.assign", args: "dish, day, meal" },
  { id: "meal.gaps", args: "(none)" },
  { id: "memory.save", args: "label, value" },
  { id: "memory.recall", args: "query" },
  { id: "answer", args: "(none — put the answer in say)", note: "a question you can answer, or an honest 'can't do that'" },
  { id: "clarify", args: "missing (which field), options (array of short choices)", note: "ONE question when a required field is missing or ambiguous" },
  { id: "navigate", args: `to (one of ${HOUSEHOLD.pages.join(", ")})`, note: "no tool fits, but a page does" },
  { id: "no_action", args: "(none)", note: "the user said NOT to do something, or nothing is being asked" },
];

export const UNDERSTAND_SCHEMA: Schema = {
  type: Type.OBJECT,
  propertyOrdering: ["tool", "argsJson", "say"],
  required: ["tool", "argsJson", "say"],
  properties: {
    tool: { type: Type.STRING, enum: TOOLS.map((t) => t.id) },
    argsJson: { type: Type.STRING, description: "The tool's args as a JSON object encoded in a string, e.g. '{\"amount\":12}'. '{}' when none." },
    say: { type: Type.STRING, description: "One short line ERA shows. No explanations." },
  },
};

export function buildUnderstandPrompt(args: {
  face: string;
  clock: string;
  timezone: string;
  actor: string;
  focus: Array<{ title: string }>;
  routerHint: string | null;
}): string {
  const lines = [
    "You are ERA's understanding step for one household (Lebanon; English, Arabic and Franco-Arabic; amounts like 12$ or 500k = 500,000).",
    "Pick exactly ONE tool. You never write anything yourself — the app validates and confirms.",
    "Rules:",
    "- Negated requests (don't…, never…) → no_action. Hypotheticals, questions about whether to do something, and reported speech (\"Rita said…\") are NOT commands → answer or no_action.",
    "- Never guess an account, person or reminder. If a required field is missing → clarify.",
    "- A count is not a price (\"bought 2 shirts\"). Income is not a spend. Never move money out of the partner's accounts.",
    "- Use only the account handles listed. Never invent handles or ids.",
    `Face: ${args.face}. Now: ${args.clock} (${args.timezone}). Speaker: ${args.actor}.`,
    "",
    "Accounts (handle | name | currency | owner):",
    ...HOUSEHOLD.accounts.map((a) => `- ${a.handle} | ${a.name} | ${a.currency} | ${a.owner}${a.isDefault ? " | default" : ""}`),
    `People: ${HOUSEHOLD.people.join(", ")}. Recipes: ${HOUSEHOLD.recipes.join(", ")}.`,
    args.focus.length ? `Focus reminder (for it/that): "${args.focus[0].title}" → use target "FOCUS".` : "No focus reminder.",
    args.routerHint ? `Fast-path hint (weak, may be wrong): ${args.routerHint}` : "",
    "",
    "Tools (id — args — when):",
    ...TOOLS.map((t) => `- ${t.id} — ${t.args}${t.note ? ` — ${t.note}` : ""}`),
  ];
  return lines.filter((l) => l !== "").join("\n");
}
