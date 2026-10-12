// Real Ask AI admission + real application adapters against isolated route
// fixtures. Deliberate edge-case replies and recorded live-model plans both
// execute here; no test connects to production data.
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { executePlan, needsAgentPlan } from "@/features/era/capabilities/plan";
import { applyCapabilityResult } from "@/features/era/capabilities/applyResult";
import { useEraStore } from "@/features/era/useEraStore";
import {
  generateAskAIResponse,
  parseAskAIResponse,
  buildSystemPrompt,
} from "@/lib/ai/eraAskProposal";

const model = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/anthropic", async (original) => ({
  ...(await original<typeof import("@/lib/ai/anthropic")>()),
  generateClaudeJson: model,
}));
vi.mock("@/lib/connectivityManager", () => ({
  isReallyOnline: () => true,
  markOffline: () => {},
  probeNow: () => Promise.resolve(),
}));
const candidates = vi.hoisted(() => ({
  items: [
    {
      id: "dentist-id",
      title: "Dentist",
      user_id: "owner",
      status: "pending",
      reminder_details: { due_at: "2026-10-12T09:00:00Z" },
    },
  ],
}));
vi.mock("@/features/items/useItems", () => ({
  fetchItems: async () => candidates.items,
}));
vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: { due_at: "2026-10-12T09:00:00Z" } }),
      };
      return chain;
    },
  }),
}));

interface Call {
  url: string;
  method: string;
  body?: Record<string, unknown>;
}
const calls: Call[] = [];
let failShoppingAt = -1;
let shoppingFailure: "http" | "network" = "http";
let shoppingCount = 0;
let ambiguousRecipe = false;
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "isolated-model-fixture");
  calls.length = 0;
  failShoppingAt = -1;
  shoppingFailure = "http";
  shoppingCount = 0;
  ambiguousRecipe = false;
  candidates.items = [
    {
      id: "dentist-id",
      title: "Dentist",
      user_id: "owner",
      status: "pending",
      reminder_details: { due_at: "2026-10-12T09:00:00Z" },
    },
  ];
  useEraStore.getState().reset();
  model.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input),
        method = init?.method ?? "GET";
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : undefined;
      calls.push({ url, method, body });
      if (url === "/api/recipes" || url.startsWith("/api/recipes?"))
        return json(
          ambiguousRecipe
            ? [
                { id: "r1", name: "Orange chicken" },
                { id: "r2", name: "Chicken soup" },
              ]
            : [{ id: "r1", name: "Orange Chicken" }],
        );
      if (url === "/api/recipes/r1")
        return json({
          id: "r1",
          name: "Orange Chicken",
          ingredients: [
            { name: "chicken", quantity: "500", unit: "g" },
            { name: "oranges", quantity: "2", unit: "" },
          ],
        });
      if (url === "/api/meal-plans" && method === "POST")
        return json({ id: "meal-1" });
      if (url === "/api/hub/threads")
        return json({
          threads: [
            { id: "shopping-thread", purpose: "shopping", is_private: false },
          ],
        });
      if (url === "/api/hub/messages" && method === "POST") {
        shoppingCount++;
        if (shoppingCount === failShoppingAt && shoppingFailure === "network")
          throw new TypeError("Failed to fetch");
        return shoppingCount === failShoppingAt
          ? json({ error: "Unavailable" }, 503)
          : json({ message: { id: `shopping-${shoppingCount}` } });
      }
      if (url === "/api/items" && method === "POST")
        return json({ item: { id: "reminder-1" }, completion: { status: "complete" } });
      if (url === "/api/items/dentist-id" && method === "PATCH")
        return json({ item: { id: "dentist-id" } });
      if (url === "/api/era/actions" && method === "POST")
        return json({ ok: true });
      if (url.startsWith("/api/memories?") && method === "GET")
        return json([{ label: "Guest WiFi", value: "guest-network-123" }]);
      if (url === "/api/memories" && method === "POST")
        return json({ id: "f360251d-4e26-4a43-b40c-a3c776af4daa" });
      throw new Error(`Unexpected route: ${method} ${url}`);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function reply(steps: unknown[]) {
  return JSON.stringify({
    kind: "propose_plan",
    text: "Plan dinner and add ingredients",
    planJson: JSON.stringify({ steps }),
  });
}
const recipeSteps = () => [
  {
    id: "recipe",
    capabilityId: "recipe.ingredients",
    label: "Find chicken recipe",
    slots: { dish: "Chicken" },
  },
  {
    id: "meal",
    capabilityId: "meal.assign",
    label: "Plan Friday dinner",
    slots: {
      dish: { step: "recipe", field: "recipeName" },
      dayHint: "Friday",
      mealType: "dinner",
    },
  },
  {
    id: "shopping",
    capabilityId: "shopping.add",
    label: "Add ingredients",
    slots: { items: { step: "recipe", field: "ingredients" } },
  },
];

