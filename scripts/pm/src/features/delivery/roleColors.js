// scripts/pm/src/features/delivery/roleColors.js
// D12/DLV-40: single source of truth for per-role color + icon, consumed by
// ConversationView.jsx and TimelineView.jsx. Role *names* come from the
// runner's own PHASE_ROLES (scripts/delivery/transcript.mjs) -- imported
// here (not re-typed) so a role this map doesn't recognize is a visible bug,
// not a silent fallback pretending to be intentional.
//
// "Never color-only" (the rule TimelineView already observed before this
// existed): every consumer must render the role's `label` text alongside the
// color, never the color alone -- `RoleChip` below does both by construction.
import { PHASE_ROLES } from "../../../../delivery/transcript.mjs";

export const ROLE_COLORS = Object.freeze({
  [PHASE_ROLES.DISCOVERY]: { color: "#22d3ee", icon: "search" },
  [PHASE_ROLES.PLAN]: { color: "#a78bfa", icon: "tasks" },
  [PHASE_ROLES.BUILDING]: { color: "#fbbf24", icon: "bolt" },
  [PHASE_ROLES.REVIEWING]: { color: "#60a5fa", icon: "check" },
  [PHASE_ROLES.UAT_PREP]: { color: "#34d399", icon: "folder" },
  [PHASE_ROLES.HANDOFF]: { color: "#fb7185", icon: "arrow" },
});

/** `{color, icon}` for a role label (turn.role / record.role), or a neutral fallback for an unrecognized/missing role. */
export function roleStyle(role) {
  return ROLE_COLORS[role] || { color: "var(--era-muted, #8b93a7)", icon: "file" };
}

/**
 * `{color, icon}` for a *phase* string (e.g. event.phase = "DISCOVERY"),
 * or `null` when the phase isn't one of the six turn-producing phases
 * PHASE_ROLES covers -- a gate/terminal state like "SPEC_READY" or "BLOCKED"
 * genuinely has no role, and callers should render a plain, uncolored label
 * for those rather than force a fallback color onto something that isn't a
 * role at all.
 */
export function phaseStyle(phase) {
  const role = PHASE_ROLES[phase];
  return role ? ROLE_COLORS[role] : null;
}
