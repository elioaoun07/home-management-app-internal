// src/features/era/aiUsage.ts
// ERA AI Usage tab — pure aggregation + cost estimate. No React, no fetch —
// see aiUsage.test.ts.
//
// Only model calls count. Tokens come from the `ai_messages` receipts that
// /api/era/ask writes per call (session "era-ask" = a tapped Ask AI,
// "era-ask-auto" = a native turn auto-escalated to AI). Native turns never
// reach the model and never write a receipt, so a native-only chat costs
// nothing and never appears. A chat is linked on a day when it has an
// `ai_answer` row (thread.ts AI_ANSWER_KIND) that day.

import { formatDate } from "@/lib/utils/date";

/** USD per 1M tokens. List prices; estimates only. */
interface Rate {
  input: number;
  output: number;
}

// Most specific first — "claude-opus-5-5" must win over "claude-opus-5".
// Recorded input tokens include cache reads/writes at the full input rate,
// so Claude estimates lean high.
const CLAUDE_RATES: ReadonlyArray<readonly [string, Rate]> = [
  ["claude-fable-5-1", { input: 10, output: 50 }],
  ["claude-fable-5", { input: 10, output: 50 }],
  ["claude-opus-5-5", { input: 4, output: 20 }],
  ["claude-opus-5", { input: 5, output: 25 }],
  ["claude-sonnet-5-5", { input: 2, output: 10 }],
  ["claude-sonnet-5", { input: 2, output: 10 }],
  ["claude-haiku-5-5", { input: 0.1, output: 0.5 }],
  ["claude-haiku-4-5", { input: 1, output: 5 }],
];
// Pre-HUB-107 ERA calls ran on Gemini Flash ("gemini-flash-latest").
const GEMINI_FLASH_LITE: Rate = { input: 0.1, output: 0.4 };
const GEMINI_FLASH: Rate = { input: 0.3, output: 2.5 };

/** Rate for an `ai_messages.model_used` value, or null when unpriced. */
export function rateOf(modelUsed: string | null | undefined): Rate | null {
  const model = (modelUsed ?? "").split(":")[0].trim().toLowerCase();
  if (!model) return null;
  for (const [prefix, rate] of CLAUDE_RATES) if (model.startsWith(prefix)) return rate;
  if (model.includes("gemini") && model.includes("flash-lite")) return GEMINI_FLASH_LITE;
  if (model.includes("gemini") && model.includes("flash")) return GEMINI_FLASH;
  return null;
}

/** One `ai_messages` receipt row (two per call: user = input, assistant = output). */
export interface AiUsageReceipt {
  created_at: string;
  role: "user" | "assistant" | "system";
  session_id: string;
  input_tokens: number | null;
  output_tokens: number | null;
  model_used: string | null;
}

/** An `ai_answer` row: the chat a model answer landed in. */
export interface AiAnswerRef {
  conversation_id: string;
  created_at: string;
}

export interface AiUsageChat {
  id: string;
  title: string;
  active_face_key: string;
  created_at: string;
  updated_at: string;
}

export interface AiUsageResponse {
  receipts: AiUsageReceipt[];
  answers: AiAnswerRef[];
  chats: AiUsageChat[];
}

export const AUTO_SESSION_ID = "era-ask-auto";

export interface AiUsageTotals {
  calls: number;
  autoCalls: number;
  input: number;
  output: number;
  cost: number;
  /** Tokens from a model with no known rate (not in `cost`). */
  unpricedTokens: number;
}

export interface AiUsageDay extends AiUsageTotals {
  /** Local yyyy-MM-dd. */
  key: string;
  chats: AiUsageChat[];
}

const emptyTotals = (): AiUsageTotals => ({
  calls: 0,
  autoCalls: 0,
  input: 0,
  output: 0,
  cost: 0,
  unpricedTokens: 0,
});

function addReceipt(t: AiUsageTotals, r: AiUsageReceipt, model: string | null): void {
  const input = r.input_tokens ?? 0;
  const output = r.output_tokens ?? 0;
  // One call = one assistant receipt (the user receipt carries its input).
  if (r.role === "assistant") {
    t.calls += 1;
    if (r.session_id === AUTO_SESSION_ID) t.autoCalls += 1;
  }
  t.input += input;
  t.output += output;
  const rate = rateOf(model);
  if (rate) t.cost += (input * rate.input + output * rate.output) / 1_000_000;
  else t.unpricedTokens += input + output;
}

/** Days with AI activity, newest first, plus the month total. Days are local. */
export function aggregateAiUsage(data: AiUsageResponse): {
  days: AiUsageDay[];
  total: AiUsageTotals;
} {
  const byDay = new Map<string, AiUsageDay>();
  const day = (iso: string): AiUsageDay => {
    const key = formatDate(new Date(iso));
    let d = byDay.get(key);
    if (!d) {
      d = { key, chats: [], ...emptyTotals() };
      byDay.set(key, d);
    }
    return d;
  };

  // Pre-Claude receipts left model_used empty on the input row; its output
  // row (same call = same session + insert timestamp) names the model.
  const callKey = (r: AiUsageReceipt) => `${r.session_id}|${r.created_at}`;
  const modelOfCall = new Map<string, string>();
  for (const r of data.receipts) if (r.model_used) modelOfCall.set(callKey(r), r.model_used);

  const total = emptyTotals();
  for (const r of data.receipts) {
    const model = r.model_used ?? modelOfCall.get(callKey(r)) ?? null;
    addReceipt(day(r.created_at), r, model);
    addReceipt(total, r, model);
  }

  const chatById = new Map(data.chats.map((c) => [c.id, c]));
  const answers = [...data.answers].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const a of answers) {
    const chat = chatById.get(a.conversation_id);
    if (!chat) continue;
    const d = day(a.created_at);
    if (!d.chats.some((c) => c.id === chat.id)) d.chats.push(chat);
  }

  const days = [...byDay.values()].sort((a, b) => b.key.localeCompare(a.key));
  return { days, total };
}

/** `yyyy-MM` of a local date. */
export const monthKeyOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Local-midnight bounds of a `yyyy-MM` month, as ISO instants. */
export function monthBounds(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split("-").map(Number);
  return {
    from: new Date(y, m - 1, 1).toISOString(),
    to: new Date(y, m, 1).toISOString(),
  };
}

/** The month `delta` months from `monthKey`. */
export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
}

/** "$0.0123" under a dollar, "$4.56" above. */
export function formatUsd(cost: number): string {
  return `$${cost.toFixed(cost < 1 ? 4 : 2)}`;
}
