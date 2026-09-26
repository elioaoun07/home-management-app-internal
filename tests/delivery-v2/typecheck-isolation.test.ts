// PM Delivery V2 — DLV-133: the typecheck compiles a pinned program inside the
// protected checker, and every verdict says where it was produced.
//
// What the host path could not claim
// ----------------------------------
// DLV-131 shipped the compile on the host because `era-dlv107-dependencies`
// carried no `typescript` and the candidate volume is a 29-file snapshot rather
// than a program. That verdict was deterministic and outside the model, but its
// baseline was the live working tree — uncommitted work included — and its
// toolchain was whatever the machine had.
//
// These fixtures exercise everything the fix changed except the Docker daemon:
// the explicit pinned file list, the staged read-only program, the container
// argv builder, the overlay of the frozen candidate onto that program, and the
// environment record the verdict carries. `isolatedExecutor` translates the
// checker's fixed container paths to this fixture's directories and spawns the
// same runner with the same flags in the same order. The container boundary
// itself is `worker-boundary.docker.test.ts`, which needs a daemon.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { freezeCandidate } from "../../scripts/delivery-v2/candidate.mjs";
import { provisionScratch } from "../../scripts/delivery-v2/scratch.mjs";
import {
  TYPECHECK_PRODUCERS,
  TYPECHECK_REFUSALS,
  TYPECHECK_STATE,
  programFileList,
  runTypecheckVerification,
} from "../../scripts/delivery-v2/typecheck.mjs";
import { CANDIDATE_PATH, PROGRAM_PATH, TYPECHECK_RUNNER_PATH, typecheckArgv } from "../../scripts/delivery-v2/worker-boundary.mjs";

let ROOT: string;

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "era-typecheck-iso-"));
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

const runnerPath = join(process.cwd(), "scripts", "delivery-v2", "typecheck-runner.mjs");

/** freezeCandidate compares against this, so it must be the same digest form. */
const hashOf = (contents: string) => "sha256:" + createHash("sha256").update(Buffer.from(contents, "utf8")).digest("hex");

const scripted = (runs: { exitCode: number; stdout: string }[]) => {
  let call = 0;
  return () => {
    const run = runs[Math.min(call, runs.length - 1)];
    call += 1;
    return { exitCode: run.exitCode, stdout: run.stdout, stderr: "", spawnError: null, signal: null };
  };
};

/** A minimal host checkout and a frozen candidate over it, with no compiler. */
function scenario(candidateFiles: Record<string, string>) {
  const hostRoot = join(ROOT, "host");
  const candidateRoot = join(ROOT, "candidate");
  const files: Record<string, string> = { "tsconfig.json": "{}", "package.json": "{}", "src/a.ts": "export const a = 1;\n" };
  for (const [path, contents] of Object.entries(files)) {
    const target = join(hostRoot, path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, contents, "utf8");
  }
  for (const [path, contents] of Object.entries(candidateFiles)) {
    const target = join(candidateRoot, path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, contents, "utf8");
  }
  const base = Object.entries(files)
    .filter(([path]) => path in candidateFiles)
    .map(([path, contents]) => ({ path, sha256: hashOf(contents), size: Buffer.byteLength(contents) }));
  return { hostRoot, candidate: freezeCandidate({ root: candidateRoot, generation: "C1", base_manifest: base, kind: "code" }) };
}

// ---------------------------------------------------------------------------
// The pinned file list
// ---------------------------------------------------------------------------

describe("programFileList", () => {
  const write = (hostRoot: string, path: string, contents: string) => {
    const target = join(hostRoot, path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, contents, "utf8");
  };

  it("pins an explicit list and leaves everything outside the roots behind", async () => {
    const hostRoot = join(ROOT, "pin-host");
    write(hostRoot, "tsconfig.json", "{}");
    write(hostRoot, "src/a.ts", "export const a = 1;\n");
    write(hostRoot, "src/data/x.json", "{}");
    write(hostRoot, "src/readme.md", "not part of a program\n");
    write(hostRoot, "build/junk.ts", "export const junk = 1;\n");

    const pinned = programFileList({ hostRoot, program: { roots: ["tsconfig.json", "src"], extensions: [".ts", ".json"] } });
    expect(pinned.files).toEqual(["src/a.ts", "src/data/x.json", "tsconfig.json"]);
    expect(pinned.files).not.toContain("build/junk.ts");
    expect(pinned.missing).toEqual([]);
  });

  it("reports a root that is not there instead of silently compiling less", async () => {
    const hostRoot = join(ROOT, "pin-missing");
    write(hostRoot, "tsconfig.json", "{}");
    expect(programFileList({ hostRoot, program: { roots: ["tsconfig.json", "types"], extensions: [".ts"] } }).missing).toEqual(["types"]);
  });
});

