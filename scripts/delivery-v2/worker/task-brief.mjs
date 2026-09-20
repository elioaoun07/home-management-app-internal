// Materializes ONLY supervisor-supplied input inside the container's temporary
// filesystem. Never reads host files or changes source/candidate bytes.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, lstatSync } from "node:fs";

export function installTaskBrief(brief) {
  if (!brief) return null;
  const digest = "sha256:" + createHash("sha256").update(brief.text).digest("hex");
  const expected = "/tmp/era-task-brief-" + digest.replace(/[^a-z0-9]/giu, "") + ".json";
  if (brief.digest !== digest || brief.path !== expected) throw new Error("task brief identity mismatch");
  try { writeFileSync(expected, brief.text, { flag: "wx", mode: 0o400 }); }
  catch (error) {
    if (error.code !== "EEXIST" || !lstatSync(expected).isFile() || lstatSync(expected).isSymbolicLink() || readFileSync(expected, "utf8") !== brief.text) throw error;
  }
  return expected;
}

/** Read access to precisely the supplied brief, no new source or write rights. */
export function withTaskBriefRead(canUseTool, briefPath) {
  return (tool, input, options) => tool === "Read" && briefPath && input?.file_path === briefPath
    ? { behavior: "allow", updatedInput: input }
    : canUseTool(tool, input, options);
}
