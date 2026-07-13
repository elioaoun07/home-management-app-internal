import { useEffect, useState } from "preact/hooks";
import { apiGet } from "../../app/api.js";
import { data, sourcePreview } from "../../app/store.js";
import { Icon } from "../../components/Icon.jsx";

export function SourcePreview() {
  const path = sourcePreview.value; const [content,setContent]=useState(""); const [error,setError]=useState("");
  useEffect(()=>{ if(!path)return; setContent("");setError(""); if(globalThis.PM_MODE==="server") apiGet(`/api/source?path=${encodeURIComponent(path)}`).then((source)=>setContent(source.content||source.raw||String(source))).catch((err)=>setError(err.message)); else { const source=data.value?.sources?.[path]; if(source)setContent(typeof source==="string"?source:source.content||""); else setError("Source was not embedded in this static dashboard."); } },[path]);
  if(!path)return null;
  return <div class="modal-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&(sourcePreview.value=null)}><section class="modal" style={{width:"min(1000px,96vw)"}}><div class="page-head"><div><div class="eyebrow">Source preview</div><h2>{path}</h2></div><button class="icon-button" onClick={()=>{sourcePreview.value=null}}><Icon name="close"/></button></div>{error?<div class="empty">{error}</div>:<pre style={{overflow:"auto",maxHeight:"72vh"}}><code>{content||"Loading…"}</code></pre>}</section></div>;
}

