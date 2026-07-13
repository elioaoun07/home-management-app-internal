import { useEffect, useState } from "preact/hooks";
import { route } from "../../app/router.js";
import { EmptyState, Chip } from "../../components/Primitives.jsx";
import { searchReady, searchService } from "./searchStore.js";

function href(result){if(result.type==="task")return `#/doc/${encodeURI(result.relPath)}?cb=${result.cbidx}`;if(result.type==="heading")return `#/doc/${encodeURI(result.relPath)}?h=${result.slug}`;return `#/doc/${encodeURI(result.relPath)}`;}

export function SearchView(){
  const [query,setQuery]=useState(route.value.query.get("q")||"");
  useEffect(()=>{const timer=setTimeout(()=>{history.replaceState(null,"",`#/search?q=${encodeURIComponent(query)}`);},120);return()=>clearTimeout(timer);},[query]);
  const results=searchReady.value&&query?searchService.search(query,100):[];
  return <><header class="page-head"><div><div class="eyebrow">Global index</div><h1>Search</h1><p>Full-text search across documents, headings, tasks, and bug rows.</p></div></header><input class="search-trigger" style={{width:"100%",maxWidth:800}} autofocus value={query} onInput={(event)=>setQuery(event.currentTarget.value)} placeholder="N4 · m:Budget is:open · t:bug s:blocker"/>{!searchReady.value?<div class="empty" style={{marginTop:20}}>Building the local search index…</div>:!results.length?<EmptyState icon="search" title={query?"No results":"Search the PM vault"}>Use field filters or plain text. Results are permalinkable.</EmptyState>:<div class="search-list" style={{marginTop:20}}>{results.map((result)=><a class="search-hit" href={href(result)} style={{color:"inherit"}}><div style={{display:"flex",gap:8}}><Chip>{result.type}</Chip>{result.idChip&&<Chip tone="id">{result.idChip}</Chip>}<strong>{result.title||result.text}</strong></div><div class="muted" style={{fontSize:11,marginTop:7}}>{result.module} · {result.relPath}</div></a>)}</div>}</>;
}

