// scripts/delivery/transcript.mjs
// Full-fidelity conversation transcript: per-turn record shards + the
// turns.ndjson index. This is the Delivery-owned raw event log (L1) that the
// curated, truncated events.ndjson (doc "4 - Agent Drivers & Security.md")
// was never meant to be — everything a driver streams for a turn is kept
// here, bounded per record instead of silently dropped.
// See ERA Notes/10 - Project Management/Delivery Workspace/ (DW-1).
//
// Pure string/array operations only, mirroring events.mjs's split between
// "pure ndjson mutation" (here) and "actual file I/O" (fsx.mjs, called from
// run-session.mjs). Turn/record sequence numbers are assigned by the caller
// from an in-memory counter (state.json `turnCounter` / per-turn record
// counters) — unlike events.mjs's `nextSeq`, nothing here reparses existing
// ndjson to find the next number, so appending stays O(1) regardless of
// session length.

export class TranscriptError extends Error {}

/** Default per-record cap before head/tail truncation kicks in (doc: 64 KiB). */
export const DEFAULT_MAX_RECORD_BYTES = 65536;

/** Recognized full-fidelity record kinds (transcript/t-NNNN.ndjson). */
export const RECORD_KINDS = Object.freeze([
  "prompt",
  "assistant.text",
  "assistant.reasoning",
  "tool.use",
  "tool.result",
  "command",
  "file.change",
  "web.search",
  "todo",
  "system.init",
  "system.compact",
  "turn.result",
  "error",
]);

/** Turn-level outcome (transcript/turns.ndjson `result`). */
export const TURN_RESULTS = Object.freeze(["ok", "failed", "guard-violation", "aborted", "crashed"]);

/** Context-strategy that produced a turn (transcript/turns.ndjson `strategy`). */
export const TURN_STRATEGIES = Object.freeze([
  "start",
  "resume-native",
  "resume-with-overrides",
  "rotate-fresh",
  "handoff",
  "fork",
]);

// ---- turn id / file naming ----

/** Zero-padded 4-digit turn id from a 1-based counter, e.g. 7 -> "0007". */
export function formatTurnId(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TranscriptError(`turn counter must be a positive integer, got ${n}`);
  }
  return String(n).padStart(4, "0");
}

/** Record-shard file name for a turn, relative to `transcript/`. */
export function turnShardFileName(turnId) {
  return `t-${turnId}.ndjson`;
}

/** Assembled-prompt file name for a turn, relative to `transcript/prompts/`. */
export function turnPromptFileName(turnId) {
  return `${turnId}.md`;
}

// ---- per-record truncation (head/tail split, honest markers) ----

/**
 * Truncate `value` to at most `maxBytes` UTF-8 bytes using a head/tail split
 * (keep the start and the end, drop the middle) so both "what was asked" and
 * "how it ended" survive even for huge tool output. Returns the original
 * value unchanged (and `truncated: null`) when it already fits.
 * @param {*} value
 * @param {number} [maxBytes]
 * @returns {{text:string, truncated:({originalBytes:number, keptHeadBytes:number, keptTailBytes:number}|null)}}
 */
export function truncateRecordText(value, maxBytes = DEFAULT_MAX_RECORD_BYTES) {
  const text = String(value == null ? "" : value);
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return { text, truncated: null };
  const marker = "\n…\n";
  const markerBytes = Buffer.byteLength(marker, "utf8");
  const budget = Math.max(0, maxBytes - markerBytes);
  const headBytes = Math.floor(budget / 2);
  const tailBytes = budget - headBytes;
  const head = buf.subarray(0, headBytes).toString("utf8");
  const tail = tailBytes > 0 ? buf.subarray(buf.length - tailBytes).toString("utf8") : "";
  return {
    text: `${head}${marker}${tail}`,
    truncated: { originalBytes: buf.length, keptHeadBytes: headBytes, keptTailBytes: tailBytes },
  };
}

// ---- full-fidelity records (transcript/t-NNNN.ndjson) ----

