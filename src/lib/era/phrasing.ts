// src/lib/era/phrasing.ts
// ERA's voice: the mechanics for saying the same thing many different ways.
//
// ERA answers a small, fixed set of situations ("reminder created", "here's
// your spending", "I couldn't reach the server"). A single hardcoded sentence
// per situation is what makes an assistant sound like a vending machine — you
// hear the identical string on the fifth reminder of the day and the illusion
// of someone listening collapses. So every situation owns a *pool* of phrasings
// and we pick one at random.
//
// Design rules for the pools, learned the hard way:
//
//  1. **Every variant must carry the same facts.** Variation is in the
//     connective tissue, never the payload. If one variant drops the amount or
//     the due time to sound breezier, the assistant is lying half the time and
//     nobody can tell which half.
//  2. **Slots, not concatenation.** A pool entry is a template with `{name}`
//     placeholders so a variant can put the facts wherever the sentence wants
//     them — some open with the fact, some close with it. That reordering is
//     most of what makes a set feel human rather than mail-merged.
//  3. **No jokes, no personality-of-the-day.** Variants differ in rhythm and
//     register, not in attitude. A "witty" variant is funny once and grating
//     the twentieth time, which is the opposite of the goal.
//  4. **Never randomize an error's meaning.** Error pools vary the apology,
//     never the diagnosis or the suggested next step.
//
// Lives in `src/lib/` rather than a feature dir because both ERA
// (`src/features/era/`) and voice conversation (`src/features/voice-conversation/`)
// speak with this voice, and standalone feature dirs may not import each other.

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Pick one entry at random.
 *
 * Tests pin this by stubbing `Math.random`, which is why the randomness is
 * here in one place instead of inline at every call site.
 */
export function pick<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Fill `{slot}` placeholders. An unknown or empty slot collapses the
 * placeholder AND the space in front of it, so a template written for the
 * richest case degrades cleanly when a fact is missing rather than leaving
 * "Done — water the plant ." behind.
 *
 * The cleanup pass afterwards exists because dropping a slot strands the
 * punctuation that was holding it: `"{a}, {b}."` with an empty `b` would read
 * "one,." and `"{a} — {b}."` would read "one —." Templates are written for the
 * fullest sentence, so this has to be handled here rather than by asking every
 * pool author to remember it.
 *
 * A zero is a fact, not a missing value — `{n}` with `0` renders "0".
 */
export function fill(
  template: string,
  slots: Record<string, string | number | null | undefined>,
): string {
  return (
    template
      // Spacing has two competing cases, both real:
      //
      //   `"{Title}"`        — flush against an opening quote; must NOT gain a
      //                        space, or you get `" Water the plant"`.
      //   `today{first}`     — written flush so an EMPTY slot leaves no gap,
      //   `{amount}{where}`    but a FILLED one needs a space, or you get
      //                        `$25under Car / Fuel`.
      //
      // A space written in the template always wins. Otherwise we add one
      // unless the slot sits at the start or against an opening delimiter.
      .replace(
        /( ?)\{(\w+)\}/g,
        (_match, space: string, key: string, offset: number, whole: string) => {
          const value = slots[key];
          if (value === null || value === undefined || value === "") return "";
          if (space) return `${space}${String(value)}`;
          const prev = whole[offset - 1] ?? "";
          const flush = prev === "" || /["'“‘([{]/.test(prev);
          return flush ? String(value) : ` ${String(value)}`;
        },
      )
      .replace(/\s+/g, " ")
      // No space before punctuation.
      .replace(/\s+([.,!?;:])/g, "$1")
      // A separator left holding nothing: "one,." → "one." / "one —." → "one."
      .replace(/[,;:]+\s*([.!?])/g, "$1")
      .replace(/\s*[—–-]\s*([.!?])/g, "$1")
      // …or left dangling at the very end: "one," → "one"
      .replace(/[\s,;:—–-]+$/, "")
      // Openers vary in how they end ("Quick read:" vs "Checked."), so a
      // template that reads fine after a colon can start mid-sentence after a
      // full stop: "Checked. in August you've moved…". Re-case the word after
      // any sentence break. Decimals are safe — `.` there is followed by a
      // digit, not a letter.
      .replace(/([.!?])(\s+)([a-z])/g, (_m, stop, gap, letter: string) =>
        `${stop}${gap}${letter.toUpperCase()}`,
      )
      .trim()
  );
}

/** Pick a phrasing from `pool` and fill its slots. The workhorse. */
export function say(
  pool: readonly string[],
  slots: Record<string, string | number | null | undefined> = {},
): string {
  return fill(pick(pool), slots);
}

// ---------------------------------------------------------------------------
// Time-of-day helpers — shared by greetings and by "when" phrasing
// ---------------------------------------------------------------------------

export type DayPart = "morning" | "afternoon" | "evening" | "night";

export function dayPart(at: Date = new Date()): DayPart {
  const h = at.getHours();
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 22) return "evening";
  return "night";
}

