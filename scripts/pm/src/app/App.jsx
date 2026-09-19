import { useEffect } from "preact/hooks";
import { route } from "./router.js";
import {
  files,
  hideCompleted,
  loadError,
  loading,
  menuOpen,
  modal,
  offlineSnapshot,
  paletteOpen,
  reloadData,
  theme,
} from "./store.js";
import { Icon } from "../components/Icon.jsx";
import { EmptyState } from "../components/Primitives.jsx";
import { ToastHost } from "../components/Toast.jsx";
import { Sidebar } from "../features/nav/Sidebar.jsx";
import { MobileNav } from "../features/nav/MobileNav.jsx";
import { HomeView } from "../features/home/HomeView.jsx";
import { ProjectsView } from "../features/projects/ProjectsView.jsx";
import { ActivityView } from "../features/activity/ActivityView.jsx";
import { ModuleView } from "../features/module/ModuleView.jsx";
import { DocView } from "../features/doc/DocView.jsx";
import { TasksView } from "../features/tasks/TasksView.jsx";
import { WorkItem } from "../features/tasks/WorkItem.jsx";
import { DecisionsView } from "../features/decisions/DecisionsView.jsx";
import { BugsRollup, ChecklistRollup } from "../features/rollups/Rollups.jsx";
import { CommandPalette } from "../features/search/CommandPalette.jsx";
import { SearchView } from "../features/search/SearchView.jsx";
import { InboxView } from "../features/inbox/InboxView.jsx";
import { syncSearch } from "../features/search/searchStore.js";
import { SourcePreview } from "../features/source/SourcePreview.jsx";
import { DeliveryHome, DeliveryWizardPage } from "../features/delivery/DeliveryHome.jsx";
import { SessionDetail } from "../features/delivery/SessionDetail.jsx";
import { FileOpsModals } from "../features/files/FileOpsModals.jsx";

function applyTheme(value) {
  const dark = value === "auto" ? !matchMedia("(prefers-color-scheme: light)").matches : value === "blue";
  const resolved = dark ? "blue" : "frost";
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1020" : "#f5f6fb");
}

export function App() {
  const currentPath = route.value.path;
  const currentTheme = theme.value;
  const currentFiles = files.value;
  useEffect(() => {
    menuOpen.value = false;
    const main = document.getElementById("main-content");
    main?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [currentPath]);
  useEffect(() => {
    applyTheme(currentTheme);
    const media = matchMedia("(prefers-color-scheme: light)");
    const update = () => currentTheme === "auto" && applyTheme("auto");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [currentTheme]);

  useEffect(() => {
    if (currentFiles.length) syncSearch(currentFiles);
  }, [currentFiles]);

  if (loading.value) return <div class="empty boot-state">Loading the PM command center…</div>;
  if (loadError.value && !files.value.length) return <div class="empty boot-state" role="alert"><h2>Could not load workspace</h2><p>{loadError.value.message}</p><button class="button" onClick={() => reloadData().catch(() => {})}>Retry</button></div>;

  return <div class={`app-shell ${menuOpen.value ? "menu-open" : ""}`}>
    <a class="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>Skip to content</a>
    <Sidebar />
    <div class="main-column">
      <header class="topbar">
        <button class="icon-button mobile-menu" onClick={() => { menuOpen.value = !menuOpen.value; }} aria-label="Open navigation"><Icon name="menu" /></button>
        <button class="search-trigger" onClick={() => { paletteOpen.value = true; }}><Icon name="search" /><span>Search or run a command</span><kbd>Ctrl K</kbd></button>
        <div class="topbar-spacer" />
        <button class="icon-button" onClick={() => reloadData().catch(() => {})} title="Refresh PM data"><Icon name="refresh" /></button>
        <button class={`icon-button ${hideCompleted.value ? "is-on" : ""}`} aria-pressed={hideCompleted.value} onClick={() => { hideCompleted.value = !hideCompleted.value; }} title={hideCompleted.value ? "Showing open items only — click to show completed" : "Hide completed items"}><Icon name={hideCompleted.value ? "eye-off" : "eye"} /></button>
        <button class="theme-button" onClick={() => { theme.value = theme.value === "auto" ? "blue" : theme.value === "blue" ? "frost" : "auto"; }} title={`Theme: ${theme.value}`}><Icon name={theme.value === "blue" ? "moon" : "sun"} /></button>
        {globalThis.PM_MODE === "server" && <button class="icon-button" onClick={() => { modal.value = { type: "idea" }; }} title="Capture idea"><Icon name="bulb" /></button>}
      </header>
      {offlineSnapshot.value && <div class="offline-banner"><Icon name="clock" />Offline snapshot from {new Date(offlineSnapshot.value.cachedAt).toLocaleString()} — reconnect to your laptop's Wi-Fi for live data.</div>}
      {loadError.value && <div class="offline-banner" role="alert">Refresh failed. Showing the last loaded workspace.<button class="button" onClick={() => reloadData().catch(() => {})}>Retry</button></div>}
      <main class="content" id="main-content" tabIndex={-1}><RouterOutlet /></main>
      <MobileNav />
    </div>
    {menuOpen.value && <button aria-label="Close navigation" class="nav-scrim" onClick={() => { menuOpen.value = false; }} />}
    <CommandPalette />
    <SourcePreview />
    <FileOpsModals />
    <ToastHost />
  </div>;
}

function RouterOutlet() {
  const current = route.value;
  if (current.name === "home") return <HomeView />;
  if (current.name === "projects") return <ProjectsView />;
  if (current.name === "activity") return <ActivityView />;
  if (current.name === "module") return <ModuleView />;
  if (current.name === "doc") return <DocView />;
  if (current.name === "tasks") return <TasksView />;
  if (current.name === "work-item") return <WorkItem key={`${current.campaign}:${current.itemId}`} />;
  if (current.name === "decisions") return <DecisionsView />;
  if (current.name === "checklist") return <ChecklistRollup />;
  if (current.name === "bugs") return <BugsRollup />;
  if (current.name === "search") return <SearchView />;
  if (current.name === "inbox") return <InboxView />;
  if (current.name === "delivery" && globalThis.PM_MODE === "server") return <DeliveryHome />;
  if (current.name === "delivery-new" && globalThis.PM_MODE === "server") return <DeliveryWizardPage />;
  if (current.name === "delivery-session" && globalThis.PM_MODE === "server") return <SessionDetail key={current.id} />;
  if (["delivery", "delivery-new", "delivery-session"].includes(current.name) && globalThis.PM_MODE !== "server") {
    location.hash = "/";
    return null;
  }
  return <EmptyState title="Page not found"><a href="#/">Return to the command center</a></EmptyState>;
}
