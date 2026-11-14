import { useRef, useState } from "react";
import {
  ChartNoAxesCombined,
  Compass,
  Home,
  Menu,
  Zap,
  Shield,
} from "lucide-react";
import { Sheet } from "./components";
import { liveRuns } from "./model";
import type { RunSummary, V2RunSummary } from "./types";
import "./navigation.css";

const links = [
  { path: "/bridge", label: "Bridge", icon: Home },
  { path: "/launch", label: "Launch", icon: Zap },
  { path: "/sessions", label: "Sessions", icon: Compass },
  { path: "/setup", label: "Setup", icon: Shield },
  { path: "/score", label: "Score", icon: ChartNoAxesCombined },
];

export const secondaryLinks = [
  { href: "#/sprints", label: "Plan" },
  { href: "#/setup?tab=conflicts", label: "Conflicts" },
  { href: "#/library", label: "Library" },
  { href: "#/activity", label: "Activity" },
  { href: "#/attention", label: "Decisions" },
  { href: "#/read?file=0%20-%20Inbox.md", label: "Idea inbox" },
  { href: "#/read?file=_index.md", label: "Documents" },
];

export function MoreNavigation({
  referenceTools,
}: {
  referenceTools: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        className="icon-button"
        aria-label="More navigation"
        title="More"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={19} />
      </button>
      <Sheet
        title="More"
        open={open}
        onClose={() => setOpen(false)}
        returnFocus={trigger}
        side
      >
        <nav className="secondary-navigation" aria-label="More navigation">
          {secondaryLinks.map(({ href, label }) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          {referenceTools && <a href="#/library">Document tools</a>}
        </nav>
      </Sheet>
    </>
  );
}

export function deliveryNavState(
  runs: RunSummary[],
  v2Runs: V2RunSummary[],
  confirmed: boolean,
) {
  const legacy = liveRuns(runs).length;
  const open = v2Runs.filter((run) => run.lifecycle !== "CLOSED");
  const count = legacy + open.length;
  // Waiting for approval/paused is an open session, not observed execution.
  const executing =
    legacy > 0 || open.some((run) => run.active || run.lifecycle === "ACTIVE");
  const state = !confirmed
    ? "unconfirmed"
    : executing
      ? "running"
      : count
        ? "waiting"
        : "idle";
  return { count, state };
}

export function PrimaryNavigation({
  section,
  mobile = false,
  delivery,
  setupNeedsAttention = false,
}: {
  section: string;
  mobile?: boolean;
  delivery: ReturnType<typeof deliveryNavState>;
  setupNeedsAttention?: boolean;
}) {
  return (
    <nav
      className={mobile ? "primary-nav mobile-nav" : "primary-nav desktop-nav"}
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
    >
      {links.map(({ path, label, icon: Icon }) => {
        const isDelivery = path === "/sessions";
        const setupAttention = path === "/setup" && setupNeedsAttention;
        const status =
          delivery.state === "unconfirmed"
            ? "status unconfirmed"
            : delivery.count
              ? `${delivery.count} ${delivery.state}`
              : "";
        return (
          <a
            key={path}
            href={"#" + path}
            className={isDelivery ? "nav-delivery" : undefined}
            data-delivery-state={isDelivery ? delivery.state : undefined}
            aria-label={
              setupAttention
                ? "Setup, attention needed"
                : isDelivery && status
                  ? `Sessions, ${status}`
                  : undefined
            }
            aria-current={section === path ? "page" : undefined}
            title={
              setupAttention
                ? "Setup needs attention"
                : isDelivery && status
                  ? status
                  : undefined
            }
          >
            <span className="nav-symbol" aria-hidden="true">
              <Icon size={22} strokeWidth={1.6} />
              {setupAttention && <span className="setup-attention-dot" />}
            </span>
            <strong>{label}</strong>
          </a>
        );
      })}
    </nav>
  );
}
