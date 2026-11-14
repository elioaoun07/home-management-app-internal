import { spawnSync } from "node:child_process";
// Standard Git revert trailers are witnesses; arbitrary prose is not a revert.
export function revertHistory(root) {
  const result = spawnSync(
    "git",
    ["--no-optional-locks", "log", "--all", "--format=%H%x00%aI%x00%B%x00"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    },
  );
  if (result.error || result.status !== 0) return null;
  const parts = result.stdout.split("\0"),
    rows = [];
  for (let i = 0; i + 2 < parts.length; i += 3) {
    const commit = parts[i].trim(),
      at = parts[i + 1],
      body = parts[i + 2];
    if (!/^[a-f0-9]{40,64}$/.test(commit)) continue;
    for (const m of body.matchAll(
      /^This reverts commit ([a-f0-9]{40,64})[.,]?/gm,
    ))
      rows.push({ commit, at, target: m[1] });
  }
  return rows;
}
export function candidateReverts(root, history, { base, head, merge }) {
  if (!history) return null;
  const targets = new Set([head, merge].filter(Boolean));
  if (base && head) {
    const result = spawnSync(
      "git",
      ["--no-optional-locks", "rev-list", base + ".." + head],
      { cwd: root, encoding: "utf8", windowsHide: true },
    );
    if (result.status !== 0) return null;
    for (const commit of result.stdout.trim().split("\n"))
      if (commit) targets.add(commit);
  }
  return history.filter((row) => targets.has(row.target));
}
