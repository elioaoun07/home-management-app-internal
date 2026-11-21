import { useMemo } from "react";
import { useWorld } from "./state";
import { useClock } from "./StewardRequests";
import { useV2Queue, useV2Runs, useV2Session } from "./DeliveryV2";
import { useUat } from "./UatWizard";
import { transport } from "./transport";
import { sessionBoard } from "./sessionBoardModel";
import { cockpitCounts } from "./cockpitModel";

/** Bridge and Sessions observe the same queries, freshness and deduplication. */
export function useCockpitSessions(from = "/sessions") {
  const { world, runs, connected, connection, readError, runError, runsReady } = useWorld();
  const now = useClock(15000), session = useV2Session(), v2 = useV2Runs(), queue = useV2Queue();
  const paired = !!session.data?.paired, hasUat = !!transport().v2Uat;
  const uat = useUat(paired);
  const pending = connected && (
    (!runsReady && !runError && !readError) || session.isPending ||
    (paired && (v2.isPending || queue.isPending || (hasUat && uat.isPending)))
  );
  const statusKnown = !!(connected && !connection.stale && !readError && !runError &&
    runsReady && paired && !session.isError && v2.isSuccess && !v2.isError && queue.isSuccess && !queue.isError);
  const uatKnown = statusKnown && (!hasUat || (uat.isSuccess && !uat.isError));
  const board = useMemo(() => sessionBoard({ world, v1: runs, v2: v2.data?.runs,
    requests: v2.data?.requests, queue: queue.data, uat: uat.data, statusKnown, uatKnown, from, now }),
    [world, runs, v2.data, queue.data, uat.data, statusKnown, uatKnown, from, now]);
  return { board, counts: cockpitCounts(board, world.choices?.length ?? 0), pending,
    uncertain: !statusKnown || !uatKnown, statusKnown, now, session, v2, queue, uat };
}
