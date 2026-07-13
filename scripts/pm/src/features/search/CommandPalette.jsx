import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { byRelPath, files, paletteOpen, pins, recents } from "../../app/store.js";
import { fuzzyFind } from "../../lib/fuzzy.js";
import { Icon } from "../../components/Icon.jsx";
import { searchReady, searchService } from "./searchStore.js";

const actions=[
  {label:"Go to overview",href:"#/",icon:"home"},{label:"Open task board",href:"#/tasks",icon:"tasks"},
  {label:"Open task table",href:"#/tasks/table",icon:"tasks"},{label:"Open checklist rollup",href:"#/checklist",icon:"check"},
  {label:"Open bugs rollup",href:"#/bugs",icon:"bug"},
];
if(globalThis.PM_MODE==="server")actions.push({label:"Open Delivery",href:"#/delivery",icon:"bolt"});

function resultHref(result){if(result.type==="task")return `#/doc/${encodeURI(result.relPath)}?cb=${result.cbidx}`;if(result.type==="heading")return `#/doc/${encodeURI(result.relPath)}?h=${result.slug}`;return `#/doc/${encodeURI(result.relPath)}`;}

export function CommandPalette(){
  const [query,setQuery]=useState("");const [selected,setSelected]=useState(0);const input=useRef(null);
  useEffect(()=>{if(paletteOpen.value){setQuery("");setSelected(0);requestAnimationFrame(()=>input.current?.focus());}},[paletteOpen.value]);
  const results=useMemo(()=>{
    if(!query){const recentFiles=[...pins.value,...recents.value].filter((path,index,arr)=>arr.indexOf(path)===index).map((path)=>byRelPath.value.get(path.toLowerCase())).filter(Boolean).map((file)=>({label:file.title,detail:file.relPath,href:`#/doc/${encodeURI(file.relPath)}`,icon:"file"}));return [...actions,...recentFiles].slice(0,12);}
    const actionRows=fuzzyFind(query,actions,(action)=>action.label).slice(0,4).map(({entry})=>entry);
    const fileRows=fuzzyFind(query,files.value,(file)=>`${file.title} ${file.relPath}`).slice(0,6).map(({entry:file})=>({label:file.title,detail:file.relPath,href:`#/doc/${encodeURI(file.relPath)}`,icon:"file"}));
    const searchRows=searchReady.value?searchService.search(query,12).map((result)=>({label:result.title||result.text,detail:`${result.type} · ${result.module||""}`,href:resultHref(result),icon:result.type==="task"?"tasks":result.type==="bug"?"bug":"file"})):[];
    return [...actionRows,...fileRows,...searchRows].filter((row,index,arr)=>arr.findIndex((other)=>other.href===row.href&&other.label===row.label)===index).slice(0,18);
  },[query,files.value,searchReady.value,pins.value,recents.value]);
  if(!paletteOpen.value)return null;
  const choose=(row)=>{location.hash=row.href.slice(1);paletteOpen.value=false;};
  const key=(event)=>{if(event.key==="ArrowDown"){event.preventDefault();setSelected((selected+1)%Math.max(1,results.length));}else if(event.key==="ArrowUp"){event.preventDefault();setSelected((selected-1+results.length)%Math.max(1,results.length));}else if(event.key==="Enter"&&results[selected])choose(results[selected]);else if(event.key==="Escape")paletteOpen.value=false;};
  return <div class="palette-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&(paletteOpen.value=false)}><section class="palette" role="dialog" aria-modal="true" aria-label="Command palette"><div class="palette-input"><Icon name="search"/><input ref={input} value={query} onInput={(event)=>{setQuery(event.currentTarget.value);setSelected(0);}} onKeyDown={key} placeholder="Search docs, tasks, bugs, or run a command…"/>{!searchReady.value&&<span class="chip">indexing…</span>}</div><div class="palette-results">{!results.length?<div class="empty">No results. Try m:Budget, s:blocker, or a task ID.</div>:results.map((row,index)=><button class={`palette-result ${index===selected?"selected":""}`} onMouseEnter={()=>setSelected(index)} onClick={()=>choose(row)}><Icon name={row.icon||"search"}/><span class="palette-result-main"><strong>{row.label}</strong>{row.detail&&<span>{row.detail}</span>}</span></button>)}</div><div class="palette-footer">↑↓ navigate · Enter open · filters: m: t: s: is: f:</div></section></div>;
}

