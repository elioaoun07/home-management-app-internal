// src/features/era/replyFormatter.ts
// Interstitial + fallback wording for ERA.
//
// Every actionable intent is resolved by resolveIntent + its per-face resolver,
// which owns the real side effect and the real wording. The strings below are
// for callers that format an intent WITHOUT resolving it — the transcript's
// optimistic row, and the in-flight line shown while a resolver is working.
//
// They are pooled and randomized like everything else ERA says (see
// `src/lib/era/phrasing.ts`); a fixed "Fetching your spending…" seen on every
// single query is exactly the tell we're removing.

import { greeting, money, pick, say } from "@/lib/era/phrasing";
import { getFace } from "./faceRegistry";
import type { Intent } from "./types";

/** Slots: {face} */
const SWITCHED_FACE = [
  "Switched to {face}.",
  "{face} it is.",
  "Here's {face}.",
  "Over to {face}.",
  "{face}, coming up.",
] as const;

/** Slots: {amount} */
const DRAFTING = [
  "Drafting {amount}…",
  "Putting {amount} together…",
  "Logging {amount}…",
  "One moment — {amount}…",
] as const;

const SAVING_REMINDER = [
  "Saving that reminder…",
  "Writing that down…",
  "Getting that on your list…",
  "Noting that…",
] as const;

const PULLING_ANALYTICS = [
  "Pulling your analytics…",
  "Crunching the numbers…",
  "Working out the shape of it…",
  "Reading your month…",
] as const;

const FETCHING_SCHEDULE = [
  "Fetching your schedule…",
  "Checking what's on…",
  "Looking at your day…",
  "Pulling up today…",
] as const;

const FETCHING_SPEND = [
  "Fetching your spending…",
  "Adding it up…",
  "Checking the books…",
  "Tallying that…",
] as const;

const SEARCHING_RECIPES = [
  "Searching your recipes…",
  "Digging through the cookbook…",
  "Checking your library…",
  "Having a look…",
] as const;

const SAVING_MEMORY = [
  "Saving that to memory…",
  "Filing that away…",
  "Committing that…",
  "Holding on to that…",
] as const;

const RECALLING_MEMORY = [
  "Looking that up…",
  "Checking my memory…",
  "One second…",
  "Digging that out…",
] as const;

const OFFER_GENERATE = [
  "I don't have that recipe — want me to look it up?",
  "That's not in your library. Shall I find it?",
  "No luck on that one. Want me to fetch it?",
] as const;

const UNKNOWN = [
  "I didn't catch that. Try asking what's on your schedule today, how much you've spent this month, or tell me something to remember.",
  "That one got past me. You could ask what's due today, what you've spent this month, or tell me something to remember.",
  "Not sure what you're after. Try your schedule, your spending, a recipe, or something to remember.",
  "I missed that. Ask me about today, about money, about dinner — or just tell me something to keep.",
  "Didn't quite land. Schedule, budget, recipes, or memory — any of those I can do.",
] as const;

const CLARIFY_AMBIGUOUS = [
  "That could mean a couple of things — budget, schedule, recipes, or a note to keep? Say a bit more and I'll take it from there.",
  "I can read that more than one way. Did you mean money, your schedule, something to cook, or something to remember?",
  "Two or three of my faces just put their hand up. Which did you mean — budget, schedule, kitchen, or memory?",
  "Not sure which way you meant that. Point me at budget, schedule, recipes, or memory and I'll run with it.",
] as const;

const CLARIFY_WEAK = [
  "I'm not quite sure what you'd like to do. Try being a little more specific — how much you spent, what's on today, or a recipe you're after.",
  "That's a bit thin for me to act on. Give me a touch more — an amount, a time, or a dish.",
  "I caught the gist but not the ask. What would you like me to actually do?",
  "Close, but I don't want to guess. Say it a little more directly and I'll handle it.",
] as const;

export function formatReply(intent: Intent): string {
  switch (intent.kind) {
    case "switchFace":
      return say(SWITCHED_FACE, { face: getFace(intent.face).label });
    case "draftTransaction":
      return say(DRAFTING, {
        amount: typeof intent.amount === "number" ? money(intent.amount) : "that",
      });
    case "draftReminder":
      return pick(SAVING_REMINDER);
    case "showAnalytics":
      return pick(PULLING_ANALYTICS);
    case "unknown":
      return pick(UNKNOWN);

    case "greeting":
      return greeting();

    case "clarify":
      return intent.reason === "ambiguous"
        ? pick(CLARIFY_AMBIGUOUS)
        : pick(CLARIFY_WEAK);

    // Phase 0.5 native chatbot — handled by resolveIntent; fallback only
    case "todaySchedule":
      return pick(FETCHING_SCHEDULE);
    case "monthSpend":
      return pick(FETCHING_SPEND);
    case "recipeSearch":
      return pick(SEARCHING_RECIPES);
    case "recipeOfferGenerate":
      return pick(OFFER_GENERATE);
    case "memorySave":
      return pick(SAVING_MEMORY);
    case "memoryRecall":
      return pick(RECALLING_MEMORY);
  }
}
