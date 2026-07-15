// scripts/delivery/packet.mjs
// Work-item packet builder (packet.json, schemaVersion 1).
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/3 - State Machine, Packet & Classifier.md §1.
//
// Reuses `scanCheckboxes` (scripts/pm/mutations.mjs) so packet cbidx ordinals
// can never drift from the PM dashboard's own checkbox ordinals. The heading /
// id / severity / effort extraction here is a faithful port of the client.js
// `parseTaskMeta` / `sectionRank` / `cleanInlineText` helpers (client.js is a
// browser IIFE and isn't import-able), kept byte-for-byte compatible with
// their regexes.

import { createHash } from "node:crypto";
import { scanCheckboxes } from "../pm/mutations.mjs";

export const SCHEMA_VERSION = 1;

export const DEFAULT_CONSTRAINTS = Object.freeze({
  maxFixLoops: 3,
  allowNewDeps: false,
  forbiddenPaths: Object.freeze(["src/components/ui/**"]),
  gitPolicy: "read-only",
  approvalGates: Object.freeze(["SPEC_READY", "PLAN_READY", "UAT_READY"]),
});

export const DEFAULT_AGENT_CONFIG = Object.freeze({
  model: null,
  effort: Object.freeze({
    discovery: "medium",
    plan: "high",
    building: "high",
    review: "medium",
  }),
});

const TASK_SEVERITIES = Object.freeze(["blocker", "friction", "annoyance", "parked"]);

export class PacketError extends Error {}

// ---- ported text helpers (must stay behaviorally identical to client.js) ----

function cleanInlineText(s) {
  return String(s == null ? "" : s)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/\|/g, " ")
    .replace(/^#+\s*/, "")
    .trim();
}

/** Pull the "**N4** … _(annoyance - S)_" conventions out of a checklist line. */
export function parseTaskMeta(restIn) {
  let rest = restIn;
  let id = null;
  let sev = null;
  let effort = null;
  const im = rest.match(/^\*\*([^*]{1,12})\*\*\s+/);
  if (im && /^[A-Za-z]{1,5}-?\d+[A-Za-z]?(?:\.\d+[A-Za-z]?)?$/.test(im[1].trim())) {
    id = im[1].trim();
    rest = rest.slice(im[0].length);
  }
  const tm = rest.match(/_\(([^()]{1,40})\)_\s*$/);
  if (tm) {
    const parts = tm[1].split(/\s*[-–—]\s*/);
    const s = (parts[0] || "").trim().toLowerCase();
    if (TASK_SEVERITIES.includes(s)) {
      sev = s;
      effort = (parts[1] || "").trim() || null;
      rest = rest.slice(0, rest.length - tm[0].length);
    }
  }
  return { id, sev, effort, text: cleanInlineText(rest) };
}

/** Now=0, Next=1, Later=2, Definition of Done=4, everything else=3. */
export function sectionRank(heading) {
  if (/definition of done/i.test(heading)) return 4;
  if (/^now\b/i.test(heading)) return 0;
  if (/^next\b/i.test(heading)) return 1;
  if (/^later\b/i.test(heading)) return 2;
  return 3;
}

/** sha1 of the trimmed line text — used to detect drift between session start and now. */
export function textHash(lineText) {
  return createHash("sha1").update(String(lineText == null ? "" : lineText).trim()).digest("hex");
}

/** First path segment of a PM-relative file path is the campaign folder name. */
export function campaignFromPmFile(pmFile) {
  const clean = String(pmFile == null ? "" : pmFile).replace(/\\/g, "/");
  const idx = clean.indexOf("/");
  return idx === -1 ? null : clean.slice(0, idx);
}

/**
 * Extract the checkbox line's raw prefix-stripped text plus heading/section context,
 * walking the same frontmatter/fence rules as `scanCheckboxes` so cbidx stays aligned.
 */
function extractLineContext(raw, targetLine) {
  const lines = String(raw).split("\n");
  let start = 0;
  if (/^---\s*$/.test(lines[0] || "")) {
    for (let j = 1; j < lines.length; j++) {
      if (/^---\s*$/.test(lines[j])) {
        start = j + 1;
        break;
      }
    }
  }
  let inFence = false;
  let heading = "";
  for (let i = start; i <= targetLine; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      heading = cleanInlineText(h[2]);
      continue;
    }
  }
  const m = lines[targetLine].match(/^(\s*)(?:[-*]|\d+\.)\s+\[([ xX])\]\s*(.*)$/);
  if (!m) {
    throw new PacketError(`line ${targetLine} is not a checkbox line`);
  }
  return { rest: m[3], heading };
}

