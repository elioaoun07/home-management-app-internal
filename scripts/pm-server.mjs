// scripts/pm-server.mjs
// Live, interactive PM Command Center server (zero dependencies — Node built-ins).
//   pnpm pm            -> start + open browser at http://127.0.0.1:4317
//   pnpm pm --no-open  -> start without opening a browser
//   pnpm pm --lan      -> also listen on the LAN (phone access; trusted Wi-Fi only)
//   PM_PORT=5000 pnpm pm  (or --port=5000, --host=0.0.0.0, PM_HOST=…)
//   pnpm pm --bridge (or PM_BRIDGE=1)  -> also start the outbound-only Supabase
//     relay bridge for /pm/live (mobile checklist + delivery command surface).
//     Never widens this server's own 127.0.0.1 binding — see scripts/pm/bridge.mjs.
//
// Serves the React application by default; ?ui=classic opens the Preact reference UI.
// Reads PM markdown LIVE from disk
// and exposes a small REST API so checkboxes, moves, renames, reorders, creates and
// deletes write straight back to the .md files. Bound to localhost only.

import { exec } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  watch,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";

import {
  appendUnderHeading,
  computeRenumber,
  fileStub,
  isNumbered,
  nextPrefix,
  resolveInside,
  sanitizeBaseName,
  stripNumPrefix,
  toggleCheckbox,
  moveCheckboxUnderHeading,
} from "./pm/mutations.mjs";
import { archiveItem, monthlySweep, restoreSnapshots } from "./pm/archive.mjs";
import { hostAllowed } from "./pm/net.mjs";
import { collectSources, readCancelledLog, readSourceFile, walk } from "./pm/scan.mjs";
import { buildHtml, buildHtmlLegacy } from "./pm/ui.mjs";
import { createBundleWatcher } from "./pm/build.mjs";
import { createAppWatcher } from "./pm/app-build.mjs";
import { appAsset, buildAppShell } from "./pm/app-shell.mjs";
import { routeHealth } from "./pm/health.mjs";
import { assertExpectedCheckbox, assertRestoreCurrent, guardUndo } from "./pm/write-guards.mjs";
import { createBridge } from "./pm/bridge.mjs";
import {
  createDeliveryContext,
  performPendingWritebacks,
  routeDelivery,
  sessionIdFromWatchPath,
} from "./delivery/server-routes.mjs";
import { createDeliveryV2Context, routeDeliveryV2 } from "./delivery-v2/service.mjs";
import { readDispatchMode } from "./delivery-v2/entry.mjs";
import { issuePairingCode } from "./delivery-v2/local-auth.mjs";