const liveRecordings: { entries: Record<string, { raw: string }> } = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "recordings", "agent-responses.json"),
    "utf8",
  ),
);

describe("live-model plans through real source adapters", () => {
  it.each([
    ["recipe-meal-shopping", ["meal_plan", "shopping_item", "shopping_item"]],
    ["named-reminder", ["reminder"]],
    ["shopping-reminder", ["shopping_item", "reminder"]],
    ["recipe-shopping-implicit", ["shopping_item", "shopping_item"]],
  ])("%s completes with real source receipts", async (id, entities) => {
    const response = parseAskAIResponse(
      liveRecordings.entries[id as string].raw,
    );
    if (response?.kind !== "propose_plan")
      throw new Error("Expected live plan");
    const run = await executePlan(response.plan, { confirmed: true });
    expect(run.status).toBe("done");
    const artifacts = run.steps.flatMap((s) => s.result.artifacts ?? []);
    expect(artifacts.map((a) => a.entity)).toEqual(entities);
    if (id === "named-reminder") {
      expect(artifacts[0].title).toBe("Dentist");
      expect(calls.find((c) => c.method === "PATCH")?.url).toBe(
        "/api/items/dentist-id",
      );
    }
    if (String(id).startsWith("recipe-")) {
      expect(
        calls
          .filter((c) => c.url === "/api/hub/messages")
          .map((c) => c.body?.content),
      ).toEqual(["500 g chicken", "2 oranges"]);
    }
  });
});

