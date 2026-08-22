// Schedule face reply formatter — conversational tone, same spirit as briefingToSpeech.ts
//
// Every situation below owns a POOL of phrasings picked at random (see
// `src/lib/era/phrasing.ts` for the rules). All variants in a pool carry the
// same facts; only the wording around them moves.

import {
  ACK_DONE,
  describeWhen,
  errorReply,
  lowerFirst,
  pick,
  plural,
  say,
} from "@/lib/era/phrasing";

export interface ScheduleData {
  todayCount: number;
  overdueCount: number;
  firstTitle: string | null;
  firstOverdueTitle: string | null;
}

// ---------------------------------------------------------------------------
// Today's schedule
// ---------------------------------------------------------------------------

const NOTHING_ON = [
  "Your slate is clean today — nothing due, nothing overdue. Enjoy it.",
  "Nothing due today and nothing overdue. Rare. Take the win.",
  "You're clear today. No deadlines, no stragglers.",
  "Empty schedule today, and nothing hanging over from before.",
  "Nothing on today. Nothing late either — you're all caught up.",
  "Today's wide open. No overdue items either.",
  "Clean slate. Nothing due, nothing overdue.",
] as const;

/** Slots: {count} e.g. "3 things", {first} e.g. "starting with Call the bank" */
const TODAY_SOME = [
  "You've got {count} today{first}.",
  "{count} on your plate today{first}.",
  "Today's list has {count}{first}.",
  "Looking at {count} today{first}.",
  "There are {count} due today{first}.",
  "{count} lined up for today{first}.",
] as const;

const TODAY_ONE = [
  "One thing today{first}.",
  "Just the one today{first}.",
  "You've got a single item today{first}.",
  "One on the list today{first}.",
  "Only one thing due today{first}.",
] as const;

const NOTHING_DUE_TODAY = [
  "Nothing new due today.",
  "Today itself is clear.",
  "Nothing on the books for today.",
  "No deadlines today.",
] as const;

/** Slots: {count} e.g. "3 things", {first} e.g. "including Pay rent" */
const OVERDUE_SOME = [
  "You've also got {count} overdue{first} — worth catching up on.",
  "There are also {count} past due{first}.",
  "You're carrying {count} overdue{first} — might be worth a pass.",
  "Also {count} still overdue{first}.",
  "Plus {count} that slipped past{first}.",
] as const;

const OVERDUE_ONE = [
  "There's also one overdue item{first}. Might want to tackle that.",
  "One thing is past due{first}.",
  "You've also got one straggler{first}.",
  "Also, one item is overdue{first}.",
  "One left over from before{first} — worth a look.",
] as const;

export function formatTodaySchedule(data: ScheduleData): string {
  const { todayCount, overdueCount, firstTitle, firstOverdueTitle } = data;

  if (todayCount === 0 && overdueCount === 0) return pick(NOTHING_ON);

  const lines: string[] = [];

  if (todayCount === 1) {
    lines.push(say(TODAY_ONE, { first: firstTitle ? `— ${firstTitle}` : "" }));
  } else if (todayCount > 1) {
    lines.push(
      say(TODAY_SOME, {
        count: plural(todayCount, "thing"),
        first: firstTitle ? `, starting with ${firstTitle}` : "",
      }),
    );
  } else {
    lines.push(pick(NOTHING_DUE_TODAY));
  }

  if (overdueCount === 1) {
    lines.push(
      say(OVERDUE_ONE, { first: firstOverdueTitle ? `— ${firstOverdueTitle}` : "" }),
    );
  } else if (overdueCount > 1) {
    lines.push(
      say(OVERDUE_SOME, {
        count: plural(overdueCount, "thing"),
        first: firstOverdueTitle ? `, including ${firstOverdueTitle}` : "",
      }),
    );
  }

  return lines.join(" ");
}

export function formatScheduleError(): string {
  return errorReply("I couldn't pull up your schedule.");
}

// ---------------------------------------------------------------------------
// Reminder creation (draftReminder)
// ---------------------------------------------------------------------------

export interface ReminderCreatedData {
  title: string;
  /** UTC ISO instant the reminder is due, or null when no date was parsed. */
  dueAt: string | null;
  /** True when parseSmartText also found a recurrence rule. */
  recurring: boolean;
}

/**
 * Confirmations for a reminder that HAS a due time.
 *
 * Slots: {ack} an opener from ACK_DONE, {title} lower-cased for mid-sentence
 * use, {Title} as-parsed for quote-style variants, {when} e.g. "tomorrow at
 * 11:00 AM". Every variant states both the title and the when — that is the
 * whole point of the confirmation, so no variant may drop either.
 */
const REMINDER_WITH_WHEN = [
  "{ack} I'll remind you to {title} {when}.",
  "{ack} \"{Title}\", {when}.",
  "Reminder set — {title}, {when}.",
  "{ack} {when}, I'll nudge you to {title}.",
  "You're set: {title}, {when}.",
  "I'll give you a shout {when} to {title}.",
  "{ack} that's on for {when}: {title}.",
  "Noted: {title}, {when}. I'll remind you.",
  "Got it — {title} {when}. I'll flag it when it's close.",
  "Consider it remembered: {title}, {when}.",
] as const;

/**
 * Confirmations for a reminder with NO date. Each variant says the item was
 * saved AND that it has no date — leaving the second half out would let the
 * user walk away thinking a nudge is coming.
 */
const REMINDER_NO_WHEN = [
  "{ack} \"{Title}\" is on your list. No date on it, so it'll just sit there until you give it one.",
  "{ack} I've saved \"{Title}\", but I didn't catch a date — it's undated for now.",
  "\"{Title}\" is saved. I couldn't pick out a time, so nothing will nudge you yet.",
  "{ack} \"{Title}\" is down. No date though — add one if you want a reminder.",
  "Added \"{Title}\" to your list. Undated, so it won't chase you.",
  "{ack} that's noted: \"{Title}\". I didn't hear a when, so there's no alert on it.",
] as const;

const RECURRING_NOTE = [
  "I picked up a repeat in there — check the item if the cadence looks off.",
  "Sounded like that repeats, so I've set it to recur. Worth a glance.",
  "I've made it recurring based on what you said — adjust it if I read that wrong.",
  "That's set to repeat. Check the item if the rhythm isn't right.",
] as const;

export function formatReminderCreated(data: ReminderCreatedData): string {
  const { title, dueAt, recurring } = data;
  const when = describeWhen(dueAt);

  const parts: string[] = [
    when
      ? say(REMINDER_WITH_WHEN, {
          ack: pick(ACK_DONE),
          title: lowerFirst(title),
          Title: title,
          when,
        })
      : say(REMINDER_NO_WHEN, { ack: pick(ACK_DONE), Title: title }),
  ];

  if (recurring) parts.push(pick(RECURRING_NOTE));

  return parts.join(" ");
}

const NO_TITLE_HELP = [
  'I couldn\'t work out what to remind you about. Try something like "remind me to call the bank tomorrow at 5".',
  'I got the timing but not the task. Something like "remind me to call the bank tomorrow at 5" gives me both.',
  'I need a bit more to go on — try "remind me to water the plants tomorrow at 11".',
  'Not sure what the reminder is for. Give me the thing and the time, like "remind me to pay rent on the 1st".',
] as const;

export function formatReminderError(reason?: "no-title" | "offline"): string {
  if (reason === "no-title") return pick(NO_TITLE_HELP);
  return errorReply("I couldn't save that reminder.");
}
