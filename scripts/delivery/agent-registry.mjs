// scripts/delivery/agent-registry.mjs
// Central agent registry — the single source of truth for the Agent Catalog,
// classifier capability definitions, launch capability preview, session
// agent-output cards, phase availability, and blocking/advisory metadata.
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/3 - State Machine, Packet & Classifier.md §4.
//
// Zero-dependency pure data module — no imports, no fs, no child_process.

/**
 * @typedef {"primary"|"inline"|"independent-readonly"|"runner-native"} ExecutionMode
 * @typedef {"blocking"|"advisory"|"—"} BlockingLevel
 * @typedef {"read-only"|"implementation-capable"} Access
 * @typedef {"enabled"|"planned"} AgentStatus
 * @typedef {"phase1"|"S5"|"S6"} AgentPhase
 */

export const REQUIRED_FIELDS = Object.freeze([
  "key",
  "name",
  "purpose",
  "executionMode",
  "trigger",
  "inputs",
  "outputs",
  "blocking",
  "access",
  "providers",
  "status",
  "phase",
]);

/** Full roster, rows 1-15, doc 3 §4. Order matches the doc table. */
export const AGENT_REGISTRY = Object.freeze([
  Object.freeze({
    key: "delivery-orchestrator",
    name: "Delivery Orchestrator",
    purpose: "Owns the work item end-to-end across every phase on the single primary thread.",
    executionMode: "primary",
    trigger: "always-on",
    inputs: "packet + artifacts",
    outputs: "all phase artifacts",
    blocking: "—",
    access: "implementation-capable",
    providers: Object.freeze(["codex", "claude"]),
    status: "enabled",
    phase: "phase1",
  }),
  Object.freeze({
    key: "product-ba-refinement",
    name: "Product/BA Analyst",
    purpose: "Sharpens vague work items into verifiable spec questions before the spec gate.",
    executionMode: "inline",
    trigger: "vague item (< 8 words, no verifiable outcome)",
    inputs: "packet + campaign files 1-3",
    outputs: "sharper spec questions inside spec.md",
    blocking: "advisory",
    access: "read-only",
    providers: Object.freeze(["codex", "claude"]),
    status: "enabled",
    phase: "phase1",
  }),
  Object.freeze({
    key: "frontend-impl",
    name: "Frontend Implementer",
    purpose: "Implements UI/component/feature changes with ui-guardrails and cache-invalidation injected.",
    executionMode: "inline",
    trigger: "globs src/app/**, src/components/**, src/features/** (non-api)",
    inputs: "plan + skills",
    outputs: "working-tree edits",
    blocking: "—",
    access: "implementation-capable",
    providers: Object.freeze(["codex", "claude"]),
    status: "enabled",
    phase: "phase1",
  }),
  Object.freeze({
    key: "backend-impl",
    name: "Backend Implementer",
    purpose: "Implements API route / server-side changes with api-route skill injected.",
    executionMode: "inline",
    trigger: "globs src/app/api/**; /api|route|endpoint|cron/i",
    inputs: "plan + skills",
    outputs: "working-tree edits",
    blocking: "—",
    access: "implementation-capable",
    providers: Object.freeze(["codex", "claude"]),
    status: "enabled",
    phase: "phase1",
  }),
  Object.freeze({
    key: "automated-testing",
    name: "Test Engineer",
    purpose: "Writes tests inline on the orchestrator thread; the validation harness itself is runner-native.",
    executionMode: "runner-native",
    trigger: "always-on",
    inputs: "plan test step",
    outputs: "test files + validation.json",
    blocking: "blocking",
    access: "implementation-capable",
    providers: Object.freeze(["codex", "claude"]),
    status: "enabled",
    phase: "phase1",
  }),
  Object.freeze({
    key: "code-review",
    name: "Code Reviewer (lite)",
    purpose: "Self-review turn on the primary thread against the finish-task DoD checklist.",
    executionMode: "inline",
    trigger: "always-on",
    inputs: "diff + spec",
    outputs: "review-self.md verdict",
    blocking: "blocking",
    access: "read-only",
    providers: Object.freeze(["codex", "claude"]),
    status: "enabled",
    phase: "phase1",
  }),
  Object.freeze({
    key: "uat-generation",
    name: "UAT Author",
    purpose: "Assembles the manual UAT package from all prior phase artifacts.",
    executionMode: "inline",
    trigger: "always-on",
    inputs: "all artifacts",
    outputs: "uat/** package",
    blocking: "blocking",
    access: "read-only",
    providers: Object.freeze(["codex", "claude"]),
    status: "enabled",
    phase: "phase1",
  }),
  Object.freeze({
    key: "money-domain",
    name: "Domain skill injection (Money)",
    purpose: "Injects the money-rules skill into orchestrator prompts for financial-correctness items.",
    executionMode: "inline",
    trigger: "campaign = Budget; /balance|amount|transaction|transfer|debt|allocat/i",
    inputs: "skills + spec",
    outputs: "before/after balance example required in spec/plan",
    blocking: "blocking",
    access: "read-only",
    providers: Object.freeze(["codex", "claude"]),
    status: "enabled",
    phase: "phase1",
  }),
  Object.freeze({
    key: "code-review-full",
    name: "Full Code Reviewer",
    purpose: "Independent read-only thread replacing the lite verdict with a full finish-task DoD pass.",
    executionMode: "independent-readonly",
    trigger: "always-on (replaces lite verdict as the gate check)",
    inputs: "diff + spec",
    outputs: "review-code.md verdict",
    blocking: "blocking",
    access: "read-only",
    providers: Object.freeze(["codex", "claude"]),
    status: "planned",
    phase: "S5",
  }),
  Object.freeze({
    key: "money-domain-review",
    name: "Domain Guardian (Money)",
    purpose: "Independent review checklist thread for financial-correctness invariants.",
    executionMode: "independent-readonly",
    trigger: "campaign = Budget; /balance|amount|transaction|transfer|debt|allocat/i",
    inputs: "skills + spec + diff",
    outputs: "domain findings in review",
    blocking: "blocking",
    access: "read-only",
    providers: Object.freeze(["codex", "claude"]),
    status: "planned",
    phase: "S5",
  }),
  Object.freeze({
    key: "ux-review",
    name: "UX Reviewer",
    purpose: "Independent read-only thread reviewing UI paths in the diff against ui-guardrails.",
    executionMode: "independent-readonly",
    trigger: "UI paths in the diff",
    inputs: "diff + spec + ui-guardrails",
    outputs: "review-ux.md",
    blocking: "blocking",
    access: "read-only",
    providers: Object.freeze(["codex", "claude"]),
    status: "planned",
    phase: "S5",
  }),
  Object.freeze({
    key: "architecture-review",
    name: "Architecture Reviewer",
    purpose: "Independent read-only thread reviewing plan.md for large or cross-cutting changes.",
    executionMode: "independent-readonly",
    trigger: "≥ 3 top-level src/* areas, ≥ 5 new files, or /refactor|restructur/i",
    inputs: "plan.md",
    outputs: "review-architecture.md (shown at plan gate)",
    blocking: "advisory",
    access: "read-only",
    providers: Object.freeze(["codex", "claude"]),
    status: "planned",
    phase: "S5",
  }),
  Object.freeze({
    key: "db-migration-review",
    name: "DB / Migration Reviewer",
    purpose: "Independent read-only thread checking migration pairing and RLS/schema safety.",
    executionMode: "independent-readonly",
    trigger: "/migration|schema|rls|policy|sql|column|index/i or migrations/ in affected paths",
    inputs: "diff + db-migration skill + HR24",
    outputs: "review-db.md + plan-gate risk flag",
    blocking: "blocking",
    access: "read-only",
    providers: Object.freeze(["codex", "claude"]),
    status: "planned",
    phase: "S5",
  }),
  Object.freeze({
    key: "security-review",
    name: "Security Reviewer",
    purpose: "Independent read-only thread checking auth/token/RLS/household boundaries.",
    executionMode: "independent-readonly",
    trigger:
      "/auth|token|secret|password|permission|rls|household|encrypt/i or supabase/middleware/api-auth paths",
    inputs: "diff + spec",
    outputs: "review-security.md + risk flag",
    blocking: "blocking",
    access: "read-only",
    providers: Object.freeze(["codex", "claude"]),
    status: "planned",
    phase: "S5",
  }),
  Object.freeze({
    key: "release-rollback-prep",
    name: "Release Engineer",
    purpose: "Prepares release notes and a deepened rollback runbook; ship mode only.",
    executionMode: "independent-readonly",
    trigger: "mode = \"ship\"",
    inputs: "uat + plan",
    outputs: "release-notes.md + deepened rollback.md (display-only commands)",
    blocking: "blocking in ship mode",
    access: "read-only",
    providers: Object.freeze(["codex", "claude"]),
    status: "planned",
    phase: "S6",
  }),
]);

