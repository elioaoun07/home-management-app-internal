import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { probeCompilerProgram } from "../../scripts/delivery-v2/probes/compiler-program.mjs";

it("requires a clean full program and a discriminating negative overlay", () => {
  const root = mkdtempSync(join(tmpdir(), "full-program-probe-"));
  const runner = join(process.cwd(), "scripts/delivery-v2/typecheck-runner.mjs");
  try {
    // This synthetic program only uses scalar types. Pin its real standard
    // library explicitly instead of parsing the unrelated default DOM library
    // in each of the four child compilers. All four assertions and the single
    // test's default deadline remain unchanged; real recipe programs are not
    // altered by this fixture configuration.
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, types: [], lib: ["es5"], noEmit: true, skipLibCheck: true }, include: ["source.ts", "types/**/*.ts"] }));
    writeFileSync(join(root, "source.ts"), "export const value: number = 1;");
    expect(probeCompilerProgram({ root, runner, phase: "positive", output: root }).exitCode).toBe(0);
    expect(probeCompilerProgram({ root, runner, phase: "negative", output: root }).exitCode).toBe(2);
    writeFileSync(join(root, "source.ts"), 'export const value: number = "wrong";');
    expect(() => probeCompilerProgram({ root, runner, phase: "positive", output: root })).toThrow("full compiler program failed");
    expect(() => probeCompilerProgram({ root, runner, phase: "negative", output: root })).toThrow("unrelated errors");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
