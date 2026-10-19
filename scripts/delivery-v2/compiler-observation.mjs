// Passive compiler-input observation. Keep filesystem traversal off the server's
// event loop so health probes and paired clients remain responsive. Concurrent
// readers share only the in-flight snapshot; the next inspection reads again.
import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { canonicalJson } from "./contracts.mjs";

/** @typedef {{path:string, sha256:string}} CompilerInput */
/** @type {Map<string, Promise<CompilerInput[]>>} */
const pending = new Map();
const kind = "delivery-compiler-observation@1";

/** @returns {Promise<CompilerInput[]>} */
export function compilerObservation(root, configured) {
  const key = canonicalJson({ root: resolve(root), configured });
  if (pending.has(key)) return pending.get(key);
  /** @type {Promise<CompilerInput[]>} */
  const work = new Promise((done, fail) => {
    const worker = new Worker(new URL("./compiler-observation-worker.mjs", import.meta.url), {
      workerData: { kind, root: resolve(root), configured },
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
    });
    let result, failure;
    const timer = setTimeout(() => {
      failure = new Error("compiler input observation timed out");
      void worker.terminate();
    }, 15_000);
    worker.on("message", message => { result = message; });
    worker.on("error", error => { failure = error; });
    worker.on("exit", code => {
      clearTimeout(timer);
      pending.delete(key);
      if (failure || code !== 0 || !result?.ok) fail(failure || new Error(result?.error || "compiler input observation failed"));
      else done(result.inputs);
    });
  });
  pending.set(key, work);
  return work;
}
