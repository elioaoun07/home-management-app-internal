// Read-only projection of the existing supervisor store. Never opens it writable.
import { openStore } from "../../delivery-v2/store.mjs";
import { parseTestCounts } from "../../delivery-v2/checks.mjs";
import { listUat } from "../../delivery-v2/uat.mjs";
import { evaluate, readRange } from "../eval.mjs";
import { sessionScorecard, deliveryScorecard } from "../scorecard.mjs";
import { revertHistory, candidateReverts } from "../history.mjs";
import { tierAlias, pmFacts } from "../item.mjs";
const parse = (value) => {
  if (value == null) return null;
  if (typeof value === "object") return value;
  return JSON.parse(value);
};
const ms = (start, end) =>
  start && end ? Math.max(0, Date.parse(end) - Date.parse(start)) : null;
function metricOutput(stdout = "") {
  const counts = parseTestCounts(stdout);
  return counts
    ? {
        testsPassed:
          counts.executed == null || counts.failed == null
            ? null
            : counts.executed - counts.failed,
        testsFailed: counts.failed ?? null,
        selected: counts.selected ?? null,
        executed: counts.executed ?? null,
      }
    : null;
}
export function projectDelivery(
  store,
  { root, now, items = pmFacts(root), uat = null } = {},
) {
  const history = revertHistory(root);
  const runs = store.listRuns(),
    records = [],
    runFacts = [];
  const contextFor = (h) => {
    const run = runs.find((r) => r.run_id === h.subject?.run_id);
    if (!run) return null;
    const candidate = store.listCandidates(run.run_id).at(-1),
      result = store.latestResult(run.run_id);
    return {
      run: {
        candidate_id: candidate?.candidate_id ?? null,
        result_version: result?.result_version ?? null,
        applied: store
          .listApplications(run.run_id)
          .some((a) => a.state === "applied"),
      },
    };
  };
  const uatRead = uat
    ? { handovers: uat, corrupt: {} }
    : listUat({ root, now, contextFor });
  for (const run of runs) {
    const local = parse(run.base_manifest_json),
      d = local?.lane === "local" ? local : null,
      jobs = store.listJobs(run.run_id).filter((j) => j.dispatch_started_at);
    const itemId =
        d?.work?.id || store.getWorkRef(run.work_id)?.alias || run.work_id,
      item = items.find((i) => i.id === itemId) || {};
    const allActivity = store.listActivity?.(run.run_id, -1) || [];
    const doneAt =
      store.listResults(run.run_id).find((r) => {
        const result = parse(r.record_json);
        return (
          result?.candidateVerified === true || result?.workComplete === true
        );
      })?.created_at ||
      allActivity.find((a) => a.summary === "Ready for owner UAT")?.at ||
      null;
    const gitReverts = d ? candidateReverts(root, history, d) : null;
    const reverted = d?.revert
      ? { itemId, commit: d.revert, at: run.updated_at }
      : gitReverts?.[0]
        ? { itemId, commit: gitReverts[0].commit, at: gitReverts[0].at }
        : null;
    for (const job of jobs) {
      const request = parse(job.request_json) || {},
        settings =
          d?.settings || parse(job.settings_json) || request.settings || {},
        usage = store
          .listUsageReadings(job.job_id)
          .filter((u) => ["tokens", "usd"].includes(u.unit));
      const observations = parse(job.observations_json),
        fallback = observations?.usage;
      const counters = {
        input_tokens: "input",
        cache_read_input_tokens: "cached_input",
        cache_creation_input_tokens: "cache_creation",
        output_tokens: "output",
        reasoning_output_tokens: "reasoning_output",
      };
      const counts = Object.fromEntries(
        Object.entries(counters).map(([key, col]) => [
          key,
          usage.length
            ? usage.reduce((n, u) => n + u[col], 0)
            : Number.isFinite(fallback?.[col])
              ? fallback[col]
              : null,
        ]),
      );
      const isLast = job.job_id === jobs.at(-1)?.job_id,
        checks = [];
      // Local host checks are supervisor-owned, bound to d.head in local-lane.
      if (d?.head && isLast)
        for (const [i, c] of (d.checks || []).entries())
          checks.push({
            schema: "os/check@1",
            id: job.job_id + ":host:" + i,
            name: c.name,
            source: "supervisor",
            head: d.head,
            exitCode: c.error ? null : c.exit,
            durationMs: ms(c.started_at, c.finished_at),
            completed: Boolean(c.finished_at),
            metrics: metricOutput(c.stdout),
          });
      if (!d && isLast) {
        const candidate = store.listCandidates(run.run_id).at(-1);
        if (candidate)
          for (const e of store.listEvidence(
            run.run_id,
            candidate.candidate_id,
          )) {
            const receipt = parse(e.receipt_json),
              detail = receipt?.detail;
            const name = e.criterion_id.replace(/^check:/, "");
            if (
              [
                "typecheck",
                "lint",
                "test",
                "pm:lint",
                "docs:check",
                "os:check",
              ].includes(name)
            )
              checks.push({
                schema: "os/check@1",
                id: e.evidence_id,
                name,
                source: "supervisor",
                exitCode:
                  e.state === "satisfied" && Number.isInteger(detail?.exitCode)
                    ? detail.exitCode
                    : e.state === "failed"
                      ? (detail?.exitCode ?? 1)
                      : null,
                durationMs: null,
                metrics: detail
                  ? {
                      executed: detail.executed ?? null,
                      selected: detail.selected ?? null,
                    }
                  : null,
              });
          }
      }
      let context = null,
        warning = null;
      if (d?.base && d?.head && isLast)
        try {
          context = readRange(root, d.base + ".." + d.head);
        } catch {
          warning = "Candidate commit range unavailable in this checkout";
        }
      const session = {
        changeFacts: null,
        schema: "os/session@1",
        id: "delivery:" + job.job_id,
        agent:
          settings.executor ||
          (/codex/.test(job.backend_id) ? "codex" : "claude"),
        source: "delivery-v2",
        nativeRef: job.native_ref ?? null,
        runId: run.run_id,
        itemId,
        tier: tierAlias(root, settings.model),
        model: settings.model ?? null,
        effort: settings.effort ?? null,
        startedAt: job.dispatch_started_at,
        endedAt: ["finished", "failed", "cancelled"].includes(job.status)
          ? job.updated_at
          : null,
        lastObservedAt: job.updated_at,
        doneAt: isLast ? doneAt : null,
        setup: null,
        coverage: "supervisor",
        base: context?.base ?? null,
        head: context?.head ?? null,
        rangeSource: context ? "Delivery supervisor candidate" : null,
        branch: null,
        worktree: null,
        skills: [],
        reads: [],
        timeline: [],
        usage: counts,
        turns: null,
        outcome: run.closed_outcome || run.lifecycle,
        warnings: [
          "No native transcript joined; process/autonomy facts unknown",
          ...(warning ? [warning] : []),
        ],
        itemClass: {
          kind: item.kind ?? null,
          risk: context
            ? context.changes.some((c) =>
                /money|balance|accounts|transactions|recurr|migrations/.test(
                  c.file,
                ),
              )
            : null,
          effort: item.effort ?? null,
        },
      };
      session.changeFacts =
        context?.changes.map(({ file, beforeFile, added, removed, hunks }) => ({
          beforeFile,
          hunks,
          file,
          added,
          removed,
        })) ?? null;
      const record = {
        session,
        events: [],
        checks,
        verdicts: context ? evaluate(context).rules : [],
      };
      records.push({
        ...record,
        session: {
          ...session,
          scorecard: sessionScorecard(record, context?.changes ?? null, item),
        },
      });
    }
    runFacts.push({
      runId: run.run_id,
      itemId,
      doneAt,
      reverted,
      ownerActions: store
        .listDecisions(run.run_id)
        .filter((d) => d.actor && d.created_at)
        .map((d) => ({ at: d.created_at })),
      revertKnown: Boolean(d?.revert || gitReverts),
      shippedAt: d?.phase === "shipped" ? run.updated_at : null,
    });
  }
  const deliveries = [...new Set(runFacts.map((r) => r.itemId))].map(
    (itemId) => {
      const relevant = runFacts.filter((r) => r.itemId === itemId),
        views = uatRead.handovers.filter((h) => h.subject.work_id === itemId),
        accepted = views.filter(
          (h) =>
            h.acceptance.state === "accepted" &&
            !h.stale &&
            !Object.values(uatRead.corrupt || {}).some((n) => n > 0),
        );
      const shippedAt =
        accepted
          .map((h) => h.signoff?.received_at)
          .filter(Boolean)
          .sort()[0] ||
        relevant
          .map((r) => r.shippedAt)
          .filter(Boolean)
          .sort()[0] ||
        null;
      return deliveryScorecard({
        itemId,
        sessions: records
          .filter((r) => r.session.itemId === itemId)
          .map((r) => r.session),
        uat: views,
        followups: items,
        reverts: relevant.every((r) => r.revertKnown)
          ? relevant.map((r) => r.reverted).filter(Boolean)
          : null,
        shippedAt,
        ownerActions: [
          ...relevant.flatMap((r) => r.ownerActions),
          ...views.flatMap((h) =>
            [
              h.signoff?.received_at,
              ...h.scenarios.map((s) => s.receipt?.received_at),
            ]
              .filter(Boolean)
              .map((at) => ({ at })),
          ),
        ],
        now,
      });
    },
  );
  return {
    schema: "os/delivery-projection@1",
    observedAt: now,
    records,
    deliveries,
    uatCorrupt: uatRead.corrupt,
  };
}
export function readDelivery({ root, path, now = new Date().toISOString() }) {
  const store = openStore({ path, readOnly: true });
  try {
    const result = projectDelivery(store, { root, now });
    if (!store.readOnlySnapshotCurrent())
      throw new Error(
        "Delivery snapshot changed; retry after supervisor stops",
      );
    return result;
  } finally {
    store.close();
  }
}
