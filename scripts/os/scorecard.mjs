import { reworkLines } from "./rework.mjs";
import { processPanel } from "./process.mjs";
import { evaluateTranscript } from "./transcript-eval.mjs";
import { outcome } from "./detector-support.mjs";
const sumKnown = (values) =>
  values.length && values.every((v) => Number.isFinite(v))
    ? values.reduce((a, b) => a + b, 0)
    : null;
/** @param {import("./types").Record} record @param {import("./types").Change[]|null} changes @param {import("./types").Item} item */
export function sessionScorecard(record, changes = null, item = {}) {
  const { session: s, events = [], checks = [], verdicts = [] } = record;
  const rules = [...verdicts, ...evaluateTranscript(s, changes)];
  for (const rule of ["HR-2", "HR-4", "HR-16", "HR-21"])
    rules.push({
      rule,
      version: 1,
      level: "judgment",
      verdict: "n/a",
      findings: [{ message: "UAT judgment; no deterministic detector" }],
    });
  const required = [
    "typecheck",
    "lint",
    "test",
    "pm:lint",
    "docs:check",
    "os:check",
  ];
  const checkFacts = required.map((name) => {
    const observations = checks.filter((c) => c.name === name),
      supervised = observations.filter((c) => c.source === "supervisor");
    const latest = supervised.at(-1);
    return {
      name,
      verdict:
        !latest || latest.exitCode == null
          ? "unknown"
          : latest.exitCode === 0
            ? "pass"
            : "fail",
      source: latest?.source || null,
      exitCode: latest?.exitCode ?? null,
      durationMs: latest?.durationMs ?? null,
      metrics: latest?.metrics ?? null,
      lintWarningsAdded: latest?.metrics?.lintWarningsAdded ?? null,
      lintWarningsRemoved: latest?.metrics?.lintWarningsRemoved ?? null,
      testsPassed: latest?.metrics?.testsPassed ?? null,
      testsFailed: latest?.metrics?.testsFailed ?? null,
      testsAdded: latest?.metrics?.testsAdded ?? null,
      observations,
    };
  });
  const paths = changes?.map((c) => c.file) ?? null,
    touches = item.touches ?? s.item?.touches ?? null;
  const within = (p, scope) =>
    scope === "none"
      ? false
      : scope.endsWith("/**")
        ? p.startsWith(scope.slice(0, -2))
        : p === scope || p.startsWith(scope.replace(/\/$/, "") + "/");
  const modules = paths
    ? [
        ...new Set(
          paths
            .map((p) => /^src\/features\/([^/]+)/.exec(p)?.[1])
            .filter(Boolean),
        ),
      ]
    : null;
  const panel = processPanel(s, changes);
  const wall =
    s.startedAt && s.endedAt
      ? Math.max(0, Date.parse(s.endedAt) - Date.parse(s.startedAt))
      : null;
  const checked = rules.filter(
    (r) => !["advisory", "judgment"].includes(r.level),
  );
  return {
    schema: "os/scorecard@1",
    version: 1,
    sessionId: s.id,
    itemId: s.itemId ?? null,
    tier: s.tier ?? null,
    effort: s.effort,
    setup: s.setup?.fingerprint ?? null,
    rules: {
      verdict: checked.some((r) => r.verdict === "fail")
        ? "fail"
        : checked.some((r) => r.verdict === "unknown")
          ? "unknown"
          : outcome(checked),
      facts: rules,
      newViolations: sumKnown(checked.map((r) => r.added ?? 0)),
      removed: sumKnown(checked.map((r) => r.removed ?? 0)),
      advisories: rules
        .filter((r) => r.level === "advisory")
        .reduce((n, r) => n + (r.added || 0), 0),
    },
    checks: {
      verdict: checkFacts.some((c) => c.verdict === "fail")
        ? "fail"
        : checkFacts.some((c) => c.verdict === "unknown")
          ? "unknown"
          : "pass",
      facts: checkFacts,
    },
    process: panel,
    scope: {
      declared: touches,
      files: paths,
      outsideTouches:
        paths && touches
          ? paths.filter((p) => !touches.some((t) => within(p, t)))
          : null,
      modules,
      outsideModule:
        paths && item.module
          ? paths.filter(
              (p) =>
                /^src\/features\//.test(p) &&
                !p.startsWith("src/features/" + item.module + "/"),
            )
          : null,
      added: changes ? sumKnown(changes.map((c) => c.added)) : null,
      removed: changes ? sumKnown(changes.map((c) => c.removed)) : null,
      largestFile:
        changes
          ?.slice()
          .sort(
            (a, b) =>
              (b.added || 0) +
              (b.removed || 0) -
              (a.added || 0) -
              (a.removed || 0),
          )[0]?.file ?? null,
    },
    autonomy: {
      questions:
        s.coverage === "transcript"
          ? (s.timeline || []).filter((t) => t.signals?.question).length
          : null,
      approvals:
        s.coverage === "transcript"
          ? (s.timeline || []).filter((t) => t.signals?.approval).length
          : null,
      hookBlocks: events.filter((e) => e.blocked).length,
      hookCoverage: events.some((e) => e.source === "runner")
        ? "runner"
        : "partial",
      checkRetries: checks.filter((c, i) =>
        checks
          .slice(0, i)
          .some(
            (p) => p.name === c.name && p.exitCode != null && p.exitCode !== 0,
          ),
      ).length,
    },
    cost: {
      usage: s.usage,
      totalTokens: sumKnown(
        s.agent === "claude"
          ? [
              s.usage?.input_tokens,
              s.usage?.cache_read_input_tokens,
              s.usage?.cache_creation_input_tokens,
              s.usage?.output_tokens,
            ]
          : [s.usage?.input_tokens, s.usage?.output_tokens],
      ),
      wallMs: wall,
      turns: s.turns,
      tokenConvention:
        s.agent === "claude"
          ? "input excludes cached classes"
          : "input includes cached; output includes reasoning",
    },
  };
}
/** @param {{itemId:string,sessions?:import("./types").Session[],uat?:import("./types").Uat[],followups?:import("./types").Item[]|null,reverts?:import("./types").Revert[]|null,shippedAt?:string|null,ownerActions?:{at:string}[]|null,now?:string}} input */
export function deliveryScorecard({
  itemId,
  sessions = [],
  uat = [],
  followups = null,
  reverts = null,
  shippedAt = null,
  ownerActions = null,
  now,
}) {
  const unique = [...new Map(sessions.map((s) => [s.id, s])).values()].sort(
    (a, b) => (a.startedAt || "").localeCompare(b.startedAt || ""),
  );
  const firstDone = unique.find((s) => s.doneAt)?.doneAt;
  const afterDone = firstDone
    ? unique.filter((s) => s.startedAt > firstDone)
    : [];
  const changedBefore = new Set(
    unique
      .filter((s) => firstDone && s.startedAt <= firstDone)
      .flatMap((s) => s.changeFacts || [])
      .map((c) => c.file),
  );
  const rework = firstDone
    ? sumKnown(
        afterDone.flatMap((s) =>
          (s.changeFacts || [])
            .filter((c) => changedBefore.has(c.file))
            .map((c) =>
              c.added == null || c.removed == null ? null : c.added + c.removed,
            ),
        ),
      )
    : null;
  const end = shippedAt ? Date.parse(shippedAt) + 30 * 86400000 : null;
  const escapes =
    followups && end
      ? followups.filter(
          (f) =>
            f.kind === "bug" &&
            f.references?.includes(itemId) &&
            Date.parse(f.filedAt) >= Date.parse(shippedAt) &&
            Date.parse(f.filedAt) <= end,
        )
      : null;
  /** @type {Record<string,number|null>} */
  const total = {};
  for (const key of [
    ...new Set(unique.flatMap((s) => Object.keys(s.usage || {}))),
  ])
    total[key] = sumKnown(unique.map((s) => s.usage?.[key]));
  let ownerMinutes = null;
  if (ownerActions) {
    const waits = unique
      .filter((s) => s.endedAt)
      .map((s) => {
        const next = ownerActions
          .filter((a) => a.at >= s.endedAt)
          .sort((a, b) => a.at.localeCompare(b.at))[0];
        return next
          ? (Date.parse(next.at) - Date.parse(s.endedAt)) / 60000
          : null;
      });
    ownerMinutes = sumKnown(waits);
  }
  return {
    schema: "os/delivery-scorecard@1",
    itemId,
    n: unique.length,
    sessionsToShip: shippedAt
      ? unique.filter((s) => !s.startedAt || s.startedAt <= shippedAt).length
      : null,
    firstDone: firstDone || null,
    reworkLines: reworkLines(unique, firstDone),
    reworkLinesApprox: rework ?? (firstDone && !afterDone.length ? 0 : null),
    reworkDefinition:
      "Added + removed lines on previously touched files after first recorded done; approximate (line identities may move)",
    ownerMinutesApprox: ownerMinutes,
    uat: uat.map((u) => ({
      handoverId: u.handover_id,
      revision: u.revision,
      state: u.acceptance?.state,
      stale: u.stale,
      scenarios: u.scenarios?.map((s) => ({
        id: s.id,
        result: s.result || null,
      })),
    })),
    escapes: escapes?.map((f) => ({ id: f.id, filedAt: f.filedAt })) ?? null,
    escapeWindowComplete: end && now ? Date.parse(now) >= end : false,
    reverted:
      reverts === null ? null : reverts.some((r) => r.itemId === itemId),
    reverts:
      reverts === null
        ? null
        : reverts
            .filter((r) => r.itemId === itemId)
            .map((r) => ({ commit: r.commit, at: r.at })),
    cost: {
      usage: total,
      totalTokens: sumKnown(unique.map((s) => s.scorecard?.cost?.totalTokens)),
      wallMs: sumKnown(
        unique.map((s) =>
          s.startedAt && s.endedAt
            ? Date.parse(s.endedAt) - Date.parse(s.startedAt)
            : null,
        ),
      ),
    },
  };
}
const median = (values) => {
  const sorted = values.slice().sort((a, b) => a - b),
    i = Math.floor(sorted.length / 2);
  return sorted.length
    ? sorted.length % 2
      ? sorted[i]
      : (sorted[i - 1] + sorted[i]) / 2
    : null;
};
/** @param {Array<{id:string,itemId?:string|null,itemClass?:import("./types").Item,scorecard?:ReturnType<typeof sessionScorecard>}>} rows @param {ReturnType<typeof deliveryScorecard>[]} deliveries */
export function comparisons(rows, deliveries = []) {
  const groups = new Map();
  for (const row of rows) {
    const c = row.scorecard;
    if (!c) continue;
    const cls = row.itemClass || {};
    const key = JSON.stringify([
      c.tier,
      c.effort,
      cls.kind ?? null,
      cls.risk ?? null,
      cls.effort ?? null,
      c.scope.largestFile,
    ]);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups].map(([key, list]) => {
    const n = list.length,
      raw = list.map((s) => ({
        id: s.id,
        itemId: s.itemId || null,
        rules: s.scorecard.rules.verdict,
        checks: s.scorecard.checks.verdict,
        process: s.scorecard.process.verdict,
        setup: s.scorecard.setup,
      }));
    const bound = deliveries.filter((d) =>
      list.some((s) => s.itemId === d.itemId),
    );
    const tokenTotals = bound
      .filter((d) => d.sessionsToShip !== null)
      .map((d) => {
        return d.cost.totalTokens;
      });
    const cleanKnown = list.filter(
      (s) =>
        s.scorecard.rules.verdict !== "unknown" &&
        s.scorecard.checks.verdict !== "unknown",
    );
    const processKnown = list.filter(
      (s) => s.scorecard.process.verdict !== "unknown",
    );
    const eligible = n >= 10 && JSON.parse(key).every((v) => v !== null);
    return {
      group: JSON.parse(key),
      n,
      ranking: null,
      statisticsEligible: eligible,
      raw,
      setupFingerprints: [...new Set(raw.map((r) => r.setup))],
      setupChanged: new Set(raw.map((r) => r.setup)).size > 1,
      coverage: { clean: cleanKnown.length, process: processKnown.length },
      rates: eligible
        ? {
            clean: cleanKnown.length
              ? cleanKnown.filter(
                  (s) =>
                    s.scorecard.rules.verdict !== "fail" &&
                    s.scorecard.checks.verdict === "pass",
                ).length / cleanKnown.length
              : null,
            processComplete: processKnown.length
              ? processKnown.filter(
                  (s) => s.scorecard.process.verdict === "pass",
                ).length / processKnown.length
              : null,
          }
        : null,
      medianTokensPerShippedItem: tokenTotals.every((v) => v !== null)
        ? median(tokenTotals)
        : null,
      escapes: bound.every((d) => d.escapes !== null)
        ? bound.reduce((n, d) => n + d.escapes.length, 0)
        : null,
    };
  });
}
