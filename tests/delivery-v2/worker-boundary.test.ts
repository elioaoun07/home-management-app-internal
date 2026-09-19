// Command Center Phase 3 — the container worker/checker boundary, as argv.
//
// These fixtures never start a container. They pin what the supervisor asks the
// runtime for: named volumes only, no host authority, a read-only workspace for an
// investigation, a network-less checker, and SDK records relayed without letting
// functions or controllers cross into the worker.
import { describe, expect, it } from "vitest";

import {
  BOUNDARY_REFUSALS,
  WORKDIR,
  assertNoHostAuthority,
  boundaryBindingDigest,
  checkerRunArgs,
  makeBoundaryConfig,
  sdkFromRunnerStream,
  workerRunArgs,
} from "../../scripts/delivery-v2/worker-boundary.mjs";

const boundary = makeBoundaryConfig({ image: "era-delivery-v2-worker:test" });

const mounts = (args: string[]) => args.flatMap((arg, index) => (arg === "--mount" ? [args[index + 1]] : []));
const flagValue = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe("worker argv", () => {
  const args = workerRunArgs({ boundary, run_id: "r-1", job_id: "j-1", access: "write", backend_id: "claude-agent-sdk", payload: { prompt: "x" } });

  it("runs non-root on a read-only root filesystem with no capabilities or network", () => {
    expect(flagValue(args, "--user")).toBe("10001:10001");
    expect(args).toContain("--read-only");
    expect(flagValue(args, "--cap-drop")).toBe("ALL");
    expect(flagValue(args, "--security-opt")).toBe("no-new-privileges");
    expect(flagValue(args, "--network")).toBe("none");
  });

  it("mounts named volumes only, never a host path or the docker socket", () => {
    expect(args).not.toContain("-v");
    expect(args).not.toContain("--volume");
    for (const mount of mounts(args)) {
      expect(mount).toMatch(/^type=volume,/u);
      expect(mount).not.toMatch(/docker\.sock/u);
    }
  });

  it("keeps the container after exit so its output can be reconciled", () => {
    expect(args).not.toContain("--rm");
    expect(flagValue(args, "--name")).toBe("era-v2-job-j-1");
  });

  it("mounts the workspace read-only for an investigation and writable after approval", () => {
    const readOnly = workerRunArgs({ boundary, run_id: "r-1", job_id: "j-2", access: "read-only", backend_id: "codex-exec-sdk", payload: {} });
    expect(mounts(readOnly).find((mount) => mount.includes("target=" + WORKDIR))).toMatch(/,readonly$/u);
    expect(mounts(args).find((mount) => mount.includes("target=" + WORKDIR))).not.toMatch(/readonly/u);
  });
});

describe("host authority is refused by shape", () => {
  it.each([
    [["-v", "C:\\Users\\aoune:/host"], BOUNDARY_REFUSALS.HOST_MOUNT],
    [["--mount", "type=bind,source=/,target=/host"], BOUNDARY_REFUSALS.HOST_MOUNT],
    [["--mount", "type=volume,source=x,target=/var/run/docker.sock"], BOUNDARY_REFUSALS.SOCKET],
    [["--network", "host"], BOUNDARY_REFUSALS.PRIVILEGE],
    [["--privileged"], BOUNDARY_REFUSALS.PRIVILEGE],
  ])("refuses %j", (argv, code) => {
    expect(() => assertNoHostAuthority(argv)).toThrow(code);
  });

  it("refuses a credential or dependency supplied as a host path", () => {
    expect(() => makeBoundaryConfig({ image: "x", credentials: { "claude-agent-sdk": { volume: "C:/Users/aoune/.claude" } } })).toThrow(
      BOUNDARY_REFUSALS.VOLUME,
    );
    expect(() => makeBoundaryConfig({ image: "x", dependencies: { volume: "../node_modules" } })).toThrow(BOUNDARY_REFUSALS.VOLUME);
  });

  it("requires an allowlist and an internal proxy before any egress is configured", () => {
    expect(() => makeBoundaryConfig({ image: "x", network: { mode: "bridge" } })).toThrow(BOUNDARY_REFUSALS.NETWORK);
    expect(() => makeBoundaryConfig({ image: "x", network: { mode: "allowlist-proxy", name: "era-egress", proxyUrl: "http://proxy:3128", allowHosts: [] } })).toThrow();
  });
});

