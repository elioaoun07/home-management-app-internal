import { scanLines } from "../shared/md-scan.mjs";
import { CHIP_ID_SOURCE, normalizeWorkId } from "../shared/work-id.mjs";
import { isTerminal, phaseLabel, sessionStatus } from "../shared/product.mjs";
import { sessionHref } from "./cockpitModel";
import { bareTitle } from "./deliveryHomeModel";
import { localRunLabel } from "./localRunModel";
import { localRunOf, progress, uatLabel, uatReviewGroup } from "./uatModel";
import { branchLabel, outcomeLabel, runningLabel } from "./v2model";
import type { Flight } from "./cockpitTypes";
import type {
  RunSummary,
  StewardRequest,
  UatSummary,
  V2Queue,
  V2RunSummary,
  World,
} from "./types";

export const SESSION_BOARD_LANES = [
  { id: "running", label: "Running" },
  { id: "needs", label: "Needs you" },
  { id: "uat", label: "To test" },
  { id: "waiting", label: "Waiting" },
  { id: "finished", label: "Finished" },
  { id: "unknown", label: "Unconfirmed" },
] as const;
export type SessionBoardLane = (typeof SESSION_BOARD_LANES)[number]["id"];
export type SessionBoardUnit = "session" | "request" | "acceptance";
export type SessionBoardOutcome =
  | "failed"
  | "cancelled"
  | "accepted"
  | "verified"
  | "partial"
  | "unrecorded";
export interface SessionBoardCounts {
  sessions: number;
  requests: number;
  acceptance: number;
}
export interface PendingOwnerUat {
  key: string;
  id: string;
  campaign: string;
  title: string;
  href: string;
}
export interface SessionBoardCard {
  key: string;
  kind: "v1" | "v2" | "record" | "request" | "uat" | "owner-uat";
  unit: SessionBoardUnit;
  lane: SessionBoardLane;
  workId: string | null;
  campaign: string | null;
  title: string;
  status: string;
  at: string | null;
  href: string;
  action: string;
  evidenceHref?: string;
  agent?: string | null;
  outcome: SessionBoardOutcome;
  lastKnown: boolean;
  recordIds: string[];
  handoverId?: string;
  requestId?: string;
  stage?: string;
  testProgress?: { done: number; total: number };
  testStatus?: string;
  testHref?: string;
}
export interface SessionBoardInput {
  world: World;
  v1?: RunSummary[];
  v2?: V2RunSummary[];
  queue?: V2Queue | null;
  requests?: StewardRequest[];
  records?: Flight[];
  uat?: UatSummary[];
  pendingUat?: PendingOwnerUat[];
  statusKnown: boolean;
  uatKnown?: boolean;
  recordsKnown?: boolean;
  from?: string;
  now?: number;
}
const itemKey = (campaign: string, id: string) =>
  `${campaign}:${normalizeWorkId(id)}`;
const hasPendingUat = (body: string) =>
  /^\s*(?:-\s*)?\*\*UAT:\*\*\s*pending\b/im.test(body);
const canonicalHeading = new RegExp(`^${CHIP_ID_SOURCE}$`, "i");
export const itemUatHref = (campaign: string, id: string) =>
  `#/uat-item/${encodeURIComponent(campaign)}/${encodeURIComponent(id)}`;

/** Owner acceptance survives checklist archival, with a wizard destination for every item. */
export function pendingOwnerUat(world: World): PendingOwnerUat[] {
  const pending = new Map<string, PendingOwnerUat>();
  for (const space of world.spaces) {
    if (!space.book) continue;
    const lines = scanLines(space.book.raw).lines;
    const headings = lines.filter(
      (line) => line.type === "heading" && line.level <= 3,
    );
    for (let index = 0; index < headings.length; index++) {
      const heading = headings[index];
      if (heading.level !== 3 || !canonicalHeading.test(heading.text)) continue;
      const body = lines
        .slice(heading.line + 1, headings[index + 1]?.line)
        .filter((line) => !["in-fence", "fence-delim"].includes(line.type))
        .map((line) => line.raw)
        .join("\n");
      if (!hasPendingUat(body)) continue;
      const id = heading.text;
      const key = itemKey(space.name, id);
      pending.set(key, {
        key,
        id,
        campaign: space.name,
        title:
          body.match(/^\s*(?:-\s*)?\*\*Outcome:\*\*\s*([^\r\n]+)/im)?.[1] || id,
        href: itemUatHref(space.name, id),
      });
    }
  }
  for (const work of world.work) {
    if (!hasPendingUat(work.contract)) continue;
    const key = itemKey(work.module, work.id);
    pending.set(key, {
      key,
      id: work.id,
      campaign: work.module,
      title: work.outcome || bareTitle(work.title, work.id),
      href: itemUatHref(work.module, work.id),
    });
  }
  return [...pending.values()];
}

