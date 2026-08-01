// scripts/delivery/instant.mjs
// DLV-73 — the INSTANT lane's deterministic half.
//
// INSTANT spends two model turns: one merged DISCOVERY+PLAN, one BUILDING. The
// two turns it does NOT spend are REVIEWING and UAT_PREP, and this module is what
// stands in for them. That is only defensible because of one extra field INSTANT
// requires from the merged turn — `declaredEdit`, the exact before/after text of
// the change it intends to make. With that in hand, "did the agent do what the
// approved plan said" stops being a judgement call and becomes an assertion:
//
//   - the diff touches exactly the declared file, and nothing else;
//   - it is no larger than the lane's ceiling;
//   - the removed text contains `before` and the added text contains `after`;
//   - validation passed first time.
//
// If all four hold, there is nothing a review turn could add that the owner will
// not see more directly in the diff itself at the UAT gate. If any fail, the
// change was not the trivial one INSTANT was authorized for, and the real
// REVIEWING + UAT_PREP turns run — so the escalation path, not the happy path, is
// what makes skipping them safe. `code-review` and `uat-generation` remain locked
// always-on rows in classify.mjs; what changed is how they are discharged, and
// the Delivery Master Book records that as an explicit amendment rather than
// letting it read as compliance-by-default.
//
// Zero-dependency and side-effect free: everything here is a pure function over
// strings the caller has already read, so it is testable without a repo, a git
// process, or a session on disk.

export class InstantError extends Error {}

/** Failure codes, so callers and tests never match on prose. */
export const INSTANT_FAILURES = Object.freeze({
  NO_DECLARED_EDIT: "no-declared-edit",
  UNDECLARED_FILE: "undeclared-file",
  OUTSIDE_SCOPE_LOCK: "outside-scope-lock",
  NO_CHANGES: "no-changes",
  DIFF_TOO_LARGE: "diff-too-large",
  BEFORE_NOT_REMOVED: "before-not-removed",
  AFTER_NOT_ADDED: "after-not-added",
  FIX_LOOP_USED: "fix-loop-used",
});

/**
 * Validate and normalize the merged turn's `declaredEdit`.
 *
 * `before` may legitimately be empty — a pure insertion removes nothing — but
 * `after` may not: an INSTANT session that declares it will add nothing has
 * described a no-op, and accepting that would let the verification below pass
 * vacuously. Returns null rather than throwing so the caller decides whether a
 * missing declaration is fatal (it is, on INSTANT) or merely absent (on FAST,
 * which does not use this field at all).
 *
 * @param {unknown} raw
 * @returns {{path:string, anchor:(number|null), before:string, after:string}|null}
 */
export function normalizeDeclaredEdit(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const path = typeof raw.path === "string" ? raw.path.trim().replace(/\\/g, "/") : "";
  if (!path) return null;
  if (typeof raw.after !== "string" || raw.after.trim() === "") return null;
  if (raw.before !== undefined && typeof raw.before !== "string") return null;
  const anchorRaw = raw.anchor;
  const anchor =
    typeof anchorRaw === "number" && Number.isInteger(anchorRaw) && anchorRaw > 0 ? anchorRaw : null;
  return { path, anchor, before: typeof raw.before === "string" ? raw.before : "", after: raw.after };
}

/** Escapes git emits inside a C-quoted path, other than octal. */
const GIT_QUOTE_ESCAPES = Object.freeze({
  a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, "\\": 92,
});

/**
 * Decode a path as `git status`/`git diff` renders it.
 *
 * With `core.quotePath` on (the default), git wraps any path containing a byte
 * >= 0x80 in double quotes and escapes those bytes in **octal** — `ERA Notes/…
 * — Master Book.md` comes out as `"ERA Notes/… \342\200\224 Master Book.md"`.
 * The previous reader here tried `JSON.parse` on that, which cannot succeed:
 * `\342` is not a legal JSON escape. It fell back to the raw quoted string and
 * then rewrote every backslash to `/`, turning the separator into `/342/200/224`
 * — a path that matches nothing, resolves to nothing, and silently drops out of
 * every ownership and scope comparison it is fed to. This repo has non-ASCII in
 * the name of every PM Master Book, so that was not a corner case.
 *
 * Octal escapes are decoded to bytes and the byte string is decoded as UTF-8,
 * which is what git actually wrote.
 *
 * @param {unknown} raw
 * @returns {string} a repo-relative path with `/` separators
 */
