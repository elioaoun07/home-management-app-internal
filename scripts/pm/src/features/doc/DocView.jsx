import { useEffect } from "preact/hooks";
import { parseFrontmatter } from "../../../shared/frontmatter.mjs";
import { parseMarkdown } from "../../lib/md-parse.js";
import { backlinkIndex, byRelPath, files, modal, pins, rememberDoc, togglePin } from "../../app/store.js";
import { route } from "../../app/router.js";
import { Chip, EmptyState } from "../../components/Primitives.jsx";
import { Icon } from "../../components/Icon.jsx";
import { Breadcrumbs } from "../nav/Breadcrumbs.jsx";
import { Markdown } from "./Markdown.jsx";

function preferredOrder(file) { const name=file.relPath.split("/").pop(); if(name==="_index.md")return 0; const n=name.match(/^(\d+)/); return n?Number(n[1]):99; }

export function DocView() {
  const file = byRelPath.value.get(route.value.relPath.toLowerCase());
  useEffect(() => {
    if (!file) return; rememberDoc(file.relPath);
    requestAnimationFrame(() => {
      const cb = route.value.query.get("cb"); const heading = route.value.query.get("h");
      const target = cb != null ? document.querySelector(`[data-cbidx="${CSS.escape(cb)}"]`) : heading ? document.getElementById(heading) : null;
      if (target) { target.scrollIntoView({block:"center"}); target.classList.add("flash"); setTimeout(()=>target.classList.remove("flash"),2400); }
    });
    const onKey = (event) => {
      if (event.target?.matches?.("input,textarea,select,[contenteditable=true]") || !["[","]"].includes(event.key)) return;
      const ordered = files.value.filter((entry) => entry.folder === file.folder && !entry.inFabled).sort((a,b) => preferredOrder(a)-preferredOrder(b) || a.relPath.localeCompare(b.relPath));
      const index = ordered.findIndex((entry) => entry.relPath === file.relPath);
      const next = event.key === "[" ? ordered[index - 1] : ordered[index + 1];
      if (next) { event.preventDefault(); location.hash = `/doc/${encodeURI(next.relPath)}`; }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [file?.relPath, route.value.path, route.value.query.toString()]);
  if (!file) return <EmptyState title="Document not found">The file may have been moved. Use search to locate it.</EmptyState>;
  const parsed = parseFrontmatter(file.raw); const headings = parseMarkdown(file.raw).filter((block)=>block.type==="heading"&&block.level>=2&&block.level<=3);
  const siblings = files.value.filter((entry)=>entry.folder===file.folder&&!entry.inFabled).sort((a,b)=>preferredOrder(a)-preferredOrder(b)||a.relPath.localeCompare(b.relPath));
  const at=siblings.findIndex((entry)=>entry.relPath===file.relPath); const backlinks=backlinkIndex.value.get(file.relPath.toLowerCase())||[];
  return <><Breadcrumbs items={[{label:file.module,href:`/module/${encodeURIComponent(file.module)}`},{label:file.folder.split("/").slice(1).join(" › ")||file.title},{label:file.title}]}/>
    <header class="page-head" style={{marginTop:18}}><div><div class="eyebrow">{file.relPath}</div><h1>{file.title}</h1><div class="doc-meta">{Object.entries(parsed.meta).map(([key,value])=><Chip key={key}><strong>{key}</strong> {Array.isArray(value)?value.join(", "):String(value)}</Chip>)}</div></div><div class="actions" style={{display:"flex",gap:8,flexWrap:"wrap"}}><button class="button" onClick={()=>togglePin(file.relPath)}><Icon name="pin"/>{pins.value.includes(file.relPath)?"Unpin":"Pin"}</button>{headings.length>0&&<select class="button" aria-label="Jump to section" onChange={(event)=>document.getElementById(event.currentTarget.value)?.scrollIntoView()}><option value="">Contents</option>{headings.map((heading)=><option value={heading.slug}>{heading.text}</option>)}</select>}{globalThis.PM_MODE==="server"&&<><button class="button" onClick={()=>{modal.value={type:"rename",path:file.relPath}}}>Rename</button><button class="button" onClick={()=>{modal.value={type:"move",path:file.relPath}}}>Move</button><button class="button" onClick={()=>{modal.value={type:"delete",path:file.relPath}}}>Delete</button></>}</div></header>
    <div class="doc-layout"><article class="doc-paper"><Markdown raw={file.raw} file={file.relPath}/><nav class="prev-next">{siblings[at-1]?<a href={`#/doc/${encodeURI(siblings[at-1].relPath)}`}>← {siblings[at-1].title}</a>:<span/>}{siblings[at+1]?<a href={`#/doc/${encodeURI(siblings[at+1].relPath)}`}>{siblings[at+1].title} →</a>:<span/>}</nav></article>
      <aside class="doc-rail"><div class="eyebrow">On this page</div><nav class="toc">{headings.map((heading)=><a class={`level-${heading.level}`} href={`#/doc/${encodeURI(file.relPath)}?h=${heading.slug}`}>{heading.text}</a>)}</nav>{backlinks.length>0&&<div class="backlinks"><div class="eyebrow">Linked from ({backlinks.length})</div>{backlinks.map((link)=><a class="nav-link" href={`#/doc/${encodeURI(link.from)}`}><Icon name="arrow" size={14}/><span>{link.title}</span></a>)}</div>}</aside>
    </div></>;
}
