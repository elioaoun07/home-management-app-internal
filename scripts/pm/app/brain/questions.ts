import type { LocalActivityEvent } from "../localRunActivityModel";
import { localRunFailure } from "../localRunFailure";
import type { LocalLiveness } from "../localRunLiveness";
import { localRunLabel } from "../localRunModel";
import type { LocalScene } from "../localRunScene";
import type { ZoneId } from "../stage/config";
import { roomCassette, roomRows, roomZone } from "../transferRoomModel";
import { zoneNames } from "./layout";
import type { Signal } from "./protocol";

export type Question = "status" | "where" | "wrong" | "cause" | "changed" | "actor" | "checks" | "phase" | "milestone" | "owner";
export type Context = { zone: ZoneId | null; row: LocalActivityEvent | null };
export type Evidence = { label: string; row?: LocalActivityEvent; zone?: ZoneId | "all" };
export type Answer = { text: string; evidence: Evidence[]; at: number; replay: boolean; label: string };
export const questionLabels: Record<Question, string> = {
  status: "What’s the status?", where: "Where are we now?", wrong: "What went wrong?",
  changed: "What changed?", actor: "Who did this?", checks: "Which checks ran?",
  phase: "Did we finish this phase?", milestone: "Did we finish phase 1?",
  cause: "Why was it cancelled?", owner: "What needs me?",
};
export const questions = Object.keys(questionLabels) as Question[];
export const questionsForPhase = (phase: string) => questions.filter(q => q !== "cause" || phase === "cancelled");

export function suggestions(context: Context, phase: string): Question[] {
  if (context.zone === "verify") return ["checks", "wrong", "phase"];
  if (context.row?.kind === "edit") return ["changed", "actor", "where"];
  if (phase === "cancelled" || phase === "failed") return ["wrong", "where", "status"];
  if (context.zone) return ["phase", "where", "status"];
  return ["status", "where", "owner"];
}

const evidence = (row: LocalActivityEvent): Evidence => ({ label: row.paths[0] ?? row.label, row });
const zoneLink = (zone: ZoneId | "all", label?: string): Evidence => ({ zone, label: label ?? (zone === "all" ? "All actions" : zoneNames[zone]) });
const asCount = (count: number, label: string) => `${count} ${label}${count === 1 ? "" : "s"}`;
function cancellation(row: LocalActivityEvent) { return /^cancelled$/iu.test(row.summary.trim()); }

