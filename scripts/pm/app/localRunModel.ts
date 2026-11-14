import type { LocalRunView } from "./LocalDelivery";

export const LOCAL_CHECKS = ["typecheck", "lint", "test", "pm:lint"] as const;
const labels: Record<string, string> = {
  preparing: "Preparing",
  building: "Building",
  checking: "Verifying",
  "uat-ready": "Ready to test",
  merging: "Merging",
  "push-pending": "Push pending",
  shipped: "Shipped",
  failed: "Failed",
  cancelled: "Cancelled",
  reverted: "Reverted",
  "revert-push-pending": "Revert pending",
};
export const localRunLabel = (
  run: Pick<LocalRunView, "phase" | "interrupted">,
) => (run.interrupted ? "Interrupted" : labels[run.phase] || run.phase);

/** Milestones describe supervisor evidence, never invented native planning steps. */
export function localRunStages(run: LocalRunView) {
  const terminal =
    ["failed", "cancelled"].includes(run.phase) || run.interrupted;
  const nativeStarted = run.activity.some(
    (entry) => entry.summary === "Native session started",
  );
  const current = terminal
    ? run.head || run.checks.length
      ? 2
      : nativeStarted
        ? 1
        : 0
    : run.phase === "preparing"
      ? 0
      : run.phase === "building"
        ? 1
        : run.phase === "checking"
          ? 2
          : run.phase === "uat-ready"
            ? 3
            : 4;
  return ["Setup", "Plan & build", "Verify", "Test", "Ship"].map(
    (label, index) => ({
      label,
      state:
        index < current || (index === current && run.phase === "shipped")
          ? "done"
          : index > current
            ? "pending"
            : terminal
              ? "stopped"
              : "current",
    }),
  );
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
