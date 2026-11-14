import { posix } from "node:path";

// Claude Edit/Write and Codex apply_patch (including multi-file moves).
export function toolPaths(payload) {
  const input = payload.tool_input;
  const paths = [input?.file_path ?? payload.file_path];
  if (payload.tool_name === "apply_patch") {
    const patch = typeof input === "string" ? input : input?.command ?? input?.patch ?? "";
    for (const match of patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)\r?$/gm)) {
      paths.push(match[1]);
    }
  }
  return paths.filter((path) => typeof path === "string").map((path) => posix.normalize(path.replaceAll("\\", "/").trim()));
}
