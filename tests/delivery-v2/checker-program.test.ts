import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { provisionScratch } from "../../scripts/delivery-v2/scratch.mjs";
import { createContainerRuntime, makeBoundaryConfig, provisionCheckerProgram } from "../../scripts/delivery-v2/worker-boundary.mjs";

const roots: string[] = [];
const temp = () => {
  const root = mkdtempSync(join(tmpdir(), "dlv133-program-"));
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const hash = (s: string | Buffer) => "sha256:" + createHash("sha256").update(s).digest("hex");
const rel = ".next/dev/types/routes.d.ts";

function source() {
  const root = temp();
  mkdirSync(join(root, ".next/dev/types"), { recursive: true });
  writeFileSync(join(root, rel), "export {};\n");
  return root;
}

it.each([rel, ".next/types/validator.ts"])("pins %s only for compiler staging; generic scratch still refuses it", name => {
  const hostRoot = source();
  mkdirSync(join(hostRoot, ".next/types"));
  writeFileSync(join(hostRoot, ".next/types/validator.ts"), "export {};\n");
  const pin = hash(readFileSync(join(hostRoot, name)));
  expect(provisionScratch({ hostRoot, scratchRoot: temp(), include: [name] }).refusals).toHaveLength(1);
  const scratchRoot = temp();
  const result = provisionCheckerProgram({ hostRoot, scratchRoot, include: [name], generatedTypes: { [name]: pin } });
  expect(result.refusals).toEqual([]);
  expect(result.supplied).toEqual([{ path: name, sha256: pin, size: Buffer.byteLength("export {};\n") }]);
  expect(hash(readFileSync(join(scratchRoot, name)))).toBe(pin);
});

it("refuses missing pins, altered bytes, unrequested pins and other .next content", () => {
  const hostRoot = source(), pin = hash(readFileSync(join(hostRoot, rel)));
  expect(() => provisionCheckerProgram({ hostRoot, scratchRoot: temp(), include: [rel] })).toThrow();
  expect(() => provisionCheckerProgram({ hostRoot, scratchRoot: temp(), include: [rel], generatedTypes: { [rel]: hash("wrong") } })).toThrow();
  expect(() => provisionCheckerProgram({ hostRoot, scratchRoot: temp(), include: [], generatedTypes: { [rel]: pin } })).toThrow();
  expect(() => provisionCheckerProgram({ hostRoot, scratchRoot: temp(), include: [".next/cache/data.ts"], generatedTypes: { ".next/cache/data.ts": pin } })).toThrow();
  rmSync(join(hostRoot, rel));
  expect(() => provisionCheckerProgram({ hostRoot, scratchRoot: temp(), include: [rel], generatedTypes: { [rel]: pin } })).toThrow();
});

it.each([".next/dev/types/../routes.d.ts", ".next/dev/types/./routes.d.ts", ".next/dev/types/../../../../outside.ts"])("rejects traversal/dot segments in %s before reading or writing", name => {
  const hostRoot = source(), scratchRoot = temp();
  expect(() => provisionCheckerProgram({ hostRoot, scratchRoot, include: [name], generatedTypes: { [name]: hash("outside") } })).toThrow(/invalid pinned/);
  expect(existsSync(join(scratchRoot, ".next"))).toBe(false);
});

it("refuses linked generated directories", () => {
  const hostRoot = temp(), outside = source();
  mkdirSync(join(hostRoot, ".next"));
  symlinkSync(join(outside, ".next/dev"), join(hostRoot, ".next/dev"), process.platform === "win32" ? "junction" : "dir");
  expect(() => provisionCheckerProgram({ hostRoot, scratchRoot: temp(), include: [rel], generatedTypes: { [rel]: hash(readFileSync(join(outside, rel))) } })).toThrow(/linked/);
});

it("rejects a partial program before any container/volume operation", async () => {
  const hostRoot = source();
  writeFileSync(join(hostRoot, "tsconfig.json"), "{}");
  const run = () => { throw new Error("Docker must not be called for refused inputs"); };
  const runtime = createContainerRuntime({ boundary: makeBoundaryConfig({ image: "checker:fixture", synthetic: true }), hostRoot, workRoot: temp(), docker: { run, runSync: run, lines: run } });
  const offered = await runtime.typecheckExecutor({ run_id: "r-partial", candidate: { root: hostRoot, candidate_id: "c-partial", generation: "C1" }, include: ["tsconfig.json", "missing.ts"] });
  expect(offered.ok).toBe(false);
  expect(offered.reason).toMatch(/compiler program inputs refused.*missing.ts/);
});
