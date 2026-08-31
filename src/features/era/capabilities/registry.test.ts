// Behavior lock for the ERA Stage 1 capability registry — the catalog Ask AI
// (Stage 3) will eventually validate structured proposals against. Not
// exercised by the deterministic router (which calls the resolvers
// directly), so this pins the registry's own contract: every entry has a
// unique id matching its key, and its slots schema actually accepts/rejects
// what it claims to.
import { describe, expect, it } from "vitest";
import { ERA_CAPABILITIES, entityFace, getCapability } from "./registry";

describe("ERA_CAPABILITIES", () => {
  it("every entry's id matches its registry key", () => {
    for (const [key, capability] of Object.entries(ERA_CAPABILITIES)) {
      expect(capability.id).toBe(key);
    }
  });

  it("includes the Stage 1 core set plus Stage D's widened registry", () => {
    expect(Object.keys(ERA_CAPABILITIES).sort()).toEqual(
      [
        // Stage 1
        "reminder.complete",
        "reminder.create",
        "reminder.delete",
        "reminder.reschedule",
        "schedule.forDay",
        // Stage D — deliberately NOT transaction.draft; see registry.ts's
        // Stage D comment for why (needs a React-bound hook, not a slot).
        "spend.month",
        "draft.list",
        "draft.confirm",
        "recipe.search",
        "recipe.list",
        "meal.assign",
        "memory.save",
        "memory.recall",
      ].sort(),
    );
  });

  it("marks reminder.delete as destructive and everything else as not", () => {
    for (const capability of Object.values(ERA_CAPABILITIES)) {
      expect(Boolean(capability.destructive)).toBe(capability.id === "reminder.delete");
    }
  });

  it("getCapability resolves a known id and returns undefined for an unknown one", () => {
    expect(getCapability("reminder.reschedule")?.id).toBe("reminder.reschedule");
    expect(getCapability("reminder.teleport")).toBeUndefined();
  });

  it("reminder.reschedule's slots reject a missing itemId", () => {
    const result = ERA_CAPABILITIES["reminder.reschedule"].slots.safeParse({
      whenText: "11",
    });
    expect(result.success).toBe(false);
  });

  it("reminder.reschedule's slots accept a well-formed proposal", () => {
    const result = ERA_CAPABILITIES["reminder.reschedule"].slots.safeParse({
      itemId: "item-1",
      whenText: "11",
      title: "Water the plants",
    });
    expect(result.success).toBe(true);
  });

  it("schedule.forDay rejects a malformed date", () => {
    const result = ERA_CAPABILITIES["schedule.forDay"].slots.safeParse({
      dateISO: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("schedule.forDay's dateISO is optional (today)", () => {
    const result = ERA_CAPABILITIES["schedule.forDay"].slots.safeParse({});
    expect(result.success).toBe(true);
  });

  // HUB-29 — every capability must document itself for Ask AI's prompt.
  it("every entry has a non-empty promptSlots description", () => {
    for (const capability of Object.values(ERA_CAPABILITIES)) {
      expect(capability.promptSlots.length).toBeGreaterThan(0);
    }
  });

  // HUB-29/30 — exactly the capabilities that ACT ON one specific existing
  // reminder declare an entityRefSlot; create/read never do (they don't
  // identify an existing entity).
  it("marks entityRefSlot only on capabilities that act on a specific existing entity", () => {
    const withRef = ["reminder.reschedule", "reminder.complete", "reminder.delete"];
    for (const capability of Object.values(ERA_CAPABILITIES)) {
      if (withRef.includes(capability.id)) {
        expect(capability.entityRefSlot).toBe("itemId");
      } else {
        expect(capability.entityRefSlot).toBeUndefined();
      }
    }
  });

  it("entityFace maps every registered entity to its owning face", () => {
    expect(entityFace("reminder")).toBe("schedule");
    expect(entityFace("schedule")).toBe("schedule");
    expect(entityFace("transaction")).toBe("budget");
    expect(entityFace("recipe")).toBe("chef");
    expect(entityFace("meal")).toBe("chef");
    expect(entityFace("memory")).toBe("brain");
  });

  // Stage D — the zero-slot capabilities (draft.list, recipe.list) must
  // still accept an empty slots object, the same as schedule.forDay's
  // optional dateISO already does.
  it("zero-slot capabilities accept an empty slots object", () => {
    expect(ERA_CAPABILITIES["draft.list"].slots.safeParse({}).success).toBe(true);
    expect(ERA_CAPABILITIES["recipe.list"].slots.safeParse({}).success).toBe(true);
  });

  it("spend.month rejects a missing scope but accepts a well-formed one", () => {
    expect(ERA_CAPABILITIES["spend.month"].slots.safeParse({}).success).toBe(false);
    expect(
      ERA_CAPABILITIES["spend.month"].slots.safeParse({ scope: "household" }).success,
    ).toBe(true);
  });

  it("meal.assign requires dish and dayHint but not mealType", () => {
    expect(ERA_CAPABILITIES["meal.assign"].slots.safeParse({ dish: "pasta" }).success).toBe(
      false,
    );
    expect(
      ERA_CAPABILITIES["meal.assign"].slots.safeParse({ dish: "pasta", dayHint: "Friday" })
        .success,
    ).toBe(true);
  });

  it("memory.save requires both label and value", () => {
    expect(
      ERA_CAPABILITIES["memory.save"].slots.safeParse({ label: "wifi password" }).success,
    ).toBe(false);
    expect(
      ERA_CAPABILITIES["memory.save"].slots.safeParse({
        label: "wifi password",
        value: "hunter2",
      }).success,
    ).toBe(true);
  });
});
