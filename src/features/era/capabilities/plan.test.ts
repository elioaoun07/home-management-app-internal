import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  executePlan,
  needsAgentPlan,
  planAllowedForRequest,
  planOutcome,
  validatePlan,
  type EraPlan,
} from "./plan";
import { ERA_CAPABILITIES } from "./registry";

const recipePlan = (): EraPlan => ({
  steps: [
    {
      id: "recipe",
      label: "Find chicken recipe",
      capabilityId: "recipe.ingredients",
      slots: { dish: "Chicken" },
    },
    {
      id: "meal",
      label: "Plan Friday dinner",
      capabilityId: "meal.assign",
      slots: {
        dish: { step: "recipe", field: "recipeName" },
        dayHint: "Friday",
        mealType: "dinner",
      },
    },
    {
      id: "shopping",
      label: "Add ingredients",
      capabilityId: "shopping.add",
      slots: { items: { step: "recipe", field: "ingredients" } },
    },
  ],
});

beforeEach(() => vi.restoreAllMocks());
describe("ERA agent plan admission", () => {
  it("admits a recipe → meal + shopping dependency chain", () => {
    expect(validatePlan(recipePlan())).toEqual(recipePlan());
  });
  it.each(["unknown", "constructor", "__proto__"])(
    "rejects invented capability %s",
    (id) => {
      expect(
        validatePlan({
          steps: [{ ...recipePlan().steps[0], capabilityId: id }],
        }),
      ).toBeNull();
    },
  );
  it("rejects the entire plan if even the last step is invalid", () => {
    const p = recipePlan();
    p.steps[2].slots = { items: [] };
    expect(validatePlan(p)).toBeNull();
  });
  it("rejects forward references, wrong types, undeclared fields and duplicate IDs", () => {
    const p = recipePlan();
    p.steps.reverse();
    expect(validatePlan(p)).toBeNull();
    const q = recipePlan();
    q.steps[2].slots.items = { step: "recipe", field: "recipeName" };
    expect(validatePlan(q)).toBeNull();
    const r = recipePlan();
    r.steps[2].slots.items = { step: "recipe", field: "invented" };
    expect(validatePlan(r)).toBeNull();
    const s = recipePlan();
    s.steps[2].id = "recipe";
    expect(validatePlan(s)).toBeNull();
  });
  it("rejects raw entity IDs and cross-domain entity references", () => {
    const step = {
      id: "edit",
      label: "Move reminder",
      capabilityId: "reminder.reschedule",
      slots: { itemId: "invented-id", whenText: "Friday" },
    };
    expect(validatePlan({ steps: [step] })).toBeNull();
    expect(
      validatePlan({
        steps: [
          recipePlan().steps[0],
          {
            ...step,
            slots: {
              ...step.slots,
              itemId: { step: "recipe", field: "recipeName" },
            },
          },
        ],
      }),
    ).toBeNull();
  });
  it("rejects inherited output names even when the target slot is optional", () => {
    expect(
      validatePlan({
        steps: [
          recipePlan().steps[0],
          {
            id: "remind",
            label: "Reminder",
            capabilityId: "reminder.create",
            slots: {
              rawText: "remind me tomorrow",
              title: { step: "recipe", field: "toString" },
            },
          },
        ],
      }),
    ).toBeNull();
  });
  it("rejects unknown slots and more than six steps", () => {
    expect(
      validatePlan({
        steps: [
          {
            ...recipePlan().steps[0],
            slots: { dish: "Chicken", url: "/api/admin" },
          },
        ],
      }),
    ).toBeNull();
    expect(
      validatePlan({
        steps: Array.from({ length: 7 }, (_, i) => ({
          ...recipePlan().steps[0],
          id: `s${i}`,
        })),
      }),
    ).toBeNull();
  });
  it.each([
    "Don't plan chicken and add ingredients",
    "What if I plan chicken and add ingredients?",
    "Rita said plan chicken and add ingredients",
    "If we're home, plan chicken and add ingredients",
  ])("blocks unrequested writes: %s", (text) => {
    expect(planAllowedForRequest(recipePlan(), text)).toBe(false);
  });
  it("allows polite commands and read-only questions", () => {
    expect(
      planAllowedForRequest(
        recipePlan(),
        "Can you plan chicken and add its ingredients?",
      ),
    ).toBe(true);
    expect(
      planAllowedForRequest(
        { steps: [recipePlan().steps[0]] },
        "What ingredients does chicken need?",
      ),
    ).toBe(true);
  });
  it("uses the strict money gate for a conditional draft confirmation", () => {
    const plan = { steps: [{ id: "confirm", label: "Confirm draft", capabilityId: "draft.confirm", slots: {} }] };
    expect(planAllowedForRequest(plan, "Confirm the latest draft if the salary lands")).toBe(false);
    expect(planAllowedForRequest(plan, "Confirm the latest draft")).toBe(true);
  });
});

