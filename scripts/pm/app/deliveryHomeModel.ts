import { isTerminal } from "../shared/product.mjs";
import { pastOutcomeV1, pastOutcomeV2, type PastOutcome } from "./model";
import { groupUat } from "./uatModel";
import type {
  RunSummary,
  StewardRequest,
  UatSummary,
  V2Coordination,
  V2Queue,
  V2RunSummary,
} from "./types";

type Running = V2Queue["running"][number];

/** One line of the Delivery home. Every delivery appears in exactly one group. */
export type HomeRow =
  | {
      kind: "v2";
      key: string;
      run: V2RunSummary;
      request?: StewardRequest;
      running?: Running;
      coordination?: Pick<V2Coordination, "verdict" | "reasons">;
    }
  | { kind: "v1"; key: string; run: RunSummary }
  | {
      kind: "decision";
      key: string;
      item: V2Queue["decisions"][number];
      request?: StewardRequest;
      changed: boolean;
    }
  | { kind: "request"; key: string; request: StewardRequest }
  /** A finished delivery waiting for the owner's own test (R76). */
  | { kind: "uat"; key: string; item: UatSummary };

export interface HomeGroups {
  /** The owner has to act: apply, review, answer, or fix a blocked start. */
  needs: HomeRow[];
  /** Started and not waiting on the owner. */
  progress: HomeRow[];
  /** Queued behind capacity, scope or allowance. */
  waiting: HomeRow[];
  /** Finished, with where it ended. */
  past: { row: HomeRow; outcome: PastOutcome }[];
  /** Every other test record: drafts, needs-changes, shipped, superseded. */
  records: UatSummary[];
}

/**
 * Sorts runs, launch receipts and queue decisions into the four groups the home
 * shows. A launch receipt never gets a card of its own once its run exists: the
 * run row carries the initiator and the run page carries the full receipt.
 */
export function groupDelivery({
  v2Runs,
  queue,
  requests,
  v1Runs,
  uat = [],
}: {
  v2Runs: V2RunSummary[];
  queue?: V2Queue | null;
  requests: StewardRequest[];
  v1Runs: RunSummary[];
  uat?: UatSummary[];
}): HomeGroups {
  const byRun = new Map<string, StewardRequest>();
  for (const request of requests)
    if (request.run_id && !byRun.has(request.run_id))
      byRun.set(request.run_id, request);
  const decisions = new Map(
    (queue?.decisions ?? []).map((item) => [item.run_id, item]),
  );
  const waiting = new Map(
    (queue?.waiting ?? []).map((item) => [item.run_id, item]),
  );
  const running = new Map(
    (queue?.running ?? []).map((item) => [item.run_id, item]),
  );
  const changed = new Set(
    (queue?.candidates ?? [])
      .filter((item) => item.sourceChanged)
      .map((item) => item.run_id),
  );
  const known = new Set(v2Runs.map((run) => run.run_id));
  const tests = groupUat(uat);
  const testing = new Set(tests.needs.map((item) => item.subject.run_id).filter(Boolean));
  const groups: HomeGroups = { needs: [], progress: [], waiting: [], past: [], records: tests.records };
  const pastRequests: HomeGroups["past"] = [];

  for (const item of decisions.values())
    groups.needs.push({
      kind: "decision",
      key: "d:" + item.run_id,
      item,
      request: byRun.get(item.run_id),
      changed: changed.has(item.run_id),
    });

  // A delivery waiting for the owner's test is listed once, as the Test row.
  for (const item of tests.needs) groups.needs.push({ kind: "uat", key: "t:" + item.handover_id, item });

  for (const request of requests) {
    if (request.run_id && known.has(request.run_id)) continue;
    const row: HomeRow = {
      kind: "request",
      key: "q:" + request.command_id,
      request,
    };
    if (!request.terminal)
      (request.status === "blocked" ? groups.needs : groups.progress).push(row);
    else if (!request.run_id)
      pastRequests.push({
        row,
        outcome: request.status === "cancelled" ? "cancelled" : "other",
      });
  }

  for (const run of v2Runs) {
    if (decisions.has(run.run_id)) continue;
    if (run.lifecycle === "CLOSED" && testing.has(run.run_id)) continue;
    const queued = waiting.get(run.run_id);
    const row: HomeRow = {
      kind: "v2",
      key: "r:" + run.run_id,
      run,
      request: byRun.get(run.run_id),
      running: running.get(run.run_id),
      coordination: queued ?? run.coordination,
    };
    // A failed queue read must not hide an owner decision already confirmed by
    // the run projection. Do not infer an action from a candidate alone.
    if (run.ownerActionKind === "apply") groups.needs.push(row);
    else if (run.lifecycle === "CLOSED")
      groups.past.push({ row, outcome: pastOutcomeV2(run) });
    else if (queued || run.ownerActionKind === "waiting")
      groups.waiting.push(row);
    else groups.progress.push(row);
  }

  for (const run of v1Runs) {
    const row: HomeRow = { kind: "v1", key: "s:" + run.sessionId, run };
    if (isTerminal(run.state))
      groups.past.push({ row, outcome: pastOutcomeV1(run) });
    else groups.progress.push(row);
  }

  groups.past.push(...pastRequests);
  const dateOf = (row: HomeRow) => row.kind === "v1" ? row.run.createdAt || row.run.updatedAt : row.kind === "v2" ? row.run.created_at : row.kind === "request" ? row.request.acceptedAt : null;
  groups.past.sort((a, b) => (Date.parse(dateOf(b.row) || "") || 0) - (Date.parse(dateOf(a.row) || "") || 0));
  return groups;
}

/** Ids of everything already being delivered, so In focus never re-offers it. */
export function deliveredIds(
  groups: Pick<HomeGroups, "needs" | "progress" | "waiting">,
): Set<string> {
  const ids = new Set<string>();
  for (const row of [...groups.needs, ...groups.progress, ...groups.waiting]) {
    const id =
      row.kind === "v2"
        ? row.run.alias
        : row.kind === "decision"
          ? row.item.alias
          : row.kind === "v1"
            ? row.run.item.id
            : row.kind === "uat"
              ? row.item.subject.work_id
              : row.request.workId;
    if (id) ids.add(id.toUpperCase());
  }
  return ids;
}

/** A title without its leading item id, which the kicker already shows. */
export function bareTitle(title: string, id?: string | null) {
  if (!id) return title;
  const rest = title.slice(id.length);
  return title.slice(0, id.length).toUpperCase() === id.toUpperCase() &&
    /^[\s·:—–]/u.test(rest)
    ? rest.replace(/^[\s·:—–-]+/u, "")
    : title;
}

export const historyCounts = (past: HomeGroups["past"]) => {
  const counts: Record<PastOutcome, number> = {
    apply: 0,
    applied: 0,
    accepted: 0,
    cancelled: 0,
    other: 0,
  };
  for (const entry of past) counts[entry.outcome]++;
  return counts;
};

export type { PastOutcome };
