// KIT-20 / Catalogue C02 — metadata is patched by key, never replaced.
import { describe, expect, it } from "vitest";
import {
  applyMetadataPatch,
  catalogueItemCreateSchema,
  catalogueItemPatchSchema,
  diffMetadata,
  MetadataPatchError,
  metadataInverse,
  metadataOps,
  toIlikeTerm,
} from "@/lib/catalogue/itemPatch";
import { isPlacesModule, pickPlacesModule } from "@/lib/catalogue/moduleRoles";

describe("metadata patch", () => {
  const before = { maps_url: "https://maps.app.goo.gl/x", phone: "01", era_note: "keep me" };

  it("preserves keys the caller never mentioned", () => {
    const next = applyMetadataPatch(before, { phone: "02" }, []);
    expect(next).toEqual({ maps_url: "https://maps.app.goo.gl/x", phone: "02", era_note: "keep me" });
  });

  it("unset removes only the named keys", () => {
    expect(applyMetadataPatch(before, {}, ["phone"])).toEqual({
      maps_url: "https://maps.app.goo.gl/x",
      era_note: "keep me",
    });
  });

  it("legacy metadata_json merges instead of replacing", () => {
    const ops = metadataOps({ metadata_json: { phone: "03" } });
    expect(applyMetadataPatch(before, ops.set, ops.unset).era_note).toBe("keep me");
  });

  it("rejects set/unset overlap", () => {
    expect(() => metadataOps({ metadata_set: { a: 1 }, metadata_unset: ["a"] })).toThrow(MetadataPatchError);
  });

  it("keeps false and zero as values, not blanks", () => {
    expect(applyMetadataPatch({}, { copy_submission_allowed: false, unit_size: 0 }, [])).toEqual({
      copy_submission_allowed: false,
      unit_size: 0,
    });
  });

  it("nested values replace at their top-level key", () => {
    const next = applyMetadataPatch({ trigger_conditions: [{ a: 1 }, { b: 2 }] }, { trigger_conditions: [{ c: 3 }] }, []);
    expect(next.trigger_conditions).toEqual([{ c: 3 }]);
  });

  it("inverse restores every touched key exactly", () => {
    const set = { phone: "02", address: "Beirut" };
    const unset = ["maps_url"];
    const after = applyMetadataPatch(before, set, unset);
    const inv = metadataInverse(before, set, unset);
    expect(applyMetadataPatch(after, inv.set, inv.unset)).toEqual(before);
  });
});

describe("diffMetadata (form → patch)", () => {
  it("only mentions managed keys", () => {
    const d = diffMetadata({ maps_url: "a", era_note: "x" }, { maps_url: "b" }, ["maps_url", "phone"]);
    expect(d).toEqual({ metadata_set: { maps_url: "b" } });
  });

  it("a cleared field becomes an unset", () => {
    expect(diffMetadata({ phone: "01" }, { phone: "  " }, ["phone"])).toEqual({ metadata_unset: ["phone"] });
  });

  it("unchanged form sends nothing", () => {
    expect(diffMetadata({ phone: "01", sets: 4 }, { phone: "01", sets: 4 }, ["phone", "sets"])).toEqual({});
  });

  it("a never-set blank field is not unset", () => {
    expect(diffMetadata({}, { phone: "" }, ["phone"])).toEqual({});
  });
});

describe("route schemas", () => {
  it("drops unknown keys from old clients instead of rejecting", () => {
    const r = catalogueItemPatchSchema.safeParse({ module_id: "x", name: "Kobeize" });
    expect(r.success).toBe(true);
    expect(r.success && "module_id" in r.data).toBe(false);
  });

  it("rejects unsafe metadata keys", () => {
    expect(catalogueItemPatchSchema.safeParse({ metadata_set: { __proto__x: 1 } }).success).toBe(false);
    expect(catalogueItemPatchSchema.safeParse({ metadata_unset: ["Bad-Key"] }).success).toBe(false);
  });

  it("create requires a module and a non-blank name", () => {
    expect(catalogueItemCreateSchema.safeParse({ name: "x" }).success).toBe(false);
    expect(
      catalogueItemCreateSchema.safeParse({ module_id: "4b6f7c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f", name: "   " }).success,
    ).toBe(false);
  });
});

describe("toIlikeTerm", () => {
  it("strips PostgREST filter syntax and escapes LIKE wildcards", () => {
    expect(toIlikeTerm("a,b(c)")).toBe("a b c");
    expect(toIlikeTerm("50%_off")).toBe("50\\%\\_off");
  });
});

describe("module roles", () => {
  it("role marker wins over a name match", () => {
    const mods = [
      { id: "x", type: "custom", name: "Places" },
      { id: "y", type: "custom", name: "Spots", settings_json: { era_role: "places" } },
    ];
    expect(pickPlacesModule(mods)?.id).toBe("y");
  });

  it("adopts a custom module named Places/Locations, not a typed one", () => {
    expect(isPlacesModule({ type: "custom", name: " my locations " })).toBe(true);
    expect(isPlacesModule({ type: "trips", name: "Places" })).toBe(false);
  });
});
