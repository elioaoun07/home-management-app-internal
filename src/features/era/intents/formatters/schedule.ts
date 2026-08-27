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

export interface DayScheduleItem {
  title: string;
  /** Local wall-clock time, e.g. "10:00 AM". */
  time: string;
}

export interface DayScheduleData {
  /** yyyy-MM-dd of the day being reported. */
  dateISO: string;
  isToday: boolean;
  items: DayScheduleItem[];
  /** Only meaningful when isToday — overdue is relative to "now". */
  overdueCount: number;
  firstOverdueTitle: string | null;
}

// ---------------------------------------------------------------------------
// A day's schedule (today or any named day)
// ---------------------------------------------------------------------------

const NOTHING_ON_TODAY = [
  "Your slate is clean today — nothing due, nothing overdue. Enjoy it.",
  "Nothing due today and nothing overdue. Rare. Take the win.",
  "You're clear today. No deadlines, no stragglers.",
  "Empty schedule today, and nothing hanging over from before.",
  "Nothing on today. Nothing late either — you're all caught up.",
  "Today's wide open. No overdue items either.",
  "Clean slate. Nothing due, nothing overdue.",
] as const;

/** Slots: {day} e.g. "Saturday" / "tomorrow" */
const NOTHING_ON_DAY = [
  "Nothing on for {day}.",
  "{day} is wide open — nothing on the schedule.",
  "Clear on {day}. Nothing due.",
  "Your {day} is empty.",
] as const;

const NOTHING_DUE_TODAY = [
  "Nothing new due today.",
  "Today itself is clear.",
  "Nothing on the books for today.",
  "No deadlines today.",
] as const;

/** Slots: {count} e.g. "3 things", {list} e.g. "Call the bank at 10:00 AM, Pay rent at 2:00 PM" */
const TODAY_SOME = [
  "You've got {count} today: {list}.",
  "{count} on your plate today: {list}.",
  "Today's list: {list}.",
  "Looking at {count} today: {list}.",
  "{count} lined up for today: {list}.",
] as const;

