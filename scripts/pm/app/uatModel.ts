// R76 — the pure side of the UAT wizard: labels, grouping, step navigation and
// the durable local copy of unsent work. Nothing here reads the DOM, a transport
// or the clock, so desktop, the phone shell and the tests share one meaning.
import type {
  UatAcceptance,
  UatBlocker,
  UatFeedbackThread,
  UatHandover,
  UatScenario,
  UatStatus,
  UatSummary,
  V2RunSummary,
} from "./types";

export const RESULT_LABEL = { pending: "Pending", pass: "Pass", fail: "Fail", blocked: "Blocked" } as const;

const ACCEPTANCE_LABEL: Record<UatAcceptance, string> = {
  pending: "Test",
  "in-progress": "Testing",
  "needs-changes": "Needs changes",
  blocked: "Blocked",
  accepted: "Shipped",
  superseded: "Superseded",
  "no-candidate": "No candidate",
};

/** One short word for where a delivery stands. A draft or incomplete handover says so first. */
export function uatLabel(item: Pick<UatSummary, "status" | "acceptance">): string {
  if (item.status === "incomplete") return "Incomplete";
  if (item.status === "draft") return "Draft";
  return ACCEPTANCE_LABEL[item.acceptance.state];
}

/** Required scenarios with a current PASS, over all required. */
export function progress(item: { scenarios: { required: boolean; result: string }[] }) {
  const required = item.scenarios.filter((scenario) => scenario.required);
  return { done: required.filter((scenario) => scenario.result === "pass").length, total: required.length };
}

/** A ready handover still waiting on the owner's own testing. */
export const needsTest = (item: UatSummary) =>
  item.status === "ready" && !item.stale && ["pending", "in-progress", "blocked"].includes(item.acceptance.state);

/**
 * `needs` shows once per delivery under Needs you; everything else is a record
 * (drafts, needs-changes, shipped, superseded), newest first. Nothing is dropped.
 */
export function groupUat(list: UatSummary[]) {
  const newest = (a: UatSummary, b: UatSummary) => (a.created_at < b.created_at ? 1 : -1);
  return {
    needs: list.filter(needsTest).sort(newest),
    records: list.filter((item) => !needsTest(item)).sort(newest),
  };
}

export const UAT_REVIEW_FILTERS = [
  { id: "to-test", label: "To test" },
  { id: "not-ready", label: "Not ready" },
  { id: "feedback", label: "Feedback" },
  { id: "history", label: "History" },
  { id: "all", label: "All" },
] as const;
export type UatReviewFilter = typeof UAT_REVIEW_FILTERS[number]["id"];

/** Keep preparation separate from owner testing without burying either. */
export function uatReviewGroup(item: UatSummary): Exclude<UatReviewFilter, "all"> {
  if (["accepted", "superseded", "no-candidate"].includes(item.acceptance.state)) return "history";
  if (item.acceptance.state === "needs-changes") return "feedback";
  if (item.status !== "ready" || item.stale) return "not-ready";
  return "to-test";
}

