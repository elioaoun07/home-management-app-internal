import { reloadData, showToast } from "./store.js";
import { refreshDelivery } from "../features/delivery/deliveryStore.js";

export function connectEvents() {
  if (globalThis.PM_MODE !== "server" || typeof EventSource === "undefined") return () => {};
  const source = new EventSource("/api/events");
  let dataTimer = 0;
  let deliveryTimer = 0;
  // The browser retries a dropped SSE connection forever on its own; away
  // from the laptop that means one error every few seconds indefinitely.
  // Announce the disconnect once, not on every retry, and reset once it
  // reconnects so a real future drop still gets its own toast.
  let announced = false;
  source.onopen = () => { announced = false; };
  source.onmessage = () => { clearTimeout(dataTimer); dataTimer = setTimeout(() => reloadData().catch(() => {}), 150); };
  source.addEventListener("delivery", (event) => {
    clearTimeout(deliveryTimer);
    deliveryTimer = setTimeout(() => {
      try { refreshDelivery(JSON.parse(event.data).sessionId); } catch { refreshDelivery(); }
    }, 150);
  });
  source.addEventListener("ui", () => location.reload());
  source.onerror = () => {
    if (announced) return;
    announced = true;
    showToast("Live updates disconnected; retrying…", { type: "error", duration: 2500 });
  };
  return () => { clearTimeout(dataTimer); clearTimeout(deliveryTimer); source.close(); };
}