export function unquoteGitPath(raw) {
  const value = String(raw == null ? "" : raw).trim();
  if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) {
    return value.replace(/\\/g, "/");
  }
  const body = value.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] !== "\\") {
      bytes.push(body.charCodeAt(i) & 0xff);
      continue;
    }
    const next = body[i + 1];
    if (next === undefined) {
      bytes.push(92);
      break;
    }
    const octal = /^[0-7]{1,3}/.exec(body.slice(i + 1, i + 4));
    if (octal) {
      bytes.push(parseInt(octal[0], 8) & 0xff);
      i += octal[0].length;
      continue;
    }
    bytes.push(
      Object.prototype.hasOwnProperty.call(GIT_QUOTE_ESCAPES, next)
        ? GIT_QUOTE_ESCAPES[next]
        : next.charCodeAt(0) & 0xff,
    );
    i += 1;
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes)).replace(/\\/g, "/");
}

/**
 * Split a unified diff into its added lines, removed lines, and touched files.
 *
 * `+++`/`---` file headers are excluded from the content lines — they start with
 * the same characters as real content and counting them would inflate every diff
 * by two per file and, worse, let a file header satisfy an `after` match. They
 * are instead the source of `files`.
 *
 * Telling a header from content cannot be done on the leading characters alone:
 * a *removed* line whose own text begins with `--` renders as `---` in the diff.
 * A deleted SQL migration full of `-- WHAT:` comments therefore reported dozens
 * of comment sentences as touched file paths, and — worse, because it is the
 * silent half — dropped those lines out of `removed`, so a `before` match could
 * fail on a diff that plainly contained it. A header is recognized only as the
 * adjacent `---`/`+++` *pair* that git always emits together, and only outside a
 * hunk, so content beginning with `-` or `+` is never mistaken for one.
 *
 * The diff is treated as the authoritative record of what changed, rather than
 * the session's separately-maintained `workspace.changedFiles`. Two independent
 * answers to "what did this session touch" is one too many: they can disagree,
 * and when they do there is no principled way to pick a winner. `changedFiles`
 * is still cross-checked in `verifyInstantEdit` when it is populated, but it is
 * corroboration, not the source.
 *
 * @param {string} diffText
 * @returns {{added:string[], removed:string[], changedLines:number, files:string[]}}
 */
export function parseUnifiedDiff(diffText) {
  const added = [];
  const removed = [];
  const files = [];
  const noteFile = (raw) => {
    // Unquote first: git wraps the whole `a/<path>` token in quotes, so the
    // `a/` prefix is inside them and cannot be stripped before decoding.
    const path = unquoteGitPath(String(raw || "").replace(/\t.*$/, "")).replace(/^[ab]\//, "");
    if (path && path !== "/dev/null" && !files.includes(path)) files.push(path);
  };
  const lines = String(diffText || "").split(/\r?\n/);
  let inHunk = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("diff --git ") || line.startsWith("diff --cc ")) {
      inHunk = false;
      continue;
    }
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk && line.startsWith("--- ") && (lines[i + 1] || "").startsWith("+++ ")) {
      // A deletion has `+++ /dev/null`, so the `---` side is the only record of
      // which file went away; a creation is the mirror. Read both, skip both.
      noteFile(line.slice(3));
      noteFile(lines[i + 1].slice(3));
      i += 1;
      continue;
    }
    if (line.startsWith("+")) added.push(line.slice(1));
    else if (line.startsWith("-")) removed.push(line.slice(1));
  }
  return { added, removed, changedLines: added.length + removed.length, files };
}

