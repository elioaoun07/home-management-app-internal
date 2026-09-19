// Shared fixture for Command Center Phase 4 tests: synthetic PM documents, a
// scripted Claude SDK driven through the real adapter, and a fake worker runtime
// whose checker reads only the frozen generation it is handed. Nothing here
// reaches a provider, a container, Git or a database.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect } from "vitest";

import { createJourney } from "../../../scripts/delivery-v2/journey.mjs";
import { policyTemplate } from "../../../scripts/delivery-v2/policy.mjs";
import { provisionScratch } from "../../../scripts/delivery-v2/scratch.mjs";
import { importTrustedCandidate } from "../../../scripts/delivery-v2/checks.mjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Loose = Record<string, any>;

export const PM_REL = join("ERA Notes", "10 - Project Management");
export const ROW = "- [ ] **BUD-14** quick-amount control emits 20 _(friction - S)_";
export const CHECKLIST = ["# Budget — Checklist", "", "## Now", "", ROW, ""].join("\n");
export const BOOK = [
  "# Budget — Master Book",
  "",
  "## Acceptance Criteria Index",
  "",
  "### BUD-14",
  "",
  "- **Acceptance:** the control emits 20.",
  "",
  "## Delivery session log",
  "",
  "*(Delivery runner appends dated progress bullets here automatically.)*",
  "",
].join("\n");
export const SELECT = { file: "Budget/4 - Checklist.md", cbidx: 0, expectLine: ROW, expectId: "BUD-14" };
export const BASE_AMOUNT = "export const amount = 25;\n";
export const CONFIG = "export const config = { mode: 'normal' };\n";

export const bookPathIn = (root: string) => join(root, PM_REL, "Budget", "Budget — Master Book.md");

/** Synthetic checkout: PM documents, two source files, a check script and the V2 directory. */
export function seedRoot(root: string) {
  mkdirSync(join(root, PM_REL, "Budget"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });
  mkdirSync(join(root, ".delivery", "v2"), { recursive: true });
  writeFileSync(join(root, PM_REL, "Budget", "4 - Checklist.md"), CHECKLIST, "utf8");
  writeFileSync(bookPathIn(root), BOOK, "utf8");
  writeFileSync(join(root, "src", "amount.ts"), BASE_AMOUNT, "utf8");
  writeFileSync(join(root, "src", "config.ts"), CONFIG, "utf8");
  writeFileSync(join(root, "tests", "amount.check.mjs"), "// synthetic check\n", "utf8");
}

export function writePolicy(root: string, overrides: Loose = {}) {
  const base = policyTemplate({ executor: "claude", authorized_by: "owner" }) as Loose;
  const policy = {
    ...base,
    executors: {
      ...base.executors,
      permitted: ["claude"],
      catalog: { revision: 1, models: { claude: [{ id: "claude-test", efforts: ["low"] }] }, profiles: {} },
    },
    scratchScope: { kind: "snapshot", include: ["src/amount.ts", "src/config.ts", "src/old.ts", "tests/amount.check.mjs"] },
    publicationScope: { allowedPaths: ["src"], changeConstraints: {} },
    criteria: [
      {
        criterion_id: "amount-check",
        proposition: "the control emits 20 and the configuration is sound",
        scope: { path: "src/amount.ts" },
        observer: { kind: "command", expected: { spec_id: "amount" } },
        oracle_ref: "tests/amount.check.mjs",
        freshness_inputs: ["candidate"],
        required_for: "candidate",
      },
    ],
    checks: { specs: { amount: { kind: "command", argv: ["node", "tests/amount.check.mjs"] } }, inputs: ["tests/amount.check.mjs"] },
    ...overrides,
  };
  writeFileSync(join(root, ".delivery", "v2", "execution-policy.json"), JSON.stringify(policy), "utf8");
}

const writeAmount20 = (dir: string) => writeFileSync(join(dir, "src", "amount.ts"), "export const amount = 20;\n", "utf8");

