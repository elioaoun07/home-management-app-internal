import { beforeEach, expect, it, vi } from "vitest";
import { executePlan, planOutcome, type EraPlan } from "./plan";
import { ERA_CAPABILITIES } from "./registry";
import { initialAction, actionFields } from "./preview";
import { effectiveActionSchema } from "./effectiveAction";
import { safeFetch } from "@/lib/safeFetch";
import { findReminderCandidates } from "../intents/resolvers/reminderLookup";
import { initialRun, transition, runStatus } from "../execution/state";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { EraActionPreview } from "@/components/era/EraActionPreview";

vi.mock("@/lib/safeFetch", () => ({ safeFetch: vi.fn() }));
vi.mock("../intents/resolvers/reminderLookup", () => ({ findReminderCandidates: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ supabaseBrowser: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { due_at: "2026-10-12T07:00:00Z" } }) }) }) }),
}) }));
const date = new Date("2026-10-11T09:00:00Z");
const one = (capabilityId: string, slots: Record<string, unknown>): EraPlan => ({ steps: [{ id: "action", capabilityId, slots, label: "Harmless label" }] });
beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

it("renders authoritative fields, unresolved dependencies and consent identically for either card", () => {
  const plan = one("reminder.delete", { itemId: "FOCUS", title: "Rent" });
  const html = renderToString(createElement(EraActionPreview, { plan, referenceDate: date.toISOString(), timeZone: "Asia/Beirut" }));
  expect(html).toContain("Delete reminder"); expect(html).toContain("Recycle Bin"); expect(html).toContain("Rent");
  expect(html).not.toContain("Harmless label");
  expect(renderToString(createElement(EraActionPreview, { plan, completed: ["action"], referenceDate: date.toISOString(), timeZone: "Asia/Beirut" }))).not.toContain("Delete reminder");
  for (const cap of Object.values(ERA_CAPABILITIES)) if (cap.operation !== "read") expect(cap.confirmation?.title).toBeTruthy();
});

