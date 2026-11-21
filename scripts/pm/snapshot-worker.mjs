import { parentPort, workerData } from "node:worker_threads";
import { projectSnapshot } from "./snapshot.mjs";

parentPort.postMessage(projectSnapshot(workerData));
