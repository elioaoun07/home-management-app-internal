import { createRoot } from "react-dom/client";
import { CommandCenter } from "./CommandCenter";
import { createLocalTransport } from "./localTransport";
import { setTransport } from "./transport";
import "./brand.css";
import "./styles.css";
import "./delivery.css";
import "./board.css";
import "./dashboard.css";
import "./responsive.css";

setTransport(createLocalTransport());
createRoot(document.getElementById("app")!).render(<CommandCenter />);
if ("serviceWorker" in navigator)
  void navigator.serviceWorker.register("/sw.js").catch(() => {
    /* Online app remains available. */
  });
