import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import ts from "typescript";
import { compilerFiles, freezeCompilerInput, verifyCompilerInput } from "../../scripts/delivery-v2/compiler-input.mjs";
const roots: string[] = [];
const temp = () => { const root = mkdtempSync(join(tmpdir(), "compiler-freeze-")); roots.push(root); return root; };
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const root = temp(), directory = temp();
  mkdirSync(join(root, "src")); mkdirSync(join(root, ".next/dev/types"), { recursive: true });
  writeFileSync(join(root, "tsconfig.json"), "{}"); writeFileSync(join(root, "src/a.ts"), "export const a = 1;");
  writeFileSync(join(root, "next-env.d.ts"), 'import "./.next/dev/types/routes.d.ts";');
  writeFileSync(join(root, ".next/dev/types/routes.d.ts"), "export {};");
  const generatedTypes = { ".next/dev/types/routes.d.ts": "sha256:" + createHash("sha256").update("export {};").digest("hex") };
  return { root, directory, configured: { roots: ["tsconfig.json", "next-env.d.ts", "src"], extensions: [".ts", ".json"], generatedTypes } };
}
it("freezes declared generated types and keeps the closure across unrelated edits/restart", () => {
  const f = fixture(), input = freezeCompilerInput(f);
  writeFileSync(join(f.root, "src/a.ts"), "BROKEN later checkout");
  writeFileSync(join(f.root, ".next/dev/types/routes.d.ts"), "later generated types");
  const restored = verifyCompilerInput(JSON.parse(JSON.stringify(input)));
  expect(restored.fingerprint).toBe(input.fingerprint);
  expect(readFileSync(join(restored.root, "src/a.ts"), "utf8")).toBe("export const a = 1;");
  writeFileSync(join(restored.root, "src/a.ts"), "tampered");
  expect(() => verifyCompilerInput(restored)).toThrow("changed");
});
it("refuses undeclared, altered and missing required compiler inputs", () => {
  const f = fixture();
  expect(() => freezeCompilerInput({ ...f, configured: { ...f.configured, generatedTypes: {} } })).toThrow("undeclared");
  writeFileSync(join(f.root, ".next/dev/types/routes.d.ts"), "altered");
  expect(() => freezeCompilerInput(f)).toThrow();
  rmSync(join(f.root, "tsconfig.json"));
  expect(() => freezeCompilerInput(f)).toThrow("incomplete");
});

it("retains one walk's hashes but detects changed, added and removed inputs on the next inspection", () => {
  const f = fixture(), before = compilerFiles(f.root, f.configured);
  const original = before.walkedInputs["src/a.ts"];
  expect(original.sha256).toBe("sha256:" + createHash("sha256").update("export const a = 1;").digest("hex"));
  writeFileSync(join(f.root, "src/a.ts"), "export const a = 2;");
  writeFileSync(join(f.root, "src/new.jsx"), "export const b = 3;");
  const changed = compilerFiles(f.root, f.configured);
  expect(changed.walkedInputs["src/a.ts"].sha256).not.toBe(original.sha256);
  expect(changed.files).toContain("src/new.jsx");
  rmSync(join(f.root, "src/a.ts"));
  const removed = compilerFiles(f.root, f.configured);
  expect(removed.files).not.toContain("src/a.ts");
  expect(removed.walkedInputs["src/a.ts"]).toBeUndefined();
  expect(before.walkedInputs["src/a.ts"]).toEqual(original);
});

it("refuses a linked compiler root before trusting the walk's hashes", () => {
  const f = fixture();
  renameSync(join(f.root, "src"), join(f.root, "real-src"));
  symlinkSync(join(f.root, "real-src"), join(f.root, "src"), "junction");
  expect(() => compilerFiles(f.root, f.configured)).toThrow("linked compiler root");
});

it("compiles a TS import through frozen JSX and JS dependencies even with a TS-only configured extension list", () => {
  const f = fixture();
  writeFileSync(join(f.root, "src/a.ts"), 'import { answer } from "./Widget.jsx"; export const checked: number = answer;');
  writeFileSync(join(f.root, "src/Widget.jsx"), 'export { answer } from "./value.js";');
  writeFileSync(join(f.root, "src/value.js"), 'export const answer = 42;');
  const frozen = freezeCompilerInput(f);
  expect(frozen.manifest.map(entry => entry.path)).toEqual(expect.arrayContaining(["src/Widget.jsx", "src/value.js"]));
  // Compile only the isolated fixture; resolving against the checkout cannot
  // hide a missing frozen dependency. This is not environment certification.
  const diagnostics = () => ts.getPreEmitDiagnostics(ts.createProgram({
    rootNames: [join(frozen.root, "src/a.ts")],
    options: { noEmit: true, allowJs: true, strict: true, types: [], skipLibCheck: true, jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler },
  }));
  expect(diagnostics()).toEqual([]);
  rmSync(join(frozen.root, "src/Widget.jsx"));
  expect(diagnostics().some(diagnostic => diagnostic.code === 2307)).toBe(true);
  expect(() => verifyCompilerInput(frozen)).toThrow();
});
