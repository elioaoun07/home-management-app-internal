// The sign-in shortcut and desktop panel both use this controller. The host
// keeps ownership across a requested restart, even if the panel is closed.
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const script = fileURLToPath(import.meta.url);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const dir = join(root, ".pm", "desktop");
const port = Number(process.env.PM_PORT || 4317);
const url = "http://127.0.0.1:" + port + "/";
const lockKey = createHash("sha256").update(process.platform === "win32" ? root.toLowerCase() : root).digest("hex").slice(0, 24);
const nonce = () => randomUUID().replaceAll("-", "");
const valid = value => typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
const reply = (ok, state, message) => ({ ok, state, message });
const file = name => join(dir, name + ".json");
const logPath = join(dir, "desktop.log");
const manual = "PM is running in a terminal. When your deliveries are idle, press Ctrl+C in that terminal once, then choose Open here.";

function read(filePath) {
  try { return JSON.parse(readFileSync(filePath, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

function save(name, value) {
  const temp = file(name + "-" + nonce() + ".tmp");
  writeFileSync(temp, JSON.stringify(value), { mode: 0o600 });
  try { renameSync(temp, file(name)); } finally { rmSync(temp, { force: true }); }
}

function log(message) {
  const line = String(message).replace(/\x1b\[[0-9;]*m/g, "").replace(/(pairing code:\s*).*/ig, "$1[hidden]");
  try {
    if (existsSync(logPath) && statSync(logPath).size > 2_000_000) renameSync(logPath, logPath + ".previous");
    appendFileSync(logPath, new Date().toISOString() + "  " + line + "\n", { mode: 0o600 });
  } catch { /* An unavailable log must not interrupt an active delivery. */ }
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}

// The OS releases a named pipe when its holder exits, including a crashed
// launcher. No process is ever terminated by a recorded PID or port.
async function withLock(name, operation) {
  const server = createServer(socket => socket.destroy());
  const address = process.platform === "win32" ? "\\\\.\\pipe\\era-pm-" + lockKey + "-" + name : join(tmpdir(), "era-pm-" + lockKey + "-" + name + ".sock");
  try {
    await new Promise((resolve, reject) => server.once("error", reject).listen(address, resolve));
  } catch (error) {
    if (error.code === "EADDRINUSE") return reply(false, "busy", "Another PM operation is in progress. Try again when it finishes.");
    throw error;
  }
  try { return await operation(); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function occupant() {
  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(1800) });
    if (response.ok && (await response.text()).includes('href="/assets/pm-icon.svg"')) return "pm";
    return "occupied";
  } catch (error) {
    return error.cause?.code === "ECONNREFUSED" ? "free" : "occupied";
  }
}

async function status() {
  const record = read(file("instance"));
  const bridge = read(join(root, ".delivery", "pm-relay", "bridge.lock"));
  const site = await occupant();
  if (valid(record?.instance) && alive(record.hostPid) && !record.failed) {
    const ready = read(file("ready-" + record.instance));
    if (ready?.instance === record.instance && ready.port === port && alive(ready.pid) && site === "pm") {
      const relay = ready.pid === bridge?.pid ? "Phone bridge is running." : "Check the phone bridge in View log.";
      return { ...reply(true, "running", "Command Center is running. " + relay), url, instance: record.instance };
    }
    return reply(false, "starting", "Command Center is starting. Please wait.");
  }
  if (site === "pm") return { ...reply(true, "manual", manual), url };
  if (site !== "free") return reply(false, "occupied", "Port " + port + " is in use or unresponsive. Check the current listener before starting PM.");
  if (alive(bridge?.pid)) return reply(false, "other-bridge", "A bridge for this repo is already running on another port. Check its terminal before starting PM here.");
  if (record?.failed) return reply(false, "failed", record.failed);
  return reply(true, "stopped", "Command Center is stopped.");
}

function pnpm(args, env = process.env) {
  // All command tokens are internal constants, apart from the validated port.
  const windows = process.platform === "win32";
  const command = windows ? (process.env.ComSpec || "cmd.exe") : "pnpm";
  const params = windows ? ["/d", "/c", "pnpm.cmd", ...args] : args;
  return new Promise((resolve, reject) => {
    const proc = spawn(command, params, { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    for (const stream of [proc.stdout, proc.stderr]) createInterface({ input: stream }).on("line", log);
    proc.once("error", reject);
    proc.once("close", resolve);
  });
}

async function host(first) {
  let instance = first;
  return withLock("host", async () => {
    while (true) {
      save("instance", { instance, hostPid: process.pid });
      log("Starting PM in " + root);
      let code;
      try {
        code = await pnpm(["pm", "--bridge", "--no-open", "--host=127.0.0.1", "--port=" + port], { ...process.env, PM_DESKTOP_INSTANCE: instance });
      } catch (error) { log(error.message); }
      const ticket = read(file("ticket-" + instance));
      const approved = valid(ticket?.id) && read(file("result-" + ticket.id))?.status === "restarting";
      for (const prefix of ["ready-", "ticket-", "restart-"]) rmSync(file(prefix + instance), { force: true });
      if (code === 0 && approved) {
        instance = nonce();
        continue;
      }
      const message = "PM exited" + (code == null ? "" : " with code " + code) + ". Open View log for details, then choose Open to start again.";
      save("instance", { instance, hostPid: null, failed: message });
      log(message);
      return;
    }
  });
}

async function waitUntil(probe, timeoutMs) {
  const until = Date.now() + timeoutMs;
  do {
    const value = await probe();
    if (value) return value;
    await delay(250);
  } while (Date.now() < until);
  return null;
}

async function waitForServer(oldInstance) {
  const result = await waitUntil(async () => {
    const next = await status();
    if (next.state === "running" && next.instance !== oldInstance) return next;
    return next.state === "failed" || next.state === "other-bridge" ? next : null;
  }, 60_000);
  return result || reply(false, "waiting", "PM has not confirmed startup yet. Reopen the panel for status or choose View log.");
}

async function startHost() {
  const first = nonce();
  // Replace a previous failure so the new attempt can report its own outcome.
  save("instance", { instance: first, hostPid: null });
  const proc = spawn(process.execPath, [script, "host", first], { cwd: root, detached: true, windowsHide: true, stdio: "ignore" });
  await new Promise((resolve, reject) => proc.once("spawn", resolve).once("error", reject));
  proc.unref();
  return waitForServer(null);
}

async function restart(current) {
  const ticketName = "ticket-" + current.instance;
  const pending = read(file(ticketName));
  const id = valid(pending?.id) ? pending.id : nonce();
  if (!valid(pending?.id)) {
    save(ticketName, { id });
    save("restart-" + current.instance, { id });
  } else if (!existsSync(file("result-" + id)) && !existsSync(file("restart-" + current.instance))) {
    // An interrupted client may have recorded its ticket before posting it.
    save("restart-" + current.instance, { id });
  }
  const result = await waitUntil(() => read(file("result-" + id)), 30_000);
  if (!result) return reply(false, "waiting", "The server has not answered the restart request. Check its status before trying again.");
  if (result.status !== "restarting") {
    rmSync(file(ticketName), { force: true });
    rmSync(file("result-" + id), { force: true });
    return reply(false, "refused", result.message || "The server could not confirm that delivery is idle.");
  }
  const next = await waitForServer(current.instance);
  // The host needs the approval receipt until the old process has exited.
  if (next.state === "running") rmSync(file("result-" + id), { force: true });
  return next;
}

async function action(verb) {
  let current = await status();
  if (verb === "open" && current.url) return current;
  if (verb === "start" && ["running", "manual"].includes(current.state)) return current;
  if (current.state === "starting") current = await waitForServer(null);
  if (!["running", "failed", "stopped"].includes(current.state)) return { ...current, ok: false };
  const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const pnpmFound = (process.env.PATH || "").split(delimiter).some(entry => entry && existsSync(join(entry.replace(/^"|"$/g, ""), executable)));
  if (!pnpmFound) return reply(false, "missing-pnpm", "Windows could not find pnpm. Add it to your user PATH, then reopen the panel.");
  if (verb === "rebuild") {
    log("Checking the local PM build.");
    if (await pnpm(["pm:build-app"]) !== 0) return reply(false, "build-failed", "The PM build failed. See View log for the compiler output. The current server was left in place.");
    current = await status();
    if (!["running", "failed", "stopped"].includes(current.state)) return { ...current, ok: false };
  }
  if (current.state !== "running") return startHost();
  return verb === "restart" || verb === "rebuild" ? restart(current) : current;
}

async function main() {
  const [verb, first] = process.argv.slice(2);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PM_PORT must be a valid TCP port.");
  mkdirSync(dir, { recursive: true });
  if (verb === "host" && valid(first)) return host(first);
  if (verb === "status") return status();
  if (!["open", "start", "restart", "rebuild"].includes(verb)) throw new Error("Unknown desktop action.");
  return withLock("command", () => action(verb));
}

try {
  const result = await main();
  if (result) {
    const { ok, state, message, url } = result;
    process.stdout.write(JSON.stringify({ ok, state, message, url }) + "\n");
    if (!result.ok) process.exitCode = 1;
  }
} catch (error) {
  try { log(error.message); } catch { /* Startup may lack write access. */ }
  process.stdout.write(JSON.stringify(reply(false, "error", String(error.message))) + "\n");
  process.exitCode = 1;
}