/**
 * Build the `item` identity block of packet.json from raw markdown + a checkbox ordinal.
 * Mirrors `toggleCheckbox`'s ok/reason contract: returns `{ok:true, item}` or
 * `{ok:false, reason}` — never throws for expected drift/out-of-range cases.
 *
 * @param {string} raw - full markdown file contents
 * @param {number} cbidx - absolute checkbox ordinal (as scanCheckboxes returns)
 * @param {string} pmFile - PM-relative file path, e.g. "Budget/4 - Checklist.md"
 * @param {object} [opts]
 * @param {string} [opts.expectText] - if given, must sha1-match the resolved lineText (drift guard)
 * @param {number} [opts.sourceMtimeMs]
 * @returns {{ok:true, item:{pmFile:string, cbidx:number, lineText:string, id:(string|null),
 *   text:string, heading:string, sectionRank:number, sev:(string|null), effort:(string|null),
 *   campaign:(string|null), sourceMtimeMs:number, textHash:string}} | {ok:false, reason:string}}
 */
export function buildItemIdentity(raw, cbidx, pmFile, opts = {}) {
  const boxes = scanCheckboxes(raw);
  if (cbidx == null || cbidx < 0 || cbidx >= boxes.length) {
    return { ok: false, reason: "out-of-range" };
  }
  const box = boxes[cbidx];
  const { rest, heading } = extractLineContext(raw, box.line);
  const meta = parseTaskMeta(rest);
  const lineText = String(raw).split("\n")[box.line];
  const hash = textHash(lineText);

  if (opts.expectText != null && textHash(opts.expectText) !== hash) {
    return { ok: false, reason: "drift" };
  }

  const item = {
    pmFile,
    cbidx,
    lineText,
    id: meta.id,
    text: meta.text,
    heading,
    sectionRank: sectionRank(heading),
    sev: meta.sev,
    effort: meta.effort,
    campaign: campaignFromPmFile(pmFile),
    sourceMtimeMs: opts.sourceMtimeMs != null ? opts.sourceMtimeMs : 0,
    textHash: hash,
  };
  return { ok: true, item };
}

/** `s-<yyyymmdd>-<hhmmss>-<rand4>` — deterministic given injected `now`/`rand`. */
export function makeSessionId(now = new Date(), rand = Math.random) {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const y = now.getFullYear();
  const mo = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const rand4 = Math.floor(rand() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `s-${y}${mo}${d}-${h}${mi}${s}-${rand4}`;
}

/**
 * Assemble the full packet.json object (doc 3 §1). Pure composition — capability
 * classification is `classify.mjs`'s job; this only shapes the envelope.
 */
export function buildPacket({
  sessionId,
  createdAt = new Date().toISOString(),
  mode = "uat",
  agent,
  agentConfig = {},
  item,
  context = { campaignFiles: [], relatedNotes: [] },
  scopeHints = { keywords: [], globs: [], modules: [] },
  capabilities = [],
  constraints = {},
  skills = [],
  acceptanceCriteria = [],
  workspace,
}) {
  if (!sessionId) throw new PacketError("sessionId is required");
  if (agent !== "codex" && agent !== "claude") {
    throw new PacketError(`agent must be "codex" or "claude", got "${agent}"`);
  }
  if (!item) throw new PacketError("item is required");
  if (!workspace) throw new PacketError("workspace is required");

  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId,
    createdAt,
    mode,
    agent,
    agentConfig: {
      model: typeof agentConfig.model === "string" && agentConfig.model.trim() ? agentConfig.model.trim() : null,
      effort: { ...DEFAULT_AGENT_CONFIG.effort, ...(agentConfig.effort || {}) },
    },
    item,
    context,
    scopeHints,
    capabilities,
    constraints: { ...DEFAULT_CONSTRAINTS, ...constraints },
    skills,
    acceptanceCriteria,
    workspace,
  };
}
