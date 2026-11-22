export function stripFences(raw) {
  let inFence = false;
  return String(raw).split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return ""; }
    return inFence ? "" : line;
  }).join("\n");
}

/** A title without the preceding standalone work ID already shown by the UI.
 * @param {string} title @param {string|null} [id]
 */
export function bareTitle(title, id = null) {
  if (!id) return title;
  const rest = title.slice(id.length);
  return title.slice(0, id.length).toUpperCase() === id.toUpperCase() && /^[\s·:—–]/u.test(rest)
    ? rest.replace(/^[\s·:—–-]+/u, "") : title;
}

export function localItemTitle(title, id) {
  let next = bareTitle(title, id);
  while (next !== title) {
    title = next;
    next = bareTitle(title, id);
  }
  return title.replace(/\s+— criteria$/u, "");
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