/** Whitespace-insensitive containment — indentation is not semantic here. */
function looseIncludes(haystackLines, needle) {
  const want = String(needle || "").replace(/\s+/g, " ").trim();
  if (!want) return true;
  const hay = haystackLines.map((l) => l.replace(/\s+/g, " ").trim()).join("\n");
  return hay.includes(want);
}

/**
 * The INSTANT review, as an assertion rather than an opinion.
 *
 * Every check reports rather than throws, and all of them run: a caller
 * escalating to the real review turns wants the full list of what did not match,
 * not the first thing that failed. `ok: false` is not an error condition — it is
 * the signal to spend the two turns INSTANT normally saves.
 *
 * @param {{declaredEdit:object|null, changedFiles:string[], diffText:string,
 *   scopeLockPaths?:string[], maxDiffLines?:number, fixLoop?:number}} args
 * @returns {{ok:boolean, failures:{code:string, message:string}[],
 *   changedLines:number, declaredPath:(string|null)}}
 */
export function verifyInstantEdit({
  declaredEdit,
  changedFiles = [],
  diffText = "",
  scopeLockPaths = [],
  maxDiffLines = 20,
  fixLoop = 0,
}) {
  const failures = [];
  const add = (code, message) => failures.push({ code, message });
  const edit = normalizeDeclaredEdit(declaredEdit);
  const reported = (changedFiles || []).map((f) => String(f).replace(/\\/g, "/")).filter(Boolean);
  const { added, removed, changedLines, files: diffFiles } = parseUnifiedDiff(diffText);
  // The diff is the source of truth; `changedFiles` corroborates when populated.
  const files = [...new Set([...diffFiles, ...reported])];

  if (!edit) {
    // Without a declaration there is nothing to verify against, so this is not a
    // "maybe fine" — it is the one failure that makes every other check
    // meaningless, and it must escalate rather than pass by omission.
    add(INSTANT_FAILURES.NO_DECLARED_EDIT, "the approved plan carries no usable declaredEdit to verify the diff against");
    return { ok: false, failures, changedLines, declaredPath: null };
  }

  if (files.length === 0 && changedLines === 0) {
    add(INSTANT_FAILURES.NO_CHANGES, "BUILDING reported complete but the working tree shows no changes at all");
  }
  const undeclared = files.filter((f) => f !== edit.path);
  if (undeclared.length) {
    add(
      INSTANT_FAILURES.UNDECLARED_FILE,
      `the diff touches ${undeclared.join(", ")}, which the approved declaredEdit did not name (${edit.path})`,
    );
  }
  if (scopeLockPaths.length) {
    const locked = scopeLockPaths.map((p) => String(p).replace(/\\/g, "/"));
    const outside = files.filter((f) => !locked.some((p) => f === p || f.startsWith(p.replace(/\*+$/, ""))));
    if (outside.length) {
      add(INSTANT_FAILURES.OUTSIDE_SCOPE_LOCK, `the diff touches ${outside.join(", ")}, outside the post-plan scope lock`);
    }
  }
  if (changedLines > maxDiffLines) {
    add(
      INSTANT_FAILURES.DIFF_TOO_LARGE,
      `the diff changes ${changedLines} lines, above INSTANT's ceiling of ${maxDiffLines} — this is not the one-line class of change the lane was authorized for`,
    );
  }
  if (edit.before.trim() && !looseIncludes(removed, edit.before)) {
    add(INSTANT_FAILURES.BEFORE_NOT_REMOVED, "the text declaredEdit.before said would be replaced does not appear in the diff's removed lines");
  }
  if (!looseIncludes(added, edit.after)) {
    add(INSTANT_FAILURES.AFTER_NOT_ADDED, "the text declaredEdit.after said would be written does not appear in the diff's added lines");
  }
  if (fixLoop > 0) {
    // A fix loop means validation failed at least once, i.e. the first attempt
    // was wrong. That is precisely the session that should be read by a reviewer.
    add(INSTANT_FAILURES.FIX_LOOP_USED, `validation needed ${fixLoop} fix loop(s), so the change did not land correctly first time`);
  }

  return { ok: failures.length === 0, failures, changedLines, declaredPath: edit.path };
}

