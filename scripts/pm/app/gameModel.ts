import type { Cockpit, Flight } from "./cockpitTypes";
import { chain, hardRules } from "./cockpitModel";

// Unknown checks, incomplete rule coverage and unordered sessions never earn a streak.
export function cleanEvidence(record: Flight): "clean" | "failed" | "unknown" {
  const card = record.session.scorecard;
  if (!card) return "unknown";
  if (card.rules.verdict === "fail" || card.checks.verdict === "fail")
    return "failed";
  if (
    card.checks.verdict !== "pass" ||
    !["pass", "improved"].includes(card.rules.verdict)
  )
    return "unknown";
  const rules = new Set(card.rules.facts.map((r) => r.rule));
  return Array.from({ length: 29 }, (_, i) => `HR-${i + 1}`).every((r) =>
    rules.has(r),
  ) && card.rules.newViolations === 0
    ? "clean"
    : "unknown";
}

export function gameFacts(data: Cockpit) {
  const ordered = data.records
    .filter((r) => !r.session.arena)
    .slice()
    .sort(
      (a, b) =>
        (b.session.endedAt || "").localeCompare(a.session.endedAt || "") ||
        a.session.id.localeCompare(b.session.id),
    );
  const streak: Flight[] = [];
  let boundary: Flight | null = null;
  // An undated record could be anywhere in the sequence. Do not guess its position.
  const timestamps = ordered.map((r) => r.session.endedAt);
  const unordered =
    timestamps.some((t) => !t || !Number.isFinite(Date.parse(t))) ||
    new Set(timestamps).size !== timestamps.length;
  if (!unordered)
    for (const record of ordered) {
      if (cleanEvidence(record) !== "clean") {
        boundary = record;
        break;
      }
      streak.push(record);
    }
  const rules = data.setup ? hardRules(data.setup) : [];
  const guarded = rules.filter((r) =>
    ["checked", "blocked"].includes(r.level || ""),
  );
  const setup = data.setup;
  const parity = setup
    ? ["claude", "codex", "copilot"].map((agent) => {
        const node = setup.entities.find((e) => e.id === `agent:${agent}`);
        const connected = node ? chain(setup, node.id) : new Set<string>();
        const covered = rules.filter((r) => connected.has(r.id));
        return { agent, recorded: !!node, covered, total: rules.length };
      })
    : [];
  const debt =
    data.setup?.entities.filter(
      (e) => e.kind === "detector" && Number.isFinite(e.baseline),
    ) || [];
  return { streak, boundary, unordered, rules, guarded, parity, debt };
}
