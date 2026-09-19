// scripts/delivery-v2/apply.mjs
// Command Center Phase 4 — the protected integrator (DLV-105, DEC-16 as adopted).
//
// An owner-triggered Apply copies the bytes of one verified, frozen candidate into
// the host checkout. This module is the only code that writes those bytes, and it
// is deliberately small and mechanical:
//
//   plan      compare every affected path's current bytes with the base the
//             candidate was built from; refuse unsafe, protected and linked paths
//             and case collisions; anything changed since the base is a conflict.
//   journal   before any write, copy each before-image and each candidate file into
//             a journal outside the checkout, hash-verified.
//   write     one path at a time: re-check the before-image, write a temp file in
//             the same directory, verify, rename. Nothing is executed.
//   inspect   after a crash, each operation is applied, pending or foreign — read
//             from the bytes on disk, not from what the process believed.
//   rollback  restore only paths that still hold the candidate's bytes; a path
//             edited since is reported and left alone.
//   integrate copy the resulting host files into a fresh generation through the
//             trusted loader, so the protected checker can observe exactly that.
//
// What this module never does: spawn a process, run a package script or test, touch
// Git (no reset, merge, commit or push), deploy, or reach a database. Checks of the
// integrated snapshot run in the isolated checker, never here.

import { createHash, randomBytes } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { ContractError, contentId, deepFreeze, normalizePath } from "./contracts.mjs";
import { candidateChangedPaths, candidateFreshness, checkPublicationScope } from "./candidate.mjs";
import { classifyRelativePath, provisionScratch, resolveInside } from "./scratch.mjs";
import { importTrustedCandidate } from "./checks.mjs";

export const APPLY_REFUSALS = Object.freeze({
  CANDIDATE_INSIDE_DESTINATION: "candidate-inside-destination",
  CANDIDATE_CHANGED: "candidate-changed-since-freeze",
  CANDIDATE_UNTRUSTED: "candidate-has-untrusted-entries",
  CANDIDATE_BYTES: "candidate-bytes-mismatch",
  OUTSIDE_SCOPE: "outside-publication-scope",
  UNSAFE_PATH: "unsafe-path",
  PROTECTED_PATH: "protected-path",
  LINK_ESCAPE: "link-or-reparse-escape",
  NAME_COLLISION: "name-collision",
  NOTHING_TO_APPLY: "nothing-to-apply",
});

export const CONFLICT_KINDS = Object.freeze({
  CHANGED: "changed-since-base",
  CREATED: "created-since-base",
  DELETED: "deleted-since-base",
});

/**
 * Paths an application may never write, whatever a policy says. A policy can add
 * to this list (`apply.protectedPaths`); nothing can remove from it.
 *
 * The supervisor, integrator, checker and bridge code; agent instruction files;
 * Git, CI and hook configuration; runtime state. Secrets, `.git`, `node_modules`
 * and similar are also refused by the trusted loader's own classification.
 */
export const PROTECTED_PATHS = Object.freeze([
  ".git",
  ".github",
  ".husky",
  ".delivery",
  ".claude",
  ".codex",
  ".vscode",
  "node_modules",
  "scripts/delivery",
  "scripts/delivery-v2",
  "scripts/pm/bridge.mjs",
  "scripts/pm/relay.mjs",
  "scripts/pm-server.mjs",
  "CLAUDE.md",
  "AGENTS.md",
  "CODEX.md",
]);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const hashBytes = (buffer) => "sha256:" + createHash("sha256").update(buffer).digest("hex");
const realOf = (path) => (realpathSync.native ? realpathSync.native(path) : realpathSync(path));

export function hashFile(abs) {
  return hashBytes(readFileSync(abs));
}