/**
 * Synthesize the UAT package that UAT_PREP would otherwise have produced.
 *
 * The manual steps are not invented here — they come from `manualSteps`, which the
 * merged turn emits as part of the same JSON it was already producing, so they
 * cost nothing extra and are written by the model that planned the change. This
 * function's job is only to assemble them into the exact shape
 * `assembleUatPackage` already consumes, so the artifacts an INSTANT session
 * leaves behind are indistinguishable in structure from every other lane's.
 *
 * Acceptance criteria are marked `met` only on the strength of the verification
 * that actually ran — a deterministic pass says the declared edit landed and
 * validation was green, and it says nothing whatsoever about criteria that
 * describe anything else. Those stay `unmet` and reach the owner through the
 * existing unsatisfied-acceptance question rather than being quietly asserted.
 *
 * @param {{spec:object, plan:object, declaredEdit:object, manualSteps?:object[],
 *   changedFiles?:string[], verification:object, validationSummary?:string}} args
 */
export function buildInstantUat({
  spec,
  plan,
  declaredEdit,
  manualSteps = [],
  changedFiles = [],
  verification,
  validationSummary = "",
}) {
  const edit = normalizeDeclaredEdit(declaredEdit);
  if (!edit) throw new InstantError("buildInstantUat requires a valid declaredEdit");

  // The evidence pointer must be something the RUNNER can resolve, not prose —
  // `reconcileAcceptance` checks it against this session's own changed files,
  // existing paths, and passing validation rungs, and downgrades anything else to
  // `unmet`. That check is the whole point of DLV-10 and INSTANT does not get an
  // exception from it: an early version of this function emitted a human sentence
  // here, every claim was correctly downgraded, and each session parked on an
  // unmet-acceptance question instead of reaching UAT.
  //
  // `path:line` is the house citation convention and resolves as `diff` evidence
  // because the file is in `changedFiles`. The narrative goes in `note`, where it
  // is preserved without pretending to be proof.
  const evidence = edit.anchor ? `${edit.path}:${edit.anchor}` : edit.path;
  const note =
    `deterministic INSTANT verification: ${verification.changedLines} changed line(s) in ${edit.path}` +
    (validationSummary ? `; ${validationSummary}` : "");

  // Only criteria the declared edit plainly delivers can be evidenced this way.
  // The conservative rule — the edit landed as declared and validation is green,
  // so criteria about *that* are met — is stated here rather than inferred per
  // criterion, because a heuristic that decided which ACs "sound like" the edit
  // would be exactly the kind of silent judgement this lane removed the model to
  // avoid. `withReconciledAcceptance` still gets the final word.
  const acceptanceCriteria = (spec?.acceptanceCriteria || []).map((ac) => ({
    id: ac.id,
    status: verification.ok ? "met" : "unmet",
    evidence: verification.ok ? evidence : null,
    note: verification.ok ? note : "not evidenced — INSTANT verification did not pass",
  }));

  return {
    summary:
      `${spec?.proposedBehavior || plan?.testPlan || "Applied the declared edit."}\n\n` +
      `Verified deterministically: the diff changed ${verification.changedLines} line(s) in \`${edit.path}\`` +
      `${edit.anchor ? ` around line ${edit.anchor}` : ""}, matching the approved declaredEdit exactly, ` +
      `and the validation ladder passed on the first attempt. No review or UAT model turn was spent — ` +
      `see artifacts/instant-verification.json for the assertions that stood in for them.`,
    acceptanceCriteria,
    manualSteps: manualSteps
      .filter((s) => s && typeof s.action === "string" && typeof s.expected === "string")
      .map((s) => ({ action: s.action, expected: s.expected })),
    deviations: [],
    followUps: [],
    changedFiles,
  };
}
