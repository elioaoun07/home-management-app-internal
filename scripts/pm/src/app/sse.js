import { reloadData, showToast } from "./store.js";
import { refreshDelivery } from "../features/delivery/deliveryStore.js";

export function connectEvents() {
  if (globalThis.PM_MODE !== "server" || typeof EventSource === "undefined") return () => {};
  const source = new EventSource("/api/events");
  let dataTimer = 0;
  let deliveryTimer = 0;
  source.onmessage = () => { clearTimeout(dataTimer); dataTimer = setTimeout(() => reloadData().catch(() => {}), 150); };
  source.addEventListener("delivery", (event) => {
    clearTimeout(deliveryTimer);
    deliveryTimer = setTimeout(() => {
      try { refreshDelivery(JSON.parse(event.data).sessionId); } catch { refreshDelivery(); }
    }, 150);
  });
  source.addEventListener("ui", () => location.reload());
  source.onerror = () => showToast("Live updates disconnected; retrying…", { type: "error", duration: 2500 });
  return () => { clearTimeout(dataTimer); clearTimeout(deliveryTimer); source.close(); };
}

