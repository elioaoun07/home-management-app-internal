import type { Cockpit, Entity, Setup } from "./cockpitTypes";
import { hardRules } from "./cockpitModel";

export type RuleCoverage =
  | "missing"
  | "blocked"
  | "checked"
  | "reminded"
  | "documented";

const coverageLabels: Record<RuleCoverage, string> = {
  missing: "Guard missing",
  blocked: "Blocking guard",
  checked: "Automated check",
  reminded: "Advisory guard",
  documented: "Manual review",
};

export const coverageLabel = (coverage: RuleCoverage) =>
  coverageLabels[coverage];

/** Resolve declared coverage against the mechanisms present in this snapshot. */
export function ruleCoverage(rule: Entity, setup: Setup): RuleCoverage {
  const intended = rule.enforcedBy || [];
  const guards = intended.map((id) =>
    setup.entities.find((entity) => entity.id === id),
  );
  const missing = guards.some((guard) => {
    if (!guard || guard.retired || guard.disabled) return true;
    if (!["hook", "permission", "check", "detector"].includes(guard.kind))
      return true;
    if (
      guard.enforces !== undefined &&
      (!Array.isArray(guard.enforces) || !guard.enforces.includes(rule.id))
    )
      return true;
    if (guard.kind !== "detector") return false;
    return (
      (guard.rule !== undefined && guard.rule !== rule.id) ||
      !["checked", "advisory"].includes(guard.level || "") ||
      !guard.fixtures?.length ||
      (guard.type !== undefined &&
        !["diff", "transcript"].includes(guard.type))
    );
  });
  if (missing) return "missing";
  if (rule.review?.required) return "documented";
  if (guards.some((guard) => guard?.blocking && !guard.conditional))
    return "blocked";
  if (
    guards.some(
      (guard) =>
        guard?.kind === "detector" ||
        (guard?.kind === "check" &&
          ["checked", "advisory"].includes(guard.level || "")),
    )
  )
    return "checked";
  if (rule.level === "blocked" || rule.level === "checked") return "missing";
  return guards.length ? "reminded" : "documented";
}

export function setupCoverage(setup: Setup) {
  const rules = hardRules(setup).filter((rule) => !rule.disabled);
  const counts: Record<RuleCoverage, number> = {
    missing: 0,
    blocked: 0,
    checked: 0,
    reminded: 0,
    documented: 0,
  };
  for (const rule of rules) counts[ruleCoverage(rule, setup)] += 1;
  return {
    rules,
    ...counts,
    automated: counts.blocked + counts.checked,
    manual: counts.reminded + counts.documented,
  };
}

// These headings summarize CLAUDE.md's numbered rules. The complete source
// wording remains available in each rule's evidence panel.
const hardRuleTitles: Record<string, string> = {
  "HR-1": "Undo on toasts",
  "HR-2": "Single and double click behavior",
  "HR-3": "Task and item row colors",
  "HR-4": "SVG icons",
  "HR-5": "Mobile verification",
  "HR-6": "Safe mutations and timeouts",
  "HR-7": "Verified connectivity",
  "HR-8": "Cron authentication and runtime",
  "HR-9": "Duplicate records return a conflict",
  "HR-10": "Theme updates and query refresh",
  "HR-11": "Protected UI components",
  "HR-12": "API input validation",
  "HR-13": "Household data access",
  "HR-14": "Consistent person colors",
  "HR-15": "Opaque, portaled panels",
  "HR-16": "Header spacing",
  "HR-17": "Query invalidation",
  "HR-18": "Timezone consistency",
  "HR-19": "Mobile decimal inputs",
  "HR-20": "Efficient RLS on child tables",
  "HR-21": "Bundle related reads",
  "HR-22": "Client error logging",
  "HR-23": "UI Atlas updates",
  "HR-24": "Migration and schema pairing",
  "HR-25": "PM completion evidence",
  "HR-26": "Production database write protection",
  "HR-27": "RLS evidence before visibility debugging",
  "HR-28": "Concise interface text",
  "HR-29": "Owner approval for paid API tests",
};

export function ruleTitle(rule: Entity) {
  if (hardRuleTitles[rule.id]) return hardRuleTitles[rule.id];
  const raw = rule.title || rule.name || rule.id;
  const heading = raw.match(/^(?:\s*[-+]\s+)?\*\*([^*]+)\*\*/)?.[1];
  const meaningfulHeading = heading && !/^hard rule:?$/i.test(heading);
  return (meaningfulHeading ? heading : raw)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$|[.,])/g, "$1$2")
    .replace(/^(?:#+\s*|[-+]\s+|\d+\.\s+)/, "")
    .replace(/^Hard Rule:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Conflict = Cockpit["conflicts"][number];

export function groupSetupConflicts(conflicts: Conflict[]) {
  return {
    errors: conflicts.filter((entry) => entry.severity === "error"),
    warnings: conflicts.filter(
      (entry) => !["error", "info"].includes(entry.severity),
    ),
    info: conflicts.filter((entry) => entry.severity === "info"),
  };
}

const conflictGuidance: Record<
  string,
  { title: string; action: string; command?: string }
> = {
  MIRROR: {
    title: "Generated files differ",
    action: "Regenerate the agent files",
    command: "pnpm sync:ai",
  },
  DRIFT: {
    title: "Setup snapshot needs refreshing",
    action: "Rebuild the setup snapshot",
    command: "pnpm os:scan",
  },
  PARITY: {
    title: "Agent coverage differs",
    action: "Restore the missing agent guard",
  },
  PORTABLE: {
    title: "Machine-specific configuration",
    action: "Use a repository-relative path or portable command",
  },
  DUPLICATE: {
    title: "Competing hook configurations",
    action: "Reconcile the hook definitions",
  },
  DEAD: {
    title: "Hook cannot run",
    action: "Check the hook wiring and file permissions",
  },
  "NAME-BOUND": {
    title: "Database guard has a coverage gap",
    action: "Cover each supported database tool namespace",
  },
  "SOFT-CLAIM": {
    title: "Guard coverage is limited",
    action: "Review the guard's scope and remaining manual checks",
  },
  CONTRADICTION: {
    title: "Instructions disagree",
    action: "Align the source instructions",
  },
  SHADOW: {
    title: "Overlapping instruction files",
    action: "Check which instruction file applies",
  },
  "STALE-REF": {
    title: "Reference needs updating",
    action: "Point the source to the current file",
  },
  UNLOADED: {
    title: "Agent setup is skipped",
    action: "Review the launch's instruction and skill loading",
  },
  "TRACKED-LOCAL": {
    title: "Local configuration is tracked",
    action: "Review the repository's local configuration policy",
  },
  BASELINE: {
    title: "Existing violations recorded",
    action: "Inspect the recorded detector evidence",
  },
  "FORM-MISSING": {
    title: "Guided form unavailable",
    action: "Use the skill's prompt inputs",
  },
  "FORM-DRIFT": {
    title: "Form and skill differ",
    action: "Align the form with its skill inputs",
  },
  "TIER-LITERAL": {
    title: "Model alias needs updating",
    action: "Use an active Model Registry alias",
  },
  INPUT: {
    title: "Setup source cannot be read",
    action: "Restore the required file or correct its format",
  },
};

export function conflictPresentation(conflict: Conflict) {
  const guidance = conflictGuidance[conflict.code] || {
    title: "Setup needs review",
    action: "Inspect the source and finding",
  };
  return { ...guidance, action: conflict.resolution || guidance.action };
}
