// scripts/delivery-v2/uat-cli.mjs
// `pnpm pm:uat` — read and seed the UAT store without the browser.
//
//   pnpm pm:uat list                         every handover with its acceptance state
//   pnpm pm:uat import-docs [--apply] [file] draft handovers from docs/Delivery-UAT-*-2026-10-25.md
//   pnpm pm:uat ready <id> --source <rev>    freeze a direct delivery as ready for testing
//
// Previews by default. Writes only `.delivery/v2/uat/` (local runtime state): no
// provider, Apply, Git write, database or application data.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bindDirect, freezeHandover, listUat, readImportStatus, readUat, validateContent } from "./uat.mjs";
import { handoversFromDoc } from "./uat-docs.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOC = /^Delivery-UAT-(?!Scenarios)[A-Za-z-]+-\d{4}-\d{2}-\d{2}\.md$/u;

function flag(argv, name) {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : null;
}

/** Plan an import of every drafted wizard (or the named ones). Pure over the files read. */
export function planDocImport({ root = ROOT, files = null } = {}) {
  const docs = join(root, "docs");
  const names = files?.length ? files.map((file) => resolve(root, file)) : readdirSync(docs).filter((name) => DOC.test(name)).sort().map((name) => join(docs, name));
  const planned = [];
  const skipped = [];
  for (const abs of names) {
    if (!existsSync(abs)) {
      skipped.push({ file: relative(root, abs), title: "", reason: "file not found" });
      continue;
    }
    const parsed = handoversFromDoc(readFileSync(abs, "utf8"), { file: relative(root, abs).replace(/\\/gu, "/") });
    for (const handover of parsed.handovers) {
      const check = validateContent(handover.content);
      planned.push({ file: relative(root, abs).replace(/\\/gu, "/"), handover, problems: check.problems, scenarios: check.content?.scenarios.length ?? 0 });
    }
    for (const entry of parsed.skipped) skipped.push({ file: relative(root, abs).replace(/\\/gu, "/"), ...entry });
  }
  return { planned, skipped };
}

export function applyDocImport({ root = ROOT, plan, now = new Date().toISOString() }) {
  const results = [];
  for (const entry of plan.planned) {
    const outcome = freezeHandover({ root, subject: entry.handover.subject, environment: entry.handover.environment, content: entry.handover.content, source: entry.handover.source, ready: false, now });
    results.push({ ref: entry.handover.source.ref, ok: outcome.ok, repeated: outcome.repeated === true, status: outcome.handover?.status, handover_id: outcome.handover?.handover_id });
  }
  return results;
}

function main(argv) {
  const [command = "list"] = argv;
  if (command === "list") {
    const { handovers, corrupt } = listUat({ root: ROOT, importStatus: readImportStatus({ root: ROOT }) });
    for (const view of handovers) {
      console.log(`${view.handover_id}  r${view.revision}  ${view.status.padEnd(10)} ${view.acceptance.state.padEnd(13)} ${(view.subject.work_id || "-").padEnd(10)} ${view.subject.title || view.subject.delivery_ref}`);
    }
    console.log(`${handovers.length} handover(s)${corrupt ? `, ${corrupt} unreadable line(s) skipped` : ""}.`);
    return;
  }
  if (command === "import-docs") {
    const apply = argv.includes("--apply");
    const files = argv.slice(1).filter((arg) => !arg.startsWith("--"));
    const plan = planDocImport({ files });
    const incomplete = plan.planned.filter((entry) => entry.problems.length);
    for (const entry of plan.planned) {
      console.log(`${entry.problems.length ? "incomplete" : "draft     "}  ${String(entry.scenarios).padStart(2)} scenario(s)  ${entry.handover.subject.work_id || "-"}  ${entry.handover.source.ref}`);
      for (const problem of entry.problems.slice(0, 3)) console.log(`    ${problem.code}${problem.scenario ? ` ${problem.scenario}` : ""}${problem.step ? ` step ${problem.step}` : ""}`);
    }
    for (const entry of plan.skipped) console.log(`skipped     ${entry.file} — ${entry.title} (${entry.reason})`);
    console.log(`${plan.planned.length} handover(s) from ${plan.planned.reduce((n, entry) => n + entry.scenarios, 0)} scenario(s); ${incomplete.length} incomplete; ${plan.skipped.length} section(s) skipped.`);
    if (!apply) {
      console.log("Preview only. Re-run with --apply to write .delivery/v2/uat/.");
      return;
    }
    const results = applyDocImport({ plan });
    console.log(`wrote ${results.filter((result) => result.ok && !result.repeated).length}, unchanged ${results.filter((result) => result.repeated).length}.`);
    return;
  }
  if (command === "ready") {
    const id = argv[1];
    const source = flag(argv, "--source");
    const store = readUat({ root: ROOT });
    const latest = [...store.handovers].reverse().find((row) => row.handover_id === id);
    if (!latest) {
      console.error(`unknown handover ${id}`);
      process.exit(1);
    }
    if (latest.subject.type !== "direct") {
      console.error("a run's handover is frozen from the Command Center, where the supervisor holds its candidate");
      process.exit(1);
    }
    const binding = bindDirect({ delivery_ref: latest.subject.delivery_ref, source_revision: source });
    if (!binding) {
      console.error("--source <git revision> is required (7-64 hex characters)");
      process.exit(1);
    }
    const environment = { ...latest.environment, target: flag(argv, "--target") || latest.environment.target, build: flag(argv, "--build") || latest.environment.build, url: flag(argv, "--url") || latest.environment.url };
    const outcome = freezeHandover({ root: ROOT, subject: latest.subject, binding, environment, content: latest.content, source: latest.source, ready: true, now: new Date().toISOString() });
    if (!outcome.ok) {
      console.error(outcome.refusals.map((refusal) => refusal.code).join(", "));
      process.exit(1);
    }
    console.log(`${outcome.handover.handover_id} r${outcome.handover.revision} ${outcome.handover.status}${outcome.repeated ? " (unchanged)" : ""}`);
    return;
  }
  console.error("usage: pm:uat list | import-docs [--apply] [file...] | ready <id> --source <rev> [--target t] [--build b] [--url u]");
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
