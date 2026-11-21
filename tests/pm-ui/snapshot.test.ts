import { mkdtempSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createSnapshotReader } from "../../scripts/pm/snapshot.mjs";
import { createIdSectionReader, idSection } from "../../scripts/pm/shared/work-id.mjs";

it("indexes the same sections and preserves ambiguous headings", () => {
  const raw = "# Book\r\n### BUD-1\r\nFirst\r\n#### Details\r\n### BUD-2\r\nDuplicate\r\n### bud-2\r\nAlso duplicate\r\n## End";
  const read = createIdSectionReader();
  for (const id of ["bud-1", "BUD-2", "BUD-3"]) expect(read(raw, id)).toEqual(idSection(raw, id));
});

it("shares a read and discards an in-flight projection invalidated by a file change", async () => {
  let complete!: (value: { name: string }) => void;
  const current = { name: "updated" };
  const read = vi.fn()
    .mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
    .mockResolvedValue(current);
  const reader = createSnapshotReader({ root: "", pmDir: "", pmRel: "" }, { read });
  const first = reader.read();
  const second = reader.read();
  expect(read).toHaveBeenCalledTimes(1);
  reader.invalidate();
  complete({ name: "old" });
  expect(await Promise.all([first, second])).toEqual([current, current]);
  expect(await reader.read()).toBe(current);
  expect(read).toHaveBeenCalledTimes(2);
});

it("reads local markdown in the worker and observes an explicit invalidation", async () => {
  const root = mkdtempSync(join(tmpdir(), "pm-snapshot-"));
  const path = join(root, "_index.md");
  try {
    const reader = createSnapshotReader({ root, pmDir: root, pmRel: "." });
    writeFileSync(path, "# Before");
    expect((await reader.read()).files[0].raw).toBe("# Before");
    writeFileSync(path, "# After");
    reader.invalidate();
    expect((await reader.read()).files[0].raw).toBe("# After");
  } finally {
    rmSync(path, { force: true });
    rmdirSync(root);
  }
});
