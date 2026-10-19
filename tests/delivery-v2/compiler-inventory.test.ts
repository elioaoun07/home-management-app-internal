import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import { COMPILER_MANIFEST, compilerInventorySource } from "../../scripts/delivery-v2/worker/compiler-inventory.mjs";

it("checks actual compiler bytes, missing/extra files and the trusted manifest digest", () => {
  const root = mkdtempSync(join(tmpdir(), "compiler-inventory-"));
  const hash = (text: string) => "sha256:" + createHash("sha256").update(text).digest("hex");
  const manifest = JSON.stringify([{ path: "input.ts", size: 10, sha256: hash("export {};") }]);
  let output = "";
  const run = () => runInNewContext(compilerInventorySource(hash(manifest), root), { require: createRequire(import.meta.url), process: { stdout: { write: (text: string) => { output += text; } } } });
  try {
    writeFileSync(join(root, "input.ts"), "export {};"); writeFileSync(join(root, COMPILER_MANIFEST), manifest);
    run(); expect(output).toBe("era-compiler-input-verified");
    writeFileSync(join(root, "input.ts"), "tampered"); expect(run).toThrow("changed");
    rmSync(join(root, "input.ts")); expect(run).toThrow("missing");
    writeFileSync(join(root, "input.ts"), "export {};"); writeFileSync(join(root, "extra.ts"), "export {};"); expect(run).toThrow("unexpected");
    rmSync(join(root, "extra.ts")); writeFileSync(join(root, COMPILER_MANIFEST), "[]"); expect(run).toThrow("manifest changed");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
