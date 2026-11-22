import { localRunStages, type WorkflowRun } from "./localRunModel";

export const OWNER_STATIONS = [
  { id: "test", label: "Test" },
  { id: "review", label: "Review" },
  { id: "merge", label: "Merge" },
  { id: "commit", label: "Commit" },
  { id: "push", label: "Push" },
  { id: "cleanup", label: "Clean up" },
] as const;

export type OwnerStation = (typeof OWNER_STATIONS)[number]["id"];
export type OwnerStationState =
  | "done"
  | "current"
  | "pending"
  | "stopped"
  | "optional";

export function needsManualCommit(run: WorkflowRun) {
  return (
    run.publication?.action === "commit" &&
    run.publication.reason ===
      "This older merge has no verified file list. Review and commit it manually."
  );
}

export function ownerStationState(
  run: WorkflowRun,
  id: OwnerStation,
): OwnerStationState {
  if (id === "cleanup") {
    if (run.cleaned_at) return "done";
    if (["failed", "cancelled", "reverted"].includes(run.phase))
      return "current";
  }
  if (id === "review" && !run.head && !run.risk) return "pending";
  if (id === "review" && !run.risk?.required)
    return run.head && run.reviewed_head === run.head ? "done" : "optional";
  const label = OWNER_STATIONS.find((station) => station.id === id)!.label;
  const stage = localRunStages(run).find((step) => step.label === label);
  if (stage?.state === "current") {
    if (
      run.cleaned_at ||
      (run.publication?.action === id && run.publication.reason)
    )
      return "stopped";
    if (id === "merge" && run.phase === "uat-ready" && !run.canMerge)
      return "stopped";
  }
  return stage?.state ?? "pending";
}

export function ownerStationSignals(run: WorkflowRun): Record<OwnerStation, OwnerStationState> {
  return Object.fromEntries(OWNER_STATIONS.map(({ id }) => [id, ownerStationState(run, id)])) as Record<OwnerStation, OwnerStationState>;
}

export function currentOwnerStation(run: WorkflowRun): OwnerStation {
  if (run.cleaned_at) return "cleanup";
  if (
    run.merge_pending ||
    run.phase.startsWith("refresh") ||
    run.mergePlan?.conflicts.length ||
    run.mergePlan?.error ||
    (run.mergePlan && run.mergePlan.branch !== run.mergePlan.expected)
  )
    return "merge";
  if (run.phase === "push-pending" || run.phase === "revert-push-pending")
    return "push";
  if (run.publication) return run.publication.action;
  if (["failed", "cancelled", "discarded", "reverted"].includes(run.phase))
    return "cleanup";
  return (
    OWNER_STATIONS.find(({ id }) =>
      ["current", "stopped"].includes(ownerStationState(run, id)),
    )?.id ?? "test"
  );
}
