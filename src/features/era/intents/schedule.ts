// Per-face intent router — Schedule face
import { parseSmartText } from "@/lib/smartTextParser";
import { resolveEntityRef, resolveFocusRef } from "../focusMemory";
import type { FaceKey, Intent } from "../types";
import { useEraStore } from "../useEraStore";

export interface FaceIntentRouter {
  parse(text: string, ctx: { activeFaceKey: FaceKey }): Intent | null;
}

/**
 * Vocabulary owned by Budget / Chef. Several of the patterns below are
 * otherwise-unbounded string captures (schedule query gates, named-target
 * follow-ups) whose only prior guard was `resolveEntityRef` returning null
 * — RUNTIME STATE (it only "works" when focus memory happens to be empty),
 * not a lexical guard. A reminder titled "Savings plan" in focus made "move
 * $100 to savings" a reschedule. Applied to every schedule pattern with
 * real collision risk: the query gates, the query-opener day pattern, and
 * the three named-target follow-ups. Pronoun follow-ups ("change it to
 * 11") are NOT gated by this — a pronoun is already a strong signal of
 * schedule context.
 */
const OTHER_FACE_RE =
  /\$|€|£|\b(?:usd|lbp|dollars?|bucks?|account|accounts|balance|transfer|savings|wallet|draft|drafts|expense|expenses|transaction|transactions|owes?|spend|spent|spending|pay|paid|budget|income|cost|costs|recipe|recipes|meal|meals|menu|dish|dishes|snack|cook|cooking|bake|baking|dinner|lunch|breakfast|reservation|reservations)\b/i;

/**
 * A question opener that, PAIRED WITH an actual date `parseSmartText`
 * found, is unambiguous schedule-query intent — "anything Saturday?", "am
 * I free tomorrow?" — without needing one of the fixed nouns in the gates
 * below.
 */
