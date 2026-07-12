// scripts/delivery/fsx.mjs
// Atomic filesystem helpers for the `.delivery/` session store.
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/2 - Architecture & Process Model.md §4.
//
// Writes go to `<name>.tmp` then `renameSync` (same-volume rename is effectively
// atomic on NTFS) with EPERM retry — Windows occasionally holds a transient lock
// on a just-written file. `events.ndjson` uses plain `appendFileSync` (append-only,
// doc 2 §4). Zero-dependency: node:fs / node:path builtins only. Every function
// accepts an injectable `fs` (and `sleep`) in `options` so tests can exercise the
// retry path without racing the real filesystem.

import * as nodeFs from "node:fs";
import { dirname } from "node:path";

export class FsxError extends Error {}

const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 20;

/** Blocking sleep via Atomics.wait — no timers/promises needed in a sync retry loop. */
function defaultSleep(ms) {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Write `data` to `targetPath` atomically: write to `<targetPath>.tmp`, then
 * rename over the target, retrying on EPERM up to `options.retries` times.
 * @param {string} targetPath
 * @param {string|Buffer} data
 * @param {{fs?, sleep?:(ms:number)=>void, retries?:number, retryDelayMs?:number}} [options]
 */
export function atomicWriteFileSync(targetPath, data, options = {}) {
  const fs = options.fs || nodeFs;
  const sleep = options.sleep || defaultSleep;
  const retries = options.retries != null ? options.retries : DEFAULT_RETRIES;
  const retryDelayMs = options.retryDelayMs != null ? options.retryDelayMs : DEFAULT_RETRY_DELAY_MS;

  fs.mkdirSync(dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp`;
  fs.writeFileSync(tmpPath, data);

  let attempt = 0;
  for (;;) {
    try {
      fs.renameSync(tmpPath, targetPath);
      return;
    } catch (err) {
      if (err && err.code === "EPERM" && attempt < retries) {
        attempt++;
        sleep(retryDelayMs);
        continue;
      }
      throw err;
    }
  }
}

/** Atomically write a JSON-serializable value (pretty-printed, newline-terminated). */
export function atomicWriteJsonSync(targetPath, value, options = {}) {
  atomicWriteFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, options);
}

/** Append one line to an ndjson file (creates the file/dir if missing). */
export function appendNdjsonLine(targetPath, line, options = {}) {
  const fs = options.fs || nodeFs;
  fs.mkdirSync(dirname(targetPath), { recursive: true });
  const text = String(line);
  fs.appendFileSync(targetPath, text.endsWith("\n") ? text : `${text}\n`);
}

/** Read + JSON.parse a file, or return `null` if it doesn't exist. */
export function readJsonIfExists(targetPath, options = {}) {
  const fs = options.fs || nodeFs;
  if (!fs.existsSync(targetPath)) return null;
  const raw = fs.readFileSync(targetPath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new FsxError(`invalid JSON in ${targetPath}: ${err.message}`);
  }
}

/** Read a file's full text, or return `null` if it doesn't exist. */
export function readTextIfExists(targetPath, options = {}) {
  const fs = options.fs || nodeFs;
  if (!fs.existsSync(targetPath)) return null;
  return fs.readFileSync(targetPath, "utf8");
}