/** Is `inner` the same directory as, or inside, `outer`? Both are resolved first. */
export function isInside(outer, inner) {
  let realOuter;
  let realInner;
  try {
    realOuter = realOf(outer);
  } catch {
    realOuter = resolve(outer);
  }
  try {
    realInner = realOf(inner);
  } catch {
    realInner = resolve(inner);
  }
  const rel = relative(realOuter, realInner);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Segment-prefix match against the built-in and policy-added protected paths. */
export function isProtectedPath(path, extra = []) {
  const clean = normalizePath(path);
  const lower = clean.toLowerCase();
  return [...PROTECTED_PATHS, ...(extra || [])].some((entry) => {
    const prefix = normalizePath(entry).replace(/\/+$/u, "").toLowerCase();
    return prefix !== "" && (lower === prefix || lower.startsWith(prefix + "/"));
  });
}

/**
 * Where a relative path lands in the destination, established segment by segment.
 *
 * A link or reparse point anywhere on the way is refused rather than followed; a
 * sibling whose name differs only by case or Unicode form is refused, because on
 * this platform writing `Config.ts` would silently replace `config.ts`; a parent
 * that is a file is refused. A missing path is fine — it is a creation.
 *
 * @param {string} root
 * @param {string} path
 * @returns {{ok:boolean, reason:(string|null), detail:(string|null), exists:boolean, abs:(string|null)}}
 */
export function inspectDestination(root, path) {
  const refuse = (reason, detail = null) => deepFreeze({ ok: false, reason, detail, exists: false, abs: null });
  const classified = classifyRelativePath(path);
  if (!classified.ok || !classified.path) return refuse(APPLY_REFUSALS.UNSAFE_PATH, classified.reason);
  const realRoot = realOf(root);
  const segments = classified.path.split("/");
  let cursor = realRoot;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    let names = [];
    try {
      names = readdirSync(cursor);
    } catch {
      names = [];
    }
    const key = segment.normalize("NFC").toLowerCase();
    const twin = names.find((name) => name !== segment && name.normalize("NFC").toLowerCase() === key);
    if (twin) return refuse(APPLY_REFUSALS.NAME_COLLISION, twin);
    const next = join(cursor, segment);
    let stat;
    try {
      stat = lstatSync(next);
    } catch {
      return deepFreeze({ ok: true, reason: null, detail: null, exists: false, abs: join(realRoot, ...segments) });
    }
    // True for POSIX symlinks and for Windows junctions and reparse points.
    if (stat.isSymbolicLink()) return refuse(APPLY_REFUSALS.LINK_ESCAPE, segments.slice(0, index + 1).join("/"));
    if (index < segments.length - 1 && !stat.isDirectory()) return refuse(APPLY_REFUSALS.UNSAFE_PATH, "a parent is not a directory");
    if (index === segments.length - 1 && !stat.isFile()) return refuse(APPLY_REFUSALS.UNSAFE_PATH, "not a regular file");
    cursor = next;
  }
  const rel = relative(realRoot, realOf(cursor));
  if (rel.startsWith("..") || isAbsolute(rel)) return refuse(APPLY_REFUSALS.LINK_ESCAPE, classified.path);
  return deepFreeze({ ok: true, reason: null, detail: null, exists: true, abs: cursor });
}

/**
 * Decide exactly what an application would write, and whether it may.
 *
 * Nothing is written. The plan is bound to the candidate identity and the before
 * and after hash of every path, so an approval of this plan cannot be replayed
 * against different bytes.
 *
 * @param {{root:string, candidate:any, publicationScope:{allowedPaths:readonly string[]},
 *   protectedPaths?:readonly string[]}} input
 */