// ---------------------------------------------------------------------------
// The environment record, and the refusal that depends on it
// ---------------------------------------------------------------------------

describe("where a verdict was produced", () => {
  it("refuses a host verdict under an isolation policy, without compiling anything", async () => {
    const { hostRoot, candidate } = scenario({ "src/a.ts": "export const a = 2;\n" });
    let calls = 0;
    const verification = await runTypecheckVerification({
      hostRoot,
      candidate,
      argv: ["tsc"],
      execute: () => {
        calls += 1;
        return { exitCode: 0, stdout: "", stderr: "", spawnError: null, signal: null };
      },
      requireIsolation: true,
    });
    expect(verification.state).toBe(TYPECHECK_STATE.INCONCLUSIVE);
    expect(verification.reason).toBe(TYPECHECK_REFUSALS.NOT_ISOLATED);
    // The refusal is about *where* it would have run, so it must not first spend
    // two full compiles running there.
    expect(calls).toBe(0);
  });

  it("labels the host fallback in every verdict it produces", async () => {
    const { hostRoot, candidate } = scenario({ "src/a.ts": "export const a = 2;\n" });
    const verification = await runTypecheckVerification({ hostRoot, candidate, argv: ["tsc"], execute: scripted([{ exitCode: 0, stdout: "" }]) });
    expect(verification.state).toBe(TYPECHECK_STATE.SATISFIED);
    expect(verification.environment.producer).toBe(TYPECHECK_PRODUCERS.HOST);
    expect(verification.environment.isolated).toBe(false);
    expect(verification.environment.detail).toMatch(/uncommitted work/u);
  });

  it("does not let a producer that omits its name read as isolated", async () => {
    const { hostRoot, candidate } = scenario({ "src/a.ts": "export const a = 2;\n" });
    const verification = await runTypecheckVerification({
      hostRoot,
      candidate,
      argv: ["tsc"],
      execute: scripted([{ exitCode: 0, stdout: "" }]),
      producer: { isolated: true } as unknown as Record<string, unknown>,
    });
    expect(verification.environment.producer).toBe(TYPECHECK_PRODUCERS.HOST);
    expect(verification.environment.isolated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The isolated producer, with a real compiler
// ---------------------------------------------------------------------------

describe.runIf(existsSync(runnerPath))("isolated checker over a pinned program", () => {
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

  /** A two-file program whose defect shape is candidate C1's (Investigation F8). */
  function pinnedFixture(routeBody: string) {
    const hostRoot = join(ROOT, "iso-host");
    const write = (path: string, contents: string) => {
      const target = join(hostRoot, path);
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
    // Outside the pinned roots on purpose: it must never reach the program.
    write("build/junk.ts", "export const junk: string = 1;\n");

    const pinned = programFileList({ hostRoot, program: { roots: ["tsconfig.json", "src"], extensions: [".ts", ".json"] } });
    const programRoot = join(ROOT, "iso-program");
    const staged = provisionScratch({ scratchRoot: programRoot, hostRoot, include: [...pinned.files] });

    const candidateRoot = join(ROOT, "iso-candidate");
    mkdirSync(join(candidateRoot, "src", "api"), { recursive: true });
    writeFileSync(join(candidateRoot, "src", "api", "route.ts"), routeBody, "utf8");
    const candidate = freezeCandidate({
      root: candidateRoot,
      generation: "C1",
      base_manifest: [{ path: "src/api/route.ts", sha256: hashOf(CORRECT), size: Buffer.byteLength(CORRECT) }],
      kind: "code",
    });
    return { hostRoot, programRoot, candidate, staged };
  }

  /** The checker's own argv and overlay, run outside a container. */
  function isolatedExecutor({ programRoot, candidateRoot }: { programRoot: string; candidateRoot: string }) {
    return ({ phase, changed, deleted }: { phase: string; changed?: string[]; deleted?: string[] }) => {
      const argv: string[] = typecheckArgv({ phase, changed, deleted });
      const mapped = argv.map((entry) =>
        entry === PROGRAM_PATH ? programRoot : entry === CANDIDATE_PATH ? candidateRoot : entry === TYPECHECK_RUNNER_PATH ? runnerPath : entry,
      );
      const result = spawnSync(process.execPath, mapped.slice(1), { encoding: "utf8", timeout: 300_000, maxBuffer: 64 * 1024 * 1024 });
      return {
        exitCode: result.status,
        signal: result.signal ?? null,
        stdout: String(result.stdout || ""),
        stderr: String(result.stderr || ""),
        spawnError: result.error ? String(result.error.message) : null,
      };
    };
  }

  const producerFor = (staged: { manifest_fingerprint: string; supplied: unknown[] }) => ({
    producer: TYPECHECK_PRODUCERS.CHECKER,
    isolated: true,
    detail: "fixture checker over a pinned program",
    program: {
      volume: "era-v2-program-fixture",
      fingerprint: staged.manifest_fingerprint,
      files: staged.supplied.length,
      root: PROGRAM_PATH,
      config: "tsconfig.json",
    },
    dependencies: { volume: "era-v2-deps-fixture", typescript: "fixture", node: process.version },
    image: "sha256:fixture",
  });

  it("the deliberate failure: the isolated checker catches supabaseAdmin.from", async () => {
    const { programRoot, candidate, staged } = pinnedFixture(DEFECTIVE);
    const verification = await runTypecheckVerification({
      hostRoot: programRoot,
      candidate,
      argv: ["node", runnerPath],
      execute: isolatedExecutor({ programRoot, candidateRoot: candidate.root }),
      producer: producerFor(staged),
      requireIsolation: true,
    });
    expect(verification.environment.complete).toBe(true);
    expect(verification.environment.producer).toBe(TYPECHECK_PRODUCERS.CHECKER);
    expect(verification.environment.isolated).toBe(true);
    expect(verification.environment.program.fingerprint).toBe(staged.manifest_fingerprint);
    expect(verification.state).toBe(TYPECHECK_STATE.FAILED);
    expect(verification.diagnostics.map((entry: { code: string }) => entry.code)).toContain("TS2339");
    expect(verification.diagnostics[0].message).toMatch(/Property 'from' does not exist/u);
    // DLV-120: the compilers' own text is kept, readable and path-free.
    expect(verification.output!.text).toMatch(/TS2339/u);
    expect(verification.output!.text).not.toContain(ROOT);
    expect(verification.redaction).toMatch(/retained/u);
  }, 300_000);

  it("the passing control: the same route written correctly, same pinned program", async () => {
    const { programRoot, candidate, staged } = pinnedFixture(CORRECT.replace("const admin", "const admin /* control */"));
    const verification = await runTypecheckVerification({
      hostRoot: programRoot,
      candidate,
      argv: ["node", runnerPath],
      execute: isolatedExecutor({ programRoot, candidateRoot: candidate.root }),
      producer: producerFor(staged),
      requireIsolation: true,
    });
    expect(verification.state).toBe(TYPECHECK_STATE.SATISFIED);
    expect(verification.counts.introduced).toBe(0);
    expect(verification.environment.isolated).toBe(true);
  }, 300_000);

  it("compiles the pinned program, not the working tree it was staged from", async () => {
    const { hostRoot, programRoot, candidate, staged } = pinnedFixture(CORRECT.replace("const admin", "const admin /* control */"));
    // The uncommitted work DLV-133 exists to exclude: a fresh error written into
    // the checkout after staging. A host-checkout run would carry it into the
    // baseline; the pinned program never sees it.
    writeFileSync(join(hostRoot, "src", "lib", "broken.ts"), "export const broken: string = 1;\n", "utf8");
    expect(existsSync(join(programRoot, "src", "lib", "broken.ts"))).toBe(false);
    expect(existsSync(join(programRoot, "build", "junk.ts"))).toBe(false);

    const verification = await runTypecheckVerification({
      hostRoot: programRoot,
      candidate,
      argv: ["node", runnerPath],
      execute: isolatedExecutor({ programRoot, candidateRoot: candidate.root }),
      producer: producerFor(staged),
      requireIsolation: true,
    });
    expect(verification.state).toBe(TYPECHECK_STATE.SATISFIED);
    expect(verification.counts.baseline).toBe(0);
  }, 300_000);
});
