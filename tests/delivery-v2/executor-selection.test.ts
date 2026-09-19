// PM Delivery V2 — fixtures for two selectable executors and the execution policy.
//
// Written from the refusal side, like the rest of this suite: the interesting
// assertion is almost always that something is NOT substituted, NOT permitted and
// NOT qualified.
//
// The two properties every case here defends:
//
//   1. **No silent provider switch.** Not on an unknown id, not on a missing
//      selection, not on an SDK that will not load, not on a per-request override,
//      not on reconciliation of a job that belongs to the other backend.
//   2. **Qualification is independent per executor.** Adding a second backend must
//      not let either one inherit the other's status, and must not open a path
//      where a configuration file can overrule a containment observation.
//
// Two of these read an installed SDK's type surface directly. That is deliberate
// and matches backend-profile.test.ts: an assertion like "this interface offers
// no monetary ceiling" only stays true if a fixture re-reads the interface and
// fails when the vendor adds one.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BACKEND_IDS,
  EXECUTORS,
  EXECUTOR_REFUSALS,
  admitExecutorProfile,
  createExecutor,
  describeExecutor,
  listExecutors,
  resolveExecutorChoice,
} from "../../scripts/delivery-v2/adapters/registry.mjs";
import {
  BACKEND_ID as CLAUDE_BACKEND_ID,
  CLAUDE_SDK_SURFACE,
  buildLifecycle,
  buildSessionOptions,
  deriveNativeSessionId,
  describeProfile as describeClaudeProfile,
  mergeUsageReadings,
  normalizeClaudeUsage,
} from "../../scripts/delivery-v2/adapters/claude.mjs";
import { admitProfile } from "../../scripts/delivery-v2/adapters/adapter.mjs";
import {
  EXECUTION_POLICY_SCHEMA,
  GRANTABLE_EFFECTS,
  POLICY_REFUSALS,
  buildDeliver,
  dispositionWithinCeiling,
  executorPermitted,
  loadExecutionPolicy,
  policyTemplate,
  resolveWorkFile,
  validateExecutionPolicy,
} from "../../scripts/delivery-v2/policy.mjs";
import {
  readExecutorSelection,
  setExecutorSelection,
  routeDeliveryV2,
} from "../../scripts/delivery-v2/entry.mjs";
import { runQualification } from "../../scripts/delivery-v2/probes/claude-qualification.mjs";
import { openStore } from "../../scripts/delivery-v2/store.mjs";
import { CSRF_HEADER, SESSION_COOKIE, issuePairingCode, pairSession, sessionView } from "../../scripts/delivery-v2/local-auth.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "era-v2-exec-"));
  mkdirSync(join(root, ".delivery", "v2"), { recursive: true });
  return root;
}

describe("executor registry — resolution never falls back", () => {
  it("resolves both short ids and both canonical backend ids", () => {
    expect(resolveExecutorChoice("claude")?.backend_id).toBe("claude-agent-sdk");
    expect(resolveExecutorChoice("codex")?.backend_id).toBe("codex-exec-sdk");
    expect(resolveExecutorChoice("claude-agent-sdk")?.id).toBe("claude");
    expect(resolveExecutorChoice("codex-exec-sdk")?.id).toBe("codex");
  });

  it("returns null for an unknown executor rather than a default", () => {
    for (const value of ["gpt", "gemini", "", null, undefined, 0]) {
      expect(resolveExecutorChoice(value as unknown as string)).toBeNull();
    }
  });

  it("refuses to build an adapter with no selection, and names no substitute", async () => {
    const built = await createExecutor(null);
    expect(built.ok).toBe(false);
    expect(built.adapter).toBeNull();
    expect(built.refusal?.code).toBe(EXECUTOR_REFUSALS.NONE_SELECTED);
  });

  it("refuses an unknown executor without loading anything", async () => {
    const built = await createExecutor("gpt");
    expect(built.ok).toBe(false);
    expect(built.refusal?.code).toBe(EXECUTOR_REFUSALS.UNKNOWN);
  });

  it("builds each backend behind the same six-operation boundary", async () => {
    for (const entry of EXECUTORS) {
      const built = await createExecutor(entry.id);
      expect(built.ok).toBe(true);
      expect((built.adapter as { backend_id: string }).backend_id).toBe(entry.backend_id);
      for (const op of ["describeProfile", "start", "inspect", "resume", "stop", "exportCandidate"]) {
        expect(typeof (built.adapter as Record<string, unknown>)[op]).toBe("function");
      }
    }
  });

  it("lists exactly the two known backends and no more", () => {
    expect(BACKEND_IDS).toEqual(["codex-exec-sdk", "claude-agent-sdk"]);
    expect(listExecutors().map((entry) => entry.id)).toEqual(["codex", "claude"]);
  });
});

