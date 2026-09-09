// scripts/delivery-v2/candidate.mjs
// PM Delivery V2 — S1.1/S1.3: candidate identity from the actual frozen bytes.
//
// "Supervisor freezes and hashes actual bytes; a worker-supplied digest is not
// candidate identity" — "PM Delivery — Context & Agent Model.md" §3,
// `exportCandidate`. Architecture §4 says the same from the other side: a
// Candidate's "identity [is] assigned by trusted snapshotting, not worker
// assertion".
//
// So this module never accepts an identity. It takes a directory, walks it
// through the trusted loader in scratch.mjs, hashes what is really there, and
// derives the identifier from that manifest. Anything the writer claimed about
// its own output travels alongside as `workerClaims` and is read by nothing.
//
// Why generations rather than versions
// ------------------------------------
// Evidence & Autonomy §5: "Freeze generation C1, check C1, return evidence for
// C1. A repair creates C2. C1's evidence stays historical and cannot certify C2
// automatically." A candidate here is therefore immutable and content-addressed:
// there is no `updateCandidate`, and a repaired tree simply produces a different
// candidate_id, which is what makes the old evidence stop matching.

import { ContractError, CANDIDATE_KINDS, contentId, deepFreeze, normalizePath } from "./contracts.mjs";
import { walkTrusted } from "./scratch.mjs";

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

/**
 * @typedef {object} Candidate
 * @property {string} candidate_id derived from the manifest of real bytes
 * @property {string} kind "code" | "research"
 * @property {string} generation "C1", "C2", … within one run
 * @property {(string|null)} job_id the dispatch whose export produced it
 * @property {string} root where the frozen bytes were read from; not part of the identity
 * @property {readonly {path:string, sha256:string, size:number}[]} manifest
 * @property {readonly {path:string, sha256:string, size:number}[]} base_manifest
 * @property {readonly {path:string, reason:string}[]} refusals what the loader would not trust
 * @property {Record<string, string>} environment relevant environment fingerprints
 * @property {Record<string, unknown>} workerClaims untrusted, retained, never read
 * @property {(string|null)} frozen_at
 */

/**
 * Freeze whatever is on disk under `root` into an immutable candidate.
 *
 * The manifest is the identity. Two exports of byte-identical trees produce the
 * same candidate_id even across machines and clocks, and a single changed byte
 * produces a different one — which is precisely the property that lets
 * `isCandidateFresh` turn "the writer kept editing during the check" into a
 * stale evidence state instead of a silent pass.
 *
 * `refusals` is part of the record rather than a warning stream. A candidate that
 * had to leave a symlinked file behind is a candidate with a known gap, and the
 * Result has to be able to say so.
 *
 * @param {{root:string, kind?:string, generation?:string, job_id?:(string|null),
 *   base_manifest?:{path:string, sha256:string, size:number}[],
 *   environment?:Record<string, string>, workerClaims?:Record<string, unknown>,
 *   frozen_at?:(string|null)}} input
 * @returns {Candidate}
 */
export function freezeCandidate({
  root,
  kind = "code",
  generation = "C1",
  job_id = null,
  base_manifest = [],
  environment = {},
  workerClaims = {},
  frozen_at = null,
}) {
  if (!CANDIDATE_KINDS.includes(kind)) {
    throw new ContractError("candidate.kind must be one of " + CANDIDATE_KINDS.join("|"));
  }
  if (!isNonEmptyString(root)) throw new ContractError("freezeCandidate requires a root");

  const snapshot = walkTrusted({ root });
  const manifest = snapshot.entries.map((entry) => Object.freeze({ ...entry }));

  // Identity over content only: no root path, no clock, no job id. A candidate
  // moved to another directory is the same candidate; a candidate with one edited
  // byte is not.
  const candidate_id = contentId("cand", { v: 1, kind, manifest });

  return deepFreeze({
    candidate_id,
    schema: "delivery-v2/candidate@1",
    kind,
    generation,
    job_id,
    root: normalizePath(root),
    manifest: Object.freeze(manifest),
    base_manifest: Object.freeze(base_manifest.map((entry) => Object.freeze({ ...entry }))),
    refusals: Object.freeze(snapshot.refusals.map((entry) => Object.freeze({ ...entry }))),
    environment: { ...environment },
    workerClaims: { ...workerClaims },
    frozen_at,
  });
}

/**
 * Has the tree changed since it was frozen?
 *
 * Re-walks and re-hashes rather than trusting an mtime. The answer names what
 * moved, because "the candidate is stale" is not actionable and "src/x.ts changed
 * after the check started" is.
 *
 * @param {Candidate} candidate
 * @param {{root?:string}} [where]
 */
