import type { LocalActivityEvent } from "../localRunActivityModel";

/** Preserve Native-first captures. New supervisors record the actual setup
 * beginning first; that prefix is complete only with a genuine Native start. */
export function stageStartRecorded(
  events: readonly LocalActivityEvent[],
): boolean {
  const first = events[0];
  if (first?.summary === "Native session started") return true;
  return (
    first?.kind === "event" &&
    first.label === "Installing dependencies" &&
    first.summary === "Installing dependencies" &&
    events
      .slice(1)
      .some(
        (event) =>
          event.kind === "event" &&
          event.label === "Session started" &&
          event.summary === "Native session started",
      )
  );
}
