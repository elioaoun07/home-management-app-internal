import type { Entity, Flight, Setup } from "./cockpitTypes";

/** These are the two actionable severities; informational notes are not conflicts. */
export const setupConflictCount = (conflicts: readonly { severity: string }[]) =>
  conflicts.filter(entry => ["error", "warning"].includes(entry.severity)).length;

export function cockpitCounts(board: { lanes: readonly { id: string; cards: readonly unknown[] }[] }, decisions: number) {
  const needs = board.lanes.find(lane => lane.id === "needs")?.cards.length ?? 0;
  const running = board.lanes.find(lane => lane.id === "running")?.cards.length ?? 0;
  return { needs, running, decisions, needsTotal: needs + decisions };
}

export const cockpitUnits = (counts: { sessions: number; requests: number; acceptance: number }) =>
  [counts.sessions && `${counts.sessions} session${counts.sessions === 1 ? "" : "s"}`,
    counts.requests && `${counts.requests} request${counts.requests === 1 ? "" : "s"}`,
    counts.acceptance && `${counts.acceptance} item${counts.acceptance === 1 ? "" : "s"}`]
    .filter(Boolean).join(" · ") || "0 sessions";

/** Missing observations explain unknown; this helper never upgrades a verdict. */
export function sessionEvidenceGaps(record: Flight): string[] {
  const s = record.session, score = s.scorecard, gaps: string[] = [];
  if (!score) gaps.push("No scorecard");
  if (!s.base) gaps.push("No base commit");
  if (!s.head) gaps.push("No head commit");
  if (!s.coverage) gaps.push("Transcript coverage unrecorded");
  else if (s.coverage !== "transcript") gaps.push("Transcript not ingested");
  if (s.changeFacts == null && score?.scope.files == null) gaps.push("Diff unrecorded");
  const supervised = score?.checks.facts.some(fact => fact.source === "supervisor" && fact.exitCode !== null) ||
    record.checks?.some(check => check.source === "supervisor" && check.exitCode != null);
  if (!supervised) gaps.push("No supervisor check results");
  else for (const fact of score?.checks.facts ?? []) {
    if (fact.verdict === "unknown") gaps.push(`${fact.name} verdict unknown`);
  }
  return gaps;
}

export const sessionHref = (id: string) =>
  `#/sessions/${encodeURIComponent(id)}`;
export function cockpitAlias(
  root: string,
  query: URLSearchParams,
  hasDetail = false,
) {
  const q = new URLSearchParams(query);
  let path: string;
  if (["", "home"].includes(root)) path = "/bridge";
  else if (root === "skill-tools" ||
    (root === "launch" && !hasDetail && !q.has("file") && !q.has("cb"))) {
    path = "/explore";
    if (!q.size) q.set("lane", "now");
  } else if (["analytics", "dashboard"].includes(root)) {
    path = "/score";
    q.set("view", "backlog");
  } else if (root === "delivery" && !hasDetail) {
    path = "/sessions";
    q.set("view", "delivery");
  } else return null;
  return path + (q.size ? `?${q}` : "");
}
export const hardRules = (setup: Setup) =>
  setup.entities.filter((e) => /^HR-\d+$/.test(e.id) && !e.retired);
export function ruleFact(record: Flight, rule: string) {
  return record.session.scorecard?.rules.facts.find((r) => r.rule === rule);
}
// An agent's membership is explicit. Traversing through another agent would
// incorrectly paint parity gaps as available; rule selection never traverses
// an agent's other members. Global checks follow A1's unscoped-guard semantics.
export function chain(setup: Setup, selected: string) {
  const found = new Set([selected]);
  const agent = setup.entities.find(
    (e) => e.id === selected && e.kind === "agent",
  );
  if (agent) {
    for (const e of setup.entities)
      if (
        agent.entities?.includes(e.id) ||
        (["check", "detector"].includes(e.kind) && !e.agent && !e.agents)
      )
        found.add(e.id);
    for (const r of setup.relations)
      if (r.type === "enforces" && found.has(r.from)) found.add(r.to);
    return found;
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of setup.relations.filter((r) => r.type !== "applies-to")) {
      if (found.has(r.from) || found.has(r.to)) {
        for (const id of [r.from, r.to])
          if (!found.has(id)) {
            found.add(id);
            changed = true;
          }
      }
    }
  }
  // Add the chain's agent endpoints without traversing their unrelated members.
  for (const r of setup.relations)
    if (r.type === "applies-to" && found.has(r.from)) found.add(r.to);
  return found;
}
export function column(e: Entity) {
  return e.kind === "agent"
    ? 0
    : e.kind === "instruction"
      ? 1
      : e.kind === "skill"
        ? 2
        : ["hook", "permission"].includes(e.kind)
          ? 3
          : ["check", "detector"].includes(e.kind)
            ? 4
            : e.kind === "rule"
              ? 5
              : -1;
}
export function setupDiff(a: Flight, b: Flight) {
  const left = a.session.setup,
    right = b.session.setup;
  if (!left?.fingerprint || !right?.fingerprint)
    return { state: "Unknown", files: [] as string[] };
  if (left.fingerprint === right.fingerprint)
    return { state: "Same setup", files: [] as string[] };
  if (!left.sources || !right.sources)
    return { state: "Changed · source diff unrecorded", files: [] as string[] };
  const hashes = new Map(left.sources.map((s) => [s.path, s.hash ?? s.sha256]));
  const other = new Map(right.sources.map((s) => [s.path, s.hash ?? s.sha256]));
  return {
    state: "Changed",
    files: [...new Set([...hashes.keys(), ...other.keys()])].filter(
      (p) => hashes.get(p) !== other.get(p),
    ),
  };
}
// Match A4 comparisons(): improved/n/a rules can be clean; unknown cannot.
export const clean = (r: {
  session: {
    scorecard?: { rules: { verdict: string }; checks: { verdict: string } };
  };
}) =>
  !!r.session.scorecard &&
  !["fail", "unknown"].includes(r.session.scorecard.rules.verdict) &&
  r.session.scorecard.checks.verdict === "pass";
export function evidenceFindings(record: Flight, rule: string) {
  const fact = ruleFact(record, rule);
  return (fact?.findings || []) as {
    file?: string;
    line?: number;
    excerpt?: string;
    message?: string;
    verdict?: string;
  }[];
}
