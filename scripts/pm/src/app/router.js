import { signal } from "@preact/signals";

export function parseRoute(hash = "") {
  const raw = String(hash || "").replace(/^#/, "") || "/";
  const question = raw.indexOf("?");
  const path = question >= 0 ? raw.slice(0, question) : raw;
  const query = new URLSearchParams(question >= 0 ? raw.slice(question + 1) : "");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { name: "home", path: "/", query };
  if (parts[0] === "module" && parts[1]) return { name: "module", module: parts.slice(1).join("/"), path, query };
  if (parts[0] === "doc" && parts[1]) return { name: "doc", relPath: parts.slice(1).join("/"), path, query };
  if (parts[0] === "tasks") return { name: "tasks", mode: parts[1] === "table" ? "table" : "board", path, query };
  if (["checklist", "bugs", "search", "delivery"].includes(parts[0])) {
    return { name: parts[0] === "delivery" && parts[1] === "session" ? "delivery-session" : parts[0], id: parts[2] || null, path, query };
  }
  return { name: "not-found", path, query };
}

export const route = signal(parseRoute(typeof location === "undefined" ? "#/" : location.hash));
export function navigate(path) { location.hash = path.startsWith("#") ? path.slice(1) : path; }
export function legacyRouteToHash(stored) {
  if (!stored) return "#/";
  let value = stored;
  try { value = JSON.parse(stored); } catch {}
  if (typeof value === "string") return value.startsWith("#") ? value : `#${value.startsWith("/") ? value : `/${value}`}`;
  if (!value?.type || value.type === "home") return "#/";
  if (value.type === "module" && value.module) return `#/module/${encodeURIComponent(value.module)}`;
  if (value.type === "file" && value.relPath) return `#/doc/${encodeURI(value.relPath)}`;
  if (["checklist", "bugs", "delivery"].includes(value.type)) return `#/${value.type}`;
  if (value.type === "delivery-session" && value.id) return `#/delivery/session/${encodeURIComponent(value.id)}`;
  return "#/";
}
export function initRouter() {
  if (!location.hash) {
    const old = localStorage.getItem("pm-dash-last-route");
    if (old) { history.replaceState(null, "", legacyRouteToHash(old)); localStorage.removeItem("pm-dash-last-route"); }
    else history.replaceState(null, "", "#/");
  }
  const update = () => { route.value = parseRoute(location.hash); };
  addEventListener("hashchange", update);
  update();
  return () => removeEventListener("hashchange", update);
}
