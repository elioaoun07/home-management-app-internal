import { computed, signal } from "@preact/signals";
import { scanCheckboxes } from "../../shared/md-scan.mjs";
import { extractLinks } from "../../shared/links.mjs";
import { parseFrontmatter } from "../../shared/frontmatter.mjs";
import { fileTasks, taskKey } from "../../shared/tasks.mjs";
import { apiPost, loadData } from "./api.js";
import { persistedSignal } from "../lib/persistedSignal.js";

export const data = signal(null);
export const loading = signal(true);
export const loadError = signal(null);
// Set when the last /api/data load came from the service worker's offline
// cache rather than a live laptop — { cachedAt } | null. Drives the "you're
// viewing a snapshot" banner and blocks mutations with a clear message
// instead of letting them fail on a raw network error.
export const offlineSnapshot = signal(null);
export const menuOpen = signal(false);
export const paletteOpen = signal(false);
export const sourcePreview = signal(null);
export const modal = signal(null);
export const toasts = signal([]);
export const theme = persistedSignal("pm-theme", "auto");
export const pins = persistedSignal("pm-pins", []);
export const recents = persistedSignal("pm-recents", []);
export const postponed = persistedSignal("pm-dash-postponed", {});
export const hideCompleted = persistedSignal("pm-dash-hide-completed", false);
export const treeState = persistedSignal("pm-dash-tree-state", {});

function titleOf(file) {
  return file.raw.match(/^#\s+(.+)$/m)?.[1]?.trim() || file.relPath.split("/").pop().replace(/\.md$/i, "");
}
function moduleOf(relPath) { return relPath.includes("/") ? relPath.split("/")[0] : "Command Center"; }

export const files = computed(() => (data.value?.files || []).filter((file) => !file.relPath.startsWith(".trash/")).map((file) => {
  const campaign = moduleOf(file.relPath);
  const status = String(parseFrontmatter(file.raw).meta.status || "");
  return { ...file, title: titleOf(file), module: campaign, folder: file.relPath.split("/").slice(0,-1).join("/"),
    inFabled: /(^|\/)FABLED[^/]*(\/|$)/i.test(file.relPath) || /^(superseded|baseline-frozen|template)$/i.test(status),
    tasks: fileTasks(file.raw) };
}));
export const byRelPath = computed(() => new Map(files.value.map((file) => [file.relPath.toLowerCase(), file])));
export const moduleNames = computed(() => [...new Set(files.value.map((file) => file.module))].sort((a,b) => a.localeCompare(b)));
export const allTasks = computed(() => files.value.flatMap((file) => file.tasks.map((task) => ({ ...task, type: "task", file: file.relPath,
  module: file.module, key: taskKey(file.relPath, task), postponed: Boolean(postponed.value[taskKey(file.relPath, task)]), inFabled: file.inFabled }))));
export const moduleStats = computed(() => moduleNames.value.map((module) => {
  const moduleFiles = files.value.filter((file) => file.module === module && !file.inFabled);
  const tasks = moduleFiles.flatMap((file) => file.tasks);
  const done = tasks.filter((task) => task.state === "done").length;
  return { module, files: moduleFiles.length, total: tasks.length, done, open: tasks.length - done, progress: tasks.length ? Math.round(done / tasks.length * 100) : 0 };
}).filter((stat) => stat.files > 0));
export const backlinkIndex = computed(() => {
  const result = new Map();
  for (const file of files.value) for (const link of extractLinks(file.raw, file.relPath)) {
    if (!link.resolved) continue;
    const key = link.resolved.relPath.toLowerCase(); const entries = result.get(key) || []; entries.push({ from: file.relPath, title: file.title, text: link.text }); result.set(key, entries);
  }
  return result;
});

let toastId = 0;
export function showToast(message, { type = "success", action = null, duration = 4000 } = {}) {
  const toast = { id: ++toastId, message, type, action }; toasts.value = [...toasts.value, toast];
  setTimeout(() => { toasts.value = toasts.value.filter((entry) => entry.id !== toast.id); }, duration);
}
export function dismissToast(id) { toasts.value = toasts.value.filter((entry) => entry.id !== id); }

export async function reloadData() {
  try {
    const { _offline, _cachedAt, ...next } = await loadData();
    data.value = next;
    offlineSnapshot.value = _offline ? { cachedAt: _cachedAt } : null;
    loadError.value = null;
  }
  catch (error) { loadError.value = error; throw error; }
  finally { loading.value = false; }
}

function replaceRaw(relPath, raw) {
  data.value = { ...data.value, files: data.value.files.map((file) => file.relPath === relPath ? { ...file, raw, mtimeMs: Date.now() } : file) };
}
function localToggle(raw, cbidx) {
  const boxes = scanCheckboxes(raw); const target = boxes[cbidx]; if (!target) return raw;
  const lines = raw.split("\n"); lines[target.line] = lines[target.line].replace(/(\[)([ xX])(\])/, (_, a, state, c) => `${a}${/x/i.test(state) ? " " : "x"}${c}`); return lines.join("\n");
}

export async function toggleTask(relPath, cbidx, { quiet = false } = {}) {
  const file = byRelPath.value.get(relPath.toLowerCase()); if (!file || globalThis.PM_MODE !== "server") return;
  if (offlineSnapshot.value) { showToast("Viewing an offline snapshot — reconnect to your laptop to make changes.", { type: "error" }); return; }
  const expected = scanCheckboxes(file.raw)[cbidx]?.state; if (!expected) return;
  const previous = file.raw; replaceRaw(relPath, localToggle(previous, cbidx));
  try {
    const result = await apiPost("toggle", { file: relPath, cbidx, expectState: expected }); replaceRaw(relPath, result.raw);
    if (!quiet) showToast(expected === "open" ? "Task completed" : "Task reopened", {
      action: { label: "Undo", run: () => toggleTask(relPath, cbidx, { quiet: true }) },
    });
  } catch (error) {
    replaceRaw(relPath, previous); if (error.status === 409) await reloadData().catch(() => {});
    showToast(error.status === 409 ? "File changed on disk; refreshed safely" : error.message, { type: "error" });
  }
}

export async function runMutation(op, body, success, undo = null) {
  if (offlineSnapshot.value) { showToast("Viewing an offline snapshot — reconnect to your laptop to make changes.", { type: "error" }); throw new Error("offline"); }
  try {
    const result = await apiPost(op, body); await reloadData();
    showToast(success, undo ? { action: { label: "Undo", run: () => undo(result) } } : {}); return result;
  } catch (error) { showToast(error.message, { type: "error" }); throw error; }
}

export function rememberDoc(relPath) {
  recents.value = [relPath, ...recents.value.filter((path) => path !== relPath)].slice(0, 5);
}
export function togglePin(relPath) { pins.value = pins.value.includes(relPath) ? pins.value.filter((path) => path !== relPath) : [...pins.value, relPath]; }
export function togglePostponed(key) { postponed.value = { ...postponed.value, [key]: !postponed.value[key] }; }
