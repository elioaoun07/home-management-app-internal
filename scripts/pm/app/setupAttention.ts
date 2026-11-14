import type { Cockpit, Entity } from "./cockpitTypes";

/** A documented judgment rule is not a broken guard. Only declared intent counts. */
export function setupAttention(
  cockpit: Pick<Cockpit, "setup" | "conflicts"> | null | undefined,
) {
  const conflicts = (cockpit?.conflicts || []).filter(
    (entry) => entry.severity === "error" || entry.severity === "warning",
  );
  const entities = cockpit?.setup?.entities || [];
  const active = new Map(
    entities
      .filter((entry) => !entry.retired && !entry.disabled)
      .map((entry) => [entry.id, entry]),
  );
  const missingGuards: Entity[] = entities.filter((rule) => {
    if (rule.kind !== "rule" || rule.retired || rule.disabled) return false;
    const intended = rule.enforcedBy || [];
    if (intended.length) return intended.some((id) => !active.has(id));
    return rule.level === "blocked" || rule.level === "checked";
  });
  return {
    needsAttention: conflicts.length > 0 || missingGuards.length > 0,
    conflicts,
    missingGuards,
  };
}
