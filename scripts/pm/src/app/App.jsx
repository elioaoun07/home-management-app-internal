import { useEffect } from "preact/hooks";
import { route } from "./router.js";
import { files, loadError, loading, menuOpen, modal, paletteOpen, theme } from "./store.js";
import { Icon } from "../components/Icon.jsx";
import { EmptyState } from "../components/Primitives.jsx";
import { ToastHost } from "../components/Toast.jsx";
import { Sidebar } from "../features/nav/Sidebar.jsx";
import { HomeView } from "../features/home/HomeView.jsx";
import { ModuleView } from "../features/module/ModuleView.jsx";
import { DocView } from "../features/doc/DocView.jsx";
import { TasksView } from "../features/tasks/TasksView.jsx";
import { BugsRollup, ChecklistRollup } from "../features/rollups/Rollups.jsx";
import { CommandPalette } from "../features/search/CommandPalette.jsx";
import { SearchView } from "../features/search/SearchView.jsx";
import { syncSearch } from "../features/search/searchStore.js";
import { SourcePreview } from "../features/source/SourcePreview.jsx";
import { DeliveryHome } from "../features/delivery/DeliveryHome.jsx";
import { SessionDetail } from "../features/delivery/SessionDetail.jsx";
import { FileOpsModals } from "../features/files/FileOpsModals.jsx";

function applyTheme(value){const dark=value==="auto"?!matchMedia("(prefers-color-scheme: light)").matches:value==="blue";const resolved=dark?"blue":"frost";document.documentElement.dataset.theme=resolved;document.querySelector('meta[name="theme-color"]')?.setAttribute("content",dark?"#0a1628":"#f8fafc");}

export function App(){
  useEffect(()=>{applyTheme(theme.value);const media=matchMedia("(prefers-color-scheme: light)");const update=()=>theme.value==="auto"&&applyTheme("auto");media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[theme.value]);
  useEffect(()=>{if(files.value.length)syncSearch(files.value);},[files.value.map((file)=>`${file.relPath}:${file.mtimeMs}`).join("|")]);
  if(loading.value)return <div class="empty" style={{margin:"20vh auto",maxWidth:460}}>Loading the PM command center…</div>;
  if(loadError.value)return <div class="empty" style={{margin:"20vh auto",maxWidth:540}}><h2>Could not load PM data</h2><p>{loadError.value.message}</p></div>;
  return <div class={`app-shell ${menuOpen.value?"menu-open":""}`}><Sidebar/><div class="main-column"><header class="topbar"><button class="icon-button mobile-menu" onClick={()=>{menuOpen.value=!menuOpen.value}}><Icon name="menu"/></button><button class="search-trigger" onClick={()=>{paletteOpen.value=true}}><Icon name="search"/><span>Search or run a command</span><kbd>Ctrl K</kbd></button><div class="topbar-spacer"/><button class="theme-button" onClick={()=>{theme.value=theme.value==="auto"?"blue":theme.value==="blue"?"frost":"auto"}} title={`Theme: ${theme.value}`}><Icon name="sun"/></button>{globalThis.PM_MODE==="server"&&<button class="icon-button" onClick={()=>{modal.value={type:"create",dir:""}}} title="Create document"><Icon name="plus"/></button>}</header><main class="content"><RouterOutlet/></main></div>{menuOpen.value&&<button aria-label="Close navigation" onClick={()=>{menuOpen.value=false}} style={{position:"fixed",zIndex:55,inset:0,background:"rgba(0,0,0,.45)"}}/>}<CommandPalette/><SourcePreview/><FileOpsModals/><ToastHost/></div>;
}

function RouterOutlet(){const current=route.value;if(current.name==="home")return <HomeView/>;if(current.name==="module")return <ModuleView/>;if(current.name==="doc")return <DocView/>;if(current.name==="tasks")return <TasksView/>;if(current.name==="checklist")return <ChecklistRollup/>;if(current.name==="bugs")return <BugsRollup/>;if(current.name==="search")return <SearchView/>;if(current.name==="delivery"&&globalThis.PM_MODE==="server")return <DeliveryHome/>;if(current.name==="delivery-session"&&globalThis.PM_MODE==="server")return <SessionDetail/>;if((current.name==="delivery"||current.name==="delivery-session")&&globalThis.PM_MODE!=="server"){location.hash="/";return null;}return <EmptyState title="Page not found"><a href="#/">Return to the command center</a></EmptyState>;}
