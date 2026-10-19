import { parentPort, workerData } from "node:worker_threads";
import { readCompilerInputs } from "./inspect-readiness.mjs";

// Separate entry avoids a top-level-await cycle through the inspector. Importing
// it supplies only the read-only helper; no store, runtime or probe is opened.
if (parentPort && workerData?.kind === "delivery-compiler-observation@1") {
  try {
    parentPort.postMessage({ ok: true, inputs: readCompilerInputs(workerData.root, workerData.configured) });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error.message });
  } finally {
    parentPort.close();
  }
}
