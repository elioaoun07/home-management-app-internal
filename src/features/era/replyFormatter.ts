// src/features/era/replyFormatter.ts
// Phase 0.1 canned reply templates. Phase 2 replaces this with Gemini-generated
// natural language. The signature stays stable so the swap is one-file.
//
// Note: Budget face's "draftTransaction" intent is handled directly in
// CommandBar (real save). The fallback reply here is only used if formatReply
// is ever called for that intent outside CommandBar.

import { getFace } from "./faceRegistry";
import type { Intent } from "./types";

const COMING_SOON = "Coming soon — Phase 2 will wire this up.";

export function formatReply(intent: Intent): string {
  switch (intent.kind) {
    case "switchFace": {
      const face = getFace(intent.face);
      return `Switched to ${face.label}. Most actions here are coming soon — Budget can already draft transactions from natural language.`;
    }
    case "draftTransaction": {
      const amt =
        typeof intent.amount === "number"
          ? `$${intent.amount.toFixed(2)}`
          : "an amount";
      return `Drafting ${amt}…`;
    }
    case "draftReminder":
      return `Reminders from ERA — ${COMING_SOON}`;
    case "showAnalytics":
      return `Spending analytics — ${COMING_SOON}`;
    case "unknown":
      return "I didn't catch that. Try asking what's on your schedule today, how much you've spent this month, or tell me something to remember.";

    case "greeting":
      return "Hey! Ask me about your budget, schedule, recipes, or anything to remember.";

    // Phase 0.5 native chatbot — handled by resolveIntent; fallback only
    case "todaySchedule":
      return "Fetching your schedule…";
    case "monthSpend":
      return "Fetching your spending…";
    case "recipeSearch":
      return "Searching your recipes…";
    case "recipeOfferGenerate":
      return "I don't have that recipe — want me to look it up?";
    case "memorySave":
      return "Saving that to memory…";
    case "memoryRecall":
      return "Looking that up…";
  }
}
