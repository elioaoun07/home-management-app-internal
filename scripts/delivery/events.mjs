// scripts/delivery/events.mjs
// Append-only ndjson event log format + usage reducer.
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/2 - Architecture & Process Model.md §4
// and 4 - Agent Drivers & Security.md §1.
//
// Pure string/array operations only — actual file I/O (appendFileSync) is
// fsx.mjs's job in the runner (S2+). Zero-dependency.

/**
 * @typedef {{ts:string, seq:number, type:string, phase:(string|null), agent:(string|null), data:object}} DeliveryEvent
 * @typedef {{input:number, cachedInput:number, output:number, costUsd:(number|null)}} UsageTotals
 */

export class EventsError extends Error {}

export const TRUNCATE_LIMITS = Object.freeze({ command: 500, message: 2000 });

/** Truncate a field to `max` chars (doc 4 §1: command lines to 500, messages to 2000). */
export function truncateField(value, max) {
  const s = String(value == null ? "" : value);
  return s.length > max ? s.slice(0, max) : s;
}

/** Normalized event `type` for provider-sourced events: `agent.<kind>`. */
export function agentEventType(kind) {
  return `agent.${kind}`;
}

/**
 * Parse ndjson text into an array of event objects, in file order.
 * @param {string} ndjsonText
 * @returns {DeliveryEvent[]}
 */
export function parseEvents(ndjsonText) {
  const text = String(ndjsonText == null ? "" : ndjsonText);
  if (!text.trim()) return [];
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new EventsError(`invalid ndjson at line ${i + 1}: ${err.message}`);
      }
    });
}

export function formatEvent(event) {
  return JSON.stringify(event);
}

/**
 * Next seq number given the events already present (1-based, monotonic).
 * @param {DeliveryEvent[]} existingEvents
 */
export function nextSeq(existingEvents) {
  if (!existingEvents.length) return 1;
  const maxSeq = existingEvents.reduce((m, e) => Math.max(m, e.seq || 0), 0);
  return maxSeq + 1;
}

/**
 * Compute the new ndjson text + the fully-formed event for appending one event
 * to existing ndjson text. Pure — caller persists `.text` via fsx.mjs.
 * @param {string} currentNdjson
 * @param {{type:string, phase?:(string|null), agent?:(string|null), data?:object, ts?:string}} partial
 * @returns {{text:string, event:DeliveryEvent}}
 */
export function appendEvent(currentNdjson, partial) {
  if (!partial || !partial.type) {
    throw new EventsError("event.type is required");
  }
  const existing = parseEvents(currentNdjson);
  const seq = nextSeq(existing);
  const event = {
    ts: partial.ts || new Date().toISOString(),
    seq,
    type: partial.type,
    phase: partial.phase != null ? partial.phase : null,
    agent: partial.agent != null ? partial.agent : null,
    data: partial.data != null ? partial.data : {},
  };
  const base = String(currentNdjson == null ? "" : currentNdjson);
  const sep = base && !base.endsWith("\n") ? "\n" : "";
  return { text: base + sep + formatEvent(event) + "\n", event };
}

/**
 * Replay: parse + return events after (and including) a given seq cursor.
 * @param {string} ndjsonText
 * @param {number} [afterSeq]
 * @returns {DeliveryEvent[]}
 */
export function replayAfter(ndjsonText, afterSeq = 0) {
  return parseEvents(ndjsonText).filter((e) => (e.seq || 0) > afterSeq);
}

// ---- usage normalization + reduction (doc 4 §1, §2) ----

/** @returns {UsageTotals} */
function emptyUsage() {
  return { input: 0, cachedInput: 0, output: 0, costUsd: null };
}

/**
 * Normalize a provider-native usage object into `{input, cachedInput, output, costUsd}`.
 * Codex: `{input_tokens, cached_input_tokens, output_tokens, cost_usd?}`
 * Claude: `{input_tokens, cache_read_input_tokens, output_tokens, total_cost_usd?}`
 * @param {object} raw
 * @param {"codex"|"claude"} provider
 * @returns {UsageTotals}
 */
export function normalizeUsage(raw, provider) {
  if (!raw) return emptyUsage();
  if (provider === "codex") {
    return {
      input: raw.input_tokens || 0,
      cachedInput: raw.cached_input_tokens || 0,
      output: raw.output_tokens || 0,
      costUsd: typeof raw.cost_usd === "number" ? raw.cost_usd : null,
    };
  }
  if (provider === "claude") {
    return {
      input: raw.input_tokens || 0,
      cachedInput: raw.cache_read_input_tokens || 0,
      output: raw.output_tokens || 0,
      costUsd: typeof raw.total_cost_usd === "number" ? raw.total_cost_usd : null,
    };
  }
  throw new EventsError(`unknown provider for usage normalization: ${provider}`);
}

/**
 * @param {UsageTotals} target
 * @param {UsageTotals} usage
 */
function accumulate(target, usage) {
  target.input += (usage && usage.input) || 0;
  target.cachedInput += (usage && usage.cachedInput) || 0;
  target.output += (usage && usage.output) || 0;
  if (usage && typeof usage.costUsd === "number") {
    target.costUsd = (target.costUsd || 0) + usage.costUsd;
  }
}

/**
 * Reduce already-normalized `{phase, usage}` records into the `state.json.usage`
 * shape: `{perPhase:{phase:{input,cachedInput,output,costUsd}}, total:{...}}`.
 * @param {{phase?:string, usage:UsageTotals}[]} records
 * @returns {{perPhase:Object<string,UsageTotals>, total:UsageTotals}}
 */
export function reduceUsage(records) {
  /** @type {Object<string,UsageTotals>} */
  const perPhase = {};
  const total = emptyUsage();
  for (const record of records || []) {
    const phase = record.phase || "unknown";
    if (!perPhase[phase]) perPhase[phase] = emptyUsage();
    accumulate(perPhase[phase], record.usage);
    accumulate(total, record.usage);
  }
  return { perPhase, total };
}