/**
 * Human phrasing for an instant: "today at 5:00 PM", "tomorrow at 9:00 AM",
 * "Fri, Aug 28 at 6:30 PM". Deliberately renders in local time — callers hold
 * UTC ISO strings, and Date's own toLocale* converts back to the user's zone.
 *
 * Returns "" for an unparseable input so `fill` drops the slot rather than
 * splicing "Invalid Date" into a sentence.
 */
export function describeWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";

  const time = when.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDelta = Math.round(
    (startOfDay(when) - startOfDay(new Date())) / 86_400_000,
  );

  if (dayDelta === 0) return `today at ${time}`;
  if (dayDelta === 1) return `tomorrow at ${time}`;
  if (dayDelta === -1) return `yesterday at ${time}`;

  // Inside the coming week, the weekday alone is how people actually say it.
  if (dayDelta > 1 && dayDelta < 7) {
    return `${when.toLocaleDateString("en-US", { weekday: "long" })} at ${time}`;
  }

  const day = when.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${day} at ${time}`;
}

/**
 * De-capitalize a parsed title so it reads inside a sentence: "Call the bank"
 * → "call the bank". Leaves anything that looks like a proper noun or acronym
 * alone ("NFC tag", "Dr Khoury"), since only the parser's own sentence-casing
 * should be undone.
 */
export function lowerFirst(s: string): string {
  if (!s) return s;
  // The pronoun "I" is always capitalized — "I'm listening" must not become
  // "i'm listening".
  if (/^I($|[\s'’])/.test(s)) return s;
  if (s.length > 1 && /[A-Z]/.test(s[1])) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * "$1,240" / "$18.50" — a whole amount loses its pointless ".00", but an
 * amount with cents shows both digits. Letting `minimumFractionDigits: 0` run
 * on a value with cents gave "$1,240.5", which reads as a typo.
 */
export function money(n: number): string {
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** "3 transactions" / "1 transaction" */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Join a list the way a person reads it: "a, b and c". */
export function listOut(parts: readonly string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Generic pools — cross-cutting sentences with no domain of their own
// ---------------------------------------------------------------------------

/** Opens a confirmation that something was written. Slot-free. */
export const ACK_DONE = [
  "Done —",
  "Got it —",
  "All set —",
  "Noted —",
  "Locked in —",
  "Sorted —",
  "That's in —",
  "Consider it done —",
  "On it —",
  "Saved —",
] as const;

/** Opens an answer to a question ERA just looked up. Slot-free. */
export const ACK_LOOKED_UP = [
  "Here's where you stand:",
  "Right then.",
  "Here you go:",
  "Had a look.",
  "So far:",
  "Checked.",
  "Here's the picture:",
  "Quick read:",
] as const;

/** Softeners for "try again", so repeated failures don't repeat verbatim. */
export const RETRY_NUDGE = [
  "Give it another go in a moment.",
  "Try again shortly.",
  "Worth another try in a minute.",
  "Have another go in a bit.",
  "Try me again in a moment.",
  "Give it a second and try again.",
] as const;

/**
 * Build an error reply: a varied apology, a FIXED diagnosis, a varied nudge.
 * The middle is never randomized — see rule 4 at the top of this file.
 */
const APOLOGY = [
  "Sorry —",
  "Hmm —",
  "That didn't take —",
  "No luck —",
  "Something's off —",
  "Couldn't manage it —",
] as const;

export function errorReply(diagnosis: string, nudge = true): string {
  const parts = [pick(APOLOGY), diagnosis];
  if (nudge) parts.push(pick(RETRY_NUDGE));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Greetings
// ---------------------------------------------------------------------------

const GREETING_OPENERS: Record<DayPart, readonly string[]> = {
  morning: [
    "Morning.",
    "Good morning.",
    "Morning —",
    "Hey, morning.",
  ],
  afternoon: ["Afternoon.", "Good afternoon.", "Hey.", "Afternoon —"],
  evening: ["Evening.", "Good evening.", "Hey there.", "Evening —"],
  night: ["Hey.", "Still up?", "Evening.", "Hey there."],
};

const GREETING_OFFERS = [
  "What can I do for you?",
  "What do you need?",
  "What's on your mind?",
  "I'm listening.",
  "Where do you want to start?",
  "Ask away — budget, schedule, kitchen, or something to remember.",
  "Fire away.",
  "What are we doing?",
  "Ready when you are.",
  "How can I help?",
] as const;

/** A time-aware, non-repeating greeting. */
export function greeting(at: Date = new Date()): string {
  const opener = pick(GREETING_OPENERS[dayPart(at)]);
  const offer = pick(GREETING_OFFERS);
  // An opener ending in a dash runs INTO the offer rather than closing a
  // sentence, so the offer stays lower-case: "Morning — ready when you are."
  return /[—–,]$/.test(opener)
    ? `${opener} ${lowerFirst(offer)}`
    : `${opener} ${offer}`;
}
