import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { CHIP_ID_SOURCE, idSection } from "./shared/work-id.mjs";

const itemId = new RegExp(`^${CHIP_ID_SOURCE}$`, "i");
const absent = { body: null, file: null };

// The Finished reader can open one historical record. The archive never enters
// the live corpus used by search, planning, or launch.
export async function readLibraryRecord(pmDir, campaign, id) {
  if (!campaign || !/^[A-Za-z][A-Za-z0-9 &'-]{0,70}$/.test(campaign) || !itemId.test(id || "")) return absent;
  const file = `_Archive/Shipped/${campaign}.md`;
  try {
    const path = join(await realpath(pmDir), file);
    if (await realpath(path) !== path) return absent;
    const section = idSection(await readFile(path, "utf8"), id);
    return section ? { file, body: section.body } : absent;
  } catch (error) {
    if (error.code === "ENOENT") return absent;
    throw error;
  }
}