export function answerQuestion(
  question: Question, context: Context, scene: LocalScene, health: LocalLiveness, replay: boolean,
  pendingOwner: boolean,
): Answer {
  const { run, phase, latest, events } = scene;
  const row = context.row ?? latest;
  const cancelling = events.findLast(cancellation);
  const lastWork = phase === "cancelled" ? events.findLast(event => !cancellation(event)) : latest;
  const make = (text: string, refs: Evidence[] = []): Answer => ({
    text, evidence: refs, at: scene.at, replay,
    label: question === "wrong" && phase === "cancelled" ? "Where did it stop?" :
      question === "changed" && context.row?.kind === "edit" ? "What changed here?" : questionLabels[question],
  });
  if (question === "status") {
    const status = !replay && health.state === "link-down" ? `Last observed: ${localRunLabel(run)}.` : `${localRunLabel(run)}.`;
    return make(status, latest ? [evidence(latest)] : []);
  }
  if (question === "where") {
    if (!row) return make("There’s no observed action at this moment.", [zoneLink("brief")]);
    const station = roomZone(row);
    return make(`${replay ? "At this moment: " : ""}${station ? zoneNames[station] + " · " : ""}${row.label}${row.paths[0] || row.detail ? " · " + (row.paths[0] ?? row.detail) : ""}`, [evidence(row)]);
  }
  if (question === "wrong" || question === "cause") {
    if (phase === "cancelled") {
      const why = run.failure?.detail.trim() || run.error?.trim();
      const detail = why && !/^cancelled[.!]?$/iu.test(why) ? why.slice(0,320) : "The recording gives no reason for the cancellation.";
      return make(question === "cause" ? detail : `Cancelled.${lastWork ? " Last recorded work: " + lastWork.summary.split(/\r?\n/u)[0].slice(0,240) + "." : ""} ${detail}`,
        [lastWork, cancelling].flatMap(item => item ? [evidence(item)] : []));
    }
    const check = run.checks.find(item => item.exit !== 0 || item.error);
    if (check) return make(`${check.name} · ${check.error || check.exit === null ? "Inconclusive" : "Failed"}`, [zoneLink("verify")]);
    const failure = localRunFailure(run);
    if (failure) return make(failure.title, [zoneLink("all", "Error details")]);
    if (phase === "failed" || run.interrupted) return make("The run stopped. No reason was recorded.", latest ? [evidence(latest)] : []);
    return make("No failure is recorded at this moment.");
  }
  if (question === "changed") {
    if (context.row?.kind === "edit") {
      const edit = context.row;
      return make(edit.paths.length ? `Edit recorded for ${edit.paths.join(", ")}.` : "An edit was recorded without a path.", [evidence(edit)]);
    }
    const edits = events.filter(item => item.kind === "edit");
    return make(edits.length ? `${asCount(edits.length,"edit")} in the retained recording.` : "No edit in the retained recording.",
      edits.length ? [zoneLink("build"), ...edits.slice(-3).reverse().map(evidence)] : [zoneLink("build")]);
  }
  if (question === "actor") {
    if (!row) return make("No action selected.");
    const name = row.agent?.id ?? row.agent?.executor ?? row.agent?.role;
    return make(name ? `Recorded actor: ${name}.` : "Actor not recorded.", [evidence(row)]);
  }
  if (question === "checks") {
    const checks = run.checks.map(item => `${item.name} · ${item.error || item.exit === null ? "Inconclusive" : item.exit === 0 ? "Passed" : "Failed"}`);
    const started = events.some(item => item.label !== "Tool requested" && item.summary === "Host checks started");
    return make(checks.length ? checks.join(" · ") : started ? "Host verification started. No result is visible at this moment." : "No host check result in the retained recording.", [zoneLink("verify")]);
  }
  if (question === "milestone") {
    const matches = [...(run.work.brief ?? "").matchAll(/^#{1,6}\s+(?:phase|milestone)\s+1(?:\s*[:.—–-]\s*([^\r\n]+))?\s*$/gimu)];
    const brief = zoneLink("brief");
    if (matches.length !== 1) return make(matches.length ? "The brief names more than one phase 1. Open it to choose the milestone." :
      "There’s no uniquely named phase 1 in the frozen brief. Choose a delivery phase or open the brief.", [brief]);
    const title = matches[0][1]?.trim() || "Phase 1";
    return make(`${title} · Completion unconfirmed in the retained recording.`, [brief]);
  }
  if (question === "phase") {
    const zone = context.zone;
    if (!zone) return make("Choose a phase. For a numbered milestone, open the frozen brief and match its named completion evidence.", [zoneLink("brief")]);
    const rows = roomRows(scene, zone);
    if (zone === "brief") return make(run.work.brief ? "The frozen plan is available. It records the work brief." : "Plan not recorded.", [zoneLink(zone)]);
    const done =
      zone === "ship" && phase === "shipped" ||
      zone === "setup" && events.some(item => item.label !== "Tool requested" && item.summary === "Native session started") ||
      zone === "handover" && roomCassette(scene) === "received" ||
      zone === "test" && scene.objectivesAccepted;
    return make(done ? `${zoneNames[zone]} · Finished.` : rows.length ? `${zoneNames[zone]} · Activity recorded. Completion unconfirmed.` : `${zoneNames[zone]} · No retained activity. Completion unconfirmed.`,
      rows.length ? [zoneLink(zone), evidence(rows.at(-1)!)] : [zoneLink(zone)]);
  }
  if (!replay && pendingOwner) return make("There’s an open question from the delivery agent.");
  if (roomCassette(scene) === "received") return make("The work is ready for owner testing.", [zoneLink("handover")]);
  return make(replay ? "Check Live for current requests." : "No open request for you at this moment.");
}

export function signalFor(scene: LocalScene): Signal | null {
  const row = scene.latest;
  if (!row || row.label === "Tool requested") return null;
  const zone = roomZone(row);
  const special: Record<string, Signal["kind"]> = {
    "Installing dependencies": "setup", "Native session started": "setup", "Host checks started": "start-check",
    "Committing candidate": "seal",
    "Ready for owner UAT": "handover", "Owner shipped merge": "ship", "Owner reverted merge": "revert",
  };
  if (Object.hasOwn(special, row.summary) && row.kind === "event") {
    const kind = special[row.summary];
    const location = { setup: "setup", seal: "seal", "start-check": "verify", handover: "handover", ship: "ship", revert: "ship" } as const;
    return { id: row.id, zone: location[kind as keyof typeof location], kind };
  }
  if (row.kind === "check") {
    const check = scene.run.checks.find(item => item.name === row.detail);
    return check ? { id: row.id, zone: "verify", kind: "check", result: check.error || check.exit === null ? "inconclusive" : check.exit === 0 ? "passed" : "failed" } : null;
  }
  return zone && ["edit","read","command","message","failure"].includes(row.kind)
    ? { id: row.id, zone, kind: row.kind as Signal["kind"] } : null;
}