describe("checker argv", () => {
  const args = checkerRunArgs({
    boundary: makeBoundaryConfig({ image: "x", network: { mode: "allowlist-proxy", name: "era-egress", proxyUrl: "http://proxy:3128", allowHosts: ["api.anthropic.com"] } }),
    name: "era-v2-check-r-1-C1-1",
    candidateVolume: "era-v2-r-1-cand-C1",
    outVolume: "era-v2-r-1-out-C1",
    argv: ["node", "test.mjs"],
    env: { CI: "1", ANTHROPIC_API_KEY: "sk-leak", NODE_ENV: "test" },
  });

  it("has no network even when the worker boundary allows provider egress", () => {
    expect(flagValue(args, "--network")).toBe("none");
    expect(args.join(" ")).not.toMatch(/HTTPS_PROXY/u);
  });

  it("reads the frozen candidate read-only and passes no credentials", () => {
    expect(mounts(args).find((mount) => mount.includes("target=/candidate"))).toMatch(/,readonly$/u);
    expect(args.join(" ")).not.toMatch(/ANTHROPIC_API_KEY/u);
    expect(args).toContain("CI=1");
  });
});

describe("binding and relay", () => {
  it("changes the binding digest when the image or the configuration changes", () => {
    const a = boundaryBindingDigest(boundary, "sha256:image-a");
    expect(boundaryBindingDigest(boundary, "sha256:image-b")).not.toBe(a);
    const proxied = makeBoundaryConfig({ image: boundary.image, network: { mode: "allowlist-proxy", name: "n", proxyUrl: "http://p:3128", allowHosts: ["h"] } });
    expect(boundaryBindingDigest(proxied, "sha256:image-a")).not.toBe(a);
  });

  it("relays runner records as the SDK messages an adapter reads, without functions or controllers", async () => {
    let seen: Record<string, unknown> | null = null;
    const sdk = sdkFromRunnerStream("claude-agent-sdk", async function* (payload: object) {
      seen = payload as Record<string, unknown>;
      yield { era: "runner-started" };
      yield { era: "sdk-message", message: { type: "system", subtype: "init", model: "model-x" } };
      yield { era: "observation", data: { effort: { level: "high" }, agent_id: null } };
      yield { era: "sdk-message", message: { type: "result", subtype: "success", is_error: false } };
    }) as { query: (input: object) => AsyncIterable<{ type: string }> };
    const controller = new AbortController();
    const types: string[] = [];
    for await (const message of sdk.query({ prompt: "p", options: { cwd: "C:/host", canUseTool: () => null, abortController: controller, hooks: {}, model: "m" } })) {
      types.push(message.type);
    }
    expect(types).toEqual(["system", "era_observation", "result"]);
    const options = (seen as unknown as { options: Record<string, unknown>; observe: { effort: boolean } }).options;
    expect(options.cwd).toBe(WORKDIR);
    expect(options).not.toHaveProperty("canUseTool");
    expect(options).not.toHaveProperty("abortController");
    expect((seen as unknown as { observe: { effort: boolean } }).observe.effort).toBe(true);
  });

  it("turns a runner error into a thrown error rather than a quiet end", async () => {
    const sdk = sdkFromRunnerStream("codex-exec-sdk", async function* () {
      yield { era: "runner-error", message: "sdk failed to load" };
    }) as { Codex: new () => { startThread: (o: object) => { runStreamed: (p: string) => Promise<{ events: AsyncIterable<unknown> }> } } };
    const thread = new sdk.Codex().startThread({});
    const streamed = await thread.runStreamed("p");
    await expect(
      (async () => {
        for await (const _event of streamed.events) void _event;
      })(),
    ).rejects.toThrow(/sdk failed to load/u);
  });
});
