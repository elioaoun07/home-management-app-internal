import { describe, expect, it } from "vitest";
import {
  captureAmount,
  captureIntent,
  captureSchema,
  captureSeed,
  detectCapture,
  shoppingLines,
} from "./capture";
const now = new Date(2026, 9, 12, 10, 0);

describe("native capture suggestions", () => {
  it.each([
    ["Add a reminder", "reminder"],
    ["remind me to call mom tomorrow", "reminder"],
    ["Add an event", "event"],
    ["I paid", "expense"],
    ["I paid for event 5$", "expense"],
    ["I paid $20 for a reminder app", "expense"],
    ["Add to shopping list", "shopping"],
    ["Add milk to the shopping list", "shopping"],
    ["Don't add a reminder", null],
    ["What if I paid $20", null],
    ["I paid $20 if my salary lands", null],
    ["What events are on today?", null],
    ["event planning is difficult", null],
    ["My wife said I paid $20", null],
  ])("%s → %s", (text, kind) => expect(detectCapture(text)).toBe(kind));
  it("anchors schedule suggestions to the capture day", () => {
    expect(
      captureSeed("reminder", "remind me to call mom tomorrow at 5pm", now),
    ).toMatchObject({ title: "Call mom", date: "2026-10-13", time: "17:00" });
    expect(
      captureSeed(
        "event",
        "Add an event dinner at Parents tomorrow at 8pm",
        now,
      ),
    ).toMatchObject({
      title: "Dinner",
      location: "Parents",
      date: "2026-10-13",
      time: "20:00",
      endTime: "21:00",
    });
  });
  it("requires a title rather than saving the command prefix", () => {
    expect(captureSeed("reminder", "Add a reminder", now).title).toBe("");
    expect(captureSeed("event", "Add an event", now).title).toBe("");
  });
  it.each([
    "Remind me today at 5pm",
    "Please remind me today at 5pm",
    "Can you remind me today at 5pm",
    "Could you please remind me today at 5pm",
    "Don't forget tomorrow at 5pm",
    "Don’t forget tomorrow at 5pm",
    "Remind me today at 5pm urgent",
    "Remind me tomorrow at 5pm at home",
    "Remind me today at 5pm no alert",
  ])("requires something to remember in %s", (text) => {
    expect(detectCapture(text)).toBe("reminder");
    expect(captureSeed("reminder", text, now).title).toBe("");
  });
  it("preserves the actual title while removing polite leads and priority directives", () => {
    expect(
      captureSeed(
        "reminder",
        "Could you please remind me to call mom tomorrow at 5pm high priority",
        now,
      ),
    ).toMatchObject({ title: "Call mom", priority: "high" });
    expect(
      captureSeed("reminder", "Don't forget to call mom tomorrow at 5pm", now),
    ).toMatchObject({ title: "Call mom" });
    expect(
      captureSeed("event", "Can you add an event dinner tomorrow at 8pm", now),
    ).toMatchObject({ title: "Dinner" });
  });
  it("keeps a late event's default hour on the next calendar day", () => {
    expect(
      captureSeed("event", "Add an event dinner tomorrow at 23:30", now),
    ).toMatchObject({
      date: "2026-10-13",
      time: "23:30",
      endDate: "2026-10-14",
      endTime: "00:30",
    });
  });
  it.each(["no alert", "no alerts", "without an alert"])(
    "keeps typed %s out of the title and suppresses the default push",
    (phrase) => {
      expect(
        captureSeed(
          "reminder",
          `Remind me to call mom tomorrow at 5pm ${phrase}`,
          now,
        ),
      ).toMatchObject({
        title: "Call mom",
        alert: "none",
        alertSpecified: "true",
      });
    },
  );
  it("retains native currency units and decimal precision", () => {
    expect(captureSeed("expense", "I paid 500k lbp for fuel", now).amount).toBe(
      "500000",
    );
    expect(captureAmount("12,50")).toBe(12.5);
    expect(captureAmount("2,000.25")).toBe(2000.25);
    expect(captureAmount("-12")).toBe(0);
  });
  it("keeps each line as one shopping item", () => {
    const seed = captureSeed(
      "shopping",
      "Add to shopping list\nMilk\nMac and cheese\nApples, red",
      now,
    );
    expect(shoppingLines(seed.items)).toEqual([
      "Milk",
      "Mac and cheese",
      "Apples, red",
    ]);
  });
  it("reuses the shopping parser for a one-line command", () => {
    expect(
      shoppingLines(
        captureSeed("shopping", "Add milk and eggs to the shopping list", now)
          .items,
      ),
    ).toEqual(["Milk", "Eggs"]);
  });
  it("explicit switching wins over misleading text", () => {
    const capture = {
      kind: "expense" as const,
      accountId: "wallet",
      amount: 5,
      categoryId: "events",
      subcategoryId: "",
      description: "Event ticket",
      date: "2026-10-12",
    };
    expect(captureIntent(capture, "Add an event 5$")).toMatchObject({
      kind: "draftTransaction",
      capture,
    });
  });
  it("rejects impossible dates before dispatch", () => {
    expect(
      captureSchema.safeParse({
        kind: "reminder",
        title: "Call",
        date: "2026-02-30",
        time: "17:00",
        priority: "normal",
        location: "",
        alert: "0",
      }).success,
    ).toBe(false);
  });
});

