// The local app fetches canonical Markdown through /api/data; HTML contains no snapshot.
export function buildAppShell() {
  return `<!doctype html>
<html lang="en" data-theme="blue"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0a1628"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/assets/pm-icon.svg"><title>ERA — In the making</title><link rel="stylesheet" href="/app/assets/pm.css"></head><body><div id="app"></div><noscript>Enable JavaScript to open ERA.</noscript><script type="module" src="/app/assets/pm.js"></script></body></html>`;
}
export function appAsset(path, bundle) {
  return path === "/app/assets/pm.js"
    ? { type: "text/javascript; charset=utf-8", body: bundle.js }
    : path === "/app/assets/pm.css"
      ? { type: "text/css; charset=utf-8", body: bundle.css }
      : null;
}
