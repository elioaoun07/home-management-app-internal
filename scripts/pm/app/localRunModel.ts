import type { LocalRunView } from "./LocalDelivery";
import { localItemTitle } from "../shared/text.mjs";

/** The id is displayed separately; stored criteria headings may repeat it. */
export function displayTitle(run: {
  work: Pick<LocalRunView["work"], "id" | "title">;
}) {
  return localItemTitle(run.work.title, run.work.id);
}

export const LOCAL_CHECKS = ["typecheck", "lint", "test", "pm:lint"] as const;
const labels: Record<string, string> = {
  preparing: "Preparing",
  building: "Building",
  checking: "Checking",
  accepting: "Checking acceptance",
  "acceptance-paused": "Misses acceptance",
  stopped: "Stopped",
  "uat-ready": "Ready to test",
  merging: "Merging",
  "push-pending": "Push pending",
  shipped: "Closed",
  merged: "Merged in your folder",
  committed: "Committed",
  pushed: "Pushed",
  cleaned: "Cleaned",
  discarded: "Discarded",
  refreshing: "Refreshing",
  "refresh-failed": "Checks need retry",
  "refresh-conflict": "Blocked",
  failed: "Failed",
  cancelled: "Cancelled",
  reverted: "Reverted",
  "revert-push-pending": "Revert pending",
};
export type WorkflowRun = Pick<LocalRunView, "phase"> & Partial<LocalRunView>;

/** Closed without a merge: the owner can start the same item again. */
export function newAttemptHref(run: Pick<LocalRunView, "phase" | "run_id" | "work">): string | null {
  if (!run.work.campaign || !["failed", "cancelled", "discarded", "stopped"].includes(run.phase)) return null;
  return `#/deliver/${encodeURIComponent(run.work.campaign)}/${encodeURIComponent(run.work.id)}?from=${encodeURIComponent(`/delivery/run/${run.run_id}`)}`;
}

/** DLV-175: which try this is — the item's nth Local run, and the owner's revision within it.
 * Null on a first run with no revisions, so a first try shows nothing extra. */
export function attemptLabel(run: Pick<LocalRunView, "attempt" | "revision" | "revisions" | "revision_limit">): string | null {
  const parts: string[] = [];
  if (run.attempt && run.attempt.n > 1) parts.push(`Attempt ${run.attempt.n}`);
  const revisions = run.revisions ?? [], limit = run.revision_limit ?? 2;
  const active = run.revision ? revisions.find((entry) => entry.n === run.revision) : undefined;
  const last = revisions.at(-1);
  if (active) parts.push(`Revision ${active.ordinal ?? active.n}/${limit}`);
  else if (last && (last.state === "failed" || last.state === "cancelled")) parts.push(`Revision ${last.ordinal ?? last.n} ${last.state}`);
  else if (last) parts.push(`Revision ${last.ordinal ?? last.n}/${limit}`);
  return parts.length ? parts.join(" · ") : null;
}

/** Old file-copy receipts used phase "shipped" before Commit and Push existed. */
export function localRunLabel(run: Pick<WorkflowRun, "phase" | "pushed" | "cleaned_at" | "committed" | "applied" | "interrupted" | "merge" | "merge_pending" | "mergePlan" | "canMerge" | "handover" | "risk" | "reviewed_head" | "head">): string {
  if (run.pushed) return run.cleaned_at ? "Pushed · Cleaned" : "Pushed";
  if (run.phase === "discarded") return "Discarded";
  if (run.committed) return "Committed";
  if (run.applied) return "Merged in your folder";
  if (run.merge_pending) return "Merge incomplete";
  if (run.interrupted) return "Interrupted";
  if (run.phase === "shipped" && run.merge) return "Pushed";
  if (run.phase === "uat-ready") {
    if (run.mergePlan?.conflicts.length || run.mergePlan?.error || (run.mergePlan && run.mergePlan.branch !== run.mergePlan.expected)) return "Blocked";
    if (run.canMerge) return "Ready to merge";
    if (run.handover?.acceptance.state === "accepted") {
      if (run.risk?.required && run.reviewed_head !== run.head) return "Review required";
      return "Blocked";
    }
  }
  return labels[run.phase] || run.phase;
}

/** Milestones describe supervisor evidence, never invented native planning steps. */
export function localRunStages(run: WorkflowRun): { label: string; state: "done" | "pending" | "stopped" | "current" }[] {
  const stopped = run.interrupted || ["cancelled", "failed", "discarded", "stopped", "acceptance-paused", "refresh-conflict", "refresh-failed"].includes(run.phase);
  const published = !!run.pushed || (run.phase === "shipped" && !!run.merge && !run.applied);
  const merged = !!run.applied || published;
  const tested = merged || !!run.canMerge || run.handover?.acceptance.state === "accepted";
  // DLV-175: Handover follows a passed Acceptance Check, so a handover proves both.
  const accepted = merged || tested || (!!run.handover && run.phase === "uat-ready");
  const checked = accepted || ["accepting", "acceptance-paused"].includes(run.phase) || (run.phase === "stopped" && !!run.acceptance);
  const milestones: [string, boolean][] = [
    ["Build", !!run.head || checked || run.phase === "checking"],
    ["Check", checked], ["Acceptance", accepted], ["Test", tested],
  ];
  if (run.risk?.required) milestones.push(["Review", merged || (!!run.head && run.reviewed_head === run.head)]);
  milestones.push(["Merge", merged], ["Commit", !!run.committed || published], ["Push", published], ["Clean up", !!run.cleaned_at && published]);
  const first = milestones.findIndex(([, reached]) => !reached);
  return milestones.map(([label, reached], index) => ({
    label, state: reached ? "done" : index !== first ? "pending" : stopped ? "stopped" : "current",
  }));
}

export function localCheckLabel(
  check: LocalRunView["checks"][number] | undefined,
) {
  if (!check) return "Not run";
  if (check.error || check.exit === null) return "Inconclusive";
  return check.exit === 0 ? "Passed" : "Failed";
}

export function localFailureTitle(error: string) {
  if (error.startsWith("native session exited")) return "Agent could not start";
  if (error.includes("dependencies unavailable"))
    return "Dependency setup failed";
  if (error === "host checks failed") return "Verification failed";
  return error.split(/\r?\n/u)[0];
}
