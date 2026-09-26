import type { V2Evidence, V2Plan, V2RunDetail } from "./types";
import { applicationLabel, branchLabel, evidenceLabel, outcomeLabel } from "./v2model";

export const reviewTabs = ["outcome", "plan", "checks", "activity", "changes"] as const;
export type ReviewTab = (typeof reviewTabs)[number];

export function defaultReviewTab(detail: V2RunDetail): ReviewTab {
  if (
    detail.questions.some((q) => q.status === "open" && q.blocking) ||
    detail.plans.at(-1)?.status === "proposed"
  )
    return "plan";
  if (detail.ownerAction.kind === "application-checks") return "checks";
  if (detail.result) return "outcome";
  if (detail.candidate) return "changes";
  return detail.jobs.some((job) => ["active", "reserved"].includes(job.status))
    ? "activity"
    : "plan";
}

export function reviewStatus(detail: V2RunDetail) {
  const application = detail.applications?.at(-1);
  if (application) return applicationLabel(application.state);
  return (
    branchLabel(detail.stage.branch) ||
    (detail.run.lifecycle === "CLOSED"
      ? outcomeLabel(detail.run.closed_outcome)
      : ["plan", "review-plan", "revise"].includes(detail.ownerAction.kind)
        ? "Review plan"
        : detail.stage.stages[detail.stage.current])
  );
}

/** Last observation per criterion, with every earlier observation retained. */
export function checkGroups(evidence: V2Evidence[]) {
  const groups = new Map<
    string,
    { current: V2Evidence; previous: V2Evidence[] }
  >();
  for (const entry of evidence) {
    const group = groups.get(entry.criterion_id);
    if (!group) {
      groups.set(entry.criterion_id, { current: entry, previous: [] });
      continue;
    }
    if (
      entry.criterion_revision > group.current.criterion_revision ||
      (entry.criterion_revision === group.current.criterion_revision &&
        entry.created_at >= group.current.created_at)
    ) {
      group.previous.unshift(group.current);
      group.current = entry;
    } else group.previous.push(entry);
  }
  return [...groups.values()];
}

export function checkTitle(entry: V2Evidence) {
  return (
    entry.title ||
    entry.criterion_id
      .replace(/^[a-z]+-?\d+-/iu, "")
      .replace(/[-_]/gu, " ")
      .replace(/^./u, (s) => s.toUpperCase())
  );
}

export function checkReason(reason: string | null) {
  if (!reason) return null;
  return (
    (
      {
        "malformed-observation": "No test count",
        "zero-executed": "No tests ran",
        "no-observation": "No check receipt",
        "runner-unavailable": "Runner unavailable",
      } as Record<string, string>
    )[reason] || reason.replace(/[-_]/gu, " ")
  );
}

/**
 * The retained check output, when there is any to show (DLV-120).
 *
 * Null for a pass and null when nothing was retained, so the screen gains a
 * disclosure exactly where it helps and stays unchanged everywhere else — U3's
 * complaint was output-retention *prose* on every row, not the log itself.
 */
export function checkLog(entry: V2Evidence) {
  if (entry.state === "satisfied") return null;
  const text = (entry.output || "").trim();
  if (!text || !text.includes("---")) return null;
  return text;
}

/**
 * Why this check is not a pass, in the checker's own vocabulary.
 *
 * A missing runner, unreadable output and failing tests are three different
 * next actions; the state alone renders the first two identically.
 */
export function checkOutcome(entry: V2Evidence) {
  return (
    (
      {
        "runner-missing": "Runner never started",
        "output-unreadable": "Output unreadable",
        "no-tests-selected": "No tests selected",
        "tests-failed": "Tests failed",
      } as Record<string, string>
    )[entry.outcome || ""] || null
  );
}

/** Export the selected stored revision, never the current checkout or an AI rewrite. */
export function planMarkdown(plan: V2Plan) {
  const b = plan.body;
  const section = (name: string, entries: string[], numbered = false) =>
    entries.length
      ? `\n## ${name}\n\n${entries.map((s, i) => `${numbered ? `${i + 1}.` : "-"} ${s}`).join("\n")}\n`
      : "";
  return (
    `# Plan · revision ${plan.revision}\n\n${b.outcome || ""}\n` +
    (b.preparation ? `\nSource: ${b.preparation.provenance}\n` : "") +
    section("Acceptance", b.acceptance || []) +
    section("Scope", b.scope) +
    section(
      "Steps",
      b.steps.map((s) => s.title),
      true,
    ) +
    section("Checks", b.checks) +
    section("Invariants", b.invariants || []) +
    section("Exclusions", b.exclusions || []) +
    section("Risks", b.risks) +
    section("Unknowns", b.unknowns) +
    section(
      "Questions",
      b.questions.map((q) => q.text),
    )
  );
}

/** 1,234 → "1k", 2,500,000 → "2.5M". */
export const compact = (value: number) =>
  value >= 1_000_000
    ? (value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0) + "M"
    : value >= 1_000
      ? Math.round(value / 1_000) + "k"
      : String(value);

