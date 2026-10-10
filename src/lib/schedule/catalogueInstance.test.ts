import { describe, expect, it } from "vitest";
import type { CatalogueItem } from "@/types/catalogue";
import { buildTemplateInstanceInput } from "./catalogueInstance";

const tpl = (over: Partial<CatalogueItem> = {}) =>
  ({
    id: "t1",
    name: "Tidy & Organize",
    item_type: "task",
    priority: "normal",
    is_public: true,
    is_chore: true,
    subtasks_text: "- Generic step",
    ...over,
  }) as CatalogueItem;

const titles = (input: ReturnType<typeof buildTemplateInstanceInput>) =>
  (input.subtasks ?? []).map((s) => s.title);

describe("buildTemplateInstanceInput room checklist", () => {
  const room = { id: "r1", name: "Master Bedroom" };

  it("uses the room's checklist instead of the template's", () => {
    const input = buildTemplateInstanceInput(
      tpl({ room_config: { r1: { checklist: "- Organize dresser\n- Organize wardrobes" } } }),
      "2026-10-12T09:00:00Z",
      undefined,
      { room },
    );
    expect(input.title).toBe("Tidy & Organize · Master Bedroom");
    expect(titles(input)).toEqual(["Organize dresser", "Organize wardrobes"]);
  });

  it("falls back to the template checklist when the room has none", () => {
    const input = buildTemplateInstanceInput(
      tpl({ room_config: { r1: { checklist: "  " } } }),
      "2026-10-12T09:00:00Z",
      undefined,
      { room },
    );
    expect(titles(input)).toEqual(["Generic step"]);
  });

  it("uses the room's minutes, else the template's", () => {
    const t = tpl({
      preferred_duration_minutes: 10,
      room_config: { r1: { minutes: 25 } },
    });
    const run = (r: { id: string; name: string }) =>
      buildTemplateInstanceInput(t, "2026-10-12T09:00:00Z", undefined, { room: r }).estimate_minutes;
    expect(run(room)).toBe(25);
    expect(run({ id: "r2", name: "Salon" })).toBe(10);
  });

  it("ignores room_config without a room", () => {
    const input = buildTemplateInstanceInput(
      tpl({ room_config: { r1: { checklist: "- X" } } }),
      "2026-10-12T09:00:00Z",
      undefined,
    );
    expect(titles(input)).toEqual(["Generic step"]);
  });
});
