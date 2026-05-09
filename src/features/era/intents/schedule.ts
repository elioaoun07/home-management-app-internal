// Per-face intent router — Schedule face
import type { FaceKey, Intent } from "../types";

export interface FaceIntentRouter {
  parse(text: string, ctx: { activeFaceKey: FaceKey }): Intent | null;
}

export const scheduleRouter: FaceIntentRouter = {
  parse(text) {
    const lo = text.toLowerCase();

    // "What do I have to do today", "What's on my schedule", "What's due today"
    if (
      /\b(today|schedule|due|on my list|this week|upcoming|overdue)\b/.test(lo) &&
      /\b(what|show|tell|list|get|have|do i|i have|got)\b/.test(lo)
    ) {
      return { kind: "todaySchedule", face: "schedule", rawText: text };
    }

    // "What do I have to do today" edge cases
    if (/what.*have.*today|today.*what.*have|show.*today|today.*items/.test(lo)) {
      return { kind: "todaySchedule", face: "schedule", rawText: text };
    }

    // Reminder draft — "remind me about X"
    if (/\bremind\b|\bremember to\b/i.test(text)) {
      return { kind: "draftReminder", face: "schedule", title: text, rawText: text };
    }

    // Generic schedule face switch
    if (
      /\b(task|todo|to-do|deadline|appointment|event|meeting|calendar)\b/i.test(text)
    ) {
      return { kind: "switchFace", face: "schedule", rawText: text };
    }

    return null;
  },
};
