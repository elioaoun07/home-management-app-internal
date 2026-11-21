import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { readLibraryRecord } from "../../scripts/pm/library-record.mjs";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "pm-library-record-"));
  const shipped = join(dir, "_Archive", "Shipped");
  await mkdir(shipped, { recursive: true });
  await writeFile(join(shipped, "Schedule.md"), [
    "### SCH-4.3b", "The exact dotted work ID.", "### SCH-4.3", "Its parent.",
    "### SCH-7", "Older record.", "### SCH-7", "Ambiguous record.",
  ].join("\n"));
});
afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

it("opens only the selected shipped section", async () => {
  expect(await readLibraryRecord(dir, "Schedule", "SCH-4.3B")).toEqual({
    file: "_Archive/Shipped/Schedule.md", body: "The exact dotted work ID.",
  });
});
it.each([["Schedule", "SCH-7"], ["Schedule", "SCH-10"], ["../Shipped/Schedule", "SCH-4.3b"], ["Schedule", ""]])(
  "returns an empty record for ambiguous, missing or invalid selection %s %s", async (campaign, id) => {
    expect(await readLibraryRecord(dir, campaign, id)).toEqual({ body: null, file: null });
  },
);
