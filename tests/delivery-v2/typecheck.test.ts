// PM Delivery V2 — the deterministic typecheck that closes the Apply gap.
//
// The defect these fixtures are built around is real: candidate C1 of run
// r-83dddb67fea9 wrote `supabaseAdmin.from("notifications")` where
// `supabaseAdmin()` is a function, and the run still closed as
// `verified_candidate` because nothing in the pipeline typechecked anything
// (Investigation §5.4, F8). The isolated fixture below reproduces exactly that
// shape — a real `tsc` over a two-file program — and asserts the checker sees
// it. The historical candidate is not touched.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { freezeCandidate } from "../../scripts/delivery-v2/candidate.mjs";
import {
  TYPECHECK_REFUSALS,
  TYPECHECK_STATE,
  classifyDiagnostics,
  environmentVerdict,
  parseTypescriptDiagnostics,
  runTypecheckVerification,
  spawnTypecheck,
  verificationIsFresh,
  writeTypecheckArtifact,
} from "../../scripts/delivery-v2/typecheck.mjs";

let ROOT: string;

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "era-typecheck-"));
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe("parseTypescriptDiagnostics", () => {
  it("reads file, position, code and message", async () => {
    const [first] = parseTypescriptDiagnostics(
      "src/app/api/transactions/[id]/route.ts(198,26): error TS2339: Property 'from' does not exist on type '() => SupabaseClient'.",
    );
    expect(first).toEqual({
      file: "src/app/api/transactions/[id]/route.ts",
      line: 198,
      column: 26,
      code: "TS2339",
      message: "Property 'from' does not exist on type '() => SupabaseClient'.",
    });
  });

  it("survives colour codes rather than silently reading zero diagnostics", async () => {
    const coloured = "\u001B[96msrc/a.ts\u001B[0m(1,1): \u001B[91merror\u001B[0m \u001B[90mTS2339\u001B[0m: bad";
    expect(parseTypescriptDiagnostics(coloured)).toHaveLength(1);
  });

  it("reads a program-level diagnostic with no file", async () => {
    expect(parseTypescriptDiagnostics("error TS18003: No inputs were found in config file.")[0].code).toBe("TS18003");
  });
});

interface Diagnostic {
  file: string | null;
  line: number | null;
  column: number | null;
  code: string;
  message: string;
}

describe("classifyDiagnostics", () => {
  const diag = (file: string, code: string, message: string, line = 1): Diagnostic => ({ file, line, column: 1, code, message });

  it("does not call a shifted pre-existing diagnostic new", async () => {
    const split = classifyDiagnostics({
      baseline: [diag("src/a.ts", "TS2345", "old problem", 10)],
      candidate: [diag("src/a.ts", "TS2345", "old problem", 42)],
    });
    expect(split.introduced).toHaveLength(0);
    expect(split.preExisting).toHaveLength(1);
  });

  it("counts a second copy of an existing message as new", async () => {
    const split = classifyDiagnostics({
      baseline: [diag("src/a.ts", "TS2345", "same")],
      candidate: [diag("src/a.ts", "TS2345", "same"), diag("src/a.ts", "TS2345", "same")],
    });
    expect(split.introduced).toHaveLength(1);
  });

  it("notices a baseline diagnostic the candidate fixed", async () => {
    const split = classifyDiagnostics({ baseline: [diag("src/a.ts", "TS2345", "gone")], candidate: [] });
    expect(split.resolved).toHaveLength(1);
  });
});

