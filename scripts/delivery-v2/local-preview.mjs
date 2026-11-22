// DLV-166. Run a Local candidate's dev server for owner UAT.
// The worktree never holds `.env` (assertNoLocalSecrets refuses one): the main
// checkout's values reach only the child's environment, never a file.
import { spawn as nodeSpawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import dotenv from "dotenv";
import { pnpmCommand } from "./local-process.mjs";

/** `next dev` precedence: the first file that sets a key wins. */
export const ENV_FILES = [".env.development.local", ".env.local", ".env.development", ".env"];
const TAIL = 20_000;
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "gu");
const LIVE = ["starting", "ready"];

/** The checkout's env values as `next dev` would load them there. Pure: process.env is untouched. */
export function checkoutEnv(root) {
  const values = {}, loaded = [];
  for (const name of ENV_FILES) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    loaded.push(name);
    for (const [key, value] of Object.entries(dotenv.parse(readFileSync(path)))) if (!(key in values)) values[key] = value;
  }
  return { values, loaded };
}

/** The supervisor's own environment, minus what would mislead a dev server. */
function baseEnv(source = process.env) {
  const env = {};
  for (const [key, value] of Object.entries(source)) if (!/^(?:NODE_ENV|PORT|npm_.*)$/iu.test(key)) env[key] = value;
  return env;
}

/** Free for a dev server: neither the dual-stack nor the IPv4 loopback bind is taken. */
export async function portFree(port) {
  for (const host of [undefined, "127.0.0.1"]) {
    const free = await new Promise(resolve => {
      const server = createServer();
      server.once("error", error => resolve(!["EADDRINUSE", "EACCES"].includes(error.code)));
      server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)));
    });
    if (!free) return false;
  }
  return true;
}

/** 3000 keeps the usual sign-in redirect; otherwise the first free port from 3100. */
export async function choosePort(free = portFree) {
  if (await free(3000)) return 3000;
  for (let port = 3100; port < 3200; port++) if (await free(port)) return port;
  throw new Error("preview-no-free-port");
}

export function killTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  else { try { process.kill(-pid, "SIGTERM"); } catch { /* already exited */ } }
}

/** @typedef {{state:"starting"|"ready"|"stopped"|"failed", url:string|null, port:number|null, started_at:string, exit:number|null, tail:string}} PreviewView */
/** @param {{root:string, spawn?:typeof nodeSpawn, choose?:()=>Promise<number>, command?:()=>string[],
 *   kill?:(pid:number|undefined)=>void, now?:()=>string, env?:NodeJS.ProcessEnv}} options */
export function createPreviews({ root, spawn = nodeSpawn, choose = () => choosePort(), command = () => pnpmCommand(),
  kill = killTree, now = () => new Date().toISOString(), env = process.env }) {
  const runs = new Map();
  let hooked = false;
  /** @returns {PreviewView|null} */
  const view = id => {
    const p = runs.get(id);
    return p ? { state: p.state, url: p.url, port: p.port, started_at: p.started_at, exit: p.exit, tail: p.tail.slice(-4000) } : null;
  };
  function stop(id) {
    const p = runs.get(id);
    if (p && LIVE.includes(p.state)) { p.stopping = true; p.state = "stopped"; kill(p.child?.pid); }
    return view(id);
  }
  const stopAll = () => { for (const id of runs.keys()) stop(id); };

  /** One preview at a time; a repeat start for the same run returns it. */
  async function start(id, { workspace }) {
    if (LIVE.includes(runs.get(id)?.state)) return view(id);
    for (const other of runs.keys()) if (other !== id) stop(other);
    const { values, loaded } = checkoutEnv(root);
    if (!loaded.length) throw new Error("preview-env-missing; the main checkout has no .env");
    // Claimed before any await, so a double click cannot start two servers.
    const p = { state: "starting", url: null, port: null, started_at: now(), exit: null, tail: "", child: null, stopping: false };
    runs.set(id, p);
    try {
      const port = await choose();
      if (p.stopping) return view(id);
      const [bin, launcher] = command();
      p.port = port; p.url = `http://localhost:${port}`;
      const child = spawn(bin, [launcher, "dev", "--port", String(port)], { cwd: workspace, env: { ...baseEnv(env), ...values },
        windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
      p.child = child;
      const take = chunk => {
        p.tail = (p.tail + String(chunk).replace(ANSI, "")).slice(-TAIL);
        if (p.state === "starting" && /\bReady in\b/u.test(p.tail)) p.state = "ready";
      };
      child.stdout?.on("data", take);
      child.stderr?.on("data", take);
      child.on("error", error => { take(`\n${error.message}\n`); if (!p.stopping) p.state = "failed"; });
      child.on("close", code => { p.exit = code; if (!p.stopping) p.state = "failed"; });
      if (!hooked) { hooked = true; process.once("exit", stopAll); }
      return view(id);
    } catch (error) {
      p.state = "failed"; p.tail = String(error.message);
      throw error;
    }
  }
  return { start, stop, stopAll, view };
}
