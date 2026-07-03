(function(){
  "use strict";
  var BT = String.fromCharCode(96);
  // PM_MODE is injected by the page: "static" (embedded, read-only) or "server" (live, writeable).
  var MODE = (window.PM_MODE || "static");
  var CAN_EDIT = (MODE === "server");
  var DATA, REPO_URL, REPO_PATH, PM_PREFIX, SOURCES, sourcesLC, SOURCE_KEYS;
  var files, byRelPath, moduleNames, searchIndex;
  function ingestScalars(){
    REPO_URL = DATA.repoRootFileUrl;
    REPO_PATH = DATA.repoRootPath;
    PM_PREFIX = DATA.pmDirRepoRel;
    SOURCES = DATA.sources || {};
    SOURCE_KEYS = DATA.sourceKeys || Object.keys(SOURCES);
    sourcesLC = {};
    SOURCE_KEYS.forEach(function(k){ sourcesLC[k.toLowerCase()] = k; });
  }

  var ICON_PATHS = {
    home:'<path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    checklist:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 8 2 2 4-4M8 15h8"/>',
    bug:'<path d="M9 9h6a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4Z"/><path d="M12 9V5M8 5l2 2M16 5l-2 2M5 14H2M5 18H2M19 14h3M19 18h3M9 14h.01M15 14h.01"/>',
    library:'<path d="M4 4h5v16H4zM10 4h5v16h-5zM16 4h4v16h-4z"/>',
    alert:'<path d="M12 3 2 21h20Z"/><path d="M12 9v4M12 17h.01"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    external:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    skip:'<path d="M5 5v14l14-7z"/>',
    pending:'<circle cx="12" cy="12" r="8"/>',
    severity:'<circle cx="12" cy="12" r="8"/>',
    wallet:'<path d="M4 7a3 3 0 0 1 3-3h11a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z"/><path d="M4 8h16v6h-5a2 2 0 0 1 0-4h5M15 11h.01"/>',
    building:'<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M8 12h.01M16 12h.01"/>',
    chat:'<path d="M20 11.5a7.5 7.5 0 0 1-11.8 6.1L4 19l1.4-3.7A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>',
    kitchen:'<path d="M4 4v7a3 3 0 0 0 6 0V4M7 4v17M16 4v17M16 4h3v7h-3"/>',
    bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4"/>',
    plane:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    pencil:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    folderplus:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6M9 14h6"/>'
  };
  function icon(name, className, label){
    return '<svg class="icon '+(className || '')+'" viewBox="0 0 24 24" '+(label ? 'role="img" aria-label="'+escapeHtml(label)+'"' : 'aria-hidden="true"')+'>'+ (ICON_PATHS[name] || ICON_PATHS.folder) +'</svg>';
  }
  var MOD_ICON = {
    "Budget":"wallet","FAR Execution Checklist":"checklist",
    "Functional Architecture Review":"building","Hub & ERA":"chat",
    "Kitchen":"kitchen","Notifications & Alerts":"bell",
    "Schedule":"calendar","Trips":"plane"
  };
  var MOD_ICON_CLASS = {
    "Budget":"icon-budget","FAR Execution Checklist":"icon-far",
    "Functional Architecture Review":"icon-architecture","Hub & ERA":"icon-hub",
    "Kitchen":"icon-kitchen","Notifications & Alerts":"icon-notifications",
    "Schedule":"icon-schedule","Trips":"icon-trips"
  };
  function modIcon(name){ return icon(MOD_ICON[name] || "folder", MOD_ICON_CLASS[name] || "icon-folder", name); }

  // ---------- file index ----------
  function indexFiles(){
  files = DATA.files.map(function(f){
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
  byRelPath = {};
  files.forEach(function(f){ byRelPath[f.relPath.toLowerCase()] = f; });

  moduleNames = [];
  files.forEach(function(f){
    if (f.module && moduleNames.indexOf(f.module) === -1) moduleNames.push(f.module);
  });
  moduleNames.sort();
  }

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
  function computeFileMeta(){
    files.forEach(function(f){
      f.checklist = extractChecklist(f.raw);
      f.severity = extractSeverity(f.raw);
    });
  }
  function recomputeFile(f){
    f.checklist = extractChecklist(f.raw);
    f.severity = extractSeverity(f.raw);
  }

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
      else if (r.kind === "broken") html = '<span class="broken-link" title="Link target not found">'+inline(label, currentFile)+' '+icon("alert", "", "Broken link")+'</span>';
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

  var RENDER_FILE = null, RENDER_CB = 0;
  function renderList(items, ordered){
    var html = ordered ? "<ol>" : "<ul>";
    items.forEach(function(it){
      var cls = it.cbState ? (" task " + it.cbState) : (it.resolvedNote ? " resolved-note" : "");
      var cb;
      if (it.cbState === "open" || it.cbState === "done"){
        cb = '<span class="cb" role="checkbox" tabindex="0" aria-checked="'+(it.cbState==="done")+'"'
           + (RENDER_FILE!=null && it.cbidx!=null ? ' data-file="'+attrEscape(RENDER_FILE)+'" data-cbidx="'+it.cbidx+'"' : '')
           + '></span>';
      } else if (it.cbState === "skipped"){
        cb = '<span class="cb"></span>';
      } else {
        cb = "";
      }
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
      var node = { indent: it.indent, html: it.html, cbState: it.cbState, cbidx: it.cbidx, resolvedNote: it.resolvedNote, ordered: it.ordered, children: [] };
      stack[stack.length-1].children.push(node);
      stack.push({ indent: it.indent, children: node.children });
    });
    return root;
  }

  var FENCE_EXTRACT_RE = new RegExp(BT+BT+BT+"([a-zA-Z0-9]*)\\n([\\s\\S]*?)"+BT+BT+BT, "g");
  function renderMarkdown(raw, currentFile){
    RENDER_FILE = currentFile ? currentFile.relPath : null;
    RENDER_CB = 0;
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
    var sectionStack = [];
    function flushPara(){
      if (para.length){
        var joined = para.join(" ");
        var cls = /✅/.test(joined) ? ' class="resolved-note"' : "";
        out.push("<p"+cls+">" + inline(joined, currentFile) + "</p>");
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
        while (sectionStack.length && sectionStack[sectionStack.length-1].level >= level){
          out.push("</div>"); sectionStack.pop();
        }
        var headingResolved = /✅/.test(text);
        if (headingResolved) out.push('<div class="resolved-note">');
        out.push("<h"+level+' id="'+slug+'">' + inline(text, currentFile) + "</h"+level+">");
        if (headingResolved) sectionStack.push({ level: level });
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
          rows.push({ cells: cells, resolved: /✅/.test(lines[i]) });
          i++;
        }
        var t = "<table><thead><tr>";
        headerCells.forEach(function(c){ t += "<th>"+inline(c, currentFile)+"</th>"; });
        t += "</tr></thead><tbody>";
        rows.forEach(function(r){
          t += "<tr"+(r.resolved ? ' class="resolved-note"' : "")+">";
          r.cells.forEach(function(c){ t += "<td>"+inline(c, currentFile)+"</td>"; });
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
          var cbidx = null;
          var cb = rest.match(/^\[([ xX])\]\s*(.*)$/);
          if (cb){ cbState = /x/i.test(cb[1]) ? "done" : "open"; rest = cb[2]; cbidx = RENDER_CB++; }
          else {
            var tag = rest.match(SKIP_TAG_RE);
            if (tag){ cbState = "skipped"; rest = tag[2] || tag[1]; }
          }
          var resolvedNote = !cbState && /✅/.test(lm[3]);
          items.push({ indent: indent, ordered: ordered, cbState: cbState, cbidx: cbidx, resolvedNote: resolvedNote, html: inline(rest, currentFile) });
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
    while (sectionStack.length){ out.push("</div>"); sectionStack.pop(); }
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
    hideCompletedToggle: document.getElementById("hide-completed-toggle"),
    preview: document.getElementById("preview"),
    previewBackdrop: document.getElementById("preview-backdrop"),
    previewName: document.getElementById("preview-name"),
    previewLang: document.getElementById("preview-lang"),
    previewOpen: document.getElementById("preview-open"),
    previewClose: document.getElementById("preview-close"),
    previewCode: document.getElementById("preview-code"),
    previewBody: document.getElementById("preview-body")
  };
  function updateGeneratedAt(){
    els.generatedAt.textContent = (CAN_EDIT ? "Live · " : "Updated ") + new Date(DATA.generatedAt).toLocaleString();
  }

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
  function renderPreviewCode(key, src, line){
    els.previewName.textContent = key + (line ? "  :" + line : "");
    els.previewOpen.href = "vscode://file/" + REPO_PATH + "/" + key + (line ? ":" + line : "");
    if (!src){
      els.previewLang.textContent = "";
      els.previewCode.className = "";
      els.previewCode.innerHTML = '<span class="c-com">/* Not embedded — use "Open in VS Code" for the full file. */</span>';
    } else {
      var lang = langFromPath(key);
      els.previewLang.textContent = LANG_LABEL[lang] || lang;
      els.previewCode.className = "lang-" + lang;
      els.previewCode.innerHTML = highlight(src.code, lang) +
        (src.truncated ? '\n<span class="c-com">/* … truncated for size — use "Open in VS Code" for the full file */</span>' : "");
    }
    els.previewBody.scrollTop = 0;
  }
  function openPreview(repoRel, line){
    var key = (SOURCES[repoRel] ? repoRel : sourcesLC[(repoRel||"").toLowerCase()]) || repoRel;
    document.body.classList.add("pv-open");
    if (MODE === "server"){
      els.previewName.textContent = key + (line ? "  :" + line : "");
      els.previewLang.textContent = "";
      els.previewCode.className = "";
      els.previewCode.textContent = "Loading…";
      els.previewOpen.href = "vscode://file/" + REPO_PATH + "/" + key + (line ? ":" + line : "");
      apiGet("/api/source?path=" + encodeURIComponent(key)).then(function(src){
        renderPreviewCode(key, src, line);
      }).catch(function(){ renderPreviewCode(key, null, line); });
    } else {
      renderPreviewCode(key, SOURCES[key] || null, line);
    }
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

  // ---------- toast ----------
  function toast(msg, kind){
    var host = document.getElementById("pm-toasts");
    if (!host){ host = document.createElement("div"); host.id = "pm-toasts"; document.body.appendChild(host); }
    var el = document.createElement("div");
    el.className = "pm-toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function(){ el.classList.add("show"); }, 10);
    setTimeout(function(){ el.classList.remove("show"); setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 250); }, 3400);
  }

  // ---------- interactive checkboxes (server mode) ----------
  function doToggle(fileRel, cbidx, el){
    if (!CAN_EDIT) return;
    var f = byRelPath[(fileRel||"").toLowerCase()];
    if (!f || cbidx == null || isNaN(cbidx)) return;
    var boxes = scanCheckboxes(f.raw);
    var expect = boxes[cbidx] ? boxes[cbidx].state : null;
    el.classList.add("cb-busy");
    apiPost("toggle", { file: fileRel, cbidx: cbidx, expectState: expect }).then(function(resp){
      f.raw = resp.raw;
      recomputeFile(f);
      renderTree();
      renderCurrent();
    }).catch(function(err){
      el.classList.remove("cb-busy");
      toast(String((err&&err.message)||err), "error");
      if (/drift|out-of-range/.test(String(err&&err.message))) reload();
    });
  }
  document.addEventListener("click", function(e){
    var cb = e.target && e.target.closest ? e.target.closest(".cb[data-cbidx]") : null;
    if (cb && CAN_EDIT){
      e.preventDefault(); e.stopPropagation();
      doToggle(cb.getAttribute("data-file"), parseInt(cb.getAttribute("data-cbidx"),10), cb);
    }
  });
  document.addEventListener("keydown", function(e){
    var t = e.target;
    if ((e.key === " " || e.key === "Enter") && t && t.classList && t.classList.contains("cb") && t.getAttribute && t.getAttribute("data-cbidx") != null && CAN_EDIT){
      e.preventDefault();
      doToggle(t.getAttribute("data-file"), parseInt(t.getAttribute("data-cbidx"),10), t);
    }
  });

  function setBreadcrumb(parts){
    els.breadcrumb.innerHTML = parts.map(function(p, idx){
      var isLast = idx === parts.length - 1;
      if (isLast) return '<span>'+p.label+'</span>';
      return '<a data-bc="'+idx+'">'+p.label+'</a>'+icon("arrow");
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
    html += '<a class="qlink" data-route="home">'+icon("home", "icon-home")+' Home</a>';
    var thisWeek = files.filter(function(f){ return f.isRoot; }).find ?
      files.filter(function(f){ return f.isRoot && /this week/i.test(f.fileName); })[0] : null;
    if (thisWeek) html += '<a class="qlink" data-nav-file="'+thisWeek.relPath+'">'+icon("calendar", "icon-calendar")+' This Week</a>';
    html += '<a class="qlink" data-route="checklist">'+icon("checklist", "icon-checklist")+' Checklist Rollup</a>';
    html += '<a class="qlink" data-route="bugs">'+icon("bug", "icon-bug")+' Bugs &amp; Gaps</a>';
    html += "</div>";

    html += '<div id="tree-toolbar">'
      + '<button class="tbtn" data-act="newfile" data-dir="" title="New file at root">'+icon("file")+' File</button>'
      + '<button class="tbtn" data-act="newfolder" data-dir="" title="New module folder">'+icon("folderplus")+' Folder</button>'
      + '</div>';

    var rootFiles = files.filter(function(f){ return f.isRoot; }).sort(function(a,b){ return a.order-b.order; });
    html += '<details class="group" open data-group="root"><summary data-folder="">'+icon("library", "icon-library")+' Strategic Docs'
      + '<span class="summary-actions"><button data-act="newfile" data-dir="" title="New file">'+icon("plus")+'</button></span>'
      + '</summary><div class="group-body">';
    rootFiles.forEach(function(f){
      html += fileLinkHTML(f);
    });
    html += "</div></details>";

    moduleNames.forEach(function(name){
      var modFiles = files.filter(function(f){ return f.module===name && !f.inFabled; }).sort(function(a,b){ return a.order-b.order; });
      var fabledFiles = files.filter(function(f){ return f.module===name && f.inFabled; }).sort(function(a,b){ return a.order-b.order; });
      var allModFiles = files.filter(function(f){ return f.module===name; });
      html += '<details class="group" data-group="'+attrEscape(name)+'"><summary data-folder="'+attrEscape(name)+'">'+modIcon(name)+' '+escapeHtml(name)+' '+severityDot(allModFiles)
        + '<span class="summary-actions">'
        + '<button data-act="newfile" data-dir="'+attrEscape(name)+'" title="New file">'+icon("plus")+'</button>'
        + '<button data-act="rename" data-path="'+attrEscape(name)+'" data-name="'+attrEscape(name)+'" data-folder-item="1" title="Rename module">'+icon("pencil")+'</button>'
        + '<button data-act="delete" data-path="'+attrEscape(name)+'" data-label="'+attrEscape(name)+'" title="Move module to trash">'+icon("trash")+'</button>'
        + '</span></summary><div class="group-body">';
      html += '<a class="file-link module-link" data-route="module" data-module="'+attrEscape(name)+'">Module Overview</a>';
      modFiles.forEach(function(f){ html += fileLinkHTML(f); });
      if (fabledFiles.length){
        html += '<details class="subgroup" data-group="'+attrEscape(name)+'-fabled"><summary data-folder="'+attrEscape(name)+'/FABLED">FABLED'
          + '<span class="summary-actions"><button data-act="newfile" data-dir="'+attrEscape(name)+'/FABLED" title="New file">'+icon("plus")+'</button></span>'
          + '</summary><div class="group-body">';
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
    var actions = '<span class="row-actions">'
      + '<button data-act="rename" data-path="'+attrEscape(f.relPath)+'" data-name="'+attrEscape(f.fileName)+'" title="Rename">'+icon("pencil")+'</button>'
      + '<button data-act="delete" data-path="'+attrEscape(f.relPath)+'" data-label="'+attrEscape(f.title)+'" title="Move to trash">'+icon("trash")+'</button>'
      + '</span>';
    return '<div class="file-link" data-nav-file="'+attrEscape(f.relPath)+'" data-path="'+attrEscape(f.relPath)+'" data-folder="'+attrEscape(f.dirPath)+'">'
      + '<span class="ft">'+escapeHtml(f.title)+'</span>'+badge+actions+'</div>';
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
    if (CAN_EDIT){
      Array.prototype.forEach.call(els.tree.querySelectorAll('[data-act="rename"]'), function(b){
        b.addEventListener("click", function(e){ e.stopPropagation(); e.preventDefault();
          renameItem(b.getAttribute("data-path"), b.getAttribute("data-name"), b.getAttribute("data-folder-item")==="1"); });
      });
      Array.prototype.forEach.call(els.tree.querySelectorAll('[data-act="delete"]'), function(b){
        b.addEventListener("click", function(e){ e.stopPropagation(); e.preventDefault();
          deleteItem(b.getAttribute("data-path"), b.getAttribute("data-label")); });
      });
      Array.prototype.forEach.call(els.tree.querySelectorAll('[data-act="newfile"]'), function(b){
        b.addEventListener("click", function(e){ e.stopPropagation(); e.preventDefault(); createItem(b.getAttribute("data-dir"), "file"); });
      });
      Array.prototype.forEach.call(els.tree.querySelectorAll('[data-act="newfolder"]'), function(b){
        b.addEventListener("click", function(e){ e.stopPropagation(); e.preventDefault(); createItem(b.getAttribute("data-dir"), "folder"); });
      });
      dndWire();
    }
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

  // collect open tasks under Now/Next headings, with scanCheckboxes-consistent cbidx
  function actionableInFile(f){
    var lines = f.raw.split("\n");
    var start = 0;
    if (/^---\s*$/.test(lines[0]||"")){ for (var j=1;j<lines.length;j++){ if(/^---\s*$/.test(lines[j])){ start=j+1; break; } } }
    var out=[], inFence=false, heading="", cb=0;
    for (var i=start;i<lines.length;i++){
      var line=lines[i];
      if(/^\s*(```|~~~)/.test(line)){ inFence=!inFence; continue; }
      if(inFence) continue;
      var h=line.match(/^(#{1,6})\s+(.*)$/);
      if(h){ heading=cleanInlineText(h[2]); continue; }
      var m=line.match(/^(\s*)(?:[-*]|\d+\.)\s+\[([ xX])\]\s*(.*)$/);
      if(m){ var idx=cb++; if(!/x/i.test(m[2])) out.push({ file:f, cbidx:idx, heading:heading, text:cleanInlineText(m[3]) }); }
    }
    return out;
  }

  function renderHome(){
    setBreadcrumb([{ label:"Home", go:goHome }]);
    var clAll = sumChecklist(files), sevAll = sumSeverity(files);
    var pctAll = clAll.total ? Math.round(clAll.done/clAll.total*100) : 0;
    var hotBugs = sevAll["\uD83D\uDD34"].open + sevAll["\uD83D\uDFE0"].open;

    var html = '<div class="home-hero"><h1>'+icon("home","icon-home")+' PM Command Center</h1>'
      + '<div class="hero-stats">'
      + '<div class="hero-stat accent"><div class="num">'+clAll.open+'</div><div class="lbl">Open tasks</div></div>'
      + '<div class="hero-stat red"><div class="num">'+hotBugs+'</div><div class="lbl">Hot bugs</div></div>'
      + '<div class="hero-stat green"><div class="num">'+pctAll+'%</div><div class="lbl">Done</div></div>'
      + '</div></div>';

    if (CAN_EDIT){
      html += '<div style="margin:-8px 0 18px;"><button class="qa-btn" data-quickadd="1">'+icon("plus")+' Quick add task or bug</button></div>';
    }

    // top risks (compact)
    var rootIndex = files.find(function(f){ return f.isRoot && f.isIndex; });
    if (rootIndex){
      var rm = rootIndex.raw.match(/#{1,3}[^\n]*risk[^\n]*\n([\s\S]*?)(\n#{1,3}\s|$)/i);
      if (rm){
        var bl = rm[1].split("\n").filter(function(l){ return /^\s*[-*]/.test(l); });
        if (bl.length){
          html += '<div class="callout"><h3>'+icon("alert","icon-alert")+' Top risks right now</h3><ul>';
          bl.forEach(function(l){ html += "<li>"+inline(l.replace(/^\s*[-*]\s*/,""), rootIndex)+"</li>"; });
          html += "</ul></div>";
        }
      }
    }

    // ---- two columns ----
    html += '<div class="home-cols"><div class="home-col-left">';

    // Do Now
    var todo = [];
    files.forEach(function(f){
      if (!f.module || f.inFabled) return;
      actionableInFile(f).forEach(function(t){
        var rank = /\bnow\b/i.test(t.heading) ? 0 : (/\bnext\b/i.test(t.heading) ? 1 : 2);
        if (rank < 2) todo.push({ t:t, rank:rank });
      });
    });
    todo.sort(function(a,b){ return a.rank-b.rank; });
    html += '<div class="panel"><div class="panel-h">'+icon("checklist","icon-checklist")+' Do Now / Next<span class="count">'+todo.length+' open</span></div>';
    if (!todo.length){ html += '<p class="empty-note">Nothing queued under Now/Next.</p>'; }
    todo.slice(0,16).forEach(function(o){
      var t=o.t;
      html += '<div class="donow-row">'
        + '<span class="cb donow-cb" role="checkbox" tabindex="0" data-file="'+attrEscape(t.file.relPath)+'" data-cbidx="'+t.cbidx+'"></span>'
        + '<div class="donow-main" data-nav-file="'+attrEscape(t.file.relPath)+'">'
        + '<div class="donow-text">'+escapeHtml(t.text||"(untitled)")+'</div>'
        + '<div class="donow-meta"><span class="donow-mod">'+modIcon(t.file.module)+' '+escapeHtml(t.file.module)+'</span>'
        + '<span>'+escapeHtml(o.rank===0?"Now":"Next")+'</span></div></div></div>';
    });
    html += "</div>";

    // This Week
    var thisWeek = files.filter(function(f){ return f.isRoot && /this week/i.test(f.fileName); })[0];
    if (thisWeek){
      var sections = extractSections(thisWeek.raw);
      if (sections.length){
        html += '<div class="panel"><div class="panel-h">'+icon("calendar","icon-calendar")+' This Week'
          + '<span class="count" data-jump-this-week="1" style="cursor:pointer;">full plan '+icon("arrow")+'</span></div>';
        sections.forEach(function(s){
          var total=s.done+s.open+s.skipped, pct= total?Math.round(s.done/total*100):0;
          html += '<div style="margin-bottom:9px;"><div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);">'
            + '<span>'+escapeHtml(s.heading)+'</span><span>'+s.done+'/'+total+'</span></div>'
            + '<div class="progress-bar"><span style="width:'+pct+'%"></span></div></div>';
        });
        html += "</div>";
      }
    }

    html += '</div><div class="home-col-right">';

    // Bugs & gaps
    var bugs = [];
    files.forEach(function(f){ f.severity.forEach(function(g){ if(!g.resolved) bugs.push({ g:g, f:f }); }); });
    bugs.sort(function(a,b){ return SEV_RANK[a.g.emoji]-SEV_RANK[b.g.emoji]; });
    html += '<div class="panel"><div class="panel-h">'+icon("bug","icon-bug")+' Bugs &amp; Gaps'
      + '<span class="count" data-route="bugs" style="cursor:pointer;">all '+icon("arrow")+'</span></div>';
    if (!bugs.length){ html += '<p class="empty-note">No open issues recorded.</p>'; }
    bugs.slice(0,10).forEach(function(b){
      html += '<div class="sev-chip" data-nav-file="'+attrEscape(b.f.relPath)+'">'+icon("severity","status-icon "+SEV_CLASS[b.g.emoji])
        + '<span class="st">'+escapeHtml(b.g.text)+'</span><span class="src">'+escapeHtml(b.f.module||b.f.title)+'</span></div>';
    });
    html += "</div>";

    // Stale modules
    var now = Date.now(), STALE = 14*24*3600*1000;
    var stale = [];
    moduleNames.forEach(function(name){
      var latest = files.filter(function(f){ return f.module===name; }).reduce(function(a,f){ return f.mtimeMs>a?f.mtimeMs:a; }, 0);
      if (latest && now-latest > STALE) stale.push({ name:name, days: Math.round((now-latest)/86400000) });
    });
    stale.sort(function(a,b){ return b.days-a.days; });
    if (stale.length){
      html += '<div class="panel"><div class="panel-h">'+icon("alert","icon-alert")+' Stale modules<span class="count">'+stale.length+'</span></div>';
      stale.forEach(function(s){
        html += '<div class="stale-row" data-go-module="'+attrEscape(s.name)+'">'+modIcon(s.name)+' <span>'+escapeHtml(s.name)+'</span><span class="stale-days">'+s.days+'d</span></div>';
      });
      html += "</div>";
    }

    html += '</div></div>';

    // Module health cards
    html += '<div class="section-h">Modules</div><div class="home-grid">';
    moduleNames.forEach(function(name){
      var modFiles = files.filter(function(f){ return f.module === name; });
      var cl = sumChecklist(modFiles), sev = sumSeverity(modFiles);
      var latest = modFiles.reduce(function(a,f){ return f.mtimeMs > a ? f.mtimeMs : a; }, 0);
      html += '<div class="mod-card" data-go-module="'+attrEscape(name)+'"><div class="mc-top">'+modIcon(name)+' '+escapeHtml(name)+'</div>';
      if (cl.total){
        var pct = Math.round(cl.done/cl.total*100);
        html += '<div class="progress-bar"><span style="width:'+pct+'%"></span></div>'
          + '<div style="font-size:11.5px;color:var(--muted-2);margin-top:5px;">'+cl.done+' / '+cl.total+' tasks done</div>';
      }
      html += '<div class="bug-pills">';
      [["\uD83D\uDD34","red"],["\uD83D\uDFE0","orange"],["\uD83D\uDFE1","yellow"]].forEach(function(p){
        var c = sev[p[0]].open; if (c>0) html += '<span class="bug-pill '+p[1]+'">'+icon("severity","status-icon "+p[1])+' '+c+'</span>';
      });
      html += '</div><div class="mc-updated">Updated '+ (latest? new Date(latest).toLocaleDateString() : "\u2014") +'</div></div>';
    });
    html += "</div>";

    els.view.innerHTML = html;
    Array.prototype.forEach.call(els.view.querySelectorAll("[data-go-module]"), function(c){
      c.addEventListener("click", function(){ goModule(c.getAttribute("data-go-module")); });
    });
    Array.prototype.forEach.call(els.view.querySelectorAll("[data-nav-file]"), function(a){
      a.addEventListener("click", function(){ goFile(a.getAttribute("data-nav-file")); });
    });
    var bugsLink = els.view.querySelector('[data-route="bugs"]');
    if (bugsLink) bugsLink.addEventListener("click", goBugs);
    var jw = els.view.querySelector("[data-jump-this-week]");
    if (jw && thisWeek) jw.addEventListener("click", function(){ goFile(thisWeek.relPath); });
    var qa = els.view.querySelector("[data-quickadd]");
    if (qa) qa.addEventListener("click", function(){ openQuickAdd(); });
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
        if (c>0) html += '<span class="bug-pill '+p[1]+'">'+icon("severity", "status-icon "+p[1])+' '+c+' open</span>';
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
    var html = '<div class="pagehead"><h1>'+icon("checklist", "icon-checklist")+' Checklist Rollup</h1></div>';
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
          var row = '<div class="rollup-row" data-go-file="'+f.relPath+'">'+icon(c.state==="skipped"?"skip":(c.state==="done"?"check":"pending"), "status-icon "+c.state)+'<div><div>'+escapeHtml(c.text||"(untitled)")+'</div><div class="rr-src">'+escapeHtml(f.title)+'</div></div></div>';
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
    var html = '<div class="pagehead"><h1>'+icon("bug", "icon-bug")+' Bugs &amp; Gaps</h1></div>';
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
          html += '<div class="rollup-row" data-go-file="'+e.f.relPath+'">'+icon("severity", "status-icon "+SEV_CLASS[e.g.emoji])+'<div><div>'+escapeHtml(e.g.text)+'</div><div class="rr-src">'+escapeHtml(e.f.title)+'</div></div></div>';
        });
      } else {
        html += '<p class="empty-note">No open issues recorded.</p>';
      }
      if (resolvedEntries.length){
        var rid = "bres-"+name.replace(/\W+/g,"");
        html += '<span class="toggle-resolved" data-toggle="'+rid+'">Show resolved ('+resolvedEntries.length+')</span>';
        html += '<div class="resolved-block" id="'+rid+'">';
        resolvedEntries.forEach(function(e){
          html += '<div class="rollup-row" data-go-file="'+e.f.relPath+'">'+icon("check", "status-icon done")+'<div><div>'+escapeHtml(e.g.text)+'</div><div class="rr-src">'+escapeHtml(e.f.title)+'</div></div></div>';
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
  function buildSearchIndex(){
  searchIndex = files.map(function(f){
    var fm = parseFrontmatter(f.raw);
    var bodyText = fm.body.replace(/\s+/g, " ").trim();
    return {
      f: f,
      titleHay: (f.title + " " + f.relPath).toLowerCase(),
      bodyText: bodyText,
      bodyLower: bodyText.toLowerCase()
    };
  });
  }
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

  // ---------- hide completed (global) ----------
  var HIDE_COMPLETED_KEY = "pm-dash-hide-completed";
  var hideCompleted = false;
  try{ hideCompleted = localStorage.getItem(HIDE_COMPLETED_KEY) === "1"; }catch(e){}
  els.hideCompletedToggle.checked = hideCompleted;
  document.body.classList.toggle("hide-completed", hideCompleted);
  els.hideCompletedToggle.addEventListener("change", function(){
    var on = els.hideCompletedToggle.checked;
    document.body.classList.toggle("hide-completed", on);
    try{ localStorage.setItem(HIDE_COMPLETED_KEY, on ? "1" : "0"); }catch(e){}
  });

  // ---------- modal system ----------
  var modalSubmit = null;
  function closeModal(){ document.body.classList.remove("modal-open"); modalSubmit = null; }
  function openModal(opts){
    document.getElementById("pm-modal-title").textContent = opts.title || "";
    var body = document.getElementById("pm-modal-body");
    body.innerHTML = opts.bodyHtml || "";
    document.getElementById("pm-modal-foot").innerHTML =
      '<button class="pm-btn" data-modal-cancel>Cancel</button>' +
      '<button class="pm-btn primary" data-modal-ok>'+escapeHtml(opts.submitLabel||"Save")+'</button>';
    modalSubmit = opts.onSubmit || null;
    document.body.classList.add("modal-open");
    if (opts.onOpen) opts.onOpen(body);
    var first = body.querySelector("input,select,textarea");
    if (first) setTimeout(function(){ first.focus(); if (first.select) first.select(); }, 30);
  }
  document.addEventListener("click", function(e){
    if (e.target.closest && e.target.closest("[data-modal-cancel]")){ closeModal(); return; }
    if (e.target === document.getElementById("pm-modal-backdrop")){ closeModal(); return; }
    var ok = e.target.closest && e.target.closest("[data-modal-ok]");
    if (ok && modalSubmit) modalSubmit();
  });
  document.addEventListener("keydown", function(e){
    if (!document.body.classList.contains("modal-open")) return;
    if (e.key === "Escape") closeModal();
    else if (e.key === "Enter" && modalSubmit){
      var ae = document.activeElement;
      if (ae && ae.tagName === "TEXTAREA") return;
      e.preventDefault(); modalSubmit();
    }
  });
  function mutationErr(err){ toast(String((err&&err.message)||err), "error"); }

  // ---------- file/folder mutations ----------
  function createItem(dir, kind){
    if (!CAN_EDIT) return;
    openModal({
      title: kind === "folder" ? "New folder" : "New file",
      bodyHtml:
        '<div class="pm-field"><label>'+(kind==="folder"?"Folder name":"File title")+'</label>'
        + '<input id="pm-new-name" placeholder="'+(kind==="folder"?"e.g. Backlog":"e.g. Risk Log")+'"></div>'
        + '<div style="font-size:11.5px;color:var(--muted-2);">In: '+escapeHtml(dir||"(root)")+'</div>',
      submitLabel: "Create",
      onSubmit: function(){
        var name = (document.getElementById("pm-new-name").value||"").trim();
        if (!name){ toast("Name required","error"); return; }
        apiPost("create", { dir: dir, kind: kind, name: name }).then(function(resp){
          toast("Created","success"); closeModal();
          return reload().then(function(){ if (resp.kind === "file" && resp.path) goFile(resp.path); });
        }).catch(mutationErr);
      }
    });
  }
  function renameItem(path, curName, isFolder){
    if (!CAN_EDIT) return;
    openModal({
      title: "Rename",
      bodyHtml: '<div class="pm-field"><label>New name</label><input id="pm-ren-name" value="'+attrEscape(curName)+'"></div>',
      submitLabel: "Rename",
      onSubmit: function(){
        var name = (document.getElementById("pm-ren-name").value||"").trim();
        if (!name){ toast("Name required","error"); return; }
        apiPost("rename", { path: path, name: name }).then(function(resp){
          toast("Renamed","success"); closeModal();
          return reload().then(function(){ if (!isFolder && resp.path) goFile(resp.path); });
        }).catch(mutationErr);
      }
    });
  }
  function deleteItem(path, label){
    if (!CAN_EDIT) return;
    openModal({
      title: "Move to trash?",
      bodyHtml: '<p style="font-size:13px;color:var(--muted);line-height:1.5;">“'+escapeHtml(label)+'” will be moved to <code>.trash/</code> and can be restored manually.</p>',
      submitLabel: "Move to trash",
      onSubmit: function(){
        apiPost("delete", { path: path }).then(function(){
          toast("Moved to trash","success"); closeModal();
          if (currentRoute.type === "file" && currentRoute.relPath === path) currentRoute = { type:"home" };
          else if (currentRoute.type === "module" && currentRoute.module === path) currentRoute = { type:"home" };
          return reload();
        }).catch(mutationErr);
      }
    });
  }
  function moveItem(from, toDir){
    if (!CAN_EDIT) return;
    apiPost("move", { from: from, toDir: toDir }).then(function(){ toast("Moved","success"); return reload(); }).catch(mutationErr);
  }
  function reorderFolder(dir, order){
    apiPost("reorder", { dir: dir, order: order }).then(function(){ return reload(); }).catch(mutationErr);
  }

  // ---------- quick add (task / bug to a module) ----------
  function pickModuleFile(mod, titleRe, fileRe){
    var cand = files.filter(function(f){ return f.module === mod && !f.inFabled; });
    var byFile = cand.filter(function(f){ return fileRe.test(f.fileName); })[0];
    if (byFile) return byFile;
    var byTitle = cand.filter(function(f){ return titleRe.test(f.title); })[0];
    return byTitle || cand.sort(function(a,b){ return b.order-a.order; })[0];
  }
  function openQuickAdd(presetModule){
    if (!CAN_EDIT) return;
    if (!moduleNames.length){ toast("No modules yet","error"); return; }
    var opts = moduleNames.map(function(m){
      return '<option value="'+attrEscape(m)+'"'+(m===presetModule?" selected":"")+'>'+escapeHtml(m)+'</option>';
    }).join("");
    openModal({
      title: "Quick add",
      bodyHtml:
        '<div class="pm-field"><label>Type</label><div class="pm-seg" id="pm-qa-seg">'
          + '<button type="button" data-qa="task" class="active">Task</button>'
          + '<button type="button" data-qa="bug">Bug / gap</button></div></div>'
        + '<div class="pm-field"><label>Module</label><select id="pm-qa-mod">'+opts+'</select></div>'
        + '<div class="pm-field"><label>Description</label><textarea id="pm-qa-text" placeholder="What needs doing?"></textarea></div>'
        + '<div class="pm-field" id="pm-qa-sev" style="display:none;"><label>Severity</label><select id="pm-qa-sevsel">'
          + '<option value="\uD83D\uDD34">\uD83D\uDD34 Blocker</option><option value="\uD83D\uDFE0" selected>\uD83D\uDFE0 Friction</option>'
          + '<option value="\uD83D\uDFE1">\uD83D\uDFE1 Annoyance</option><option value="\u26AA">\u26AA Parked</option></select></div>',
      submitLabel: "Add",
      onOpen: function(root){
        var seg = root.querySelector("#pm-qa-seg");
        seg.addEventListener("click", function(e){
          var b = e.target.closest("[data-qa]"); if (!b) return;
          Array.prototype.forEach.call(seg.children, function(c){ c.classList.remove("active"); });
          b.classList.add("active");
          root.querySelector("#pm-qa-sev").style.display = b.getAttribute("data-qa") === "bug" ? "" : "none";
        });
      },
      onSubmit: function(){
        var kind = document.querySelector("#pm-qa-seg .active").getAttribute("data-qa");
        var mod = document.getElementById("pm-qa-mod").value;
        var text = (document.getElementById("pm-qa-text").value||"").trim();
        if (!text){ toast("Description required","error"); return; }
        var target, line, afterHeading;
        if (kind === "task"){
          target = pickModuleFile(mod, /checklist/i, /checklist/i);
          line = "- [ ] " + text; afterHeading = "Now";
        } else {
          target = pickModuleFile(mod, /feature state/i, /feature state/i);
          line = "- " + document.getElementById("pm-qa-sevsel").value + " " + text; afterHeading = null;
        }
        if (!target){ toast("No target file in "+mod,"error"); return; }
        apiPost("append", { file: target.relPath, line: line, afterHeading: afterHeading }).then(function(){
          toast("Added to "+mod,"success"); closeModal(); return reload();
        }).catch(mutationErr);
      }
    });
  }

  // ---------- drag & drop (move + reorder) ----------
  var dragState = null;
  function basenameOf(p){ var s = p.split("/"); return s[s.length-1]; }
  function folderOf(relPath){ var s = relPath.split("/"); s.pop(); return s.join("/"); }
  function clearDropMarks(){
    Array.prototype.forEach.call(els.tree.querySelectorAll(".drop-before,.drop-after,.drop-into"), function(el){
      el.classList.remove("drop-before","drop-after","drop-into");
    });
  }
  function doReorder(folder, draggedName, targetName, before){
    var inFolder = files.filter(function(f){ return folderOf(f.relPath) === folder && /^(\d+)\s*-+\s*/.test(f.fileName); })
                        .sort(function(a,b){ return a.order-b.order; });
    var order = inFolder.map(function(f){ return f.fileName; });
    var di = order.indexOf(draggedName); if (di !== -1) order.splice(di,1);
    var ti = order.indexOf(targetName);
    if (ti === -1){ reorderFolder(folder, order.concat([draggedName])); return; }
    order.splice(before ? ti : ti+1, 0, draggedName);
    reorderFolder(folder, order);
  }
  function dndWire(){
    if (!CAN_EDIT) return;
    Array.prototype.forEach.call(els.tree.querySelectorAll('.file-link[data-path]'), function(a){
      a.setAttribute("draggable","true");
      a.addEventListener("dragstart", function(e){
        dragState = { path: a.getAttribute("data-path"), folder: a.getAttribute("data-folder")||"" };
        a.classList.add("dragging");
        try{ e.dataTransfer.setData("text/plain", dragState.path); e.dataTransfer.effectAllowed = "move"; }catch(_){}
      });
      a.addEventListener("dragend", function(){ a.classList.remove("dragging"); clearDropMarks(); dragState = null; });
      a.addEventListener("dragover", function(e){
        if (!dragState || dragState.path === a.getAttribute("data-path")) return;
        e.preventDefault(); clearDropMarks();
        var dest = a.getAttribute("data-folder")||"";
        if (dragState.folder === dest){
          var r = a.getBoundingClientRect();
          a.classList.add(e.clientY < r.top + r.height/2 ? "drop-before" : "drop-after");
        } else { a.classList.add("drop-into"); }
      });
      a.addEventListener("drop", function(e){
        if (!dragState || dragState.path === a.getAttribute("data-path")) return;
        e.preventDefault(); e.stopPropagation();
        var dest = a.getAttribute("data-folder")||"";
        if (dragState.folder === dest){
          var r = a.getBoundingClientRect();
          doReorder(dest, basenameOf(dragState.path), basenameOf(a.getAttribute("data-path")), e.clientY < r.top + r.height/2);
        } else { moveItem(dragState.path, dest); }
        clearDropMarks(); dragState = null;
      });
    });
    Array.prototype.forEach.call(els.tree.querySelectorAll('summary[data-folder]'), function(s){
      s.addEventListener("dragover", function(e){ if (!dragState) return; e.preventDefault(); clearDropMarks(); s.classList.add("drop-into"); });
      s.addEventListener("dragleave", function(){ s.classList.remove("drop-into"); });
      s.addEventListener("drop", function(e){
        if (!dragState) return; e.preventDefault(); e.stopPropagation();
        var dest = s.getAttribute("data-folder")||"";
        s.classList.remove("drop-into");
        if (folderOf(dragState.path) !== dest) moveItem(dragState.path, dest);
        dragState = null;
      });
    });
  }

  // ---------- data provider ----------
  function apiGet(url){
    return fetch(url, { headers:{ "Accept":"application/json" } }).then(function(r){
      if (!r.ok) return r.json().catch(function(){ return {}; }).then(function(j){ throw new Error(j.error || ("HTTP "+r.status)); });
      return r.json();
    });
  }
  function apiPost(op, body){
    return fetch("/api/"+op, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(body || {})
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){
        if (!r.ok || j.error) throw new Error(j.error || ("HTTP "+r.status));
        return j;
      });
    });
  }
  function loadData(){ return MODE === "server" ? apiGet("/api/data") : Promise.resolve(PM_DATA); }
  function ingest(data){ DATA = data; ingestScalars(); indexFiles(); computeFileMeta(); buildSearchIndex(); }

  function renderCurrent(){
    if (currentRoute.type === "module" && moduleNames.indexOf(currentRoute.module) === -1) currentRoute = { type:"home" };
    if (currentRoute.type === "file" && !byRelPath[(currentRoute.relPath||"").toLowerCase()]) currentRoute = { type:"home" };
    if (currentRoute.type === "module") renderModule(currentRoute.module);
    else if (currentRoute.type === "file") renderFile(currentRoute.relPath);
    else if (currentRoute.type === "checklist") renderChecklistRollup();
    else if (currentRoute.type === "bugs") renderBugsRollup();
    else renderHome();
    highlightActive();
  }
  function reload(){
    return loadData().then(function(data){ ingest(data); updateGeneratedAt(); renderTree(); renderCurrent(); });
  }
  var sseTimer = null;
  function subscribeSSE(){
    try{
      var es = new EventSource("/api/events");
      es.onmessage = function(){ clearTimeout(sseTimer); sseTimer = setTimeout(reload, 150); };
    }catch(e){}
  }

  // ---------- boot ----------
  loadData().then(function(data){
    ingest(data);
    updateGeneratedAt();
    if (CAN_EDIT) document.body.classList.add("can-edit");
    renderTree();
    var initial = null;
    try{ initial = JSON.parse(localStorage.getItem("pm-dash-last-route") || "null"); }catch(e){}
    if (initial && initial.type) currentRoute = initial;
    renderCurrent();
    if (MODE === "server") subscribeSSE();
  }).catch(function(err){
    els.view.innerHTML = '<p class="empty-note">Failed to load PM data: '+escapeHtml(String((err&&err.message)||err))+'</p>';
  });
})();
