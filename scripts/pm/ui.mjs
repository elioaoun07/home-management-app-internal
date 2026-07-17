import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

function escapeScript(value) {
  return String(value).replace(/<\/script/gi, "<\\/script");
}

/** @param {{mode?: string, dataJson?: string, bundle?: {js: string, css: string}}} options */
export function buildHtml({ mode = "static", dataJson = "null", bundle } = {}) {
  if (!bundle?.js || bundle.css == null) throw new Error("buildHtml requires a compiled PM UI bundle");
  // PWA identity only in server mode — the static _dashboard.html is opened
  // from file:// where root-absolute asset links would 404.
  const pwaHead = mode === "server" ? `
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/svg+xml" href="/assets/pm-icon.svg">
<link rel="apple-touch-icon" href="/assets/pm-180.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="PM Center">` : "";
  return `<!doctype html>
<html lang="en" data-theme="blue">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a1628">${pwaHead}
<title>PM Command Center</title>
<style>${bundle.css}</style>
</head>
<body>
<div id="app"></div>
<script>var PM_MODE=${JSON.stringify(mode)};var PM_DATA=${escapeScript(dataJson)};</script>
<script>${escapeScript(bundle.js)}</script>
</body>
</html>
`;
}

// Temporary strangler escape hatch. The new UI is the default; `--ui=old` or
// `?ui=old` keeps the proven legacy surface available during final parity QA.
export function buildHtmlLegacy({ mode = "static", dataJson = "null" } = {}) {
  const css = readFileSync(join(HERE, "styles.css"), "utf8");
  const body = readFileSync(join(HERE, "body.html"), "utf8");
  const client = readFileSync(join(HERE, "client.js"), "utf8");
  const scanner = inlineEsm(readFileSync(join(HERE, "shared", "md-scan.mjs"), "utf8"));
  const registry = inlineEsm(readFileSync(join(HERE, "..", "delivery", "agent-registry.mjs"), "utf8"));
  const classify = inlineEsm(readFileSync(join(HERE, "..", "delivery", "classify.mjs"), "utf8"));
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PM Command Center (legacy)</title><style>${css}</style></head><body>${body}<script>var PM_MODE=${JSON.stringify(mode)};var PM_DATA=${escapeScript(dataJson)};${scanner}\n${registry}\n${classify}</script><script>${escapeScript(client)}</script></body></html>`;
}

function inlineEsm(source) {
  return source.split("\n").filter((line) => !/^\s*import\s.*from\s+["'].*["'];?\s*$/.test(line)).join("\n").replace(/^export\s+(const|class|function)/gm, "$1");
}
