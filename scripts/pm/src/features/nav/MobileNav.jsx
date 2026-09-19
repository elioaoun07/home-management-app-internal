import { route } from "../../app/router.js";
import { Icon } from "../../components/Icon.jsx";
const TABS = [
  { href: "/", icon: "projects", label: "Project", names: ["home", "projects", "module"] },
  { href: "/work", icon: "tasks", label: "Work", names: ["tasks", "work-item", "checklist"] },
  { href: "/delivery", icon: "bolt", label: "Delivery", names: ["delivery", "delivery-new", "delivery-session"], serverOnly: true },
  { href: "/inbox", icon: "inbox", label: "Inbox", names: ["inbox"] },
];
export function MobileNav() {
  return <nav class="m-nav" aria-label="Primary">{TABS.filter((tab) => !tab.serverOnly || globalThis.PM_MODE === "server").map((tab) => {
    const active = tab.names.includes(route.value.name);
    return <a class={`m-nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} href={`#${tab.href}`} key={tab.href}><Icon name={tab.icon}/><span>{tab.label}</span></a>;
  })}</nav>;
}
