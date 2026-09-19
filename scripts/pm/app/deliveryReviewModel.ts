import type { V2Evidence, V2Plan, V2RunDetail } from "./types";
import { applicationLabel, branchLabel, outcomeLabel } from "./v2model";

export const reviewTabs = ["plan", "checks", "activity", "changes"] as const;
export type ReviewTab = (typeof reviewTabs)[number];

export function defaultReviewTab(detail: V2RunDetail): ReviewTab {
  if (
    detail.questions.some((q) => q.status === "open" && q.blocking) ||
    detail.plans.at(-1)?.status === "proposed"
  )
    return "plan";
  if (["review-result", "application-checks"].includes(detail.ownerAction.kind))
    return "checks";
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

/** Export the selected stored revision, never the current checkout or an AI rewrite. */
export function planMarkdown(plan: V2Plan) {
  const b = plan.body;
  const section = (name: string, entries: string[], numbered = false) =>
    entries.length
      ? `\n## ${name}\n\n${entries.map((s, i) => `${numbered ? `${i + 1}.` : "-"} ${s}`).join("\n")}\n`
      : "";
  return (
    `# Plan · revision ${plan.revision}\n\n${b.outcome || ""}\n` +
    section("Scope", b.scope) +
    section(
      "Steps",
      b.steps.map((s) => s.title),
      true,
    ) +
    section("Checks", b.checks) +
    section("Risks", b.risks) +
    section("Unknowns", b.unknowns) +
    section(
      "Questions",
      b.questions.map((q) => q.text),
    )
  );
}
