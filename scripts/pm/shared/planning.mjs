// R61: durable planning facts only. Work titles, criteria, lanes and completion
// are always resolved from the canonical Markdown corpus, never copied here.
import { z } from "zod";
import { CHIP_ID_SOURCE, normalizeWorkId } from "./work-id.mjs";

export const PLANNING_SCHEMA = "pm-planning@1";
export const PLANNING_FILE = "_Planning.json";
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u);
const workId = z.string().regex(new RegExp(`^(?:${CHIP_ID_SOURCE})$`, "iu")).transform(normalizeWorkId);
const timestamp = z.string().datetime().transform((value) => new Date(value).toISOString());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine((value) => {
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
const timezone = z.string().max(100).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}, "Invalid timezone");
const origin = z.object({
  file: z.string().min(1).max(250).refine((value) => /^[^/\\]+\/4 - Checklist\.md$/u.test(value) && !value.startsWith("."), "Invalid checklist reference"),
  alias: workId,
}).strict();
export const planningMemberSchema = z.object({
  workId, origin, deliverableId: id.optional(),
  points: z.number().finite().positive().max(1000).nullable(),
  reviewMinutes: z.number().finite().min(0).max(100000).nullable(),
  estimateSource: z.enum(["effort", "override"]).optional(),
  carriedFromSprintId: id.optional(),
}).strict().refine((value) => value.workId === value.origin.alias, "Origin must name the same work identity");
const frozenMember = z.object({
  workId, origin, deliverableId: id.optional(), points: z.number().finite().positive().max(1000).nullable(),
  reviewMinutes: z.number().finite().min(0).max(100000).nullable(), estimateSource: z.enum(["effort", "override"]).optional(),
  carriedFromSprintId: id.optional(),
  criteriaRevision: z.string().min(1).max(200),
}).strict();
const scopeChange = z.object({
  at: timestamp, action: z.enum(["add", "remove", "carryover"]), workId,
  member: planningMemberSchema, fromSprintId: id.optional(),
  criteriaRevision: z.string().min(1).max(200).nullable().optional(),
}).strict();
export const sprintDraftSchema = z.object({
  id, name: z.string().trim().min(1).max(120), goal: z.string().trim().max(600),
  startDate: date, endExclusive: date, timezone,
  strategy: z.enum(["balanced", "module"]),
  capacity: z.object({ unit: z.literal("points"), available: z.number().finite().positive().max(1000), reviewMinutes: z.number().finite().min(0).max(100000) }).strict(),
  members: z.array(planningMemberSchema).max(500),
}).strict();
const sprintSchema = sprintDraftSchema.extend({
  state: z.enum(["draft", "active", "closed"]),
  commitment: z.object({ at: timestamp, goal: z.string().max(600), members: z.array(frozenMember).max(500) }).strict().nullable(),
  scopeChanges: z.array(scopeChange).max(10000),
  closed: z.object({ at: timestamp, delivered: z.array(workId), cancelled: z.array(workId), carryover: z.array(workId) }).strict().nullable(),
}).strict();
const deliverableSchema = z.object({ id, title: z.string().trim().min(1).max(120), targetDate: date.optional() }).strict();
export const planningSchema = z.object({
  schema: z.literal(PLANNING_SCHEMA), revision: z.number().int().nonnegative(),
  sprints: z.array(sprintSchema).max(500), deliverables: z.array(deliverableSchema).max(500),
  commands: z.array(z.object({ id: z.string().uuid(), hash: z.string().min(1).max(100), revision: z.number().int().positive() }).strict()).default([]),
}).strict();

export class PlanningError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
/** @returns {never} */
const refuse = (message, status = 400) => { throw new PlanningError(status, message); };
const unique = (values, message) => { if (new Set(values).size !== values.length) refuse(message); };
const memberValue = (member) => JSON.stringify([member.workId, member.origin.file, member.origin.alias, member.points, member.reviewMinutes, member.estimateSource || "effort", member.deliverableId || null, member.carriedFromSprintId || null]);

/** @returns {import("zod").infer<typeof planningSchema>} */
export function emptyPlanning() {
  return { schema: PLANNING_SCHEMA, revision: 0, sprints: [], deliverables: [], commands: [] };
}

