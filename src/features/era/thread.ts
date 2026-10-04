// src/features/era/thread.ts
// HUB-86 — the ERA conversation's pure view-model. Turns `era_messages` rows
// into what the thread renders (time breaks, sender groups, report markers)
// and owns the small decisions the UI makes about a thread: is this reply
// worth offering "Report" on (HUB-85), has the conversation gone quiet (the
// New chat nudge), which conversation is active, and what a past chat is
// called in History (HUB-52). No React, no fetch — see thread.test.ts.

/** The fields of an `era_messages` row the thread needs. */
export interface ThreadMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent_kind: string | null;
  intent_face: string | null;
  intent_payload: Record<string, unknown> | null;
  created_at: string;
}

export type ThreadItem =
  | { type: "break"; key: string; label: string }
  | { type: "user"; key: string; message: ThreadMessage }
  | {
      type: "assistant";
      key: string;
      message: ThreadMessage;
      /** First of a run of consecutive ERA messages — carries the avatar. */
      first: boolean;
    }
  | { type: "report"; key: string; message: ThreadMessage };

/** `era_messages.intent_kind` of a filed issue report (system row). */
export const ISSUE_REPORT_KIND = "issue_report";
/** `era_messages.intent_kind` of an assistant row written by Ask AI. */
export const AI_ANSWER_KIND = "ai_answer";

/** A gap this long starts a new time break in the thread. */
export const BREAK_GAP_MS = 30 * 60 * 1000;
/**
 * After this much silence the thread offers New chat. Same window focus
 * memory keeps "it" alive (FOCUS_TTL_MS), so the nudge appears exactly when
 * a follow-up like "move it" stops resolving.
 */
export const QUIET_AFTER_MS = 30 * 60 * 1000;
/** A conversation idle longer than this is history, not the active chat. */
export const ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

/** System rows are bookkeeping (e.g. handoff_consumed) except a filed report. */
export function isVisible(m: Pick<ThreadMessage, "role" | "intent_kind">): boolean {
  return m.role !== "system" || m.intent_kind === ISSUE_REPORT_KIND;
}

