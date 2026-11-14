function escapeScript(value) {
  return String(value).replace(/<\/script/gi, "<\\/script");
}

/**
 * @param {{mode?: string, dataJson?: string, bundle?: {js: string, css: string}, pwa?: boolean}} options
 * `pwa: true` emits an installable head + service-worker registration for the
 * hosted read-only page served by the Next app at /pm (assets live under public/).
 * It is independent of `mode === "server"`, which points at the standalone
 * pm-server's /assets/ paths and only makes sense on localhost.
 */
export function buildHtml({ mode = "static", dataJson = "null", bundle, pwa = false } = {}) {
  if (!bundle?.js || bundle.css == null) throw new Error("buildHtml requires a compiled PM UI bundle");
  // PWA identity for the standalone pm-server (localhost, secure context).
  // The plain static _dashboard.html is opened from file:// where root-absolute
  // asset links would 404, so it gets no head.
  const serverHead = mode === "server" ? `
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" type="image/svg+xml" href="/assets/pm-icon.svg">
<link rel="apple-touch-icon" href="/assets/pm-180.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="PM Center">` : "";
  // PWA identity for the page hosted inside the Next app at /pm. Assets are
  // committed under public/ (pm.webmanifest, pm-*.png, pm-icon.svg) and the app
  // service worker (/sw.js) precaches /pm for offline use — see public/sw.js.
  const hostedHead = pwa ? `
<link rel="manifest" href="/pm.webmanifest">
<link rel="icon" type="image/svg+xml" href="/pm-icon.svg">
<link rel="apple-touch-icon" href="/pm-180.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="PM Center">` : "";
  // Register the shared app service worker so a cold, direct open of /pm (from
  // the installed icon, without ever loading the main app) still caches this
  // page for offline. Guarded on a secure context; HTTPS host satisfies it.
  const swScript = pwa ? `
<script>if("serviceWorker"in navigator&&window.isSecureContext){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})});}</script>` : "";
  return `<!doctype html>
<html lang="en" data-theme="blue">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a1628">${serverHead}${hostedHead}
<title>PM Command Center</title>
<style>${bundle.css}</style>
</head>
<body>
<div id="app"></div>
<script>var PM_MODE=${JSON.stringify(mode)};var PM_DATA=${escapeScript(dataJson)};</script>
<script>${escapeScript(bundle.js)}</script>${swScript}
</body>
</html>
`;
}
