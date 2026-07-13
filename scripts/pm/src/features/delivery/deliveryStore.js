import { signal } from "@preact/signals";
import { apiGet, apiPost } from "../../app/api.js";
import { showToast } from "../../app/store.js";

export const deliveryData = signal({ sessions: [], buildLockActive: false });
export const deliverySession = signal(null);
export const deliveryEvents = signal([]);
export const deliveryCursor = signal(0);
export const deliveryLoading = signal(false);
export const activeDeliveryId = signal(null);

const terminal = new Set(["SHIPPED", "CANCELLED", "FAILED"]);
export function deliverEligibility(task, sessions = [], topics = []) {
  if (!task || task.state !== "open") return { eligible: false, reason: "Task is not open" };
  if (!topics.includes(task.module)) return { eligible: false, reason: "Campaign has no delivery checklist" };
  const active = sessions.find((session) => session.item?.pmFile === task.file && session.item?.cbidx === task.cbidx && !terminal.has(session.state));
  return active ? { eligible: false, reason: `Already in delivery (${active.state})`, sessionId: active.sessionId } : { eligible: true, reason: null };
}

export async function loadDeliverySessions() {
  if (globalThis.PM_MODE !== "server") return;
  deliveryLoading.value = true;
  try { deliveryData.value = await apiGet("/api/delivery/sessions"); }
  finally { deliveryLoading.value = false; }
}
export async function loadDeliverySession(id, { reset = false } = {}) {
  if (!id) return; activeDeliveryId.value = id; if (reset) { deliveryEvents.value = []; deliveryCursor.value = 0; }
  const [detail, tail] = await Promise.all([
    apiGet(`/api/delivery/session?id=${encodeURIComponent(id)}`),
    apiGet(`/api/delivery/events?id=${encodeURIComponent(id)}&after=${deliveryCursor.value}`),
  ]);
  deliverySession.value = detail;
  deliveryEvents.value = [...deliveryEvents.value, ...tail.events]; deliveryCursor.value = tail.lastSeq;
}
export async function refreshDelivery(sessionId) {
  await loadDeliverySessions().catch(() => {});
  if (activeDeliveryId.value && (!sessionId || sessionId === activeDeliveryId.value)) await loadDeliverySession(activeDeliveryId.value).catch(() => {});
}
export async function deliveryPost(op, body, message) {
  try { const result = await apiPost(`delivery/${op}`, body); if (message) showToast(message); return result; }
  catch (error) { showToast(error.message, { type: "error" }); throw error; }
}

