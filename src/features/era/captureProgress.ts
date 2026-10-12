import type { CaptureKind } from "./capture";
import { eventWhen } from "./intents/eventText";
import { parseRelativeDate, parseTime } from "@/lib/smartTextParser";

export type CaptureStep =
  | "title"
  | "date"
  | "time"
  | "amount"
  | "description"
  | "accountId"
  | "categoryId"
  | "subcategoryId"
  | "threadId"
  | "groupId"
  | "items"
  | "alert"
  | "priority"
  | "ready";

/** Asked, but Send works without an answer (the manual form allows skipping it too). */
export const OPTIONAL_STEPS: ReadonlySet<CaptureStep> = new Set([
  "subcategoryId",
]);

/**
 * Derive the next gap on every keystroke. Parser defaults are not user input.
 * Only what the manual flows require is asked; alert, priority, place and the
 * shopping group have defaults and stay correctable from the summary.
 */
export function captureProgress(
  kind: CaptureKind | null,
  text: string,
  fields: Record<string, string>,
  options: {
    hasChildren: boolean;
    dateChosen?: boolean;
    timeChosen?: boolean;
  },
  reference = new Date(),
): CaptureStep {
  if (kind === "reminder" || kind === "event") {
    if (!fields.title.trim()) return "title";
    const when = eventWhen(text, reference);
    if (!when.date && !options.dateChosen) return "date";
    if (!when.time && !options.timeChosen) return "time";
    return "ready";
  }
  if (kind === "expense") {
    if (!(Number(fields.amount) > 0)) return "amount";
    // An amount alone is not a description ("I paid $5").
    if (
      !fields.description
        .replace(/[\d\s.,$€£]+/g, " ")
        .replace(/\b(?:for|usd|lbp|dollars?|lira)\b/gi, "")
        .trim()
    )
      return "description";
    if (!fields.accountId) return "accountId";
    if (!fields.categoryId) return "categoryId";
    if (options.hasChildren && !fields.subcategoryId) return "subcategoryId";
  }
  if (kind === "shopping") {
    if (!fields.threadId) return "threadId";
    if (!fields.items.trim()) return "items";
  }
  return "ready";
}

/** Complete a partially typed suggestion without repeating its prefix. */
export function completeCaptureText(
  text: string,
  phrase: string,
  slot?: string,
): string {
  const day = parseRelativeDate(text)?.matched;
  const clock = parseTime(text)?.matched.trim();
  // "tonight" is both the day and a default time: a new time is added after
  // it ("tonight at 8pm"), never written over the day.
  const existing =
    slot === "date" ? day : slot === "time" && clock !== day ? clock : undefined;
  if (existing) {
    const replacement =
      slot === "time" &&
      /\bat\s+$/i.test(
        text.slice(0, text.toLowerCase().indexOf(existing.toLowerCase())),
      )
        ? phrase.replace(/^at\s+/i, "")
        : phrase;
    const index = text.toLowerCase().indexOf(existing.toLowerCase());
    return (
      `${text.slice(0, index)}${replacement}${text.slice(index + existing.length)}`.trimEnd() +
      " "
    );
  }
  const trimmed = text.trimEnd();
  const lower = trimmed.toLowerCase();
  for (let i = phrase.length; i > 0; i--) {
    const prefix = phrase.slice(0, i).toLowerCase();
    if (
      lower.endsWith(prefix) &&
      (lower.length === i || /\s/.test(lower[lower.length - i - 1]))
    ) {
      return `${trimmed}${phrase.slice(i)} `;
    }
  }
  return `${trimmed} ${phrase} `;
}
