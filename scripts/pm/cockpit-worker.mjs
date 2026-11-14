import { parentPort, workerData } from "node:worker_threads";
import { createHash } from "node:crypto";
import { cockpit } from "./cockpit.mjs";
const value = cockpit(workerData.root);
const stable = {
  ...value,
  setup: value.setup ? { ...value.setup, generatedAt: undefined } : null,
};
parentPort.postMessage({
  value,
  digest: createHash("sha256").update(JSON.stringify(stable)).digest("hex"),
});