/** Product Phase 1 = the standard set (rows 1-8), all `status:"enabled"`. */
export const PHASE1_STANDARD_KEYS = Object.freeze(
  AGENT_REGISTRY.filter((a) => a.phase === "phase1").map((a) => a.key),
);

export class AgentRegistryError extends Error {}

/** Look up one registry row by capability key, or null. */
export function getAgent(key) {
  return AGENT_REGISTRY.find((a) => a.key === key) || null;
}

/** All rows with the given `status` ("enabled" | "planned"). */
export function listByStatus(status) {
  return AGENT_REGISTRY.filter((a) => a.status === status);
}

/** All rows with the given `phase` ("phase1" | "S5" | "S6"). */
export function listByPhase(phase) {
  return AGENT_REGISTRY.filter((a) => a.phase === phase);
}

/** True when the given capability key is enabled for the current MVP (Phase 1). */
export function isEnabledForPhase1(key) {
  const agent = getAgent(key);
  return !!agent && agent.status === "enabled" && agent.phase === "phase1";
}

/**
 * Verify registry completeness and consistency invariants (doc 6 §2):
 *  - every row has every required field, non-empty
 *  - no duplicate keys
 *  - exactly the Phase-1 standard set (rows 1-8) has status:"enabled"
 *  - every later specialist (S5/S6) has status:"planned"
 * Throws AgentRegistryError with a descriptive message on the first violation found.
 * @param {object[]} [registry] - defaults to the real AGENT_REGISTRY; a test double may be
 *   passed in to exercise the failure paths without mutating the real roster.
 */
export function assertRegistryIntegrity(registry = AGENT_REGISTRY) {
  const seen = new Set();
  for (const agent of registry) {
    for (const field of REQUIRED_FIELDS) {
      const value = agent[field];
      if (value === undefined || value === null || value === "") {
        throw new AgentRegistryError(
          `agent "${agent.key || "?"}" is missing required field "${field}"`,
        );
      }
    }
    if (seen.has(agent.key)) {
      throw new AgentRegistryError(`duplicate agent key: ${agent.key}`);
    }
    seen.add(agent.key);

    if (agent.phase === "phase1" && agent.status !== "enabled") {
      throw new AgentRegistryError(
        `phase1 agent "${agent.key}" must have status "enabled", got "${agent.status}"`,
      );
    }
    if (agent.phase !== "phase1" && agent.status !== "planned") {
      throw new AgentRegistryError(
        `non-phase1 agent "${agent.key}" (${agent.phase}) must have status "planned", got "${agent.status}"`,
      );
    }
  }
  return true;
}