/** Validate structural facts and the scope-history replay, including on reads. */
export function validatePlanning(input) {
  const result = planningSchema.safeParse(input);
  if (!result.success) refuse("Invalid planning data: " + result.error.issues[0].message);
  const planning = result.data;
  unique(planning.sprints.map((sprint) => sprint.id), "Duplicate sprint id");
  unique(planning.deliverables.map((entry) => entry.id), "Duplicate deliverable id");
  unique(planning.commands.map((entry) => entry.id), "Duplicate command id");
  if (planning.commands.some((entry) => entry.revision > planning.revision)) refuse("Invalid command revision");
  if (planning.sprints.filter((sprint) => sprint.state === "active").length > 1) refuse("Only one sprint can be active");
  const deliverables = new Set(planning.deliverables.map((entry) => entry.id));
  for (const sprint of planning.sprints) {
    if (sprint.endExclusive <= sprint.startDate) refuse("Sprint must end after its start");
    unique(sprint.members.map((entry) => entry.workId), "Duplicate sprint member");
    for (const member of sprint.members) {
      if (member.deliverableId && !deliverables.has(member.deliverableId)) refuse("Unknown deliverable");
      if (member.carriedFromSprintId && !planning.sprints.find((entry) => entry.id === member.carriedFromSprintId && entry.id !== sprint.id)?.closed?.carryover.includes(member.workId)) refuse("Invalid carryover reference");
    }
    if ((sprint.state === "draft") !== (sprint.commitment === null)) refuse("Sprint commitment does not match its state");
    if ((sprint.state === "closed") !== (sprint.closed !== null)) refuse("Sprint close record does not match its state");
    if (sprint.state === "draft" && sprint.scopeChanges.length) refuse("Drafts cannot have scope changes");
    if (sprint.commitment) {
      if (sprint.goal !== sprint.commitment.goal) refuse("Committed goal is frozen");
      unique(sprint.commitment.members.map((entry) => entry.workId), "Duplicate committed member");
      const scope = new Map(sprint.commitment.members.map((entry) => [entry.workId, entry]));
      let lastAt = sprint.commitment.at;
      for (const change of sprint.scopeChanges) {
        if (change.workId !== change.member.workId || change.at < lastAt || (sprint.closed && change.at > sprint.closed.at)) refuse("Invalid scope history");
        lastAt = change.at;
        if (change.action === "remove") {
          if (scope.has(change.workId) && memberValue(scope.get(change.workId)) !== memberValue(change.member)) refuse("Removal does not match frozen member");
          if (!scope.delete(change.workId)) refuse("Scope removal has no member");
        } else {
          if (scope.has(change.workId)) refuse("Duplicate scope addition");
          scope.set(change.workId, change.member);
        }
      }
      if (scope.size !== sprint.members.length || sprint.members.some((member) => !scope.has(member.workId) || memberValue(member) !== memberValue(scope.get(member.workId)))) refuse("Scope history does not match members");
    }
    if (sprint.closed) {
      if (sprint.commitment && sprint.closed.at < sprint.commitment.at) refuse("Sprint cannot close before its commitment");
      const outcomes = [...sprint.closed.delivered, ...sprint.closed.cancelled, ...sprint.closed.carryover];
      unique(outcomes, "Duplicate closed outcome");
      if (outcomes.length !== sprint.members.length || outcomes.some((entry) => !sprint.members.some((member) => member.workId === entry))) refuse("Closed outcomes must cover the sprint");
    }
  }
  return planning;
}

const baseCommand = { expectedRevision: z.number().int().nonnegative(), command_id: z.string().uuid() };
const criteriaRevisions = z.record(z.string(), z.string().min(1).max(200));
export const planningCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...baseCommand, action: z.literal("save"), sprint: sprintDraftSchema, deliverables: z.array(deliverableSchema).optional() }).strict(),
  z.object({ ...baseCommand, action: z.literal("save-many"), sprints: z.array(sprintDraftSchema).max(52), replaceDraftIds: z.array(id).max(52).optional(), deliverables: z.array(deliverableSchema).optional() }).strict(),
  z.object({ ...baseCommand, action: z.literal("delete-draft"), sprintId: id }).strict(),
  z.object({ ...baseCommand, action: z.literal("start"), sprintId: id, criteriaRevisions }).strict(),
  z.object({ ...baseCommand, action: z.literal("close"), sprintId: id, carryover: z.array(workId).max(500).optional(), carryoverTo: id.optional() }).strict(),
  z.object({ ...baseCommand, action: z.literal("add-member"), sprintId: id, member: planningMemberSchema, criteriaRevisions }).strict(),
  z.object({ ...baseCommand, action: z.literal("remove-member"), sprintId: id, workId }).strict(),
  z.object({ ...baseCommand, action: z.literal("restore-member"), sprintId: id, workId }).strict(),
  z.object({ ...baseCommand, action: z.literal("carryover"), fromSprintId: id, sprintId: id, workIds: z.array(workId).min(1).max(500), criteriaRevisions: criteriaRevisions.optional() }).strict(),
]);

