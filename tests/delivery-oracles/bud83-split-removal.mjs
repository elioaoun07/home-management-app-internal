// BUD-83 protected acceptance check (Delivery V2 checker input — the writer cannot
// change it). Bundles the candidate's `src/lib/utils/splitBill.ts` and checks the
// removal rule: only the owner may remove a split, and only while it is pending.
// Not a *.test.ts file, so the normal suite does not run it before BUD-83 lands.
//
// Usage: node tests/delivery-oracles/bud83-split-removal.mjs <root> <outDir>
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2] || process.cwd());
const out = resolve(process.argv[3] || join(root, ".tmp", "era-bud83-oracle"));
mkdirSync(out, { recursive: true });

const bundle = await build({
  entryPoints: [join(root, "src", "lib", "utils", "splitBill.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  write: false,
  logLevel: "silent",
});
const path = join(out, "bud83-splitBill.mjs");
writeFileSync(path, bundle.outputFiles[0].text);
const helper = await import(pathToFileURL(path).href);

if (typeof helper.canRemoveSplit !== "function") {
  throw new Error("src/lib/utils/splitBill.ts must export canRemoveSplit(transaction)");
}

const cases = [
  ["pending split, owner", { split_requested: true, split_completed_at: null, is_owner: true }, true],
  ["pending split, ownership unstated", { split_requested: true, split_completed_at: null }, true],
  ["completed split", { split_requested: true, split_completed_at: "2026-09-19T10:00:00.000Z", is_owner: true }, false],
  ["not a split", { split_requested: false, split_completed_at: null, is_owner: true }, false],
  ["split flag missing", { is_owner: true }, false],
  ["partner viewing a pending split", { split_requested: true, split_completed_at: null, is_owner: false }, false],
];

let passed = 0;
for (const [label, transaction, expected] of cases) {
  const actual = helper.canRemoveSplit({ amount: 50, description: "Roadster", ...transaction });
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
  passed += 1;
}
process.stdout.write(`${passed} of ${cases.length} tests passed\n`);
