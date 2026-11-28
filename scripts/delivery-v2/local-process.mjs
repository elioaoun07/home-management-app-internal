import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { runProcess } from "./process.mjs";

/** Resolve the JS launcher so Windows never needs a shell or interpolated argv. */
export function pnpmCommand(env = process.env) {
  const candidates = [env.npm_execpath, env.APPDATA && join(env.APPDATA, "npm/node_modules/pnpm/bin/pnpm.cjs"),
    join(dirname(process.execPath), "node_modules/corepack/dist/pnpm.js")].filter(Boolean);
  for (const dir of (env.PATH || env.Path || "").split(delimiter)) candidates.push(join(dir, "node_modules/pnpm/bin/pnpm.cjs"));
  const launcher = candidates.find(path => /(?:pnpm\.c?js|pnpm\.mjs)$/u.test(path) && existsSync(path));
  if (!launcher) throw new Error("pnpm JS launcher unavailable; run Command Center with pnpm pm");
  return [process.execPath, launcher];
}

/** @typedef {{name:string, started_at:string, finished_at:string, exit:number|null, stdout:string, stderr:string, error:string|null, reused?:string}} HostCheck */
/** `reuse` holds passed results the Seal commit hook produced on this same commit (DLV-177);
 * those commands are not run a second time.
 * @param {{workspace:string, env:NodeJS.ProcessEnv, run?:typeof runProcess, onCheck?:(check:HostCheck)=>void, onStart?:(name:string)=>void,
 *   reuse?:Record<string, HostCheck>}} options */
export async function hostChecks({ workspace, env, run = runProcess, onCheck = () => {}, onStart = () => {}, reuse = {} }) {
  const [bin, launcher] = pnpmCommand();
  const checks = [];
  for (const name of ["typecheck", "lint", "test", "pm:lint"]) {
    const started_at = new Date().toISOString();
    onStart(name);
    if (reuse[name]?.exit === 0) { checks.push(reuse[name]); onCheck(reuse[name]); continue; }
    const output = await run(bin, [launcher, name], { cwd: workspace, env, timeout: 15 * 60_000 });
    const check = { name, started_at, finished_at: new Date().toISOString(), exit: output.status,
      stdout: output.stdout, stderr: output.stderr, error: output.error?.message || null };
    checks.push(check);
    onCheck(check);
  }
  return checks;
}

/** A separate scrubbed process: no SDK can inherit the PM server's credentials.
 * stdin stays open after the request so owner messages can follow; the worker
 * reports questions (the session then parks) and delivered messages (DLV-164/165).
 * `onChannel` receives `send(message)` once the worker is spawned.
 * @param {{request:any, env:any, signal:AbortSignal, onActivity?:(value:any)=>void,
 *   onQuestion?:(value:any)=>void, onDelivered?:(ids:string[])=>void,
 *   onChannel?:(send:(message:any)=>boolean)=>void, worker?:string}} options */
export function nativeLocalSession({ request, env, signal, onActivity = () => {},
  onQuestion = () => {}, onDelivered = () => {}, onChannel = () => {},
  worker = fileURLToPath(new URL("./local-worker.mjs", import.meta.url)) }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [worker], {
      cwd: request.workspace.root, env, windowsHide: true, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"],
    });
    let pending = "", stderr = "", result = null;
    const stop = () => {
      if (!child.pid) return;
      if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
      else { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already exited */ } }
    };
    signal?.addEventListener("abort", stop, { once: true });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      pending += chunk;
      if (pending.length > 2_000_000) { stop(); return; }
      let end;
      while ((end = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, end); pending = pending.slice(end + 1);
        try {
          const event = JSON.parse(line);
          if (event.type === "activity") onActivity(event.value);
          if (event.type === "question") onQuestion(event.value);
          if (event.type === "delivered" && Array.isArray(event.ids)) onDelivered(event.ids);
          if (event.type === "result") { result = event.value; child.stdin.end(); }
        } catch { /* SDK diagnostics are not activity or completion */ }
      }
    });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-20_000); });
    child.on("error", reject);
    child.on("close", code => {
      signal?.removeEventListener("abort", stop);
      if (result) resolve(result);
      else reject(new Error(signal?.aborted ? "cancelled" : `native session exited ${code}: ${stderr.slice(-1000)}`));
    });
    child.stdin.on("error", () => {});
    child.stdin.write(JSON.stringify(request) + "\n");
    onChannel(message => {
      if (result || !child.stdin.writable) return false;
      child.stdin.write(JSON.stringify(message) + "\n");
      return true;
    });
    if (signal?.aborted) stop();
  });
}

export function installedDependencies(root) {
  try {
    const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const installed = readFileSync(join(root, "node_modules/.pnpm/lock.yaml"), "utf8");
    return lock.replace(/\r\n/gu, "\n") === installed.replace(/\r\n/gu, "\n");
  } catch { return false; }
}
