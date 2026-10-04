import { describe, expect, it } from "vitest";
import { ERA_ARTIFACT_ENTITY_KEYS, eraArtifact, eraArtifactHref, eraArtifactLabel, parseEraArtifacts } from "./artifacts";

const ID = "00000000-0000-4000-8000-000000000001";

describe("ERA artifact registry", () => {
  it("every entity has a label and an app-relative link for each verb", () => {
    for (const entity of ERA_ARTIFACT_ENTITY_KEYS) {
      expect(eraArtifactLabel(entity)).not.toBe("Item");
      for (const action of ["created", "updated", "deleted"] as const) {
        expect(eraArtifactHref(eraArtifact(entity, action, ID, "x"))).toMatch(/^\/[a-z]/);
      }
    }
  });

  it("opens the item, or the Recycle Bin once it is deleted", () => {
    expect(eraArtifactHref(eraArtifact("contact", "created", ID, "Laura"))).toBe(`/catalogue?item=${ID}`);
    expect(eraArtifactHref(eraArtifact("reminder", "updated", ID, "Gym", { date: "2026-10-05" }))).toBe(
      `/reminders?openId=${ID}&date=2026-10-05`,
    );
    expect(eraArtifactHref(eraArtifact("reminder", "deleted", ID, "Gym"))).toBe("/recycle-bin");
    expect(eraArtifactHref(eraArtifact("shopping_item", "created", ID, "Milk", { thread: ID }))).toBe(`/chat?thread=${ID}`);
  });

  it("never links to a non-uuid id or an unvalidated ref", () => {
    expect(eraArtifact("contact", "created", "gym-1", "Laura").id).toBeNull();
    expect(eraArtifactHref({ entity: "reminder", action: "created", id: ID, ref: { date: "javascript:1" } })).toBe(
      `/reminders?openId=${ID}`,
    );
  });

  it("parses stored payloads defensively", () => {
    const good = eraArtifact("memory", "created", ID, "wifi");
    expect(parseEraArtifacts([good, { entity: "nope" }, "x", null])).toEqual([good]);
    expect(parseEraArtifacts("not an array")).toEqual([]);
  });
});
