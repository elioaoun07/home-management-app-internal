// scripts/delivery-v2/diagnostics.mjs
// PM Delivery V2 — retained check output: bounded, redacted, and classified (DLV-120).
//
// Why this exists
// ---------------
// `checks.mjs` used to record `outputHash = sha256(stdout + stderr)` and a
// `redaction` note saying the output was hashed and not stored. That is safe and
// useless: when a protected check fails, the owner is handed "something failed"
// and a hex string, and the only way to learn what failed is to re-run the whole
// verification — or, worse, to dispatch another model job to go and look. Both
// cost more than keeping the text would have.
//
// So the text is kept, under three rules that are refusals rather than features:
//
//   1. **Bounded.** A runaway check must not be able to fill the store. Head and
//      tail are retained with the middle dropped and counted, because the two
//      ends are where a runner says what it selected and what broke.
//   2. **Redacted.** Retained output leaves the checker's process and lands in a
//      durable store the owner reads on a phone. Host paths, home directories
//      and anything token-shaped are replaced before it is written — not after,
//      and not "probably nothing sensitive is in there".
//   3. **Classified, not summarized.** A check that never started, a check whose
//      output could not be read, and a check whose tests genuinely failed are
//      three different facts with three different next actions. Collapsing them
//      into "failed" is what made DLV-112's Recheck loop produce identical
//      inconclusive results with nothing to act on.
//
// This module holds no policy about what a check *means*. criteria.mjs decides
// that; here the output is only made safe to keep and honest about its shape.

import { createHash } from "node:crypto";
import { homedir } from "node:os";

import { deepFreeze } from "./contracts.mjs";

/** Hard ceilings. A broken run cannot fill the disk, and a phone can render this. */
export const RETENTION_LIMITS = Object.freeze({
  headLines: 120,
  tailLines: 80,
  lineChars: 500,
  totalChars: 24_000,
});

/** What a protected check's execution turned out to be. */
export const CHECK_OUTCOMES = Object.freeze({
  /** The observer process never existed — a missing runner, not a failing test. */
  RUNNER_MISSING: "runner-missing",
  /** A process ran, but nothing in its output states what it selected or executed. */
  OUTPUT_UNREADABLE: "output-unreadable",
  /** The runner reported a selection and none of it ran. */
  NO_TESTS_SELECTED: "no-tests-selected",
  /** Readable counts, and the run failed. */
  TESTS_FAILED: "tests-failed",
  /** Readable counts, executed work, clean exit. */
  PASSED: "passed",
});

/**
 * Token shapes replaced wherever they appear.
 *
 * Deliberately shape-based rather than key-based: `assertRestrictedEnvironment`
 * already keeps publication credentials out of the checker's environment, so
 * anything token-shaped that still reaches this text arrived some other way — a
 * fixture, a candidate's own file, a pasted log — and is exactly the case a
 * name-based denylist misses.
 */
export const SECRET_PATTERNS = Object.freeze([
  /sk-[A-Za-z0-9_-]{16,}/gu, // OpenAI / Anthropic style
  /sk-ant-[A-Za-z0-9_-]{16,}/gu,
  /gh[pousr]_[A-Za-z0-9]{16,}/gu, // GitHub
  /github_pat_[A-Za-z0-9_]{20,}/gu,
  /xox[baprs]-[A-Za-z0-9-]{10,}/gu, // Slack
  /AKIA[0-9A-Z]{16}/gu, // AWS access key id
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/gu, // JWT
  /(?<=[Bb]earer )[A-Za-z0-9._~+/-]{20,}=*/gu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
]);

const ANSI = /\u001B\[[0-?]*[ -/]*[@-~]/gu;
const sha256 = (buffer) => "sha256:" + createHash("sha256").update(buffer).digest("hex");
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/** Both separator spellings of one absolute path, longest first so nesting wins. */
function pathVariants(value) {
  const raw = String(value || "");
  if (!raw) return [];
  return [...new Set([raw, raw.split("\\").join("/"), raw.split("/").join("\\")])];
}

/**
 * Replace absolute host locations with stable tokens.
 *
 * Kept ordered longest-first so `<candidate>/src/a.ts` does not degrade into
 * `<home>/…/src/a.ts` when the candidate lives under the home directory, which
 * on this machine it does.
 *
 * @param {string} text
 * @param {{roots?:{token:string, path:string}[], home?:string}} input
 */
export function redactPaths(text, { roots = [], home = homedir() } = {}) {
  const replacements = [];
  for (const entry of roots) {
    if (!entry || !isNonEmptyString(entry.path)) continue;
    for (const variant of pathVariants(entry.path)) replacements.push({ from: variant, to: entry.token });
  }
  for (const variant of pathVariants(home)) replacements.push({ from: variant, to: "<home>" });
  replacements.sort((a, b) => b.from.length - a.from.length);

  let out = String(text || "");
  for (const { from, to } of replacements) out = out.split(from).join(to);
  return out;
}

/** Replace token-shaped runs. Returns the text and how many were replaced. */
export function redactSecrets(text) {
  let out = String(text || "");
  let count = 0;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(new RegExp(pattern.source, pattern.flags), () => {
      count += 1;
      return "<redacted-secret>";
    });
  }
  return { text: out, redactedSecrets: count };
}

