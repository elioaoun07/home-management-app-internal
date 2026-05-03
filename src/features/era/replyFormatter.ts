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
      return "I didn't catch that. Try \"I paid $25 for car fuel\" — that's the only ERA action wired today. Everything else is coming soon.";
  }
}
