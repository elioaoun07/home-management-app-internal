// Child processes for code that runs inside the PM server. spawnSync there froze
// the server's only thread for the whole call — every browser health probe timed
// out and the Command Center reported Offline mid-run (observed 2026-09-26).
import { spawn } from "node:child_process";

/**
 * spawnSync's result shape without blocking the event loop. Timeout and output
 * overflow kill the process and report `error.code` ETIMEDOUT / ENOBUFS, as
 * spawnSync does.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd?:string, env?:NodeJS.ProcessEnv, input?:string, timeout?:number, maxBuffer?:number, spawnFn?:typeof spawn}} [options]
 * @returns {Promise<{status:(number|null), signal:(string|null), stdout:string, stderr:string, error:((Error & {code?:string})|null)}>}
 */
export function runProcess(command, args, { cwd, env, input, timeout = 0, maxBuffer = 64 * 1024 * 1024, spawnFn = spawn } = {}) {
  return new Promise((resolve) => {
    /** @type {import("node:child_process").ChildProcess} */
    let child;
    try {
      child = spawnFn(command, args, { cwd, env, windowsHide: true });
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
    /** @type {ReturnType<typeof setTimeout>|null} */
    let timer = null;
    const finish = (/** @type {number|null} */ status, /** @type {string|null} */ signal) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ status: error ? null : status, signal: signal ?? null, stdout, stderr, error });
    };
    const abort = (/** @type {string} */ code) => {
      if (error) return;
      error = Object.assign(new Error(command + " " + code), { code });
      child.kill();
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
    child.stderr?.on("data", collect((chunk) => { stderr += chunk; }));
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
