// Per-face intent router — Schedule face
import { parseSmartText } from "@/lib/smartTextParser";
import type { FaceKey, Intent } from "../types";

export interface FaceIntentRouter {
  parse(text: string, ctx: { activeFaceKey: FaceKey }): Intent | null;
}

/**
 * Derive the clean reminder title from a raw utterance.
 *
 * The router used to copy the whole sentence into `title`, so "remind me to
 * call the bank tomorrow at 5pm" created an item literally titled
 * "remind me to call the bank tomorrow at 5pm". `parseSmartText` already
 * strips the lead-in phrase ("remind me to…") and the date/time/recurrence
 * components it consumed, which is exactly the title we want. If the parser
 * consumed everything (e.g. "remind me tomorrow"), fall back to the raw text
 * so we never create an untitled item — the API rejects a blank title.
 */
export function reminderTitleFrom(text: string): string {
  const parsed = parseSmartText(text);
  const title = parsed.title?.trim();
  return title && title.length > 0 ? title : text.trim();
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
      return {
        kind: "draftReminder",
        face: "schedule",
        title: reminderTitleFrom(text),
        rawText: text,
      };
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
