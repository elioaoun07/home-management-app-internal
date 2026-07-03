// scripts/pm/scan.mjs
// Shared filesystem scanning for the PM dashboard (static build + live server).
// Zero dependencies — Node built-ins only.

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative, resolve, extname } from "node:path";

// Directories never walked (trash + anything hidden).
const SKIP_DIR = /^\./;

/**
 * Recursively collect every .md file under `dir`.
 * Returns [{ relPath, raw, mtimeMs, absDir }] with POSIX-style relPaths.
 */
export function walk(dir, base = "") {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIR.test(entry)) continue; // skip .trash, .git, etc.
      out.push(...walk(full, base + entry + "/"));
    } else if (/\.md$/i.test(entry)) {
      out.push({
        relPath: base + entry,
        raw: readFileSync(full, "utf8"),
        mtimeMs: st.mtimeMs,
        absDir: dir,
      });
    }
  }
  return out;
}

const TEXT_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".css", ".scss",
  ".json", ".html", ".htm", ".xml", ".sh", ".bash", ".yml", ".yaml",
]);
const MAX_SRC_BYTES = 140000;

// Pull every `](href)` link target and `` `inline code` `` token out of a doc.
function candidatesFrom(raw) {
  const set = new Set();
  raw.replace(/\]\((<[^>]+>|[^)\s]+)\)/g, (m, h) => {
    set.add(h);
    return m;
  });
  raw.replace(/`([^`\n]+)`/g, (m, c) => {
    set.add(c);
    return m;
  });
  return set;
}

// Resolve a candidate string to an absolute repo path, or null if it isn't a path.
function candAbs(cand, absDir, root) {
  let c = cand.trim().replace(/^<|>$/g, "");
  const lm = c.match(/:(\d+)(-\d+)?$/);
  if (lm) c = c.slice(0, c.length - lm[0].length); // drop :line / :line-line
  if (!c || /\s/.test(c) || /^https?:|^mailto:|^#/.test(c) || /\.md$/i.test(c)) return null;
  if (!c.includes("/")) return null;
  return /^(src|migrations|scripts|public|docs|ERA Notes)\//i.test(c)
    ? join(root, c)
    : resolve(absDir, c);
}

/**
 * Find every source file referenced by the docs and (optionally) read its code.
 * @param {Array} files  output of walk()
 * @param {string} root  repo root absolute path
 * @param {{ keysOnly?: boolean }} [opts]  keysOnly skips reading file bodies (server lazy-load)
 * @returns {Object} map of repoRelPath -> { code, truncated }  (code is "" when keysOnly)
 */
export function collectSources(files, root, opts = {}) {
  const keysOnly = !!opts.keysOnly;
  const sources = {};
  function addSource(rel, abs) {
    if (sources[rel]) return;
    if (keysOnly) {
      sources[rel] = { code: "", truncated: false };
      return;
    }
    let code = readFileSync(abs, "utf8");
    let truncated = false;
    if (code.length > MAX_SRC_BYTES) {
      code = code.slice(0, MAX_SRC_BYTES);
      truncated = true;
    }
    sources[rel] = { code, truncated };
  }
  for (const f of files) {
    for (const cand of candidatesFrom(f.raw)) {
      const abs = candAbs(cand, f.absDir, root);
      if (!abs || !existsSync(abs)) continue;
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (!st.isFile() || !TEXT_EXTS.has(extname(abs).toLowerCase())) continue;
      const rel = relative(root, abs).replace(/\\/g, "/");
      if (rel.startsWith("..")) continue; // outside the repo
      addSource(rel, abs);
    }
  }
  return sources;
}

/**
 * Read a single referenced source file on demand (server preview panel).
 * Validates the extension and truncates large files. Returns null if missing/disallowed.
 */
export function readSourceFile(root, repoRel) {
  const abs = resolve(root, repoRel);
  const rel = relative(root, abs).replace(/\\/g, "/");
  if (rel.startsWith("..")) return null; // outside the repo
  if (!TEXT_EXTS.has(extname(abs).toLowerCase())) return null;
  if (!existsSync(abs)) return null;
  let st;
  try {
    st = statSync(abs);
  } catch {
    return null;
  }
  if (!st.isFile()) return null;
  let code = readFileSync(abs, "utf8");
  let truncated = false;
  if (code.length > MAX_SRC_BYTES) {
    code = code.slice(0, MAX_SRC_BYTES);
    truncated = true;
  }
  return { code, truncated };
}
