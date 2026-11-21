// Child processes for code that runs inside the PM server. spawnSync there froze
// the server's only thread for the whole call — every browser health probe timed
// out and the Command Center reported Offline mid-run (observed 2026-09-26).
import { spawn } from "node:child_process";

/**
 * spawnSync's result shape without blocking the event loop. Timeout and output
 * overflow kill the process tree and report `error.code` ETIMEDOUT / ENOBUFS, as
 * spawnSync does.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd?:string, env?:NodeJS.ProcessEnv, input?:string|Buffer, timeout?:number, maxBuffer?:number, spawnFn?:typeof spawn, onStderrLine?:(line:string)=>void}} [options]
 * @returns {Promise<{status:(number|null), signal:(string|null), stdout:string, stderr:string, error:((Error & {code?:string})|null)}>}
 */
export function runProcess(command, args, { cwd, env, input, timeout = 0, maxBuffer = 64 * 1024 * 1024, spawnFn = spawn, onStderrLine } = {}) {
  return new Promise((resolve) => {
    /** @type {import("node:child_process").ChildProcess} */
    let child;
    try {
      child = spawnFn(command, args, { cwd, env, windowsHide: true, detached: process.platform !== "win32" });
    } catch (error) {
      resolve({ status: null, signal: null, stdout: "", stderr: "", error: /** @type {Error} */ (error) });
      return;
    }
    let stdout = "";
    let stderr = "";
    let size = 0;
    /** @type {(Error & {code?:string})|null} */
    let error = null;
    let settled = false;
    let pendingStderr = "";
    /** @type {Promise<void>|null} */
    let killing = null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    let timer = null;
    const finish = async (/** @type {number|null} */ status, /** @type {string|null} */ signal) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (killing) await killing;
      if (pendingStderr) onStderrLine?.(pendingStderr.replace(/\r$/u, ""));
      resolve({ status: error ? null : status, signal: signal ?? null, stdout, stderr, error });
    };
    const abort = (/** @type {string} */ code) => {
      if (error) return;
      error = Object.assign(new Error(command + " " + code), { code });
      if (!child.pid) { child.kill(); return; }
      if (process.platform === "win32") {
        killing = new Promise(done => {
          const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
          killer.once("error", () => { child.kill(); done(); });
          killer.once("close", code => { if (code !== 0) child.kill(); done(); });
        });
      } else {
        try { process.kill(-child.pid, "SIGKILL"); }
        catch { child.kill("SIGKILL"); } // already exited, or an injected child
      }
    };
    if (timeout > 0) timer = setTimeout(() => abort("ETIMEDOUT"), timeout);
    const collect = (/** @type {(chunk:string)=>void} */ append) => (/** @type {string} */ chunk) => {
      size += chunk.length;
      if (size > maxBuffer) abort("ENOBUFS");
      else append(chunk);
    };
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", collect((chunk) => { stdout += chunk; }));
    child.stderr?.on("data", collect((chunk) => {
      stderr += chunk;
      if (!onStderrLine) return;
      pendingStderr += chunk;
      let end;
      while ((end = pendingStderr.indexOf("\n")) >= 0) {
        const line = pendingStderr.slice(0, end).replace(/\r$/u, "");
        pendingStderr = pendingStderr.slice(end + 1);
        onStderrLine(line);
      }
    }));
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
    child.on("error", (spawnError) => {
      if (!error) error = spawnError;
      // A process that never started emits no close.
      if (child.pid === undefined) finish(null, null);
    });
    child.on("close", (code, signal) => finish(code, signal));
  });
}
