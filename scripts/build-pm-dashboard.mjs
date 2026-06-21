// scripts/build-pm-dashboard.mjs
// One-shot generator: walks "ERA Notes/10 - Project Management/" and builds a
// single self-contained HTML dashboard (_dashboard.html) with all docs embedded.
// No deps, no network, no server. Re-run anytime the PM notes change:
//   node scripts/build-pm-dashboard.mjs

import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PM_REL = join("ERA Notes", "10 - Project Management");
const PM_DIR = join(ROOT, PM_REL);
const OUT_FILE = join(PM_DIR, "_dashboard.html");

function walk(dir, base) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
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

const files = walk(PM_DIR, "");

// ---- Embed every source file the notes reference, so code links open an in-dashboard
// preview (browsers can't render .ts/.sql inline — a file:// link just downloads them). ----
const TEXT_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".css", ".scss", ".json", ".html", ".htm", ".xml", ".sh", ".bash", ".yml", ".yaml"]);
const MAX_SRC_BYTES = 140000;
const sources = {};
function addSource(repoRel, abs) {
  if (sources[repoRel]) return;
  let code = readFileSync(abs, "utf8");
  let truncated = false;
  if (code.length > MAX_SRC_BYTES) { code = code.slice(0, MAX_SRC_BYTES); truncated = true; }
  sources[repoRel] = { code, truncated };
}
function candidatesFrom(raw) {
  const set = new Set();
  raw.replace(/\]\((<[^>]+>|[^)\s]+)\)/g, (m, h) => { set.add(h); return m; }); // [..](href)
  raw.replace(/`([^`\n]+)`/g, (m, c) => { set.add(c); return m; });              // `inline code`
  return set;
}
function candAbs(cand, absDir) {
  let c = cand.trim().replace(/^<|>$/g, "");
  const lm = c.match(/:(\d+)(-\d+)?$/);
  if (lm) c = c.slice(0, c.length - lm[0].length); // drop :line / :line-line
  if (!c || /\s/.test(c) || /^https?:|^mailto:|^#/.test(c) || /\.md$/i.test(c)) return null;
  if (!c.includes("/")) return null;
  return /^(src|migrations|scripts|public|docs|ERA Notes)\//i.test(c) ? join(ROOT, c) : resolve(absDir, c);
}
for (const f of files) {
  for (const cand of candidatesFrom(f.raw)) {
    const abs = candAbs(cand, f.absDir);
    if (!abs || !existsSync(abs)) continue;
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (!st.isFile() || !TEXT_EXTS.has(extname(abs).toLowerCase())) continue;
    const rel = relative(ROOT, abs).replace(/\\/g, "/");
    if (rel.startsWith("..")) continue; // outside the repo
    addSource(rel, abs);
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  repoRootFileUrl: pathToFileURL(ROOT).href.replace(/\/$/, "") + "/",
  repoRootPath: ROOT.replace(/\\/g, "/"),
  pmDirRepoRel: PM_REL.replace(/\\/g, "/"),
  sources,
  files: files.map((f) => ({
    relPath: f.relPath,
    raw: f.raw,
    mtimeMs: f.mtimeMs,
    repoDir: relative(ROOT, f.absDir).replace(/\\/g, "/"),
  })),
};

let jsonString = JSON.stringify(payload).replace(/<\/script/gi, "<\\/script");

function buildHtml(dataJson) {
  return (
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "<title>PM Command Center</title>\n" +
    "<style>\n" + CSS + "\n</style>\n" +
    "</head>\n" +
    "<body>\n" + BODY + "\n" +
    "<script>\n" +
    "var PM_DATA = " + dataJson + ";\n" +
    JS +
    "\n</script>\n" +
    "</body>\n</html>\n"
  );
}

const CSS = `
:root{
  --bg:#0d0f13; --bg-alt:#13161c; --card:#171a21; --card-hover:#1d212a;
  --border:#262b35; --border-soft:#1f2330;
  --text:#e7e9ee; --muted:#9399a6; --muted-2:#5f6573;
  --accent:#4da3ff; --accent-soft:#1b3252;
  --red:#ef4444; --orange:#f59e0b; --yellow:#eab308; --gray:#6b7280; --green:#22c55e;
  --mono: "SF Mono", Consolas, "Cascadia Mono", monospace;
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  font-size:15px;line-height:1.55;}
#app{display:flex;min-height:100vh;}
#sidebar{width:300px;flex:0 0 300px;background:var(--bg-alt);border-right:1px solid var(--border);
  display:flex;flex-direction:column;height:100vh;position:sticky;top:0;overflow:hidden;}
#sidebar-header{padding:16px 16px 10px;border-bottom:1px solid var(--border-soft);}
#sidebar-header h1{font-size:15px;margin:0 0 2px;letter-spacing:.02em;color:var(--text);}
#generated-at{font-size:11px;color:var(--muted-2);margin-bottom:10px;}
#search{width:100%;background:var(--card);border:1px solid var(--border);color:var(--text);
  padding:7px 10px;border-radius:6px;font-size:13px;outline:none;}
#search:focus{border-color:var(--accent);}
#search-results{position:absolute;left:16px;right:16px;top:84px;background:var(--card);
  border:1px solid var(--border);border-radius:8px;max-height:60vh;overflow:auto;
  box-shadow:0 12px 28px rgba(0,0,0,.5);z-index:40;display:none;}
#search-results.show{display:block;}
.sr-item{padding:9px 12px;border-bottom:1px solid var(--border-soft);cursor:pointer;}
.sr-item:last-child{border-bottom:none;}
.sr-item:hover,.sr-item.kbd-active{background:var(--card-hover);}
.sr-title{font-size:13px;color:var(--text);}
.sr-path{font-size:11px;color:var(--muted-2);margin-top:2px;}
.sr-snippet{font-size:11px;color:var(--muted-2);margin-top:3px;line-height:1.4;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.sr-snippet mark{background:rgba(77,163,255,.25);color:var(--text);border-radius:2px;padding:0 1px;}
.sr-kind{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted-2);
  border:1px solid var(--border);border-radius:4px;padding:0 4px;margin-left:6px;}
#tree{flex:1;overflow-y:auto;padding:8px 8px 24px;}
.quicklinks{display:flex;flex-direction:column;gap:2px;margin-bottom:10px;padding-bottom:10px;
  border-bottom:1px solid var(--border-soft);}
.qlink{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;color:var(--text);
  text-decoration:none;font-size:13.5px;cursor:pointer;}
.qlink:hover{background:var(--card-hover);}
.qlink.active{background:var(--accent-soft);color:var(--accent);}
details.group{margin-bottom:2px;}
details.group > summary{list-style:none;cursor:pointer;padding:7px 8px;border-radius:6px;
  font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:8px;}
details.group > summary::-webkit-details-marker{display:none;}
details.group > summary:hover{background:var(--card-hover);}
details.group > summary:before{content:"▸";display:inline-block;width:10px;color:var(--muted-2);
  transition:transform .12s;}
details.group[open] > summary:before{transform:rotate(90deg);}
.group-body{padding-left:16px;display:flex;flex-direction:column;gap:1px;margin-top:1px;}
details.subgroup{margin:2px 0;}
details.subgroup > summary{list-style:none;cursor:pointer;padding:5px 8px;border-radius:6px;
  font-size:12px;font-weight:600;color:var(--muted);display:flex;align-items:center;gap:6px;}
details.subgroup > summary::-webkit-details-marker{display:none;}
details.subgroup > summary:hover{background:var(--card-hover);}
details.subgroup > summary:before{content:"▸";display:inline-block;width:10px;font-size:10px;
  transition:transform .12s;}
details.subgroup[open] > summary:before{transform:rotate(90deg);}
.file-link{display:flex;align-items:center;gap:7px;padding:6px 8px 6px 10px;border-radius:6px;
  color:var(--muted);text-decoration:none;font-size:12.8px;white-space:nowrap;overflow:hidden;}
.file-link .ft{overflow:hidden;text-overflow:ellipsis;}
.file-link:hover{background:var(--card-hover);color:var(--text);}
.file-link.active{background:var(--accent-soft);color:var(--accent);font-weight:600;}
.file-link.module-link{font-weight:600;color:var(--text);}
.mini-badge{margin-left:auto;font-size:10.5px;color:var(--muted-2);font-family:var(--mono);
  flex:0 0 auto;padding-left:6px;}
.dot{width:6px;height:6px;border-radius:50%;flex:0 0 auto;}
.dot-red{background:var(--red);} .dot-orange{background:var(--orange);}
#sidebar-toggle{display:none;}
main#content{flex:1;min-width:0;height:100vh;overflow-y:auto;}
#topbar{position:sticky;top:0;background:rgba(13,15,19,.92);backdrop-filter:blur(6px);
  border-bottom:1px solid var(--border-soft);padding:12px 32px;z-index:20;}
