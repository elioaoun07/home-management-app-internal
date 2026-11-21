import type { BoardFacts } from "./types";
import type { LocalRunView } from "../LocalDelivery";

export function boardRetry(run: Pick<LocalRunView, "branch" | "work">) {
  const prefix = `delivery/${run.work.id}-`;
  return run.branch.startsWith(prefix) && run.branch.length > prefix.length;
}

export function boardFactKey(f: BoardFacts) {
  return [
    f.state,
    f.snapshot.phase,
    f.snapshot.run.run_id,
    f.snapshot.run.head,
    f.snapshot.run.base,
    f.snapshot.run.handover?.handover_id,
    f.snapshot.latest?.id,
    f.snapshot.nodeCount,
    f.snapshot.objectiveCount,
    f.snapshot.objectivesAccepted,
    f.activeZone,
    f.buildZone,
    f.buildGate,
    f.retry,
    ...f.zones.map((z) => `${z.id}:${z.status}:${z.count ?? 0}`),
    ...f.snapshot.nodes.map((n) => `${n.id}:${n.edited}`),
    ...f.snapshot.seals.map((s) => s.state),
    ...f.snapshot.run.checks.map(check => `${check.name}:${check.started_at ?? ""}:${check.finished_at ?? ""}:${check.exit}:${check.error ?? ""}`),
    ...(f.attention ?? []).map((i) => `${i.id}:${i.state}`),
  ].join("|");
}