loadDotenv({ path: ".env" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PM_REL = join("ERA Notes", "10 - Project Management");
const PM_DIR = join(ROOT, PM_REL);
const ASSET_DIR = join(__dirname, "pm", "assets");
const ASSET_TYPES = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".js": "text/javascript; charset=utf-8",
};
const deliveryCtx = createDeliveryContext({ ROOT, PM_DIR, PM_REL });
// V2 S1.4. The store opens on first use, so an installation that never switches
// to v2 dispatch never grows one. `deliver` is built from
// `.delivery/v2/execution-policy.json` on first use and is null until the owner
// authorizes one — until then the deliver route refuses, unchanged. The chosen
// executor (Claude or Codex) is read per request from `.delivery/v2/executor.json`
// and is never defaulted here. Origins are accepted per-loopback rather than
// per-port because `listen` retries upward when 4317 is taken, so the port this
// process ends up on is not known here.
const deliveryV2Ctx = createDeliveryV2Context({ ROOT, pmRel: PM_REL });

// ---- CLI args ----
const argv = process.argv.slice(2);
const noOpen = argv.includes("--no-open");
const portArg = argv.find((a) => a.startsWith("--port="));
const uiArg = argv.find((a) => a.startsWith("--ui="));
const UI_MODE = ["old", "classic"].includes(uiArg?.slice(5)) ? uiArg.slice(5) : "app";
const PORT = parseInt(
  portArg ? portArg.slice(7) : process.env.PM_PORT || "4317",
  10,
);
const hostArg = argv.find((a) => a.startsWith("--host="));
const HOST = hostArg
  ? hostArg.slice(7)
  : process.env.PM_HOST || (argv.includes("--lan") ? "0.0.0.0" : "127.0.0.1");
const LAN_MODE = HOST !== "127.0.0.1" && HOST !== "localhost";
const BRIDGE_ENABLED = (process.env.PM_BRIDGE === "1" || argv.includes("--bridge")) && !argv.includes("--no-bridge");
// Phase 4: the bridge relays the same corpus the local app reads (`buildData`,
// a hoisted function below) and Delivery V2 commands through the same context.
const bridge = BRIDGE_ENABLED ? createBridge({ PM_DIR, deliveryCtx, deliveryV2Ctx, buildData: () => buildData() }) : null;

// ---- helpers ----
function pmRel(abs) {
  return relative(PM_DIR, abs).replace(/\\/g, "/");
}
function listDirMd(absDir) {
  return existsSync(absDir)
    ? readdirSync(absDir).filter((n) => /\.md$/i.test(n))
    : [];
}
function uniqueName(absDir, base) {
  if (!existsSync(join(absDir, base))) return base;
  const isMd = /\.md$/i.test(base);
  const stem = isMd ? base.slice(0, -3) : base;
  const ext = isMd ? ".md" : "";
  let i = 2;
  let cand;
  do {
    cand = stem + " (" + i + ")" + ext;
    i++;
  } while (existsSync(join(absDir, cand)));
  return cand;
}
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build the live data payload (md bodies inline; source bodies fetched lazily).
function buildData() {
  const files = walk(PM_DIR);
  const sourceKeys = Object.keys(
    collectSources(files, ROOT, { keysOnly: true }),
  );
  return {
    generatedAt: new Date().toISOString(),
    cancelledLog: readCancelledLog(PM_DIR),
    repoRootFileUrl: pathToFileURL(ROOT).href.replace(/\/$/, "") + "/",
    repoRootPath: ROOT.replace(/\\/g, "/"),
    pmDirRepoRel: PM_REL.replace(/\\/g, "/"),
    sourceKeys,
    files: files.map((f) => ({
      relPath: f.relPath,
      raw: f.raw,
      mtimeMs: f.mtimeMs,
      repoDir: relative(ROOT, f.absDir).replace(/\\/g, "/"),
    })),
  };
}

// ---- mutation operations (throw {status,msg} on failure) ----
function fail(status, msg) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

function opToggle(b) {
  const abs = resolveInside(PM_DIR, b.file);
  if (!existsSync(abs)) throw fail(404, "file not found");
  const raw = readFileSync(abs, "utf8");
  assertExpectedCheckbox(raw, b.cbidx, b.expectLine, { required: true, expectId: b.expectId });
  const r = toggleCheckbox(raw, b.cbidx, b.expectState);
  if (!r.ok) throw fail(409, r.reason);
  writeFileSync(abs, r.raw, "utf8");
  return { ok: true, raw: r.raw, state: r.state, line: r.line, undo: [{ path: b.file, raw }] };
}

function opMove(b) {
  const fromAbs = resolveInside(PM_DIR, b.from);
  const toDirAbs = resolveInside(PM_DIR, b.toDir || "");
  if (!existsSync(fromAbs)) throw fail(404, "source not found");
  if (!existsSync(toDirAbs) || !statSync(toDirAbs).isDirectory())
    throw fail(400, "target is not a folder");
  const st = statSync(fromAbs);
  // guard: don't move a folder into itself / a descendant
  if (st.isDirectory()) {
    const a =
      toDirAbs + (toDirAbs.endsWith("\\") || toDirAbs.endsWith("/") ? "" : "/");
    if (
      a.startsWith(fromAbs + "/") ||
      a.startsWith(fromAbs + "\\") ||
      toDirAbs === fromAbs
    ) {
      throw fail(400, "cannot move a folder into itself");
    }
  }
  if (dirname(fromAbs) === toDirAbs) return { ok: true, unchanged: true }; // already there
  const baseName = basename(fromAbs);
  let destName = baseName;
  if (st.isFile()) {
    if (listDirMd(toDirAbs).some(isNumbered)) {
      const np = nextPrefix(listDirMd(toDirAbs));
      destName =
        np + " - " + stripNumPrefix(baseName.replace(/\.md$/i, "")) + ".md";
    }
  }
  destName = uniqueName(toDirAbs, destName);
  renameSync(fromAbs, join(toDirAbs, destName));
  return { ok: true, path: pmRel(join(toDirAbs, destName)) };
}

function opRename(b) {
  const abs = resolveInside(PM_DIR, b.path);
  if (!existsSync(abs)) throw fail(404, "not found");
  const dir = dirname(abs);
  const oldBase = basename(abs);
  const st = statSync(abs);
  let clean = sanitizeBaseName(b.name);
  if (!clean) throw fail(400, "invalid name");
  let newBase;
  if (st.isFile()) {
    clean = clean.replace(/\.md$/i, "");
    const m = oldBase.match(/^(\d+)\s*-+\s*/);
    newBase =
      m && !isNumbered(clean) ? m[1] + " - " + clean + ".md" : clean + ".md";
  } else {
    newBase = clean;
  }
  if (newBase === oldBase) return { ok: true, path: pmRel(abs) };
  newBase = uniqueName(dir, newBase);
  renameSync(abs, join(dir, newBase));
  return { ok: true, path: pmRel(join(dir, newBase)) };
}

function opReorder(b) {
  const dirAbs = resolveInside(PM_DIR, b.dir || "");
  const order = Array.isArray(b.order) ? b.order : [];
  order.forEach((name) => {
    if (typeof name !== "string" || name.includes("/") || name.includes("\\"))
      throw fail(400, "bad name");
    if (!existsSync(join(dirAbs, name))) throw fail(404, "missing: " + name);
  });
  const ops = computeRenumber(order);
  // two-phase temp rename to avoid collisions within the permutation
  ops.forEach((o, i) =>
    renameSync(join(dirAbs, o.from), join(dirAbs, "__pmtmp_" + i + "__")),
  );
  ops.forEach((o, i) =>
    renameSync(join(dirAbs, "__pmtmp_" + i + "__"), join(dirAbs, o.to)),
  );
  return { ok: true, changed: ops.length };
}

function opCreate(b) {
  const dirAbs = resolveInside(PM_DIR, b.dir || "");
  if (!existsSync(dirAbs)) mkdirSync(dirAbs, { recursive: true });
  let clean = sanitizeBaseName(b.name);
  if (!clean) throw fail(400, "invalid name");
  if (b.kind === "folder") {
    clean = uniqueName(dirAbs, clean);
    mkdirSync(join(dirAbs, clean));
    return { ok: true, path: pmRel(join(dirAbs, clean)), kind: "folder" };
  }
  let stem = clean.replace(/\.md$/i, "");
  let fname;
  if (listDirMd(dirAbs).some(isNumbered) && !isNumbered(stem)) {
    fname = nextPrefix(listDirMd(dirAbs)) + " - " + stem + ".md";
  } else {
    fname = stem + ".md";
  }
  fname = uniqueName(dirAbs, fname);
  writeFileSync(join(dirAbs, fname), fileStub(stripNumPrefix(stem)), "utf8");
  return { ok: true, path: pmRel(join(dirAbs, fname)), kind: "file" };
}

function opDelete(b) {
  const abs = resolveInside(PM_DIR, b.path);
  if (!existsSync(abs)) throw fail(404, "not found");
  if (abs === PM_DIR) throw fail(400, "refusing to delete root");
  const trash = join(PM_DIR, ".trash");
  mkdirSync(trash, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = join(trash, stamp + "__" + basename(abs));
  renameSync(abs, dest);
  return { ok: true, trashed: pmRel(dest) };
}

function opAppend(b) {
  const abs = resolveInside(PM_DIR, b.file);
  if (!existsSync(abs)) throw fail(404, "file not found");
  const line = String(b.line == null ? "" : b.line);
  if (!line.trim()) throw fail(400, "empty line");
  const raw = readFileSync(abs, "utf8");
  const headingRe = b.afterHeading
    ? new RegExp("^#{1,6}\\s+" + escapeRe(b.afterHeading), "i")
    : /\u0000$^/;
  const out = appendUnderHeading(raw, headingRe, line);
  writeFileSync(abs, out, "utf8");
  return { ok: true, raw: out, undo: [{ path: b.file, raw }] };
}

function opMoveTask(b) {
  const lane = String(b.toHeading || "");
  if (!["Now", "Next", "Later"].includes(lane)) throw fail(400, "invalid lane");
  const abs = resolveInside(PM_DIR, b.file);
  if (!existsSync(abs)) throw fail(404, "file not found");
  const raw = readFileSync(abs, "utf8");
  assertExpectedCheckbox(raw, b.cbidx, b.expectLine, { required: true, expectId: b.expectId });
  const result = moveCheckboxUnderHeading(raw, b.cbidx, lane, b.expectLine);
  if (!result.ok) throw fail(409, result.reason);
  writeFileSync(abs, result.raw, "utf8");
  return {
    ok: true,
    raw: result.raw,
    fromHeading: result.fromHeading,
    toHeading: result.toHeading,
    undo: [{ path: b.file, raw }],
  };
}

// Ship / Discard: a checklist item leaves the queue and becomes a dated stamp
// elsewhere (Master Book › Shipped Log, or _Archive/Cancelled Log.md). Both
// return `undo` snapshots the client hands straight back to `restore`.
const ARCHIVE_CTX = { pmDir: PM_DIR, repoRoot: ROOT, pmRelFromRoot: PM_REL.replace(/\\/g, "/") };

function opShip(b) {
  assertExpectedCheckbox(readFileSync(resolveInside(PM_DIR, b.file), "utf8"), b.cbidx, b.expectLine, { required: true, expectId: b.expectId });
  return archiveItem({ ...ARCHIVE_CTX, file: b.file, cbidx: b.cbidx, mode: "ship" });
}
function opDiscard(b) {
  assertExpectedCheckbox(readFileSync(resolveInside(PM_DIR, b.file), "utf8"), b.cbidx, b.expectLine, { required: true, expectId: b.expectId });
  return archiveItem({ ...ARCHIVE_CTX, file: b.file, cbidx: b.cbidx, mode: "discard", reason: b.reason });
}
function opRestore(b) {
  const snapshots = Array.isArray(b.snapshots) ? b.snapshots : [];
  if (!snapshots.length) throw fail(400, "nothing to restore");
  for (const snapshot of snapshots) resolveInside(PM_DIR, snapshot.path); // path-traversal guard
  assertRestoreCurrent(PM_DIR, snapshots);
  return restoreSnapshots(PM_DIR, snapshots);
}

const MUTATIONS = {
  toggle: opToggle,
  ship: opShip,
  discard: opDiscard,
  restore: opRestore,
  move: opMove,
  rename: opRename,
  reorder: opReorder,
  create: opCreate,
  delete: opDelete,
  append: opAppend,
  "move-task": opMoveTask,
};

// ---- SSE live-reload (fs.watch -> debounced broadcast) ----
const sseClients = new Set();
let suppressUntil = 0;
let watchTimer = null;
function broadcast() {
  for (const res of sseClients) {
    try {
      res.write("data: reload\n\n");
    } catch {
      sseClients.delete(res);
    }
  }
  if (bridge) bridge.publishTasks();
}
function broadcastUi() {
  for (const res of sseClients) {
    try {
      res.write("event: ui\ndata: rebuild\n\n");
    } catch {
      sseClients.delete(res);
    }
  }
}
try {
  watch(PM_DIR, { recursive: true }, () => {
    if (Date.now() < suppressUntil) return; // ignore our own writes
    clearTimeout(watchTimer);
    watchTimer = setTimeout(broadcast, 250);
  });
} catch {
  // recursive watch unsupported on this platform — manual refresh still works.
}

let bundleWatcher;
let appWatcher;
try {
  bundleWatcher = await createBundleWatcher(broadcastUi);
  appWatcher = await createAppWatcher(broadcastUi);
} catch (error) {
  throw new Error(`PM UI build failed. Run pnpm install, then retry. ${error.message}`);
}

// ---- Delivery SSE (named `event: delivery` frames on the same connection) ----
// Second debounced watcher over `.delivery/sessions/`, wrapped in the same
// try/catch fallback as the PM watcher (doc 2 §6). Deliberately does NOT set
// `suppressUntil` — the Accept-writeback checkbox tick should trigger the
// normal PM `data: reload` for every open dashboard.
const deliveryDirty = new Set();
let deliveryWatchTimer = null;
function broadcastDelivery() {
  try {
    performPendingWritebacks(deliveryCtx);
  } catch {
    // best-effort; a failed writeback attempt is retried on the next tick
  }
  const sessionIds = Array.from(deliveryDirty);
  deliveryDirty.clear();
  for (const sessionId of sessionIds) {
    const frame = `event: delivery\ndata: ${JSON.stringify({ sessionId })}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(frame);
      } catch {
        sseClients.delete(res);
      }
    }
    if (bridge) bridge.publishSession(sessionId);
  }
  if (bridge && sessionIds.length) bridge.publishFleet();
}
try {
  mkdirSync(deliveryCtx.SESSIONS_DIR, { recursive: true });
  performPendingWritebacks(deliveryCtx); // catch up on any pending writeback from before a restart
  watch(deliveryCtx.SESSIONS_DIR, { recursive: true }, (eventType, filename) => {
    const sessionId = sessionIdFromWatchPath(filename);
    if (sessionId) deliveryDirty.add(sessionId);
    clearTimeout(deliveryWatchTimer);
    deliveryWatchTimer = setTimeout(broadcastDelivery, 250);
  });
} catch {
  // recursive watch unsupported on this platform — delivery UI falls back to manual refresh.
}

// ---- HTTP plumbing ----
function sendJson(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 5_000_000) {
        reject(fail(413, "payload too large"));
        req.destroy();
        return;
      }
      data += c;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    // DNS-rebinding guard: localhost always; private LAN hosts only with --lan.
    if (!hostAllowed(req.headers.host, { lan: LAN_MODE })) {
      return sendJson(res, 403, { error: "forbidden host" });
    }
    const u = new URL(req.url, "http://127.0.0.1");
    const path = u.pathname;

    if (req.method === "GET" && path === "/") {
      const requested = u.searchParams.get("ui");
      const requestMode = ["old", "classic"].includes(requested) ? requested : UI_MODE;
      const html = requestMode === "old"
        ? buildHtmlLegacy({ mode: "server", dataJson: "null" })
        : requestMode === "classic" ? buildHtml({ mode: "server", dataJson: "null", bundle: bundleWatcher.current() }) : buildAppShell();
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      return res.end(html);
    }

    if (req.method === "GET" && path.startsWith("/app/assets/")) {
      const asset = appAsset(path, appWatcher.current());
      if (!asset) return sendJson(res, 404, { error: "not found" });
      res.writeHead(200, { "Content-Type": asset.type, "Cache-Control": "no-store" });
      return res.end(asset.body);
    }
    if (routeHealth(req, res)) return;

    if (
      req.method === "GET" &&
      (path.startsWith("/assets/") || path === "/sw.js" || path === "/manifest.webmanifest")
    ) {
      const rel =
        path === "/sw.js" ? "sw.js"
        : path === "/manifest.webmanifest" ? "pm.webmanifest"
        : path.slice("/assets/".length);
      let abs;
      try {
        abs = resolveInside(ASSET_DIR, rel);
      } catch {
        return sendJson(res, 400, { error: "bad path" });
      }
      if (!existsSync(abs) || !statSync(abs).isFile())
        return sendJson(res, 404, { error: "not found" });
      res.writeHead(200, {
        "Content-Type": ASSET_TYPES[extname(abs).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      return res.end(readFileSync(abs));
    }

    if (req.method === "GET" && path === "/api/data") {
      return sendJson(res, 200, buildData());
    }

    if (req.method === "GET" && path === "/api/source") {
      const rel = u.searchParams.get("path") || "";
      const src = readSourceFile(ROOT, rel);
      if (!src) return sendJson(res, 404, { error: "not embedded" });
      return sendJson(res, 200, src);
    }

    if (req.method === "GET" && path === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("retry: 2000\n\n");
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }

    if (path.startsWith("/api/delivery/")) {
      let body = {};
      if (req.method === "POST") {
        const raw = await readBody(req);
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return sendJson(res, 400, { error: "invalid json" });
        }
      }
      // V2 S1.4. Checked before the V1 router so the two surfaces cannot collide
      // on a path, and given the raw headers — the Origin/Sec-Fetch-Site checks
      // are the reason loopback binding alone is not the authentication story.
      if (path.startsWith("/api/delivery/v2/")) {
        const v2 = await routeDeliveryV2(
          { method: req.method, path, query: u.searchParams, body, headers: req.headers },
          deliveryV2Ctx,
        );
        if (v2) return sendJson(res, v2.status, v2.json, v2.headers || {});
        return sendJson(res, 404, { error: "unknown delivery route" });
      }
      const result = await routeDelivery(
        { method: req.method, path, query: u.searchParams, body },
        deliveryCtx,
      );
      if (result) return sendJson(res, result.status, result.json);
      return sendJson(res, 404, { error: "unknown delivery route" });
    }

    if (req.method === "POST" && path.startsWith("/api/")) {
      const op = path.slice(5);
      const handler = MUTATIONS[op];
      if (!handler) return sendJson(res, 404, { error: "unknown op" });
      const raw = await readBody(req);
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return sendJson(res, 400, { error: "invalid json" });
      }
      suppressUntil = Date.now() + 700; // mute our own fs.watch echo
      const result = guardUndo(PM_DIR, handler(body));
      return sendJson(res, 200, result);
    }

    if (path === "/favicon.ico") {
      const icon = join(ASSET_DIR, "pm-192.png");
      if (existsSync(icon)) {
        res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
        return res.end(readFileSync(icon));
      }
      res.writeHead(204);
      return res.end();
    }

    sendJson(res, 404, { error: "not found" });
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    sendJson(res, status, { error: String((err && err.message) || err) });
  }
});

function openBrowser(url) {
  const cmd =
    process.platform === "win32"
      ? 'start "" "' + url + '"'
      : process.platform === "darwin"
        ? 'open "' + url + '"'
        : 'xdg-open "' + url + '"';
  exec(cmd, () => {});
}

function listen(port, attemptsLeft) {
  server.once("error", (e) => {
    if (e.code === "EADDRINUSE" && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
    } else {
      console.error("Server error:", e.message);
      process.exit(1);
    }
  });
  server.listen(port, HOST, () => {
    const url = "http://127.0.0.1:" + port + "/";
    console.log("PM Command Center  →  " + url);
    if (LAN_MODE) {
      for (const addrs of Object.values(networkInterfaces())) {
        for (const a of addrs || []) {
          if (a.family === "IPv4" && !a.internal)
            console.log("      on your LAN  →  http://" + a.address + ":" + port + "/");
        }
      }
      console.log(
        "  ⚠ LAN mode: the write API and delivery controls are reachable by any device on this network. Use only on trusted Wi-Fi.",
      );
    }
    console.log("Watching: " + PM_DIR);
    // V2 commands need a paired browser. The code is printed only here, in the
    // owner's terminal, and only on an installation that switched to v2.
    if (readDispatchMode({ root: ROOT }).mode === "v2") {
      try {
        const pairing = issuePairingCode({ root: ROOT });
        console.log("Delivery pairing code: " + pairing.code + " (10 minutes; `pnpm pm:pair` for another)");
      } catch (error) {
        console.log("[delivery-v2] pairing code unavailable: " + String((error && error.message) || error));
      }
    }
    console.log("Press Ctrl+C to stop.");
    if (bridge) bridge.start();
    else if (process.env.PM_BRIDGE === "1") console.log("[pm-bridge] disabled by --no-bridge");
    if (!noOpen) openBrowser(url);
  });
}

// Monthly checklist sweep (_Conventions §2): on the first boot of each calendar
// month, every ticked `[x]` item is moved into its campaign's Shipped Log with
// its git-derived completion date and deleted from the checklist. Guarded by a
// stamp in `.pm/archive-stamp.json`, and reversible with `pnpm pm:archive --undo`.
try {
  const sweep = monthlySweep(ARCHIVE_CTX);
  if (sweep?.swept.length) {
    console.log(`Monthly sweep: archived ${sweep.swept.length} shipped item(s) into their Master Books.`);
    for (const entry of sweep.swept) console.log("  " + entry.campaign + "  " + entry.stamp);
    console.log("  Undo with: pnpm pm:archive --undo");
  }
  for (const error of sweep?.errors || []) console.error(`  ! sweep skipped ${error.campaign}: ${error.error}`);
} catch (error) {
  console.error("Monthly sweep failed (checklists untouched):", error.message);
}

listen(PORT, 10);