#breadcrumb{font-size:12.5px;color:var(--muted-2);display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
#breadcrumb a{color:var(--muted);text-decoration:none;cursor:pointer;}
#breadcrumb a:hover{color:var(--accent);}
.wrap{max-width:880px;margin:0 auto;padding:28px 32px 80px;}
.pagehead h1{font-size:26px;margin:4px 0 10px;}
.badges-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;}
.badge{font-size:11px;padding:3px 9px;border-radius:20px;border:1px solid var(--border);
  color:var(--muted);background:var(--card);}
.badge.b-status-living{border-color:#2f6d3a;color:#5fd982;}
.badge.b-status-active{border-color:#2f5a8c;color:#6fb0ff;}
.badge.b-status-implemented{border-color:#5a4f99;color:#b39dff;}
.progress-box{background:var(--card);border:1px solid var(--border);border-radius:10px;
  padding:10px 14px;margin-bottom:22px;font-size:12.5px;color:var(--muted);}
.progress-bar{height:6px;border-radius:4px;background:var(--border);overflow:hidden;margin-top:7px;}
.progress-bar > span{display:block;height:100%;background:var(--accent);}
.toc-box{background:var(--card);border:1px solid var(--border);border-radius:10px;
  padding:12px 16px;margin-bottom:24px;font-size:12.8px;}
.toc-box summary{cursor:pointer;color:var(--muted);font-weight:600;font-size:12px;
  text-transform:uppercase;letter-spacing:.04em;}
.toc-box ul{margin:10px 0 0;padding-left:18px;}
.toc-box li{margin-bottom:4px;}
.toc-box a{color:var(--muted);text-decoration:none;}
.toc-box a:hover{color:var(--accent);}
article{font-size:15px;color:var(--text);}
article h1{font-size:24px;margin:30px 0 14px;border-bottom:1px solid var(--border-soft);padding-bottom:8px;}
article h2{font-size:19px;margin:28px 0 12px;}
article h3{font-size:16px;margin:22px 0 10px;}
article h4{font-size:14px;margin:18px 0 8px;color:var(--muted);}
article p{margin:10px 0;color:#d6d9df;}
article blockquote{margin:14px 0;padding:8px 16px;border-left:3px solid var(--accent);
  background:var(--card);color:var(--muted);border-radius:0 6px 6px 0;}
article ul,article ol{padding-left:24px;margin:8px 0;}
article li{margin:4px 0;}
article li.task{list-style:none;margin-left:-22px;padding-left:0;display:flex;gap:8px;align-items:flex-start;}
article li.task > .cb{margin-top:5px;width:13px;height:13px;border-radius:3px;border:1.5px solid var(--muted-2);
  flex:0 0 auto;display:inline-block;}
article li.task.done > .cb{background:var(--green);border-color:var(--green);}
article li.task.done{color:var(--muted-2);}
article li.task.done .cb-inner-text{text-decoration:line-through;}
article li.task.skipped > .cb{background:var(--gray);border-color:var(--gray);position:relative;}
article li.task.open > .cb{}
article code{background:var(--card);border:1px solid var(--border);padding:1px 5px;border-radius:4px;
  font-family:var(--mono);font-size:13px;}
article pre{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px 16px;
  overflow-x:auto;margin:14px 0;}
article pre code{background:none;border:none;padding:0;}
article table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13.3px;}
article th,article td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top;}
article th{background:var(--card);color:var(--muted);font-weight:600;}
article tr:nth-child(even) td{background:rgba(255,255,255,.015);}
article hr{border:none;border-top:1px solid var(--border-soft);margin:26px 0;}
article a{color:var(--accent);text-decoration:none;}
article a:hover{text-decoration:underline;}
article a.broken-link{color:var(--muted-2);text-decoration:underline dashed;cursor:default;}
article a.code-ref{color:#c792ea;font-family:var(--mono);font-size:13px;}
article a.src-ref{text-decoration:none;border-bottom:1px dashed var(--accent-soft);}
article a.src-ref:hover{border-bottom-color:var(--accent);text-decoration:none;}
article a.src-ref code{color:#c792ea;cursor:pointer;}
article strong{color:#fff;}
/* ---- source preview panel ---- */
#preview-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:55;display:none;}
body.pv-open #preview-backdrop{display:block;}
#preview{position:fixed;top:0;right:0;width:min(680px,94vw);max-width:94vw;height:100vh;background:var(--bg-alt);
  border-left:1px solid var(--border);z-index:60;display:flex;flex-direction:column;
  transform:translateX(105%);transition:transform .18s ease;box-shadow:-14px 0 44px rgba(0,0,0,.55);}
body.pv-open #preview{transform:translateX(0);}
#preview-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border-soft);flex:0 0 auto;}
#preview-name{font-family:var(--mono);font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
#preview-lang{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--accent);
  border:1px solid var(--accent-soft);border-radius:4px;padding:1px 7px;flex:0 0 auto;}
#preview-open{font-size:11.5px;color:var(--muted);text-decoration:none;flex:0 0 auto;white-space:nowrap;}
#preview-open:hover{color:var(--accent);}
#preview-close{background:none;border:none;color:var(--muted);font-size:17px;line-height:1;cursor:pointer;flex:0 0 auto;padding:2px 4px;}
#preview-close:hover{color:var(--text);}
#preview-body{flex:1;overflow:auto;background:var(--bg);}
#preview-body pre{margin:0;padding:14px 16px 40px;font-family:var(--mono);font-size:12.5px;line-height:1.6;
  white-space:pre;color:#d6d9df;tab-size:2;}
.c-com{color:#5f6573;font-style:italic;} .c-str{color:#e5b567;} .c-num{color:#7fd1c8;}
.c-kw{color:#c792ea;} .c-tag{color:#7aa2f7;} .c-attr{color:#7fd1c8;}
@media (max-width:860px){#preview{width:100vw;max-width:100vw;}}
.home-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-top:18px;}
.mod-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;
  cursor:pointer;transition:border-color .12s, transform .12s;}
.mod-card:hover{border-color:var(--accent);transform:translateY(-1px);}
.mod-card .mc-top{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14.5px;margin-bottom:8px;}
.mod-card .mc-updated{font-size:11px;color:var(--muted-2);margin-top:10px;}
.bug-pills{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}
.bug-pill{font-size:11px;padding:2px 7px;border-radius:20px;font-weight:600;}
.bug-pill.red{background:rgba(239,68,68,.15);color:var(--red);}
.bug-pill.orange{background:rgba(245,158,11,.15);color:var(--orange);}
.bug-pill.yellow{background:rgba(234,179,8,.15);color:var(--yellow);}
.bug-pill.gray{background:rgba(107,114,128,.15);color:var(--gray);}
.callout{background:linear-gradient(135deg,var(--accent-soft),var(--card));border:1px solid var(--border);
  border-radius:12px;padding:16px 18px;margin:18px 0 26px;}
.callout h3{margin:0 0 8px;font-size:14px;color:var(--accent);}
.section-h{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted-2);
  margin:30px 0 4px;font-weight:700;}
.rollup-mod{margin-bottom:26px;}
.rollup-mod-title{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700;margin-bottom:8px;}
.rollup-row{display:flex;gap:10px;align-items:flex-start;padding:7px 10px;border-radius:8px;
  background:var(--card);border:1px solid var(--border-soft);margin-bottom:6px;font-size:13px;cursor:pointer;}
.rollup-row:hover{border-color:var(--accent);}
.rollup-row .rr-src{font-size:11px;color:var(--muted-2);margin-top:3px;}
.toggle-resolved{font-size:12px;color:var(--muted);cursor:pointer;text-decoration:underline dashed;
  margin:6px 0 14px;display:inline-block;}
.resolved-block{display:none;}
.resolved-block.show{display:block;}
.file-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;
  background:var(--card);border:1px solid var(--border-soft);border-radius:8px;margin-bottom:6px;
  cursor:pointer;font-size:13.5px;}
.file-row:hover{border-color:var(--accent);}
.file-row .fr-stats{font-size:11.5px;color:var(--muted-2);font-family:var(--mono);flex:0 0 auto;}
.empty-note{color:var(--muted-2);font-size:13px;font-style:italic;}
@media (max-width:860px){
  #sidebar{position:fixed;left:-320px;top:0;z-index:50;transition:left .18s;width:280px;box-shadow:0 0 40px rgba(0,0,0,.5);}
  body.sb-open #sidebar{left:0;}
  #sidebar-toggle{display:flex;position:fixed;top:10px;left:10px;z-index:60;width:38px;height:38px;
    align-items:center;justify-content:center;background:var(--card);border:1px solid var(--border);
    border-radius:8px;color:var(--text);font-size:18px;cursor:pointer;}
  #topbar{padding:12px 16px 12px 56px;}
  .wrap{padding:20px 16px 60px;}
}
@media print{
  #sidebar,#sidebar-toggle,#topbar,.toc-box{display:none !important;}
  main#content{height:auto;overflow:visible;}
}
`;

const BODY = `
<div id="app">
  <aside id="sidebar">
    <div id="sidebar-header">
      <h1>PM Command Center</h1>
      <div id="generated-at"></div>
      <input id="search" placeholder="Search docs... ( / )" autocomplete="off">
      <div id="search-results"></div>
    </div>
    <nav id="tree"></nav>
  </aside>
  <button id="sidebar-toggle">☰</button>
  <main id="content">
    <div id="topbar"><div id="breadcrumb"></div></div>
    <div class="wrap" id="view"></div>
  </main>
</div>
<div id="preview-backdrop"></div>
<aside id="preview">
  <div id="preview-head">
    <span id="preview-name"></span>
    <span id="preview-lang"></span>
    <a id="preview-open" target="_blank" rel="noopener">Open in VS Code ↗</a>
    <button id="preview-close" title="Close (Esc)">✕</button>
  </div>
  <div id="preview-body"><pre><code id="preview-code"></code></pre></div>
</aside>
`;

const JS = String.raw`
(function(){
  "use strict";
  var BT = String.fromCharCode(96);
  var DATA = PM_DATA;
  var REPO_URL = DATA.repoRootFileUrl;
  var REPO_PATH = DATA.repoRootPath;
  var PM_PREFIX = DATA.pmDirRepoRel;
  var SOURCES = DATA.sources || {};
  var sourcesLC = {};
  Object.keys(SOURCES).forEach(function(k){ sourcesLC[k.toLowerCase()] = k; });

  var MOD_ICON = {
    "Budget":"💰","FAR Execution Checklist":"✅",
    "Functional Architecture Review":"🏛️","Hub & ERA":"💬",
    "Kitchen":"🍳","Notifications & Alerts":"🔔",
    "Schedule":"🗓️","Trips":"✈️"
  };
  function modIcon(name){ return MOD_ICON[name] || "📁"; }

  // ---------- file index ----------
  var files = DATA.files.map(function(f){
    var segs = f.relPath.split("/");
    var isRoot = segs.length === 1;
    var fname = segs[segs.length-1];
    var base = fname.replace(/\.md$/i, "");
    var isIndex = /^_index$/i.test(base);
    var numMatch = base.match(/^(\d+)\s*-+\s*(.*)$/);
    var order = isIndex ? -1 : (numMatch ? parseInt(numMatch[1],10) : 999);
    var title = numMatch ? numMatch[2].trim() : (isIndex ? "Index" : base);
    return {
      relPath: f.relPath, raw: f.raw, mtimeMs: f.mtimeMs, repoDir: f.repoDir || "",
      segs: segs, isRoot: isRoot, module: isRoot ? null : segs[0],
      inFabled: segs.indexOf("FABLED") !== -1,
      fileName: fname, baseName: base, isIndex: isIndex, order: order, title: title,
      dirPath: segs.slice(0,-1).join("/")
    };
  });
  var byRelPath = {};
  files.forEach(function(f){ byRelPath[f.relPath.toLowerCase()] = f; });

  var moduleNames = [];
  files.forEach(function(f){
    if (f.module && moduleNames.indexOf(f.module) === -1) moduleNames.push(f.module);
  });
  moduleNames.sort();

  // ---------- frontmatter ----------
  function parseFrontmatter(raw){
    var meta = {}, body = raw;
    if (raw.slice(0,3) === "---"){
      var end = raw.indexOf("\n---", 3);
      if (end !== -1){
        var block = raw.slice(3, end);
        body = raw.slice(end+4).replace(/^\s*\n/, "");
        block.split("\n").forEach(function(line){
          var m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
          if (!m) return;
          var key = m[1], val = m[2].trim();
          if (val[0] === "[" && val[val.length-1] === "]"){
            val = val.slice(1,-1).split(",").map(function(s){ return s.trim(); }).filter(Boolean);
          } else {
            val = val.replace(/^["']|["']$/g, "");
          }
          meta[key] = val;
        });
      }
    }
    return { meta: meta, body: body };
  }

  // ---------- checklist + severity extraction (cached per file) ----------
  var FENCE_RE = new RegExp(BT+BT+BT+"[\\s\\S]*?"+BT+BT+BT, "g");
  function stripFences(raw){
    return raw.replace(FENCE_RE, function(m){ return m.replace(/[^\n]/g, " "); });
  }
  var STRIP_TICK_RE = new RegExp("[*_~"+BT+"]", "g");
  function cleanInlineText(s){
    return s
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(STRIP_TICK_RE, "")
      .replace(/\|/g, " ")
      .replace(/^#+\s*/, "")
      .trim();
  }
  var SKIP_TAG_RE = new RegExp("^"+BT+"\\[([^\\]]+)\\]"+BT+"\\s*(.*)$");
  function extractChecklist(raw){
    var lines = stripFences(raw).split("\n");
    var out = [];
    lines.forEach(function(line){
      var m = line.match(/^\s*[-*]\s+(.*)$/);
      if (!m) return;
      var rest = m[1];
      var cb = rest.match(/^\[([ xX])\]\s*(.*)$/);
      if (cb){
        out.push({ state: /x/i.test(cb[1]) ? "done" : "open", text: cleanInlineText(cb[2]), raw: line });
        return;
      }
      var tag = rest.match(SKIP_TAG_RE);
      if (tag){
        out.push({ state: "skipped", text: cleanInlineText(tag[2] || tag[1]), raw: line });
      }
    });
    return out;
  }
  var SEV_RE = /(🔴|🟠|🟡|⚪)/;
  var SEV_RANK = {};
  SEV_RANK["🔴"]=0; SEV_RANK["🟠"]=1; SEV_RANK["🟡"]=2; SEV_RANK["⚪"]=3;
  var SEV_CLASS = {};
  SEV_CLASS["🔴"]="red"; SEV_CLASS["🟠"]="orange"; SEV_CLASS["🟡"]="yellow"; SEV_CLASS["⚪"]="gray";
  function extractSeverity(raw){
    var lines = stripFences(raw).split("\n");
    var out = [];
    lines.forEach(function(line){
      var m = line.match(SEV_RE);
      if (!m) return;
      if (/\*\*(Blocker|Friction|Annoyance|Cosmetic)/i.test(line)) return; // legend row
      if (/^\s*\|\s*Mark\s*\|/i.test(line)) return;
      var resolved = /✅/.test(line) && /~~/.test(line);
      var text = cleanInlineText(line).replace(/^(?:🔴|🟠|🟡|⚪|✅)\s*/, "");
      out.push({ emoji: m[1], resolved: resolved, text: text, raw: line });
    });
    return out;
  }
  files.forEach(function(f){
    f.checklist = extractChecklist(f.raw);
    f.severity = extractSeverity(f.raw);
  });

  function sumChecklist(list){
    var s = { done:0, open:0, skipped:0 };
    list.forEach(function(f){ f.checklist.forEach(function(c){ s[c.state]++; }); });
    s.total = s.done + s.open + s.skipped;
    return s;
  }
  function sumSeverity(list){
    var s = {};
    ["🔴","🟠","🟡","⚪"].forEach(function(e){ s[e] = { open:0, resolved:0 }; });
    list.forEach(function(f){ f.severity.forEach(function(g){
      s[g.emoji][g.resolved ? "resolved" : "open"]++;
    }); });
    return s;
  }

  // ---------- day-section extraction (for This Week preview) ----------
  function extractSections(raw){
    var fm = parseFrontmatter(raw);
    var lines = stripFences(fm.body).split("\n");
    var sections = [];
    var current = null;
    lines.forEach(function(line){
      var h = line.match(/^(#{2,3})\s+(.*)$/);
      if (h){
        current = { heading: cleanInlineText(h[2]), done:0, open:0, skipped:0 };
        sections.push(current);
        return;
      }
      if (!current) return;
      var m = line.match(/^\s*[-*]\s+(.*)$/);
      if (!m) return;
      var rest = m[1];
      var cb = rest.match(/^\[([ xX])\]/);
      if (cb){ current[/x/i.test(cb[1]) ? "done" : "open"]++; return; }
      if (/^\`\[/.test(rest)) current.skipped++;
    });
    return sections.filter(function(s){ return s.done+s.open+s.skipped > 0; });
  }

  // ---------- markdown renderer ----------
  function mdEscape(s){
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function slugify(s){
    return s.toLowerCase().replace(/[^a-z0-9\s-]/g,"").trim().replace(/\s+/g,"-");
  }

  function resolveLink(href, currentFile){
    if (!href) return { kind:"none" };
    href = href.replace(/^(<|&lt;)/, "").replace(/(>|&gt;)$/, "");
    if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return { kind:"external", href: href };
    if (href[0] === "#") return { kind:"anchor", href: href };
    var lineRefMatch = href.match(/:(\d+)(-\d+)?$/);
    var cleanHref = lineRefMatch ? href.slice(0, href.length - lineRefMatch[0].length) : href;

    function joinSegs(baseSegs, relSegs){
      var stack = baseSegs.slice();
      relSegs.forEach(function(seg){
        if (seg === "" || seg === ".") return;
        if (seg === ".."){ stack.pop(); }
        else stack.push(seg);
      });
      return stack;
    }
    var relSegs = cleanHref.split("/");
    var baseSegs = currentFile.dirPath ? currentFile.dirPath.split("/") : [];
    var combinedPm = joinSegs(baseSegs, relSegs).join("/");

    var isMd = /\.md$/i.test(cleanHref);
    if (isMd){
      var found = byRelPath[combinedPm.toLowerCase()];
      if (!found){
        // try treating href as already PM-root relative (strip leading ERA Notes/... prefix if present)
        var alt = cleanHref.replace(/^.*10 - Project Management\//i, "");
        found = byRelPath[alt.toLowerCase()];
      }
      if (found) return { kind:"internal", relPath: found.relPath };
      return { kind:"broken" };
    }
    // non-md local reference (source code etc) -> preview the embedded file in-panel.
    var line = lineRefMatch ? parseInt(lineRefMatch[1], 10) : null;
    var repoRel;
    if (/^(src|migrations|scripts|public|docs|ERA Notes)\//i.test(cleanHref)){
      repoRel = cleanHref;
    } else {
      var baseRepo = currentFile.repoDir ? currentFile.repoDir.split("/") : [];
      repoRel = joinSegs(baseRepo, relSegs).join("/");
    }
    var key = SOURCES[repoRel] ? repoRel : sourcesLC[repoRel.toLowerCase()];
    if (key) return { kind:"src", repoRel: key, line: line };
    return { kind:"srcmissing", repoRel: repoRel, line: line };
  }

  var INLINE_CODE_RE = new RegExp(BT+"([^"+BT+"]+)"+BT, "g");
  // A code span auto-links to the referenced file when it looks like a repo path:
  // either it starts with a known top-level dir, or it contains a slash + a known
  // source extension (optionally with a :line or :line-line suffix). No spaces, so
  // shell snippets like "pnpm test" and symbols like "daily_reminder" never match.
  var CODE_PATH_RE = /^(?:(?:src|migrations|scripts|public|docs)\/[^\s]+|[^\s]*\/[^\s]*\.(?:ts|tsx|js|jsx|mjs|cjs|sql|md|css|json|html|sh)(?::\d+(?:-\d+)?)?)$/;
  function attrEscape(s){ return mdEscape(s).replace(/"/g, "&quot;"); }
  function autolinkCode(c, currentFile){
    var inner = "<code>"+c+"</code>";
    if (!CODE_PATH_RE.test(c)) return inner;
    var r = resolveLink(c, currentFile);
    if (r.kind === "internal") return '<a href="javascript:void(0)" data-nav-file="'+attrEscape(r.relPath)+'">'+inner+'</a>';
    if (r.kind === "src") return '<a class="src-ref" href="javascript:void(0)" data-preview-file="'+attrEscape(r.repoRel)+'"'+(r.line?' data-line="'+r.line+'"':'')+'>'+inner+'</a>';
    return inner;
  }
  var LINK_RE = /\[([^\]]*)\]\((<[^>]*>|[^)]+)\)/g;
  function inline(text, currentFile){
    // Links are resolved against the RAW href (may contain & < > inside paths like
    // "Hub & ERA") before any HTML-escaping happens, then swapped in via placeholders
    // so the later escape pass doesn't mangle already-built anchor markup.
    var placeholders = [];
    var withPlaceholders = text.replace(LINK_RE, function(m, label, href){
      var r = resolveLink(href, currentFile);
      var html;
      if (r.kind === "internal") html = '<a href="javascript:void(0)" data-nav-file="'+attrEscape(r.relPath)+'">'+inline(label, currentFile)+'</a>';
      else if (r.kind === "external") html = '<a href="'+attrEscape(href.replace(/^<|>$/g,""))+'" target="_blank" rel="noopener">'+inline(label, currentFile)+'</a>';
      else if (r.kind === "src") html = '<a class="src-ref" href="javascript:void(0)" data-preview-file="'+attrEscape(r.repoRel)+'"'+(r.line?' data-line="'+r.line+'"':'')+'>'+inline(label, currentFile)+'</a>';
      else if (r.kind === "srcmissing") html = inline(label, currentFile);
      else if (r.kind === "broken") html = '<span class="broken-link" title="Link target not found">'+inline(label, currentFile)+' ⚠️</span>';
      else html = inline(label, currentFile);
      placeholders.push(html);
      return " LNK" + (placeholders.length-1) + " ";
    });
    var out = mdEscape(withPlaceholders);
    out = out.replace(INLINE_CODE_RE, function(m,c){ return autolinkCode(c, currentFile); });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
    out = out.replace(/ LNK(\d+) /g, function(m, i){ return placeholders[parseInt(i,10)]; });
    return out;
  }

  function renderList(items, ordered){
    var html = ordered ? "<ol>" : "<ul>";
    items.forEach(function(it){
      var cls = it.cbState ? (" task " + it.cbState) : "";
      var cb = it.cbState ? '<span class="cb"></span>' : "";
      html += '<li class="'+cls.trim()+'">' + cb + '<span>' + it.html + '</span>';
      if (it.children && it.children.length) html += renderList(it.children, it.ordered);
      html += "</li>";
    });
    html += ordered ? "</ol>" : "</ul>";
    return html;
  }
  function buildListTree(items){
    var root = []; var stack = [{ indent:-1, children: root }];
    items.forEach(function(it){
      while (stack.length > 1 && it.indent <= stack[stack.length-1].indent) stack.pop();
      var node = { indent: it.indent, html: it.html, cbState: it.cbState, ordered: it.ordered, children: [] };
      stack[stack.length-1].children.push(node);
      stack.push({ indent: it.indent, children: node.children });
    });
    return root;
  }

  var FENCE_EXTRACT_RE = new RegExp(BT+BT+BT+"([a-zA-Z0-9]*)\\n([\\s\\S]*?)"+BT+BT+BT, "g");
  function renderMarkdown(raw, currentFile){
    var fm = parseFrontmatter(raw);
    var body = fm.body;
    var codeBlocks = [];
    body = body.replace(FENCE_EXTRACT_RE, function(m, lang, code){
      codeBlocks.push(code);
      return " CODE" + (codeBlocks.length-1) + " ";
    });
    var lines = body.split("\n");
    var out = [];
    var toc = [];
    var i = 0;
    var para = [];
    function flushPara(){
      if (para.length){
        out.push("<p>" + inline(para.join(" "), currentFile) + "</p>");
        para = [];
      }
    }
    while (i < lines.length){
      var line = lines[i];

      if (/^\s*$/.test(line)){ flushPara(); i++; continue; }

      var code = line.match(/^ CODE(\d+) $/);
      if (code){
        flushPara();
        out.push("<pre><code>" + mdEscape(codeBlocks[parseInt(code[1],10)]) + "</code></pre>");
        i++; continue;
      }

      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h){
        flushPara();
        var level = h[1].length;
        var text = h[2].trim();
        var slug = slugify(text) + "-" + out.length;
        if (level === 2 || level === 3) toc.push({ level: level, text: text, slug: slug });
        out.push("<h"+level+' id="'+slug+'">' + inline(text, currentFile) + "</h"+level+">");
        i++; continue;
      }

      if (/^\s*-{3,}\s*$/.test(line) && !/\|/.test(line)){
        flushPara();
        out.push("<hr>");
        i++; continue;
      }

      if (/^\s*>/.test(line)){
        flushPara();
        var bq = [];
        while (i < lines.length && /^\s*>/.test(lines[i])){
          bq.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        out.push("<blockquote>" + bq.map(function(l){ return l ? inline(l, currentFile) : ""; }).join("<br>") + "</blockquote>");
        continue;
      }

      if (/^\s*\|.*\|\s*$/.test(line) && i+1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(lines[i+1])){
        flushPara();
        var headerCells = line.split("|").map(function(c){ return c.trim(); }).filter(function(c,idx,arr){ return !(c==="" && (idx===0||idx===arr.length-1)); });
        i += 2;
        var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])){
          var cells = lines[i].split("|").map(function(c){ return c.trim(); }).filter(function(c,idx,arr){ return !(c==="" && (idx===0||idx===arr.length-1)); });
          rows.push(cells);
          i++;
        }
        var t = "<table><thead><tr>";
        headerCells.forEach(function(c){ t += "<th>"+inline(c, currentFile)+"</th>"; });
        t += "</tr></thead><tbody>";
        rows.forEach(function(r){
          t += "<tr>";
          r.forEach(function(c){ t += "<td>"+inline(c, currentFile)+"</td>"; });
          t += "</tr>";
        });
        t += "</tbody></table>";
        out.push(t);
        continue;
      }

      var li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
      if (li){
        flushPara();
        var items = [];
        while (i < lines.length){
          var lm = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
          if (!lm) break;
          var indent = lm[1].length;
          var ordered = /\d+\./.test(lm[2]);
          var rest = lm[3];
          var cbState = null;
          var cb = rest.match(/^\[([ xX])\]\s*(.*)$/);
          if (cb){ cbState = /x/i.test(cb[1]) ? "done" : "open"; rest = cb[2]; }
          else {
            var tag = rest.match(SKIP_TAG_RE);
            if (tag){ cbState = "skipped"; rest = tag[2] || tag[1]; }
          }
          items.push({ indent: indent, ordered: ordered, cbState: cbState, html: inline(rest, currentFile) });
          i++;
        }
        var tree = buildListTree(items);
        out.push(renderList(tree, items[0].ordered));
        continue;
      }

      para.push(line.trim());
      i++;
    }
    flushPara();
    return { html: out.join("\n"), meta: fm.meta, toc: toc };
  }

  // ---------- routing / rendering ----------
  var els = {
    tree: document.getElementById("tree"),
    view: document.getElementById("view"),
    breadcrumb: document.getElementById("breadcrumb"),
    search: document.getElementById("search"),
    searchResults: document.getElementById("search-results"),
    generatedAt: document.getElementById("generated-at"),
    sidebarToggle: document.getElementById("sidebar-toggle"),
    preview: document.getElementById("preview"),
    previewBackdrop: document.getElementById("preview-backdrop"),
    previewName: document.getElementById("preview-name"),
    previewLang: document.getElementById("preview-lang"),
    previewOpen: document.getElementById("preview-open"),
    previewClose: document.getElementById("preview-close"),
    previewCode: document.getElementById("preview-code"),
    previewBody: document.getElementById("preview-body")
  };
  els.generatedAt.textContent = "Updated " + new Date(DATA.generatedAt).toLocaleString();

  // ---------- source preview panel (in-dashboard, syntax-highlighted) ----------
  function escCode(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  var EXT_LANG = {ts:"js",tsx:"js",js:"js",jsx:"js",mjs:"js",cjs:"js",sql:"sql",css:"css",scss:"css",json:"json",html:"html",htm:"html",xml:"html",sh:"sh",bash:"sh",yml:"yaml",yaml:"yaml"};
  var LANG_LABEL = {js:"TypeScript / JS",sql:"SQL",css:"CSS",json:"JSON",html:"HTML",sh:"Shell",yaml:"YAML",text:"Text"};
  function langFromPath(p){ return EXT_LANG[(p.split(".").pop()||"").toLowerCase()] || "text"; }
  var KW = {
    js:"const let var function return if else for while do switch case break continue new class extends super this typeof instanceof in of await async yield import export from default try catch finally throw delete void null undefined true false interface type enum implements public private protected readonly static get set as namespace declare keyof infer satisfies abstract",
    sql:"select from where insert update delete create alter drop table index view policy trigger function returns language as and or not null primary key foreign references default join left right inner outer full group by order limit offset returning with values into set distinct case when then end exists union all grant execute begin commit rollback security definer enable row level on using check unique add column constraint",
    sh:"if then else elif fi for while do done case esac function in return local export set echo",
    json:"true false null"
  };
  function kwSet(s){ var o={}; (s||"").split(/\s+/).forEach(function(w){ if(w) o[w]=1; }); return o; }
  var KWSETS = {js:kwSet(KW.js),sql:kwSet(KW.sql),sh:kwSet(KW.sh),json:kwSet(KW.json)};
  var LANGCFG = {
    js:{line:"//",block:["/*","*/"],str:BT+"\"'",kw:KWSETS.js,ci:false},
    sql:{line:"--",block:["/*","*/"],str:"\"'",kw:KWSETS.sql,ci:true},
    sh:{line:"#",block:null,str:"\"'",kw:KWSETS.sh,ci:false},
    css:{line:null,block:["/*","*/"],str:"\"'",kw:{},ci:false},
    json:{line:null,block:null,str:"\"",kw:KWSETS.json,ci:false},
    yaml:{line:"#",block:null,str:"\"'",kw:{},ci:false}
  };
  function reEsc(s){ return s.replace(/[.*+?^$()|{}\[\]\\]/g, "\\$&"); }
  function buildRe(cfg){
    var alts=[], cls=[];
    if (cfg.block){ alts.push(reEsc(cfg.block[0])+"[\\s\\S]*?"+reEsc(cfg.block[1])); cls.push("c-com"); }
    if (cfg.line){ alts.push(reEsc(cfg.line)+"[^\\n]*"); cls.push("c-com"); }
    var sa=[];
    if (cfg.str.indexOf(BT)>-1) sa.push(BT+"(?:\\\\.|[^"+BT+"\\\\])*"+BT);
    if (cfg.str.indexOf('"')>-1) sa.push('"(?:\\\\.|[^"\\\\])*"');
    if (cfg.str.indexOf("'")>-1) sa.push("'(?:\\\\.|[^'\\\\])*'");
    if (sa.length){ alts.push(sa.join("|")); cls.push("c-str"); }
    alts.push("\\b\\d[\\w.]*\\b"); cls.push("c-num");
    alts.push("[A-Za-z_$][\\w$]*"); cls.push("c-id");
    return { re: new RegExp(alts.map(function(a){return "("+a+")";}).join("|"), "g"+(cfg.ci?"i":"")), cls: cls };
  }
  function hlGeneric(code, cfg){
    var b = buildRe(cfg), re = b.re, cls = b.cls, out = "", last = 0, m;
    while ((m = re.exec(code))){
      if (m.index > last) out += escCode(code.slice(last, m.index));
      var gi = -1; for (var k=1;k<m.length;k++){ if (m[k] !== undefined){ gi = k; break; } }
      var c = cls[gi-1], tok = m[0];
      if (c === "c-id" && cfg.kw[cfg.ci ? tok.toLowerCase() : tok]) c = "c-kw";
      out += '<span class="'+c+'">' + escCode(tok) + '</span>';
      last = m.index + tok.length;
      if (tok.length === 0) re.lastIndex++;
    }
    out += escCode(code.slice(last));
    return out;
  }
  function hlHtml(code){
    var re = /(<!--[\s\S]*?-->)|(<\/?[A-Za-z][\w:-]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([A-Za-z_:][\w:.-]*)(?=\s*=)/g;
    var out = "", last = 0, m;
    while ((m = re.exec(code))){
      if (m.index > last) out += escCode(code.slice(last, m.index));
      var tok = m[0], c = m[1] ? "c-com" : m[2] ? "c-tag" : m[3] ? "c-str" : "c-attr";
      out += '<span class="'+c+'">' + escCode(tok) + '</span>';
      last = m.index + tok.length;
      if (tok.length === 0) re.lastIndex++;
    }
    out += escCode(code.slice(last));
    return out;
  }
  function highlight(code, lang){
    if (lang === "html") return hlHtml(code);
    if (LANGCFG[lang]) return hlGeneric(code, LANGCFG[lang]);
    return escCode(code);
  }
  function openPreview(repoRel, line){
    var key = SOURCES[repoRel] ? repoRel : sourcesLC[(repoRel||"").toLowerCase()];
    var src = key ? SOURCES[key] : null;
    els.previewName.textContent = (key || repoRel) + (line ? "  :" + line : "");
    els.previewOpen.href = "vscode://file/" + REPO_PATH + "/" + (key || repoRel) + (line ? ":" + line : "");
    if (!src){
      els.previewLang.textContent = "";
      els.previewCode.className = "";
      els.previewCode.innerHTML = '<span class="c-com">/* Not embedded in this dashboard build.\n   Re-run scripts/build-pm-dashboard.mjs, or use "Open in VS Code". */</span>';
    } else {
      var lang = langFromPath(key);
      els.previewLang.textContent = LANG_LABEL[lang] || lang;
      els.previewCode.className = "lang-" + lang;
      els.previewCode.innerHTML = highlight(src.code, lang) +
        (src.truncated ? '\n<span class="c-com">/* … truncated for size — use "Open in VS Code" for the full file */</span>' : "");
    }
    els.previewBody.scrollTop = 0;
    document.body.classList.add("pv-open");
  }
  function closePreview(){ document.body.classList.remove("pv-open"); }
  document.addEventListener("click", function(e){
    var a = e.target && e.target.closest ? e.target.closest("[data-preview-file]") : null;
    if (a){ e.preventDefault(); openPreview(a.getAttribute("data-preview-file"), a.getAttribute("data-line")); }
  });
  els.previewClose.addEventListener("click", closePreview);
  els.previewBackdrop.addEventListener("click", closePreview);
  document.addEventListener("keydown", function(e){
    if (e.key === "Escape" && document.body.classList.contains("pv-open")) closePreview();
  });

  function setBreadcrumb(parts){
    els.breadcrumb.innerHTML = parts.map(function(p, idx){
      var isLast = idx === parts.length - 1;
      if (isLast) return '<span>'+p.label+'</span>';
      return '<a data-bc="'+idx+'">'+p.label+'</a><span>›</span>';
    }).join(" ");
    Array.prototype.forEach.call(els.breadcrumb.querySelectorAll("[data-bc]"), function(a){
      var idx = parseInt(a.getAttribute("data-bc"),10);
      a.addEventListener("click", function(){ parts[idx].go(); });
    });
  }

  function checklistStr(s){ return s.done + "/" + s.total; }

  function severityDot(list){
    var s = sumSeverity(list);
    if (s["🔴"].open > 0) return '<span class="dot dot-red"></span>';
    if (s["🟠"].open > 0) return '<span class="dot dot-orange"></span>';
    return "";
  }

  function buildTreeHTML(){
    var html = "";
    html += '<div class="quicklinks">';
    html += '<a class="qlink" data-route="home">🏠 Home</a>';
    var thisWeek = files.filter(function(f){ return f.isRoot; }).find ?
      files.filter(function(f){ return f.isRoot && /this week/i.test(f.fileName); })[0] : null;
    if (thisWeek) html += '<a class="qlink" data-nav-file="'+thisWeek.relPath+'">📅 This Week</a>';
    html += '<a class="qlink" data-route="checklist">☑️ Checklist Rollup</a>';
    html += '<a class="qlink" data-route="bugs">🐞 Bugs &amp; Gaps</a>';
    html += "</div>";

    var rootFiles = files.filter(function(f){ return f.isRoot; }).sort(function(a,b){ return a.order-b.order; });
    html += '<details class="group" open data-group="root"><summary>📚 Strategic Docs</summary><div class="group-body">';
    rootFiles.forEach(function(f){
      html += fileLinkHTML(f);
    });
    html += "</div></details>";

    moduleNames.forEach(function(name){
      var modFiles = files.filter(function(f){ return f.module===name && !f.inFabled; }).sort(function(a,b){ return a.order-b.order; });
      var fabledFiles = files.filter(function(f){ return f.module===name && f.inFabled; }).sort(function(a,b){ return a.order-b.order; });
      var allModFiles = files.filter(function(f){ return f.module===name; });
      html += '<details class="group" data-group="'+name+'"><summary>'+modIcon(name)+' '+name+' '+severityDot(allModFiles)+'</summary><div class="group-body">';
      html += '<a class="file-link module-link" data-route="module" data-module="'+name+'">Module Overview</a>';
      modFiles.forEach(function(f){ html += fileLinkHTML(f); });
      if (fabledFiles.length){
        html += '<details class="subgroup" data-group="'+name+'-fabled"><summary>FABLED</summary><div class="group-body">';
        fabledFiles.forEach(function(f){ html += fileLinkHTML(f); });
        html += "</div></details>";
      }
      html += "</div></details>";
    });
    return html;
  }
  function fileLinkHTML(f){
    var badge = "";
    if (f.checklist.length){
      var s = { done:0, open:0, skipped:0, total:0 };
      f.checklist.forEach(function(c){ s[c.state]++; s.total++; });
      badge = '<span class="mini-badge">'+s.done+'/'+s.total+'</span>';
    }
    return '<a class="file-link" data-nav-file="'+f.relPath+'"><span class="ft">'+escapeHtml(f.title)+'</span>'+badge+'</a>';
  }
  function escapeHtml(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function renderTree(){
    els.tree.innerHTML = buildTreeHTML();
    wireTreeEvents();
    applyTreeState();
    highlightActive();
  }
  function wireTreeEvents(){
    Array.prototype.forEach.call(els.tree.querySelectorAll("[data-nav-file]"), function(a){
      a.addEventListener("click", function(){ goFile(a.getAttribute("data-nav-file")); });
    });
    Array.prototype.forEach.call(els.tree.querySelectorAll('[data-route="module"]'), function(a){
      a.addEventListener("click", function(){ goModule(a.getAttribute("data-module")); });
    });
    Array.prototype.forEach.call(els.tree.querySelectorAll('[data-route="checklist"]'), function(a){
      a.addEventListener("click", goChecklist);
    });
    Array.prototype.forEach.call(els.tree.querySelectorAll('[data-route="bugs"]'), function(a){
      a.addEventListener("click", goBugs);
    });
    Array.prototype.forEach.call(els.tree.querySelectorAll('[data-route="home"]'), function(a){
      a.addEventListener("click", goHome);
    });
    Array.prototype.forEach.call(els.tree.querySelectorAll("details"), function(d){
      d.addEventListener("toggle", function(){
        saveTreeState(d.getAttribute("data-group"), d.open);
      });
    });
  }
  function treeStateKey(){ return "pm-dash-tree-state"; }
  function saveTreeState(group, open){
    try{
      var s = JSON.parse(localStorage.getItem(treeStateKey()) || "{}");
      s[group] = open;
      localStorage.setItem(treeStateKey(), JSON.stringify(s));
    }catch(e){}
  }
  function applyTreeState(){
    try{
      var s = JSON.parse(localStorage.getItem(treeStateKey()) || "{}");
      Array.prototype.forEach.call(els.tree.querySelectorAll("details"), function(d){
        var g = d.getAttribute("data-group");
        if (s.hasOwnProperty(g)) d.open = !!s[g];
      });
    }catch(e){}
  }
  function highlightActive(){
    Array.prototype.forEach.call(els.tree.querySelectorAll(".active"), function(a){ a.classList.remove("active"); });
    Array.prototype.forEach.call(els.tree.querySelectorAll(".qlink"), function(a){ a.classList.remove("active"); });
    if (currentRoute.type === "file"){
      var a = els.tree.querySelector('[data-nav-file="'+cssEscape(currentRoute.relPath)+'"]');
      if (a){
        a.classList.add("active");
        var d = a.closest("details");
        while (d){ d.open = true; d = d.parentElement ? d.parentElement.closest("details") : null; }
      }
    } else if (currentRoute.type === "home"){
      var q = els.tree.querySelector('[data-route="home"]'); if (q) q.classList.add("active");
    } else if (currentRoute.type === "checklist"){
      var q2 = els.tree.querySelector('[data-route="checklist"]'); if (q2) q2.classList.add("active");
    } else if (currentRoute.type === "bugs"){
      var q3 = els.tree.querySelector('[data-route="bugs"]'); if (q3) q3.classList.add("active");
    }
  }
  function cssEscape(s){ return s.replace(/(["\\])/g, "\\$1"); }

  // ---------- views ----------
  var currentRoute = { type: "home" };

  function goHome(){ currentRoute = { type:"home" }; persistRoute(); renderHome(); highlightActive(); window.scrollTo(0,0); els.view.scrollTop=0; }
  function goModule(name){ currentRoute = { type:"module", module:name }; persistRoute(); renderModule(name); highlightActive(); els.view.scrollTop=0; }
  function goFile(relPath){ currentRoute = { type:"file", relPath:relPath }; persistRoute(); renderFile(relPath); highlightActive(); els.view.scrollTop=0; }
  function goChecklist(){ currentRoute = { type:"checklist" }; persistRoute(); renderChecklistRollup(); highlightActive(); els.view.scrollTop=0; }
  function goBugs(){ currentRoute = { type:"bugs" }; persistRoute(); renderBugsRollup(); highlightActive(); els.view.scrollTop=0; }
  function persistRoute(){
    try{ localStorage.setItem("pm-dash-last-route", JSON.stringify(currentRoute)); }catch(e){}
  }

  function renderHome(){
    setBreadcrumb([{ label:"Home", go:goHome }]);
    var html = '<div class="pagehead"><h1>PM Command Center</h1></div>';

    var rootIndex = files.find(function(f){ return f.isRoot && f.isIndex; });
    if (rootIndex){
      var m = rootIndex.raw.match(/#{1,3}[^\n]*risk[^\n]*\n([\s\S]*?)(\n#{1,3}\s|$)/i);
      if (m){
        var bulletLines = m[1].split("\n").filter(function(l){ return /^\s*[-*]/.test(l); });
        if (bulletLines.length){
          html += '<div class="callout"><h3>⚠️ Top risks right now</h3><ul>';
          bulletLines.forEach(function(l){
            var t = l.replace(/^\s*[-*]\s*/, "");
            html += "<li>" + inline(t, rootIndex) + "</li>";
          });
          html += "</ul></div>";
        }
      }
    }

    var thisWeek = files.filter(function(f){ return f.isRoot && /this week/i.test(f.fileName); })[0];
    if (thisWeek){
      var sections = extractSections(thisWeek.raw);
      if (sections.length){
        html += '<div class="callout"><h3>📅 This Week</h3>';
        sections.forEach(function(s){
          var total = s.done+s.open+s.skipped;
          var pct = total ? Math.round((s.done/total)*100) : 0;
          html += '<div style="margin-bottom:10px;">';
          html += '<div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);">';
          html += '<span>'+escapeHtml(s.heading)+'</span><span>'+s.done+'/'+total+'</span></div>';
          html += '<div class="progress-bar"><span style="width:'+pct+'%"></span></div></div>';
        });
        html += '<a class="qlink" style="margin-top:6px;display:inline-block;" data-jump-this-week="1">Open full plan →</a>';
        html += "</div>";
      }
    }

    html += '<div class="section-h">Modules</div><div class="home-grid">';
    moduleNames.forEach(function(name){
      var modFiles = files.filter(function(f){ return f.module === name; });
      var cl = sumChecklist(modFiles);
      var sev = sumSeverity(modFiles);
      var latest = modFiles.reduce(function(a,f){ return f.mtimeMs > a ? f.mtimeMs : a; }, 0);
      html += '<div class="mod-card" data-go-module="'+name+'">';
      html += '<div class="mc-top">'+modIcon(name)+' '+name+'</div>';
      if (cl.total){
        var pct = Math.round((cl.done/cl.total)*100);
        html += '<div class="progress-bar"><span style="width:'+pct+'%"></span></div>';
        html += '<div style="font-size:11.5px;color:var(--muted-2);margin-top:5px;">'+cl.done+' / '+cl.total+' tasks done</div>';
      }
      html += '<div class="bug-pills">';
      [["🔴","red"],["🟠","orange"],["🟡","yellow"]].forEach(function(p){
        var c = sev[p[0]].open;
        if (c>0) html += '<span class="bug-pill '+p[1]+'">'+p[0]+' '+c+'</span>';
      });
      html += '</div>';
      html += '<div class="mc-updated">Updated '+ (latest? new Date(latest).toLocaleDateString() : "—") +'</div>';
      html += "</div>";
    });
    html += "</div>";

    els.view.innerHTML = html;
    Array.prototype.forEach.call(els.view.querySelectorAll("[data-go-module]"), function(c){
      c.addEventListener("click", function(){ goModule(c.getAttribute("data-go-module")); });
    });
    Array.prototype.forEach.call(els.view.querySelectorAll("[data-nav-file]"), function(a){
      a.addEventListener("click", function(){ goFile(a.getAttribute("data-nav-file")); });
    });
    var jw = els.view.querySelector("[data-jump-this-week]");
    if (jw && thisWeek) jw.addEventListener("click", function(){ goFile(thisWeek.relPath); });
  }

  function renderModule(name){
    setBreadcrumb([{label:"Home",go:goHome},{label:name,go:function(){goModule(name);}}]);
    var modFiles = files.filter(function(f){ return f.module === name && !f.inFabled; }).sort(function(a,b){ return a.order-b.order; });
    var fabledFiles = files.filter(function(f){ return f.module === name && f.inFabled; }).sort(function(a,b){ return a.order-b.order; });
    var allFiles = files.filter(function(f){ return f.module === name; });
    var cl = sumChecklist(allFiles);
    var sev = sumSeverity(allFiles);

    var html = '<div class="pagehead"><h1>'+modIcon(name)+' '+name+'</h1></div>';
    if (cl.total){
      var pct = Math.round((cl.done/cl.total)*100);
      html += '<div class="progress-box">Overall progress: '+cl.done+' / '+cl.total+' tasks done ('+pct+'%)';
      html += '<div class="progress-bar"><span style="width:'+pct+'%"></span></div></div>';
    }
    var sevAny = sev["🔴"].open + sev["🟠"].open + sev["🟡"].open;
    if (sevAny){
      html += '<div class="bug-pills" style="margin-bottom:20px;">';
      [["🔴","red"],["🟠","orange"],["🟡","yellow"]].forEach(function(p){
        var c = sev[p[0]].open;
        if (c>0) html += '<span class="bug-pill '+p[1]+'">'+p[0]+' '+c+' open</span>';
      });
      html += "</div>";
    }

    html += '<div class="section-h">Core docs</div>';
    modFiles.forEach(function(f){ html += fileRowHTML(f); });
    if (fabledFiles.length){
      html += '<div class="section-h">FABLED</div>';
      fabledFiles.forEach(function(f){ html += fileRowHTML(f); });
    }
    els.view.innerHTML = html;
    Array.prototype.forEach.call(els.view.querySelectorAll("[data-go-file]"), function(r){
      r.addEventListener("click", function(){ goFile(r.getAttribute("data-go-file")); });
    });
  }
  function fileRowHTML(f){
    var stats = "";
    if (f.checklist.length){
      var s = { done:0, open:0, skipped:0, total:0 };
      f.checklist.forEach(function(c){ s[c.state]++; s.total++; });
      stats = checklistStr(s);
    }
    var sevCount = f.severity.filter(function(g){ return !g.resolved; }).length;
    return '<div class="file-row" data-go-file="'+f.relPath+'"><span>'+escapeHtml(f.title)+'</span>' +
      '<span class="fr-stats">' + (stats? stats+" tasks " : "") + (sevCount? "• "+sevCount+" open issue"+(sevCount>1?"s":"") : "") + '</span></div>';
  }

  function renderFile(relPath){
    var f = byRelPath[relPath.toLowerCase()];
    if (!f){ els.view.innerHTML = '<p class="empty-note">File not found: '+escapeHtml(relPath)+'</p>'; return; }
    var parts = [{label:"Home",go:goHome}];
    if (f.module) parts.push({label:f.module, go:(function(m){ return function(){ goModule(m); }; })(f.module)});
    if (f.inFabled) parts.push({label:"FABLED", go:function(){ goModule(f.module); }});
    parts.push({label:f.title, go:function(){ goFile(f.relPath); }});
    setBreadcrumb(parts);

    var rendered = renderMarkdown(f.raw, f);
    var html = '<div class="pagehead"><h1>'+escapeHtml(f.title)+'</h1></div>';

    var badges = [];
    if (rendered.meta.status) badges.push('<span class="badge b-status-'+rendered.meta.status+'">'+rendered.meta.status+'</span>');
    if (rendered.meta.type) badges.push('<span class="badge">'+rendered.meta.type+'</span>');
    if (rendered.meta.owner) badges.push('<span class="badge">'+rendered.meta.owner+'</span>');
    if (rendered.meta.tags && rendered.meta.tags.length) rendered.meta.tags.forEach(function(t){ badges.push('<span class="badge">'+t+'</span>'); });
    if (badges.length) html += '<div class="badges-row">'+badges.join("")+"</div>";

    if (f.checklist.length){
      var s = { done:0, open:0, skipped:0, total:0 };
      f.checklist.forEach(function(c){ s[c.state]++; s.total++; });
      var pct = Math.round((s.done/s.total)*100);
      html += '<div class="progress-box">This file: '+s.done+' / '+s.total+' tasks done ('+pct+'%)'+(s.skipped? " • "+s.skipped+" skipped":"")+'<div class="progress-bar"><span style="width:'+pct+'%"></span></div></div>';
    }

    if (rendered.toc.length > 2){
      html += '<details class="toc-box" open><summary>On this page</summary><ul>';
      rendered.toc.forEach(function(t){
        html += '<li style="margin-left:'+((t.level-2)*14)+'px;"><a data-toc="'+t.slug+'">'+escapeHtml(t.text)+'</a></li>';
      });
      html += "</ul></details>";
    }

    html += "<article>" + rendered.html + "</article>";
    els.view.innerHTML = html;

    Array.prototype.forEach.call(els.view.querySelectorAll("[data-nav-file]"), function(a){
      a.addEventListener("click", function(){ goFile(a.getAttribute("data-nav-file")); });
    });
    Array.prototype.forEach.call(els.view.querySelectorAll("[data-toc]"), function(a){
      a.addEventListener("click", function(){
        var el = document.getElementById(a.getAttribute("data-toc"));
        if (el) el.scrollIntoView({behavior:"smooth", block:"start"});
      });
    });
  }

  function renderChecklistRollup(){
    setBreadcrumb([{label:"Home",go:goHome},{label:"Checklist Rollup",go:goChecklist}]);
    var html = '<div class="pagehead"><h1>☑️ Checklist Rollup</h1></div>';
    var groups = [].concat(moduleNames, ["_root"]);
    groups.forEach(function(name){
      var groupFiles = name === "_root" ? files.filter(function(f){ return f.isRoot; }) : files.filter(function(f){ return f.module === name; });
      var cl = sumChecklist(groupFiles);
      if (!cl.total) return;
      var label = name === "_root" ? "Strategic Docs" : (modIcon(name)+" "+name);
      var pct = Math.round((cl.done/cl.total)*100);
      html += '<div class="rollup-mod"><div class="rollup-mod-title">'+label+'<span style="font-size:12px;color:var(--muted-2);font-weight:400;">'+cl.done+'/'+cl.total+' ('+pct+'%)</span></div>';
      html += '<div class="progress-bar" style="margin-bottom:10px;"><span style="width:'+pct+'%"></span></div>';
      var openRows = "";
      var doneRows = "";
      groupFiles.sort(function(a,b){ return a.order-b.order; }).forEach(function(f){
        f.checklist.forEach(function(c){
          var row = '<div class="rollup-row" data-go-file="'+f.relPath+'"><span>'+(c.state==="skipped"?"⏩":(c.state==="done"?"✅":"⬜"))+'</span><div><div>'+escapeHtml(c.text||"(untitled)")+'</div><div class="rr-src">'+escapeHtml(f.title)+'</div></div></div>';
          if (c.state === "open") openRows += row; else doneRows += row;
        });
      });
      html += openRows || '<p class="empty-note">No open items.</p>';
      if (doneRows){
        var rid = "res-"+name.replace(/\W+/g,"");
        html += '<span class="toggle-resolved" data-toggle="'+rid+'">Show completed / skipped items</span>';
        html += '<div class="resolved-block" id="'+rid+'">'+doneRows+'</div>';
      }
      html += "</div>";
    });
    els.view.innerHTML = html;
    wireRollupEvents();
  }

  function renderBugsRollup(){
    setBreadcrumb([{label:"Home",go:goHome},{label:"Bugs & Gaps",go:goBugs}]);
    var html = '<div class="pagehead"><h1>🐞 Bugs &amp; Gaps</h1></div>';
    var any = false;
    moduleNames.forEach(function(name){
      var modFiles = files.filter(function(f){ return f.module === name; });
      var entries = [];
      modFiles.forEach(function(f){ f.severity.forEach(function(g){ entries.push({g:g, f:f}); }); });
      if (!entries.length) return;
      any = true;
      entries.sort(function(a,b){ return SEV_RANK[a.g.emoji]-SEV_RANK[b.g.emoji]; });
      var openEntries = entries.filter(function(e){ return !e.g.resolved; });
      var resolvedEntries = entries.filter(function(e){ return e.g.resolved; });
      html += '<div class="rollup-mod"><div class="rollup-mod-title">'+modIcon(name)+' '+name+
        '<span style="font-size:12px;color:var(--muted-2);font-weight:400;">'+openEntries.length+' open</span></div>';
      if (openEntries.length){
        openEntries.forEach(function(e){
          html += '<div class="rollup-row" data-go-file="'+e.f.relPath+'"><span>'+e.g.emoji+'</span><div><div>'+escapeHtml(e.g.text)+'</div><div class="rr-src">'+escapeHtml(e.f.title)+'</div></div></div>';
        });
      } else {
        html += '<p class="empty-note">No open issues recorded.</p>';
      }
      if (resolvedEntries.length){
        var rid = "bres-"+name.replace(/\W+/g,"");
        html += '<span class="toggle-resolved" data-toggle="'+rid+'">Show resolved ('+resolvedEntries.length+')</span>';
        html += '<div class="resolved-block" id="'+rid+'">';
        resolvedEntries.forEach(function(e){
          html += '<div class="rollup-row" data-go-file="'+e.f.relPath+'"><span>✅</span><div><div>'+escapeHtml(e.g.text)+'</div><div class="rr-src">'+escapeHtml(e.f.title)+'</div></div></div>';
        });
        html += "</div>";
      }
      html += "</div>";
    });
    if (!any) html += '<p class="empty-note">No severity-tagged entries found.</p>';
    els.view.innerHTML = html;
    wireRollupEvents();
  }
  function wireRollupEvents(){
    Array.prototype.forEach.call(els.view.querySelectorAll("[data-go-file]"), function(r){
      r.addEventListener("click", function(){ goFile(r.getAttribute("data-go-file")); });
    });
    Array.prototype.forEach.call(els.view.querySelectorAll("[data-toggle]"), function(t){
      t.addEventListener("click", function(){
        var el = document.getElementById(t.getAttribute("data-toggle"));
        el.classList.toggle("show");
      });
    });
  }

  // ---------- search ----------
  // Global search: indexes titles + paths AND full body text. Title/path hits rank
  // first; body hits follow with a highlighted snippet so content matches are useful.
  var searchIndex = files.map(function(f){
    var fm = parseFrontmatter(f.raw);
    var bodyText = fm.body.replace(/\s+/g, " ").trim();
    return {
      f: f,
      titleHay: (f.title + " " + f.relPath).toLowerCase(),
      bodyText: bodyText,
      bodyLower: bodyText.toLowerCase()
    };
  });
  function makeSnippet(e, q){
    var idx = e.bodyLower.indexOf(q);
    if (idx === -1) return escapeHtml(e.f.relPath);
    var start = Math.max(0, idx - 40);
    var end = Math.min(e.bodyText.length, idx + q.length + 70);
    var pre = (start > 0 ? "…" : "") + e.bodyText.slice(start, idx);
    var hit = e.bodyText.slice(idx, idx + q.length);
    var post = e.bodyText.slice(idx + q.length, end) + (end < e.bodyText.length ? "…" : "");
    return escapeHtml(pre) + "<mark>" + escapeHtml(hit) + "</mark>" + escapeHtml(post);
  }
  function runSearch(q){
    q = q.trim().toLowerCase();
    if (!q){ els.searchResults.classList.remove("show"); els.searchResults.innerHTML=""; return; }
    var titleHits = [], bodyHits = [];
    searchIndex.forEach(function(e){
      if (e.titleHay.indexOf(q) !== -1) titleHits.push(e);
      else if (e.bodyLower.indexOf(q) !== -1) bodyHits.push(e);
    });
    var matches = titleHits.concat(bodyHits).slice(0, 30);
    if (!matches.length){
      els.searchResults.innerHTML = '<div class="sr-item"><div class="sr-path">No matches</div></div>';
    } else {
      els.searchResults.innerHTML = matches.map(function(e){
        var inTitle = titleHits.indexOf(e) !== -1;
        var kind = inTitle ? '<span class="sr-kind">name</span>' : '<span class="sr-kind">text</span>';
        var sub = inTitle ? '<div class="sr-path">'+escapeHtml(e.f.relPath)+'</div>'
                          : '<div class="sr-snippet">'+makeSnippet(e, q)+'</div>';
        return '<div class="sr-item" data-nav-file="'+escapeHtml(e.f.relPath)+'"><div class="sr-title">'+escapeHtml(e.f.title)+kind+'</div>'+sub+'</div>';
      }).join("");
      Array.prototype.forEach.call(els.searchResults.querySelectorAll("[data-nav-file]"), function(r){
        r.addEventListener("click", function(){
          goFile(r.getAttribute("data-nav-file"));
          els.search.value = "";
          els.searchResults.classList.remove("show");
        });
      });
    }
    els.searchResults.classList.add("show");
  }
  els.search.addEventListener("input", function(){ runSearch(els.search.value); });
  els.search.addEventListener("keydown", function(e){
    if (e.key === "Escape"){ els.search.value=""; els.searchResults.classList.remove("show"); els.search.blur(); }
  });
  document.addEventListener("click", function(e){
    if (!els.searchResults.contains(e.target) && e.target !== els.search) els.searchResults.classList.remove("show");
  });
  document.addEventListener("keydown", function(e){
    if (e.key === "/" && document.activeElement !== els.search){
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag !== "INPUT" && tag !== "TEXTAREA"){ e.preventDefault(); els.search.focus(); }
    }
  });

  // ---------- mobile sidebar ----------
  els.sidebarToggle.addEventListener("click", function(){
    document.body.classList.toggle("sb-open");
  });
  els.view.addEventListener("click", function(){ document.body.classList.remove("sb-open"); });

  // ---------- boot ----------
  renderTree();
  var initial = null;
  try{ initial = JSON.parse(localStorage.getItem("pm-dash-last-route") || "null"); }catch(e){}
  if (initial && initial.type === "file" && byRelPath[initial.relPath.toLowerCase()]) goFile(initial.relPath);
  else if (initial && initial.type === "module" && moduleNames.indexOf(initial.module) !== -1) goModule(initial.module);
  else if (initial && initial.type === "checklist") goChecklist();
  else if (initial && initial.type === "bugs") goBugs();
  else goHome();
})();
`;

const html = buildHtml(jsonString);
writeFileSync(OUT_FILE, html, "utf8");
console.log("PM dashboard written: " + OUT_FILE);
console.log("Docs embedded: " + files.length + " · source files embedded: " + Object.keys(sources).length);