it("shows actual action and parsed defaults even with benign, misleading labels", () => {
  const plan = one("reminder.create", { title: "Pay rent", rawText: "Pay rent tomorrow" });
  const actual = initialAction(plan.steps[0], date);
  const view = actionFields(actual, "Asia/Beirut");
  expect(view.title).toBe("Create reminder");
  expect(actual.values).toMatchObject({ title: "Pay rent", priority: "normal", recurrence: "Once", alert: "Push at due time" });
  expect(new Date(String(actual.values.due_at)).getHours()).toBe(12);
  expect(JSON.stringify(view)).not.toContain("Harmless label");
  const deletion = actionFields(initialAction(one("reminder.delete", { itemId: "FOCUS", title: "Rent" }).steps[0], date), "Asia/Beirut");
  expect(deletion.title).toBe("Delete reminder");
  expect(deletion.fields).toContainEqual({ label: "Effect", value: "Recycle Bin" });
});
it("keeps dependent ingredients visibly unresolved; later resolves and reconfirms before shopping writes", async () => {
  const plan: EraPlan = { steps: [
    { id: "recipe", capabilityId: "recipe.ingredients", label: "Chicken", slots: { dish: "Chicken" } },
    { id: "shopping", capabilityId: "shopping.add", label: "Add milk", slots: { items: { step: "recipe", field: "ingredients" } } },
  ] };
  expect(initialAction(plan.steps[1], date).values.items).toBe("Pending · recipe.ingredients");
  const read = vi.spyOn(ERA_CAPABILITIES["recipe.ingredients"], "execute").mockResolvedValue({ text: "Chicken", metadata: { recipeName: "Chicken", ingredients: ["500 g chicken", "2 onions"] } });
  const writes: string[] = [];
  vi.mocked(safeFetch).mockImplementation(async (url, init) => {
    if (String(url) === "/api/hub/threads") return Response.json({ threads: [{ id: "list", purpose: "shopping", is_private: false }] });
    if (init?.method === "POST") { writes.push(JSON.parse(String(init.body)).content); return Response.json({ message: { id: `row-${writes.length}` } }); }
    throw new Error(String(url));
  });
  const first = await executePlan(plan, { confirmed: true, referenceDate: date });
  expect(writes).toEqual([]); expect(planOutcome(plan, first).status).toBe("awaiting_confirm");
  const consent = effectiveActionSchema.parse(first.steps[1].result.metadata!.effectiveAction);
  expect(consent.values.items).toEqual(["500 g chicken", "2 onions"]);
  const second = await executePlan(plan, { confirmed: true, referenceDate: date, resume: first.steps.slice(0, 1), consent: { shopping: consent } });
  expect(second.status).toBe("done"); expect(writes).toEqual(["500 g chicken", "2 onions"]); expect(read).toHaveBeenCalledTimes(1);
});
it("shows the effective owned reminder and both dates, then blocks a changed target", async () => {
  const focus = { id: "dentist", title: "Dentist", type: "reminder" as const, addedAt: Date.now() };
  vi.mocked(findReminderCandidates).mockResolvedValue([{ id: focus.id, title: focus.title, mine: true, recurring: false, dueAt: "2026-10-12T07:00:00Z" }]);
  const plan = one("reminder.reschedule", { itemId: focus.id, title: focus.title, whenText: "Friday at 5pm" });
  const first = await executePlan(plan, { confirmed: true, focus, referenceDate: date });
  expect(safeFetch).not.toHaveBeenCalled();
  const consent = effectiveActionSchema.parse(first.steps[0].result.metadata!.effectiveAction);
  expect(consent.values).toMatchObject({ itemId: "dentist", title: "Dentist", previousDueAt: "2026-10-12T07:00:00Z" });
  expect(consent.values.due_at).toMatch(/Z$/);
  vi.mocked(findReminderCandidates).mockResolvedValue([{ id: "replacement", title: "Dentist", mine: true, recurring: false, dueAt: null }]);
  const second = await executePlan(plan, { confirmed: true, focus, referenceDate: date, consent: { action: consent } });
  expect(second.steps[0].status).toBe("blocked"); expect(safeFetch).not.toHaveBeenCalled();
});
it("resolves an expense's real amount/account/currency, then requests fresh consent when the draft changes", async () => {
  let amount = 12.5;
  const calls: string[] = [];
  vi.mocked(safeFetch).mockImplementation(async (url, init) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    return Response.json({ drafts: [{ id: "draft", amount, description: "Fuel", category_id: null, subcategory_id: null, account_id: "wallet", date: "2026-10-11", accounts: { name: "Wallet", currency: "USD" } }] });
  });
  const plan = one("draft.confirm", { hint: "Fuel" });
  const first = await executePlan(plan, { confirmed: true, referenceDate: date });
  const consent = effectiveActionSchema.parse(first.steps[0].result.metadata!.effectiveAction);
  expect(consent.values).toMatchObject({ amount: 12.5, currency: "USD", account: "Wallet" });
  amount = 125;
  const second = await executePlan(plan, { confirmed: true, referenceDate: date, consent: { action: consent } });
  expect(second.steps[0].status).toBe("pending"); expect(calls.every(c => c.startsWith("GET"))).toBe(true);
  expect(effectiveActionSchema.parse(second.steps[0].result.metadata!.effectiveAction).values.amount).toBe(125);
});
it("rejects ambiguous meal recipes before mutation; previews actual recipe, date, default lunch and replacement effect", async () => {
  let recipes = [{ id: "one", name: "Chicken stew" }, { id: "two", name: "Chicken rice" }];
  vi.mocked(safeFetch).mockImplementation(async () => Response.json(recipes));
  const plan = one("meal.assign", { dish: "Chicken", dayHint: "Friday" });
  const first = await executePlan(plan, { confirmed: true, referenceDate: date });
  expect(first.steps[0].result.text).toContain("Which recipe?");
  recipes = [{ id: "one", name: "Chicken stew" }];
  const second = await executePlan(plan, { confirmed: true, referenceDate: date });
  expect(effectiveActionSchema.parse(second.steps[0].result.metadata!.effectiveAction).values).toMatchObject({ recipe_id: "one", dish: "Chicken stew", meal_type: "lunch", effect: "Replace occupied slot / Both" });
  expect(vi.mocked(safeFetch).mock.calls.every(([url]) => !String(url).includes("limit=1"))).toBe(true);
});
it("journal persists late consent across reload and never auto-confirms it on Resume", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  let state = initialRun({ id, conversationId: id, plan: one("shopping.add", { items: ["Milk"] }), sourceText: "Add milk", text: "Confirm", referenceDate: date.toISOString(), timeZone: "Asia/Beirut", focus: null });
  state = transition(state, { type: "confirm" }, Date.now());
  state = transition(state, { type: "begin", stepId: "action", attemptId: id }, Date.now());
  state = transition(state, { type: "finish", stepId: "action", attemptId: id, result: { text: "Confirm the effective action.", ok: false, metadata: { notDispatched: true, effectiveAction: { capabilityId: "shopping.add", values: { items: ["Milk"], threadId: "list" } } } } }, Date.now());
  state = JSON.parse(JSON.stringify(state));
  expect(runStatus(state)).toBe("awaiting_confirm");
  expect(() => transition(state, { type: "begin", stepId: "action", attemptId: id }, Date.now())).toThrow();
  state = transition(state, { type: "confirm" }, Date.now());
  expect(runStatus(state)).toBe("queued");
  state = transition(state, { type: "begin", stepId: "action", attemptId: id }, Date.now());
  state = transition(state, { type: "finish", stepId: "action", attemptId: id, result: { text: "Added", artifacts: [{ entity: "shopping_item", action: "created", id, title: "Milk" }] } }, Date.now());
  expect(runStatus(state)).toBe("done");
});
it("distinguishes a complete goal, known partial goal, rolled-back failure and unknown write", async () => {
  const plan: EraPlan = { steps: [...one("memory.save", { label: "WiFi", value: "password" }).steps,
    { id: "remind", capabilityId: "reminder.create", label: "Done", slots: { rawText: "Call bank tomorrow" } }] };
  vi.spyOn(ERA_CAPABILITIES["memory.save"], "execute").mockResolvedValue({ text: "Saved", artifacts: [{ entity: "memory", action: "created", id: "note", title: "WiFi" }] });
  const write = vi.spyOn(ERA_CAPABILITIES["reminder.create"], "execute").mockResolvedValue({ text: "Not saved", ok: false, metadata: { completion: "failed" } });
  expect(planOutcome(plan, await executePlan(plan, { confirmed: true, referenceDate: date })).status).toBe("partial");
  expect(planOutcome({ steps: [plan.steps[1]] }, await executePlan({ steps: [plan.steps[1]] }, { confirmed: true, referenceDate: date })).status).toBe("failed");
  write.mockResolvedValue({ text: "Check app", ok: false });
  expect(planOutcome(plan, await executePlan(plan, { confirmed: true, referenceDate: date })).status).toBe("uncertain");
  write.mockResolvedValue({ text: "Created", artifacts: [{ entity: "reminder", action: "created", id: "reminder", title: "Call bank" }] });
  expect(planOutcome(plan, await executePlan(plan, { confirmed: true, referenceDate: date })).status).toBe("done");
});
