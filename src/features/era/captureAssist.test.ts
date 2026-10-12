import { describe, expect, it } from "vitest";
import type { MemoryShopping } from "@/lib/era/captureMemory";
import {
  applySentenceChoice,
  captureChoices,
  captureFocus,
  captureGhost,
  captureMarks,
  captureTokens,
  leadInGhost,
  type AssistState,
} from "./captureAssist";
import { captureSeed, detectCapture, shoppingLines, type CaptureKind } from "./capture";
import { captureProgress } from "./captureProgress";

// Monday 12 October 2026, 10:00 local.
const MONDAY = new Date(2026, 9, 12, 10, 0);
const titles = [
  { text: "Call mom", count: 5, last: "2026-10-10", type: "reminder" as const },
  { text: "Car service", count: 1, last: "2026-10-11", type: "reminder" as const },
];
const shopping: MemoryShopping[] = [
  { text: "Milk", count: 8, last: "2026-10-10", threadId: "home", groupId: "dairy", open: true },
  { text: "Eggs", count: 5, last: "2026-10-09", threadId: "home", groupId: "dairy", open: false },
  { text: "Bread", count: 4, last: "2026-10-08", threadId: "home", groupId: null, open: false },
];
const accounts = [
  { id: "cash", name: "Cash", currency: "USD" },
  { id: "lira", name: "Cash LBP", currency: "LBP" },
];

function state(
  kind: CaptureKind,
  text: string,
  now = MONDAY,
  overrides: Record<string, string> = {},
): AssistState {
  const fields = { ...captureSeed(kind, text, now, { accounts, shopping }), ...overrides };
  return {
    kind,
    text,
    fields,
    step: captureProgress(kind, text, fields, { hasChildren: false }, now),
    now,
    accounts,
    parents: [{ id: "food", name: "Food" }],
    children: [],
    threads: [{ id: "home", title: "Home" }],
    groups: [{ id: "dairy", name: "Dairy" }],
    items: shoppingLines(fields.items ?? ""),
    memory: { expenses: [], titles, shopping },
  };
}
const labels = (s: AssistState) =>
  captureChoices(s, captureFocus(s).step, captureFocus(s).fragment).map((c) => c.label);

describe("contextual date and time choices", () => {
  it("sets day and time in one tap when neither was said", () => {
    const s = state("reminder", "Remind me to call mom");
    expect(s.step).toBe("date");
    expect(captureChoices(s, "date").map((c) => [c.label, c.value])).toEqual([
      ["Tomorrow 9 AM", "tomorrow at 9am"],
      ["Today 6 PM", "today at 6pm"],
      ["In 1 hour", "today at 11am"],
      ["Saturday 10 AM", "on Saturday at 10am"],
    ]);
  });
  it("drops evening slots that already passed", () => {
    const s = state("reminder", "Remind me to call mom", new Date(2026, 9, 12, 21, 30));
    expect(captureChoices(s, "date").map((c) => c.label)).toEqual([
      "Tomorrow 9 AM",
      "In 1 hour",
      "Saturday 10 AM",
    ]);
  });
  it("offers days only once a time was said, today only while it is still ahead", () => {
    expect(
      captureChoices(state("reminder", "Remind me to call mom at 5pm"), "date").map((c) => c.label),
    ).toEqual(["Today", "Tomorrow", "Wednesday", "Thursday"]);
    expect(
      captureChoices(state("reminder", "Remind me to call mom at 9am"), "date").map((c) => c.label),
    ).toEqual(["Tomorrow", "Wednesday", "Thursday", "Friday"]);
  });
  it("offers times still ahead today, and usual times on another day", () => {
    const late = new Date(2026, 9, 12, 16, 20);
    expect(
      captureChoices(state("reminder", "Remind me to call mom today", late), "time").map((c) => c.label),
    ).toEqual(["5 PM", "6 PM", "8 PM", "9 PM"]);
    expect(
      captureChoices(state("reminder", "Remind me to call mom tomorrow"), "time").map((c) => c.label),
    ).toEqual(["9 AM", "12 PM", "6 PM", "8 PM"]);
  });
});

