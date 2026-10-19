// Generic DLV-133 environment witness over the complete pinned program.
// Runs offline inside the checker; no candidate/configuration is written to it.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export function probeCompilerProgram({ root, phase, runner = "/opt/era/scripts/delivery-v2/typecheck-runner.mjs", output = tmpdir() }) {
  assert(["positive", "negative"].includes(phase), "compiler probe phase required");
  const evidence = mkdtempSync(join(output, "compiler-program-"));
  const args = [runner, "--root", root];
  if (phase === "negative") {
    const name = "types/__delivery_compiler_negative.ts";
    mkdirSync(join(evidence, "types"));
    writeFileSync(join(evidence, name), 'export const deliveryCompilerNegative: number = "deliberate type error";\n');
    args.push("--candidate", evidence, "--changed", name);
  }
  const result = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 270000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  const text = String(result.stdout || "") + String(result.stderr || "");
  writeFileSync(join(evidence, "output.txt"), text);
  assert(!result.error && !result.signal, "compiler did not complete: " + text);
  if (phase === "positive") assert.equal(result.status, 0, "full compiler program failed: " + text);
  else {
    assert.equal(result.status, 2, "negative compiler program did not fail: " + text);
    assert.match(text, /types\/__delivery_compiler_negative\.ts\(1,\d+\): error TS2322:/u);
    assert.equal((text.match(/error TS\d+:/gu) || []).length, 1, "negative witness has unrelated errors: " + text);
  }
  return { phase, evidence, exitCode: result.status, output: text };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = probeCompilerProgram({ root: resolve(process.argv[2]), phase: process.argv[3] });
    process.stdout.write(JSON.stringify(result) + "\nTests 1 passed (1)\n");
  } catch (error) { process.stderr.write(String(error) + "\n"); process.exitCode = 1; }
}
