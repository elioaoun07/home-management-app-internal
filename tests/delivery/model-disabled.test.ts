// V1: a catalog model marked `disabled` stays listed but is never recommended
// and never launchable.
import { describe, expect, it } from "vitest";

import { validateConfig } from "../../scripts/delivery/config.mjs";
import { recommendAgentConfig } from "../../scripts/delivery/recommendation.mjs";

// Every tier lists its disabled model first, so whichever tier the scorer lands
// on, a first-match pick would return the disabled one.
const models = ["economy", "standard", "premium"].flatMap((tier) => [
  { id: `${tier}-off`, tier, disabled: true },
  { id: `${tier}-on`, tier },
]);

describe("disabled catalog models (V1)", () => {
  it("accepts a boolean flag and rejects anything else", () => {
    expect(() => validateConfig({ providers: { claude: { models } } })).not.toThrow();
    expect(() => validateConfig({ providers: { claude: { models: [{ id: "x", disabled: "yes" }] } } })).toThrow(/disabled/u);
  });

  it("never recommends a disabled model, even when it is first in its tier", () => {
    const pick = recommendAgentConfig({
      item: { effort: "L", sev: "high", campaign: "Delivery" },
      provider: "claude",
      config: { providers: { claude: { models, efforts: ["low", "high"] } }, budgets: {} },
    });
    expect(pick?.model).toMatch(/-on$/u);
  });
});