function currentMember(member, facts) {
  const fact = facts[member.workId];
  if (!fact || fact.status !== "open" || fact.file !== member.origin.file) refuse("Work reference is no longer open: " + member.workId, 409);
  return fact;
}

function frozenMembers(members, facts, expectedCriteria, selectedIds = members.map((member) => member.workId)) {
  const selected = new Set(selectedIds);
  return members.map((member) => {
    const fact = currentMember(member, facts);
    if (!fact.criteriaRevision) refuse("Acceptance required: " + member.workId, 409);
    if (expectedCriteria?.[member.workId] !== fact.criteriaRevision) refuse("Acceptance changed. Refresh before committing " + member.workId, 409);
    // Unknown estimates remain unknown in the commitment; they are planning aids.
    if (fact.effort === "L" && (member.estimateSource !== "override" || member.points === null)) refuse("Split or estimate large work: " + member.workId, 409);
    const blockers = fact.reasons.filter((reason) => !(reason.code === "dependency-open" && selected.has(reason.with)) && !(reason.code === "size-needs-split" && member.estimateSource === "override"));
    if (blockers.length) refuse("Needs input: " + member.workId + " (" + blockers[0].code + ")", 409);
    return { ...member, criteriaRevision: fact.criteriaRevision };
  });
}

/** Pure transition; CAS and all validation happen before the caller writes bytes.
 * Command hashes are supplied by the Node persistence seam, never the browser.
 * Planning membership never invokes a Delivery worker or grants dispatch rights.
 */