describe("environmentVerdict", () => {
  const ok = { exitCode: 0, stdout: "", stderr: "", spawnError: null };

  it("accepts a compiler that ran over a real config", async () => {
    expect(environmentVerdict({ baseline: ok, diagnostics: [], configPath: "tsconfig.json" }).complete).toBe(true);
  });

  it("refuses to grade when the baseline cannot resolve its own modules", async () => {
    const verdict = environmentVerdict({
      baseline: { exitCode: 2, stdout: "", stderr: "", spawnError: null },
      diagnostics: [{ file: "src/a.ts", line: 1, column: 1, code: "TS2307", message: "Cannot find module 'next'" } as Diagnostic],
      configPath: "tsconfig.json",
    });
    expect(verdict.complete).toBe(false);
    expect(verdict.reasons.join(" ")).toMatch(/manufacture a pass/u);
  });

  it("refuses when the compiler never started", async () => {
    expect(environmentVerdict({ baseline: { exitCode: null, spawnError: "ENOENT", stdout: "", stderr: "" }, diagnostics: [], configPath: "tsconfig.json" }).complete).toBe(false);
  });

  it("refuses when the candidate changes the checker's own configuration", async () => {
    const verdict = environmentVerdict({ baseline: ok, diagnostics: [], configPath: "tsconfig.json", candidateTouchesConfig: ["tsconfig.json"] });
    expect(verdict.complete).toBe(false);
    expect(verdict.reasons.join(" ")).toMatch(/not independent of it/u);
  });

  it("refuses a non-zero exit that produced nothing readable", async () => {
    expect(environmentVerdict({ baseline: { exitCode: 1, stdout: "killed", stderr: "", spawnError: null }, diagnostics: [], configPath: "tsconfig.json" }).complete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// End to end, with a scripted executor
// ---------------------------------------------------------------------------

/** A host checkout and a frozen candidate over it, with no compiler involved. */
function scenario(candidateFiles: Record<string, string>, hostFiles: Record<string, string> = {}) {
  const hostRoot = join(ROOT, "host");
  const candidateRoot = join(ROOT, "candidate");
  const files = { "tsconfig.json": "{}", "package.json": "{}", "src/a.ts": "export const a = 1;\n", ...hostFiles };
  for (const [path, contents] of Object.entries(files)) {
    const target = join(hostRoot, path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, contents, "utf8");
  }
  mkdirSync(join(hostRoot, "node_modules"), { recursive: true });
  for (const [path, contents] of Object.entries(candidateFiles)) {
    const target = join(candidateRoot, path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, contents, "utf8");
  }
  const base = Object.entries(files)
    .filter(([path]) => path in candidateFiles)
    .map(([path, contents]) => ({ path, sha256: hashOf(contents), size: Buffer.byteLength(contents) }));
  const candidate = freezeCandidate({ root: candidateRoot, generation: "C1", base_manifest: base, kind: "code" });
  return { hostRoot, candidate };
}

function hashOf(contents: string) {
  // freezeCandidate compares against this, so it must be the same digest form.
  return "sha256:" + createHash("sha256").update(Buffer.from(contents, "utf8")).digest("hex");
}

const scripted = (runs: { exitCode: number; stdout: string }[]) => {
  let call = 0;
  return () => {
    const run = runs[Math.min(call, runs.length - 1)];
    call += 1;
    return { exitCode: run.exitCode, stdout: run.stdout, stderr: "", spawnError: null, signal: null };
  };
};

describe("runTypecheckVerification", () => {
  it("passes a candidate that introduces no new diagnostic", async () => {
    const { hostRoot, candidate } = scenario({ "src/a.ts": "export const a = 2;\n" });
    const verification = await runTypecheckVerification({
      hostRoot,
      candidate,
      argv: ["tsc"],
      execute: scripted([{ exitCode: 0, stdout: "" }]),
    });
    expect(verification.state).toBe(TYPECHECK_STATE.SATISFIED);
    expect(verification.counts.introduced).toBe(0);
    expect(verification.checked_inputs?.changed).toEqual(["src/a.ts"]);
  });

  it("fails a candidate whose diagnostic is not in the baseline", async () => {
    const { hostRoot, candidate } = scenario({ "src/a.ts": "export const a: string = 2;\n" });
    const verification = await runTypecheckVerification({
      hostRoot,
      candidate,
      argv: ["tsc"],
      execute: scripted([
        { exitCode: 0, stdout: "" },
        { exitCode: 2, stdout: "src/a.ts(1,14): error TS2322: Type 'number' is not assignable to type 'string'." },
      ]),
    });
    expect(verification.state).toBe(TYPECHECK_STATE.FAILED);
    expect(verification.diagnostics[0].code).toBe("TS2322");
  });

  it("subtracts a pre-existing baseline diagnostic instead of blaming the candidate", async () => {
    const { hostRoot, candidate } = scenario({ "src/a.ts": "export const a = 3;\n" });
    const shared = "src/b.ts(4,1): error TS2345: pre-existing";
    const verification = await runTypecheckVerification({
      hostRoot,
      candidate,
      argv: ["tsc"],
      execute: scripted([
        { exitCode: 2, stdout: shared },
        { exitCode: 2, stdout: shared },
      ]),
    });
    expect(verification.state).toBe(TYPECHECK_STATE.SATISFIED);
    expect(verification.counts.preExisting).toBe(1);
  });

  it("stays inconclusive — never passes — when the environment is broken", async () => {
    const { hostRoot, candidate } = scenario({ "src/a.ts": "export const a = 4;\n" });
    const broken = "src/a.ts(1,1): error TS2307: Cannot find module 'next' or its corresponding type declarations.";
    const verification = await runTypecheckVerification({
      hostRoot,
      candidate,
      argv: ["tsc"],
      // The trap this exists to stop: identical broken output both sides, which
      // baseline subtraction would report as a clean pass.
      execute: scripted([
        { exitCode: 2, stdout: broken },
        { exitCode: 2, stdout: broken },
      ]),
    });
    expect(verification.state).toBe(TYPECHECK_STATE.INCONCLUSIVE);
    expect(verification.reason).toBe(TYPECHECK_REFUSALS.ENVIRONMENT);
  });

  it("is inconclusive when no runner exists", async () => {
    const { hostRoot, candidate } = scenario({ "src/a.ts": "export const a = 5;\n" });
    const verification = await runTypecheckVerification({
      hostRoot,
      candidate,
      argv: ["tsc"],
      execute: null as unknown as () => void,
    });
    expect(verification.state).toBe(TYPECHECK_STATE.INCONCLUSIVE);
    expect(verification.reason).toBe(TYPECHECK_REFUSALS.NO_RUNNER);
  });

  it("retains a readable, bounded artifact rather than a hash", async () => {
    const { hostRoot, candidate } = scenario({ "src/a.ts": "export const a: string = 2;\n" });
    const verification = await runTypecheckVerification({
      hostRoot,
      candidate,
      argv: ["tsc"],
      execute: scripted([
        { exitCode: 0, stdout: "" },
        { exitCode: 2, stdout: "src/a.ts(1,14): error TS2322: Type 'number' is not assignable to type 'string'." },
      ]),
    });
    const path = writeTypecheckArtifact({ dir: join(ROOT, "artifacts"), verification });
    const stored = JSON.parse(readFileSync(path, "utf8"));
    expect(stored.diagnostics[0].message).toMatch(/not assignable/u);
    expect(JSON.stringify(stored)).not.toContain(ROOT);
  });
});

describe("verificationIsFresh", () => {
  const verification = { criterion_id: "delivery-typecheck", candidate_id: "cand-1", checked_inputs: { candidate_id: "cand-1", changed: ["src/a.ts"] } };

  it("binds to the exact candidate", async () => {
    expect(verificationIsFresh({ verification, candidate_id: "cand-2" }).fresh).toBe(false);
    expect(verificationIsFresh({ verification, candidate_id: "cand-1" }).fresh).toBe(true);
  });

  it("goes stale when the checked inputs move", async () => {
    expect(verificationIsFresh({ verification, candidate_id: "cand-1", changed: ["src/a.ts", "src/b.ts"] }).fresh).toBe(false);
  });

  it("treats a missing verification as not fresh", async () => {
    expect(verificationIsFresh({ verification: null, candidate_id: "cand-1" }).fresh).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The regression fixture: a real compiler over the real defect shape
// ---------------------------------------------------------------------------

const runnerPath = join(process.cwd(), "scripts", "delivery-v2", "typecheck-runner.mjs");

describe.runIf(existsSync(runnerPath))("supabaseAdmin regression fixture", () => {
  /**
   * An isolated two-file program reproducing candidate C1's defect:
   * `admin.ts` exports `supabaseAdmin` as a FUNCTION, and the route uses it as
   * though it were the client. Nothing here reads the historical candidate; it
   * only reproduces its shape.
   */
  function fixture(routeBody: string) {
    const hostRoot = join(ROOT, "fixture-host");
    mkdirSync(join(hostRoot, "src", "lib"), { recursive: true });
    mkdirSync(join(hostRoot, "src", "api"), { recursive: true });
    writeFileSync(
      join(hostRoot, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: "ES2017", module: "esnext", moduleResolution: "bundler", skipLibCheck: true }, include: ["src/**/*.ts"] }),
      "utf8",
    );
    writeFileSync(join(hostRoot, "package.json"), JSON.stringify({ name: "fixture", private: true }), "utf8");
    writeFileSync(
      join(hostRoot, "src", "lib", "admin.ts"),
      [
        "type Table = { insert: (row: Record<string, unknown>) => Promise<void> };",
        "type Client = { from: (table: string) => Table };",
        "export function supabaseAdmin(): Client {",
        '  return { from: () => ({ insert: async () => undefined }) };',
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(join(hostRoot, "src", "api", "route.ts"), ["import { supabaseAdmin } from \"../lib/admin\";", "", "export async function notify() {", "  const client = supabaseAdmin();", "  await client.from(\"notifications\").insert({ ok: true });", "}", ""].join("\n"), "utf8");
    mkdirSync(join(hostRoot, "node_modules"), { recursive: true });

    const candidateRoot = join(ROOT, "fixture-candidate");
    mkdirSync(join(candidateRoot, "src", "api"), { recursive: true });
    writeFileSync(join(candidateRoot, "src", "api", "route.ts"), routeBody, "utf8");
    const baseBytes = readFileSync(join(hostRoot, "src", "api", "route.ts"), "utf8");
    const candidate = freezeCandidate({
      root: candidateRoot,
      generation: "C1",
      base_manifest: [{ path: "src/api/route.ts", sha256: hashOf(baseBytes), size: Buffer.byteLength(baseBytes) }],
      kind: "code",
    });
    return { hostRoot, candidate };
  }

  // The real executor and the real runner: this fixture's whole point is that a
  // genuine compiler sees the defect, not that a parser can read a string.
  const argv = [process.execPath, runnerPath];

  it("detects supabaseAdmin.from — the defect that reached a verified candidate", async () => {
    const { hostRoot, candidate } = fixture(
      ["import { supabaseAdmin } from \"../lib/admin\";", "", "export async function notify() {", "  await supabaseAdmin.from(\"notifications\").insert({ ok: true });", "}", ""].join("\n"),
    );
    const verification = await runTypecheckVerification({
      hostRoot,
      candidate,
      argv,
      execute: spawnTypecheck,
    });
    expect(verification.environment.complete).toBe(true);
    expect(verification.state).toBe(TYPECHECK_STATE.FAILED);
    expect(verification.diagnostics.map((entry: { code: string }) => entry.code)).toContain("TS2339");
    expect(verification.diagnostics[0].message).toMatch(/Property 'from' does not exist/u);
  }, 300_000);

  it("passes the same route written correctly", async () => {
    const { hostRoot, candidate } = fixture(
      ["import { supabaseAdmin } from \"../lib/admin\";", "", "export async function notify() {", "  const admin = supabaseAdmin();", "  await admin.from(\"notifications\").insert({ ok: true });", "}", ""].join("\n"),
    );
    const verification = await runTypecheckVerification({
      hostRoot,
      candidate,
      argv,
      execute: spawnTypecheck,
    });
    expect(verification.state).toBe(TYPECHECK_STATE.SATISFIED);
  }, 300_000);
});
