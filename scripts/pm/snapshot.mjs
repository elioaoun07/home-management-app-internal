import { relative } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { collectSources, readCancelledLog, walk, walkDirectories } from "./scan.mjs";
import { planningSnapshot } from "./planning.mjs";

export function readPlanningCorpus(pmDir) {
  return { files: walk(pmDir), cancelledLog: readCancelledLog(pmDir) };
}

export function projectSnapshot({ root, pmDir, pmRel }) {
  const { files, cancelledLog } = readPlanningCorpus(pmDir);
  return {
    ...planningSnapshot(pmDir, { files, cancelledLog }),
    directories: walkDirectories(pmDir),
    generatedAt: new Date().toISOString(),
    cancelledLog,
    repoRootFileUrl: pathToFileURL(root).href.replace(/\/$/, "") + "/",
    repoRootPath: root.replace(/\\/g, "/"),
    pmDirRepoRel: pmRel.replace(/\\/g, "/"),
    sourceKeys: Object.keys(collectSources(files, root, { keysOnly: true })),
    files: files.map(({ relPath, raw, mtimeMs, absDir }) => ({
      relPath, raw, mtimeMs, repoDir: relative(root, absDir).replace(/\\/g, "/"),
    })),
  };
}

function readInWorker(paths) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./snapshot-worker.mjs", import.meta.url), { workerData: paths });
    const timeout = setTimeout(() => {
      reject(new Error("PM snapshot took too long"));
      void worker.terminate();
    }, 15_000);
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error("PM snapshot worker exited early"));
    });
  });
}

/** Share one projection across browsers and the relay. File events invalidate
 * it immediately, and the short expiry covers missed watch events and source links. */
export function createSnapshotReader(paths, { maxAgeMs = 15_000, read = readInWorker } = {}) {
  let revision = 0;
  let cached;
  let pending;
  return {
    invalidate() { revision++; },
    async read() {
      while (true) {
        const requested = revision;
        if (cached?.revision === requested && cached.expires > Date.now()) return cached.snapshot;
        if (!pending) {
          pending = read(paths).then(snapshot => {
            cached = { snapshot, revision: requested, expires: Date.now() + maxAgeMs };
            return cached;
          }).finally(() => { pending = null; });
        }
        const result = await pending;
        if (result.revision === revision) return result.snapshot;
      }
    },
  };
}
