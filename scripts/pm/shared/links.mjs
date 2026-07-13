function normalizePosix(path) {
  const parts = [];
  for (const part of String(path).replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop(); else parts.push(part);
  }
  return parts.join("/");
}

export function slugify(value) {
  return String(value || "").toLowerCase().replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
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

