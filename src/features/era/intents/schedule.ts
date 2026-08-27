// Per-face intent router — Schedule face
import { parseSmartText } from "@/lib/smartTextParser";
import { resolveFocusRef } from "../focusMemory";
import type { FaceKey, Intent } from "../types";
import { useEraStore } from "../useEraStore";

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

/**
 * Pull a specific target day out of a schedule query, e.g. "Saturday" in
 * "what's on my schedule Saturday" — reuses `parseSmartText`'s date parsing
 * (day-of-week, "tomorrow", explicit dates, …) instead of a second parser.
 * `undefined` means no day was named — the resolver defaults to today.
 */
function scheduleDateISO(text: string): string | undefined {
  const parsed = parseSmartText(text);
  if (parsed.confidence.date === 0) return undefined;
  // parseSmartText's type detector reads "schedule" as an event noun, which
  // routes the parsed date into startDate rather than dueDate — a schedule
  // QUERY isn't creating either, so fall back to whichever one it filled.
  return parsed.dueDate ?? parsed.startDate;
}

export const scheduleRouter: FaceIntentRouter = {
  parse(text) {
    const lo = text.toLowerCase();

    // "What do I have to do today", "What's on my schedule", "What's due today"
    if (
      /\b(today|schedule|due|on my list|this week|upcoming|overdue)\b/.test(lo) &&
      /\b(what|show|tell|list|get|have|do i|i have|got)\b/.test(lo)
    ) {
      return {
        kind: "todaySchedule",
        face: "schedule",
        rawText: text,
        dateISO: scheduleDateISO(text),
      };
    }

    // "What do I have to do today" edge cases
    if (/what.*have.*today|today.*what.*have|show.*today|today.*items/.test(lo)) {
      return {
        kind: "todaySchedule",
        face: "schedule",
        rawText: text,
        dateISO: scheduleDateISO(text),
      };
    }

    // Stage 1 focus-memory follow-ups. Deliberately pronoun-gated
    // (it/that/this/that one/this one) rather than matched on the verb
    // alone — "move" also means transfer money or move a meal, so the
    // pronoun is what scopes these to "the thing we were just talking
    // about" and keeps them from colliding with those other faces'
    // vocabulary (see types.ts's Stage 1 comment).
    //
    // `resolveFocusRef` is called with the literal "it" below rather than
    // the actual matched word — every supported pronoun resolves the same
    // way (most recent live "reminder"), so which one was said doesn't
    // change the outcome.
    const rescheduleMatch = text.match(
      /\b(?:change|move|push|reschedule|shift)\b[\s\S]*?\b(?:it|that|this(?:\s+one)?)\b\s+(?:back\s+)?to\s+(.+?)[\s.!?]*$/i,
    );
    if (rescheduleMatch) {
      const focus = resolveFocusRef(
        "it",
        "reminder",
        useEraStore.getState().focusEntities,
      );
      return {
        kind: "reminderReschedule",
        face: "schedule",
        itemId: focus?.id ?? null,
        title: focus?.title ?? null,
        whenText: rescheduleMatch[1].trim(),
        rawText: text,
      };
    }

    if (
      /\b(?:mark|complete|finish(?:ed)?)\b[\s\S]*?\b(?:it|that|this(?:\s+one)?)\b/i.test(
        text,
      ) ||
      /\bdone\s+with\s+(?:it|that|this(?:\s+one)?)\b/i.test(text)
    ) {
      const focus = resolveFocusRef(
        "it",
        "reminder",
        useEraStore.getState().focusEntities,
      );
      return {
        kind: "reminderComplete",
        face: "schedule",
        itemId: focus?.id ?? null,
        title: focus?.title ?? null,
        rawText: text,
      };
    }

    if (
      /\b(?:delete|remove|cancel)\b[\s\S]*?\b(?:it|that|this(?:\s+one)?)\b/i.test(
        text,
      )
    ) {
      const focus = resolveFocusRef(
        "it",
        "reminder",
        useEraStore.getState().focusEntities,
      );
      return {
        kind: "reminderDelete",
        face: "schedule",
        itemId: focus?.id ?? null,
        title: focus?.title ?? null,
        rawText: text,
      };
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

    // Generic schedule face switch — includes the bare word "schedule"
    // itself (previously missing: typing just "Schedule" matched nothing
    // here and fell all the way through to "unknown").
    if (
      /\b(task|todo|to-do|deadline|appointment|event|meeting|calendar|schedule)\b/i.test(text)
    ) {
      return { kind: "switchFace", face: "schedule", rawText: text };
    }

    return null;
  },
};