export function planApplication({ root, candidate, publicationScope, protectedPaths = [] }) {
  if (!candidate || !isNonEmptyString(candidate.candidate_id)) throw new ContractError("planApplication requires a frozen candidate");
  const refusals = [];
  const conflicts = [];
  const ops = [];

  if (isInside(root, candidate.root)) {
    refusals.push({ code: APPLY_REFUSALS.CANDIDATE_INSIDE_DESTINATION, path: null, detail: "the frozen candidate must live outside the checkout it is applied to" });
  }
  const freshness = candidateFreshness(candidate);
  if (!freshness.fresh) {
    refusals.push({ code: APPLY_REFUSALS.CANDIDATE_CHANGED, path: null, detail: [...freshness.changed, ...freshness.added, ...freshness.removed].join(", ") });
  }
  if (candidate.refusals && candidate.refusals.length) {
    refusals.push({ code: APPLY_REFUSALS.CANDIDATE_UNTRUSTED, path: null, detail: candidate.refusals.map((entry) => entry.path + " (" + entry.reason + ")").join(", ") });
  }
  const scope = checkPublicationScope(candidate, publicationScope);
  if (!scope.ok) refusals.push({ code: APPLY_REFUSALS.OUTSIDE_SCOPE, path: null, detail: scope.outside.join(", ") });

  const changes = candidateChangedPaths(candidate);
  if (!changes.length) refusals.push({ code: APPLY_REFUSALS.NOTHING_TO_APPLY, path: null, detail: "the candidate matches its base" });

  const base = new Map(candidate.base_manifest.map((entry) => [entry.path, entry.sha256]));
  const after = new Map(candidate.manifest.map((entry) => [entry.path, entry.sha256]));
  changes.forEach((change, index) => {
    const path = change.path;
    const classified = classifyRelativePath(path);
    if (!classified.ok) return refusals.push({ code: APPLY_REFUSALS.UNSAFE_PATH, path, detail: classified.reason });
    if (isProtectedPath(path, protectedPaths)) return refusals.push({ code: APPLY_REFUSALS.PROTECTED_PATH, path, detail: null });
    const destination = inspectDestination(root, path);
    if (!destination.ok) return refusals.push({ code: destination.reason, path, detail: destination.detail });
    const target = after.get(path) ?? null;
    if (target) {
      const source = resolveInside(candidate.root, path);
      if (!source.ok || !source.real || hashFile(source.real) !== target) {
        return refusals.push({ code: APPLY_REFUSALS.CANDIDATE_BYTES, path, detail: source.reason });
      }
    }
    const before = base.get(path) ?? null;
    const current = destination.exists && destination.abs ? hashFile(destination.abs) : null;
    const kind = change.kind === "add" ? "create" : change.kind === "delete" ? "delete" : "update";
    if (current === target) {
      ops.push({ index, path, kind, before, after: target, noop: true });
      return undefined;
    }
    if (current !== before) {
      conflicts.push({
        path,
        kind: current == null ? CONFLICT_KINDS.DELETED : before == null ? CONFLICT_KINDS.CREATED : CONFLICT_KINDS.CHANGED,
        expected: before,
        observed: current,
      });
      return undefined;
    }
    ops.push({ index, path, kind, before, after: target, noop: false });
    return undefined;
  });

  // Base files the candidate did not touch but the owner has changed since. They
  // are left exactly as they are; the integrated checks observe them.
  const touched = new Set(changes.map((change) => change.path));
  const unrelatedDrift = [];
  for (const entry of candidate.base_manifest) {
    if (touched.has(entry.path)) continue;
    const destination = inspectDestination(root, entry.path);
    const current = destination.ok && destination.exists && destination.abs ? hashFile(destination.abs) : null;
    if (current !== entry.sha256) unrelatedDrift.push(entry.path);
  }

  const body = ops.map(({ path, kind, before, after: target }) => ({ path, kind, before, after: target }));
  return deepFreeze({
    ok: refusals.length === 0 && conflicts.length === 0,
    candidate_id: candidate.candidate_id,
    plan_digest: contentId("aplan", { v: 1, candidate_id: candidate.candidate_id, ops: body }),
    refusals,
    conflicts,
    ops,
    writes: ops.filter((op) => !op.noop).length,
    unrelatedDrift,
    migrationPaths: changes.map((change) => change.path).filter((path) => path.startsWith("migrations/")),
  });
}

function writeDurable(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = path + ".tmp-" + randomBytes(4).toString("hex");
  writeFileSync(temp, bytes, { flag: "wx" });
  const fd = openSync(temp, "r+");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temp, path);
  if (hashBytes(readFileSync(path)) !== hashBytes(bytes)) throw new ContractError("journal write did not verify: " + path);
}