function counts(cards: SessionBoardCard[]): SessionBoardCounts {
  return {
    sessions: cards.filter((card) => card.unit === "session").length,
    requests: cards.filter((card) => card.unit === "request").length,
    acceptance: cards.filter((card) => card.unit === "acceptance").length,
  };
}
function outcome(value: string | null | undefined): SessionBoardOutcome {
  const normalized = value?.toLowerCase();
  if (normalized === "failed") return "failed";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "verified_candidate") return "verified";
  if (normalized === "useful_partial") return "partial";
  if (
    ["shipped", "accepted", "completed", "success"].includes(normalized || "")
  )
    return "accepted";
  return "unrecorded";
}
const stamp = (value: string | null | undefined) =>
  value ? Date.parse(value) || 0 : 0;

/** Sessions, undispatched requests, and direct acceptance tasks retain their own units. */
export function sessionBoard(input: SessionBoardInput) {
  const {
    world,
    v1 = [],
    v2 = [],
    queue,
    requests = [],
    uat = [],
    statusKnown,
    uatKnown = statusKnown,
    recordsKnown = input.records !== undefined ||
      Boolean(world.cockpit && !world.cockpit.pending && !world.cockpit.stale),
    records = world.cockpit?.records || [],
    pendingUat = pendingOwnerUat(world),
    from = "/sessions",
    now = stamp(world.generatedAt),
  } = input;
  const cards = new Map<string, SessionBoardCard>();
  const runHref = (id: string) =>
    `#/delivery/run/${encodeURIComponent(id)}?from=${encodeURIComponent(from)}`;
  const testHref = (id: string) =>
    `#/delivery/test/${encodeURIComponent(id)}?from=${encodeURIComponent(from)}`;
  const linkedRunKey = (id: string) =>
    v1.some((run) => run.sessionId === id) &&
    !v2.some((run) => run.run_id === id)
      ? `v1:${id}`
      : `v2:${id}`;
  const titleFor = (
    id: string | null,
    campaign: string | null,
    fallback: string,
  ) => {
    const work = world.work.find(
      (item) =>
        normalizeWorkId(item.id) === normalizeWorkId(id) &&
        (!campaign || item.module === campaign),
    );
    return work?.outcome || bareTitle(work?.title || fallback, id);
  };
  const base = (
    key: string,
    kind: SessionBoardCard["kind"],
    unit: SessionBoardUnit,
    workId: string | null,
    campaign: string | null,
    title: string,
    href: string,
  ): SessionBoardCard => ({
    key,
    kind,
    unit,
    lane: "unknown",
    workId,
    campaign,
    title: titleFor(workId, campaign, title),
    status: "Status unconfirmed",
    at: null,
    href,
    action: "Open",
    outcome: "unrecorded",
    lastKnown: !statusKnown,
    recordIds: [],
  });
  const latestUat = new Map<string, UatSummary>();
  const localStages = new Map(v2.filter(run => run.lane === "local").map(run => [`v2:${run.run_id}`, run.stage]));
  for (const handover of [...uat].sort(
    (a, b) => stamp(a.created_at) - stamp(b.created_at),
  )) {
    const localId = localRunOf(handover.subject.delivery_ref);
    const runId = handover.subject.run_id || (localId && localStages.has(`v2:${localId}`) ? localId : null);
    const key = runId
      ? linkedRunKey(runId)
      : handover.subject.work_id && handover.subject.campaign
        ? `item:${itemKey(handover.subject.campaign, handover.subject.work_id)}`
        : `uat:${handover.subject.delivery_ref || handover.handover_id}`;
    latestUat.set(key, handover);
  }
  const applyUat = (card: SessionBoardCard, handover: UatSummary) => {
    card.handoverId = handover.handover_id;
    card.testProgress = progress(handover);
    const localStage = localStages.get(card.key);
    if (localStage) {
      if (localStage === "uat-ready") {
        const accepted = handover.acceptance.state === "accepted";
        card.status = accepted ? "Signed off" : uatLabel(handover);
        card.lane = accepted ? "needs" : "uat";
        card.action = "Open run";
      }
      return;
    }
    const group = uatReviewGroup(handover);
    if (card.lane === "running") return;
    if (card.lane === "needs" && group === "not-ready") {
      card.testStatus = "Test steps pending";
      card.testHref = testHref(handover.handover_id);
      return;
    }
    if (group === "history") {
      if (card.kind === "uat") {
        card.lane = "finished";
        card.status =
          handover.acceptance.state === "accepted"
            ? "Accepted"
            : uatLabel(handover);
        card.outcome =
          handover.acceptance.state === "accepted" ? "accepted" : "unrecorded";
        card.action = "Results";
      }
      return;
    }
    card.lane =
      group === "to-test" ? "uat" : group === "feedback" ? "needs" : "waiting";
    card.status =
      group === "not-ready" ? "Test steps pending" : uatLabel(handover);
    card.href = testHref(handover.handover_id);
    card.action =
      group === "to-test"
        ? "Test"
        : group === "feedback"
          ? "Feedback"
          : "View steps";
    card.lastKnown ||= !uatKnown;
  };

  for (const run of [...v2].sort(
    (a, b) => stamp(a.updated_at) - stamp(b.updated_at),
  )) {
    const key = `v2:${run.run_id}`;
    const card = base(
      key,
      "v2",
      "session",
      run.alias,
      run.campaign,
      run.title,
      runHref(run.run_id),
    );
    const decision = queue?.decisions.find(
      (item) => item.run_id === run.run_id,
    );
    const running = queue?.running.find((item) => item.run_id === run.run_id);
    const uncertain =
      queue?.unknown.jobs.some((item) => item.run_id === run.run_id) ||
      running?.status === "unknown" ||
      run.branch === "unknown";
    const needsOwner =
      !!decision ||
      (!!run.ownerActionKind &&
        !["none", "waiting"].includes(run.ownerActionKind));
    card.at = run.updated_at || run.created_at;
    card.agent = run.executor;
    card.stage = branchLabel(run.branch) || run.stage.replace(/[-_]/g, " ");
    card.outcome = outcome(run.closed_outcome);
    if (uncertain && !needsOwner) card.status = "Execution unconfirmed";
    // DLV-164: a running Local session holding on an owner question needs you.
    else if (run.ownerActionKind === "local-question") {
      card.lane = "needs";
      card.status = run.ownerAction || "Question";
      card.action = "Answer";
    } else if (run.active || (running && running.status !== "unknown")) {
      card.lane = "running";
      card.status =
        branchLabel(run.branch) ||
        (running ? runningLabel(running) : run.ownerAction || "Running");
    } else if (needsOwner) {
      card.lane = "needs";
      card.status = decision?.label || run.ownerAction;
      card.action = "Review";
    } else if (run.lifecycle === "CLOSED") {
      card.lane = "finished";
      card.status =
        run.application?.state === "applied"
          ? "Applied"
          : outcomeLabel(run.closed_outcome);
    } else if (
      queue?.waiting.some((item) => item.run_id === run.run_id) ||
      run.ownerActionKind === "waiting" ||
      run.coordination?.state === "waiting"
    ) {
      card.lane = "waiting";
      card.status = run.ownerAction || "Queued";
    }
    if (run.lane === "local") {
      card.stage = localRunLabel({ phase: run.stage });
      if (["merged", "committed", "refresh-conflict", "refresh-failed", "push-pending", "revert-push-pending", "uat-ready", "pushed"].includes(run.stage)) {
        card.status = card.stage;
        card.lane = run.stage === "uat-ready" ? "uat" : "needs";
        card.action = "Open run";
      } else if (run.lifecycle === "CLOSED") card.status = card.stage;
    }
    const handover = latestUat.get(key);
    if (handover) applyUat(card, handover);
    cards.set(key, card);
  }
  for (const run of [...v1].sort(
    (a, b) => stamp(a.updatedAt) - stamp(b.updatedAt),
  )) {
    const key = `v1:${run.sessionId}`;
    const card = base(
      key,
      "v1",
      "session",
      run.item.id || null,
      run.item.campaign || null,
      run.item.text || run.item.id || "Delivery session",
      `#/delivery/session/${encodeURIComponent(run.sessionId)}?from=${encodeURIComponent(from)}`,
    );
    card.at = run.updatedAt || run.createdAt || null;
    card.agent = run.agent;
    card.stage = phaseLabel(run.state);
    card.status = sessionStatus(run);
    card.outcome = outcome(run.state);
    if (isTerminal(run.state)) {
      card.lane = "finished";
      if (run.state === "SHIPPED") card.status = "Accepted";
    } else if (run.state === "UAT_READY" || run.awaiting?.gate === "uat") {
      card.lane = "uat";
      card.action = "Test";
      if (card.workId && card.campaign)
        card.href = itemUatHref(card.campaign, card.workId);
    } else if (
      run.awaiting ||
      [
        "SPEC_READY",
        "PLAN_READY",
        "NEEDS_DECISION",
        "ACCEPTED",
        "BLOCKED",
      ].includes(run.state)
    ) {
      card.lane = "needs";
      card.action = "Review";
    } else if (run.execution?.paused || run.state === "SELECTED")
      card.lane = "waiting";
    else if (run.runnerAlive === true) card.lane = "running";
    const handover = latestUat.get(key);
    if (handover) applyUat(card, handover);
    cards.set(key, card);
  }
  // Queue observations may arrive before the corresponding run projection.
  for (const observation of [
    ...(queue?.decisions || []),
    ...(queue?.running || []),
    ...(queue?.waiting || []),
  ]) {
    const key = `v2:${observation.run_id}`;
    if (cards.has(key)) continue;
    const card = base(
      key,
      "v2",
      "session",
      observation.alias,
      observation.campaign,
      observation.title,
      runHref(observation.run_id),
    );
    card.agent = observation.executor;
    if ("kind" in observation) {
      card.lane = "needs";
      card.status = observation.label;
      card.action = "Review";
    } else if ("job_id" in observation) {
      card.lane = observation.status === "unknown" ? "unknown" : "running";
      card.status = runningLabel(observation);
    } else {
      card.lane = "waiting";
      card.status = "Queued";
    }
    const handover = latestUat.get(key);
    if (handover) applyUat(card, handover);
    cards.set(key, card);
  }
  for (const request of [...requests].sort(
    (a, b) => stamp(a.acceptedAt) - stamp(b.acceptedAt),
  )) {
    const key = request.run_id
      ? linkedRunKey(request.run_id)
      : `request:${request.command_id}`;
    const existing = cards.get(key);
    if (existing) {
      existing.requestId = request.command_id;
      continue;
    }
    const campaign = request.file.replace(/\\/g, "/").split("/")[0];
    const card = base(
      key,
      "request",
      request.run_id ? "session" : "request",
      request.workId,
      campaign,
      request.workId,
      request.run_id
        ? runHref(request.run_id)
        : `#/sessions?request=${encodeURIComponent(request.command_id)}`,
    );
    card.requestId = request.command_id;
    card.at = request.lastConfirmedAt || request.acceptedAt;
    card.outcome = outcome(request.status);
    const observed = stamp(request.lastConfirmedAt);
    card.lastKnown ||=
      !request.terminal &&
      (!observed ||
        request.staleAfterMs <= 0 ||
        observed > now ||
        now - observed >= request.staleAfterMs);
    if (request.terminal) {
      card.lane = "finished";
      card.status =
        request.status === "cancelled"
          ? "Cancelled"
          : request.status === "failed"
            ? "Failed"
            : "Request ended";
    } else if (request.status === "blocked") {
      card.lane = "needs";
      card.status = "Start blocked";
    } else if (request.status === "running" && request.run_id) {
      card.lane = "running";
      card.status = "Running";
    } else {
      card.lane = "waiting";
      card.status = "Queued";
    }
    cards.set(key, card);
  }
  for (const record of [...records].sort(
    (a, b) => stamp(a.session.startedAt) - stamp(b.session.startedAt),
  )) {
    if (record.session.arena) continue;
    const session = record.session;
    const key = session.runId
      ? linkedRunKey(session.runId)
      : `record:${session.id}`;
    const existing = cards.get(key);
    if (existing && existing.kind !== "record") {
      if (!existing.recordIds.includes(session.id))
        existing.recordIds.push(session.id);
      existing.evidenceHref = sessionHref(session.id);
      continue;
    }
    const matching = world.work.filter(
      (item) => normalizeWorkId(item.id) === normalizeWorkId(session.itemId),
    );
    const campaign = matching.length === 1 ? matching[0].module : null;
    const card = base(
      key,
      "record",
      "session",
      session.itemId || null,
      campaign,
      session.intent || "Agent session",
      sessionHref(session.id),
    );
    card.agent = session.agent;
    card.at = session.endedAt || session.startedAt || null;
    card.action = "View evidence";
    card.recordIds = [...new Set([...(existing?.recordIds || []), session.id])];
    card.evidenceHref = sessionHref(session.id);
    card.lastKnown = !recordsKnown;
    card.outcome = outcome(session.outcome);
    // A completed worker job does not prove its parent delivery session ended.
    if (card.outcome !== "unrecorded" || (!session.runId && session.endedAt)) {
      card.lane = "finished";
      card.status =
        card.outcome === "unrecorded"
          ? "Ended · outcome unrecorded"
          : card.outcome === "accepted"
            ? "Completed"
            : outcomeLabel(session.outcome);
    } else card.status = "End unrecorded";
    cards.set(key, card);
  }
  const representedUat = new Set<string>();
  for (const [key, handover] of latestUat) {
    const subject = handover.subject;
    const currentAcceptance =
      uatReviewGroup(handover) !== "history" ||
      (handover.acceptance.state === "accepted" &&
        handover.status === "ready" &&
        !handover.stale);
    if (currentAcceptance && subject.campaign && subject.work_id)
      representedUat.add(itemKey(subject.campaign, subject.work_id));
    const existing = cards.get(key);
    if (existing) {
      applyUat(existing, handover);
      continue;
    }
    const card = base(
      key,
      "uat",
      subject.run_id ? "session" : "acceptance",
      subject.work_id,
      subject.campaign,
      subject.title || handover.summary || "Acceptance",
      testHref(handover.handover_id),
    );
    card.at = handover.created_at;
    card.lastKnown = !uatKnown;
    applyUat(card, handover);
    cards.set(key, card);
  }
  for (const pending of pendingUat) {
    if (representedUat.has(pending.key)) continue;
    const card = base(
      `owner-uat:${pending.key}`,
      "owner-uat",
      "acceptance",
      pending.id,
      pending.campaign,
      pending.title,
      pending.href,
    );
    card.lane = "uat";
    card.status = "Owner test pending";
    card.action = "Test";
    card.lastKnown = world.offline;
    cards.set(card.key, card);
  }
  const ordered = [...cards.values()].sort(
    (a, b) => stamp(b.at) - stamp(a.at) || a.key.localeCompare(b.key),
  );
  return {
    counts: counts(ordered),
    lanes: SESSION_BOARD_LANES.map((lane) => {
      const own = ordered.filter((card) => card.lane === lane.id);
      return {
        ...lane,
        cards: own,
        counts: counts(own),
        known: lane.id === "uat" ? uatKnown : statusKnown && recordsKnown,
      };
    }),
  };
}
