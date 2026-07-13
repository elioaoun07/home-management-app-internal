import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanCheckboxes } from "../../scripts/pm/mutations.mjs";
import { scanLines } from "../../scripts/pm/shared/md-scan.mjs";
import { fileTasks } from "../../scripts/pm/shared/tasks.mjs";
import { markdownCheckboxes } from "../../scripts/pm/src/lib/md-parse.js";

function legacyScan(raw: string) {
  const lines = String(raw).split("\n");
  let start = 0;
  if (/^---\s*$/.test(lines[0] || "")) {
    for (let index = 1; index < lines.length; index += 1) {
      if (/^---\s*$/.test(lines[index])) { start = index + 1; break; }
    }
  }
  const out: { line: number; state: string }[] = [];
  let inFence = false;
  for (let index = start; index < lines.length; index += 1) {
    if (/^\s*(```|~~~)/.test(lines[index])) { inFence = !inFence; continue; }
    if (inFence) continue;
    const match = lines[index].match(/^(\s*)(?:[-*]|\d+\.)\s+\[([ xX])\]/);
    if (match) out.push({ line: index, state: /x/i.test(match[2]) ? "done" : "open" });
  }
  return out;
}

function markdownFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    if (name === ".trash" || name === ".delivery") return [];
    const path = join(root, name);
    return statSync(path).isDirectory() ? markdownFiles(path) : /\.md$/i.test(name) ? [path] : [];
  });
}

describe("PM checkbox ordinal parity", () => {
  const root = join(process.cwd(), "ERA Notes", "10 - Project Management");
  const files = markdownFiles(root);

  it.skipIf(!files.length)(`matches the legacy contract across ${files.length} real files`, () => {
    for (const path of files) {
      const raw = readFileSync(path, "utf8");
      const expected = legacyScan(raw);
      expect(scanCheckboxes(raw), path).toEqual(expected);
      expect(scanLines(raw).lines.filter((line) => line.type === "checkbox").map(({ line, state }) => ({ line, state })), path).toEqual(expected);
      expect(markdownCheckboxes(raw).map((box) => box?.cbidx), path).toEqual(expected.map((_, index) => index));
      expect(fileTasks(raw).map((task) => task.cbidx), path).toEqual(expected.map((_, index) => index));
    }
  });
});
