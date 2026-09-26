export function stripFences(raw) {
  let inFence = false;
  return String(raw).split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return ""; }
    return inFence ? "" : line;
  }).join("\n");
}

export function cleanInlineText(value) {
  return String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\((?:<[^>]+>|[^)]+)\)/g, "$1")
    .replace(/\s+_\([^)]*\)_\s*$/g, "")
    .replace(/[`*~]/g, "")
    // Emphasis underscores only; NOT_TESTED keeps its intra-word underscore.
    .replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, "")
    .replace(/\s+/g, " ").trim();
}