/** Scripted Claude executor and a worker runtime whose checker records every candidate it sees. */
export function makeHarness(root: string, build: (dir: string) => void = writeAmount20) {
  const h = { workspaces: new Map<string, string>(), checked: [] as Loose[], calls: [] as Loose[], runtime: {} as Loose };
  const claudeSdk = (job: Loose, dir: string) => ({
    query: ({ prompt, options }: { prompt: string; options: Loose }) =>
      (async function* () {
        h.calls.push({ job_id: String(job.job_id), access: String(job.access), prompt });
        yield { type: "system", subtype: "init", model: options.model ?? "claude-default", session_id: options.resume || options.sessionId };
        if (options.hooks) await options.hooks.PreToolUse[0].hooks[0]({ tool_name: "Read", effort: { level: options.effort ?? "high" } });
        let text = "done";
        if (prompt.startsWith("Investigate")) {
          text = "```json\n" + JSON.stringify({ outcome: "emit 20", scope: ["src/amount.ts"], steps: ["change the constant"], risks: [], unknowns: [], checks: [], questions: [] }) + "\n```";
        } else if (prompt.startsWith("Implement") && String(job.access) === "write") {
          build(dir);
        }
        yield { type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "text", text }] } };
        yield { type: "result", subtype: "success", is_error: false, result: text, total_cost_usd: 0.01, usage: { input_tokens: 10, output_tokens: 2 }, modelUsage: {} };
      })(),
  });
  h.runtime = {
    kind: "fake-worker",
    boundary: { image: "fake-worker", digest: "sha256:fake-boundary" },
    workspaceFor: ({ access }: Loose) => ({ root: "/work", backing: "fake-volume", access }),
    binding: async (backend_id: string) => ({ backend_id, sdk_version: "fixture", boundary_digest: "sha256:fake", battery_digest: "sha256:battery" }),
    provision: async ({ run_id, job, include }: Loose) => {
      let base_manifest = null;
      if (!h.workspaces.has(run_id)) {
        const dir = mkdtempSync(join(tmpdir(), "era-v2-fixture-ws-"));
        base_manifest = provisionScratch({ scratchRoot: dir, hostRoot: root, include }).supplied;
        h.workspaces.set(run_id, dir);
      }
      const dir = h.workspaces.get(run_id)!;
      return { workspace: { root: "/work", access: job.access }, base_manifest, refusals: [], importSdk: async () => claudeSdk(job, dir) };
    },
    stop: async () => ({ stopObserved: true, detail: "removed" }),
    release: async () => undefined,
    recover: async () => null,
    exportCandidate: async ({ run_id, job_id, generation, generationsRoot, base_manifest }: Loose) =>
      importTrustedCandidate({ sourceRoot: h.workspaces.get(run_id)!, generationsRoot, generation, job_id, base_manifest }).candidate,
    // The checker only ever reads the frozen generation it is handed.
    checkExecutor:
      ({ candidate }: Loose) =>
      () => {
        h.checked.push({ generation: String(candidate.generation), root: String(candidate.root) });
        const amount = readFileSync(join(candidate.root, "src", "amount.ts"), "utf8");
        const configPath = join(candidate.root, "src", "config.ts");
        const config = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
        return amount.includes("= 20;") && !config.includes("BROKEN")
          ? { exitCode: 0, stdout: "Tests  1 passed (1)", stderr: "", spawnError: null }
          : { exitCode: 1, stdout: "Tests  1 failed | 0 passed (1)", stderr: "", spawnError: null };
      },
  };
  return h;
}

/** A synthetic admitted profile: the journey is under test here, not containment. */
export const describeAdmitted = async (backend_id: string) => ({
  ok: true,
  refusal: null,
  profile: {
    profile_id: "p-" + backend_id,
    backend_id,
    qualified: true,
    qualification_ref: "qr-fixture",
    unverifiedControls: [],
    controls: ["filesystem.outsideScratchWrite", "filesystem.hostSecretRead", "store.workerAccess"].map((id) => ({ id, verified: true, state: "supported" })),
    resources: { strictBound: false, strictBoundRefusalReason: "fixture" },
  },
});

export function journeyFor({ root, data, store, harness, overrides = {} }: { root: string; data: string; store: unknown; harness: Loose; overrides?: Loose }) {
  return createJourney({
    root,
    pmRel: PM_REL,
    store: () => store,
    runtime: harness.runtime,
    describe: describeAdmitted,
    generationsRoot: join(data, "generations"),
    applicationsRoot: join(data, "applications"),
    stagingRoot: join(data, "staging"),
    ...overrides,
  }) as unknown as Loose;
}

/** Deliver and wait for the plan: a run waiting for plan review. */
export async function plannedRun(journey: Loose, command_id: string, extra: Loose = {}) {
  const delivered = await journey.deliver({ ...SELECT, executor: "claude", model: "claude-test", effort: "low", command_id, actor: "owner", ...extra });
  expect(delivered.ok).toBe(true);
  await journey.idle();
  const run_id = String(delivered.run_id);
  const plan = journey.detail(run_id).plans[0];
  return { run_id, plan };
}

/** Plan → approve → implement → protected check: a closed run with a verified candidate. */
export async function verifiedRun(journey: Loose, nextCommand: () => string, extra: Loose = {}) {
  const { run_id, plan } = await plannedRun(journey, nextCommand(), extra);
  const decided = await journey.decide({ run_id, plan_id: plan.plan_id, plan_revision: plan.revision, decision: "approve", command_id: nextCommand(), actor: "owner" });
  expect(decided.ok).toBe(true);
  await journey.idle();
  const view = journey.detail(run_id);
  expect(view.run.closed_outcome).toBe("verified_candidate");
  return { run_id, candidate_id: String(view.candidate.candidate_id), result_ref: view.result.result_id + "@" + view.result.result_version, view };
}
