// DLV-133 — the checker's typecheck seam, as argv and as a staging decision.
//
// No container starts here. What is pinned: the argv the checker runs (the
// image's runner, never the policy's or the candidate's), the second read-only
// mount carrying the pinned program, the content-addressed program volume, and
// the refusals that keep a checker without a compiler from producing a verdict
// at all. The daemon-backed version lives in worker-boundary.docker.test.ts.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CANDIDATE_PATH,
  PROGRAM_PATH,
  TYPECHECK_RUNNER_PATH,
  createContainerRuntime,
  makeBoundaryConfig,
  programVolumeName,
  typecheckArgv,
} from "../../scripts/delivery-v2/worker-boundary.mjs";

const mounts = (args: string[]) => args.flatMap((arg, index) => (arg === "--mount" ? [args[index + 1]] : []));
const flagValue = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe("typecheckArgv", () => {
  it("runs the image's own runner over the pinned program, with no candidate in the baseline", async () => {
    const baseline = typecheckArgv({ phase: "baseline", changed: ["src/a.ts"], deleted: ["src/b.ts"] });
    expect(baseline).toEqual(["node", TYPECHECK_RUNNER_PATH, "--root", PROGRAM_PATH]);
  });

  it("lays the frozen candidate over that same program for the candidate phase", async () => {
    expect(typecheckArgv({ phase: "candidate", changed: ["src/a.ts", "src/b.ts"], deleted: ["src/c.ts"] })).toEqual([
      "node",
      TYPECHECK_RUNNER_PATH,
      "--root",
      PROGRAM_PATH,
      "--candidate",
      CANDIDATE_PATH,
      "--changed",
      "src/a.ts,src/b.ts",
      "--deleted",
      "src/c.ts",
    ]);
  });

  it("names a program volume from its manifest, so the same source reuses it and a changed one does not", async () => {
    expect(programVolumeName("sha256:" + "a".repeat(64))).toBe(programVolumeName("sha256:" + "a".repeat(64)));
    expect(programVolumeName("sha256:" + "a".repeat(64))).not.toBe(programVolumeName("sha256:" + "b".repeat(64)));
    expect(programVolumeName("sha256:" + "a".repeat(64))).toMatch(/^era-v2-program-[a-f0-9]{32}$/u);
  });
});

// ---------------------------------------------------------------------------
// The runtime, with a scripted docker
// ---------------------------------------------------------------------------

/**
 * A docker double that records argv and answers `inspect` from a set of things
 * that exist. Nothing is spawned; `cp` and `run` succeed unless scripted to fail.
 */
function fakeDocker({ existing = new Set<string>(), probe = { status: 0, stdout: JSON.stringify({ typescript: "5.9.2", node: "v22.0.0" }), stderr: "" } } = {}) {
  const calls: string[][] = [];
  return {
    calls,
    run(args: string[]) {
      calls.push([...args]);
      if (args[0] === "volume" && args[1] === "inspect") return { status: existing.has(args[2]) ? 0 : 1, stdout: "", stderr: "", error: null };
      if (args[0] === "container" && args[1] === "inspect") return { status: 1, stdout: "", stderr: "", error: null };
      if (args[0] === "volume" && args[1] === "create") {
        existing.add(args[2]);
        return { status: 0, stdout: "", stderr: "", error: null };
      }
      // The dependency probe is the only `run` whose output is read.
      if (args.includes("-e") && args.join(" ").includes("require('typescript')")) return { ...probe, error: null };
      return { status: 0, stdout: "", stderr: "", error: null };
    },
    lines() {
      throw new Error("no streaming in this fixture");
    },
  };
}

let HOST: string;
let WORK: string;

beforeEach(() => {
  HOST = mkdtempSync(join(tmpdir(), "era-tsc-host-"));
  WORK = mkdtempSync(join(tmpdir(), "era-tsc-work-"));
  mkdirSync(join(HOST, "src"), { recursive: true });
  writeFileSync(join(HOST, "tsconfig.json"), "{}", "utf8");
  writeFileSync(join(HOST, "src", "a.ts"), "export const a = 1;\n", "utf8");
});

afterEach(() => {
  for (const dir of [HOST, WORK]) rmSync(dir, { recursive: true, force: true });
});

const candidate = { root: "", candidate_id: "cand-1", generation: "C1" };

function runtimeWith(docker: ReturnType<typeof fakeDocker>, dependencies: { volume: string } | null = { volume: "era-dlv107-dependencies" }) {
  const boundary = makeBoundaryConfig({ image: "era-delivery-v2-worker:test", dependencies });
  return createContainerRuntime({ boundary, hostRoot: HOST, workRoot: WORK, docker: docker as never });
}

