import type { World } from "./types";
import { outcomeSeries, workOutcomes } from "../shared/metrics.mjs";
import { cleanEvidence } from "./gameModel";
import { coreSessionState } from "./coreState";

/** Uses the same outcome identity/date contract as Score. Sessions are not shipments. */
export function bridgeCharts(world: World, today?: string) {
  const outcomes = workOutcomes({ history: world.history, work: world.work });
  const shipped = outcomeSeries(outcomes, {
    weeks: 8,
    ...(today ? { today } : {}),
  });
  const records = (world.cockpit?.records || []).filter(
    (r) => !r.session.arena,
  );
  const quality = (["clean", "failed", "unknown"] as const).map((state) => ({
    state,
    records: records.filter((record) => cleanEvidence(record) === state),
  }));
  return {
    shipped,
    shippedCount: shipped.buckets.reduce(
      (sum, bucket) => sum + bucket.completed.length,
      0,
    ),
    quality,
    sessionCount: records.length,
  };
}

export function bridgeState(
  needs: number,
  running: number,
  uncertain: boolean,
) {
  return coreSessionState({
    needs,
    running,
    uncertain,
    v1Runs: [],
    v2Runs: [],
  });
}
