import { QueryClient } from "@tanstack/react-query";
import { mealPlanKeys } from "@/features/meal-planning/queryKeys";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeFetch } from "@/lib/safeFetch";
import { ERA_CAPABILITIES } from "../capabilities/registry";
import { useEraStore } from "../useEraStore";
import { eraKeys } from "../queryKeys";
import {
  activateRun,
  cacheRun,
  executeRun,
  beginAnswer,
  finishAnswer,
} from "./client";
import { createRunSchema, initialRun, transition, type EraRun } from "./state";

vi.mock("@/lib/safeFetch", () => ({ safeFetch: vi.fn() }));
const owner = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const conv = "33333333-3333-4333-8333-333333333333";
const item = "44444444-4444-4444-8444-444444444444";
let qc: QueryClient;
let stored: EraRun;
let loseReceipt = false;
let refuseBegin = false;
function setup(plan: EraRun["state"]["plan"]) {
  const input = createRunSchema.parse({
    id,
    conversationId: conv,
    plan,
    sourceText: "Plan chicken then add ingredients",
    text: "Confirm",
    focus: null,
    referenceDate: new Date().toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  stored = {
    id,
    user_id: owner,
    conversation_id: conv,
    version: 0,
    created_at: input.referenceDate,
    updated_at: input.referenceDate,
    state: initialRun(input),
  };
  cacheRun(qc, stored);
  activateRun(stored);
  return structuredClone(stored);
}
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  useEraStore.getState().reset();
  useEraStore.setState({ explicitConversation: conv });
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(eraKeys.household(), { userId: owner });
  loseReceipt = refuseBegin = false;
  vi.mocked(safeFetch).mockImplementation(async (url, init) => {
    if (!String(url).startsWith("/api/era/runs/"))
      throw new Error(`Unexpected source: ${url}`);
    const { version, command } = JSON.parse(String(init?.body));
    if (version !== stored.version || (refuseBegin && command.type === "begin"))
      return new Response("Conflict", { status: 409 });
    stored = {
      ...stored,
      version: stored.version + 1,
      state: transition(stored.state, command, Date.now()),
    };
    if (loseReceipt && command.type === "finish")
      throw new Error("Response lost after commit");
    return Response.json(stored);
  });
});
const recipePlan = () => ({
  steps: [
    {
      id: "recipe",
      label: "Find recipe",
      capabilityId: "recipe.ingredients",
      slots: { dish: "Chicken" },
    },
    {
      id: "meal",
      label: "Friday dinner",
      capabilityId: "meal.assign",
      slots: {
        dish: { step: "recipe", field: "recipeName" },
        dayHint: "Friday",
      },
    },
    {
      id: "shopping",
      label: "Ingredients",
      capabilityId: "shopping.add",
      slots: { items: { step: "recipe", field: "ingredients" } },
    },
  ],
});
function adapters() {
  const read = vi
    .spyOn(ERA_CAPABILITIES["recipe.ingredients"], "execute")
    .mockResolvedValue({
      text: "Chicken",
      metadata: {
        recipeName: "Orange Chicken",
        ingredients: ["Chicken", "Orange"],
      },
    });
  const meal = vi
    .spyOn(ERA_CAPABILITIES["meal.assign"], "execute")
    .mockResolvedValue({
      text: "Planned",
      artifacts: [
        { entity: "meal_plan", action: "created", id: item, title: "Dinner" },
      ],
    });
  const shopping = vi
    .spyOn(ERA_CAPABILITIES["shopping.add"], "execute")
    .mockResolvedValue({
      text: "Added",
      artifacts: [
        {
          entity: "shopping_item",
          action: "created",
          id: item,
          title: "Chicken",
        },
      ],
    });
  return { read, meal, shopping };
}
describe("ERA interrupted plan integration", () => {
  it("refuses a changed time zone before resuming or answering a saved question", async () => {
    const run = setup(recipePlan());
    run.state.timeZone = "Invalid/Changed";
    await expect(executeRun(run, qc, true)).rejects.toThrow("time zone");
    await expect(beginAnswer(run, qc)).rejects.toThrow("time zone");
    expect(safeFetch).not.toHaveBeenCalled();
  });
  it("dispatches no source action when the durable begin is refused", async () => {
    const m = adapters();
    const run = setup(recipePlan());
    refuseBegin = true;
    await expect(executeRun(run, qc, true)).rejects.toThrow();
    expect(m.read).not.toHaveBeenCalled();
    expect(m.meal).not.toHaveBeenCalled();
  });
  it("resumes after a lost checkpoint response with original outputs and no repeated meal", async () => {
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const m = adapters();
    const run = setup(recipePlan());
    // Stop after the meal's receipt commits but its response never arrives.
    m.meal.mockImplementation(async () => {
      loseReceipt = true;
      return {
        text: "Planned",
        artifacts: [
          { entity: "meal_plan", action: "created", id: item, title: "Dinner" },
        ],
      };
    });
    await expect(executeRun(run, qc, true)).rejects.toThrow("Response lost");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: mealPlanKeys.all });
    expect(stored.state.steps.map((s) => s.status)).toEqual([
      "done",
      "done",
      "queued",
    ]);
    useEraStore.getState().reset(); // A completely new browser session.
    useEraStore.setState({ explicitConversation: conv });
    qc = new QueryClient();
    qc.setQueryData(eraKeys.household(), { userId: owner });
    loseReceipt = false;
    cacheRun(qc, stored);
    activateRun(stored);
    const result = await executeRun(structuredClone(stored), qc);
    expect(result?.status).toBe("done");
    expect(m.read).toHaveBeenCalledTimes(1);
    expect(m.meal).toHaveBeenCalledTimes(1);
    expect(m.shopping).toHaveBeenCalledWith(
      { items: ["Chicken", "Orange"] },
      expect.objectContaining({
        referenceDate: new Date(run.state.referenceDate),
      }),
    );
    expect(
      vi
        .mocked(safeFetch)
        .mock.calls.every(([url]) => !String(url).includes("/actions")),
    ).toBe(true);
  });
  it("two sessions confirming the same snapshot dispatch one plan", async () => {
    const m = adapters();
    const run = setup(recipePlan());
    const results = await Promise.allSettled([
      executeRun(run, qc, true),
      executeRun(structuredClone(run), qc, true),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(m.meal).toHaveBeenCalledTimes(1);
    expect(m.shopping).toHaveBeenCalledTimes(1);
  });
  it("a pending date answer completes its step and resumes the remaining action once", async () => {
    const pending = {
      kind: "draftReminder" as const,
      title: "Collect milk",
      priority: "normal" as const,
      rawText: "Collect milk",
      createdAt: Date.now(),
    };
    const reminder = vi
      .spyOn(ERA_CAPABILITIES["reminder.create"], "execute")
      .mockResolvedValue({ text: "When?", pending, ok: false });
    const shopping = vi
      .spyOn(ERA_CAPABILITIES["shopping.add"], "execute")
      .mockResolvedValue({
        text: "Added",
        artifacts: [
          {
            entity: "shopping_item",
            action: "created",
            id: item,
            title: "Milk",
          },
        ],
      });
    const run = setup({
      steps: [
        {
          id: "reminder",
          label: "Reminder",
          capabilityId: "reminder.create",
          slots: { rawText: "Collect milk" },
        },
        {
          id: "shopping",
          label: "Milk",
          capabilityId: "shopping.add",
          slots: { items: ["Milk"] },
        },
      ],
    });
    await executeRun(run, qc, true);
    expect(stored.state.steps.map((s) => s.status)).toEqual([
      "waiting",
      "queued",
    ]);
    expect(shopping).not.toHaveBeenCalled();
    useEraStore.getState().reset();
    useEraStore.setState({ explicitConversation: conv });
    activateRun(stored);
    expect(useEraStore.getState().pendingTurn).toEqual(pending);
    const answer = await beginAnswer(structuredClone(stored), qc);
    await finishAnswer(
      answer,
      {
        text: "Reminder set",
        metadata: { itemId: item, title: "Collect milk" },
        artifacts: [
          {
            entity: "reminder",
            action: "created",
            id: item,
            title: "Collect milk",
          },
        ],
      },
      qc,
    );
    await executeRun(structuredClone(stored), qc);
    expect(reminder).toHaveBeenCalledTimes(1);
    expect(shopping).toHaveBeenCalledTimes(1);
  });
  it("changing chats preserves a committed receipt and suspends later work", async () => {
    const m = adapters();
    m.meal.mockImplementation(async () => {
      useEraStore.getState().resetConversationContext();
      useEraStore.setState({ explicitConversation: null });
      return {
        text: "Planned",
        artifacts: [
          { entity: "meal_plan", action: "created", id: item, title: "Dinner" },
        ],
      };
    });
    const run = setup(recipePlan());
    await expect(executeRun(run, qc, true)).rejects.toThrow("suspended");
    expect(stored.state.steps[1].status).toBe("done");
    expect(m.shopping).not.toHaveBeenCalled();
    expect(useEraStore.getState().pendingTurn).toBeNull();
    expect(useEraStore.getState().eraReply).toBe("");
  });
  it("an owner switch cannot reuse the previous owner's confirmed progress", async () => {
    const m = adapters();
    const run = setup(recipePlan());
    qc.setQueryData(eraKeys.household(), { userId: item });
    await expect(executeRun(run, qc, true)).rejects.toThrow("suspended");
    expect(m.read).not.toHaveBeenCalled();
    expect(m.meal).not.toHaveBeenCalled();
  });
  it("expired unfinished focus becomes a durable block instead of an endless ready card", async () => {
    const m = vi.spyOn(ERA_CAPABILITIES["reminder.reschedule"], "execute");
    const run = setup({
      steps: [
        {
          id: "edit",
          label: "Move dentist",
          capabilityId: "reminder.reschedule",
          slots: { itemId: item, title: "Dentist", whenText: "tomorrow" },
        },
      ],
    });
    run.state.focus = {
      id: item,
      title: "Dentist",
      type: "reminder",
      addedAt: 0,
    };
    stored.state.focus = run.state.focus;
    await executeRun(run, qc, true);
    expect(stored.state.steps[0].status).toBe("blocked");
    expect(m).not.toHaveBeenCalled();
  });
});