describe("typecheckExecutor", () => {
  const withCandidate = () => {
    const root = mkdtempSync(join(tmpdir(), "era-tsc-cand-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a.ts"), "export const a = 2;\n", "utf8");
    return { ...candidate, root };
  };

  it("stages the pinned program into a content-addressed read-only volume and mounts it beside the candidate", async () => {
    const docker = fakeDocker();
    const offered = await runtimeWith(docker).typecheckExecutor({ run_id: "r-1", candidate: withCandidate(), include: ["tsconfig.json", "src/a.ts"] });
    expect(offered.ok).toBe(true);
    expect(offered.program!.files).toBe(2);
    expect(offered.program!.volume).toMatch(/^era-v2-program-[a-f0-9]{32}$/u);

    await offered.execute!({ phase: "candidate", changed: ["src/a.ts"], deleted: [] });
    const run = docker.calls.find((args) => args.includes(TYPECHECK_RUNNER_PATH));
    expect(run).toBeDefined();
    const args = run as string[];
    expect(mounts(args).find((mount) => mount.includes("target=" + PROGRAM_PATH))).toMatch(/,readonly$/u);
    expect(mounts(args).find((mount) => mount.includes("target=" + CANDIDATE_PATH))).toMatch(/,readonly$/u);
    expect(mounts(args).find((mount) => mount.includes("target=/deps"))).toMatch(/,readonly$/u);
    expect(flagValue(args, "--network")).toBe("none");
    expect(flagValue(args, "--workdir")).toBe(PROGRAM_PATH);
    expect(args).toContain("--read-only");
    // The runner is the image's copy: a candidate cannot ship the thing that
    // decides whether it compiled.
    expect(args.slice(args.indexOf("node"))).toEqual(["node", TYPECHECK_RUNNER_PATH, "--root", PROGRAM_PATH, "--candidate", CANDIDATE_PATH, "--changed", "src/a.ts"]);
  });

  it("reuses the volume for an unchanged program and stages a new one when the source moves", async () => {
    const existing = new Set<string>();
    const first = await runtimeWith(fakeDocker({ existing })).typecheckExecutor({ run_id: "r-1", candidate: withCandidate(), include: ["tsconfig.json", "src/a.ts"] });
    const again = await runtimeWith(fakeDocker({ existing })).typecheckExecutor({ run_id: "r-2", candidate: withCandidate(), include: ["tsconfig.json", "src/a.ts"] });
    expect(again.program!.volume).toBe(first.program!.volume);

    writeFileSync(join(HOST, "src", "a.ts"), "export const a = 99;\n", "utf8");
    const moved = await runtimeWith(fakeDocker({ existing })).typecheckExecutor({ run_id: "r-3", candidate: withCandidate(), include: ["tsconfig.json", "src/a.ts"] });
    expect(moved.program!.volume).not.toBe(first.program!.volume);
  });

  it("refuses rather than compiling when the dependency volume has no typescript", async () => {
    const docker = fakeDocker({ probe: { status: 1, stdout: "", stderr: "Cannot find module 'typescript'" } });
    const offered = await runtimeWith(docker).typecheckExecutor({ run_id: "r-1", candidate: withCandidate(), include: ["tsconfig.json", "src/a.ts"] });
    expect(offered.ok).toBe(false);
    expect(offered.reason).toMatch(/era-dlv107-dependencies/u);
    expect(offered.reason).toMatch(/does not resolve typescript/u);
  });

  it("refuses a boundary that mounts no dependency volume at all", async () => {
    const offered = await runtimeWith(fakeDocker(), null).typecheckExecutor({ run_id: "r-1", candidate: withCandidate(), include: ["tsconfig.json"] });
    expect(offered.ok).toBe(false);
    expect(offered.reason).toMatch(/no dependency volume/u);
  });

  it("refuses an empty program instead of compiling nothing and calling it clean", async () => {
    const offered = await runtimeWith(fakeDocker()).typecheckExecutor({ run_id: "r-1", candidate: withCandidate(), include: [] });
    expect(offered.ok).toBe(false);
    expect(offered.reason).toMatch(/no program file list/u);
  });

  it("reports the checker's environment in the shape the verdict records", async () => {
    const offered = await runtimeWith(fakeDocker()).typecheckExecutor({ run_id: "r-1", candidate: withCandidate(), include: ["tsconfig.json", "src/a.ts"] });
    expect(offered.producer!).toMatchObject({
      producer: "protected-checker",
      isolated: true,
      image: "era-delivery-v2-worker:test",
      dependencies: { volume: "era-dlv107-dependencies", typescript: "5.9.2" },
    });
    expect(offered.producer!.program).toMatchObject({ root: PROGRAM_PATH, config: "tsconfig.json", files: 2 });
  });
});
