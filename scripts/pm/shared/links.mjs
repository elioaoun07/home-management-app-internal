function normalizePosix(path) {
  const parts = [];
  for (const part of String(path).replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop(); else parts.push(part);
  }
  return parts.join("/");
}

// GitHub heading slugs: authored links (`#sch-43b`, `#phase-4--deliver-…`) and
// pm:check-docs use this form, so spaces map one-to-one and hyphens never collapse.
export function slugify(value) {
  return String(value || "").toLowerCase().replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s/g, "-");
}

/** Every ATX heading outside code fences, in order, with GitHub's `-1`, `-2` duplicate suffixes. */
export function headingAnchors(raw) {
  const seen = new Map();
  const anchors = [];
  let fence = false;
  String(raw || "").split("\n").forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return; }
    const match = !fence && line.replace(/\r$/, "").match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) return;
    const base = slugify(match[1]);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    anchors.push({ line: index, text: match[1], anchor: count ? `${base}-${count}` : base });
  });
  return anchors;
}

export function resolveRelativeMd(fromRelPath, href) {
  const cleaned = decodeURIComponent(String(href || "").replace(/^<|>$/g, "")).replace(/\\/g, "/");
  if (!cleaned || /^(?:https?:|mailto:|vscode:|#)/i.test(cleaned)) return null;
  const hashAt = cleaned.indexOf("#");
  const pathPart = hashAt >= 0 ? cleaned.slice(0, hashAt) : cleaned;
  const anchor = hashAt >= 0 ? cleaned.slice(hashAt + 1) : null;
  const base = String(fromRelPath).replace(/\\/g, "/").split("/").slice(0, -1).join("/");
  const resolved = normalizePosix(`${base}/${pathPart}`);
  if (!/\.md$/i.test(resolved)) return null;
  return { relPath: resolved, anchor: anchor || null };
}

export function extractLinks(raw, fromRelPath = "") {
  const links = [];
  const re = /\[([^\]]+)\]\((<[^>]+>|[^)]+)\)/g;
  let match;
  while ((match = re.exec(String(raw)))) {
    const href = match[2].replace(/^<|>$/g, "");
    links.push({ text: match[1], href, resolved: resolveRelativeMd(fromRelPath, href) });
  }
  return links;
}

