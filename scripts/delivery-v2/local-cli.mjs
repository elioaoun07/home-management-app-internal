// node scripts/delivery-v2/local-cli.mjs readiness [claude|codex]
// State-changing Local commands are previewed on the owner's run page.
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openStore } from "./store.mjs";
import { createLocalLane } from "./local-lane.mjs";
const root = fileURLToPath(new URL("../..", import.meta.url));
const store = openStore({ path: join(root, ".delivery/v2/supervisor.sqlite") });
const lane = createLocalLane({ root, store });
try {
  const [action, id] = process.argv.slice(2);
  if (action === "readiness") process.stdout.write(JSON.stringify(await lane.readiness({ executor: id || "claude" }), null, 2) + "\n");
  else if (action === "status") process.stdout.write(JSON.stringify(await lane.detail(id), null, 2) + "\n");
  else throw new Error("Use readiness or status. Open the item in the PM Command Center to start a Local run.");
} catch (error) { process.stderr.write(error.message + "\n"); process.exitCode = 1; }
finally { store.close(); }
