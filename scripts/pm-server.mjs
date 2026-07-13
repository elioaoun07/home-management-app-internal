// scripts/pm-server.mjs
// Live, interactive PM Command Center server (zero dependencies — Node built-ins).
//   pnpm pm            -> start + open browser at http://127.0.0.1:4317
//   pnpm pm --no-open  -> start without opening a browser
//   PM_PORT=5000 pnpm pm  (or --port=5000)
//
// Serves the same UI as the static build, but reads the PM markdown LIVE from disk
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
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
} from "./pm/mutations.mjs";
import { collectSources, readSourceFile, walk } from "./pm/scan.mjs";
import { buildHtml, buildHtmlLegacy } from "./pm/ui.mjs";
import { createBundleWatcher } from "./pm/build.mjs";
import {
  createDeliveryContext,
  performPendingWritebacks,
  routeDelivery,
  sessionIdFromWatchPath,
} from "./delivery/server-routes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PM_REL = join("ERA Notes", "10 - Project Management");
const PM_DIR = join(ROOT, PM_REL);
const deliveryCtx = createDeliveryContext({ ROOT, PM_DIR, PM_REL });

// ---- CLI args ----
const argv = process.argv.slice(2);
const noOpen = argv.includes("--no-open");
const portArg = argv.find((a) => a.startsWith("--port="));
const uiArg = argv.find((a) => a.startsWith("--ui="));
const UI_MODE = uiArg?.slice(5) === "old" ? "old" : "new";
const PORT = parseInt(
  portArg ? portArg.slice(7) : process.env.PM_PORT || "4317",
  10,
);

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
  const r = toggleCheckbox(raw, b.cbidx, b.expectState);
  if (!r.ok) throw fail(409, r.reason);
  writeFileSync(abs, r.raw, "utf8");
  return { ok: true, raw: r.raw, state: r.state, line: r.line };
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
  return { ok: true, raw: out };
}

const MUTATIONS = {
  toggle: opToggle,
  move: opMove,
  rename: opRename,
  reorder: opReorder,
  create: opCreate,
  delete: opDelete,
  append: opAppend,
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
try {
  bundleWatcher = await createBundleWatcher(broadcastUi);
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
  }
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
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
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
    // DNS-rebinding guard: only accept localhost Host headers.
    const host = (req.headers.host || "").split(":")[0];
    if (host && !["127.0.0.1", "localhost", "[::1]", "::1"].includes(host)) {
      return sendJson(res, 403, { error: "forbidden host" });
    }
    const u = new URL(req.url, "http://127.0.0.1");
    const path = u.pathname;

    if (req.method === "GET" && path === "/") {
      const requestMode = u.searchParams.get("ui") === "old" ? "old" : UI_MODE;
      const html = requestMode === "old"
        ? buildHtmlLegacy({ mode: "server", dataJson: "null" })
        : buildHtml({ mode: "server", dataJson: "null", bundle: bundleWatcher.current() });
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      return res.end(html);
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
      const result = handler(body);
      return sendJson(res, 200, result);
    }

    if (path === "/favicon.ico") {
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
  server.listen(port, "127.0.0.1", () => {
    const url = "http://127.0.0.1:" + port + "/";
    console.log("PM Command Center  →  " + url);
    console.log("Watching: " + PM_DIR);
    console.log("Press Ctrl+C to stop.");
    if (!noOpen) openBrowser(url);
  });
}

listen(PORT, 10);
