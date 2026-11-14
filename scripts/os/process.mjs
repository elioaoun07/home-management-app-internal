// enforces: HR-5 HR-26 HR-27 HR-29
import { classifyLocalDiff } from "../delivery-v2/local-guardrails.mjs";
import { outcome } from "./detector-support.mjs";
export const PROCESS_VERSION = 1;
export const REQUIRES = [
  [
    "money-rules",
    (c) =>
      classifyLocalDiff([
        { path: c.file, before: c.before || "", after: c.after || "" },
      ]).flagged.some((f) => f.domains.includes("money")) ||
      /^src\/app\/(?:expense|recurring)\//.test(c.file) ||
      /^src\/.*trips\/.*(?:budget|cost|expense)/i.test(c.file),
    "money path",
  ],
  [
    "recurrence-safety",
    (c) =>
      /recurr|schedule|occurrence|exceptions|\/(?:cron|skip|postpone|confirm)\//i.test(
        c.file,
      ) || /\brrule\b/.test((c.before || "") + (c.after || "")),
    "recurrence path/import",
  ],
  ["api-route", (c) => c.file.startsWith("src/app/api/"), "API path"],
  ["db-migration", (c) => c.file.startsWith("migrations/"), "migration path"],
  [
    "ui-guardrails",
    (c) =>
      /^src\/(?:components\/|.*\/(?:page|layout)\.)/.test(c.file) ||
      /\.(?:css|scss)$/.test(c.file) ||
      /<[A-Za-z]/.test(c.after || ""),
    "UI path/syntax",
  ],
  [
    "cache-invalidation",
    (c) =>
      /\b(?:useMutation|invalidateQueries)\b/.test(
        (c.before || "") + (c.after || ""),
      ),
    "mutation/cache syntax",
  ],
  [
    "timezone-handling",
    (c) =>
      /src\/lib\/utils\/date\.ts$/.test(c.file) ||
      /utils\/date|\b(?:RRule|DTSTART)\b|(?:useMutation|safeFetch)[\s\S]*(?:toISOString|\bDate\b|\d{4}-\d\d-\d\dT)/.test(
        (c.before || "") + (c.after || ""),
      ),
    "date mutation/import",
  ],
];
const fact = (name, verdict, evidence, file = null) => ({
  name,
  verdict,
  evidence,
  file,
});
export function processPanel(session, changes) {
  if (!changes)
    return {
      version: PROCESS_VERSION,
      verdict: "unknown",
      facts: [fact("paths", "unknown", "No immutable diff supplied")],
    };
  if (session.coverage !== "transcript")
    return {
      version: PROCESS_VERSION,
      verdict: "unknown",
      facts: [
        fact(
          "transcript",
          "unknown",
          "No complete transcript facts; absence is not failure",
        ),
      ],
    };
  const facts = [],
    relevant = changes.filter((c) => /^(?:src|migrations)\//.test(c.file)),
    skills = session.skills || [];
  const edits = (session.timeline || []).filter(
    (t) => t.edit && t.completed && !t.failed,
  );
  const first = edits[0]?.order,
    last = edits.at(-1)?.order;
  for (const [name, predicate, reason] of REQUIRES) {
    const paths = changes.filter(predicate);
    if (paths.length)
      facts.push(
        fact(
          name,
          skills.some((s) => s.name === name) ? "pass" : "fail",
          reason,
          paths.map((c) => c.file).join(", "),
        ),
      );
  }
  if (relevant.length) {
    facts.push(
      fact(
        "start-task",
        first == null
          ? "unknown"
          : skills.some((s) => s.name === "start-task" && s.order < first)
            ? "pass"
            : "fail",
        "Must load before first observed edit",
      ),
    );
    facts.push(
      fact(
        "finish-task",
        last == null
          ? "unknown"
          : skills.some((s) => s.name === "finish-task" && s.order > last)
            ? "pass"
            : "fail",
        "Must load after last observed edit",
      ),
    );
    const map = (session.reads || []).find(
      (r) =>
        r.path === "ERA Notes/01 - Architecture/Feature Map/_index.md" &&
        r.beforeFirstEdit,
    );
    const moduleMap = (session.reads || []).find(
      (r) =>
        /Feature Map\/(?:standalone|junction|cross-cutting)\/.*\.md$/.test(
          r.path,
        ) &&
        r.beforeFirstEdit &&
        (!map || r.order >= map.order),
    );
    facts.push(
      fact(
        "read-first",
        first == null
          ? "unknown"
          : map &&
              moduleMap &&
              session.reads.indexOf(map) < session.reads.indexOf(moduleMap) &&
              !session.reads.some(
                (r) => r.path.startsWith("src/") && r.order < moduleMap.order,
              )
            ? "pass"
            : "fail",
        "Feature Map index, then module map before edit",
      ),
    );
    const trace = changes.some(
      (c) =>
        /^ERA Notes\/10 - Project Management\/(?!_Archive)[^/]+\/(?:4 - Checklist|.* \u2014 Master Book)\.md$/.test(
          c.file,
        ) &&
        c.after !== null &&
        c.after !== c.before &&
        c.after
          .split("\n")
          .some(
            (line) =>
              /\b(?:R\d+|[A-Z]+-\d+)\b/.test(line) &&
              !(c.before || "").split("\n").includes(line),
          ),
    );
    facts.push(
      fact(
        "pm-trace",
        trace ? "pass" : "fail",
        "Changed active checklist/book line naming an item ID",
      ),
    );
  }
  return {
    version: PROCESS_VERSION,
    verdict: facts.some((f) => f.verdict === "fail")
      ? "fail"
      : facts.some((f) => f.verdict === "unknown")
        ? "unknown"
        : outcome(facts),
    facts,
  };
}
export function transcriptRules(session, changes = null) {
  if (session.agent === "manual")
    return ["HR-5", "HR-26", "HR-27", "HR-29"].map((rule) => ({
      schema: "os/verdict@1",
      rule,
      detector: "process-" + rule.toLowerCase(),
      version: 1,
      level: "checked",
      verdict: "n/a",
      added: 0,
      removed: 0,
      findings: [
        {
          verdict: "n/a",
          file: null,
          line: null,
          excerpt: "",
          message: "Manual commit: no agent process applies",
        },
      ],
    }));
  const available = session.coverage === "transcript",
    timeline = session.timeline || [];
  const row = (rule, verdict, message, tool = null) => ({
    schema: "os/verdict@1",
    rule,
    detector: "process-" + rule.toLowerCase(),
    version: 1,
    level: "checked",
    verdict,
    file: tool?.target || null,
    line: null,
    excerpt: "",
    added: verdict === "fail" ? 1 : 0,
    removed: 0,
    findings: [
      { verdict, file: tool?.target || null, line: null, excerpt: "", message },
    ],
  });
  const rows = [];
  for (const [rule, key] of [
    ["HR-26", "productionWrite"],
    ["HR-29", "paidApi"],
  ]) {
    const tool = timeline.find((t) => t.signals?.[key]);
    rows.push(
      row(
        rule,
        tool ? "fail" : available ? "pass" : "unknown",
        tool
          ? "Forbidden tool/command attempt observed (not proof of a completed write/call)"
          : available
            ? "No known forbidden tool/command observed"
            : "Transcript unavailable",
        tool,
      ),
    );
  }
  const ui = changes?.some((c) =>
    REQUIRES.find(([name]) => name === "ui-guardrails")[1](c),
  );
  rows.push(
    row(
      "HR-5",
      !changes
        ? "unknown"
        : !ui
          ? "n/a"
          : !available
            ? "unknown"
            : session.mobileEvidence?.width === 390
              ? "pass"
              : "fail",
      "390px viewport evidence required; absence is unverified, not proof no test happened",
    ),
  );
  const reads = session.reads || [],
    route = reads.find((r) => r.path.startsWith("src/app/api/")),
    rls = reads.find((r) => r.path === "migrations/db-state.json");
  rows.push(
    row(
      "HR-27",
      !available
        ? "unknown"
        : !session.visibilityBug
          ? "n/a"
          : !route
            ? "n/a"
            : rls && rls.order < route.order
              ? "pass"
              : "fail",
      "Visibility prompt: db-state must be read before API source",
    ),
  );
  return rows;
}
