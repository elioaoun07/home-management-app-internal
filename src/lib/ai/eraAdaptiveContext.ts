// Personal context is a request-scoped view of evidence, not a second fact store.
// Nothing here promotes a habit to a default, supplies executable IDs, or writes.
import { z } from "zod";
import { tokenize } from "@/features/era/capabilities/vocab";
import { parseEraArtifacts } from "@/lib/era/artifacts";
import { getCapability } from "@/features/era/capabilities/registry";

export const ADAPTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const ADAPTIVE_MESSAGE_LIMIT = 400;
export const ADAPTIVE_CONTEXT_MAX_CHARS = 12_000;
export type Coverage = "sampled" | "available" | "unavailable";
export interface ContextMessage {
  id: string;
  user_id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
  intent_kind?: string | null;
  intent_payload?: Record<string, unknown> | null;
}
export interface ContextRule {
  id: string;
  user_id: string;
  kind: "alias" | "default" | "example";
  capability: string;
  phrase?: string | null;
  slot?: string | null;
  conditions: Record<string, unknown>;
  value: Record<string, unknown>;
  depends_on: string[];
  revoked_at?: string | null;
  source_message_id?: string | null;
}
export interface AdaptiveContext {
  version: 1;
  coverage: Record<string, Coverage>;
  window: { from: string; until: string; messageLimit: number };
  settings: { monthStart: string | null };
  choices: Array<{
    source: string;
    kind: "explicit" | "observed";
    capability: string;
    phrase: string | null;
    slot: string | null;
    conditions: Record<string, unknown>;
    value: Record<string, unknown>;
    observations: number;
  }>;
  episodes: Array<{
    source: string;
    at: string;
    request: string;
    evidence: "user_statement" | "acknowledged_action";
    result: string | null;
    capabilities: string[];
  }>;
  usage: Array<{ module: string; events: number }>;
  gaps: Array<{ kind: string; subject: string; observations: number }>;
}
export interface ContextReceipt {
  version: 1;
  coverage: AdaptiveContext["coverage"];
  episodeSources: string[];
  choiceSources: string[];
  chars: number;
}
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const clip = (s: string, max = 600) =>
  s.replace(/\s+/g, " ").trim().slice(0, max);

/** Only acknowledged outcomes count. Missing/optimistic prose is not success.
 * A plan must have receipts for every step and artifacts for every write. */
export function successfulCapabilities(m: ContextMessage): string[] {
  const p = m.intent_payload ?? {};
  const outcome = record(p.outcome);
  if (
    m.role !== "assistant" ||
    !["done", "answered"].includes(String(outcome.status))
  )
    return [];
  if (outcome.capability === "agent.plan") {
    const run = record(p.agentRun);
    const plan = record(p.plan);
    if (
      run.status !== "done" ||
      !Array.isArray(run.steps) ||
      !Array.isArray(plan.steps) ||
      run.steps.length !== plan.steps.length ||
      !run.steps.length
    )
      return [];
    const caps: string[] = [];
    for (let i = 0; i < run.steps.length; i++) {
      const step = record(run.steps[i]);
      const declared = record(plan.steps[i]);
      if (
        step.status !== "done" ||
        step.id !== declared.id ||
        step.capabilityId !== declared.capabilityId ||
        typeof step.capabilityId !== "string"
      )
        return [];
      // Read receipts have no artifact; validated metadata is their evidence.
      const cap = getCapability(step.capabilityId);
      if (
        !cap ||
        (cap.operation !== "read" &&
          !parseEraArtifacts(step.artifacts).some((a) => a.id))
      )
        return [];
      caps.push(step.capabilityId);
    }
    // For a plan marked done, at least one persisted artifact is required
    // when its aggregate outcome claims entity writes.
    if (
      Array.isArray(outcome.entityIds) &&
      outcome.entityIds.length &&
      !parseEraArtifacts(
        p.artifacts ?? run.steps.flatMap((s) => record(s).artifacts ?? []),
      ).some((a) => a.id)
    )
      return [];
    return caps;
  }
  if (typeof outcome.capability !== "string" || !outcome.capability) return [];
  if (
    outcome.status === "answered" &&
    getCapability(outcome.capability)?.operation !== "read"
  )
    return [];
  if (
    outcome.status === "done" &&
    !parseEraArtifacts(p.artifacts).some((a) => a.id)
  )
    return [];
  return [outcome.capability];
}

/** Relevance is document-derived (IDF), not a list of taught utterances.
 * Recent user statements remain attributed evidence, never inferred facts. */
