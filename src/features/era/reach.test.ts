// HUB-81 — the reach matrix is generated from ERA_REACH, and every Feature
// Index module (CLAUDE.md) has a row. Regenerate the vault copy with:
//   ERA_REACH_WRITE=1 pnpm vitest run src/features/era/reach.test.ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ERA_REACH, explicitNavTarget, implicitNavTarget, renderReachMatrix } from "./reach";

const ROOT = path.resolve(__dirname, "../../..");
const MATRIX = path.join(ROOT, "ERA Notes/03 - Junction Modules/AI Assistant/ERA Reach Matrix.md");
const BEGIN = "<!-- reach-matrix:begin -->";
const END = "<!-- reach-matrix:end -->";

function featureIndexModules(): string[] {
  const md = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf-8");
  const section = md.slice(md.indexOf("## Feature Index"), md.indexOf("> **Note:** this table"));
  return section
    .split("\n")
    .filter((l) => l.startsWith("| ") && !l.startsWith("| Feature") && !l.startsWith("| ---"))
    .map((l) => l.split("|")[1].trim());
}

describe("ERA reach (HUB-81)", () => {
  it("has a row for every Feature Index module", () => {
    const rows = new Set(ERA_REACH.map((r) => r.module));
    const missing = featureIndexModules().filter((m) => !rows.has(m));
    expect(missing).toEqual([]);
  });

  it("every module reaches navigation, or states why it cannot", () => {
    for (const r of ERA_REACH) {
      if (!r.route) expect(r.note, r.module).toBeTruthy();
      else expect(r.route.startsWith("/")).toBe(true);
    }
  });

  it.each([
    ["open trips", "Trips"],
    ["go to my wardrobe", "Outfits"],
    ["take me to the recycle bin", "Recycle Bin"],
    ["open the shopping list", "Shopping List"],
  ])("explicit: %s → %s", (text, module) => {
    expect(explicitNavTarget(text)?.module).toBe(module);
  });

  it.each([
    ["what should I wear today", "Outfits"],
    ["we're going to Paris Oct 10-15", "Trips"],
    ["I took my vitamin D", "Healthcare"],
  ])("implicit: %s → %s", (text, module) => {
    expect(implicitNavTarget(text)?.module).toBe(module);
  });

  it("the vault matrix matches the registry", () => {
    const table = renderReachMatrix();
    if (process.env.ERA_REACH_WRITE === "1") {
      const doc = [
        "---",
        "type: reference",
        "module: ai-assistant",
        "generated: true",
        "---",
        "",
        "# ERA Reach Matrix",
        "",
        "Generated from `src/features/era/reach.ts` by `src/features/era/reach.test.ts` (HUB-81). Do not edit by hand:",
        "`ERA_REACH_WRITE=1 pnpm vitest run src/features/era/reach.test.ts`.",
        "",
        BEGIN,
        table,
        END,
        "",
      ].join("\n");
      fs.writeFileSync(MATRIX, doc);
    }
    const committed = fs.readFileSync(MATRIX, "utf-8");
    expect(committed.slice(committed.indexOf(BEGIN) + BEGIN.length, committed.indexOf(END)).trim()).toBe(table.trim());
  });
});
