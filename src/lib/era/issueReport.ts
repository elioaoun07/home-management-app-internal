// src/lib/era/issueReport.ts
// HUB-85 — what a "Report" from the ERA chat records. The owner reviews these
// in the PM Command Center (scripts/pm/era-issues.mjs imports them as Hub &
// ERA defects), so the snapshot carries everything needed to reproduce the
// miss without opening the app: the request, ERA's answer, the recent
// transcript with each turn's outcome, and what ERA actually changed.
//
// Pure: the API route loads the rows, this shapes them. Stored as the
// `intent_payload.issue` of a system `era_messages` row (intent_kind
// "issue_report"), so it lives in the conversation it describes.

export type IssueKind = "missed" | "wrong";

export interface IssueMessageLike {
  id: string;
  role: string;
  content: string;
  intent_kind: string | null;
  intent_face: string | null;
  intent_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface IssueActionLike {
  action: string;
  entity_type: string;
  entity_id: string | null;
  title: string;
  route: string;
  created_at: string;
}

export interface IssueTranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  intent: string | null;
  face: string | null;
  outcome: string | null;
  capability: string | null;
  entityIds: string[];
}

export interface IssueAction {
  action: string;
  entityType: string;
  entityId: string | null;
  title: string;
  route: string;
  at: string;
}

export interface EraIssueSnapshot {
  v: 1;
  kind: IssueKind;
  note: string | null;
  conversationId: string;
  /** The message the person reported; null = the conversation as a whole. */
  messageId: string | null;
  /** The sentence that was not handled (or handled wrongly). */
  request: string | null;
  /** ERA's answer to it. */
  reply: string | null;
  transcript: IssueTranscriptEntry[];
  actions: IssueAction[];
  reportedAt: string;
}

/** Turns kept per report — enough context, bounded for the PM corpus. */
export const ISSUE_TRANSCRIPT_MAX = 24;
export const ISSUE_TEXT_MAX = 400;
export const ISSUE_ACTIONS_MAX = 20;
/** Actions logged this long before the first kept turn still belong to it. */
const ACTION_LEAD_MS = 60_000;

function clip(text: string, max = ISSUE_TEXT_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function entry(m: IssueMessageLike): IssueTranscriptEntry {
  const p = m.intent_payload ?? {};
  const outcome = (p.outcome ?? null) as {
    status?: unknown;
    capability?: unknown;
    entityIds?: unknown;
  } | null;
  return {
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    text: clip(m.content),
    at: m.created_at,
    intent: m.intent_kind,
    face: m.intent_face,
    outcome: typeof outcome?.status === "string" ? outcome.status : null,
    capability: typeof outcome?.capability === "string" ? outcome.capability : null,
    entityIds: Array.isArray(outcome?.entityIds)
      ? outcome.entityIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

/** The earliest moment whose ERA actions belong to a report of `messages`. */
export function issueWindowStart(
  messages: readonly IssueMessageLike[],
  messageId: string | null,
): string | null {
  const turns = reportedTurns(messages, messageId);
  const first = turns[0];
  if (!first) return null;
  const at = Date.parse(first.created_at);
  return Number.isFinite(at) ? new Date(at - ACTION_LEAD_MS).toISOString() : null;
}

function reportedTurns(
  messages: readonly IssueMessageLike[],
  messageId: string | null,
): IssueMessageLike[] {
  const turns = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const cut = messageId ? turns.findIndex((m) => m.id === messageId) : -1;
  const upTo = cut >= 0 ? turns.slice(0, cut + 1) : turns;
  return upTo.slice(-ISSUE_TRANSCRIPT_MAX);
}

export function buildIssueSnapshot(input: {
  conversationId: string;
  messageId: string | null;
  kind: IssueKind;
  note?: string | null;
  messages: readonly IssueMessageLike[];
  actions: readonly IssueActionLike[];
  now?: Date;
}): EraIssueSnapshot {
  const turns = reportedTurns(input.messages, input.messageId);
  const reported = input.messageId
    ? (turns.find((m) => m.id === input.messageId) ?? null)
    : (turns[turns.length - 1] ?? null);
  const reportedIndex = reported ? turns.indexOf(reported) : -1;

  // The request is the person's sentence at or before the reported turn; the
  // reply is ERA's first answer after it.
  const requestIndex = (() => {
    for (let i = reportedIndex; i >= 0; i -= 1) if (turns[i].role === "user") return i;
    return -1;
  })();
  const request = requestIndex >= 0 ? turns[requestIndex] : null;
  const reply =
    turns.slice(requestIndex + 1).find((m) => m.role === "assistant") ??
    (reported?.role === "assistant" ? reported : null);

  const start = issueWindowStart(input.messages, input.messageId);
  const startMs = start ? Date.parse(start) : Number.NEGATIVE_INFINITY;
  const actions = input.actions
    .filter((a) => Date.parse(a.created_at) >= startMs)
    .slice(0, ISSUE_ACTIONS_MAX)
    .map((a) => ({
      action: a.action,
      entityType: a.entity_type,
      entityId: a.entity_id,
      title: clip(a.title, 160),
      route: a.route,
      at: a.created_at,
    }));

  const note = input.note?.trim() ? clip(input.note, 500) : null;

  return {
    v: 1,
    kind: input.kind,
    note,
    conversationId: input.conversationId,
    messageId: input.messageId,
    request: request ? clip(request.content) : null,
    reply: reply ? clip(reply.content) : null,
    transcript: turns.map(entry),
    actions,
    reportedAt: (input.now ?? new Date()).toISOString(),
  };
}

/** The system row's `content` — short; the thread shows a marker, not this. */
export function issueRowContent(snapshot: EraIssueSnapshot): string {
  const subject = snapshot.request ?? snapshot.reply ?? "conversation";
  return clip(`Reported (${snapshot.kind}): ${subject}`, 300);
}
