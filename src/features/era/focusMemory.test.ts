// Behavior lock for ERA's Stage 1 focus memory — the pure resolution rules
// "change it to 11" depends on. `useEraStore.test.ts` (if one exists) would
// only re-exercise these through Zustand plumbing; the rules themselves are
// pinned here.
import { describe, expect, it } from "vitest";
import {
  FOCUS_MAX_ENTITIES,
  FOCUS_TTL_MS,
  isPronounRef,
  pruneExpired,
  pushEntity,
  resolveEntityRef,
  resolveFocusRef,
  type FocusEntity,
} from "./focusMemory";

function entity(id: string, addedAt: number, title = `Item ${id}`): FocusEntity {
  return { id, type: "reminder", title, addedAt };
}

describe("isPronounRef", () => {
  it.each([
    ["it", true],
    ["that", true],
    ["this", true],
    ["that one", true],
    ["THIS ONE", true],
    ["  it  ", true],
    ["Water the plants", false],
    ["it worked", false],
    ["", false],
  ])("%s -> %s", (ref, expected) => {
    expect(isPronounRef(ref)).toBe(expected);
  });
});

describe("pushEntity", () => {
  it("adds to the front, newest first", () => {
    const list = pushEntity([entity("a", 1)], entity("b", 2));
    expect(list.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("de-dupes by id — touching the same entity again moves it to the front instead of duplicating", () => {
    const list = pushEntity(
      [entity("a", 1), entity("b", 2)],
      entity("a", 3, "Renamed"),
    );
    expect(list.map((e) => e.id)).toEqual(["a", "b"]);
    expect(list[0].title).toBe("Renamed");
  });

  it("caps at FOCUS_MAX_ENTITIES", () => {
    let list: FocusEntity[] = [];
    for (let i = 0; i < FOCUS_MAX_ENTITIES + 5; i++) {
      list = pushEntity(list, entity(`id-${i}`, i));
    }
    expect(list.length).toBe(FOCUS_MAX_ENTITIES);
    expect(list[0].id).toBe(`id-${FOCUS_MAX_ENTITIES + 4}`); // most recent survives
  });
});

describe("pruneExpired", () => {
  it("drops entities older than the TTL, keeps the rest", () => {
    const now = 1_000_000;
    const fresh = entity("fresh", now - 1000);
    const stale = entity("stale", now - FOCUS_TTL_MS - 1);
    expect(pruneExpired([fresh, stale], now)).toEqual([fresh]);
  });
});

describe("resolveFocusRef", () => {
  it("returns null for a non-pronoun ref — Stage 1 doesn't do fuzzy title matching", () => {
    const entities = [entity("a", Date.now())];
    expect(resolveFocusRef("Water the plants", "reminder", entities)).toBeNull();
  });

  it("returns null when there is nothing in focus", () => {
    expect(resolveFocusRef("it", "reminder", [])).toBeNull();
  });

  it("resolves a pronoun to the most recent live entity of the required type", () => {
    const now = 1_000_000;
    const entities = [entity("newest", now - 200), entity("older", now - 500)];
    expect(resolveFocusRef("that", "reminder", entities, now)?.id).toBe("newest");
  });

  it("never resolves to an expired entity", () => {
    const now = 1_000_000;
    const stale = entity("stale", now - FOCUS_TTL_MS - 1);
    expect(resolveFocusRef("it", "reminder", [stale], now)).toBeNull();
  });
});

// HUB-34 — fuzzy-title resolution for a captured (non-pronoun) reference,
// e.g. "the dentist reminder" from a taught template's `{target}` slot.
// Regression coverage for the bug this fixes: the router previously
// discarded the captured reference entirely and always grabbed the most
// recent entity of the type, so a template naming one reminder could
// silently act on a completely different one.
describe("resolveEntityRef", () => {
  it("delegates to the pronoun tier unchanged", () => {
    const now = 1_000_000;
    const entities = [entity("newest", now - 200), entity("older", now - 500)];
    expect(resolveEntityRef("it", "reminder", entities, now)?.id).toBe("newest");
  });

  it("resolves a named reference to the matching title, NOT the most recent", () => {
    const now = 1_000_000;
    const dentist = entity("dentist-id", now - 500, "Call the dentist");
    const mostRecent = entity("recent-id", now - 100, "Water the plants");
    // "dentist" is older than "water the plants" — a naive most-recent
    // fallback (the pre-fix behavior) would wrongly pick mostRecent here.
    const result = resolveEntityRef(
      "the dentist reminder",
      "reminder",
      [mostRecent, dentist],
      now,
    );
    expect(result?.id).toBe("dentist-id");
  });

  it("returns null — never guesses — when two live titles share equally strong overlap", () => {
    const now = 1_000_000;
    const a = entity("a", now - 100, "Call the dentist");
    const b = entity("b", now - 200, "Call the vet dentist");
    expect(resolveEntityRef("the dentist reminder", "reminder", [a, b], now)).toBeNull();
  });

  it("returns null when nothing meaningful is left after stopword stripping", () => {
    const now = 1_000_000;
    const entities = [entity("a", now - 100, "Call the dentist")];
    expect(resolveEntityRef("the reminder", "reminder", entities, now)).toBeNull();
  });

  it("returns null when no live title shares enough overlap", () => {
    const now = 1_000_000;
    const entities = [entity("a", now - 100, "Call the dentist")];
    expect(resolveEntityRef("the grocery list", "reminder", entities, now)).toBeNull();
  });

  it("never resolves to an expired entity", () => {
    const now = 1_000_000;
    const stale = entity("stale", now - FOCUS_TTL_MS - 1, "Call the dentist");
    expect(resolveEntityRef("the dentist reminder", "reminder", [stale], now)).toBeNull();
  });
});
