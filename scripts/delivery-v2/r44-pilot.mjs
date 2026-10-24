// Offline R44 input preparation. No runtime, service, provider or policy writes.
import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { resolveInside, walkTrusted } from "./scratch.mjs";
import { validateExecutionPolicy, WORK_PROFILE_CONTRACTS } from "./policy.mjs";

export const R44_CLIENT_ROOTS = ["src/components", "src/features", "src/hooks", "src/contexts"];
export const R44_CONTEXT = [
  "eslint.config.mjs", "src/lib/safeFetch.ts", "src/lib/connectivityManager.ts",
  "package.json", "pnpm-lock.yaml", "tsconfig.json", "vitest.config.ts",
  "tests/setup/blockPaidApis.ts", "tests/pm-ui/command-intents.test.ts",
  "tests/delivery-oracles/r44-fetch-guard.mjs", "CLAUDE.md",
  "ERA Notes/10 - Project Management/PM Tooling/4 - Checklist.md",
  "ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md",
];
export const R44_PUBLICATION = ["eslint.config.mjs", "tests/pm-ui/raw-fetch-guard.test.ts"];

/** Expand exact source files: snapshot includes never recursively copy folders. */
export function r44SourceInputs(root) {
  const clients = R44_CLIENT_ROOTS.flatMap(directory => {
    const found = resolveInside(root, directory);
    if (!found.ok) throw new Error(`R44 input unavailable: ${directory}: ${found.reason}`);
    const tree = walkTrusted({ root: found.real });
    if (tree.refusals.length) throw new Error(`R44 input refused: ${JSON.stringify(tree.refusals)}`);
    return tree.entries.filter(entry => /\.[cm]?[jt]sx?$/u.test(entry.path)).map(entry => `${directory}/${entry.path}`);
  });
  return [...new Set([...R44_CONTEXT, ...clients])].sort();
}

export function r44InputManifest(root, include) {
  return include.map(path => {
    const found = resolveInside(root, path);
    if (!found.ok) throw new Error(`R44 input unavailable: ${path}: ${found.reason}`);
    return { path, sha256: "sha256:" + createHash("sha256").update(readFileSync(found.real)).digest("hex") };
  });
}

/** A deliberately expired draft. Only the owner may date and install it later. */
export function prepareR44Pilot({ root, installed }) {
  const policy = structuredClone(installed);
  policy.policy_revision += 1;
  policy.authorized_by = "PENDING OWNER ACTIVATION — offline preparation only";
  policy.authorized_at = "1970-01-01T00:00:00.000Z";
  policy.grant.expires_at = "1970-01-01T00:00:00.000Z";
  policy.$comment = "UNACTIVATED draft for one owner-started R44 Steward pilot. CODEX_LOW / low / focused; one plan, one implementation, zero repairs; stop at verified_candidate. No Apply or automatic retry. One-run and R44-only scope are owner operational limits, not policy-schema counters.";
  policy.executors.permitted = ["codex"];
  policy.execution = { maxRequestedDisposition: "verified_candidate", repairDispatchLimit: 0, retryAutomatically: false };
  // These are per-run source pins, separate from the retained dependency volume.
  const program = policy.checks?.requiredVerifications?.typecheck?.program;
  if (program?.generatedTypes) {
    for (const path of Object.keys(program.generatedTypes)) {
      if (!/^\.next\/(?:dev\/)?types\/[a-zA-Z0-9_-]+\.(?:d\.ts|ts)$/u.test(path)) throw new Error(`Unexpected generated type: ${path}`);
      let cursor = root;
      for (const part of path.split("/")) {
        cursor = join(cursor, part);
        if (lstatSync(cursor).isSymbolicLink()) throw new Error(`Linked generated type: ${path}`);
      }
      program.generatedTypes[path] = "sha256:" + createHash("sha256").update(readFileSync(cursor)).digest("hex");
    }
  }
  policy.scratchScope = { kind: "snapshot", include: r44SourceInputs(root) };
  policy.publicationScope = { allowedPaths: R44_PUBLICATION, changeConstraints: {} };
  const validation = validateExecutionPolicy(policy);
  if (!validation.ok) throw new Error(JSON.stringify(validation.refusals));
  return {
    policy,
    manifest: r44InputManifest(root, policy.scratchScope.include),
    selection: { file: "PM Tooling/4 - Checklist.md", expectId: "R44", executor: "codex", model: "gpt-6-luna", effort: "low", workProfile: "focused" },
    limits: { ...WORK_PROFILE_CONTRACTS.focused, maxRequestedDisposition: "verified_candidate", retryAutomatically: false, pilots: 1 },
    newFiles: ["tests/pm-ui/raw-fetch-guard.test.ts"],
  };
}
