// Isolated runner: the audit suite never calls model APIs or source routes.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = spawnSync(process.execPath, [
  path.join(root, "node_modules/vitest/vitest.mjs"), "run",
  "src/features/era/capabilities/coverage.test.ts",
], { cwd: root, stdio: "inherit", env: { ...process.env, ERA_CAPABILITIES_REPORT: "1" } });
if (run.error) throw run.error;
if (run.status !== 0) process.exit(run.status ?? 1);
const file = path.join(root, ".tmp/era-capabilities/report.json");
const report = JSON.parse(fs.readFileSync(file, "utf8"));
process.stdout.write(`${report.capabilities.length} registered capabilities; ${report.operations.length} API operations inventoried.\nReport: ${file}\n`);
