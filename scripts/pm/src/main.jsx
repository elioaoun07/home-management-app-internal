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
render(<App/>, document.getElementById("app"));

