import { render } from "preact";
import { App } from "./app/App.jsx";
import { initRouter } from "./app/router.js";
import { reloadData } from "./app/store.js";
import { connectEvents } from "./app/sse.js";
import { initShortcuts } from "./app/shortcuts.js";

initRouter();
reloadData().catch(() => {});
connectEvents();
initShortcuts();
// Installability on secure contexts (desktop localhost). LAN HTTP is not a
// secure context — Add-to-Home-Screen there works without a service worker.
if (globalThis.PM_MODE === "server" && "serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
render(<App/>, document.getElementById("app"));

