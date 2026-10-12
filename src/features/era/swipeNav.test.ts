import { describe, expect, it } from "vitest";
import { adjacentEraStop, ERA_SWIPE_STOPS } from "./swipeNav";

describe("adjacentEraStop", () => {
  it("runs hub → faces → Artifacts", () => {
    expect(ERA_SWIPE_STOPS.map((s) => s.face ?? s.view)).toEqual([
      "hub",
      "budget",
      "schedule",
      "chef",
      "brain",
      "activity",
    ]);
  });

  it("moves one stop either way", () => {
    expect(adjacentEraStop("hub", "budget", 1)).toEqual({ view: "dashboard", face: "budget" });
    expect(adjacentEraStop("dashboard", "schedule", -1)).toEqual({ view: "dashboard", face: "budget" });
    expect(adjacentEraStop("dashboard", "brain", 1)).toEqual({ view: "activity" });
  });

  it("stops at the ends and skips AI Usage", () => {
    expect(adjacentEraStop("hub", "budget", -1)).toBeNull();
    expect(adjacentEraStop("activity", "budget", 1)).toBeNull();
    expect(adjacentEraStop("usage", "budget", 1)).toBeNull();
  });
});
