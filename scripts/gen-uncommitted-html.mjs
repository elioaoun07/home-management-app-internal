#!/usr/bin/env node
// Generate a self-contained HTML page linking every currently-uncommitted file.
// Usage:
//   node scripts/gen-uncommitted-html.mjs [name]
//   pnpm gen:uncommitted [name]
// [name] is the output file (".html" optional). Default: "uncommitted-files".
// If [name] contains a path separator it is resolved from the current dir,
// otherwise it is written to the repo root.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// --- git ---------------------------------------------------------------
function gitStatus() {
  const out = execFileSync("git", ["status", "--porcelain", "-uall"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return out;
}

// git C-quotes paths with non-ASCII/space bytes ("a\342\200\224b"); decode to UTF-8.
function unquoteGitPath(p) {
  if (!p.startsWith('"')) return p;
  const inner = p.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\") {
      const n = inner[i + 1];
      if (n === "n") { bytes.push(10); i++; }
      else if (n === "t") { bytes.push(9); i++; }
      else if (n === "r") { bytes.push(13); i++; }
      else if (n === '"') { bytes.push(34); i++; }
      else if (n === "\\") { bytes.push(92); i++; }
      else if (n >= "0" && n <= "7") { bytes.push(parseInt(inner.substr(i + 1, 3), 8)); i += 3; }
      else { bytes.push(c.charCodeAt(0)); }
    } else {
      bytes.push(c.charCodeAt(0));
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function parse(raw) {
  const entries = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const xy = line.slice(0, 2);
    let pathPart = line.slice(3);
    if (pathPart.includes(" -> ")) {
      const parts = pathPart.split(" -> ");
      pathPart = parts[parts.length - 1]; // renamed/copied: keep destination
    }
    entries.push({ s: xy, p: unquoteGitPath(pathPart) });
  }
  return entries;
}

// --- html --------------------------------------------------------------
const TEMPLATE = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{TITLE}}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: #0d1117; color: #e6edf3; margin: 0;
    padding: 2rem clamp(1rem, 4vw, 3rem); line-height: 1.6;
  }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  .sub { color: #8b949e; margin: 0 0 1.5rem; font-size: .82rem; }
  .sub code { color: #e3b341; }
  .controls {
    display: flex; flex-wrap: wrap; gap: .6rem; align-items: center;
    padding: .9rem 1rem; margin-bottom: 1.5rem;
    background: #161b22; border: 1px solid #30363d; border-radius: 10px;
  }
  .controls label { color: #8b949e; font-size: .75rem; }
  input, select, textarea, button {
    font-family: inherit; font-size: .82rem;
    background: #0d1117; color: #e6edf3;
    border: 1px solid #30363d; border-radius: 6px; padding: .4rem .6rem;
  }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #1f6feb; }
  input#q { flex: 1 1 220px; min-width: 160px; }
  button { cursor: pointer; }
  button:hover { border-color: #1f6feb; color: #79c0ff; }
  .custom-wrap { flex-basis: 100%; display: none; gap: .5rem; flex-direction: column; }
  .custom-wrap.show { display: flex; }
  .custom-wrap textarea { width: 100%; min-height: 8rem; resize: vertical; line-height: 1.5; }
  .custom-wrap .tip { color: #6e7681; font-size: .72rem; }
  .count { font-size: .75rem; font-weight: 600; padding: .1rem .5rem; border-radius: 999px; background: #1f6feb33; color: #79c0ff; }
  .seclabel {
    color: #79c0ff; font-size: .72rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: .06em; margin: 1.3rem 0 .35rem;
  }
  ol { list-style: none; margin: 0; padding: 0; }
  a.file {
    display: flex; align-items: baseline; gap: .15rem;
    padding: .4rem .6rem; border-radius: 6px; color: #e6edf3;
    text-decoration: none; font-size: .84rem; word-break: break-all;
    border: 1px solid transparent;
  }
  a.file:hover { background: #161b22; border-color: #30363d; }
  a.file .num { color: #6e7681; min-width: 1.9rem; text-align: right; flex: 0 0 auto; }
  a.file .badge {
    flex: 0 0 auto; font-size: .62rem; font-weight: 700; letter-spacing: .04em;
    padding: .05rem .4rem; border-radius: 4px; align-self: center; margin-right: .2rem;
  }
  .b-new { background: #1f6feb33; color: #79c0ff; }
  .b-mod { background: #9e6a0333; color: #e3b341; }
  .b-add { background: #23863633; color: #7ee787; }
  .b-del { background: #da363333; color: #ff7b72; }
  .b-ren { background: #8957e533; color: #d2a8ff; }
  a.file .dir { color: #8b949e; }
  a.file .name { color: #e6edf3; }
  a.file:hover .name { color: #79c0ff; }
  .empty { color: #6e7681; padding: 2rem 0; }
  .hint {
    margin-top: 2.5rem; padding: 1rem;
    background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    color: #8b949e; font-size: .78rem;
  }
  .hint code { color: #e3b341; }
</style>
</head>
<body>
  <h1>{{TITLE}} <span class="count" id="count"></span></h1>
  <p class="sub">Generated {{GENERATED}} &middot; click a file to open it in VS Code. Regenerate with <code>pnpm gen:uncommitted {{TITLE}}</code>.</p>

  <div class="controls">
    <input id="q" type="search" placeholder="Filter files…" autocomplete="off">
    <label for="sort">Order</label>
    <select id="sort">
      <option value="new-first">New first</option>
      <option value="git">Git order</option>
      <option value="folder">Folder</option>
      <option value="name">File name</option>
      <option value="custom">Custom…</option>
    </select>
    <button id="reset" type="button" title="Clear filter &amp; custom order">Reset</button>
    <div class="custom-wrap" id="custom-wrap">
      <textarea id="custom" placeholder="One match per line, top = first. A file sorts to the first line that is a substring of its path (case-insensitive). Unmatched files go last.&#10;&#10;Example:&#10;SESSION-BRIEF&#10;10x Portfolio&#10;Top Layer &#8212; ASTRA Architecture&#10;Command Center"></textarea>
      <span class="tip">Saved automatically for this page. Lines are matched as plain substrings against each file path.</span>
    </div>
  </div>

  <div id="root"></div>

  <div class="hint">
    Links use <code>vscode://file/</code> so they open in VS Code. If a link does nothing, your browser may ask permission to open VS Code &mdash; allow it. This page is untracked; delete it after you commit.
  </div>

<script>
  const DATA = {{DATA}};
  const BASE = "{{BASE}}";
  const TITLE = "{{TITLE}}";
  const LS_ORDER = "uncommitted:" + TITLE + ":custom";
  const LS_MODE = "uncommitted:" + TITLE + ":mode";

  function cat(s) {
    if (s === "??") return "new";
    if (s.includes("D")) return "del";
    if (s.includes("R")) return "ren";
    if (s.includes("A")) return "add";
    return "mod";
  }
  const CAT_LABEL = { new: "NEW", mod: "MOD", add: "ADD", del: "DEL", ren: "REN" };
  const CAT_ORDER = { new: 0, add: 1, mod: 2, ren: 3, del: 4 };
  const CAT_SECTION = { new: "New (untracked)", add: "Added", mod: "Modified", ren: "Renamed", del: "Deleted" };

  const q = document.getElementById("q");
  const sortSel = document.getElementById("sort");
  const customWrap = document.getElementById("custom-wrap");
  const customTa = document.getElementById("custom");
  const root = document.getElementById("root");
  const countEl = document.getElementById("count");

  sortSel.value = localStorage.getItem(LS_MODE) || "new-first";
  customTa.value = localStorage.getItem(LS_ORDER) || "";

  function customRank(pathLower, lines) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] && pathLower.includes(lines[i])) return i;
    }
    return Number.MAX_SAFE_INTEGER;
  }

  function sortEntries(entries, mode) {
    const e = entries.slice();
    if (mode === "git") return e;
    if (mode === "name") {
      return e.sort((a, b) => a.p.split("/").pop().localeCompare(b.p.split("/").pop()));
    }
    if (mode === "folder") {
      return e.sort((a, b) => a.p.localeCompare(b.p));
    }
    if (mode === "custom") {
      const lines = customTa.value.split("\n").map(function (l) { return l.trim().toLowerCase(); });
      return e.sort(function (a, b) {
        const ra = customRank(a.p.toLowerCase(), lines);
        const rb = customRank(b.p.toLowerCase(), lines);
        if (ra !== rb) return ra - rb;
        return a.p.localeCompare(b.p);
      });
    }
    // new-first
    return e.sort(function (a, b) {
      const ca = CAT_ORDER[cat(a.s)], cb = CAT_ORDER[cat(b.s)];
      if (ca !== cb) return ca - cb;
      return a.p.localeCompare(b.p);
    });
  }

  function fileLink(entry, num) {
    const rel = entry.p;
    const c = cat(entry.s);
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "file";
    a.href = BASE + encodeURI(rel);
    const slash = rel.lastIndexOf("/");
    const dir = slash >= 0 ? rel.slice(0, slash + 1) : "";
    const name = slash >= 0 ? rel.slice(slash + 1) : rel;
    a.innerHTML = '<span class="num"></span><span class="badge b-' + c + '"></span><span class="dir"></span><span class="name"></span>';
    a.querySelector(".num").textContent = num + ".";
    a.querySelector(".badge").textContent = CAT_LABEL[c];
    a.querySelector(".dir").textContent = dir;
    a.querySelector(".name").textContent = name;
    li.appendChild(a);
    return li;
  }

  function render() {
    const mode = sortSel.value;
    customWrap.classList.toggle("show", mode === "custom");
    const term = q.value.trim().toLowerCase();
    let entries = DATA.filter(function (e) { return !term || e.p.toLowerCase().includes(term); });
    entries = sortEntries(entries, mode);
    countEl.textContent = entries.length + (entries.length === DATA.length ? "" : " / " + DATA.length);
    root.innerHTML = "";
    if (!entries.length) {
      root.innerHTML = '<div class="empty">No files match.</div>';
      return;
    }
    const grouped = mode === "new-first";
    let n = 0, lastSec = null, ol = null;
    for (const e of entries) {
      if (grouped) {
        const sec = CAT_SECTION[cat(e.s)];
        if (sec !== lastSec) {
          const label = document.createElement("div");
          label.className = "seclabel";
          label.textContent = sec;
          root.appendChild(label);
          ol = document.createElement("ol");
          root.appendChild(ol);
          lastSec = sec;
        }
      } else if (!ol) {
        ol = document.createElement("ol");
        root.appendChild(ol);
      }
      n++;
      ol.appendChild(fileLink(e, n));
    }
  }

  q.addEventListener("input", render);
  sortSel.addEventListener("change", function () {
    localStorage.setItem(LS_MODE, sortSel.value);
    render();
  });
  customTa.addEventListener("input", function () {
    localStorage.setItem(LS_ORDER, customTa.value);
    render();
  });
  document.getElementById("reset").addEventListener("click", function () {
    q.value = "";
    customTa.value = "";
    localStorage.removeItem(LS_ORDER);
    render();
  });

  render();
</script>
</body>
</html>
`;

function buildHtml(entries, title, generated) {
  const dataJson = JSON.stringify(entries).replace(/</g, "\\u003c");
  const base = "vscode://file/" + repoRoot.replace(/\\/g, "/").replace(/\/$/, "") + "/";
  return TEMPLATE
    .split("{{DATA}}").join(dataJson)
    .split("{{BASE}}").join(base)
    .split("{{TITLE}}").join(title)
    .split("{{GENERATED}}").join(generated);
}

// --- main --------------------------------------------------------------
function main() {
  const arg = (process.argv[2] || "uncommitted-files").trim();
  const name = arg.replace(/\.html?$/i, "");
  const hasSep = arg.includes("/") || arg.includes("\\");
  const outPath = hasSep
    ? path.resolve(process.cwd(), name + ".html")
    : path.resolve(repoRoot, name + ".html");
  const title = path.basename(name);

  const entries = parse(gitStatus());
  const html = buildHtml(entries, title, new Date().toLocaleString());
  fs.writeFileSync(outPath, html, "utf8");

  console.log("Wrote " + entries.length + " uncommitted files to " + outPath);
}

main();
