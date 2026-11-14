import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

export const eventFile = (root, id) =>
  resolve(
    root,
    ".os/events",
    `${createHash("sha256").update(id).digest("hex")}.jsonl`,
  );
export function gitFact(root, ...args) {
  const result = spawnSync("git", ["--no-optional-locks", ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 3000,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}
