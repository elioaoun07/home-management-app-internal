import { signal } from "@preact/signals";
import { apiGet, apiPost } from "../../app/api.js";
import { showToast } from "../../app/store.js";

export const deliveryData = signal({ sessions: [], buildLockActive: false });
export const deliverySession = signal(null);
export const deliveryEvents = signal([]);
export const deliveryCursor = signal(0);
export const deliveryLoading = signal(false);
export const activeDeliveryId = signal(null);
// DW-2: provider/model/effort capability manifests + owner catalog for the launch wizard.
export const deliveryCapabilities = signal(null);
// Slice D: model/effort recommendation preview for the launch wizard (null hides the card).
export const deliveryRecommendation = signal(null);
// DW-5: the durable Q&A ledger for the active session.
export const deliveryQuestions = signal(null);
// DW-3: conversation viewer — turn index, per-turn record cache, search state.
export const deliveryTurns = signal([]);
export const deliveryTurnsCursor = signal(0);
export const deliveryTranscriptByTurn = signal({}); // turnId -> {records, lastSeq}
export const deliverySearchQuery = signal("");
export const deliverySearchResults = signal(null); // {matches, truncated} | null

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
export async function loadDeliveryCapabilities() {
  if (globalThis.PM_MODE !== "server") return;
  if (deliveryCapabilities.value) return; // static per server process; fetch once
  try { deliveryCapabilities.value = await apiGet("/api/delivery/capabilities"); }
  catch { /* wizard falls back to provider-only selection if this fails */ }
}
export async function loadDeliveryRecommendation(file, cbidx, provider) {
  if (globalThis.PM_MODE !== "server" || !file || cbidx == null) { deliveryRecommendation.value = null; return; }
  try {
    const params = new URLSearchParams({ file, cbidx: String(cbidx), provider });
    const result = await apiGet(`/api/delivery/recommendation?${params.toString()}`);
    deliveryRecommendation.value = result.recommendation;
  } catch { deliveryRecommendation.value = null; } // wizard just hides the card
}
export async function loadDeliveryQuestions(id) {
  if (globalThis.PM_MODE !== "server" || !id) return;
  try { deliveryQuestions.value = await apiGet(`/api/delivery/questions?id=${encodeURIComponent(id)}`); }
  catch { /* Q&A card just shows nothing if this fails */ }
}
export async function loadDeliveryTurns(id, { reset = false } = {}) {
  if (globalThis.PM_MODE !== "server" || !id) return;
  if (reset) { deliveryTurns.value = []; deliveryTurnsCursor.value = 0; deliveryTranscriptByTurn.value = {}; }
  try {
    const tail = await apiGet(`/api/delivery/turns?id=${encodeURIComponent(id)}&after=${deliveryTurnsCursor.value}`);
    if (tail.turns.length) deliveryTurns.value = [...deliveryTurns.value, ...tail.turns];
    deliveryTurnsCursor.value = tail.lastTurn;
  } catch { /* Conversation tab shows nothing new this poll */ }
}
export async function loadDeliveryTranscript(id, turnId) {
  if (globalThis.PM_MODE !== "server" || !id || !turnId) return;
  try {
    const result = await apiGet(`/api/delivery/transcript?id=${encodeURIComponent(id)}&turn=${encodeURIComponent(turnId)}`);
    deliveryTranscriptByTurn.value = { ...deliveryTranscriptByTurn.value, [turnId]: result };
  } catch (error) { showToast(error.message, { type: "error" }); }
}
export async function searchDeliveryTranscript(id, { q: query, kinds, phase } = {}) {
  if (globalThis.PM_MODE !== "server" || !id || !query?.trim()) { deliverySearchResults.value = null; return; }
  try {
    const params = new URLSearchParams({ id, q: query });
    if (kinds) params.set("kinds", kinds);
    if (phase) params.set("phase", phase);
    deliverySearchResults.value = await apiGet(`/api/delivery/transcript/search?${params.toString()}`);
  } catch (error) { showToast(error.message, { type: "error" }); }
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

