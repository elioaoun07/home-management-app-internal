// Keep A1 filesystem/Git and A4 SQLite work off the PM server's health loop.
// This is a disposable read cache, never another registry or session store.
import { Worker } from "node:worker_threads";
import { redact } from "../os/privacy.mjs";
export function createCockpitReader({
  root,
  onChange = () => {},
  intervalMs = 15000,
  timeoutMs = 15000,
  autoStart = true,
  readDeliverySnapshot = () => null,
  createWorker = (data) =>
    new Worker(new URL("./cockpit-worker.mjs", import.meta.url), {
      workerData: data,
    }),
}) {
  /** @type {import("./app/cockpitTypes").Cockpit} */
  let value = {
    setup: null,
    conflicts: [],
    records: [],
    deliveries: [],
    groups: [],
    filed: [],
    warnings: [],
    pending: true,
  };
  let digest = null,
    pending = null,
    worker = null,
    stopped = false;
  const refresh = ({ forceRescan = false } = {}) => {
    if (pending)
      return forceRescan
        ? pending.then(() => refresh({ forceRescan: true }))
        : pending;
    if (stopped) return Promise.resolve();
    let settle;
    pending = new Promise((resolve) => {
      settle = resolve;
    });
    const task = pending;
    let done = false;
    const finish = (reply, error) => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      if (error) {
        value = {
          ...value,
          pending: false,
          stale: true,
          warnings: [
            ...value.warnings.filter(
              (w) => !w.startsWith("Snapshot refresh unavailable"),
            ),
            "Snapshot refresh unavailable: " + redact(error.message),
          ],
        };
        onChange();
      } else if (
        reply &&
        (reply.digest !== digest || value.stale || value.pending)
      ) {
        digest = reply.digest;
        value = { ...reply.value, pending: false, stale: false };
        onChange();
      }
      pending = null;
      worker = null;
      settle();
    };
    const deadline = setTimeout(() => {
      void worker?.terminate();
      finish(null, new Error("timeout"));
    }, timeoutMs);
    deadline.unref?.();
    try {
      worker = createWorker({
        root,
        forceRescan,
        deliverySnapshot: readDeliverySnapshot(),
      });
      worker.unref();
      worker.once("message", (reply) => finish(reply, null));
      worker.once("error", (error) => finish(null, error));
      worker.once("exit", (code) => {
        if (!done) finish(null, new Error(`worker exited ${code}`));
      });
    } catch (error) {
      finish(null, error);
    }
    return task;
  };
  const timer =
    intervalMs > 0 ? setInterval(() => void refresh(), intervalMs) : null;
  timer?.unref?.();
  if (autoStart) void refresh();
  return {
    read: () => value,
    refresh,
    rescan: () => refresh({ forceRescan: true }),
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
      void worker?.terminate();
    },
  };
}