/**
 * Turn one execution's stdout/stderr into the bounded, redacted text that is
 * actually stored.
 *
 * stdout and stderr are kept separate and labelled: a runner that printed its
 * summary to stdout and its stack to stderr is two different stories, and
 * concatenating them loses which was which — the exact ambiguity that made
 * "unreadable output" indistinguishable from "no runner" before.
 *
 * @param {{stdout?:string, stderr?:string, roots?:{token:string, path:string}[],
 *   limits?:typeof RETENTION_LIMITS, home?:string}} input
 */
export function retainOutput({ stdout = "", stderr = "", roots = [], limits = RETENTION_LIMITS, home = homedir() }) {
  const sections = [];
  let droppedLines = 0;
  let clippedLines = 0;

  for (const [label, raw] of [["stdout", stdout], ["stderr", stderr]]) {
    const plain = String(raw || "").replace(ANSI, "");
    if (plain.trim() === "") continue;
    const lines = plain.split(/\r?\n/u);
    let kept = lines;
    if (lines.length > limits.headLines + limits.tailLines) {
      const dropped = lines.length - limits.headLines - limits.tailLines;
      droppedLines += dropped;
      kept = [
        ...lines.slice(0, limits.headLines),
        "… " + dropped + " line(s) omitted …",
        ...lines.slice(lines.length - limits.tailLines),
      ];
    }
    const bounded = kept.map((line) => {
      if (line.length <= limits.lineChars) return line;
      clippedLines += 1;
      return line.slice(0, limits.lineChars) + "…";
    });
    sections.push("--- " + label + " ---\n" + bounded.join("\n"));
  }

  const joined = sections.join("\n");
  const pathSafe = redactPaths(joined, { roots, home });
  const { text: secretSafe, redactedSecrets } = redactSecrets(pathSafe);
  const truncatedChars = Math.max(0, secretSafe.length - limits.totalChars);
  const text = truncatedChars ? secretSafe.slice(0, limits.totalChars) + "\n… output truncated …" : secretSafe;

  return deepFreeze({
    text,
    empty: text.trim() === "",
    // The hash is of the ORIGINAL bytes, so it still identifies the run that
    // produced this and can be compared with an earlier receipt's hash.
    sourceHash: sha256(Buffer.from(String(stdout || "") + String(stderr || ""), "utf8")),
    bytes: Buffer.byteLength(text, "utf8"),
    droppedLines,
    clippedLines,
    truncatedChars,
    redactedSecrets,
    limits: { ...limits },
  });
}

/**
 * Which of the five shapes this execution was.
 *
 * The order is the argument: a process that never started cannot have failing
 * tests, and a run whose counts cannot be read has not established anything
 * about tests either way. Only the last two branches are statements about the
 * candidate; the first three are statements about the check itself.
 *
 * @param {{spawnError?:(string|null), exitCode?:(number|null),
 *   counts?:{selected?:(number|null), executed?:(number|null), failed?:(number|null)}}} input
 */
export function classifyCheckOutcome({ spawnError = null, exitCode = null, counts = {} }) {
  if (isNonEmptyString(spawnError)) {
    return deepFreeze({
      outcome: CHECK_OUTCOMES.RUNNER_MISSING,
      aboutTheCandidate: false,
      detail: "the observer process did not start: " + String(spawnError),
    });
  }
  if (typeof counts.selected !== "number" || typeof counts.executed !== "number") {
    return deepFreeze({
      outcome: CHECK_OUTCOMES.OUTPUT_UNREADABLE,
      aboutTheCandidate: false,
      detail: "exit " + String(exitCode) + "; the output states no selected/executed count, so it proves nothing either way",
    });
  }
  if (counts.selected === 0 || counts.executed === 0) {
    return deepFreeze({
      outcome: CHECK_OUTCOMES.NO_TESTS_SELECTED,
      aboutTheCandidate: false,
      detail: "selected=" + counts.selected + " executed=" + counts.executed,
    });
  }
  if (exitCode !== 0 || Number(counts.failed || 0) > 0) {
    return deepFreeze({
      outcome: CHECK_OUTCOMES.TESTS_FAILED,
      aboutTheCandidate: true,
      detail: "exit " + String(exitCode) + "; " + String(counts.failed ?? "an unstated number of") + " of " + counts.executed + " executed case(s) failed",
    });
  }
  return deepFreeze({
    outcome: CHECK_OUTCOMES.PASSED,
    aboutTheCandidate: true,
    detail: "executed=" + counts.executed + " of selected=" + counts.selected,
  });
}

/**
 * The sentence stored on a receipt describing what was kept and what was not.
 *
 * It replaces the old "stdout and stderr are hashed, not stored" note, which the
 * review UI rendered verbatim as the evidence gap. The UI now renders retained
 * text when there is any; this stays as the honest fallback for the cases where
 * there genuinely is none.
 */
export function retentionNote(retained) {
  if (!retained) return "output was not retained for this check";
  if (retained.empty) return "the check produced no output; nothing to retain";
  const parts = ["bounded, redacted stdout/stderr retained beside this receipt"];
  if (retained.droppedLines) parts.push(retained.droppedLines + " middle line(s) omitted");
  if (retained.clippedLines) parts.push(retained.clippedLines + " long line(s) clipped");
  if (retained.truncatedChars) parts.push("tail truncated at " + retained.limits.totalChars + " characters");
  if (retained.redactedSecrets) parts.push(retained.redactedSecrets + " token-shaped value(s) redacted");
  parts.push("absolute paths replaced; no environment values recorded");
  return parts.join("; ");
}
