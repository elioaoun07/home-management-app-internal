// Keep registry/Git/preview work off the health event loop, like A5.
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";
import { prepare, requestSchema } from "../os/launchpad.mjs";

if (!isMainThread && workerData?.launchpad) {
  try {
    parentPort.postMessage(await prepare(workerData.root, workerData.body));
  } catch (error) {
    parentPort.postMessage({ ok: false, errors: { form: error.message } });
  }
}
export function routeLaunchpad({ root, body, headers, loopbackPeer }) {
  const origin = headers.origin;
  if (
    !loopbackPeer ||
    headers["sec-fetch-site"] === "cross-site" ||
    !origin ||
    origin !== `http://${headers.host}`
  )
    return Promise.resolve({
      status: 403,
      json: { error: "local-same-origin-required" },
    });
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success)
    return Promise.resolve({
      status: 400,
      json: { error: "invalid-launch-form" },
    });
  return new Promise((resolve) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { launchpad: true, root, body: parsed.data },
    });
    let finished = false;
    const finish = (status, json) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve({ status, json });
    };
    const timer = setTimeout(
      () => finish(503, { error: "launch-form-timeout" }),
      25000,
    );
    worker.once("message", (json) => finish(200, json));
    worker.once("error", () =>
      finish(503, { error: "launch-form-unavailable" }),
    );
    worker.once("exit", () => {
      if (!finished) finish(503, { error: "launch-form-unavailable" });
    });
  });
}
