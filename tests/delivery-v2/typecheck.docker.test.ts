// DLV-133 — the deterministic typecheck, actually inside the checker container.
//
// Opt-in, because it needs a Docker daemon and builds an image:
//   ERA_V2_DOCKER=1 pnpm exec vitest run tests/delivery-v2/typecheck.docker.test.ts
//
// `typecheck-isolation.test.ts` covers the pinning, the argv and the overlay
// without a daemon. What only this file can establish is that the whole thing
// runs where DLV-133 says it runs: a pinned program in a read-only volume, a
// pinned `typescript` in the dependency volume, no network, a read-only root
// filesystem, and a candidate laid over the program by the image's own runner.
//
// It exercises the same pair as the deterministic fixtures — one deliberate
// failure (candidate C1's `supabaseAdmin.from`, Investigation F8) and one
// passing control — so a green run here and a green run there are the same
// claim made at two different levels of isolation.
//
// The dependency volume is built from this checkout's own `node_modules/typescript`,
// which is what "pinned" means here: the checker compiles with the exact compiler
// the repo resolves, not whatever a container image happened to install.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { freezeCandidate } from "../../scripts/delivery-v2/candidate.mjs";
import { TYPECHECK_PRODUCERS, TYPECHECK_STATE, programFileList, runTypecheckVerification } from "../../scripts/delivery-v2/typecheck.mjs";
import { createContainerRuntime, makeBoundaryConfig } from "../../scripts/delivery-v2/worker-boundary.mjs";

const enabled = process.env.ERA_V2_DOCKER === "1";
const IMAGE = "era-delivery-v2-tsc:phase3";
const DEPS = "era-v2-tsc-deps-" + String(process.pid);
const RUN = "r-tsc" + String(process.pid);
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const docker = (args: string[]) => spawnSync("docker", args, { encoding: "utf8", windowsHide: true, timeout: 900_000 });

const CORRECT = [
  'import { supabaseAdmin } from "../lib/admin";',
  "",
  "export async function notify() {",
  "  const admin = supabaseAdmin();",
  '  await admin.from("notifications").insert({ ok: true });',
  "}",
  "",
].join("\n");

const DEFECTIVE = [
  'import { supabaseAdmin } from "../lib/admin";',
  "",
  "export async function notify() {",
  '  await supabaseAdmin.from("notifications").insert({ ok: true });',
  "}",
  "",
].join("\n");

let HOST: string;
let WORK: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let runtime: any;
let include: string[] = [];

