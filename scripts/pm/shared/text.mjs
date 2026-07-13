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
    .replace(/[`*_~]/g, "")
    .replace(/\s+_\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ").trim();
}