/** Slots: {day}, {count}, {list} */
const DAY_SOME = [
  "{day}: {list}.",
  "On {day}, you've got {list}.",
  "{count} on {day}: {list}.",
  "For {day}: {list}.",
  "{day}'s got {list}.",
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

/** "Saturday" for a day within the coming week, "Fri, Aug 28" further out. */
function describeDay(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDelta = Math.round(
    (startOfDay(d) - startOfDay(new Date())) / 86_400_000,
  );

  if (dayDelta === 1) return "tomorrow";
  if (dayDelta === -1) return "yesterday";
  if (dayDelta > 1 && dayDelta < 7) {
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatScheduleForDay(data: DayScheduleData): string {
  const { isToday, items, overdueCount, firstOverdueTitle } = data;

  // Full clean slate — nothing today AND nothing overdue — gets the
  // celebratory pool and skips the overdue line entirely (there is none).
  if (isToday && items.length === 0 && overdueCount === 0) {
    return pick(NOTHING_ON_TODAY);
  }

  const listText = items.map((i) => `${i.title} at ${i.time}`).join(", ");
  const lines: string[] = [];

  if (items.length === 0) {
    lines.push(
      isToday ? pick(NOTHING_DUE_TODAY) : say(NOTHING_ON_DAY, { day: describeDay(data.dateISO) }),
    );
  } else if (isToday) {
    lines.push(say(TODAY_SOME, { count: plural(items.length, "thing"), list: listText }));
  } else {
    lines.push(
      say(DAY_SOME, {
        day: describeDay(data.dateISO),
        count: plural(items.length, "thing"),
        list: listText,
      }),
    );
  }

  if (isToday) {
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
  /**
   * UTC ISO instant the reminder is due. Always present — time is now a
   * required slot (Slice 3): resolveDraftReminder asks a question instead of
   * writing an undated item, so by the time this formatter runs a date has
   * always been resolved one way or another.
   */
  dueAt: string;
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
    say(REMINDER_WITH_WHEN, {
      ack: pick(ACK_DONE),
      title: lowerFirst(title),
      Title: title,
      when,
    }),
  ];

  if (recurring) parts.push(pick(RECURRING_NOTE));

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Ask for a time (Slice 3) — title understood, date/time missing
// ---------------------------------------------------------------------------

/** Slots: {Title} */
const ASK_REMINDER_TIME = [
  "Got \"{Title}\" — when should I remind you?",
  "\"{Title}\" — what time?",
  "When for \"{Title}\"?",
  "Noted \"{Title}\". What's the when?",
  "\"{Title}\" — give me a day and time and I'll set it.",
] as const;

export function formatAskReminderTime(data: { title: string }): string {
  return say(ASK_REMINDER_TIME, { Title: data.title });
}

/** Slots: {Title} */
const REMINDER_SAVED_AS_DRAFT = [
  "Didn't catch a time, so I've left \"{Title}\" as a draft — finish it in Reminders.",
  "No time came through — \"{Title}\" is saved as a draft for you to complete.",
  "\"{Title}\" is parked as a draft since I didn't get a when. Pick it up in Reminders.",
] as const;

export function formatReminderSavedAsDraft(data: { title: string }): string {
  return say(REMINDER_SAVED_AS_DRAFT, { Title: data.title });
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

// ---------------------------------------------------------------------------
// Stage 1 — focus-memory follow-ups: reschedule / complete / delete
// ---------------------------------------------------------------------------

/** Slots: {Title}, {when} e.g. "today at 11:00 AM" */
const REMINDER_RESCHEDULED = [
  "{ack} \"{Title}\" is now {when}.",
  "Moved — \"{Title}\" is set for {when}.",
  "{ack} I've pushed \"{Title}\" to {when}.",
  "\"{Title}\" now lands {when}.",
  "Rescheduled: \"{Title}\", {when}.",
] as const;

export function formatReminderRescheduled(data: { title: string; dueAt: string }): string {
  return say(REMINDER_RESCHEDULED, {
    ack: pick(ACK_DONE),
    Title: data.title,
    when: describeWhen(data.dueAt),
  });
}

/** Slots: {Title} (optional — the item may have no known title) */
const REMINDER_COMPLETED = [
  "{ack} \"{Title}\" is marked done.",
  "Checked off — \"{Title}\".",
  "{ack} \"{Title}\" is complete.",
  "Marked \"{Title}\" as done.",
] as const;

export function formatReminderCompleted(title: string | null): string {
  return say(REMINDER_COMPLETED, { ack: pick(ACK_DONE), Title: title ?? "that" });
}

/** Slots: {Title} */
const REMINDER_DELETED = [
  "{ack} \"{Title}\" is deleted.",
  "Removed — \"{Title}\". It's in the Recycle Bin for 30 days if you need it back.",
  "{ack} \"{Title}\" is gone. Recoverable from the Recycle Bin for a month.",
  "Deleted \"{Title}\".",
] as const;

export function formatReminderDeleted(title: string | null): string {
  return say(REMINDER_DELETED, { ack: pick(ACK_DONE), Title: title ?? "that" });
}

/** No live focus entity to resolve the pronoun against. Slots: {action} e.g. "reschedule" */
const FOCUS_MISSING = [
  "I'm not sure what \"that\" refers to — what should I {action}?",
  "Which one? I don't have anything recent to {action}.",
  "I've lost track of what you mean — name the reminder and I'll {action} it.",
  "Not sure which reminder you mean — what's it called, so I can {action} it?",
] as const;

export function formatFocusMissing(action: string): string {
  return say(FOCUS_MISSING, { action });
}

export function formatReminderActionError(
  title: string | null,
  action: "reschedule" | "complete" | "delete",
): string {
  return errorReply(`I couldn't ${action} "${title ?? "that"}".`);
}

/** Slots: {Title}, {action} */
const RECURRING_NEEDS_APP = [
  "\"{Title}\" repeats, so I'll let you {action} that specific occurrence in Reminders — I don't want to guess which one.",
  "That one's recurring. Open \"{Title}\" in Reminders to {action} the right occurrence.",
  "\"{Title}\" repeats — pick the occurrence to {action} in Reminders rather than me guessing.",
] as const;

export function formatRecurringNeedsApp(
  title: string | null,
  action: "reschedule" | "complete" | "delete",
): string {
  return say(RECURRING_NEEDS_APP, { action, Title: title ?? "that" });
}