describe("qualification is independent per executor", () => {
  it("leaves both profiles unqualified, for their own reasons", async () => {
    const codex = await describeExecutor("codex");
    const claude = await describeExecutor("claude");
    expect(codex.profile?.qualified).toBe(false);
    expect(claude.profile?.qualified).toBe(false);
    // Different profile ids: neither can stand in for the other in a Grant's
    // permitted_executors list.
    expect(codex.profile?.profile_id).not.toBe(claude.profile?.profile_id);
  });

  it("carries the backend on an admission so it cannot authorize the other one", async () => {
    const claude = await describeExecutor("claude");
    const admission = admitExecutorProfile(claude.profile);
    expect(admission.backend_id).toBe("claude-agent-sdk");
    expect(admission.admitted).toBe(false);
  });

  it("refuses the Claude profile on unproven confinement, not on Codex's findings", () => {
    const admission = admitProfile(describeClaudeProfile());
    expect(admission.admitted).toBe(false);
    const codes = admission.refusals.map((entry) => entry.code);
    expect(codes).toContain("profile-unqualified");
    expect(codes).toContain("confinement-unproven");
  });

  it("records no containment observation for a backend nobody probed", () => {
    const record = runQualification({ repoRoot });
    // The whole point: `controls: null` means nothing was observed, which is not
    // the same as everything having failed and not the same as nothing tried.
    expect(record.controls).toBeNull();
    expect(record.backend_id).toBe(CLAUDE_BACKEND_ID);
    expect(record.limitations.join(" ")).toMatch(/No containment control was observed/u);
  });

  it("keeps the platform sandbox documentation finding out of the control states", () => {
    const record = runQualification({ repoRoot });
    expect(record.documentationFindings[0].status).toMatch(/not.*conformance result/u);
    const profile = describeClaudeProfile();
    for (const id of ["network.egress", "filesystem.hostSecretRead", "store.workerAccess"]) {
      const control = profile.controls.find((entry) => entry.id === id);
      expect(control?.state).toBe("unknown");
      expect(control?.verified).toBe(false);
    }
  });
});

describe("claude adapter — interface findings are re-read, not asserted", () => {
  const dts = readFileSync(
    join(repoRoot, "node_modules", "@anthropic-ai", "claude-agent-sdk", "sdk.d.ts"),
    "utf8",
  );

  it("still offers a caller-minted sessionId, which the reconciliation rests on", () => {
    expect(dts).toMatch(/\n\s*sessionId\?: string;/u);
    expect(CLAUDE_SDK_SURFACE.callerMintedSessionId).toBe(true);
    expect(buildLifecycle().inspectByDispatchKey).toBe("derived");
  });

  it("still reports a cost and still offers no ceiling", () => {
    expect(dts).toContain("total_cost_usd");
    expect(dts).not.toMatch(/\n\s*(maxCostUsd|costLimit|budgetUsd|spendLimit)\??:/u);
    expect(CLAUDE_SDK_SURFACE.monetaryCeilingOption).toBeNull();
    // Reading a cost is not bounding it: a strict monetary promise stays refused.
    expect(describeClaudeProfile().resources.strictBound).toBe(false);
  });

  it("derives a stable v4-shaped session id from the dispatch key", () => {
    const first = deriveNativeSessionId("j-abc");
    expect(first).toBe(deriveNativeSessionId("j-abc"));
    expect(first).not.toBe(deriveNativeSessionId("j-abd"));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });

  it("never emits bypassPermissions and always requests a fail-loud sandbox", () => {
    const options = buildSessionOptions({ workspaceRoot: "C:/scratch/job" });
    expect(options.permissionMode).toBe("acceptEdits");
    expect(options.sandbox).toEqual({ enabled: true, failIfUnavailable: true });
    expect(options.strictMcpConfig).toBe(true);
    expect(options.settingSources).toEqual([]);
    expect(options.skills).toEqual([]);
    expect(options.disallowedTools).toContain("mcp__*");
  });

  it("hard-restricts the toolset for a review dispatch", () => {
    const options = buildSessionOptions({ workspaceRoot: "C:/scratch/job", mode: "review" });
    expect(options.tools).toEqual(["Read", "Grep", "Glob"]);
    expect(options.disallowedTools).toEqual(["Write", "Edit", "Bash", "NotebookEdit", "mcp__*"]);
    expect(options.permissionMode).toBe("default");
  });

  it("reads a missing cost as unknown rather than as free", () => {
    const usage = normalizeClaudeUsage({ usage: { input_tokens: 10, output_tokens: 2 } });
    expect(usage.costUsd).toBeNull();
    expect(usage.basis).toMatch(/unknown, not zero/u);
  });

  it("does not double-count a turn observed twice, and treats a decrease as a reset", () => {
    const reading = { turn: 0, usage: normalizeClaudeUsage({ total_cost_usd: 0.4, usage: { input_tokens: 100 } }) };
    expect(mergeUsageReadings([reading, reading]).costUsd).toBeCloseTo(0.4, 8);
    const shrunk = { turn: 0, usage: normalizeClaudeUsage({ total_cost_usd: 0.1, usage: { input_tokens: 1 } }) };
    const merged = mergeUsageReadings([reading, shrunk]);
    expect(merged.input).toBe(100);
    expect(merged.resets).toHaveLength(1);
  });
});

