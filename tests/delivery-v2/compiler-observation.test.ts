import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { compilerObservation } from "../../scripts/delivery-v2/compiler-observation.mjs";
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "compiler-observation-"));roots.push(root);
  mkdirSync(join(root,"src"));writeFileSync(join(root,"tsconfig.json"),"{}");writeFileSync(join(root,"src/a.ts"),"export const a = 1;");
  return { root, configured: { roots: ["tsconfig.json","src"], extensions: [".ts",".json"], generatedTypes: {} } };
}
it("keeps the main event loop responsive and shares only a concurrent snapshot", async () => {
  const f = fixture(), first = compilerObservation(f.root,f.configured), concurrent = compilerObservation(f.root,f.configured);
  expect(concurrent).toBe(first);
  let eventLoopResponded = false;
  setImmediate(() => { eventLoopResponded = true; });
  const before = await first;
  expect(eventLoopResponded).toBe(true);
  writeFileSync(join(f.root,"src/a.ts"),"export const a = 2;");writeFileSync(join(f.root,"src/new.jsx"),"export const b = 3;");
  const after = await compilerObservation(f.root,f.configured);
  expect(after.find(row=>row.path==="src/a.ts")?.sha256).not.toBe(before.find(row=>row.path==="src/a.ts")?.sha256);
  expect(after.some(row=>row.path==="src/new.jsx")).toBe(true);
});
it("fails closed on missing or altered inputs and can inspect repaired inputs afterward", async () => {
  const f = fixture();rmSync(join(f.root,"tsconfig.json"));
  await expect(compilerObservation(f.root,f.configured)).rejects.toThrow("incomplete");
  writeFileSync(join(f.root,"tsconfig.json"),"{}");
  await expect(compilerObservation(f.root,f.configured)).resolves.toEqual(expect.arrayContaining([expect.objectContaining({path:"src/a.ts"})]));
  mkdirSync(join(f.root,".next/types"),{recursive:true});writeFileSync(join(f.root,".next/types/routes.d.ts"),"changed");
  await expect(compilerObservation(f.root,{...f.configured,generatedTypes:{".next/types/routes.d.ts":"sha256:"+"0".repeat(64)}})).rejects.toThrow("generated compiler input changed");
});
