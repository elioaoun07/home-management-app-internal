// Read-only review of a frozen candidate. Before bytes must match its immutable
// base hash: recover them from the unchanged source or a protected Apply journal.
// A changed checkout is never substituted for the base. Nothing is executed.
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { resolveInside } from "./scratch.mjs";
import { candidateChangedPaths } from "./candidate.mjs";

const MAX_FILE_BYTES = 128 * 1024;
const digest = (bytes) =>
  "sha256:" + createHash("sha256").update(bytes).digest("hex");

function readBytes(root, path, expected) {
  if (!expected) return { text: "" };
  if (!root) return { reason: "missing-bytes" };
  try {
    if (lstatSync(root).isSymbolicLink()) return { reason: "unsafe-path" };
    const resolved = resolveInside(root, path);
    if (!resolved.ok || !resolved.real) return { reason: "missing-bytes" };
    const stat = lstatSync(resolved.real);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES)
      return { reason: "too-large" };
    const bytes = readFileSync(resolved.real);
    if (digest(bytes) !== expected) return { reason: "hash-mismatch" };
    if (bytes.includes(0)) return { reason: "binary" };
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { reason: "missing-bytes" };
  }
}

// One bounded replacement hunk, retaining three context lines at either end.
// This is deliberately linear; it cannot stall polling on an adversarial diff.
export function reviewDiff(path, before, after) {
  const lines = (text) =>
    text === "" ? [] : text.match(/[^\n]*\n|[^\n]+$/gu) || [];
  const a = lines(before),
    b = lines(after);
  let start = 0,
    end = 0;
  while (start < Math.min(a.length, b.length) && a[start] === b[start]) start++;
  while (
    end < Math.min(a.length, b.length) - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  )
    end++;
  const contextStart = Math.max(0, start - 3),
    contextEnd = Math.min(3, end);
  const output = [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${a.length ? contextStart + 1 : 0},${a.length - end - contextStart + contextEnd} +${b.length ? contextStart + 1 : 0},${b.length - end - contextStart + contextEnd} @@`,
  ];
  const emit = (prefix, line) => {
    output.push(prefix + line.replace(/\n$/u, ""));
    if (!line.endsWith("\n")) output.push("\\ No newline at end of file");
  };
  a.slice(contextStart, start).forEach((line) => emit(" ", line));
  a.slice(start, a.length - end).forEach((line) => emit("-", line));
  b.slice(start, b.length - end).forEach((line) => emit("+", line));
  a.slice(a.length - end, a.length - end + contextEnd).forEach((line) =>
    emit(" ", line),
  );
  return output.join("\n");
}

/**
 * @param {{candidate:import('./candidate.mjs').Candidate, sourceRoot:string,
 * applications?:{candidate_id:string, journal_dir:string|null, plan:{ops?:{path:string,index:number,before:string|null,after:string|null}[]}}[]}} input
 * @returns {{path:string, kind:string, review:{state:string,reason?:string,diff?:string,beforeHash:string|null,afterHash:string|null}}[]}
 */
export function candidateReview({ candidate, sourceRoot, applications = [] }) {
  let remaining = 64 * 1024;
  const base = new Map(candidate.base_manifest.map((e) => [e.path, e.sha256]));
  const after = new Map(candidate.manifest.map((e) => [e.path, e.sha256]));
  return candidateChangedPaths(candidate).map((entry, index) => {
    const beforeHash = base.get(entry.path) || null,
      afterHash = after.get(entry.path) || null;
    const unavailable = (reason) => ({
      ...entry,
      review: { state: "unavailable", reason, beforeHash, afterHash },
    });
    if (index >= 20 || remaining <= 0) return unavailable("preview-limit");
    let old = readBytes(sourceRoot, entry.path, beforeHash);
    if (old.reason) {
      for (const application of applications) {
        if (
          application.candidate_id !== candidate.candidate_id ||
          !application.journal_dir
        )
          continue;
        const op = application.plan?.ops?.find(
          (op) =>
            op.path === entry.path &&
            op.before === beforeHash &&
            op.after === afterHash &&
            Number.isSafeInteger(op.index) &&
            op.index >= 0,
        );
        if (!op) continue;
        old = readBytes(
          application.journal_dir,
          `before/${op.index}.bin`,
          beforeHash,
        );
        if (!old.reason) break;
      }
    }
    if (old.reason)
      return unavailable(
        old.reason === "hash-mismatch" ? "base-unavailable" : old.reason,
      );
    const next = readBytes(candidate.root, entry.path, afterHash);
    if (next.reason) return unavailable(next.reason);
    const diff = reviewDiff(entry.path, old.text, next.text);
    const size = Buffer.byteLength(diff);
    if (size > remaining) return unavailable("preview-limit");
    remaining -= size;
    return {
      ...entry,
      review: { state: "available", diff, beforeHash, afterHash },
    };
  });
}
