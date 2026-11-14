import type { Entity, Flight, Setup } from "./cockpitTypes";

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
  else if (["analytics", "dashboard"].includes(root)) {
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
