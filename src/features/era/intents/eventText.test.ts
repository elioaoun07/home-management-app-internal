// HUB-94 — which words are the event's title, which are its place, and
// which are its date/time (the date/time values come from smartTextParser).
import { describe, expect, it } from "vitest";
import { eventLead, parseEvent } from "./eventText";
import { findPlaceInText, matchPlace, normalizePlace, pickPlacesModule, tidyPlaceName } from "./resolvers/places";

const NOW = new Date(2026, 9, 4, 10, 0); // Sun 2026-10-04 10:00 local

describe("parseEvent", () => {
  it.each([
    ["add an event dinner at Parents' house tomorrow at 8pm", "Dinner", "Parents' house", "2026-10-05", "20:00"],
    ["Add an event dinner at parents tomorrow at 8pm", "Dinner", "parents", "2026-10-05", "20:00"],
    ["schedule a meeting with Joe tomorrow at 3", "Meeting with Joe", undefined, "2026-10-05", "15:00"],
    ["book an appointment at the dentist tomorrow 4pm", "Appointment", "the dentist", "2026-10-05", "16:00"],
    ["add an event party at Rami's place", "Party", "Rami's place", undefined, undefined],
    ["new event: church tomorrow at 10am", "Church", undefined, "2026-10-05", "10:00"],
    ["add dinner with Jacob to my calendar tomorrow", "Dinner with Jacob", undefined, "2026-10-05", undefined],
    ["add an event lunch with Sara tomorrow", "Lunch with Sara", undefined, "2026-10-05", "13:00"],
    ["add an event tomorrow at 5pm", "Event", undefined, "2026-10-05", "17:00"],
  ])("%s", (text, title, place, date, time) => {
    const e = parseEvent(text, NOW);
    expect(e?.title).toBe(title);
    expect(e?.placeHint).toBe(place);
    expect(e?.date).toBe(date);
    expect(e?.time).toBe(time);
    expect(e?.recurring).toBe(false);
  });

  it("flags repeating events (they go to the form)", () => {
    expect(parseEvent("add an event church every Sunday at 10am", NOW)?.recurring).toBe(true);
  });

  it.each([
    "remind me to call mom tomorrow",
    "what's on my schedule tomorrow",
    "add an event pay $50 rent tomorrow",
    "add milk to the shopping list",
    "add Kobeize as a location",
  ])("not an event: %s", (text) => {
    expect(eventLead(text)).toBeNull();
  });
});

describe("places", () => {
  const places = [
    { id: "a", name: "Parents' house", tags: ["parents"] },
    { id: "b", name: "Church", tags: [] },
    { id: "c", name: "Spinneys Achrafieh", tags: ["spinneys"] },
  ];

  it("matches a name, an alias tag, or one unique whole-word overlap", () => {
    expect(matchPlace(places, "Parents")?.id).toBe("a");
    expect(matchPlace(places, "the parents' house")?.id).toBe("a");
    expect(matchPlace(places, "church")?.id).toBe("b");
    expect(matchPlace(places, "Spinneys")?.id).toBe("c");
    expect(matchPlace(places, "Starbucks Hamra")).toBeNull();
    expect(matchPlace(places, "ch")).toBeNull();
  });

  it("finds a saved place named inside a title, whole words only", () => {
    expect(findPlaceInText(places, "Church")?.id).toBe("b");
    expect(findPlaceInText(places, "Mass at church")?.id).toBe("b");
    expect(findPlaceInText(places, "Churchill talk")).toBeNull();
  });

  it("normalises and tidies names", () => {
    expect(normalizePlace("The Parents' House!")).toBe("parents house");
    expect(tidyPlaceName("at starbucks hamra.")).toBe("Starbucks hamra");
  });

  it("adopts ERA's marked module first, then a module named Places/Locations", () => {
    expect(pickPlacesModule([{ id: "x", name: "Places" }, { id: "y", name: "Spots", settings_json: { era_role: "places" } }])?.id).toBe("y");
    expect(pickPlacesModule([{ id: "x", name: "Locations" }])?.id).toBe("x");
    expect(pickPlacesModule([{ id: "x", name: "Contacts", type: "contacts" }])).toBeNull();
  });
});
