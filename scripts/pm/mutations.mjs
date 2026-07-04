// scripts/pm/mutations.mjs
// Pure, unit-testable helpers for mutating PM markdown + filenames.
// `scanCheckboxes` is the SINGLE canonical checkbox parser — its source is also
// injected verbatim into the browser client (see ui.mjs) so client ordinals and
// server ordinals can never drift. Keep it import-free and `.toString()`-safe.

import { isAbsolute, relative, resolve } from "node:path";

/**
 * Canonical, fence- and frontmatter-aware scan of real checkboxes (`[ ]`/`[x]`).
 * Skip-tag rows (`` `[tag]` ``) are intentionally NOT included — they aren't toggleable.
 * Returns [{ line, state }] in document order with ABSOLUTE 0-based line indices.
 * IMPORTANT: must stay byte-identical in behavior to the renderer's list parser.
 */
export function scanCheckboxes(raw) {
  var lines = String(raw).split("\n");
  var start = 0;
  if (/^---\s*$/.test(lines[0] || "")) {
    for (var j = 1; j < lines.length; j++) {
      if (/^---\s*$/.test(lines[j])) {
        start = j + 1;
        break;
      }
    }
  }
  var out = [];
  var inFence = false;
  for (var i = start; i < lines.length; i++) {
    var line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    var m = line.match(/^(\s*)(?:[-*]|\d+\.)\s+\[([ xX])\]/);
    if (m) out.push({ line: i, state: /x/i.test(m[2]) ? "done" : "open" });
  }
  return out;
}

/**
 * Flip the cbidx-th checkbox between `[ ]` and `[x]`.
 * @returns {{ok:true, raw, line, state}} | {{ok:false, reason}}
 */
export function toggleCheckbox(raw, cbidx, expectState) {
  var boxes = scanCheckboxes(raw);
  if (cbidx == null || cbidx < 0 || cbidx >= boxes.length) {
    return { ok: false, reason: "out-of-range" };
  }
  var target = boxes[cbidx];
  if (expectState && target.state !== expectState) {
    return { ok: false, reason: "drift" };
  }
  var lines = String(raw).split("\n");
  var m = lines[target.line].match(/^(\s*(?:[-*]|\d+\.)\s+\[)([ xX])(\].*)$/);
  if (!m) return { ok: false, reason: "not-a-checkbox" };
  var cur = /x/i.test(m[2]) ? "done" : "open";
  var nextChar = cur === "done" ? " " : "x";
  lines[target.line] = m[1] + nextChar + m[3];
  return {
    ok: true,
    raw: lines.join("\n"),
    line: target.line,
    state: cur === "done" ? "open" : "done",
  };
}

/** Strip a leading `N - ` numeric prefix from a basename/stem. */
export function stripNumPrefix(name) {
  return String(name).replace(/^(\d+)\s*-+\s*/, "");
}

/** True when a basename starts with a `N - ` numeric prefix. */
export function isNumbered(name) {
  return /^(\d+)\s*-+\s*/.test(String(name));
}

/** Next free integer prefix for a numbered folder, given its current basenames. */
export function nextPrefix(existingBasenames) {
  var max = 0;
  (existingBasenames || []).forEach(function (b) {
    var m = String(b).match(/^(\d+)\s*-+\s*/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return max + 1;
}

/**
 * Given the desired order of numbered .md basenames, compute the rename ops
 * needed to renumber their prefixes to 1..N. Returns [{from, to}] (changed only).
 */
export function computeRenumber(orderedBasenames) {
  var ops = [];
  (orderedBasenames || []).forEach(function (from, idx) {
    var stem = String(from).replace(/\.md$/i, "");
    var title = stripNumPrefix(stem);
    var to = idx + 1 + " - " + title + ".md";
    if (to !== from) ops.push({ from: from, to: to });
  });
  return ops;
}

/** Remove characters illegal in filenames; trim leading dots / trailing dots+spaces. */
export function sanitizeBaseName(name) {
  var n = String(name == null ? "" : name)
    .replace(/[\/\\]/g, "")
    .replace(/[\x00-\x1f<>:"|?*]/g, "")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "");
  return n;
}

/**
 * Resolve `relPath` against `rootDir` and guarantee it stays inside it.
 * Throws on path traversal. Returns the absolute path.
 */
export function resolveInside(rootDir, relPath) {
  var clean = String(relPath == null ? "" : relPath).replace(/\\/g, "/");
  var abs = resolve(rootDir, clean);
  var rel = relative(rootDir, abs);
  if (rel !== "" && (rel.startsWith("..") || isAbsolute(rel))) {
    throw new Error("Path escapes PM directory: " + relPath);
  }
  return abs;
}

/** Markdown stub for a freshly created note. */
export function fileStub(title) {
  var today = new Date().toISOString().slice(0, 10);
  return (
    "---\ncreated: " +
    today +
    "\nupdated: " +
    today +
    "\ntype: note\nstatus: active\n---\n\n# " +
    title +
    "\n\n"
  );
}

/**
 * Insert `line` at the end of the first section whose heading matches `headingRe`.
 * Falls back to appending at end-of-file. Returns the new raw text.
 */
export function appendUnderHeading(raw, headingRe, line) {
  var lines = String(raw).split("\n");
  var hIdx = -1,
    hLevel = 0;
  for (var i = 0; i < lines.length; i++) {
    var hm = lines[i].match(/^(#{1,6})\s+/);
    if (hm && headingRe.test(lines[i])) {
      hIdx = i;
      hLevel = hm[1].length;
      break;
    }
  }
  if (hIdx === -1) {
    var trimmed = String(raw).replace(/\s*$/, "");
    return trimmed + "\n" + line + "\n";
  }
  var end = lines.length;
  for (var j = hIdx + 1; j < lines.length; j++) {
    var hm2 = lines[j].match(/^(#{1,6})\s+/);
    if (hm2 && hm2[1].length <= hLevel) {
      end = j;
      break;
    }
  }
  var insertAt = end;
  while (insertAt > hIdx + 1 && /^\s*$/.test(lines[insertAt - 1])) insertAt--;
  lines.splice(insertAt, 0, line);
  return lines.join("\n");
}