describe("understanding without a fixed prefix", () => {
  it.each([
    // The Budget grammar's amount-first capture, anywhere in ERA.
    ["15$ pharmacy folic acid", "expense"],
    ["coffee 4$", "expense"],
    ["500k lbp groceries", "expense"],
    ["taxi 250k", "expense"],
    // The Schedule grammar's creation markers.
    ["remember to call mom", "reminder"],
    ["note to self renew passport", "reminder"],
    ["book an appointment with the dentist", "event"],
    // The Chef grammar, plus a plain "buy".
    ["we're out of milk", "shopping"],
    ["add salt under Spinneys", "shopping"],
    ["buy milk and eggs", "shopping"],
    // Not captures.
    ["Gaz yaris 38", null],
    ["buy milk tomorrow", null],
    ["I got paid $2000", null],
    ["spent 2 hours studying", null],
    ["move 5$ from wallet to drawer", null],
    ["what did I spend this month?", null],
    ["call mom tomorrow at 5", null],
  ])("%s → %s", (text, kind) => expect(detectCapture(text)).toBe(kind));

  it("recognises phrasing the household has used before", () => {
    const memory = {
      expenses: [{ text: "Coffee", count: 4, last: "2026-10-10", amount: 4, accountId: "cash", categoryId: "food", categoryName: "Food", subcategoryId: null, subcategoryName: null }],
      titles: [{ text: "Call mom", count: 3, last: "2026-10-10", type: "reminder" as const }],
    };
    expect(detectCapture("coffee 4", memory)).toBe("expense");
    expect(detectCapture("coffee 4 hours", memory)).toBeNull();
    expect(detectCapture("call mom tomorrow at 5", memory)).toBe("reminder");
    expect(detectCapture("call mom", memory)).toBeNull();
  });
});

describe("seeds", () => {
  const accounts = [
    { id: "cash", name: "Cash", currency: "USD" },
    { id: "lira", name: "Cash LBP", currency: "LBP" },
  ];
  it("keeps only the purchase as the description", () => {
    expect(captureSeed("expense", "I paid $5 for coffee", now).description).toBe("Coffee");
    expect(captureSeed("expense", "15$ pharmacy folic acid", now).description).toBe("Pharmacy folic acid");
    expect(captureSeed("expense", "coffee 4", now)).toMatchObject({ amount: "4", description: "Coffee" });
  });
  it("uses an account named in the sentence when its currency agrees with the amount", () => {
    expect(
      captureSeed("expense", "paid 20$ for fuel from Cash", now, { accounts }),
    ).toMatchObject({ accountId: "cash", description: "Fuel" });
    expect(
      captureSeed("expense", "500k lbp generator with Cash LBP", now, { accounts }),
    ).toMatchObject({ accountId: "lira", description: "Generator" });
    const conflict = captureSeed("expense", "paid 20$ for fuel from Cash LBP", now, { accounts });
    expect(conflict.accountId).toBeUndefined();
    expect(conflict.description).toBe("Fuel");
  });
  it("strips every reminder lead-in the Schedule grammar accepts", () => {
    expect(captureSeed("reminder", "Remember to water the plants tomorrow at 9am", now).title).toBe("Water the plants");
    expect(captureSeed("reminder", "Note to self renew passport", now).title).toBe("Renew passport");
    expect(captureSeed("reminder", "Remind me to call mom tonight at 9pm", now)).toMatchObject({
      title: "Call mom",
      date: "2026-10-12",
      time: "21:00",
    });
  });
  it("drops the verb when a one-line list continues line by line", () => {
    expect(shoppingLines(captureSeed("shopping", "buy milk\neggs", now).items)).toEqual(["milk", "eggs"]);
    expect(shoppingLines(captureSeed("shopping", "Add to shopping list\nMilk", now).items)).toEqual(["Milk"]);
  });
  it("splits one-line shopping, keeping remembered multi-word items whole", () => {
    expect(shoppingLines(captureSeed("shopping", "buy milk and eggs", now).items)).toEqual(["Milk", "Eggs"]);
    expect(shoppingLines(captureSeed("shopping", "we're out of milk", now).items)).toEqual(["Milk"]);
    const known = [{ text: "Mac and cheese", count: 2, last: "2026-10-01", threadId: "home", groupId: null, open: false }];
    expect(
      shoppingLines(captureSeed("shopping", "buy mac and cheese, milk", now, { shopping: known }).items),
    ).toEqual(["Mac and cheese", "Milk"]);
  });
});
