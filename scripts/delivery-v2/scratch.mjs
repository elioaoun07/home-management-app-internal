// scripts/delivery-v2/scratch.mjs
// PM Delivery V2 — S1.1: the confined scratch workspace and the trusted loader.
//
// "PM Delivery — V2 Architecture.md" §8 is the spec:
//
//   "Build a plain snapshot from explicitly included source/docs/fixtures.
//    Exclude .git, secrets, live runtime state, host credentials, unapproved
//    connectors and traversal/reparse links. A trusted loader resolves actual
//    paths and rejects case/Unicode collisions or escaping links; never follow a
//    worker-provided path into the host."
//
// Two separate boundaries, deliberately not merged
// ------------------------------------------------
// The *executor's* sandbox is the OS-level boundary — it is what stops a running
// tool from touching the host, and only the backend can provide it. It is
// qualified by adapters/codex.mjs + probes/, not here.
//
// This module is the boundary ERA owns and can therefore actually prove: what
// goes *into* the workspace, and what is trusted to come back *out* of it. It is
// enforced against real files, real Windows junctions and real reparse points,
// because "a copied checkout is not itself a security boundary" (Portfolio S1.1)
// cuts both ways — the copy is not containment, but a loader that follows a link
// the worker planted is an escape hatch with no sandbox involved at all.
//
// Every refusal below is a refusal. Nothing here "sanitizes and continues": a
// path that cannot be established as inside the root does not get a best-effort
// interpretation, it gets left out and named.

import { createHash } from "node:crypto";
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { ContractError, deepFreeze, normalizePath } from "./contracts.mjs";

/** Why a path or entry was kept out. Callers and fixtures match on codes. */
export const SCRATCH_REFUSALS = Object.freeze({
  ABSOLUTE_PATH: "absolute-path",
  TRAVERSAL: "traversal",
  ESCAPES_ROOT: "escapes-root",
  LINK: "reparse-or-link",
  EXCLUDED: "excluded-by-policy",
  COLLISION: "name-collision",
  MISSING: "missing",
  NOT_A_FILE: "not-a-file",
  NUL_BYTE: "nul-byte",
  RESERVED_NAME: "reserved-device-name",
  SCRATCH_INSIDE_HOST: "scratch-inside-host-checkout",
});

/**
 * Path segments that never enter a candidate snapshot.
 *
 * `.git` leads the list for the reason Architecture §2 gives: initial candidate
 * creation uses a plain source snapshot with no Git metadata. A worker that can
 * see `.git` can read the host's remotes, credentials helper configuration and
 * every historical version of a file the contract excluded.
 */
export const EXCLUDED_SEGMENTS = Object.freeze([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  ".delivery",
  ".codex",
  ".claude",
  ".vscode",
  ".next",
  ".vercel",
]);

/** Filenames that are credentials or live runtime state by shape, wherever they sit. */
export const EXCLUDED_NAME_PATTERNS = Object.freeze([
  /^\.env(\..*)?$/iu,
  /^.*\.pem$/iu,
  /^.*\.key$/iu,
  /^.*\.pfx$/iu,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/iu,
  /^\.npmrc$/iu,
  /^\.netrc$/iu,
  /^auth\.json$/iu,
  /^credentials(\.json)?$/iu,
  /^.*\.sqlite(-wal|-shm)?$/iu,
]);

/** Windows device names that are not files however they are spelled. */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/iu;

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/** sha256 of a buffer, prefixed so the algorithm stays visible in the manifest. */
function hashBytes(buffer) {
  return "sha256:" + createHash("sha256").update(buffer).digest("hex");
}

/**
 * Is this relative path safe to interpret at all?
 *
 * Checked before touching the filesystem, because the cheapest place to refuse
 * `..\..\Users\aoune\.codex\auth.json` is before anything resolves it. Absolute
 * paths are refused rather than rebased: a worker-supplied absolute path is a
 * request to leave the workspace, and rebasing it would silently grant that
 * request against a different root.
 *
 * @param {string} candidate
 * @returns {{ok:boolean, reason:(string|null), path:(string|null)}}
 */
export function classifyRelativePath(candidate) {
  const raw = String(candidate == null ? "" : candidate);
  if (raw.includes("\0")) return { ok: false, reason: SCRATCH_REFUSALS.NUL_BYTE, path: null };
  const normalized = normalizePath(raw);
  if (!isNonEmptyString(normalized)) return { ok: false, reason: SCRATCH_REFUSALS.MISSING, path: null };
  if (isAbsolute(raw) || /^[a-z]:/iu.test(normalized) || normalized.startsWith("//")) {
    return { ok: false, reason: SCRATCH_REFUSALS.ABSOLUTE_PATH, path: null };
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === ".." )) {
    return { ok: false, reason: SCRATCH_REFUSALS.TRAVERSAL, path: null };
  }
  if (segments.some((segment) => RESERVED_NAMES.test(segment))) {
    return { ok: false, reason: SCRATCH_REFUSALS.RESERVED_NAME, path: null };
  }
  if (segments.some((segment) => EXCLUDED_SEGMENTS.includes(segment))) {
    return { ok: false, reason: SCRATCH_REFUSALS.EXCLUDED, path: null };
  }
  const name = segments[segments.length - 1];
  if (EXCLUDED_NAME_PATTERNS.some((pattern) => pattern.test(name))) {
    return { ok: false, reason: SCRATCH_REFUSALS.EXCLUDED, path: null };
  }
  return { ok: true, reason: null, path: normalized };
}

