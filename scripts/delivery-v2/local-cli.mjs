// node scripts/delivery-v2/local-cli.mjs readiness [claude|codex]
// node scripts/delivery-v2/local-cli.mjs start DLV-123 "Delivery/4 - Checklist.md" codex
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openStore } from "./store.mjs";
import { createLocalLane } from "./local-lane.mjs";
const root = fileURLToPath(new URL("../..", import.meta.url));
const store = openStore({ path: join(root, ".delivery/v2/supervisor.sqlite") });
const lane = createLocalLane({ root, store });
try {
  const [action, id, file, executor] = process.argv.slice(2);
  if (action === "readiness") process.stdout.write(JSON.stringify(await lane.readiness({ executor: id || "claude" }), null, 2) + "\n");
  else if (action === "start") {
    const result = await lane.start({ id, file, executor: executor || "claude" });
    process.stdout.write(JSON.stringify(result) + "\n");
    if (result.run_id) { await lane.wait(result.run_id); process.stdout.write(JSON.stringify(await lane.detail(result.run_id), null, 2) + "\n"); }
    if (!result.ok) process.exitCode = 1;
  } else if (action === "status") process.stdout.write(JSON.stringify(await lane.detail(id), null, 2) + "\n");
  else throw new Error("use readiness, start or status; Ship and Undo belong to the owner in Command Center");
} catch (error) { process.stderr.write(error.message + "\n"); process.exitCode = 1; }
finally { store.close(); }