export function applyPlanningCommand(input, rawCommand, { facts = {}, now = new Date().toISOString(), hash = "test" } = {}) {
  const planning = validatePlanning(input);
  const parsed = planningCommandSchema.safeParse(rawCommand);
  if (!parsed.success) refuse("Invalid planning command: " + parsed.error.issues[0].message);
  const command = parsed.data;
  const replay = planning.commands.find((entry) => entry.id === command.command_id);
  if (replay) {
    if (replay.hash !== hash) refuse("Command id reused with different content", 409);
    return planning;
  }
  if (planning.revision !== command.expectedRevision) refuse("Sprint plan changed. Refresh and retry.", 409);
  const next = structuredClone(planning);
  let sprint = next.sprints.find((entry) => entry.id === command.sprintId);
  if (command.action === "save" || command.action === "save-many") {
    const drafts = command.action === "save" ? [command.sprint] : command.sprints;
    const replaced = command.action === "save-many" ? command.replaceDraftIds || [] : [];
    if (!drafts.length && !replaced.length) refuse("Choose drafts to save or replace");
    unique(replaced, "Duplicate replacement sprint");
    for (const key of replaced) {
      if (next.sprints.find((entry) => entry.id === key)?.state !== "draft") refuse("Replacement target is no longer a draft: " + key, 409);
    }
    next.sprints = next.sprints.filter((entry) => !replaced.includes(entry.id));
    unique(drafts.map((entry) => entry.id), "Duplicate sprint id");
    for (const draft of drafts) {
      const existing = next.sprints.find((entry) => entry.id === draft.id);
      if (existing && existing.state !== "draft") refuse("Started scope is frozen; use scope changes", 409);
      for (const member of draft.members) currentMember(member, facts);
      const replacement = { ...draft, state: "draft", commitment: null, scopeChanges: [], closed: null };
      if (existing) next.sprints[next.sprints.indexOf(existing)] = replacement;
      else next.sprints.push(replacement);
    }
    if (command.deliverables) next.deliverables = command.deliverables;
  } else {
    if (!sprint) refuse("Sprint not found", 404);
    if (command.action === "delete-draft") {
      if (sprint.state !== "draft") refuse("Only drafts can be removed", 409);
      next.sprints = next.sprints.filter((entry) => entry.id !== sprint.id);
    } else if (command.action === "start") {
      if (sprint.state !== "draft" || next.sprints.some((entry) => entry.state === "active")) refuse("Only one sprint can be active", 409);
      if (!sprint.members.length) refuse("Add work before starting", 409);
      sprint.commitment = { at: now, goal: sprint.goal, members: frozenMembers(sprint.members, facts, command.criteriaRevisions) };
      sprint.state = "active";
    } else if (command.action === "close") {
      if (sprint.state !== "active") refuse("Only an active sprint can close", 409);
      sprint.state = "closed";
      sprint.closed = { at: now, delivered: [], cancelled: [], carryover: [] };
      for (const member of sprint.members) {
        const status = facts[member.workId]?.status;
        sprint.closed[status === "completed" ? "delivered" : status === "cancelled" ? "cancelled" : "carryover"].push(member.workId);
      }
      if ((command.carryover !== undefined) !== (command.carryoverTo !== undefined)) refuse("Choose carryover items and a target together");
      if (command.carryoverTo) {
        const target = next.sprints.find((entry) => entry.id === command.carryoverTo);
        if (!target || target.state !== "draft" || target.id === sprint.id) refuse("Carryover target must be another draft", 409);
        unique(command.carryover, "Duplicate carryover member");
        for (const key of command.carryover) {
          if (!sprint.closed.carryover.includes(key)) refuse("Item is not unfinished: " + key, 409);
          if (target.members.some((entry) => entry.workId === key)) refuse("Work is already in the target sprint", 409);
          const member = sprint.members.find((entry) => entry.workId === key);
          currentMember(member, facts);
          target.members.push({ ...member, carriedFromSprintId: sprint.id });
        }
      }
    } else if (command.action === "restore-member") {
      if (sprint.state !== "active") refuse("Only active sprint removals can be restored", 409);
      const removal = sprint.scopeChanges.at(-1);
      if (removal?.action !== "remove" || removal.workId !== command.workId) refuse("Latest scope change is not this member's removal", 409);
      const previousAddition = sprint.scopeChanges.slice(0, -1).reverse().find((change) => change.workId === command.workId && change.action !== "remove");
      const criteriaRevision = previousAddition ? previousAddition.criteriaRevision : sprint.commitment.members.find((member) => member.workId === command.workId)?.criteriaRevision;
      if (!criteriaRevision) refuse("Removed member has no recorded criteria witness", 409);
      // Restore the exact recorded scope, even when the current work is held,
      // completed or missing. This reverses removal without approving new work.
      sprint.members.push(removal.member);
      sprint.scopeChanges.push({ at: now, action: "add", workId: command.workId, member: removal.member, criteriaRevision });
    } else {
      if (sprint.state === "closed") refuse("Closed sprint scope is frozen", 409);
      const remove = command.action === "remove-member";
      let additions = command.action === "add-member" ? [command.member] : [];
      if (command.action === "carryover") {
        const previous = next.sprints.find((entry) => entry.id === command.fromSprintId);
        if (!previous?.closed || previous.id === sprint.id) refuse("Carryover needs a closed source sprint", 409);
        unique(command.workIds, "Duplicate carryover member");
        additions = command.workIds.map((key) => {
          if (!previous.closed.carryover.includes(key)) refuse("Item is not carryover: " + key, 409);
          return { ...previous.members.find((member) => member.workId === key), carriedFromSprintId: previous.id };
        });
      }
      if (remove) {
        const member = sprint.members.find((entry) => entry.workId === command.workId);
        if (!member) refuse("Sprint member not found", 404);
        sprint.members = sprint.members.filter((entry) => entry.workId !== command.workId);
        if (sprint.state === "active") sprint.scopeChanges.push({ at: now, action: "remove", workId: member.workId, member });
      } else {
        for (const member of additions) {
          currentMember(member, facts);
          if (sprint.members.some((entry) => entry.workId === member.workId)) refuse("Work is already in the sprint", 409);
        }
        if (sprint.state === "active") frozenMembers(additions, facts, command.criteriaRevisions, [...sprint.members, ...additions].map((member) => member.workId));
        for (const member of additions) {
          sprint.members.push(member);
          if (sprint.state === "active") sprint.scopeChanges.push({ at: now, action: command.action === "carryover" ? "carryover" : "add", workId: member.workId, member, criteriaRevision: facts[member.workId]?.criteriaRevision || null, ...(command.action === "carryover" ? { fromSprintId: command.fromSprintId } : {}) });
        }
      }
    }
  }
  next.revision++;
  next.commands.push({ id: command.command_id, hash, revision: next.revision });
  return validatePlanning(next);
}