describe("realistic ERA agent requests", () => {
  it("Show what ERA can do in Trips and list my recipes — awareness plus a real read", async () => {
    const response = parseAskAIResponse(reply([
      { id: "reach", capabilityId: "app.capabilities", label: "Trips capabilities", slots: { query: "trips" } },
      { id: "recipes", capabilityId: "recipe.list", label: "Saved recipes", slots: {} },
    ]));
    if (response?.kind !== "propose_plan") throw new Error("Expected plan");
    const run = await executePlan(response.plan, { confirmed: false });
    expect(run.status).toBe("done");
    expect(run.text).toContain("/trips");
    expect(run.text).toContain("Orange Chicken");
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("Recall guest WiFi then save a copy as Visitor WiFi — bind source data after Confirm", async () => {
    const response = parseAskAIResponse(reply([
      { id: "recall", capabilityId: "memory.recall", label: "Recall guest WiFi", slots: { query: "Guest WiFi" } },
      { id: "copy", capabilityId: "memory.save", label: "Save Visitor WiFi", slots: {
        label: "Visitor WiFi", value: { step: "recall", field: "value" },
      } },
    ]), undefined, undefined, "Recall guest WiFi then save a copy as Visitor WiFi");
    if (response?.kind !== "propose_plan") throw new Error("Expected plan");
    expect((await executePlan(response.plan, { confirmed: false })).status).toBe("stopped");
    expect(calls).toHaveLength(0);
    const run = await executePlan(response.plan, { confirmed: true });
    expect(run.status).toBe("done");
    expect(calls.find((call) => call.method === "POST")?.body)
      .toEqual({ label: "Visitor WiFi", value: "guest-network-123" });
    expect(run.steps[1].result.artifacts?.[0].id).toBe("f360251d-4e26-4a43-b40c-a3c776af4daa");
  });

  it("discovers capabilities across faces from one authoritative catalog", () => {
    const prompt = buildSystemPrompt({
      face: "budget",
      localDate: "2026-10-10",
    });
    expect(prompt).toContain("shopping.add");
    expect(prompt).toContain("recipe.ingredients");
    expect(prompt).toContain("dependency outputs: recipeName, ingredients");
    expect(prompt).toContain("2026-10-10");
  });
  it("Plan chicken for Friday dinner and add its ingredients to shopping", async () => {
    const request =
      "Plan chicken for Friday dinner and add its ingredients to shopping";
    expect(needsAgentPlan(request)).toBe(true);
    model.mockResolvedValue({ text: reply(recipeSteps()) });
    const response = await generateAskAIResponse({
      face: "chef",
      message: request,
      localDate: "2026-10-10",
    });
    expect(response.kind).toBe("propose_plan");
    if (response.kind !== "propose_plan") throw new Error("Expected plan");
    expect(calls).toHaveLength(0); // inference only; never writes
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const run = await executePlan(response.plan, {
      confirmed: true,
      onStep: (s) => applyCapabilityResult(s.capabilityId, s.result, qc),
    });
    expect(run.status).toBe("done");
    expect(calls.find((c) => c.url === "/api/meal-plans")?.body).toMatchObject({
      recipe_id: "r1",
      meal_type: "dinner",
    });
    expect(
      calls
        .filter((c) => c.url === "/api/hub/messages")
        .map((c) => c.body?.content),
    ).toEqual(["500 g chicken", "2 oranges"]);
    expect(
      run.steps.flatMap((s) => s.result.artifacts ?? []).map((a) => a.entity),
    ).toEqual(["meal_plan", "shopping_item", "shopping_item"]);
    expect(calls.filter((c) => c.url === "/api/era/actions")).toHaveLength(2);
    expect(invalidate.mock.calls.map(([arg]) => arg?.queryKey)).toContainEqual([
      "meal-plans",
    ]);
    expect(invalidate.mock.calls.map(([arg]) => arg?.queryKey)).toContainEqual([
      "hub",
      "messages",
      "shopping-thread",
    ]);
  });
  it("Find my dentist reminder then move it to Friday at 5", async () => {
    const request = "Find my dentist reminder then move it to Friday at 5";
    const response = parseAskAIResponse(
      reply([
        {
          id: "lookup",
          label: "Find dentist",
          capabilityId: "reminder.find",
          slots: { hint: "Dentist" },
        },
        {
          id: "move",
          label: "Move to Friday",
          capabilityId: "reminder.reschedule",
          slots: {
            itemId: { step: "lookup", field: "itemId" },
            title: { step: "lookup", field: "title" },
            whenText: "Friday at 5pm",
          },
        },
      ]),
      undefined,
      undefined,
      request,
    );
    if (response?.kind !== "propose_plan") throw new Error("Expected plan");
    const run = await executePlan(response.plan, { confirmed: true });
    expect(run.status).toBe("done");
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
    expect(calls.find((c) => c.method === "PATCH")?.url).toBe(
      "/api/items/dentist-id",
    );
    expect(calls.find((c) => c.method === "PATCH")?.body?.due_at).toMatch(/Z$/);
  });
  it("Add milk to shopping and remind me to collect it tomorrow at 5", async () => {
    const request =
      "Add milk to shopping and remind me to collect it tomorrow at 5";
    const response = parseAskAIResponse(
      reply([
        {
          id: "shopping",
          label: "Add milk",
          capabilityId: "shopping.add",
          slots: { items: ["Milk"] },
        },
        {
          id: "reminder",
          label: "Remind tomorrow",
          capabilityId: "reminder.create",
          slots: {
            rawText: "Remind me to collect milk tomorrow at 5pm",
            title: "Collect milk",
          },
        },
      ]),
      undefined,
      undefined,
      request,
    );
    if (response?.kind !== "propose_plan") throw new Error("Expected plan");
    const run = await executePlan(response.plan, { confirmed: true });
    expect(run.status).toBe("done");
    expect(calls.find((c) => c.url === "/api/items")?.body).toMatchObject({
      type: "reminder",
      title: "Collect milk",
    });
    expect(
      run.steps.flatMap((s) => s.result.artifacts ?? []).map((a) => a.entity),
    ).toEqual(["shopping_item", "reminder"]);
  });
  it("stops an ambiguous recipe lookup before any mutation", async () => {
    ambiguousRecipe = true;
    const response = parseAskAIResponse(reply(recipeSteps()));
    if (response?.kind !== "propose_plan") throw new Error("Expected plan");
    expect((await executePlan(response.plan, { confirmed: true })).status).toBe(
      "stopped",
    );
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });
  it.each(["http", "network"] as const)(
    "preserves the meal and shopping receipts on a later %s failure",
    async (failure) => {
      failShoppingAt = 2;
      shoppingFailure = failure;
      const response = parseAskAIResponse(reply(recipeSteps()));
      if (response?.kind !== "propose_plan") throw new Error("Expected plan");
      const qc = new QueryClient();
      const run = await executePlan(response.plan, {
        confirmed: true,
        onStep: (s) => applyCapabilityResult(s.capabilityId, s.result, qc),
      });
      expect(run.status).toBe("stopped");
      expect(run.steps[2].status).toBe("uncertain");
      expect(run.steps[2].result.artifacts).toHaveLength(1);
      expect(calls.filter((c) => c.url === "/api/era/actions")).toHaveLength(2);
      expect(shoppingCount).toBe(2); // never retried
    },
  );
});
