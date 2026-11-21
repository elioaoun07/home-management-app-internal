import type { Cockpit, Entity } from "./cockpitTypes";

/** Uses the recorder projection; absence is zero only when recording is known. */
export function skillUse(entity: Entity, usage?: Cockpit["skillUsage"]) {
  if (!usage?.available)
    return { lastUsed: null, sessions: null, unused: false };
  const name = entity.name || entity.id.split(":").at(-1);
  const recorded = usage.skills.find((skill) => skill.name === name);
  const sessions = recorded?.sessions ?? 0;
  return {
    lastUsed: recorded?.lastUsed ?? null,
    sessions,
    unused: usage.recordedSessions >= 20 && sessions === 0,
  };
}