export function reviewUat(list: UatSummary[], filter: UatReviewFilter, search = "") {
  const words = search.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return list.filter(item => {
    if (filter !== "all" && uatReviewGroup(item) !== filter) return false;
    const text = [item.subject.work_id, item.subject.campaign, item.subject.title, item.summary, item.subject.delivery_ref].filter(Boolean).join(" ").toLocaleLowerCase();
    return words.every(word => text.includes(word));
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** The newest handover for a run, whatever its state. */
export function forRun(list: UatSummary[] | undefined, run_id: string): UatSummary | undefined {
  return (list ?? []).filter((item) => item.subject.run_id === run_id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
}

/**
 * The acceptance word on an Earlier-deliveries row: the handover's own state, else
 * `No candidate` for a cancelled attempt and `UAT unrecorded` for one that
 * produced something testable. Other closed outcomes have nothing to say.
 */
export function runUatLabel(run: Pick<V2RunSummary, "closed_outcome" | "application">, item?: UatSummary): string | null {
  if (item) return uatLabel(item);
  if (run.closed_outcome === "cancelled") return "No candidate";
  if (run.closed_outcome === "verified_candidate" || run.application?.state === "applied") return "UAT unrecorded";
  return null;
}

const BLOCKER_TEXT: Record<string, (detail: unknown) => string> = {
  "handover-draft": () => "Draft",
  "handover-incomplete": () => "Incomplete",
  "stale-candidate": () => "Candidate changed",
  "no-candidate": () => "No candidate",
  "required-not-passed": (detail) => `${Array.isArray(detail) ? detail.length : 1} to pass`,
  "not-available": () => "Build not confirmed",
  "feedback-unresolved": () => "Feedback open",
};
export const blockerText = (blocker: UatBlocker) => (BLOCKER_TEXT[blocker.code] ?? (() => blocker.code))(blocker.detail);

export type Position = { scenario_id: string; step: number };

export function initialPosition(handover: Pick<UatHandover, "scenarios" | "draft">): Position {
  const saved = handover.draft?.position;
  if (saved && handover.scenarios.some((scenario) => scenario.id === saved.scenario_id)) return clampPosition(handover, saved);
  const open = handover.scenarios.find((scenario) => scenario.result !== "pass") ?? handover.scenarios[0];
  return { scenario_id: open?.id ?? "", step: 0 };
}

export function clampPosition(handover: Pick<UatHandover, "scenarios">, position: Position): Position {
  const scenario = handover.scenarios.find((entry) => entry.id === position.scenario_id) ?? handover.scenarios[0];
  if (!scenario) return { scenario_id: "", step: 0 };
  return { scenario_id: scenario.id, step: Math.max(0, Math.min(scenario.steps.length - 1, position.step)) };
}

/** Back / Next across steps, then across scenarios. Null at either end. */
export function move(handover: Pick<UatHandover, "scenarios">, position: Position, direction: 1 | -1): Position | null {
  const at = handover.scenarios.findIndex((scenario) => scenario.id === position.scenario_id);
  const scenario = handover.scenarios[at];
  if (!scenario) return null;
  const step = position.step + direction;
  if (step >= 0 && step < scenario.steps.length) return { scenario_id: scenario.id, step };
  const next = handover.scenarios[at + direction];
  if (!next) return null;
  return { scenario_id: next.id, step: direction === 1 ? 0 : next.steps.length - 1 };
}

export const isLastStep = (scenario: Pick<UatScenario, "steps">, position: Position) => position.step >= scenario.steps.length - 1;

/** Fail and Blocked need the one short feedback field; Pass does not. */
export const noteRequired = (result: string) => result === "fail" || result === "blocked";

/** What the Needs-changes form starts with, from the failed scenario and step. */
export function feedbackDefaults(handover: Pick<UatHandover, "scenarios">, position: Position) {
  const scenario = handover.scenarios.find((entry) => entry.id === position.scenario_id);
  const failed = scenario && (scenario.result === "fail" || scenario.result === "blocked");
  const step = scenario?.steps[position.step];
  return {
    classification: (failed ? "bug" : "change") as "bug" | "change",
    scenario_id: scenario?.id ?? null,
    scenario_title: scenario?.title ?? null,
    step: scenario ? position.step + 1 : null,
    action: step?.action ?? "",
    expected: step?.expected ?? "",
  };
}

type Clock = number;
/** Where a saved report stands, in the receipt's own words. */
export function feedbackState(thread: UatFeedbackThread, now: Clock): { label: string; tone: "ok" | "wait" | "warn" | "done"; undo: boolean } {
  if (thread.state === "withdrawn") return { label: "Withdrawn", tone: "done", undo: false };
  if (thread.state === "dispositioned" && thread.disposition?.kind === "resolved") return { label: "Resolved", tone: "done", undo: false };
  const status = thread.import?.status ?? "saved";
  const undo = status === "saved" && now < Date.parse(thread.undoable_until);
  if (status === "imported") return { label: thread.import?.workId ? `Work ${thread.import.workId}` : "Imported", tone: "ok", undo: false };
  if (status === "importing") return { label: "Importing", tone: "wait", undo: false };
  if (status === "blocked") return { label: "Import blocked", tone: "warn", undo: false };
  if (thread.classification === "comment") return { label: "Comment saved", tone: "done", undo: false };
  return { label: "Feedback saved", tone: "wait", undo };
}

export const workHref = (thread: UatFeedbackThread) =>
  thread.import?.status === "imported" && thread.import.workId && thread.import.campaign
    ? `#/work/${encodeURIComponent(thread.import.campaign)}/${encodeURIComponent(thread.import.workId)}`
    : null;

// ---------------------------------------------------------------------------
// Durable local copies. Storage may be unavailable (private windows, blocked
// site data), so every access is guarded and the wizard works without it.
// ---------------------------------------------------------------------------

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export interface LocalDraft {
  revision: number;
  digest: string;
  position: Position;
  notes: Record<string, string>;
}
const draftKey = (id: string) => `pm-uat-draft:${id}`;

export function readLocalDraft(store: Store, handover: Pick<UatHandover, "handover_id" | "revision">): LocalDraft | null {
  return safe(() => {
    const raw = store.getItem(draftKey(handover.handover_id));
    if (!raw) return null;
    const draft = JSON.parse(raw) as LocalDraft;
    // A draft written for another revision is stale: never applied to the new one.
    return draft.revision === handover.revision ? draft : null;
  }, null);
}
export function writeLocalDraft(store: Store, handover: Pick<UatHandover, "handover_id" | "revision">, draft: Omit<LocalDraft, "revision" | "digest">) {
  safe(() => store.setItem(draftKey(handover.handover_id), JSON.stringify({ ...draft, revision: handover.revision, digest: "" })), undefined);
}
export function clearLocalDraft(store: Store, handover: Pick<UatHandover, "handover_id">) {
  safe(() => store.removeItem(draftKey(handover.handover_id)), undefined);
}
export function staleLocalDraft(store: Store, handover: Pick<UatHandover, "handover_id" | "revision">): boolean {
  return safe(() => {
    const raw = store.getItem(draftKey(handover.handover_id));
    return raw ? (JSON.parse(raw) as LocalDraft).revision !== handover.revision : false;
  }, false);
}

/** A command sent but not confirmed. The same id is reused until a receipt arrives, so a retry is never a second write. */
export interface PendingCommand {
  command_id: string;
  body: Record<string, unknown>;
}
const PENDING = "pm-uat-pending:";
const pendingKey = (handoverId: string, intent: string) => `${PENDING}${handoverId}:${intent}`;
export const readPending = (store: Pick<Storage, "getItem">, handoverId: string, intent: string): PendingCommand | null =>
  safe(() => {
    const raw = store.getItem(pendingKey(handoverId, intent));
    const value = raw ? (JSON.parse(raw) as PendingCommand) : null;
    return value?.command_id && value.body ? value : null;
  }, null);
export const writePending = (store: Store, handoverId: string, intent: string, value: PendingCommand) =>
  safe(() => store.setItem(pendingKey(handoverId, intent), JSON.stringify(value)), undefined);
export const clearPending = (store: Store, handoverId: string, intent: string) =>
  safe(() => store.removeItem(pendingKey(handoverId, intent)), undefined);
/** Every unconfirmed command this browser holds for one handover. */
export function listPending(store: Pick<Storage, "getItem" | "key" | "length">, handoverId: string): { intent: string; command: PendingCommand }[] {
  return safe(() => {
    const prefix = `${PENDING}${handoverId}:`;
    const out: { intent: string; command: PendingCommand }[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key?.startsWith(prefix)) continue;
      const intent = key.slice(prefix.length);
      const command = readPending(store, handoverId, intent);
      if (command) out.push({ intent, command });
    }
    return out;
  }, []);
}
/** A short, stable device label for receipts: browser and system, not the whole user-agent string. */
export function deviceLabel(userAgent: string): string {
  const ua = String(userAgent || "");
  const version = (pattern: RegExp) => pattern.exec(ua)?.[1];
  const browser = version(/Edg\/(\d+)/u)
    ? `Edge ${version(/Edg\/(\d+)/u)}`
    : version(/Firefox\/(\d+)/u)
      ? `Firefox ${version(/Firefox\/(\d+)/u)}`
      : version(/(?:Chrome|CriOS)\/(\d+)/u)
        ? `Chrome ${version(/(?:Chrome|CriOS)\/(\d+)/u)}`
        : version(/Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari/u)
          ? `Safari ${version(/Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari/u)}`
          : "";
  const system = /iPhone|iPad/u.test(ua) ? "iPhone" : /Android/u.test(ua) ? "Android" : /Windows/u.test(ua) ? "Windows" : /Macintosh|Mac OS X/u.test(ua) ? "Mac" : /Linux/u.test(ua) ? "Linux" : "";
  return [browser, system].filter(Boolean).join(" · ") || "Browser";
}

export const newCommandId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "c-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const statusWord = (status: UatStatus) => (status === "ready" ? "Ready" : status === "draft" ? "Draft" : "Incomplete");