describe("ERA agent execution", () => {
  it("a resumed recipe receipt with incompatible shopping data cannot dispatch the intervening meal", async () => {
    const meal = vi.spyOn(ERA_CAPABILITIES["meal.assign"], "execute");
    const beforeStep = vi.fn();
    const onStep = vi.fn();
    const run = await executePlan(recipePlan(), { confirmed: true, beforeStep, onStep, resume: [{
      id: "recipe", capabilityId: "recipe.ingredients", status: "done",
      result: { text: "Chicken", metadata: { recipeName: "Chicken", ingredients: [] } },
    }] });
    expect(run.steps.map((step) => step.status)).toEqual(["done", "blocked"]);
    expect(meal).not.toHaveBeenCalled();
    expect(beforeStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith(expect.objectContaining({ status: "blocked" }));
  });

  it("invalid ingredients stop the recipe workflow before an intervening meal write", async () => {
    vi.spyOn(ERA_CAPABILITIES["recipe.ingredients"], "execute").mockResolvedValue({
      text: "Chicken", metadata: { recipeName: "Chicken", ingredients: [] },
    });
    const meal = vi.spyOn(ERA_CAPABILITIES["meal.assign"], "execute");
    const shopping = vi.spyOn(ERA_CAPABILITIES["shopping.add"], "execute");
    const run = await executePlan(recipePlan(), { confirmed: true });
    expect(run.status).toBe("stopped");
    expect(run.steps[0].status).toBe("blocked");
    expect(meal).not.toHaveBeenCalled();
    expect(shopping).not.toHaveBeenCalled();
  });

  it("checks actual outputs against every receiving slot, not just example compatibility", async () => {
    vi.spyOn(ERA_CAPABILITIES["recipe.ingredients"], "execute").mockResolvedValue({
      text: "Chicken", metadata: { recipeName: "Chicken", ingredients: ["x".repeat(201)] },
    });
    const meal = vi.spyOn(ERA_CAPABILITIES["meal.assign"], "execute");
    const run = await executePlan(recipePlan(), { confirmed: true });
    expect(run.status).toBe("stopped");
    expect(meal).not.toHaveBeenCalled();
  });

  function mocks() {
    const read = vi
      .spyOn(ERA_CAPABILITIES["recipe.ingredients"], "execute")
      .mockResolvedValue({
        text: "Chicken",
        ok: true,
        metadata: {
          recipeName: "Orange Chicken",
          ingredients: ["500 g chicken", "2 oranges"],
        },
      });
    const meal = vi
      .spyOn(ERA_CAPABILITIES["meal.assign"], "execute")
      .mockResolvedValue({
        text: "Dinner planned",
        ok: true,
        artifacts: [
          {
            entity: "meal_plan",
            action: "created",
            id: "meal-id",
            title: "Chicken",
          },
        ],
      });
    const shopping = vi
      .spyOn(ERA_CAPABILITIES["shopping.add"], "execute")
      .mockResolvedValue({
        text: "Ingredients added",
        ok: true,
        artifacts: [
          {
            entity: "shopping_item",
            action: "created",
            id: "shopping-id",
            title: "Chicken",
          },
        ],
      });
    return { read, meal, shopping };
  }
  it("writes nothing before Confirm", async () => {
    const m = mocks();
    const run = await executePlan(recipePlan(), { confirmed: false });
    expect(run.status).toBe("stopped");
    expect(m.read).not.toHaveBeenCalled();
    expect(m.meal).not.toHaveBeenCalled();
  });
  it("passes application outputs to dependents, in order", async () => {
    const m = mocks();
    const onStep = vi.fn();
    const run = await executePlan(recipePlan(), { confirmed: true, onStep });
    expect(run.status).toBe("done");
    expect(m.meal).toHaveBeenCalledWith({
      dish: "Orange Chicken",
      dayHint: "Friday",
      mealType: "dinner",
    });
    expect(m.shopping).toHaveBeenCalledWith({
      items: ["500 g chicken", "2 oranges"],
    });
    expect(onStep).toHaveBeenCalledTimes(3);
    expect(m.read.mock.invocationCallOrder[0]).toBeLessThan(
      m.meal.mock.invocationCallOrder[0],
    );
  });
  it("stops on an ambiguous/missing read without executing writes", async () => {
    const m = mocks();
    m.read.mockResolvedValue({ text: "Which chicken recipe?", ok: false });
    const run = await executePlan(recipePlan(), { confirmed: true });
    expect(run.steps[0].status).toBe("blocked");
    expect(m.meal).not.toHaveBeenCalled();
    expect(m.shopping).not.toHaveBeenCalled();
  });
  it("validates actual dependency data, not the model's example", async () => {
    const m = mocks();
    m.read.mockResolvedValue({
      text: "Chicken",
      metadata: { recipeName: "Chicken", ingredients: [] },
    });
    const run = await executePlan(recipePlan(), { confirmed: true });
    expect(run.status).toBe("stopped");
    expect(m.shopping).not.toHaveBeenCalled();
  });
  it("preserves partial artifacts and does not retry or execute later steps", async () => {
    const m = mocks();
    m.meal.mockResolvedValue({
      text: "Meal request could not be verified",
      ok: false,
      artifacts: [
        {
          entity: "meal_plan",
          action: "created",
          id: "meal-id",
          title: "Chicken",
        },
      ],
    });
    const onStep = vi.fn();
    const run = await executePlan(recipePlan(), { confirmed: true, onStep });
    expect(run.steps[1].status).toBe("uncertain");
    expect(run.steps[1].result.artifacts).toHaveLength(1);
    expect(m.meal).toHaveBeenCalledTimes(1);
    expect(m.shopping).not.toHaveBeenCalled();
    expect(onStep).toHaveBeenCalledTimes(2);
    expect(planOutcome(recipePlan(), run)).toMatchObject({
      status: "uncertain",
      entityIds: ["meal-id"],
      inverse: null,
    });
  });
  it("rejects changed/expired focus on confirmation", async () => {
    const focus = {
      id: "dentist-id",
      title: "Dentist",
      type: "reminder" as const,
      addedAt: Date.now(),
    };
    const plan = validatePlan(
      {
        steps: [
          {
            id: "edit",
            label: "Move it",
            capabilityId: "reminder.reschedule",
            slots: { itemId: "FOCUS", whenText: "Friday" },
          },
        ],
      },
      focus,
    )!;
    const edit = vi.spyOn(ERA_CAPABILITIES["reminder.reschedule"], "execute");
    expect(
      (
        await executePlan(plan, {
          confirmed: true,
          focus: { ...focus, id: "bank-id" },
        })
      ).status,
    ).toBe("stopped");
    expect(edit).not.toHaveBeenCalled();
    expect(
      (
        await executePlan(plan, {
          confirmed: true,
          focus: { ...focus, addedAt: 0 },
        })
      ).status,
    ).toBe("stopped");
  });
});

describe("compound request routing", () => {
  it.each([
    "Plan orange chicken for Friday dinner and add its ingredients to shopping",
    "Find my dentist reminder then move it to Friday at 5",
    "Add milk to shopping and remind me to collect it tomorrow at 5",
    "Show my shopping list and tell me what's on my schedule today",
  ])("uses the agent for every part: %s", (text) =>
    expect(needsAgentPlan(text)).toBe(true),
  );
  it.each([
    "Add milk and eggs to shopping",
    "Remind me to call the bank tomorrow",
    "What is my spending?",
  ])("keeps the existing fast path: %s", (text) =>
    expect(needsAgentPlan(text)).toBe(false),
  );
});
