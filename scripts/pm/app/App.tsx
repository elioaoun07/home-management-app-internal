import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import {
  BookOpen,
  Palette,
  Search,
  Settings as SettingsIcon,
} from "lucide-react";
import { ERAMark } from "@/components/shared/ERAMark";
import { setupAttention } from "./setupAttention";
import { SettingsSheet } from "./Settings";
import { GameProvider, GameToggle } from "./GameLayer";
import { client, pmKeys, useRoute, useWorld } from "./state";
import { transport } from "./transport";
import { RunV2, useV2Runs } from "./DeliveryV2";
import { connectionChips } from "./v2model";
import {
  deliveryNavState,
  MoreNavigation,
  PrimaryNavigation,
  primarySection,
} from "./PrimaryNavigation";
import { Empty } from "./components";
import { Bridge } from "./Bridge";
import { Setup } from "./Setup";
import { Sessions } from "./Sessions";
import { Score } from "./Score";
import { Library } from "./Library";
import { cockpitAlias } from "./cockpitModel";
import "./cockpit.css";
import { Explore, SpaceView } from "./Explore";
import { WorkView } from "./Work";
import { Activity, Attention, Capture, Reader } from "./Auxiliary";
import { Launch } from "./Delivery";
import { ItemUatWizard } from "./ItemUatWizard";
import { Run } from "./Run";
import { UatPage } from "./UatWizard";
import { Sprints } from "./Sprints";