export function visibleMessages<T extends Pick<ThreadMessage, "role" | "intent_kind">>(
  messages: readonly T[],
): T[] {
  return messages.filter(isVisible);
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayDiff(at: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
}

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Today" · "Yesterday" · "Mon" (this week) · "Sep 28" · "Sep 28, 2025". */
export function dayLabel(at: number, now: number = Date.now()): string {
  const diff = dayDiff(at, now);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return WEEKDAY.format(at);
  return new Date(at).getFullYear() === new Date(now).getFullYear()
    ? MONTH_DAY.format(at)
    : MONTH_DAY_YEAR.format(at);
}

export function timeLabel(at: number): string {
  return TIME.format(at);
}

/** Break label: "Today · 4:12 PM". */
export function breakLabel(at: number, now: number = Date.now()): string {
  return `${dayLabel(at, now)} · ${timeLabel(at)}`;
}

export function buildThread(
  messages: readonly ThreadMessage[],
  now: number = Date.now(),
): ThreadItem[] {
  const items: ThreadItem[] = [];
  let prevAt: number | null = null;
  let prevType: ThreadItem["type"] | null = null;

  for (const m of visibleMessages(messages)) {
    const at = Date.parse(m.created_at);
    const valid = Number.isFinite(at);
    if (
      valid &&
      (prevAt === null || at - prevAt >= BREAK_GAP_MS || startOfDay(at) !== startOfDay(prevAt))
    ) {
      items.push({ type: "break", key: `break-${m.id}`, label: breakLabel(at, now) });
      prevType = "break";
    }
    if (m.role === "system") {
      items.push({ type: "report", key: m.id, message: m });
    } else if (m.role === "user") {
      items.push({ type: "user", key: m.id, message: m });
    } else {
      items.push({ type: "assistant", key: m.id, message: m, first: prevType !== "assistant" });
    }
    prevType = items[items.length - 1].type;
    if (valid) prevAt = at;
  }
  return items;
}

function outcomeStatus(m: ThreadMessage): string | null {
  const outcome = m.intent_payload?.outcome as { status?: unknown } | undefined;
  return typeof outcome?.status === "string" ? outcome.status : null;
}

const MISS_KINDS = new Set(["unknown", "clarify"]);

/**
 * True when ERA's reply means the request did not land: a router miss with no
 * AI follow-up, a failed or uncertain outcome, or an Ask AI prose answer to a
 * sentence the router had already missed (the owner's "neither the NLP nor
 * Gemini did it" case). A refused negation ("don't transfer…") is ERA doing
 * the right thing, so it is not offered.
 */
export function isMissedReply(reply: ThreadMessage, request: ThreadMessage | null): boolean {
  if (reply.role !== "assistant") return false;
  const status = outcomeStatus(reply);
  if (status === "failed" || status === "uncertain") return true;
  const p = reply.intent_payload ?? {};
  if (reply.intent_kind === "unknown") return true;
  if (reply.intent_kind === "clarify") return p.reason !== "speechAct";
  if (reply.intent_kind === AI_ANSWER_KIND) {
    return p.aiKind === "prose" && MISS_KINDS.has(request?.intent_kind ?? "");
  }
  return false;
}

/**
 * HUB-85 — the id of the reply the thread offers "Report" on, or null. Only
 * ever the latest reply, and never once it has been reported.
 */
export function reportOfferId(messages: readonly ThreadMessage[]): string | null {
  const visible = visibleMessages(messages);
  const last = visible[visible.length - 1];
  if (!last || last.role !== "assistant") return null;
  const request = [...visible].reverse().find((m) => m.role === "user") ?? null;
  return isMissedReply(last, request) ? last.id : null;
}

/** Report kind to preselect for a reply: a miss was "missed", anything else "wrong". */
export function defaultReportKind(
  messages: readonly ThreadMessage[],
  messageId: string | null,
): "missed" | "wrong" {
  const visible = visibleMessages(messages);
  const index = messageId ? visible.findIndex((m) => m.id === messageId) : visible.length - 1;
  const reply = visible[index];
  if (!reply || reply.role !== "assistant") return "missed";
  const request =
    visible
      .slice(0, index)
      .reverse()
      .find((m) => m.role === "user") ?? null;
  return isMissedReply(reply, request) ? "missed" : "wrong";
}

/** The thread has gone quiet: its last message is older than QUIET_AFTER_MS. */
export function isQuiet(messages: readonly ThreadMessage[], now: number = Date.now()): boolean {
  const visible = visibleMessages(messages);
  const last = visible[visible.length - 1];
  if (!last) return false;
  const at = Date.parse(last.created_at);
  return Number.isFinite(at) && now - at >= QUIET_AFTER_MS;
}

export interface ConversationLike {
  id: string;
  updated_at: string;
}

/**
 * Which conversation the next sentence joins. `explicit` is the session's
 * choice: `undefined` = automatic (the most recent, if active within 6 h),
 * `null` = a fresh chat (New chat, or the active one was archived), an id =
 * the chat picked or started here. An explicit id that went idle for 6 h
 * expires like any other.
 */
export function pickActiveConversation<T extends ConversationLike>(
  list: readonly T[] | undefined,
  explicit: string | null | undefined,
  now: number = Date.now(),
): T | null {
  if (explicit === null) return null;
  const candidate =
    typeof explicit === "string"
      ? (list?.find((c) => c.id === explicit) ?? null)
      : (list?.[0] ?? null);
  if (!candidate) return null;
  const at = Date.parse(candidate.updated_at);
  return Number.isFinite(at) && now - at < ACTIVE_WINDOW_MS ? candidate : null;
}

const TITLE_MAX = 48;

/**
 * HUB-52 — a past chat's title: its first sentence, tidied and cut at a word
 * boundary. Deterministic (same input → same title), never model-written.
 */
export function conversationTitle(firstUserText: string | null | undefined): string {
  const clean = (firstUserText ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?…,;:]+$/u, "");
  if (!clean) return "Untitled chat";
  const title = clean[0].toLocaleUpperCase("en-US") + clean.slice(1);
  if (title.length <= TITLE_MAX) return title;
  const cut = title.slice(0, TITLE_MAX);
  const space = cut.lastIndexOf(" ");
  return `${(space >= TITLE_MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/u, "")}…`;
}

export type HistoryGroup = "Today" | "Yesterday" | "This week" | "Earlier";

export function historyGroup(at: number, now: number = Date.now()): HistoryGroup {
  const diff = dayDiff(at, now);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "This week";
  return "Earlier";
}

/** Short stamp for a History row: time today, weekday this week, else the date. */
export function historyStamp(at: number, now: number = Date.now()): string {
  const diff = dayDiff(at, now);
  if (diff <= 0) return timeLabel(at);
  return dayLabel(at, now);
}
