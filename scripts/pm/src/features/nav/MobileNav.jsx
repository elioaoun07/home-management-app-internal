import { route } from "../../app/router.js";
import { Icon } from "../../components/Icon.jsx";

// Five is the ceiling at 390px. Checklist leaves the bar rather than Search or
// Inbox: it is one tap away from the Home tiles and the sidebar, while those two
// had no phone-reachable entry point at all before this.
const TABS = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/tasks", icon: "tasks", label: "Tasks" },
  { href: "/search", icon: "search", label: "Search" },
  { href: "/inbox", icon: "inbox", label: "Inbox" },
  { href: "/delivery", icon: "bolt", label: "Delivery", serverOnly: true },
];

// Fixed bottom tab bar for phone-width viewports (shown ≤700px via mobile.css).
export function MobileNav() {
  const path = route.value.path;
  return <nav class="m-nav" aria-label="Primary">{TABS.filter((tab) => !tab.serverOnly || globalThis.PM_MODE === "server").map((tab) => {
    const active = tab.href === "/" ? path === "/" : path.startsWith(tab.href);
    return <a class={`m-nav-item ${active ? "active" : ""}`} href={`#${tab.href}`} key={tab.href}><Icon name={tab.icon}/><span>{tab.label}</span></a>;
  })}</nav>;
}