describe("sentence completion", () => {
  it("finishes a remembered title while it is typed", () => {
    const s = state("reminder", "remind me to ca");
    expect(captureFocus(s)).toEqual({ step: "title", fragment: "Ca" });
    expect(labels(s)).toEqual(["Call mom", "Car service"]);
    expect(captureGhost(s)).toEqual({ suffix: "ll mom", text: "remind me to call mom " });
  });
  it("offers the next gap after a finished word", () => {
    expect(captureGhost(state("reminder", "remind me to call mom "))).toEqual({
      suffix: "tomorrow at 9am",
      text: "remind me to call mom tomorrow at 9am ",
    });
    expect(captureGhost(state("reminder", "remind me to call mom tom"))?.suffix).toBe(
      "orrow at 9am",
    );
    // Mid-word with nothing to finish: stay quiet.
    expect(captureGhost(state("reminder", "remind me to water the pla"))).toBeNull();
  });
  it("finishes the lead-in before an action is recognised", () => {
    expect(leadInGhost("rem")).toEqual({ suffix: "ind me to", text: "remind me to " });
    expect(leadInGhost("Add t")?.text).toBe("Add to shopping list ");
    expect(leadInGhost("re")).toBeNull();
    expect(leadInGhost("hello")).toBeNull();
  });
  it("completes shopping items from the lists, without re-offering what is already on them", () => {
    const empty = state("shopping", "Add to shopping list", MONDAY, { threadId: "home" });
    expect(captureChoices(empty, "items").map((c) => c.label)).toEqual(["Eggs", "Bread"]);
    const typing = state("shopping", "add mi", MONDAY, { threadId: "home" });
    expect(captureChoices(typing, "items", "Mi")).toEqual([
      { label: "Milk", value: "Milk", sentence: "items", detail: "On list" },
    ]);
    expect(captureGhost(typing)?.text).toBe("add milk ");
  });
  it("writes choices into the sentence the way it was started", () => {
    expect(
      applySentenceChoice("Add to shopping list", { label: "Eggs", value: "Eggs", sentence: "items" }),
    ).toBe("Add to shopping list\nEggs");
    expect(
      applySentenceChoice("buy milk", { label: "Eggs", value: "Eggs", sentence: "items" }),
    ).toBe("buy milk, Eggs");
    expect(
      applySentenceChoice(
        "remind me to mom",
        { label: "Call mom", value: "Call mom", sentence: "title" },
        "Mom",
      ),
    ).toBe("remind me to call mom ");
    expect(
      applySentenceChoice("Remind me to ", {
        label: "Call mom",
        value: "Call mom",
        sentence: "title",
      }),
    ).toBe("Remind me to call mom ");
    expect(
      applySentenceChoice("I paid 5$ ", {
        label: "Coffee",
        value: "Coffee",
        sentence: "description",
      }),
    ).toBe("I paid 5$ for coffee ");
    expect(
      applySentenceChoice("I paid for coffee", {
        label: "$4",
        value: "4$",
        sentence: "amount",
      }),
    ).toBe("I paid for coffee 4$ ");
    expect(
      applySentenceChoice("Remind me to call mom", {
        label: "Tomorrow 9 AM",
        value: "tomorrow at 9am",
        sentence: "when",
      }),
    ).toBe("Remind me to call mom tomorrow at 9am ");
  });
});

describe("what ERA understood", () => {
  it("reads a reminder back as prose with tappable day, time and alert", () => {
    const s = state("reminder", "Remind me to call mom today at 5pm no alert");
    expect(captureTokens(s)).toEqual([
      { key: "title", label: "Call mom" },
      { key: "day", label: "Today", step: "date" },
      { key: "time", label: "5 PM", step: "time", joiner: "at" },
      { key: "alert", label: "No alert", step: "alert", icon: "silent" },
    ]);
  });
  it("reads an expense back in the account's own currency", () => {
    const s = state("expense", "spent 500k lbp on fuel from Cash LBP", MONDAY, {
      accountId: "lira",
      categoryId: "food",
      amount: "500000",
    });
    expect(captureTokens(s)).toEqual([
      { key: "amount", label: "500,000 LBP" },
      { key: "description", label: "Fuel" },
      { key: "account", label: "Cash LBP", step: "accountId" },
      { key: "category", label: "Food", step: "categoryId" },
    ]);
  });
  it("names the list and group a shopping capture will use", () => {
    const s = state("shopping", "Add to shopping list\nMilk\nEggs", MONDAY, {
      threadId: "home",
      groupId: "dairy",
    });
    expect(captureTokens(s)).toEqual([
      { key: "items", label: "Milk, Eggs" },
      { key: "list", label: "Home", step: "threadId" },
      { key: "group", label: "Dairy", step: "groupId" },
    ]);
  });
  it("leaves the word being typed, and an alert without a time, out of the summary", () => {
    expect(captureTokens(state("reminder", "remind me to ca"))).toEqual([]);
    expect(captureTokens(state("reminder", "remind me to call mom "))).toEqual([
      { key: "title", label: "Call mom" },
    ]);
  });
  it("asks for the next item after a new line", () => {
    const s = state("shopping", "Add to shopping list\nMilk\n", MONDAY, { threadId: "home" });
    expect(s.step).toBe("ready");
    expect(captureFocus(s)).toEqual({ step: "items", fragment: "" });
    expect(captureChoices(s, "items").map((c) => c.label)).toEqual(["Eggs", "Bread"]);
  });
  it("highlights the phrases read as data", () => {
    const text = "Remind me to call mom tomorrow at 5pm";
    expect(
      captureMarks("reminder", text, MONDAY).map((m) => text.slice(m.start, m.end)),
    ).toEqual(["tomorrow", "at 5pm"]);
    const spend = "15$ pharmacy from Cash";
    expect(
      captureMarks("expense", spend, MONDAY, { accounts }).map((m) => spend.slice(m.start, m.end)),
    ).toEqual(["15$", "from Cash"]);
    const event = "Add an event dinner at Parents tomorrow at 8pm";
    expect(
      captureMarks("event", event, MONDAY, { location: "Parents" }).map((m) =>
        event.slice(m.start, m.end),
      ),
    ).toEqual(["Parents", "tomorrow", "at 8pm"]);
  });
});

describe("detection stays in step with the helper", () => {
  it("recognises the household's own phrasing from memory", () => {
    expect(detectCapture("add milk", { shopping })).toBe("shopping");
    expect(detectCapture("add mil", { shopping })).toBe("shopping");
    expect(detectCapture("add an", { shopping })).toBeNull();
    expect(detectCapture("add milk")).toBeNull();
  });
});
