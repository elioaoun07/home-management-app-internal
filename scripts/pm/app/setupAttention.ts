import type { Cockpit, Entity } from "./cockpitTypes";
import { groupSetupConflicts, ruleCoverage } from "./setupModel";

/** A documented judgment rule is not a broken guard. Only declared intent counts. */
export function setupAttention(
  cockpit: Pick<Cockpit, "setup" | "conflicts"> | null | undefined,
) {
  const groups = groupSetupConflicts(cockpit?.conflicts || []);
  const conflicts = [...groups.errors, ...groups.warnings];
  const entities = cockpit?.setup?.entities || [];
  const missingGuards: Entity[] = entities.filter((rule) => {
    if (rule.kind !== "rule" || rule.retired || rule.disabled) return false;
    return cockpit?.setup && ruleCoverage(rule, cockpit.setup) === "missing";
  });
  return {
    needsAttention: conflicts.length > 0 || missingGuards.length > 0,
    conflicts,
    missingGuards,
  };
}