/**
 * Build one full-fidelity transcript record. Any string-valued extra field
 * (`text`, `output`, ...) is truncated per `truncateRecordText`; the last
 * field that required truncation sets the record's `truncated` marker
 * (records only ever carry one large string field in practice).
 * @param {{turnId:string, seq:number, ts?:string, kind:string, provider?:(string|null),
 *   maxRecordBytes?:number, [key:string]:*}} fields
 * @returns {*} the record has a fixed core (v/turnId/seq/ts/kind/provider) plus
 *   whatever extra fields the caller passed — too dynamic to give a precise
 *   static shape, so consumers (run-session.mjs, tests) treat it structurally.
 */
export function buildRecord({
  turnId,
  seq,
  ts,
  kind,
  provider = null,
  maxRecordBytes = DEFAULT_MAX_RECORD_BYTES,
  ...rest
}) {
  if (!turnId) throw new TranscriptError("record.turnId is required");
  if (typeof seq !== "number") throw new TranscriptError("record.seq must be a number");
  if (!kind || !RECORD_KINDS.includes(kind)) {
    throw new TranscriptError(`unknown record kind "${kind}"`);
  }
  const record = {
    v: 1,
    turnId,
    seq,
    ts: ts || new Date().toISOString(),
    kind,
    provider,
  };
  let truncatedInfo = null;
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      const { text, truncated } = truncateRecordText(value, maxRecordBytes);
      record[key] = text;
      if (truncated) truncatedInfo = truncated;
    } else {
      record[key] = value;
    }
  }
  if (truncatedInfo) record.truncated = truncatedInfo;
  return record;
}

export function formatRecord(record) {
  return JSON.stringify(record);
}

/** Parse ndjson text into an array of record objects, in file order. */
export function parseTurnRecords(ndjsonText) {
  const text = String(ndjsonText == null ? "" : ndjsonText);
  if (!text.trim()) return [];
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new TranscriptError(`invalid transcript ndjson at line ${i + 1}: ${err.message}`);
      }
    });
}

/**
 * Pure text mutation: append an already-built record to existing shard text.
 * No reparse — the caller supplies `seq` from an in-memory counter, so this
 * stays O(1) regardless of how large the shard has grown.
 * @param {string} currentNdjson
 * @param {object} record
 */
export function appendRecordText(currentNdjson, record) {
  if (!record || !record.kind) throw new TranscriptError("record is required to append");
  const base = String(currentNdjson == null ? "" : currentNdjson);
  const sep = base && !base.endsWith("\n") ? "\n" : "";
  return base + sep + formatRecord(record) + "\n";
}

// ---- turn index (transcript/turns.ndjson) ----

/**
 * Build one turns.ndjson entry (the per-turn usage/strategy/outcome record —
 * the atomic source of truth for usage aggregation, see usage.mjs).
 * @param {{turnId:string, phase?:(string|null), agent?:(string|null), provider?:(string|null),
 *   model?:(string|null), effort?:(string|null), startedAt:string, durationMs?:(number|null),
 *   promptFile:string, recordsFile:string, records?:number, usage?:(object|null),
 *   costUsd?:(number|null), costEstUsd?:(number|null), pricingVersion?:(string|null),
 *   context?:(object|null), result:string, strategy:string, snapshotRef?:(string|null),
 *   configChangeRef?:(string|null), compactBoundaries?:(object[]|null),
 *   workspaceDelta?:({changedPaths:string[]}|null)}} fields
 */
