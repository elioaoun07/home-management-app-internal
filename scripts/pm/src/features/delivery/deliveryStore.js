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
// DLV-2: authoritative item/recommendation/context preview for the launch Flight-Check.
export const deliveryRecommendation = signal(null);
// DLV-5: authoritative workspace + validation snapshot shown before launch.
export const deliveryPreflight = signal({ loading: false, data: null, error: null });
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
// DLV-73: `locatorChoice` re-resolves the preview around the file the owner
// picked from an ambiguous locator shortlist, so the scope, lane recommendation
// and forecast on screen are the ones the launch will actually use.
export async function loadDeliveryRecommendation(file, cbidx, provider, locatorChoice = null) {
  if (globalThis.PM_MODE !== "server" || !file || cbidx == null) { deliveryRecommendation.value = null; return; }
  deliveryRecommendation.value = null;
  try {
    const params = new URLSearchParams({ file, cbidx: String(cbidx), provider });
    if (locatorChoice) params.set("locatorChoice", locatorChoice);
    const result = await apiGet(`/api/delivery/recommendation?${params.toString()}`);
    deliveryRecommendation.value = result;
  } catch { deliveryRecommendation.value = null; } // wizard just hides the card
}
export async function loadDeliveryPreflight() {
  if (globalThis.PM_MODE !== "server") {
    deliveryPreflight.value = { loading: false, data: null, error: "Delivery preflight requires server mode." };
    return;
  }
  deliveryPreflight.value = { loading: true, data: null, error: null };
  try {
    const data = await apiPost("delivery/preflight", {});
    deliveryPreflight.value = { loading: false, data, error: null };
  } catch (error) {
    deliveryPreflight.value = { loading: false, data: null, error: error.message };
  }
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
// DLV-16 — the dashboard half of notifications. DLV-22 shipped the web-push
// half by consuming `notification.requested` in the bridge; the same events
// never surfaced on `pnpm pm` itself, so an owner sitting in front of the
// dashboard learned about a cap-hit or a gate only by noticing the page had
// changed.
//
// Kept deliberately narrow: the runner already emits exactly one
// `notification.requested` per state change worth interrupting for (that is
// why the DLV-12 finish package pointedly does NOT emit its own — see the
// comment on `writeFinishPackage`), so this consumes that one event rather
// than inventing a second, differently-shaped notion of "important".
const NOTIFICATION_COPY = {
  "budget-warning": { message: "Delivery is approaching its authorized budget", type: "warn" },
  "budget-exhausted": { message: "Delivery paused — authorized budget exhausted", type: "error" },
  "retry-exhausted": { message: "Delivery needs a decision — automatic retries are exhausted", type: "error" },
  "max-turns": { message: "Delivery hit the lane's internal-turn ceiling — a decision is needed", type: "error" },
};
const notifiedEventKeys = new Set();

function toastForNotifications(sessionId, events) {
  for (const event of events) {
    if (event.type !== "notification.requested") continue;
    const key = `${sessionId}:${event.seq}`;
    if (notifiedEventKeys.has(key)) continue;
    notifiedEventKeys.add(key);
    const reason = event.data?.reason || "notification";
    const copy = NOTIFICATION_COPY[reason] || { message: `Delivery: ${reason}`, type: "warn" };
    showToast(copy.message, { type: copy.type });
  }
}

// Gate transitions are not `notification.requested` events — a gate is a
// normal, expected stop — but they are the single thing an owner most needs to
// know about, so they get the same treatment as in the bridge: toast on the
// TRANSITION only, never on every poll of a session already sitting at a gate.
const lastAwaitingGate = new Map();
const GATE_COPY = {
  spec: "Spec is ready for your approval",
  plan: "Plan is ready for your approval",
  uat: "UAT package is ready for you to accept",
  question: "Delivery is asking you a question",
  blocked: "Delivery is blocked and needs you",
  budget: "Delivery paused at its budget cap",
  shipped: "Delivery is accepted — mark it shipped when you've committed",
};

function toastForGate(sessionId, awaiting) {
  const gate = awaiting?.gate || null;
  const previous = lastAwaitingGate.get(sessionId);
  lastAwaitingGate.set(sessionId, gate);
  // `undefined` means this session has not been seen before in this page
  // session: staying silent avoids a toast storm on first load / navigation.
  if (previous === undefined || gate === previous || !gate) return;
  showToast(GATE_COPY[gate] || `Delivery is waiting at the ${gate} gate`, { type: gate === "blocked" ? "error" : "warn" });
}

export async function loadDeliverySession(id, { reset = false } = {}) {
  if (!id) return; activeDeliveryId.value = id; if (reset) { deliveryEvents.value = []; deliveryCursor.value = 0; lastAwaitingGate.delete(id); }
  const [detail, tail] = await Promise.all([
    apiGet(`/api/delivery/session?id=${encodeURIComponent(id)}`),
    apiGet(`/api/delivery/events?id=${encodeURIComponent(id)}&after=${deliveryCursor.value}`),
  ]);
  toastForNotifications(id, tail.events);
  toastForGate(id, detail.state?.awaiting);
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