class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <Empty title="This view could not open">
        <button className="secondary" onClick={() => location.reload()}>
          Reload
        </button>
        <a className="plain-link" href="#/library">
          Library
        </a>
      </Empty>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  const route = useRoute();
  const { world, runs, connected, readError, runError, connection, reconnect } =
    useWorld();
  const v2 = useV2Runs();
  const capabilities = transport().capabilities;
  const [reconnecting, setReconnecting] = useState(false);
  async function reconnectLocal() {
    setReconnecting(true);
    try { await reconnect(); }
    finally { setReconnecting(false); }
  }
  const [capture, setCapture] = useState(false);
  const [settings, setSettings] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      // Retire the reboot's light/green palettes, including saved preferences.
      return localStorage.getItem("pm-app-theme") === "pink" ? "pink" : "blue";
    } catch {
      return "blue";
    }
  });
  const reduced = useReducedMotion();
  const main = useRef<HTMLElement>(null);
  const root = route.parts[0] || "";
  const section = primarySection(route.parts);
  useEffect(() => {
    const alias = cockpitAlias(root, route.query, route.parts.length > 1);
    if (alias) location.replace("#" + alias);
  }, [root, route.query, route.parts.length]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        getComputedStyle(document.documentElement)
          .getPropertyValue("--theme-bg")
          .trim(),
      );
    void client.invalidateQueries({ queryKey: pmKeys.all });
    try {
      localStorage.setItem("pm-app-theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    main.current?.focus({ preventScroll: true });
  }, [route.path]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        location.hash = "/explore";
        setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>('[aria-label="Find work"]')
              ?.focus(),
          100,
        );
      }
      if (event.key === "Escape") setCapture(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  let view: ReactNode;
  switch (root) {
    case "":
    case "home":
    case "bridge":
      view = <Bridge />;
      break;
    case "setup":
      view = <Setup />;
      break;
    case "sessions":
      view = <Sessions />;
      break;
    case "uat-item":
      view = (
        <ItemUatWizard
          key={route.path}
          campaign={route.parts[1]}
          id={route.parts[2]}
        />
      );
      break;
    case "library":
      view = <Library />;
      break;
    case "sprints":
      view = <Sprints />;
      break;
    case "explore":
    case "project":
    case "projects":
      view = <Explore />;
      break;
    case "space":
    case "module":
      view = <SpaceView key={route.parts[1]} name={route.parts[1]} />;
      break;
    case "work":
      view =
        route.parts.length === 1 ? (
          <Explore />
        ) : (
          <WorkView
            key={route.path}
            campaign={route.parts[route.parts[1] === "item" ? 2 : 1]}
            id={route.parts[route.parts[1] === "item" ? 3 : 2]}
          />
        );
      break;
    case "deliver":
    case "launch":
      view = <Launch />;
      break;
    case "delivery":
      view =
        route.parts[1] === "session" ? (
          <Run key={route.parts[2]} id={route.parts[2]} />
        ) : route.parts[1] === "run" ? (
          <RunV2 key={route.parts[2]} id={route.parts[2]} />
        ) : route.parts[1] === "test" ? (
          <UatPage key={route.parts[2]} id={route.parts[2]} />
        ) : route.parts[1] === "new" ? (
          <Launch />
        ) : (
          <Sessions />
        );
      break;
    case "attention":
    case "decisions":
      view = <Attention />;
      break;
    case "activity":
    case "outcomes":
      view = <Activity />;
      break;
    case "analytics":
    case "dashboard":
    case "score":
      view = <Score />;
      break;
    case "read":
    case "doc":
      view = <Reader />;
      break;
    default:
      view = (
        <Empty title="Let’s find your place">
          <a className="primary" href="#/">
            Back to Today
          </a>
        </Empty>
      );
  }
  const delivery = deliveryNavState(
    runs,
    v2.data?.runs || [],
    connected && !connection.stale && !readError && !runError && !v2.isError,
  );
  return (
    <GameProvider>
      <MotionConfig reducedMotion="user">
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            main.current?.focus();
          }}
        >
          Skip to content
        </a>
        <header className="app-header">
          <a className="wordmark" href="#/" aria-label="ERA Home">
            <ERAMark module="memory" size={38} />
            <b>era</b>
            <small className="os-wordmark">Agentic OS</small>
          </a>
          <PrimaryNavigation
            section={section}
            delivery={delivery}
            setupNeedsAttention={setupAttention(world.cockpit).needsAttention}
          />
          <div className="header-tools">
            <a
              className="icon-button"
              href="#/library"
              aria-label="Library"
              title="Library"
            >
              <BookOpen size={18} />
            </a>
            <a
              className="icon-button search-shortcut"
              aria-label="Search work"
              href="#/explore"
            >
              <Search size={18} />
            </a>
            <GameToggle />
            <button
              className="icon-button"
              aria-label={
                theme === "blue" ? "Use pink theme" : "Use blue theme"
              }
              title={theme === "blue" ? "Use pink theme" : "Use blue theme"}
              onClick={() => setTheme(theme === "blue" ? "pink" : "blue")}
            >
              <Palette size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Settings"
              title="Settings"
              onClick={() => setSettings(true)}
            >
              <SettingsIcon size={18} />
            </button>
            <MoreNavigation referenceTools={capabilities.referenceTools} />
          </div>
        </header>
        {!connected && (
          <div className="offline-banner" role="status">
            {readError ? "Refresh unavailable" : "Offline"} · viewing{" "}
            {world.cachedAt ? "saved work" : "last known work"}
            <button disabled={reconnecting} onClick={() => capabilities.kind === "local" ? void reconnectLocal() : location.reload()}>
              {reconnecting ? "Connecting…" : "Reconnect"}
            </button>
          </div>
        )}
        {capabilities.kind === "relay" && (
          <div
            className="connection-strip"
            role="status"
            aria-label="Connection"
          >
            {connectionChips(connection, Date.now()).map((chip) => (
              <span key={chip.key} data-tone={chip.tone}>
                <b>{chip.label}</b>
                {chip.value}
              </span>
            ))}
          </div>
        )}
        <main ref={main} id="main-content" className="app-main" tabIndex={-1}>
          <Boundary key={route.path}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={route.path}
                initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -6 }}
                transition={{ duration: reduced ? 0 : 0.18 }}
              >
                {view}
              </motion.div>
            </AnimatePresence>
          </Boundary>
        </main>
        <PrimaryNavigation
          section={section}
          delivery={delivery}
          mobile
          setupNeedsAttention={setupAttention(world.cockpit).needsAttention}
        />
        <Capture open={capture} onClose={() => setCapture(false)} />
        <SettingsSheet open={settings} onClose={() => setSettings(false)} />
      </MotionConfig>
    </GameProvider>
  );
}
