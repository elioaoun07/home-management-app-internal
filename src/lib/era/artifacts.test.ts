import { describe, expect, it } from "vitest";
import {
  ERA_ARTIFACT_ENTITY_KEYS,
  ERA_ARTIFACT_MODULE_KEYS,
  eraArtifact,
  eraArtifactHref,
  eraArtifactLabel,
  eraArtifactModule,
  eraArtifactReversal,
  parseEraArtifacts,
} from "./artifacts";

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

  it("every entity belongs to a known module", () => {
    for (const entity of ERA_ARTIFACT_ENTITY_KEYS) {
      expect(ERA_ARTIFACT_MODULE_KEYS).toContain(eraArtifactModule(entity));
    }
    expect(eraArtifactModule("transfer")).toBe("budget");
    expect(eraArtifactModule("reminder")).toBe("schedule");
    expect(eraArtifactModule("contact")).toBe("catalogue");
  });

  it("only created/deleted verbs of bin-backed entities are reversible", () => {
    expect(eraArtifactReversal({ entity: "transfer", action: "created", id: ID })).toEqual({ bin: "transfers", id: ID, born: "live" });
    expect(eraArtifactReversal({ entity: "reminder", action: "deleted", id: ID })).toEqual({ bin: "items", id: ID, born: "trashed" });
    expect(eraArtifactReversal({ entity: "draft", action: "created", id: ID })?.bin).toBe("drafts");
    expect(eraArtifactReversal({ entity: "contact", action: "created", id: ID })?.bin).toBe("catalogue");
    // no stored before-image / hard delete / no id → no button
    expect(eraArtifactReversal({ entity: "reminder", action: "updated", id: ID })).toBeNull();
    expect(eraArtifactReversal({ entity: "transaction", action: "updated", id: ID })).toBeNull();
    expect(eraArtifactReversal({ entity: "debt", action: "created", id: ID })).toBeNull();
    expect(eraArtifactReversal({ entity: "memory", action: "created", id: ID })).toBeNull();
    expect(eraArtifactReversal({ entity: "transfer", action: "created", id: null })).toBeNull();
  });

  it("parses stored payloads defensively", () => {
    const good = eraArtifact("memory", "created", ID, "wifi");
    expect(parseEraArtifacts([good, { entity: "nope" }, "x", null])).toEqual([good]);
    expect(parseEraArtifacts("not an array")).toEqual([]);
  });
});
