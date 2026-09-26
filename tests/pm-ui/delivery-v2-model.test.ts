import { describe, expect, it } from "vitest";
import {
  agentRows,
  branchLabel,
  costRows,
  effortsFor,
  evidenceLabel,
  executorBlockMessage,
  executorLabel,
  launchState,
  obligationLabel,
  settingsLine,
  verificationLabel,
} from "../../scripts/pm/app/v2model";
import type { V2Executor, V2Job, V2Resources } from "../../scripts/pm/app/types";

const resources = (overrides: Partial<V2Resources> = {}): V2Resources => ({
  unit: "usd",
  settled: 0,
  reserved: 0,
  unknown: [],
  openReservations: 0,
  provenance: { providerReportedUsd: null, measuredTokens: { input: 0, output: 0, total: 0 }, reconciledBilled: null, subscriptionUsage: null, availableQuota: null },
  allowance: null,
  strict: false,
  thresholdUsd: null,
  ...overrides,
});

const executor = (overrides: Partial<V2Executor> = {}): V2Executor => ({
  id: "codex",
  backend_id: "codex-exec-sdk",
  label: "Codex",
  summary: "",
  supportedEfforts: ["minimal", "low", "medium", "high", "xhigh"],
  available: true,
  permitted: true,
  qualified: true,
  refusals: [],
  qualification: { ref: "qr-1", refusals: [] },
  models: [{ id: "codex-test", label: null, efforts: ["low", "high", "max"] }],
  suggestions: {},
  ...overrides,
});

describe("delivery v2 presentation", () => {
  it("shows an unreported cost as unknown, never as zero", () => {
    const rows = costRows(resources({ unknown: [{ job_id: "j-1", reason: "no amount" }, { job_id: "j-1", reason: "open reservation" }], openReservations: 1 }));
    expect(rows.find((row) => row.label === "Estimated")!.value).toBe("Unknown");
    expect(rows.find((row) => row.label === "Unknown")!.value).toBe("1 job(s)");
    expect(rows.find((row) => row.label === "Tokens")!.value).toBe("None observed");
    expect(costRows(null)).toEqual([{ label: "Cost", value: "Unknown" }]);
  });

  it("keeps a provider estimate labelled as an estimate", () => {
    const rows = costRows(resources({ provenance: { ...resources().provenance, providerReportedUsd: 0.4321, measuredTokens: { input: 1200, output: 300, total: 1500 } } }));
    expect(rows.find((row) => row.label === "Estimated")!.value).toBe("$0.43");
    expect(rows.find((row) => row.label === "Tokens")!.value).toBe((1500).toLocaleString());
  });

  it("never offers an unqualified, unpermitted or missing executor", () => {
    expect(launchState(executor()).enabled).toBe(true);
    expect(launchState(executor({ qualified: false }))).toEqual({ enabled: false, reason: "Not qualified" });
    expect(launchState(executor({ permitted: false }))).toEqual({ enabled: false, reason: "Not permitted" });
    expect(launchState(executor({ available: false }))).toEqual({ enabled: false, reason: "Not installed" });
  });

  it("turns executor gate codes into one useful cause", () => {
    expect(
      executorBlockMessage(
        executor({
          qualified: false,
          refusals: [
            { code: "subscription-not-ready", detail: "probe failed" },
          ],
        }),
      ),
    ).toBe("Its subscription sign-in needs refreshing.");
    expect(
      executorBlockMessage(
        executor({
          qualified: false,
          refusals: [
            {
              code: "subscription-not-ready",
              detail: "subscription status unavailable (HTTP 429)",
            },
          ],
        }),
      ),
    ).toBe("Its subscription check was rate-limited.");
    expect(
      executorBlockMessage(
        executor({
          qualified: false,
          qualification: {
            ref: null,
            refusals: [
              { code: "runtime-binding-unavailable", detail: null },
            ],
          },
        }),
      ),
    ).toBe("Its Delivery worker is offline.");
  });

  it("offers only efforts the SDK accepts, narrowed by the chosen model", () => {
    expect(effortsFor(executor(), "codex-test")).toEqual(["low", "high"]);
    expect(effortsFor(executor(), "")).toEqual(["minimal", "low", "medium", "high", "xhigh"]);
  });

  it("labels zero selected tests as not tested", () => {
    expect(evidenceLabel({ state: "missing", reason: "zero-executed", label: "missing" })).toBe("Not tested");
    expect(evidenceLabel({ state: "satisfied", reason: null, label: "satisfied" })).toBe("Passed");
    expect(obligationLabel({ kind: "unresolved-resource", detail: [] })).toBe("Usage unknown");
  });

  it("shows only observed agents and says when nothing was observed", () => {
    const quiet = agentRows({ agents: [{ role: "main", id: null, executor: "claude-agent-sdk", model: null, lastAction: null, lastAt: null }] });
    expect(quiet).toHaveLength(1);
    expect(quiet[0].label).toBe("Main · Claude — no activity observed");
    const busy = agentRows({
      agents: [
        { role: "main", id: null, executor: "claude-agent-sdk", model: "m", lastAction: "Read", lastAt: null },
        { role: "subagent", id: "toolu_1", executor: "claude-agent-sdk", model: null, lastAction: "Grep", lastAt: null },
      ],
    });
    expect(busy.map((row) => row.label)).toEqual(["Main · Claude · m — Read", "Subagent · Claude — Grep"]);
  });

  it("distinguishes matched, unreported and mismatched settings", () => {
    const job = (model: string, effort: string, mismatch = false) =>
      ({
        effective: { model: null, effort: null, source: null, verification: { model: { state: model, requested: null, effective: null }, effort: { state: effort, requested: null, effective: null }, mismatch, source: null } },
      }) as unknown as V2Job;
    expect(verificationLabel(job("matched", "matched"))).toBe("Settings matched");
    expect(verificationLabel(job("unreported", "unreported"))).toBe("Settings unreported");
    expect(verificationLabel(job("mismatched", "matched", true))).toBe("Settings differ");
  });

  it("names the engine and branch plainly", () => {
    expect(executorLabel("codex-exec-sdk")).toBe("Codex");
    expect(settingsLine({ executor: "claude", model: null, effort: "high" })).toBe("Claude · Default model · high");
    expect(branchLabel("stop-requested")).toBe("Stop requested");
    expect(branchLabel(null)).toBeNull();
  });
});

describe("executor reconnect message", () => {
  it("shows the reconnect action for an expired sign-in", () => {
    expect(
      executorBlockMessage(
        executor({ qualified: false, refusals: [{ code: "subscription-not-ready", detail: "sign-in expired", action: "open Claude Code once" }] }),
      ),
    ).toBe("Reconnect needed. Open Claude Code once.");
  });

  it("names an offline worker instead of the sign-in refresh it also breaks", () => {
    // Observed 2026-09-26 with Docker stopped: both codes present, sign-in was blamed.
    expect(
      executorBlockMessage(
        executor({
          qualified: false,
          refusals: [{ code: "subscription-not-ready", detail: "could not refresh the worker sign-in", action: "open Claude Code once" }],
          qualification: { ref: null, refusals: [{ code: "runtime-binding-unavailable", detail: null }] },
        }),
      ),
    ).toBe("Its Delivery worker is offline.");
  });
});
