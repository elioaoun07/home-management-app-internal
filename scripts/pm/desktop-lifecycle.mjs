// Private, per-process mailbox for the owner's Windows launcher. There is no HTTP control.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fleetOf } from "../delivery-v2/coordination.mjs";
import { openStore } from "../delivery-v2/store.mjs";
import { STORE_REL } from "../delivery-v2/service.mjs";

export const validDesktopId = value => typeof value === "string" && /^[0-9a-f]{32}$/.test(value);

/** Read live task ownership in this supervisor, then inspect the same slots used by Delivery. */
export function deliveryRestartBlocker(ctx) {
  const legacy = ctx.activeV1Writers();
  if (legacy.length) return "An earlier delivery is still open. Review " + legacy[0] + " in Sessions.";
  if (ctx.local.isWorking()) return "A Local delivery is running. Wait for it to finish.";
  if (!ctx.hasStore()) return null;
  const current = ctx.passiveStore();
  // A fresh server may not have opened the existing store. Its immutable reader
  // refuses an external writer/WAL. Never manufacture an empty supervisor to check it.
  const view = current ?? openStore({ path: join(ctx.root, STORE_REL), readOnly: true });
  try {
    const fleet = fleetOf({ store: view, unit: "usd" });
    if (fleet.running.length || fleet.writers.length || view.listSettledUnprocessedJobs().length || view.listActiveApplications().length) {
      return "Delivery has active or unconfirmed work. Check Sessions and retry when idle.";
    }
    if (!view.readOnlySnapshotCurrent()) return "Delivery changed during the check. Try again.";
    return null;
  } finally {
    view.close();
  }
}

function writeMessage(file, value) {
  const temporary = file + ".tmp";
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  renameSync(temporary, file);
}

export function createDesktopLifecycle({ dir, instance, port, blocker, shutdown, intervalMs = 500 }) {
  if (!validDesktopId(instance)) throw new Error("Invalid PM desktop instance");
  mkdirSync(dir, { recursive: true });
  const ready = join(dir, "ready-" + instance + ".json");
  const request = join(dir, "restart-" + instance + ".json");
  writeMessage(ready, { pid: process.pid, port, instance });
  let closing = false;
  let timer;
  function stop() {
    clearInterval(timer);
    rmSync(ready, { force: true });
  }
  function poll() {
    if (closing || !existsSync(request)) return;
    let id;
    try {
      try {
        id = JSON.parse(readFileSync(request, "utf8").replace(/^\uFEFF/, ""))?.id;
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
      if (!validDesktopId(id)) { rmSync(request, { force: true }); return; }
      const result = join(dir, "result-" + id + ".json");
      if (existsSync(result)) { rmSync(request, { force: true }); return; }
      let reason;
      try { reason = blocker(); }
      catch { reason = "PM could not verify idle delivery state. Check Sessions and retry."; }
      const reply = reason ? { status: "refused", message: reason } : { status: "restarting", message: "PM is restarting." };
      rmSync(request, { force: true });
      writeMessage(result, reply);
      if (!reason) {
        closing = true;
        clearInterval(timer);
        shutdown();
      }
    } catch (error) {
      // A transient file-sharing failure must not terminate a working PM server.
      console.error("[pm-desktop] Could not process restart request:", error.code || error.name);
    }
  }
  if (intervalMs > 0) {
    timer = setInterval(poll, intervalMs);
    timer.unref();
  }
  return { poll, stop };
}
