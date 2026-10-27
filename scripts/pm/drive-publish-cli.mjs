// scripts/pm/drive-publish-cli.mjs
//   pnpm pm:drive             full publish (documents + status) to the Drive folder
//   pnpm pm:drive --dry-run   show what would change; writes nothing
//   pnpm pm:drive --root=D:\path\to\folder   override the destination (PM_DRIVE_DIR also works)
//
// The running PM server publishes on every PM/delivery change; this is the manual initial pass.
// Delivery status is read from the supervisor store read-only. While the server holds it open
// (WAL files present) the read is refused and the previous status is kept, marked stale.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { openStore } from "../delivery-v2/store.mjs";
import { createRollupsSnapshotBuilder } from "./bridge.mjs";
import { createDrivePublisher, readDeliveryFromStore, resolveDriveRoot } from "./drive-publish.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PM_DIR = join(ROOT, "ERA Notes", "10 - Project Management");
const STORE_PATH = join(ROOT, ".delivery", "v2", "supervisor.sqlite");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const rootArg = args.find((a) => a.startsWith("--root="));
const driveRoot = rootArg ? rootArg.slice(7) : resolveDriveRoot();
if (!driveRoot) {
  console.error("No destination: set PM_DRIVE_DIR or pass --root=<folder>.");
  process.exit(1);
}

function readDelivery() {
  if (!existsSync(STORE_PATH)) return { available: false, reason: "no-store", runs: [], requests: [] };
  let store;
  try {
    store = openStore({ path: STORE_PATH, readOnly: true });
    return readDeliveryFromStore(store);
  } catch (error) {
    return { available: false, reason: String(error?.message || error).slice(0, 200), runs: [], requests: [] };
  } finally {
    try { store?.close?.(); } catch { /* read-only handle */ }
  }
}

const publisher = createDrivePublisher({
  root: ROOT,
  pmDir: PM_DIR,
  docsDir: join(ROOT, "docs"),
  driveRoot,
  readDelivery,
  readRollups: () => createRollupsSnapshotBuilder({ PM_DIR }).buildRollupsSnapshot(),
  statePath: join(ROOT, ".pm", "drive-publish.json"),
  log: console.log,
});

const result = await publisher.publishNow({ full: true, dryRun });
publisher.stop();
if (!result.ok) {
  console.error("Publish failed: " + (result.error || "busy"));
  process.exit(1);
}
const { status, ...summary } = result;
console.log(JSON.stringify({ driveRoot, ...summary, deliveryAvailable: status?.delivery?.available ?? null, runs: status?.delivery?.runs?.length ?? null }, null, 2));