function journalLine(dir, entry) {
  appendFileSync(join(dir, "journal.ndjson"), JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", "utf8");
}

const beforeImage = (dir, index) => join(dir, "before", index + ".bin");
const afterImage = (dir, index) => join(dir, "after", index + ".bin");

/**
 * Copy every before-image and every candidate file into the journal, verified.
 * A before-image that no longer matches the plan stops the application here,
 * before anything in the checkout has changed.
 *
 * @param {{dir:string, root:string, candidate:any, plan:ReturnType<typeof planApplication>}} input
 */
export function prepareJournal({ dir, root, candidate, plan }) {
  if (isInside(root, dir)) throw new ContractError("the application journal must live outside the checkout");
  mkdirSync(dir, { recursive: true });
  const conflicts = [];
  for (const op of plan.ops) {
    if (op.noop) continue;
    if (op.before) {
      const destination = inspectDestination(root, op.path);
      const bytes = destination.ok && destination.exists && destination.abs ? readFileSync(destination.abs) : null;
      if (!bytes || hashBytes(bytes) !== op.before) {
        conflicts.push({ path: op.path, kind: CONFLICT_KINDS.CHANGED, expected: op.before, observed: bytes ? hashBytes(bytes) : null });
        continue;
      }
      writeDurable(beforeImage(dir, op.index), bytes);
    }
    if (op.after) {
      const source = resolveInside(candidate.root, op.path);
      const bytes = source.ok && source.real ? readFileSync(source.real) : null;
      if (!bytes || hashBytes(bytes) !== op.after) throw new ContractError(APPLY_REFUSALS.CANDIDATE_BYTES + ": " + op.path);
      writeDurable(afterImage(dir, op.index), bytes);
    }
  }
  writeDurable(join(dir, "plan.json"), Buffer.from(JSON.stringify({ candidate_id: plan.candidate_id, plan_digest: plan.plan_digest, ops: plan.ops }, null, 2), "utf8"));
  return deepFreeze({ ok: conflicts.length === 0, conflicts });
}

/** Create missing parent directories one segment at a time, refusing any link on the way. */
function ensureParents(root, path) {
  const segments = normalizePath(path).split("/").slice(0, -1);
  let cursor = realOf(root);
  for (const segment of segments) {
    const next = join(cursor, segment);
    let stat = null;
    try {
      stat = lstatSync(next);
    } catch {
      stat = null;
    }
    if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new ContractError(APPLY_REFUSALS.LINK_ESCAPE + ": " + path);
    if (!stat) mkdirSync(next);
    cursor = next;
  }
}

/**
 * Write the planned operations, one path at a time.
 *
 * Each operation re-reads its destination first: a path that already holds the
 * candidate's bytes is counted as done (a resumed application), a path that holds
 * neither the before-image nor the candidate is a conflict and stops everything.
 * Filesystem errors stop the application and are returned; `faults` exists so a
 * fixture can simulate the process dying between two operations.
 *
 * @param {{root:string, dir:string, ops:readonly any[],
 *   faults?:{beforeWrite?:(op:any)=>void, beforeRename?:(op:any)=>void}}} input
 */
export function writeOperations({ root, dir, ops, faults = {} }) {
  const done = [];
  for (const op of ops) {
    if (op.noop) continue;
    const destination = inspectDestination(root, op.path);
    if (!destination.ok) return deepFreeze({ ok: false, done, failed: { index: op.index, path: op.path, code: destination.reason, observed: null } });
    const current = destination.exists && destination.abs ? hashFile(destination.abs) : null;
    if (current === op.after) {
      journalLine(dir, { index: op.index, path: op.path, phase: "already" });
      done.push(op.index);
      continue;
    }
    if (current !== op.before) {
      return deepFreeze({ ok: false, done, failed: { index: op.index, path: op.path, code: "conflict", observed: current } });
    }
    journalLine(dir, { index: op.index, path: op.path, phase: "writing" });
    if (typeof faults.beforeWrite === "function") faults.beforeWrite(op);
    try {
      if (op.kind === "delete") {
        unlinkSync(String(destination.abs));
      } else {
        const bytes = readFileSync(afterImage(dir, op.index));
        if (hashBytes(bytes) !== op.after) throw new ContractError("journal image does not match the plan: " + op.path);
        ensureParents(root, op.path);
        const target = String(destination.abs);
        const temp = target + ".era-apply-" + randomBytes(4).toString("hex") + ".tmp";
        writeFileSync(temp, bytes, { flag: "wx" });
        const fd = openSync(temp, "r+");
        try {
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        if (typeof faults.beforeRename === "function") faults.beforeRename(op);
        renameSync(temp, target);
      }
    } catch (error) {
      if (error && error.simulatedCrash) throw error;
      return deepFreeze({ ok: false, done, failed: { index: op.index, path: op.path, code: "write-error", observed: String((error && error.message) || error) } });
    }
    const check = inspectDestination(root, op.path);
    const observed = check.ok && check.exists && check.abs ? hashFile(check.abs) : null;
    if (observed !== op.after) {
      return deepFreeze({ ok: false, done, failed: { index: op.index, path: op.path, code: "post-write-mismatch", observed } });
    }
    journalLine(dir, { index: op.index, path: op.path, phase: "written" });
    done.push(op.index);
  }
  return deepFreeze({ ok: true, done, failed: null });
}

/**
 * What the checkout actually holds for each operation, read from its bytes.
 *
 * @param {{root:string, ops:readonly any[]}} input
 * @returns {{applied:string[], pending:string[], foreign:{path:string, observed:(string|null)}[]}}
 */
export function inspectOperations({ root, ops }) {
  const applied = [];
  const pending = [];
  const foreign = [];
  for (const op of ops) {
    if (op.noop) continue;
    const destination = inspectDestination(root, op.path);
    const current = destination.ok && destination.exists && destination.abs ? hashFile(destination.abs) : null;
    if (current === op.after) applied.push(op.path);
    else if (current === op.before) pending.push(op.path);
    else foreign.push({ path: op.path, observed: current });
  }
  return deepFreeze({ applied, pending, foreign });
}

/**
 * Describe the exact inverse without changing the checkout.  The digest binds
 * the application revision, every expected before/after identity and the bytes
 * currently observed at each destination.  Confirmation must recompute this
 * immediately before the first inverse write.
 */
export function previewRollback({ root, dir, application_id, revision, ops }) {
  const operations = [];
  const conflicts = [];
  for (const op of [...ops].reverse()) {
    if (op.noop) continue;
    const destination = inspectDestination(root, op.path);
    if (!destination.ok) {
      conflicts.push({ path: op.path, code: destination.reason, observed: null });
      continue;
    }
    const observed = destination.exists && destination.abs ? hashFile(destination.abs) : null;
    let action = "restore";
    if (op.before == null) action = "delete";
    else if (op.after == null) action = "recreate";
    if (op.before != null) {
      try {
        const before = readFileSync(beforeImage(dir, op.index));
        if (hashBytes(before) !== op.before) {
          conflicts.push({ path: op.path, code: "before-image-mismatch", observed });
          continue;
        }
      } catch {
        conflicts.push({ path: op.path, code: "before-image-unavailable", observed });
        continue;
      }
    }
    if (observed !== op.after) {
      conflicts.push({ path: op.path, code: "changed-since-apply", observed });
      continue;
    }
    operations.push({ path: op.path, action, before: op.before, after: op.after });
  }
  const digest = contentId("rollback", {
    v: 1,
    application_id,
    revision,
    operations,
    conflicts,
  });
  return deepFreeze({
    application_id,
    revision,
    operations: Object.freeze(operations),
    conflicts: Object.freeze(conflicts),
    digest,
    ok: conflicts.length === 0,
  });
}

/**
 * Put back the before-image of every path that still holds the candidate's bytes.
 * A path changed since is never overwritten; it is returned in `foreign`.
 *
 * @param {{root:string, dir:string, ops:readonly any[]}} input
 */
export function rollbackOperations({ root, dir, ops }) {
  const restored = [];
  const deleted = [];
  const recreated = [];
  const foreign = [];
  const failed = [];
  for (const op of [...ops].reverse()) {
    if (op.noop) continue;
    const destination = inspectDestination(root, op.path);
    const current = destination.ok && destination.exists && destination.abs ? hashFile(destination.abs) : null;
    if (current === op.before) continue;
    if (current !== op.after) {
      foreign.push({ path: op.path, observed: current });
      continue;
    }
    try {
      if (op.before == null) {
        unlinkSync(String(destination.abs));
      } else {
        const bytes = readFileSync(beforeImage(dir, op.index));
        if (hashBytes(bytes) !== op.before) throw new ContractError("backup does not match the recorded before-image: " + op.path);
        ensureParents(root, op.path);
        const target = String(destination.abs || join(realOf(root), ...normalizePath(op.path).split("/")));
        const temp = target + ".era-restore-" + randomBytes(4).toString("hex") + ".tmp";
        writeFileSync(temp, bytes, { flag: "wx" });
        renameSync(temp, target);
      }
      journalLine(dir, { index: op.index, path: op.path, phase: "restored" });
      restored.push(op.path);
      if (op.before == null) deleted.push(op.path);
      else if (op.after == null) recreated.push(op.path);
    } catch (error) {
      failed.push({ path: op.path, error: String((error && error.message) || error) });
    }
  }
  return deepFreeze({ ok: foreign.length === 0 && failed.length === 0, restored, deleted, recreated, foreign, failed });
}

/**
 * Freeze the checkout's current bytes for the checked scope into a new generation.
 *
 * The copy goes through the same trusted loader a worker's output does, so the
 * checker observes exactly what is on disk now — the applied candidate together
 * with any unrelated owner edits — and nothing it could not trust.
 *
 * @param {{root:string, paths:string[], generationsRoot:string, generation:string,
 *   base_manifest:any[], stagingRoot:string}} input
 */
export function integratedSnapshot({ root, paths, generationsRoot, generation, base_manifest, stagingRoot }) {
  mkdirSync(stagingRoot, { recursive: true });
  const staging = mkdtempSync(join(stagingRoot, "integrated-"));
  try {
    const supplied = provisionScratch({ scratchRoot: staging, hostRoot: root, include: [...new Set(paths)].sort() });
    const imported = importTrustedCandidate({ sourceRoot: staging, generationsRoot, generation, base_manifest, kind: "code" });
    return deepFreeze({ candidate: imported.candidate, refusals: [...supplied.refusals, ...imported.importRefusals] });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

/**
 * What an application would produce, without writing the checkout: the
 * destination's current bytes for the candidate's snapshot scope with the
 * candidate's own changes laid over them, frozen through the trusted loader.
 *
 * Command Center Phase 5 (DLV-106): once another application or a CLI edit has
 * changed a candidate's base, its evidence describes source that no longer exists.
 * The protected checker observes this preview before any byte is written; the
 * integrated snapshot after writing is still checked as before.
 *
 * @param {{root:string, candidate:any, generationsRoot:string, generation:string, stagingRoot:string}} input
 */
export function previewIntegration({ root, candidate, generationsRoot, generation, stagingRoot }) {
  mkdirSync(stagingRoot, { recursive: true });
  const staging = mkdtempSync(join(stagingRoot, "preview-"));
  try {
    const changes = candidateChangedPaths(candidate);
    const changed = new Set(changes.map((change) => change.path));
    const scope = [...new Set([...candidate.base_manifest.map((entry) => entry.path), ...candidate.manifest.map((entry) => entry.path)])].sort();
    const supplied = provisionScratch({ scratchRoot: staging, hostRoot: root, include: scope.filter((path) => !changed.has(path)) });
    const refusals = [...supplied.refusals];
    for (const change of changes) {
      if (change.kind === "delete") continue;
      const classified = classifyRelativePath(change.path);
      const source = resolveInside(candidate.root, change.path);
      if (!classified.ok || !classified.path || !source.ok || !source.real) {
        refusals.push({ path: change.path, reason: source.reason || classified.reason || APPLY_REFUSALS.CANDIDATE_BYTES });
        continue;
      }
      const target = join(staging, ...classified.path.split("/"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(source.real));
    }
    const imported = importTrustedCandidate({ sourceRoot: staging, generationsRoot, generation, base_manifest: candidate.base_manifest, kind: "code" });
    return deepFreeze({ candidate: imported.candidate, refusals: [...refusals, ...imported.importRefusals] });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
