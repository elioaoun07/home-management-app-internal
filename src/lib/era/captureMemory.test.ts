import { describe, expect, it } from "vitest";
import {
  aggregateExpenses,
  aggregateShopping,
  aggregateTitles,
  cleanExpenseDescription,
  memoryKey,
  preferredThread,
  recall,
  recallExpense,
  recallGroup,
  type MemoryShopping,
} from "./captureMemory";

describe("cleanExpenseDescription", () => {
  it.each([
    ["I paid $5 for coffee", "Coffee"],
    ["15$ pharmacy folic acid", "Pharmacy folic acid"],
    ["spent 50k lbp on groceries yesterday", "Groceries"],
    ["paid 20 for gas", "Gas"],
    ["I paid for event 5$", "Event"],
    ["I bought milk for 3$", "Milk"],
    ["Log an expense of 12$ for parking", "Parking"],
    ["I paid $5", ""],
    ["Spinneys", "Spinneys"],
  ])("%s → %s", (text, expected) => {
    expect(cleanExpenseDescription(text)).toBe(expected);
  });
  it("removes a plain number only when asked", () => {
    expect(cleanExpenseDescription("coffee 4")).toBe("Coffee 4");
    expect(cleanExpenseDescription("coffee 4", { allowBare: true })).toBe("Coffee");
  });
});

describe("aggregation", () => {
  it("keeps one spend per description with its usual target and latest amount", () => {
    const rows = [
      { description: "Coffee", amount: 4, account_id: "cash", category_id: "cafe", subcategory_id: null, date: "2026-10-11" },
      { description: "I paid 3$ for coffee", amount: 3, account_id: "card", category_id: "food", subcategory_id: null, date: "2026-10-09" },
      { description: "coffee", amount: 3.5, account_id: "card", category_id: "food", subcategory_id: null, date: "2026-10-01" },
      { description: "Fuel", amount: 20, account_id: "cash", category_id: "car", subcategory_id: null, date: "2026-10-10" },
      { description: "1234567890".repeat(7), amount: 1, account_id: "cash", category_id: null, subcategory_id: null, date: "2026-10-10" },
    ];
    expect(aggregateExpenses(rows)).toEqual([
      expect.objectContaining({ text: "Coffee", count: 3, last: "2026-10-11", accountId: "card", categoryId: "food", amount: 3 }),
      expect.objectContaining({ text: "Fuel", count: 1, accountId: "cash", categoryId: "car" }),
    ]);
  });
  it("counts titles case-insensitively and keeps the majority type", () => {
    expect(
      aggregateTitles([
        { title: "call mom", type: "reminder", created_at: "2026-10-11" },
        { title: "Call Mom", type: "reminder", created_at: "2026-10-01" },
        { title: "Dinner with Sara", type: "event", created_at: "2026-10-05" },
        { title: "Laundry", type: "task", created_at: "2026-10-05" },
      ]),
    ).toEqual([
      { text: "Call mom", count: 2, last: "2026-10-11", type: "reminder" },
      { text: "Dinner with Sara", count: 1, last: "2026-10-05", type: "event" },
    ]);
  });
  it("remembers a shopping item's list, group and whether it is still on the list", () => {
    const row = (content: string, extra: Partial<{ thread_id: string; shopping_group_id: string | null; archived_at: string | null; checked_at: string | null; created_at: string }> = {}) => ({
      content,
      thread_id: "home",
      shopping_group_id: null,
      archived_at: "2026-10-01",
      checked_at: null,
      created_at: "2026-10-01",
      ...extra,
    });
    expect(
      aggregateShopping([
        row("Milk", { archived_at: null, created_at: "2026-10-11" }),
        row("milk", { shopping_group_id: "dairy" }),
        row("Eggs", { shopping_group_id: "dairy" }),
        row("https://example.com/item"),
      ]),
    ).toEqual([
      { text: "Milk", count: 2, last: "2026-10-11", threadId: "home", groupId: "dairy", open: true },
      { text: "Eggs", count: 1, last: "2026-10-01", threadId: "home", groupId: "dairy", open: false },
    ]);
  });
});

describe("recall", () => {
  const titles = [
    { text: "Call mom", count: 5, last: "2026-10-10" },
    { text: "Car service", count: 2, last: "2026-10-11" },
    { text: "Pay rent", count: 9, last: "2026-10-01" },
  ];
  it("offers whole prefixes before word prefixes, most used first", () => {
    expect(recall("ca", titles).map((t) => t.text)).toEqual(["Call mom", "Car service"]);
    expect(recall("mo", titles).map((t) => t.text)).toEqual(["Call mom"]);
    expect(recall("", titles, 2).map((t) => t.text)).toEqual(["Pay rent", "Call mom"]);
  });
  it("never suggests what is already written", () => {
    expect(recall("call mom", titles)).toEqual([]);
  });
  it("keys ignore case, accents and punctuation", () => {
    expect(memoryKey("Café — Beirut!")).toBe("cafe beirut");
  });
});

describe("inference", () => {
  const expense = (text: string) => ({
    text,
    count: 1,
    last: "2026-10-10",
    amount: 4,
    accountId: "cash",
    categoryId: "food",
    categoryName: "Food",
    subcategoryId: null,
    subcategoryName: null,
  });
  it("recalls a spend exactly, or the longest remembered phrase inside a new one", () => {
    const memory = [expense("Coffee"), expense("Coffee beans")];
    expect(recallExpense("coffee", memory)?.text).toBe("Coffee");
    expect(recallExpense("Coffee beans for home", memory)?.text).toBe("Coffee beans");
    expect(recallExpense("co", memory)).toBeNull();
  });
  const shopping: MemoryShopping[] = [
    { text: "Milk", count: 6, last: "2026-10-10", threadId: "home", groupId: "dairy", open: false },
    { text: "Panadol", count: 2, last: "2026-10-10", threadId: "pharmacy", groupId: null, open: false },
    { text: "Eggs", count: 3, last: "2026-10-10", threadId: "home", groupId: "dairy", open: false },
  ];
  it("prefers the list these items went to, then the most used list", () => {
    expect(preferredThread(["home", "pharmacy"], ["Panadol"], shopping)).toBe("pharmacy");
    expect(preferredThread(["home", "pharmacy"], ["Bread"], shopping)).toBe("home");
    expect(preferredThread(["other"], ["Milk"], shopping)).toBeNull();
  });
  it("files items under their usual group only when they agree", () => {
    expect(recallGroup(["Milk", "Eggs"], "home", shopping)).toBe("dairy");
    expect(recallGroup(["Bread"], "home", shopping)).toBeNull();
    expect(recallGroup(["Milk"], "pharmacy", shopping)).toBeNull();
  });
});