export function buildTurnEntry({
  turnId,
  phase = null,
  agent = null,
  provider = null,
  model = null,
  effort = null,
  startedAt,
  durationMs = null,
  promptFile,
  recordsFile,
  records = 0,
  usage = null,
  costUsd = null,
  costEstUsd = null,
  pricingVersion = null,
  context = null,
  result,
  strategy,
  snapshotRef = null,
  configChangeRef = null,
  compactBoundaries = null,
  // DW-10: changed file paths observed right after an aborted turn — the
  // in-flight response is lost, but the workspace isn't rolled back, so the
  // owner needs to see what an abort actually touched before retrying.
  workspaceDelta = null,
}) {
  if (!turnId) throw new TranscriptError("turn.turnId is required");
  if (!TURN_RESULTS.includes(result)) throw new TranscriptError(`unknown turn result "${result}"`);
  if (!TURN_STRATEGIES.includes(strategy)) throw new TranscriptError(`unknown turn strategy "${strategy}"`);
  return {
    v: 1,
    turnId,
    phase,
    agent,
    provider,
    model,
    effort,
    startedAt,
    durationMs,
    promptFile,
    recordsFile,
    records,
    usage,
    costUsd,
    costEstUsd,
    pricingVersion,
    context,
    result,
    strategy,
    snapshotRef,
    configChangeRef,
    compactBoundaries,
    workspaceDelta,
  };
}

export function formatTurnEntry(entry) {
  return JSON.stringify(entry);
}

/** Parse turns.ndjson text into an array of turn entries, in file order. */
export function parseTurns(ndjsonText) {
  const text = String(ndjsonText == null ? "" : ndjsonText);
  if (!text.trim()) return [];
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new TranscriptError(`invalid turns ndjson at line ${i + 1}: ${err.message}`);
      }
    });
}

/** Pure text mutation: append one closed turn entry to existing turns.ndjson text. */
export function appendTurnEntryText(currentNdjson, entry) {
  if (!entry || !entry.turnId) throw new TranscriptError("entry is required to append");
  const base = String(currentNdjson == null ? "" : currentNdjson);
  const sep = base && !base.endsWith("\n") ? "\n" : "";
  return base + sep + formatTurnEntry(entry) + "\n";
}

// ---- crash-turn reconciliation (run-session.mjs --resume path) ----

/**
 * Given the turnIds already closed in turns.ndjson and the turnIds that have
 * a prompt file on disk, return the turnIds that started (a prompt was
 * written, meaning a driver turn was launched) but never got a closing
 * turns.ndjson entry — orphaned by a runner crash mid-turn.
 * @param {string[]} closedTurnIds
 * @param {string[]} promptTurnIds
 * @returns {string[]} sorted orphaned turn ids
 */
export function findOrphanedTurnIds(closedTurnIds, promptTurnIds) {
  const closed = new Set(closedTurnIds || []);
  return (promptTurnIds || []).filter((id) => !closed.has(id)).sort();
}

/** Build the `result:"crashed"` seal entry for an orphaned turn on resume. */
export function buildCrashSealEntry({ turnId, phase, agent, provider, model, effort, promptFile, recordsFile, sealedAt }) {
  return buildTurnEntry({
    turnId,
    phase,
    agent,
    provider,
    model,
    effort,
    startedAt: sealedAt,
    durationMs: null,
    promptFile,
    recordsFile,
    records: 0,
    usage: null,
    result: "crashed",
    strategy: "start",
  });
}

// ---- literal search (per-record matching; multi-shard orchestration is server-routes.mjs's job) ----

/**
 * Find literal matches of `query` in `text`, each with a short surrounding
 * snippet for UI highlighting. Case-insensitive by default. Pure text
 * function — reading/streaming across turn shards happens in server-routes.
 * @param {string} text
 * @param {string} query
 * @param {{caseSensitive?:boolean, contextChars?:number}} [options]
 * @returns {{start:number, len:number, snippet:string}[]}
 */
export function findMatches(text, query, { caseSensitive = false, contextChars = 40 } = {}) {
  if (!query) return [];
  const source = String(text == null ? "" : text);
  const haystack = caseSensitive ? source : source.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  if (!needle) return [];
  const matches = [];
  let from = 0;
  while (from <= haystack.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    const start = Math.max(0, idx - contextChars);
    const end = Math.min(source.length, idx + needle.length + contextChars);
    matches.push({ start: idx, len: needle.length, snippet: source.slice(start, end) });
    from = idx + needle.length;
  }
  return matches;
}