describe("executor selection — persisted, explicit, never defaulted", () => {
  it("reports no executor when nothing has been chosen", () => {
    const root = tempRoot();
    try {
      const selection = readExecutorSelection({ root });
      expect(selection.backend_id).toBeNull();
      expect(selection.note).toMatch(/no executor has been selected/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("persists a choice and reads it back after a restart", () => {
    const root = tempRoot();
    try {
      const written = setExecutorSelection({ root, choice: "claude", actor: "elio" });
      expect(written.ok).toBe(true);
      // A fresh read models the restart: nothing is cached in this module.
      expect(readExecutorSelection({ root }).backend_id).toBe("claude-agent-sdk");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses an unknown executor and an unattributed change", () => {
    const root = tempRoot();
    try {
      expect(setExecutorSelection({ root, choice: "gpt", actor: "elio" }).ok).toBe(false);
      expect(setExecutorSelection({ root, choice: "claude", actor: "" }).ok).toBe(false);
      expect(readExecutorSelection({ root }).backend_id).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("treats a corrupt or unrecognised selection file as no selection, never as the other provider", () => {
    const root = tempRoot();
    try {
      writeFileSync(join(root, ".delivery", "v2", "executor.json"), "{not json", "utf8");
      expect(readExecutorSelection({ root }).backend_id).toBeNull();
      writeFileSync(
        join(root, ".delivery", "v2", "executor.json"),
        JSON.stringify({ backend_id: "gpt-5-sdk" }),
        "utf8",
      );
      const selection = readExecutorSelection({ root });
      expect(selection.backend_id).toBeNull();
      expect(selection.note).toMatch(/no substitute is chosen/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("execution policy — a document, with structural refusals", () => {
  it("accepts the conservative template", () => {
    const validated = validateExecutionPolicy(policyTemplate({ executor: "codex", authorized_by: "elio" }));
    expect(validated.ok).toBe(true);
    const policy = validated.policy as { executors: { permitted: string[] }; execution: { retryAutomatically: boolean } };
    expect(policy.executors.permitted).toEqual(["codex-exec-sdk"]);
    expect(policy.execution.retryAutomatically).toBe(false);
  });

  it("cannot grant publish at this schema version", () => {
    expect(GRANTABLE_EFFECTS).not.toContain("publish");
    const template = policyTemplate({ authorized_by: "elio" });
    const validated = validateExecutionPolicy({
      ...template,
      grant: { ...template.grant, permitted_effects: [...template.grant.permitted_effects, "publish"] },
    });
    expect(validated.ok).toBe(false);
    expect(validated.refusals[0].code).toBe(POLICY_REFUSALS.WEAKENED);
  });

  it("cannot turn off the containment or qualification requirement", () => {
    const template = policyTemplate({ authorized_by: "elio" });
    for (const field of ["requireConfinement", "requireQualifiedProfile"]) {
      const validated = validateExecutionPolicy({
        ...template,
        executors: { ...template.executors, [field]: false },
      });
      expect(validated.ok).toBe(false);
      expect(validated.refusals[0].code).toBe(POLICY_REFUSALS.WEAKENED);
    }
  });

  it("cannot enable automatic retry of a possibly-dispatched job", () => {
    const template = policyTemplate({ authorized_by: "elio" });
    const validated = validateExecutionPolicy({
      ...template,
      execution: { ...template.execution, retryAutomatically: true },
    });
    expect(validated.ok).toBe(false);
    expect(validated.refusals[0].code).toBe(POLICY_REFUSALS.WEAKENED);
  });

  it("refuses a strict allowance with nothing to enforce", () => {
    const template = policyTemplate({ authorized_by: "elio" });
    const validated = validateExecutionPolicy({
      ...template,
      resources: { ...template.resources, strict: true, allowance: null },
    });
    expect(validated.ok).toBe(false);
  });

  it("refuses a policy naming an unknown executor", () => {
    const template = policyTemplate({ authorized_by: "elio" });
    const validated = validateExecutionPolicy({
      ...template,
      executors: { ...template.executors, permitted: ["gpt"] },
    });
    expect(validated.ok).toBe(false);
  });

  it("refuses an unrecognised schema rather than migrating it", () => {
    const validated = validateExecutionPolicy({ ...policyTemplate({}), schema: "delivery-v2/execution-policy@0" });
    expect(validated.ok).toBe(false);
    expect(validated.refusals[0].code).toBe(POLICY_REFUSALS.SCHEMA);
    expect(EXECUTION_POLICY_SCHEMA).toBe("delivery-v2/execution-policy@1");
  });

  it("reports an absent policy as the normal unconfigured state", () => {
    const root = tempRoot();
    try {
      const loaded = loadExecutionPolicy({ root });
      expect(loaded.ok).toBe(false);
      expect(loaded.refusals[0].code).toBe(POLICY_REFUSALS.ABSENT);
      // Which is exactly what keeps the deliver route refusing.
      expect(buildDeliver({ root, pmRel: ".", store: {} as never })).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a requested disposition above the ceiling instead of downgrading it", () => {
    const policy = validateExecutionPolicy(policyTemplate({ authorized_by: "elio" })).policy!;
    expect(dispositionWithinCeiling(policy, "verified_candidate").ok).toBe(true);
    const refused = dispositionWithinCeiling(policy, "verified_deployment");
    expect(refused.ok).toBe(false);
    expect(refused.detail).toMatch(/not downgraded silently/u);
  });

  it("permits only the executors it names", () => {
    const policy = validateExecutionPolicy(policyTemplate({ executor: "codex", authorized_by: "elio" })).policy!;
    expect(executorPermitted(policy, "codex-exec-sdk")).toBe(true);
    expect(executorPermitted(policy, "claude-agent-sdk")).toBe(false);
  });

  it("refuses a work file that escapes the project-management root", () => {
    const escape = resolveWorkFile({ root: "C:/repo", pmRel: "ERA Notes/10 - PM", file: "../../../.env" });
    expect(escape.ok).toBe(false);
    expect(resolveWorkFile({ root: "C:/repo", pmRel: "ERA Notes/10 - PM", file: "Delivery/4 - Checklist.md" }).ok).toBe(
      true,
    );
  });
});

describe("the deliver route — one path, explicit provider per run", () => {
  const PM_REL = join("ERA Notes", "10 - Project Management");
  let headers: Record<string, string> = {};
  const pair = (root: string) => {
    const { code } = issuePairingCode({ root });
    const paired = pairSession({ root, code });
    const cookie = SESSION_COOKIE + "=" + paired.token;
    headers = { "sec-fetch-site": "same-origin", cookie, [CSRF_HEADER]: String(sessionView({ root, headers: { cookie } }).csrf) };
  };

  function installation() {
    const root = tempRoot();
    mkdirSync(join(root, PM_REL, "Delivery"), { recursive: true });
    writeFileSync(
      join(root, PM_REL, "Delivery", "4 - Checklist.md"),
      "# Delivery\n\n## Now\n\n- [ ] **DLV-99** a selectable row _(friction - S)_\n",
      "utf8",
    );
    writeFileSync(
      join(root, ".delivery", "v2", "dispatch-mode.json"),
      JSON.stringify({ mode: "v2", actor: "elio" }),
      "utf8",
    );
    pair(root);
    return root;
  }

  it("refuses to dispatch a run that names no executor, even with an old installation selection", async () => {
    const root = installation();
    try {
      setExecutorSelection({ root, choice: "claude", actor: "elio" });
      const response = await routeDeliveryV2(
        { method: "POST", path: "/api/delivery/v2/deliver", headers, body: {} },
        { root, store: {}, deliver: async () => ({ ok: true }) },
      );
      expect(response?.status).toBe(409);
      expect(response?.json.error).toBe(EXECUTOR_REFUSALS.NONE_SELECTED);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses an unknown executor instead of resolving it to the other one", async () => {
    const root = installation();
    try {
      const response = await routeDeliveryV2(
        { method: "POST", path: "/api/delivery/v2/deliver", headers, body: { executor: "gpt" } },
        { root, store: {}, deliver: async () => ({ ok: true }) },
      );
      expect(response?.status).toBe(409);
      expect(response?.json.error).toBe(EXECUTOR_REFUSALS.UNKNOWN);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("hands the run's own executor to the policy layer; the retired selection file is ignored", async () => {
    const root = installation();
    try {
      setExecutorSelection({ root, choice: "claude", actor: "elio" });
      let seen: string | null = null;
      await routeDeliveryV2(
        { method: "POST", path: "/api/delivery/v2/deliver", headers, body: { executor: "codex" } },
        {
          root,
          store: {},
          deliver: async (request: { executor: string }) => {
            seen = request.executor;
            return { ok: true };
          },
        },
      );
      expect(seen).toBe("codex-exec-sdk");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses an effort the chosen executor does not accept, before touching the store", async () => {
    const root = installation();
    try {
      writeFileSync(
        join(root, ".delivery", "v2", "execution-policy.json"),
        JSON.stringify({ ...policyTemplate({ executor: "codex", authorized_by: "elio" }), executors: { ...policyTemplate({ executor: "codex" }).executors, permitted: ["codex", "claude"] } }),
        "utf8",
      );
      const deliver = buildDeliver({
        root,
        pmRel: PM_REL,
        store: () => {
          throw new Error("the store must not be opened for refused settings");
        },
      })!;
      const codexMax = await deliver({ actor: "elio", executor: "codex", effort: "max", file: "Delivery/4 - Checklist.md", cbidx: 0 });
      expect(codexMax.ok).toBe(false);
      expect(JSON.stringify(codexMax.refusals)).toMatch(/unsupported-effort/u);
      const claudeMinimal = await deliver({ actor: "elio", executor: "claude", effort: "minimal", file: "Delivery/4 - Checklist.md", cbidx: 0 });
      expect(JSON.stringify(claudeMinimal.refusals)).toMatch(/unsupported-effort/u);
      const unlisted = await deliver({ actor: "elio", executor: "claude", model: "a-model-nobody-listed", file: "Delivery/4 - Checklist.md", cbidx: 0 });
      expect(JSON.stringify(unlisted.refusals)).toMatch(/model-not-in-catalog/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("re-reads both installed SDKs so the offered efforts never outrun them", () => {
    const claudeDts = readFileSync(join(repoRoot, "node_modules", "@anthropic-ai", "claude-agent-sdk", "sdk.d.ts"), "utf8");
    expect(claudeDts).toMatch(/export declare type EffortLevel = 'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max';/u);
    expect(EXECUTORS.find((entry) => entry.id === "claude")!.supportedEfforts).toEqual(["low", "medium", "high", "xhigh", "max"]);
    const codexDts = readFileSync(join(repoRoot, "node_modules", "@openai", "codex-sdk", "dist", "index.d.ts"), "utf8");
    expect(codexDts).toMatch(/type ModelReasoningEffort = "minimal" \| "low" \| "medium" \| "high" \| "xhigh";/u);
    expect(EXECUTORS.find((entry) => entry.id === "codex")!.supportedEfforts).toEqual(["minimal", "low", "medium", "high", "xhigh"]);
  });

  it("still refuses when a policy is installed but the profile is unqualified", async () => {
    const root = installation();
    try {
      setExecutorSelection({ root, choice: "claude", actor: "elio" });
      writeFileSync(
        join(root, ".delivery", "v2", "execution-policy.json"),
        JSON.stringify(policyTemplate({ executor: "claude", authorized_by: "elio" })),
        "utf8",
      );
      const deliver = buildDeliver({ root, pmRel: PM_REL, store: {} as never })!;
      expect(deliver).toBeTypeOf("function");
      const outcome = await deliver({
        actor: "elio",
        executor: "claude-agent-sdk",
        file: "Delivery/4 - Checklist.md",
        cbidx: 0,
        workspace: { root: join(root, "scratch"), backing: "scratch-snapshot" },
      });
      // The containment gate, reached through a fully wired path. Installing a
      // policy lifts the policy refusal and nothing else.
      expect(outcome.ok).toBe(false);
      expect(outcome.refusals.map((entry: { code: string }) => entry.code)).toContain("profile-not-admitted");
      expect(outcome.executor).toBe("claude-agent-sdk");
      expect(outcome.dispatched).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("freezes the witnessed row and its Master Book revision, never the row now at the ordinal", async () => {
    const root = installation();
    try {
      setExecutorSelection({ root, choice: "claude", actor: "elio" });
      writeFileSync(
        join(root, ".delivery", "v2", "execution-policy.json"),
        JSON.stringify(policyTemplate({ executor: "claude", authorized_by: "elio" })),
        "utf8",
      );
      const selected = "- [ ] **DLV-99** a selectable row _(friction - S)_";
      // DLV-98 was prepended after the click, so ordinal 0 now names it.
      writeFileSync(
        join(root, PM_REL, "Delivery", "4 - Checklist.md"),
        "# Delivery\n\n## Now\n\n- [ ] **DLV-98** inserted above _(friction - S)_\n" + selected + "\n",
        "utf8",
      );
      writeFileSync(
        join(root, PM_REL, "Delivery", "Delivery — Master Book.md"),
        "## Acceptance Criteria Index\n\n### DLV-99\n\n- **Acceptance:** one admitted pilot.\n",
        "utf8",
      );
      // A synthetic admitted profile: this fixture exercises selection, not containment.
      const profile = {
        profile_id: "p-synthetic",
        backend_id: "claude-agent-sdk",
        qualified: true,
        unverifiedControls: [],
        controls: ["filesystem.outsideScratchWrite", "filesystem.hostSecretRead", "store.workerAccess"].map((id) => ({
          id,
          verified: true,
          state: "supported",
        })),
        resources: { strictBound: false, strictBoundRefusalReason: null },
      };
      const describeExecutor = async () => ({ ok: true, profile });
      const request = {
        actor: "elio",
        executor: "claude-agent-sdk",
        file: "Delivery/4 - Checklist.md",
        cbidx: 0,
        workspace: { root: join(root, "scratch"), backing: "scratch-snapshot" },
      };

      const blind = await buildDeliver({
        root,
        pmRel: PM_REL,
        describeExecutor,
        store: () => {
          throw new Error("the store must not be opened for a witness-less selection");
        },
      })!(request);
      expect(blind.ok).toBe(false);
      expect(blind.refusals).toEqual([{ code: "selection-refused", detail: "missing-selection-witness" }]);

      const store = openStore({ path: join(root, ".delivery", "v2", "supervisor.sqlite") });
      try {
        const outcome = (await buildDeliver({ root, pmRel: PM_REL, describeExecutor, store })!({
          ...request,
          expectLine: selected,
          expectId: "DLV-99",
        })) as {
          workRef?: { alias?: string };
          contract?: { acceptance_fingerprint?: string | null };
          dispatched?: boolean;
        };
        expect(outcome.workRef?.alias).toBe("DLV-99");
        expect(outcome.contract?.acceptance_fingerprint).toMatch(/^sha256:/u);
        expect(store.listWorkRefs().map((ref: { alias: unknown }) => String(ref.alias))).toEqual(["DLV-99"]);
        expect(outcome.dispatched).toBe(false);
      } finally {
        store.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses the executor the policy does not permit, before touching the store", async () => {
    const root = installation();
    try {
      setExecutorSelection({ root, choice: "claude", actor: "elio" });
      writeFileSync(
        join(root, ".delivery", "v2", "execution-policy.json"),
        JSON.stringify(policyTemplate({ executor: "codex", authorized_by: "elio" })),
        "utf8",
      );
      const deliver = buildDeliver({
        root,
        pmRel: PM_REL,
        store: () => {
          throw new Error("the store must not be opened for a policy-refused executor");
        },
      })!;
      const outcome = await deliver({
        actor: "elio",
        executor: "claude-agent-sdk",
        file: "Delivery/4 - Checklist.md",
        cbidx: 0,
      });
      expect(outcome.ok).toBe(false);
      expect(outcome.refusals[0].code).toBe(POLICY_REFUSALS.EXECUTOR_NOT_PERMITTED);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
