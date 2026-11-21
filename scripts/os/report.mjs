import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { openStore } from "./store.mjs";
import { gitFact } from "./runtime.mjs";
import { sessionScorecard } from "./scorecard.mjs";
import { redact } from "./privacy.mjs";

const cell = (value) =>
  redact(value ?? "unknown")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]/g, " ")
    .replaceAll("`", "'")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const duration = (value) => (value == null ? "unknown" : `${value} ms`);
export function markdown(record) {
  const { session: s, events, verdicts, checks } = record;
  const lines = [
    `# Flight report: ${cell(s.id)}`,
    "",
    `${cell(s.agent)} · ${cell(s.model)} · effort ${cell(s.effort)}`,
    "",
    `Started: ${cell(s.startedAt)} · ended: ${cell(s.endedAt)} · last observed: ${cell(s.lastObservedAt)}`,
    `Branch: ${cell(s.branch)} · worktree: ${cell(s.worktree)}`,
    `Outcome: ${cell(s.outcome)}`,
    "",
    `Setup: ${cell(s.setup?.fingerprint)}${
      s.setup
        ? ` · ${Object.entries(s.setup.counts ?? {})
            .map(([key, count]) => `${count} ${key}`)
            .join(" · ")}`
        : " (no historical snapshot)"
    }`,
    "",
    "## Skills",
    "",
    ...s.skills.map(
      (row) => `- ${cell(row.name)} (${cell(row.via)}, ${cell(row.at)})`,
    ),
    ...(!s.skills.length ? ["No successful skill loads observed."] : []),
    "",
    "## Hooks",
    "",
    `${events.filter((row) => row.source === "runner").length} runner firings · ${events.filter((row) => row.blocked).length} blocks`,
    "",
    "| Source | Event / hook | Exit | Duration | Message |",
    "| --- | --- | --- | --- | --- |",
    ...events.map(
      (row) =>
        `| ${cell(row.source)} | ${cell(row.event)} / ${cell(row.hook)} | ${cell(row.exitCode)} | ${duration(row.durationMs)} | ${cell(row.message)} |`,
    ),
    "",
    "## Rule verdicts",
    "",
    `Range: ${cell(s.base)}..${cell(s.head)} (${cell(s.rangeSource)}); ${verdicts.length} versioned diff detectors, ${s.rangeSource === "runner lifecycle: uncommitted working tree" ? "uncommitted working-tree snapshot" : "committed files only"}.`,
    "",
    ...(!verdicts.length
      ? ["Not evaluated."]
      : [
          "| Rule | Verdict | Evidence |",
          "| --- | --- | --- |",
          ...verdicts.map(
            (row) =>
              `| ${cell(row.rule)} | ${cell(row.verdict)} | ${cell(row.file)}:${cell(row.line)} ${cell(row.excerpt)} |`,
          ),
        ]),
    "",
    "## Checks",
    "",
    "Checks retain their source. Transcript observations cannot satisfy supervisor verification.",
    "",
    ...checks.map(
      (row) =>
        `- ${cell(row.name)}: exit ${cell(row.exitCode)}, ${duration(row.durationMs)}${row.toolError ? ", tool error" : ""}`,
    ),
    ...(!checks.length ? ["No recognized check commands observed."] : []),
    "",
    "## Usage",
    "",
    ...Object.entries(s.usage).map(
      ([key, value]) => `- ${key}: ${cell(value)}`,
    ),
    `- assistant turns: ${cell(s.turns)}`,
    "",
    "## Reads",
    "",
    ...s.reads.map(
      (row) =>
        `- ${cell(row.path)}${row.beforeFirstEdit ? " (before first edit)" : ""}`,
    ),
    "",
    "## Tool timeline",
    "",
    "| Tool | Target | Duration | Result |",
    "| --- | --- | --- | --- |",
    ...s.timeline.map(
      (row) =>
        `| ${cell(row.tool)} | ${cell(row.target)} | ${duration(row.durationMs)} | ${row.completed ? (row.failed ? "error" : "completed") : "unobserved"} |`,
    ),
    "",
    "## Evidence limits",
    "",
    ...s.warnings.map((warning) => `- ${cell(warning)}`),
    "- Prompts, tool output, environment values and transcript bodies are not copied. Unknown fields remain unknown.",
    "",
  ];
  const card = s.scorecard ?? sessionScorecard(record);
  lines.splice(
    lines.indexOf("## Evidence limits"),
    0,
    ...scorecardMarkdown(card),
  );
  return lines.join("\n");
}

export function scorecardMarkdown(card) {
  const lines = [
    "## Scorecard",
    "",
    "Schema: " + cell(card.schema) + " | version " + cell(card.version),
    "",
  ];
  for (const name of [
    "rules",
    "checks",
    "process",
    "scope",
    "autonomy",
    "cost",
  ]) {
    const panel = card[name];
    lines.push("### " + name[0].toUpperCase() + name.slice(1), "");
    if (panel.verdict) lines.push("Verdict: " + cell(panel.verdict), "");
    if (panel.facts)
      for (const fact of panel.facts)
        lines.push(
          "- " +
            cell(fact.rule || fact.name) +
            ": " +
            cell(fact.verdict) +
            (fact.level === "advisory" ? " (advisory)" : "") +
            " | " +
            cell(
              fact.evidence ||
                fact.findings?.[0]?.message ||
                (fact.source
                  ? "source: " + fact.source
                  : "No supervisor evidence"),
            ) +
            (fact.file ? " | " + cell(fact.file) : ""),
        );
    for (const [key, value] of Object.entries(panel).filter(
      ([k]) => !["facts", "verdict"].includes(k),
    ))
      lines.push(
        "- " +
          cell(key) +
          ": " +
          cell(
            typeof value === "object" && value !== null
              ? JSON.stringify(value)
              : value,
          ),
      );
    lines.push("");
  }
  return lines;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let store;
  try {
    const [id, ...extra] = process.argv.slice(2);
    if (!id || extra.length) throw new Error("Usage: pnpm os:report <session>");
    const root = gitFact(process.cwd(), "rev-parse", "--show-toplevel");
    if (!root) throw new Error("Run from a Git worktree");
    store = openStore(root, { readOnly: true });
    const record = store.get(id);
    if (existsSync(resolve(root, ".os/recorder-unavailable")))
      record.session.warnings.push(
        "Recorder unavailable marker present now; coverage may be incomplete",
      );
    process.stdout.write(markdown(record));
  } catch (error) {
    process.stderr.write(`os:report: ${error.message}\n`);
    process.exitCode = 2;
  } finally {
    store?.close();
  }
}
