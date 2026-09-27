import { describe, expect, it } from "vitest";
import { classifySpeechAct } from "./speechAct";

describe("classifySpeechAct (HUB-76)", () => {
  it.each([
    ["Don't transfer $300 from Drawer to Wallet", "negated"],
    ["do not delete the dentist", "negated"],
    ["I didn't spend 20 on coffee", "negated"],
    ["What if I transfer $300 from Drawer to Wallet?", "hypothetical"],
    ["suppose I paid 50 for gas", "hypothetical"],
    ["If I paid 50 for gas", "conditional"],
    ["when I get home remind me to water the plants", "conditional"],
    ["Rita said she spent 20$", "reported"],
    ["my wife told me to buy milk", "reported"],
    ["should I transfer 300 to savings", "question"],
    ["can I move 50 from wallet to savings?", "question"],
    ["transfer 300 to wallet?", "question"],
  ] as const)("%s → %s", (text, act) => {
    expect(classifySpeechAct(text, { strict: true })).toBe(act);
  });

  it.each([
    "Transfer $300 from Drawer to Wallet",
    "spent 12$ on coffee",
    "can you remind me to call mom tomorrow?",
    "please move the dentist to Friday",
    "don't forget to call mom at 5",
    "remind me to check if the oven is off",
    "delete the dentist",
    "cancel the gym tomorrow",
  ])("command: %s", (text) => {
    expect(classifySpeechAct(text)).toBe("command");
  });

  it("strict mode also blocks a mid-sentence condition and quoted speech", () => {
    expect(classifySpeechAct("transfer 300 to wallet if the salary lands")).toBe("command");
    expect(classifySpeechAct("transfer 300 to wallet if the salary lands", { strict: true })).toBe(
      "conditional",
    );
    expect(classifySpeechAct('she wrote "paid 20$ for gas"', { strict: true })).toBe("reported");
  });
});