const QUERY_OPENER_RE =
  /^(?:so\s+)?(?:what(?:'s|s|\s+is|\s+do|\s+are)?|anything|any\b|do\s+i\s+have|is\s+there|am\s+i|when)\b/i;

/**
 * Schedule-query nouns and question words. Widened from the original
 * "today"-centric pair to cover "tomorrow", named weekdays (via
 * `scheduleDateISO`), and "check my reminders" — while the bare noun
 * "reminder(s)" here answers a QUERY, it never implies CREATE (see
 * REMINDER_CREATE_RE below, which deliberately excludes it).
 */
const SCHEDULE_NOUN_RE =
  /\b(today|schedule|due|on my list|this week|upcoming|overdue|tomorrow|tonight|reminders?|agenda|next week|this weekend|next weekend|coming up|going on|happening|planned|free|busy)\b/;
const SCHEDULE_QUESTION_RE =
  /\b(what|show|tell|list|get|have|do i|i have|got|anything|any|am i|is there|when|check)\b/;

/**
 * Explicit reminder-CREATION markers. Deliberately does NOT trigger on the
 * bare noun "reminder(s)" alone — "how many reminders do I have" / "check
 * my reminders" is a QUERY (handled by SCHEDULE_NOUN_RE/SCHEDULE_QUESTION_RE
 * above), never a silent create (owner decision 2026-08-31: keep this
 * conservative — no generic intent verbs like "I need to" either).
 * Excludes appointment/meeting/event/"book a …" — those need a dedicated
 * event capability; they fall through to the generic switchFace below
 * rather than being masked as a reminder.
 */
const REMINDER_CREATE_RE =
  /\bremind\b|\bremember\s+to\b|\b(?:don'?t|do\s+not)\s+forget\b|\b(?:alert|notify|ping|buzz|wake)\s+me\b|\bnote\s+to\s+(?:my\s+)?self\b|\b(?:set|put)\s+(?:a|an)\s+alarm\b|\b(?:add|set|create|make|new)\s+(?:a|an|the)?\s*(?:new\s+)?(?:reminders?|alarms?|tasks?|to-?dos?)\b/i;

/**
 * Creation lead-ins `parseSmartText`'s own `extractTitle` doesn't know
 * about — it strips "remind(er)? me to", "put/set a reminder/alarm for",
 * "note to self", "alert/notify/ping/buzz me", … (smartTextParser.ts) but
 * not "add/create/make/new a reminder/task/todo (to)" or "wake me".
 * Stripped BEFORE `parseSmartText` so the date/time parser and the title
 * extractor both see the clean remainder. \b-anchored throughout — an
 * unanchored optional group here is exactly what caused the HUB-12 title
 * bug ("remind me tomorrow" → title "Morrow").
 */
const ERA_LEAD_IN_RE =
  /^(?:add|set|create|make|new)\s+(?:a|an|the)?\s*(?:new\s+)?(?:reminders?|alarms?|tasks?|to-?dos?)\b\s*|^wake\s+me\s*(?:up\b)?\s*(?:(?:to|about)\b)?\s*/i;

/**
 * A leftover leading connector after lead-in stripping — "add a reminder
 * to call mom" strips to "to call mom"; `parseSmartText`'s own
 * `extractTitle` doesn't know to drop a bare leading "to"/"for" (it only
 * strips those as part of its OWN specific lead-in phrases). Looped since
 * one strip can uncover another ("for 5pm to call mom" → the date parser
 * consumes "5pm" → "to call mom" remains after one pass).
 */
function stripLeftoverConnector(title: string): string {
  let out = title;
  let prev: string;
  do {
    prev = out;
    out = out.replace(/^(?:to|for)\b\s*/i, "").trim();
  } while (out !== prev && out.length > 0);
  return out;
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
  const stripped = text.replace(ERA_LEAD_IN_RE, "").trim();
  const parsed = parseSmartText(stripped.length > 0 ? stripped : text);
  let title = stripLeftoverConnector(parsed.title?.trim() ?? "");
  if (title.length > 0) title = title.charAt(0).toUpperCase() + title.slice(1);
  return title.length > 0 ? title : text.trim();
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

/** Named-target regex match, gated by OTHER_FACE_RE — see its doc comment. */
function namedMatch(text: string, re: RegExp): RegExpMatchArray | null {
  return OTHER_FACE_RE.test(text) ? null : text.match(re);
}

export const scheduleRouter: FaceIntentRouter = {
  parse(text) {
    const lo = text.toLowerCase();

    // "What do I have to do today", "What's on my schedule", "anything
    // due tomorrow", "check my reminders" — gated against money/food
    // vocabulary (see OTHER_FACE_RE) so widening these words doesn't let a
    // Budget/Chef sentence get read as a schedule query (e.g. "any gaps in
    // the meal plan this week" would otherwise also trip gate1 "this week"
    // + gate2 "any").
    if (
      SCHEDULE_NOUN_RE.test(lo) &&
      SCHEDULE_QUESTION_RE.test(lo) &&
      !OTHER_FACE_RE.test(text)
    ) {
      return {
        kind: "todaySchedule",
        face: "schedule",
        rawText: text,
        dateISO: scheduleDateISO(text),
      };
    }

    // "What do I have to do today" edge cases
    if (
      /what.*have.*today|today.*what.*have|show.*today|today.*items/.test(lo) &&
      !OTHER_FACE_RE.test(text)
    ) {
      return {
        kind: "todaySchedule",
        face: "schedule",
        rawText: text,
        dateISO: scheduleDateISO(text),
      };
    }

    // A question opener PAIRED WITH an actual date parseSmartText found —
    // "anything Saturday?", "am I free tomorrow?" — without needing one of
    // the fixed nouns above.
    if (QUERY_OPENER_RE.test(text.trim()) && !OTHER_FACE_RE.test(text)) {
      const dateISO = scheduleDateISO(text);
      if (dateISO) {
        return { kind: "todaySchedule", face: "schedule", rawText: text, dateISO };
      }
    }

    // Stage 1 focus-memory follow-ups. Match either pronouns or named targets.
    // "Move dentist reminder to 5", "Reschedule dentist to tomorrow", "Move it to 5"
    //
    // Try pronouns first (it/that/this/that one/this one) to prefer recent context,
    // then fall back to named-target matching. Named targets resolve via fuzzy title
    // matching in focus memory — if ambiguous or not found, fall through to let
    // Ask AI / clarify handle it rather than guessing.
    const rescheduleMatch =
      text.match(
        /\b(?:change|move|push|reschedule|shift|postpone|snooze|delay|bump|make)\b[\s\S]*?\b(?:it|that|this(?:\s+one)?)\b\s+(?:back\s+)?to\s+(.+?)[\s.!?]*$/i,
      ) ||
      // Elliptical "make it 11" (no "to") — a common idiom for "change it
      // to 11". Deliberately narrow to "make" + pronoun only; "move it 11"
      // without "to" reads as a typo more than an idiom.
      text.match(/\bmake\s+(?:it|that|this(?:\s+one)?)\s+(.+?)[\s.!?]*$/i);
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

    // Named target: "Move dentist reminder to 5" or "Move dentist to 5"
    const namedRescheduleMatch = namedMatch(
      text,
      /\b(?:change|move|push|reschedule|shift|postpone|snooze|delay|bump)\b\s+(.+?)\b(?:\s+reminder)?\s+(?:back\s+)?to\s+(.+?)[\s.!?]*$/i,
    );
    if (namedRescheduleMatch) {
      const targetRef = namedRescheduleMatch[1].trim();
      const focus = resolveEntityRef(
        targetRef,
        "reminder",
        useEraStore.getState().focusEntities,
      );
      if (focus) {
        return {
          kind: "reminderReschedule",
          face: "schedule",
          itemId: focus.id,
          title: focus.title,
          whenText: namedRescheduleMatch[2].trim(),
          rawText: text,
        };
      }
      // If focus is null, fall through — ambiguous or not found,
      // let Ask AI / clarify handle it
    }

    // Complete: pronouns or named targets
    // "Mark dentist reminder done", "Mark dentist done", "Complete it",
    // "Check it off", "Did it", "It's done"
    if (
      /\b(?:mark|complete|finish(?:ed)?|check|tick)\b[\s\S]*?\b(?:it|that|this(?:\s+one)?)\b/i.test(
        text,
      ) ||
      /\bdone\s+with\s+(?:it|that|this(?:\s+one)?)\b/i.test(text) ||
      /\b(?:it|that|this(?:\s+one)?)\s*(?:'s|\s+is)\s+done\b/i.test(text) ||
      /\bdid\s+(?:it|that|this(?:\s+one)?)\b/i.test(text)
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

    const namedCompleteMatch = namedMatch(
      text,
      /\b(?:mark|complete|finish(?:ed)?|check|tick)\s+(.+?)\b(?:\s+reminder)?(?:\s+(?:done|complete|finished|off))?[\s.!?]*$/i,
    );
    if (namedCompleteMatch) {
      const targetRef = namedCompleteMatch[1].trim();
      const focus = resolveEntityRef(
        targetRef,
        "reminder",
        useEraStore.getState().focusEntities,
      );
      if (focus) {
        return {
          kind: "reminderComplete",
          face: "schedule",
          itemId: focus.id,
          title: focus.title,
          rawText: text,
        };
      }
    }

    // Delete: pronouns or named targets
    // "Delete dentist reminder", "Delete dentist", "Remove it", "Get rid of it"
    if (
      /\b(?:delete|remove|cancel|get\s+rid\s+of)\b[\s\S]*?\b(?:it|that|this(?:\s+one)?)\b/i.test(
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

    const namedDeleteMatch = namedMatch(
      text,
      /\b(?:delete|remove|cancel|get\s+rid\s+of)\s+(.+?)\b(?:\s+reminder)?[\s.!?]*$/i,
    );
    if (namedDeleteMatch) {
      const targetRef = namedDeleteMatch[1].trim();
      const focus = resolveEntityRef(
        targetRef,
        "reminder",
        useEraStore.getState().focusEntities,
      );
      if (focus) {
        return {
          kind: "reminderDelete",
          face: "schedule",
          itemId: focus.id,
          title: focus.title,
          rawText: text,
        };
      }
    }

    // Reminder draft — explicit creation markers only (see
    // REMINDER_CREATE_RE's doc comment: bare "reminder" alone is a query,
    // never a create).
    if (REMINDER_CREATE_RE.test(text)) {
      return {
        kind: "draftReminder",
        face: "schedule",
        title: reminderTitleFrom(text),
        rawText: text,
      };
    }

    // Generic schedule face switch — includes the bare word "schedule"
    // itself (previously missing: typing just "Schedule" matched nothing
    // here and fell all the way through to "unknown"), and the bare noun
    // "reminder(s)" as a fallback net.
    if (
      /\b(task|todo|to-do|deadline|appointment|event|meeting|calendar|schedule|reminders?)\b/i.test(
        text,
      )
    ) {
      return { kind: "switchFace", face: "schedule", rawText: text };
    }

    return null;
  },
};
