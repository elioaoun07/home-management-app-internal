// src/features/era/intents/eventText.ts
// HUB-94 — pure text helpers for ERA events, shared by the Schedule router
// (is this an event? title + place) and the event resolver (date/time).
// Date and time come from the one shared parser (smartTextParser) — this file
// only decides which words are the title and which are the place:
//   "add an event dinner at Parents' house tomorrow at 8pm"
//     → title "Dinner", place "Parents' house", 2026-10-05 20:00
// parseSmartText's own title is not used: its category pass eats words like
// "parents" or "dentist", which are exactly the words an event needs.

import { parseRelativeDate, parseSmartText, parseTime } from "@/lib/smartTextParser";
import { formatDate } from "@/lib/utils/date";

export type EventNoun = "event" | "appointment" | "meeting";

/** "add an event …", "schedule a meeting …", "book an appointment …". */
const EVENT_VERB_RE =
  /^\s*(?:please\s+)?(?:add|create|make|set\s+up|schedule|book|plan)\s+(?:a|an|the|my)?\s*(?:new\s+)?(event|appointment|meeting)\b[\s:,-]*/i;
/** "new event …", "event: …". */
const EVENT_NEW_RE = /^\s*(?:new\s+(event|appointment|meeting)\b|(event)\s*:)[\s:,-]*/i;
/** "add dinner with Rami to my calendar tomorrow". */
const CALENDAR_RE = /^\s*(?:please\s+)?(?:add|put)\s+(.+?)\s+(?:to|on|in|into)\s+(?:my|the|our)\s+calendar\b[\s,]*(.*)$/i;

/** Money words never make an event (those sentences belong to Budget). */
const MONEY_RE = /[$€£]|\b(?:usd|lbp|dollars?|bucks)\b/i;

/** The sentence after its event lead-in, or null when it is not an event request. */
export function eventLead(text: string): { noun: EventNoun; body: string } | null {
  if (MONEY_RE.test(text)) return null;
  const verb = text.match(EVENT_VERB_RE) ?? text.match(EVENT_NEW_RE);
  if (verb) {
    const noun = (verb[1] ?? verb[2]).toLowerCase() as EventNoun;
    return { noun, body: text.slice(verb[0].length).trim() };
  }
  const cal = text.match(CALENDAR_RE);
  if (cal) return { noun: "event", body: `${cal[1]} ${cal[2]}`.trim() };
  return null;
}

/** Whole-word, case-insensitive occurrence of `part` in `text`. */
function wordRe(part: string): RegExp {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "iu");
}

/** Meal words name the event as well as its time ("lunch with Sara") — keep them in the title. */
const MEAL_TIME_RE = /^(?:lunch|lunchtime|breakfast|brunch|dinner|supper)$/i;

export interface EventWhen {
  /** yyyy-MM-dd, local. */
  date?: string;
  /** HH:mm, local. */
  time?: string;
  /** The text with the date/time words removed. */
  rest: string;
}

/** Date and time from the shared parser; a time found only inside another word ("Jacob" → "cob") is ignored. */
export function eventWhen(text: string, now: Date = new Date()): EventWhen {
  let rest = text;
  let date: string | undefined;
  let time: string | undefined;
  const d = parseRelativeDate(text, now);
  if (d) {
    date = formatDate(d.date);
    rest = rest.replace(wordRe(d.matched), "$1 ");
  }
  const t = parseTime(text);
  if (t && wordRe(t.matched).test(text)) {
    time = t.time;
    if (!MEAL_TIME_RE.test(t.matched.trim())) rest = rest.replace(wordRe(t.matched), "$1 ");
  }
  return { date, time, rest: tidy(rest) };
}

function tidy(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(?:\s+(?:on|at|this|next|for|by|from|the))+$/i, "")
    .replace(/^(?:(?:on|this|next|the)\s+)+(?=\S)/i, "")
    .replace(/[\s,;:.!?-]+$/, "")
    .trim();
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export interface EventParts {
  title: string;
  placeHint?: string;
  date?: string;
  time?: string;
  recurring: boolean;
}

/** Title, "at <place>", date and time of an event request; null when it isn't one. */
export function parseEvent(text: string, now: Date = new Date()): EventParts | null {
  const lead = eventLead(text);
  if (!lead) return null;
  const when = eventWhen(lead.body, now);
  let what = when.rest.replace(/^(?:called|named|titled)\s+/i, "");
  let placeHint: string | undefined;
  const at = what.match(/^(.*?)(?:^|\s+)(?:at|@)\s+(?![\d:])(.+)$/i);
  if (at) {
    what = at[1].trim();
    placeHint = at[2].trim() || undefined;
  }
  const noun = cap(lead.noun);
  let title: string;
  if (!what) title = noun;
  else if (lead.noun !== "event" && /^(?:with|for|about|regarding|re)\b/i.test(what)) title = `${noun} ${what}`;
  else title = cap(what.replace(/^(?:for|about)\s+/i, ""));
  if (title.length > 120) title = title.slice(0, 120).trim();
  return {
    title,
    ...(placeHint ? { placeHint } : {}),
    ...(when.date ? { date: when.date } : {}),
    ...(when.time ? { time: when.time } : {}),
    recurring: Boolean(parseSmartText(lead.body, now).recurrenceRule),
  };
}