export function assembleAdaptiveContext(input: {
  owner: string;
  message: string;
  conversationId?: string | null;
  now: Date;
  messages: ContextMessage[];
  rules: ContextRule[];
  accounts: Array<{ id: string; user_id: string; name: string }>;
  monthStart?: string | null;
  activity: Array<{
    actor_id: string | null;
    owner_id: string;
    available: boolean;
    module: string;
  }>;
  coverage: AdaptiveContext["coverage"];
}): AdaptiveContext {
  const now = input.now.getTime();
  const messages = input.messages
    .filter(
      (m) =>
        m.user_id === input.owner &&
        Number.isFinite(Date.parse(m.created_at)) &&
        Date.parse(m.created_at) <= now &&
        Date.parse(m.created_at) >= now - ADAPTIVE_WINDOW_MS,
    )
    .sort(
      (a, b) =>
        Date.parse(a.created_at) - Date.parse(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  const reportedMessages = new Set<string>();
  const reportedConversations = new Set<string>();
  const gapCounts = new Map<
    string,
    { kind: string; subject: string; observations: number }
  >();
  const gap = (kind: string, subject: string) => {
    const key = `${kind}:${subject}`;
    const prior = gapCounts.get(key);
    gapCounts.set(key, {
      kind,
      subject: clip(subject, 80),
      observations: (prior?.observations ?? 0) + 1,
    });
  };
  for (const m of messages) {
    const p = m.intent_payload ?? {};
    if (m.role === "system" && m.intent_kind === "issue_report") {
      const issue = record(p.issue);
      if (typeof issue.messageId === "string")
        reportedMessages.add(issue.messageId);
      else reportedConversations.add(m.conversation_id);
      // Report content is deliberately not fed back as successful dialogue.
      if (issue.kind === "wrong" || issue.kind === "missed")
        gap("reported", String(issue.kind));
    }
    if (
      m.role === "assistant" &&
      (p.missKind === "language-gap" || p.missKind === "capability-gap")
    )
      gap(
        String(p.missKind),
        typeof p.matchedEntity === "string" ? p.matchedEntity : "unresolved",
      );
  }
  const excluded = (m: ContextMessage) =>
    reportedMessages.has(m.id) || reportedConversations.has(m.conversation_id);
  const conversations = new Map<string, ContextMessage[]>();
  for (const m of messages) {
    if (m.role === "system") continue;
    const rows = conversations.get(m.conversation_id) ?? [];
    rows.push(m);
    conversations.set(m.conversation_id, rows);
  }
  const candidates: AdaptiveContext["episodes"] = [];
  for (const [id, rows] of conversations) {
    if (id === input.conversationId || reportedConversations.has(id)) continue;
    for (let i = 0; i < rows.length; i++) {
      const user = rows[i];
      if (user.role !== "user" || excluded(user)) continue;
      const replies: ContextMessage[] = [];
      for (let j = i + 1; j < rows.length && rows[j].role !== "user"; j++)
        replies.push(rows[j]);
      if (replies.some(excluded)) continue;
      const acknowledged = replies.filter(
        (m) => successfulCapabilities(m).length,
      );
      // Pending, failed, uncertain or reported interactions cannot be examples.
      // Confirmation appends a later receipt to the same user turn. Its
      // initial awaiting_confirm row must not erase that acknowledged result.
      const latestReply = replies.at(-1);
      if (
        latestReply &&
        [
          "failed",
          "uncertain",
          "partial",
          "needs_input",
          "awaiting_confirm",
          "drafted",
          "handed_off",
        ].includes(String(record(latestReply.intent_payload?.outcome).status))
      )
        continue;
      candidates.push({
        source: user.id,
        at: user.created_at,
        request: clip(user.content),
        evidence: acknowledged.length
          ? "acknowledged_action"
          : "user_statement",
        result: acknowledged.length ? clip(acknowledged.at(-1)!.content) : null,
        capabilities: [
          ...new Set(acknowledged.flatMap(successfulCapabilities)),
        ],
      });
    }
  }
  const query = new Set(tokenize(input.message));
  const terms = candidates.map((e) => new Set(tokenize(e.request)));
  const frequencies = new Map<string, number>();
  terms.forEach((ts) =>
    ts.forEach((t) => frequencies.set(t, (frequencies.get(t) ?? 0) + 1)),
  );
  const ranked = candidates
    .map((e, i) => ({
      e,
      score: [...query].reduce(
        (s, t) =>
          s +
          (terms[i].has(t)
            ? Math.log(1 + candidates.length / (frequencies.get(t) ?? 1))
            : 0),
        0,
      ),
    }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) => b.score - a.score || Date.parse(b.e.at) - Date.parse(a.e.at),
    );
  const picked = new Map<string, AdaptiveContext["episodes"][number]>();
  ranked.slice(0, 4).forEach((x) => picked.set(x.e.source, x.e));
  // Two recent experiences supply context for paraphrases/unstated topics.
  candidates
    .slice(-2)
    .reverse()
    .forEach((e) => {
      if (picked.size < 6) picked.set(e.source, e);
    });

  const accounts = new Map(
    input.accounts
      .filter((a) => a.user_id === input.owner)
      .map((a) => [a.id, a.name]),
  );
  const choices: AdaptiveContext["choices"] = [];
  for (const r of input.rules) {
    if (
      r.user_id !== input.owner ||
      r.revoked_at ||
      r.depends_on.some((id) => !accounts.has(id))
    )
      continue;
    if (r.source_message_id && reportedMessages.has(r.source_message_id))
      continue;
    // Legacy examples were sometimes captured at a chip choice, before the
    // action was confirmed. Only linked, acknowledged evidence is a habit.
    if (r.kind === "example") {
      const source = messages.find(
        (m) => m.id === r.source_message_id && !excluded(m),
      );
      const verified =
        source &&
        (successfulCapabilities(source).includes(r.capability) ||
          candidates.some(
            (e) =>
              e.source === source.id && e.capabilities.includes(r.capability),
          ));
      if (!verified) continue;
    }
    // Account references can be rebound now. Other rule values may contain
    // untracked group IDs: omit them until their source has a resolver.
    const ids = Object.entries(r.value).filter(
      ([key]) => key === "id" || key.endsWith("Id"),
    );
    if (ids.some(([, v]) => typeof v !== "string" || !accounts.has(v)))
      continue;
    const value = Object.fromEntries(
      Object.entries(r.value).map(([k, v]) => [
        k,
        accounts.get(String(v)) ?? v,
      ]),
    );
    const conditions = Object.fromEntries(
      Object.entries(r.conditions).map(([k, v]) => [
        k,
        accounts.get(String(v)) ?? v,
      ]),
    );
    const item = {
      source: r.id,
      kind:
        r.kind === "example" ? ("observed" as const) : ("explicit" as const),
      capability: r.capability,
      phrase: r.phrase ? clip(r.phrase, 120) : null,
      slot: r.slot ?? null,
      conditions,
      value,
      observations: 1,
    };
    const key = JSON.stringify([
      item.kind,
      item.capability,
      item.phrase,
      item.slot,
      conditions,
      value,
    ]);
    const existing = choices.find(
      (c) =>
        JSON.stringify([
          c.kind,
          c.capability,
          c.phrase,
          c.slot,
          c.conditions,
          c.value,
        ]) === key,
    );
    if (existing) existing.observations++;
    else if (choices.length < 12 && JSON.stringify(item).length <= 800)
      choices.push(item);
  }
  const usage = new Map<string, number>();
  for (const e of input.activity) {
    // No partner titles, health facts, record values or source IDs are sent.
    if (
      e.actor_id !== input.owner ||
      e.owner_id !== input.owner ||
      !e.available
    )
      continue;
    usage.set(e.module, (usage.get(e.module) ?? 0) + 1);
  }
  return {
    version: 1,
    coverage: input.coverage,
    window: {
      from: new Date(now - ADAPTIVE_WINDOW_MS).toISOString(),
      until: input.now.toISOString(),
      messageLimit: ADAPTIVE_MESSAGE_LIMIT,
    },
    settings: { monthStart: input.monthStart ?? null },
    choices,
    episodes: [...picked.values()].sort(
      (a, b) =>
        Date.parse(a.at) - Date.parse(b.at) || a.source.localeCompare(b.source),
    ),
    usage: [...usage]
      .map(([module, events]) => ({ module, events }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 12),
    gaps: [...gapCounts.values()]
      .sort((a, b) => b.observations - a.observations)
      .slice(0, 8),
  };
}

export function boundAdaptiveContext(
  context: AdaptiveContext,
): AdaptiveContext {
  const bounded = {
    ...context,
    choices: [...context.choices],
    episodes: [...context.episodes],
  };
  while (
    JSON.stringify(bounded).length > ADAPTIVE_CONTEXT_MAX_CHARS &&
    (bounded.episodes.length || bounded.choices.length)
  ) {
    if (bounded.episodes.length) bounded.episodes.shift();
    else bounded.choices.pop();
  }
  return bounded;
}
export function contextReceipt(context: AdaptiveContext): ContextReceipt {
  return {
    version: 1,
    coverage: context.coverage,
    episodeSources: context.episodes.map((e) => e.source),
    choiceSources: context.choices.map((c) => c.source),
    chars: JSON.stringify(context).length,
  };
}

export const historyEntrySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

/** Merge persisted history with an owner-checked optimistic tail. The longest
 * suffix/prefix overlap preserves repeated identical requests in real chats. */
export function mergeAskHistory(
  saved: HistoryEntry[],
  tail: HistoryEntry[],
  message: string,
): HistoryEntry[] {
  saved = [...saved];
  tail = [...tail];
  // The current question can already exist on either side of the persistence
  // race. Remove it BEFORE overlap detection, then Gemini gets it once.
  if (saved.at(-1)?.role === "user" && saved.at(-1)?.content === message)
    saved.pop();
  if (tail.at(-1)?.role === "user" && tail.at(-1)?.content === message)
    tail.pop();
  let overlap = Math.min(saved.length, tail.length);
  while (
    overlap &&
    !saved
      .slice(-overlap)
      .every((m, i) => m.role === tail[i].role && m.content === tail[i].content)
  )
    overlap--;
  const merged = [...saved, ...tail.slice(overlap)];
  const out: HistoryEntry[] = [];
  let chars = 0;
  for (const m of merged.slice(-24).reverse()) {
    const content = clip(m.content, 1000);
    if (chars + content.length > 12_000) break;
    out.unshift({ role: m.role, content });
    chars += content.length;
  }
  return out;
}
