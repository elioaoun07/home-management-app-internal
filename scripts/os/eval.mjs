// enforces: HR-22 HR-6 HR-19 HR-7 HR-24 HR-25 HR-8 HR-12
// Read-only A2: immutable Git blobs, local detectors, no session store or network.
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { outcome } from "./detector-support.mjs";
import * as consoleRule from "./detectors/hr-22-no-client-console.mjs";
import * as mutationRule from "./detectors/hr-6-safe-mutations.mjs";
import * as numberRule from "./detectors/hr-19-no-number-input.mjs";
import * as onlineRule from "./detectors/hr-7-no-navigator-online.mjs";
import * as migrationRule from "./detectors/hr-24-migration-pair.mjs";
import * as pmRule from "./detectors/hr-25-pm-trace.mjs";
import * as cronRule from "./detectors/hr-8-cron-guards.mjs";
import * as validationRule from "./detectors/hr-12-api-validation.mjs";

import * as r1 from "./detectors/hr-1-toast-undo.mjs";
import * as r3 from "./detectors/hr-3-row-red.mjs";
import * as r9 from "./detectors/hr-9-unique-conflict.mjs";
import * as r10 from "./detectors/hr-10-theme-background.mjs";
import * as r11 from "./detectors/hr-11-protected-ui.mjs";
import * as r13 from "./detectors/hr-13-household-contract.mjs";
import * as r14 from "./detectors/hr-14-person-color.mjs";
import * as r15 from "./detectors/hr-15-floating-panel.mjs";
import * as r17 from "./detectors/hr-17-cache-invalidation.mjs";
import * as r18 from "./detectors/hr-18-server-date.mjs";
import * as r20 from "./detectors/hr-20-child-policy.mjs";
import * as r23 from "./detectors/hr-23-atlas.mjs";
import * as r28 from "./detectors/hr-28-ui-copy.mjs";
/** @type {Array<[string, typeof consoleRule]>} */
export const DETECTORS = [
  ["hr-1-toast-undo", r1],
  ["hr-3-row-red", r3],
  ["hr-9-unique-conflict", r9],
  ["hr-10-theme-background", r10],
  ["hr-11-protected-ui", r11],
  ["hr-13-household-contract", r13],
  ["hr-14-person-color", r14],
  ["hr-15-floating-panel", r15],
  ["hr-17-cache-invalidation", r17],
  ["hr-18-server-date", r18],
  ["hr-20-child-policy", r20],
  ["hr-23-atlas", r23],
  ["hr-28-ui-copy", r28],
  ["hr-22-no-client-console", consoleRule],
  ["hr-6-safe-mutations", mutationRule],
  ["hr-19-no-number-input", numberRule],
  ["hr-7-no-navigator-online", onlineRule],
  ["hr-24-migration-pair", migrationRule],
  ["hr-25-pm-trace", pmRule],
  ["hr-8-cron-guards", cronRule],
  ["hr-12-api-validation", validationRule],
];
const here = dirname(fileURLToPath(import.meta.url));
export function loadDetectors(
  fixturesRoot = resolve(here, "../../tests/os/fixtures/detectors"),
) {
  return DETECTORS.map(([id, detector]) => {
    const { meta, detect } = detector;
    if (
      meta.version !== 1 ||
      meta.type !== "diff" ||
      !["checked", "advisory"].includes(meta.level)
    )
      throw new Error(`Unsupported detector contract: ${id}`);
    // Fixtures are a load gate, not a self-reported test stamp.
    const fixtures = JSON.parse(
      readFileSync(resolve(fixturesRoot, `${id}.json`), "utf8"),
    );
    for (const expected of ["fail", "pass", "n/a"]) {
      const fixture = fixtures.find((entry) => entry.expected === expected);
      if (!fixture || outcome(detect(fixture)) !== expected)
        throw new Error(`Detector ${id} has no passing ${expected} fixture`);
    }
    return { id, ...detector };
  });
}
function git(root, args, { input, encoding = "utf8" } = {}) {
  const result = spawnSync("git", ["--no-optional-locks", ...args], {
    cwd: root,
    encoding,
    input,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      result.error?.message ?? result.stderr.toString().trim() ?? "Git failed",
    );
  return result.stdout;
}
export function readRange(root, range) {
  if (
    typeof range !== "string" ||
    range.includes("...") ||
    range.split("..").length !== 2 ||
    range
      .split("..")
      .some((ref) => !ref || ref.startsWith("-") || /[\x00-\x20]/.test(ref))
  )
    throw new Error("Expected an explicit <base>..<head> commit range");
  const [base, head] = range
    .split("..")
    .map((ref) =>
      git(root, [
        "rev-parse",
        "--verify",
        "--end-of-options",
        `${ref}^{commit}`,
      ]).trim(),
    );
  return readDiff(root, base, head);
}

// Explicit local snapshot only. No index, object, checkout, or source writes.
// The committed-range reader above remains immutable and ignores dirty files.
export function readWorkingTree(root, base = "HEAD") {
  const head = git(root, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${base}^{commit}`,
  ]).trim();
  return readDiff(root, head, head, true);
}

function readDiff(root, base, head, workingTree = false) {
  const revisions = workingTree ? [base] : [base, head];
  const diffArgs = [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--no-color",
    "--no-relative",
    "--find-renames=50%",
  ];
  const raw = git(root, [
    ...diffArgs,
    "--raw",
    "-z",
    "--no-abbrev",
    ...revisions,
    "--",
  ]).split("\0");
  const changes = [];
  // Unrelated binary assets are metadata only; they cannot become source input.
  const sourceBlob = (mode, file) =>
    !/^100(?:644|755)$/.test(mode)
      ? null
      : /^(?:src\/.*\.(?:[cm]?[jt]sx?|css|scss)|migrations\/.*\.sql|ERA Notes\/10 - Project Management\/[^/]+\/(?:4 - Checklist|[^/]+ — Master Book)\.md)$/.test(
            file,
          )
        ? true
        : /^ERA Notes\/04 - UI & Design\/Page & Feature Atlas\/[^/]+\.md$/.test(
              file,
            )
          ? true
          : false;
  // Three range-wide diffs and one batch of immutable blobs replace the old
  // per-file subprocesses. A 467-file recorded range exceeded Stop's 20 s limit.
  const counts = new Map();
  const numstat = git(root, [
    ...diffArgs,
    "--numstat",
    "-z",
    ...revisions,
    "--",
  ]).split("\0");
  for (let i = 0; i < numstat.length && numstat[i]; ) {
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(numstat[i++]);
    if (!match) throw new Error("Unsupported Git numstat record");
    const [, added, removed, name] = match;
    const beforeFile = name || numstat[i++],
      file = name || numstat[i++];
    const key = `${beforeFile}\0${file}`,
      previous = counts.get(key);
    const next = {
      added: /^\d+$/.test(added) ? Number(added) : null,
      removed: /^\d+$/.test(removed) ? Number(removed) : null,
    };
    counts.set(
      key,
      previous
        ? {
            added:
              previous.added === null || next.added === null
                ? null
                : previous.added + next.added,
            removed:
              previous.removed === null || next.removed === null
                ? null
                : previous.removed + next.removed,
          }
        : next,
    );
  }
  const patches = git(root, [
    ...diffArgs,
    "--patch",
    "--unified=0",
    ...revisions,
    "--",
  ])
    .split(/(?=^diff --git )/m)
    .filter((part) => part.startsWith("diff --git "))
    .reduce((groups, part) => {
      // A regular-file/symlink type change has two adjacent patch sections for
      // the same path, but one raw/numstat change. Never read the link target.
      const header = part.slice(0, part.indexOf("\n") + 1);
      if (groups.at(-1)?.startsWith(header)) groups[groups.length - 1] += part;
      else groups.push(part);
      return groups;
    }, []);
  const blobs = new Map();
  const wanted = new Set();
  for (let i = 0; i < raw.length && raw[i]; ) {
    const match = raw[i++].match(
      /^:(\d+) (\d+) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/,
    );
    if (!match) throw new Error("Unsupported Git raw diff record");
    const [, oldMode, newMode, oldOid, newOid, status] = match;
    const beforeFile = raw[i++],
      file = /[RC]/.test(status) ? raw[i++] : beforeFile;
    const count = counts.get(`${beforeFile}\0${file}`);
    const patch = patches[changes.length];
    if (!count || patch === undefined)
      throw new Error("Git range metadata does not align");
    if (sourceBlob(oldMode, beforeFile)) wanted.add(oldOid);
    if (!workingTree && sourceBlob(newMode, file)) wanted.add(newOid);
    const hunks = [
      ...patch.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm),
    ].map((m) => ({
      oldStart: Number(m[1]),
      oldLines: m[2] === undefined ? 1 : Number(m[2]),
      newStart: Number(m[3]),
      newLines: m[4] === undefined ? 1 : Number(m[4]),
    }));
    changes.push({
      hunks,
      ...count,
      file,
      beforeFile,
      status,
      oldMode,
      newMode,
      oldOid,
      newOid,
    });
  }
  if (patches.length !== changes.length)
    throw new Error("Git range patch count does not align");
  if (wanted.size) {
    const data = git(root, ["cat-file", "--batch"], {
      input: [...wanted].join("\n") + "\n",
      encoding: null,
    });
    let cursor = 0;
    for (const oid of wanted) {
      const end = data.indexOf(10, cursor);
      const header = data.subarray(cursor, end).toString("utf8");
      const match = /^([0-9a-f]+) blob (\d+)$/.exec(header);
      if (end < 0 || !match || match[1] !== oid)
        throw new Error("Unsupported Git blob batch record");
      const size = Number(match[2]),
        start = end + 1;
      if (start + size >= data.length || data[start + size] !== 10)
        throw new Error("Truncated Git blob batch record");
      blobs.set(oid, data.subarray(start, start + size).toString("utf8"));
      cursor = start + size + 1;
    }
    if (cursor !== data.length)
      throw new Error("Unexpected Git blob batch data");
  }
  const blob = (mode, oid, file) => {
    const source = sourceBlob(mode, file);
    return source === null ? null : source ? blobs.get(oid) : "";
  };
  const localBlob = (mode, file) => {
    const source = sourceBlob(mode, file);
    if (source === null) return null;
    const target = resolve(root, file);
    // Never follow a tracked link or a junction in a parent directory.
    for (let part = target; part !== resolve(root); part = dirname(part)) {
      if (
        !part.startsWith(resolve(root) + "/") &&
        !part.startsWith(resolve(root) + "\\")
      )
        throw new Error("Working-tree path escaped repository");
      const info = lstatSync(part);
      if (info.isSymbolicLink()) return null;
      if (part === target && !info.isFile()) return null;
    }
    return source ? readFileSync(target, "utf8") : "";
  };
  const result = changes.map(
    ({ oldMode, newMode, oldOid, newOid, ...change }) => ({
      ...change,
      before: blob(oldMode, oldOid, change.beforeFile),
      after: workingTree
        ? localBlob(newMode, change.file)
        : blob(newMode, newOid, change.file),
    }),
  );
  if (workingTree) {
    for (const file of git(root, [
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
    ])
      .split("\0")
      .filter(Boolean)) {
      const after = localBlob("100644", file);
      const lines = !after
        ? 0
        : after.split("\n").length - (after.endsWith("\n") ? 1 : 0);
      result.push({
        file,
        beforeFile: file,
        status: "A",
        before: null,
        after,
        added: lines,
        removed: 0,
        hunks: lines
          ? [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: lines }]
          : [],
      });
    }
  }
  return {
    base,
    head,
    ...(workingTree ? { scope: "uncommitted" } : {}),
    changes: result,
  };
}
export function evaluate(context, detectors = loadDetectors()) {
  const rules = detectors.map(({ id, meta, detect }) => {
    const findings = detect(context),
      verdict = outcome(findings);
    const primary =
      findings.find((row) => row.verdict === verdict) ?? findings[0];
    return {
      schema: "os/verdict@1",
      level: meta.level,
      rule: meta.rule,
      detector: id,
      version: meta.version,
      verdict,
      file: primary.file,
      line: primary.line,
      excerpt: primary.excerpt,
      side: primary.side,
      added: findings.filter((row) => row.verdict === "fail").length,
      removed: findings.filter((row) => row.verdict === "improved").length,
      findings,
    };
  });
  return {
    schema: "os/evaluation@1",
    base: context.base ?? null,
    head: context.head ?? null,
    ...(context.scope ? { scope: context.scope } : {}),
    verdict: outcome(rules.filter((row) => row.level !== "advisory")),
    files: context.changes.length,
    rules,
  };
}
export function format(report) {
  const lines = [
    `os:eval ${report.base}..${report.head}${report.scope === "uncommitted" ? " (uncommitted working tree)" : ""}`,
    `Verdict: ${report.verdict} (${report.files} changed files)`,
  ];
  for (const rule of report.rules) {
    lines.push(
      `${rule.verdict.toUpperCase()} ${rule.rule} ${rule.detector}@${rule.version} (+${rule.added} -${rule.removed})${rule.level === "advisory" ? " ADVISORY" : ""}`,
    );
    for (const row of rule.findings)
      lines.push(
        `  ${row.verdict} | ${rule.rule} | ${JSON.stringify(row.file)}:${row.line ?? "-"} [${row.side ?? "-"}] | ${JSON.stringify(row.excerpt)} | ${row.message}`,
      );
  }
  return `${lines.join("\n")}\n`;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2),
      json = args.includes("--json"),
      ranges = args.filter((arg) => arg !== "--json");
    if (ranges.length !== 1)
      throw new Error("Usage: pnpm os:eval <base>..<head> [--json]");
    const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
    const report = evaluate(readRange(root, ranges[0]));
    process.stdout.write(
      json ? `${JSON.stringify(report, null, 2)}\n` : format(report),
    );
    process.exitCode = report.verdict === "fail" ? 1 : 0;
  } catch (error) {
    process.stderr.write(`os:eval: ${error.message}\n`);
    process.exitCode = 2;
  }
}
