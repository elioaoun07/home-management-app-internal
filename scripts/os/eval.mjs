// enforces: HR-22 HR-6 HR-19 HR-7 HR-24 HR-25 HR-8 HR-12
// Read-only A2: immutable Git blobs, local detectors, no session store or network.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
function git(root, args) {
  const result = spawnSync("git", ["--no-optional-locks", ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      result.error?.message ?? result.stderr.trim() ?? "Git failed",
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
  const raw = git(root, [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--raw",
    "-z",
    "--no-abbrev",
    "--find-renames=50%",
    base,
    head,
    "--",
  ]).split("\0");
  const changes = [];
  // Unrelated binary assets are metadata only; they cannot become source input.
  const blob = (mode, oid, file) =>
    !/^100(?:644|755)$/.test(mode)
      ? null
      : /^(?:src\/.*\.(?:[cm]?[jt]sx?|css|scss)|migrations\/.*\.sql|ERA Notes\/10 - Project Management\/[^/]+\/(?:4 - Checklist|[^/]+ — Master Book)\.md)$/.test(
            file,
          )
        ? git(root, ["cat-file", "blob", oid])
        : /^ERA Notes\/04 - UI & Design\/Page & Feature Atlas\/[^/]+\.md$/.test(
              file,
            )
          ? git(root, ["cat-file", "blob", oid])
          : "";
  for (let i = 0; i < raw.length && raw[i]; ) {
    const match = raw[i++].match(
      /^:(\d+) (\d+) ([0-9a-f]+) ([0-9a-f]+) ([A-Z])\d*$/,
    );
    if (!match) throw new Error("Unsupported Git raw diff record");
    const [, oldMode, newMode, oldOid, newOid, status] = match;
    const beforeFile = raw[i++],
      file = /[RC]/.test(status) ? raw[i++] : beforeFile;
    const counts = git(root, [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--numstat",
      "--find-renames=50%",
      base,
      head,
      "--",
      ...new Set([beforeFile, file]),
    ]).split("\t");
    const patch = git(root, [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--find-renames=50%",
      "--unified=0",
      base,
      head,
      "--",
      ...new Set([beforeFile, file]),
    ]);
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
      added: /^\d+$/.test(counts[0]) ? Number(counts[0]) : null,
      removed: /^\d+$/.test(counts[1]) ? Number(counts[1]) : null,
      file,
      beforeFile,
      status,
      before: blob(oldMode, oldOid, beforeFile),
      after: blob(newMode, newOid, file),
    });
  }
  return { base, head, changes };
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
    verdict: outcome(rules.filter((row) => row.level !== "advisory")),
    files: context.changes.length,
    rules,
  };
}
export function format(report) {
  const lines = [
    `os:eval ${report.base}..${report.head}`,
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