/**
 * Tokens split into uncached input, cached input and output.
 *
 * `fresh` is the uncached portion of input and nothing more. It is deliberately
 * not called "real work": a cached token was still sent, still counted, and the
 * split says where the volume sat, not which part mattered.
 *
 * `raw` is the provider's own total before normalization, present only when it
 * differs — under a thread-cumulative counter a resumed job restates its
 * parent's usage, and showing the two together is how the owner can see that
 * 589,176 and 493,436 are the same run counted two ways.
 */
export function tokenSplit(resources: V2RunDetail["resources"]) {
  const t = resources?.provenance.measuredTokens;
  if (!t) return null;
  const input = Number(t.input || 0);
  const cached = Math.min(input, Number(t.cachedInput || 0));
  const total = input + Number(t.output || 0);
  const rawTotal = Number(resources?.provenance.rawProviderTokens?.total ?? total);
  return {
    fresh: input - cached,
    cached,
    output: Number(t.output || 0),
    reasoning: Number(t.reasoningOutput || 0),
    total,
    raw: Number.isFinite(rawTotal) && rawTotal !== total ? rawTotal : null,
  };
}

/**
 * What the run's accounting cannot stand behind, in one line, or null.
 *
 * Shown instead of a silent number: a missing baseline or an undeclared counter
 * means the total is an upper bound, and the owner has to be able to see that
 * without reading the store.
 */
export function normalizationNote(resources: V2RunDetail["resources"]) {
  const health = resources?.provenance.normalization;
  if (!health || health.complete) return null;
  const parts = health.flagged.map((entry) => `${entry.count}× ${entry.status}`);
  if (health.legacyRows) parts.push(`${health.legacyRows} recorded before normalization`);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * The run's subscription-window movement, or null when nothing is comparable.
 *
 * Deliberately phrased as the window's movement, not the run's consumption: the
 * window is shared with everything else on the account, and the two readings
 * only bracket the job. A window that reset between them yields null rather
 * than a negative number presented as a saving.
 */
export function planWindowMovement(jobs: V2RunDetail["jobs"]) {
  let before: number | null = null;
  let after: number | null = null;
  let observed = false;
  for (const job of jobs || []) {
    const primary = job.subscription?.comparison?.deltas?.find((entry) => entry.id === "primary" || entry.id === "five_hour");
    if (!primary) continue;
    observed = true;
    if (before == null) before = primary.before;
    after = primary.after;
  }
  if (!observed || before == null || after == null) return null;
  return { before, after, delta: Math.round((after - before) * 100) / 100 };
}

export type OutcomeVerdict = "verified" | "inconclusive" | "failed" | "in-progress" | "closed";

/**
 * The Outcome tab's summary, built only from recorded facts: the latest result,
 * the latest observation per check, the candidate and any application.
 */
export function outcomeSummary(detail: V2RunDetail) {
  const groups = checkGroups(detail.evidence);
  const plan = detail.plans.at(-1) || null;
  const application = detail.applications?.at(-1) || null;
  const failed = groups.filter((g) => g.current.state === "failed");
  const unclear = groups.filter((g) => !["satisfied", "failed", "waived"].includes(g.current.state));
  const passed = groups.filter((g) => g.current.state === "satisfied");
  let verdict: OutcomeVerdict;
  if (detail.run.lifecycle === "CLOSED" && !detail.result?.candidateVerified) verdict = failed.length ? "failed" : "closed";
  else if (!detail.result) verdict = "in-progress";
  else if (detail.result.candidateVerified) verdict = "verified";
  else if (failed.length) verdict = "failed";
  else verdict = "inconclusive";

  const good: string[] = [];
  const attention: string[] = [];
  if (plan && plan.status !== "proposed") good.push(`Plan r${plan.revision} approved`);
  const openQuestions = detail.questions.filter((q) => q.status === "open").length;
  if (plan && !openQuestions) good.push("No open questions");
  if (detail.candidate) {
    const n = detail.candidate.changed.length;
    if (detail.candidate.refusals.length) attention.push(`${detail.candidate.refusals.length} change(s) outside scope`);
    else good.push(`${n} file${n === 1 ? "" : "s"} changed, all in scope`);
  }
  for (const g of passed) {
    const c = g.current.counts;
    good.push(checkTitle(g.current) + (c?.executed != null && c.selected != null ? ` · ${c.executed}/${c.selected}` : "") + " passed");
  }
  for (const g of [...failed, ...unclear]) {
    const why = checkReason(g.current.reason);
    attention.push(checkTitle(g.current) + " · " + evidenceLabel(g.current) + (why ? ` (${why})` : ""));
  }
  if (application) (application.state === "applied" ? good : attention).push(applicationLabel(application.state));
  const tokens = tokenSplit(detail.resources);
  const allowance = detail.resources?.unit === "tokens" ? detail.resources.allowance : null;
  if (tokens && allowance != null && tokens.total > allowance) attention.push(`Tokens over allowance by ${(tokens.total - allowance).toLocaleString()}`);
  const unknownJobs = detail.result?.remaining_obligations.filter((o) => o.kind === "unknown-job-or-effect").length || 0;
  if (unknownJobs) attention.push("Job outcome unknown");
  return { verdict, good, attention, groups, plan, application, tokens };
}