/**
 * Resolve `relativePath` under `root` and establish that the *real* target is
 * still under the *real* root.
 *
 * The realpath comparison is the point. A junction, symlink or Windows reparse
 * point inside the workspace resolves to wherever it points, and comparing the
 * unresolved strings would happily accept `scratch/out -> C:\Users\aoune\.codex`.
 * Both sides are resolved before they are compared, and a link *anywhere on the
 * way in* is refused outright rather than followed — the loader's job is to copy
 * a plain tree, and there is no case in a source snapshot where following a link
 * out of the workspace is the intended behaviour.
 *
 * @param {string} root
 * @param {string} relativePath
 */
export function resolveInside(root, relativePath) {
  const classified = classifyRelativePath(relativePath);
  if (!classified.ok) return deepFreeze({ ok: false, reason: classified.reason, absolute: null, real: null });

  const realRoot = realpathSync.native ? realpathSync.native(root) : realpathSync(root);
  const absolute = resolve(realRoot, classified.path);

  // Walk down from the root so a link partway along the path is caught even when
  // the final component is an ordinary file.
  let cursor = realRoot;
  for (const segment of classified.path.split("/")) {
    cursor = join(cursor, segment);
    let stat;
    try {
      stat = lstatSync(cursor);
    } catch {
      return deepFreeze({ ok: false, reason: SCRATCH_REFUSALS.MISSING, absolute, real: null });
    }
    if (stat.isSymbolicLink()) {
      return deepFreeze({ ok: false, reason: SCRATCH_REFUSALS.LINK, absolute, real: null });
    }
  }

  let real;
  try {
    real = realpathSync.native ? realpathSync.native(absolute) : realpathSync(absolute);
  } catch {
    return deepFreeze({ ok: false, reason: SCRATCH_REFUSALS.MISSING, absolute, real: null });
  }
  const rel = relative(realRoot, real);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    return deepFreeze({ ok: false, reason: SCRATCH_REFUSALS.ESCAPES_ROOT, absolute, real });
  }
  return deepFreeze({ ok: true, reason: null, absolute, real });
}

/**
 * Refuse a scratch root that lives inside the host checkout.
 *
 * Not a style preference. If the workspace is a subdirectory of the repository,
 * then "the worker cannot write the host checkout" is untestable by construction,
 * and every containment claim made about it is unfalsifiable.
 *
 * @param {{scratchRoot:string, hostRoot:string}} input
 */
export function assertScratchOutsideHost({ scratchRoot, hostRoot }) {
  const realHost = realpathSync(hostRoot);
  const realScratch = resolve(scratchRoot);
  const rel = relative(realHost, realScratch);
  if (rel !== "" && !rel.startsWith("..") && !isAbsolute(rel)) {
    throw new ContractError(
      SCRATCH_REFUSALS.SCRATCH_INSIDE_HOST + ": " + scratchRoot + " is inside the host checkout " + hostRoot,
    );
  }
  return true;
}

/**
 * Collect names in one directory that differ only by case or Unicode form.
 *
 * Windows and macOS will happily let `Config.ts` and `config.ts` collapse into one
 * file during a copy, and NFC/NFD pairs do the same for accented names. Either
 * way a candidate would silently lose a file, and its diff would show a deletion
 * nobody made. Detecting it is cheap; recovering from it after the fact is not.
 *
 * @param {string[]} names
 */
export function findNameCollisions(names) {
  const seen = new Map();
  const collisions = [];
  for (const name of names) {
    const key = name.normalize("NFC").toLowerCase();
    if (seen.has(key)) collisions.push({ key, names: [seen.get(key), name] });
    else seen.set(key, name);
  }
  return collisions;
}

/**
 * @typedef {object} SnapshotEntry
 * @property {string} path repo-relative, forward slashes
 * @property {string} sha256
 * @property {number} size
 */

/**
 * Walk a tree and return the manifest of the files that may be trusted.
 *
 * Everything refused is returned too, with its code. A caller that wants to fail
 * closed can check `refusals.length === 0`; a caller building a candidate wants
 * the list so the Result can say what was left behind and why. Silence would be
 * the worst of both.
 *
 * @param {{root:string, maxBytes?:number}} input
 */
