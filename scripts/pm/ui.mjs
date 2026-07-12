// scripts/pm/ui.mjs
// Shared UI for the PM dashboard, consumed by the static generator
// (build-pm-dashboard.mjs) and the live server (pm-server.mjs).
// The actual CSS / markup / client app live as editable sibling files
// (styles.css, body.html, client.js). The client reads window.PM_MODE
// ("static" | "server") to choose a read-only vs writeable data provider.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scanCheckboxes } from "./mutations.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CSS = readFileSync(join(HERE, "styles.css"), "utf8");
export const BODY = readFileSync(join(HERE, "body.html"), "utf8");
export const CLIENT_JS = readFileSync(join(HERE, "client.js"), "utf8");

const AGENT_REGISTRY_SRC = readFileSync(join(HERE, "..", "delivery", "agent-registry.mjs"), "utf8");
const CLASSIFY_SRC = readFileSync(join(HERE, "..", "delivery", "classify.mjs"), "utf8");

// Strip `import ... from "...";` lines and `export ` prefixes so a plain ESM
// module can be dropped into a non-module <script> tag verbatim (same
// precedent as scanCheckboxes below). Dependency order (agent-registry before
// classify) keeps classify.mjs's top-level `getAgent`/`isEnabledForPhase1`
// references resolving against the preceding script's top-level bindings —
// non-module <script> tags share one global lexical scope for let/const/class,
// same as they already do for `var`.
function esmToInlineScript(src) {
  return src
    .split("\n")
    .filter((line) => !/^\s*import\s.*from\s+["'].*["'];?\s*$/.test(line))
    .join("\n")
    .replace(/^export\s+(const|class|function)/gm, "$1");
}

// scanCheckboxes is injected verbatim so the browser uses the exact same
// checkbox-ordinal logic as the server (mutations.mjs) — no drift possible.
// agent-registry.mjs + classify.mjs are injected the same way so the Agent
// Catalog, the classifier capability preview, and the server's own
// classification can never drift from one shared source (doc 2 §5).
export function buildHtml({ mode = "static", dataJson = "null" } = {}) {
  return (
    "<!DOCTYPE html>\n" +
    '<html lang="en">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "<title>PM Command Center</title>\n" +
    "<style>\n" + CSS + "\n</style>\n</head>\n" +
    "<body>\n" + BODY + "\n" +
    "<script>\nvar PM_MODE = " + JSON.stringify(mode) + ";\n" +
    "var PM_DATA = " + dataJson + ";\n" +
    "var scanCheckboxes = " + scanCheckboxes.toString() + ";\n" +
    esmToInlineScript(AGENT_REGISTRY_SRC) + "\n" +
    esmToInlineScript(CLASSIFY_SRC) + "\n</script>\n" +
    "<script>\n" + CLIENT_JS + "\n</script>\n" +
    "</body>\n</html>\n"
  );
}