describe.skipIf(!enabled)("typecheck inside the protected checker", () => {
  beforeAll(() => {
    // An image carrying only this repo's delivery scripts and the /deps symlink
    // the worker image uses, so module resolution reaches the dependency volume.
    const context = mkdtempSync(join(tmpdir(), "era-v2-tsc-image-"));
    cpSync(join(repoRoot, "scripts", "delivery-v2"), join(context, "scripts", "delivery-v2"), { recursive: true });
    writeFileSync(
      join(context, "Dockerfile"),
      [
        "FROM node:22-bookworm-slim",
        "RUN groupadd -g 10001 era && useradd -u 10001 -g 10001 -d /home/era -m era",
        "COPY scripts /opt/era/scripts",
        "RUN ln -s /deps/node_modules /node_modules",
        "USER 10001:10001",
        "",
      ].join("\n"),
      "utf8",
    );
    const built = docker(["build", "-q", "-t", IMAGE, context]);
    rmSync(context, { recursive: true, force: true });
    expect(built.status, built.stderr).toBe(0);

    // The pinned compiler: this checkout's own typescript, copied into a volume.
    const typescriptDir = join(repoRoot, "node_modules", "typescript");
    expect(existsSync(typescriptDir), "this checkout has no node_modules/typescript to pin").toBe(true);
    const depsStage = mkdtempSync(join(tmpdir(), "era-v2-tsc-deps-"));
    cpSync(typescriptDir, join(depsStage, "node_modules", "typescript"), { recursive: true });
    expect(docker(["volume", "create", DEPS]).status).toBe(0);
    const helper = "era-v2-tsc-deps-helper-" + String(process.pid);
    docker(["rm", "-f", helper]);
    expect(docker(["create", "--name", helper, "--network", "none", "--mount", "type=volume,source=" + DEPS + ",target=/dst", IMAGE, "true"]).status).toBe(0);
    expect(docker(["cp", depsStage + "/.", helper + ":/dst"]).status).toBe(0);
    docker(["rm", "-f", helper]);
    rmSync(depsStage, { recursive: true, force: true });

    HOST = mkdtempSync(join(tmpdir(), "era-v2-tsc-host-"));
    WORK = mkdtempSync(join(tmpdir(), "era-v2-tsc-work-"));
    const write = (path: string, contents: string) => {
      const target = join(HOST, path);
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, contents, "utf8");
    };
    write(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: { strict: true, noEmit: true, target: "ES2017", module: "esnext", moduleResolution: "bundler", skipLibCheck: true },
        include: ["src/**/*.ts"],
      }),
    );
    write(
      "src/lib/admin.ts",
      [
        "type Table = { insert: (row: Record<string, unknown>) => Promise<void> };",
        "type Client = { from: (table: string) => Table };",
        "export function supabaseAdmin(): Client {",
        "  return { from: () => ({ insert: async () => undefined }) };",
        "}",
        "",
      ].join("\n"),
    );
    write("src/api/route.ts", CORRECT);
    include = [...programFileList({ hostRoot: HOST, program: { roots: ["tsconfig.json", "src"], extensions: [".ts", ".json"] } }).files];

    runtime = createContainerRuntime({
      boundary: makeBoundaryConfig({ image: IMAGE, dependencies: { volume: DEPS }, synthetic: true }),
      hostRoot: HOST,
      workRoot: WORK,
    });
  }, 900_000);

  afterAll(() => {
    if (!enabled) return;
    const volumes = docker(["volume", "ls", "--format", "{{.Name}}"]).stdout.split("\n").filter(Boolean);
    for (const volume of volumes) {
      if (volume.startsWith("era-v2-" + RUN) || volume === DEPS || volume.startsWith("era-v2-program-")) docker(["volume", "rm", "-f", volume]);
    }
    docker(["image", "rm", "-f", IMAGE]);
    for (const dir of [HOST, WORK]) if (dir) rmSync(dir, { recursive: true, force: true });
  }, 900_000);

  /** One frozen candidate over the fixture's route, at its own generation. */
  function candidateFor(generation: string, routeBody: string) {
    const root = mkdtempSync(join(tmpdir(), "era-v2-tsc-cand-"));
    mkdirSync(join(root, "src", "api"), { recursive: true });
    writeFileSync(join(root, "src", "api", "route.ts"), routeBody, "utf8");
    return freezeCandidate({
      root,
      generation,
      kind: "code",
      base_manifest: [
        {
          path: "src/api/route.ts",
          sha256: "sha256:" + spawnSync(process.execPath, ["-e", "const c=require('node:crypto');process.stdout.write(c.createHash('sha256').update(Buffer.from(process.argv[1],'utf8')).digest('hex'))", CORRECT], { encoding: "utf8" }).stdout,
          size: Buffer.byteLength(CORRECT),
        },
      ],
    });
  }

  async function verify(candidate: ReturnType<typeof freezeCandidate>) {
    const offered = await runtime.typecheckExecutor({ run_id: RUN, candidate, include });
    expect(offered.ok, offered.reason).toBe(true);
    // Pinned, and the verdict says with what.
    expect(offered.producer.dependencies.typescript).toMatch(/^\d+\.\d+/u);
    return runTypecheckVerification({
      hostRoot: HOST,
      candidate,
      argv: ["node", "typecheck-runner.mjs"],
      execute: offered.execute,
      producer: offered.producer,
      requireIsolation: true,
    });
  }

  it("the deliberate failure: the container checker catches supabaseAdmin.from", async () => {
    const verification = await verify(candidateFor("C1", DEFECTIVE));
    expect(verification.environment.complete).toBe(true);
    expect(verification.environment.producer).toBe(TYPECHECK_PRODUCERS.CHECKER);
    expect(verification.environment.isolated).toBe(true);
    expect(verification.state).toBe(TYPECHECK_STATE.FAILED);
    expect(verification.diagnostics.map((entry: { code: string }) => entry.code)).toContain("TS2339");
    expect(verification.output!.text).toMatch(/TS2339/u);
    expect(verification.output!.text).not.toContain(HOST);
  }, 900_000);

  it("the passing control: the same route written correctly, same pinned program", async () => {
    const verification = await verify(candidateFor("C2", CORRECT));
    expect(verification.state).toBe(TYPECHECK_STATE.SATISFIED);
    expect(verification.counts.introduced).toBe(0);
    expect(verification.environment.isolated).toBe(true);
  }, 900_000);

  it("refuses, rather than grading, when the dependency volume carries no compiler", async () => {
    const bare = "era-v2-tsc-bare-" + String(process.pid);
    docker(["volume", "create", bare]);
    try {
      const without = createContainerRuntime({
        boundary: makeBoundaryConfig({ image: IMAGE, dependencies: { volume: bare }, synthetic: true }),
        hostRoot: HOST,
        workRoot: WORK,
      });
      const offered = await without.typecheckExecutor({ run_id: RUN + "-bare", candidate: candidateFor("C3", CORRECT), include });
      expect(offered.ok).toBe(false);
      expect(offered.reason).toMatch(/does not resolve typescript/u);
    } finally {
      docker(["volume", "rm", "-f", bare]);
    }
  }, 900_000);
});