export function candidateFreshness(candidate, where = {}) {
  const snapshot = walkTrusted({ root: where.root || candidate.root });
  const before = new Map(candidate.manifest.map((entry) => [entry.path, entry.sha256]));
  const after = new Map(snapshot.entries.map((entry) => [entry.path, entry.sha256]));

  const changed = [];
  const removed = [];
  const added = [];
  for (const [path, sha] of before) {
    if (!after.has(path)) removed.push(path);
    else if (after.get(path) !== sha) changed.push(path);
  }
  for (const path of after.keys()) if (!before.has(path)) added.push(path);

  const fresh = changed.length === 0 && removed.length === 0 && added.length === 0;
  return deepFreeze({
    fresh,
    candidate_id: candidate.candidate_id,
    observed_id: contentId("cand", { v: 1, kind: candidate.kind, manifest: snapshot.entries }),
    changed: Object.freeze(changed.sort()),
    removed: Object.freeze(removed.sort()),
    added: Object.freeze(added.sort()),
  });
}

/**
 * Build the unified-diff-shaped view of base → candidate.
 *
 * Only paths and hashes; the actual text diff is produced by whatever check needs
 * it. What matters at this layer is the set of files the candidate touched, which
 * is what `publicationScope` is enforced against.
 *
 * @param {Candidate} candidate
 */
export function candidateChangedPaths(candidate) {
  const base = new Map(candidate.base_manifest.map((entry) => [entry.path, entry.sha256]));
  const now = new Map(candidate.manifest.map((entry) => [entry.path, entry.sha256]));
  const touched = [];
  for (const [path, sha] of now) {
    if (!base.has(path)) touched.push({ path, kind: "add" });
    else if (base.get(path) !== sha) touched.push({ path, kind: "update" });
  }
  for (const path of base.keys()) if (!now.has(path)) touched.push({ path, kind: "delete" });
  touched.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return deepFreeze(touched.map((entry) => Object.freeze(entry)));
}

/**
 * Does everything this candidate changed fall inside the contract's publication
 * scope?
 *
 * Architecture §8: "Scratch permission can be broader than permitted publication.
 * Temporary exploration inside authorized scratch is allowed; the entire
 * candidate diff must meet publicationScope before acceptance/application."
 *
 * An empty allowedPaths list means nothing may be published, not everything.
 * The permissive reading is how a contract with an unfilled field becomes a
 * licence, and there is no situation where the safe default is "anywhere".
 *
 * @param {Candidate} candidate
 * @param {{allowedPaths:readonly string[]}} publicationScope
 */
export function checkPublicationScope(candidate, publicationScope) {
  const allowed = (publicationScope && publicationScope.allowedPaths) || [];
  const touched = candidateChangedPaths(candidate);
  const outside = touched
    .filter((entry) => !allowed.some((prefix) => withinPrefix(entry.path, prefix)))
    .map((entry) => entry.path);
  return deepFreeze({
    ok: outside.length === 0,
    touched: Object.freeze(touched.map((entry) => entry.path)),
    outside: Object.freeze(outside),
    allowedPaths: Object.freeze([...allowed]),
  });
}

/**
 * Prefix containment on path *segments*.
 *
 * `src/features/budget` must not match `src/features/budget-archive`, which a
 * naive `startsWith` does. Directory prefixes are compared with their separator
 * so a sibling whose name merely begins the same way stays outside.
 */
function withinPrefix(path, prefix) {
  const clean = normalizePath(prefix).replace(/\/+$/u, "").replace(/\/\*\*$/u, "");
  if (clean === "") return false;
  return path === clean || path.startsWith(clean + "/");
}

/**
 * Reject a digest the writer supplied for its own output.
 *
 * Exported so the refusal is a call site rather than a comment. `exportCandidate`
 * returns material *references* and whatever the worker said; anything shaped
 * like an identity claim goes through here, is refused, and is kept only as a
 * claim.
 *
 * @param {Record<string, unknown>} workerClaims
 */
export function rejectWorkerIdentity(workerClaims) {
  const claimed = [];
  for (const key of ["candidate_id", "digest", "sha256", "hash", "manifest_fingerprint"]) {
    if (workerClaims && workerClaims[key] != null) claimed.push(key);
  }
  return deepFreeze({
    accepted: false,
    claimedFields: Object.freeze(claimed),
    reason:
      claimed.length === 0
        ? "no identity claim was made"
        : "a worker-supplied digest is not candidate identity; the supervisor hashes the actual bytes",
  });
}