export function walkTrusted({ root, maxBytes = 8 * 1024 * 1024 }) {
  const realRoot = realpathSync(root);
  /** @type {SnapshotEntry[]} */
  const entries = [];
  /** @type {{path:string, reason:string}[]} */
  const refusals = [];

  /** @param {string} dirAbs @param {string} prefix */
  function walk(dirAbs, prefix) {
    let dirents;
    try {
      dirents = readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      refusals.push({ path: prefix || ".", reason: SCRATCH_REFUSALS.MISSING });
      return;
    }
    const collisions = findNameCollisions(dirents.map((dirent) => dirent.name));
    for (const collision of collisions) {
      refusals.push({ path: prefix + collision.names.join("|"), reason: SCRATCH_REFUSALS.COLLISION });
    }
    if (collisions.length) return; // an ambiguous directory contributes nothing

    for (const dirent of dirents) {
      const rel = prefix + dirent.name;
      const classified = classifyRelativePath(rel);
      if (!classified.ok) {
        refusals.push({ path: rel, reason: classified.reason });
        continue;
      }
      // isSymbolicLink() is true for Windows junctions and reparse points as well
      // as POSIX symlinks, which is exactly the set that must not be followed.
      if (dirent.isSymbolicLink()) {
        refusals.push({ path: rel, reason: SCRATCH_REFUSALS.LINK });
        continue;
      }
      const abs = join(dirAbs, dirent.name);
      if (dirent.isDirectory()) {
        walk(abs, rel + "/");
        continue;
      }
      if (!dirent.isFile()) {
        refusals.push({ path: rel, reason: SCRATCH_REFUSALS.NOT_A_FILE });
        continue;
      }
      const resolved = resolveInside(realRoot, rel);
      if (!resolved.ok) {
        refusals.push({ path: rel, reason: resolved.reason });
        continue;
      }
      const bytes = readFileSync(resolved.real);
      if (bytes.length > maxBytes) {
        refusals.push({ path: rel, reason: SCRATCH_REFUSALS.NOT_A_FILE });
        continue;
      }
      entries.push({ path: rel, sha256: hashBytes(bytes), size: bytes.length });
    }
  }

  walk(realRoot, "");
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  refusals.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return deepFreeze({ root: normalizePath(realRoot), entries, refusals });
}

/**
 * Copy an explicitly named set of host files into a fresh scratch workspace.
 *
 * "Explicitly named" is load-bearing: this does not mirror a directory, it copies
 * a list the contract produced. A worker therefore cannot widen its own inputs by
 * creating a file where the copier would have looked, and the manifest is a
 * complete statement of what was supplied at launch — which is the only thing
 * ERA is entitled to claim it supplied (Context §5).
 *
 * @param {{scratchRoot:string, hostRoot:string, include:string[]}} input
 */
export function provisionScratch({ scratchRoot, hostRoot, include }) {
  assertScratchOutsideHost({ scratchRoot, hostRoot });
  mkdirSync(scratchRoot, { recursive: true });

  const realHost = realpathSync(hostRoot);
  /** @type {SnapshotEntry[]} */
  const supplied = [];
  /** @type {{path:string, reason:string}[]} */
  const refusals = [];

  for (const requested of include || []) {
    const resolved = resolveInside(realHost, requested);
    if (!resolved.ok) {
      refusals.push({ path: normalizePath(requested), reason: resolved.reason });
      continue;
    }
    let stat;
    try {
      stat = lstatSync(resolved.real);
    } catch {
      refusals.push({ path: normalizePath(requested), reason: SCRATCH_REFUSALS.MISSING });
      continue;
    }
    if (!stat.isFile()) {
      refusals.push({ path: normalizePath(requested), reason: SCRATCH_REFUSALS.NOT_A_FILE });
      continue;
    }
    const rel = normalizePath(requested);
    const target = join(scratchRoot, rel.split("/").join(sep));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(resolved.real, target);
    const bytes = readFileSync(target);
    supplied.push({ path: rel, sha256: hashBytes(bytes), size: bytes.length });
  }

  supplied.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return deepFreeze({
    root: normalizePath(resolve(scratchRoot)),
    supplied,
    refusals,
    manifest_fingerprint: hashBytes(Buffer.from(JSON.stringify(supplied), "utf8")),
  });
}

/**
 * Write a small file inside the workspace, refusing anything that would land
 * outside it.
 *
 * Used by the probe harness to plant canaries. It exists as a named export rather
 * than an inline `writeFileSync` so that even the test scaffolding goes through
 * the same containment check as everything else.
 *
 * @param {{root:string, path:string, contents:string}} input
 */
export function writeInsideScratch({ root, path, contents }) {
  const classified = classifyRelativePath(path);
  if (!classified.ok) throw new ContractError("refused write to " + path + ": " + classified.reason);
  const target = join(realpathSync(root), classified.path.split("/").join(sep));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
  return normalizePath(classified.path);
}
