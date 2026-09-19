import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import { Compass, Home as HomeIcon, Palette, Search, Zap } from "lucide-react";
import { client, pmKeys, useRoute, useWorld } from "./state";
import { transport } from "./transport";
import { RunV2 } from "./DeliveryV2";
import { connectionChips } from "./v2model";
import { liveRuns } from "./model";
import { CaptureButton, Empty } from "./components";
import { Home } from "./Home";
import { Explore, SpaceView } from "./Explore";
import { WorkView } from "./Work";
import { Activity, Attention, Capture, Reader } from "./Auxiliary";
import { Dashboard } from "./Dashboard";
import { Delivery, Launch } from "./Delivery";
import { Run } from "./Run";

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
        {transport().capabilities.referenceTools && (
          <a className="plain-link" href="/?ui=classic">
            Open fallback
          </a>
        )}
      </Empty>
    ) : (
      this.props.children
    );
  }
}
const links = [
  { path: "/", label: "Home", icon: HomeIcon },
  { path: "/explore", label: "Work", icon: Compass },
  { path: "/delivery", label: "Delivery", icon: Zap },
];
export function App() {
  const route = useRoute();
  const { world, runs, connected, readError, connection } = useWorld();
  const capabilities = transport().capabilities;
  const [capture, setCapture] = useState(false);
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
  const section = ["delivery", "deliver"].includes(root)
    ? "/delivery"
    : ["explore", "space", "work", "module", "project"].includes(root)
      ? "/explore"
      : "/";
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
      view = <Home capture={() => setCapture(true)} />;
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
      view = <Launch />;
      break;
    case "delivery":
      view =
        route.parts[1] === "session" ? (
          <Run key={route.parts[2]} id={route.parts[2]} />
        ) : route.parts[1] === "run" ? (
          <RunV2 key={route.parts[2]} id={route.parts[2]} />
        ) : route.parts[1] === "new" ? (
          <Launch />
        ) : (
          <Delivery />
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
    case "dashboard":
      view = <Dashboard />;
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
  const running = liveRuns(runs).length;
  return (
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
          <span className="brand-symbol">
            e<span />
          </span>
          <b>era</b>
          <small>in the making</small>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map((link) => (
            <a
              key={link.path}
              href={"#" + link.path}
              aria-current={section === link.path ? "page" : undefined}
            >
              {link.label}
              {link.path === "/delivery" && running > 0 && (
                <span>{running}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="header-tools">
          <a
            className="icon-button search-shortcut"
            aria-label="Search work"
            href="#/explore"
          >
            <Search size={18} />
          </a>
          <CaptureButton onClick={() => setCapture(true)} />
          <button
            className="icon-button"
            aria-label={theme === "blue" ? "Use pink theme" : "Use blue theme"}
            title={theme === "blue" ? "Use pink theme" : "Use blue theme"}
            onClick={() => setTheme(theme === "blue" ? "pink" : "blue")}
          >
            <Palette size={18} />
          </button>
        </div>
      </header>
      {!connected && (
        <div className="offline-banner" role="status">
          {readError ? "Refresh unavailable" : "Offline"} · viewing{" "}
          {world.cachedAt ? "saved work" : "last known work"}
          <button onClick={() => location.reload()}>Reconnect</button>
        </div>
      )}
      {capabilities.kind === "relay" && (
        <div className="connection-strip" role="status" aria-label="Connection">
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
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {links.map((link) => (
          <a
            key={link.path}
            href={"#" + link.path}
            aria-current={section === link.path ? "page" : undefined}
          >
            <span>
              <link.icon size={22} strokeWidth={1.6} />
              {link.path === "/delivery" && running > 0 && <i />}
            </span>
            <strong>{link.label}</strong>
          </a>
        ))}
      </nav>
      <Capture open={capture} onClose={() => setCapture(false)} />
    </MotionConfig>
  );
}
