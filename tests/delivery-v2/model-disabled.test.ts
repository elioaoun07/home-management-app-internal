// A catalog model marked `disabled` stays visible to the owner but can never run:
// the policy keeps the flag, a run asking for it is refused, and a profile
// suggestion cannot point at it.
import { describe, expect, it } from "vitest";

import { validateRunSettings } from "../../scripts/delivery-v2/adapters/registry.mjs";
import { policyTemplate, validateExecutionPolicy } from "../../scripts/delivery-v2/policy.mjs";

const catalog = {
  revision: 1,
  models: {
    claude: [
      { id: "on-model", efforts: ["low", "high"] },
      { id: "off-model", efforts: ["low", "high"], disabled: true },
    ],
  },
};

function policyWith(nextCatalog: unknown) {
  const template = policyTemplate({ executor: "claude", authorized_by: "elio" });
  return validateExecutionPolicy({ ...template, executors: { ...template.executors, catalog: nextCatalog } });
}

describe("disabled catalog models", () => {
  it("refuses a run that asks for a disabled model and accepts the enabled one", () => {
    const off = validateRunSettings({ executor: "claude", model: "off-model", effort: "low", catalog });
    expect(off.ok).toBe(false);
    expect(off.refusals.map((entry: { code: string }) => entry.code)).toEqual(["model-disabled"]);
    expect(validateRunSettings({ executor: "claude", model: "on-model", effort: "low", catalog }).ok).toBe(true);
  });

  it("keeps the flag when the policy is parsed, and defaults it to enabled", () => {
    const validated = policyWith(catalog);
    expect(validated.ok).toBe(true);
    const models = (validated.policy as { executors: { catalog: { models: { claude: { id: string; disabled: boolean }[] } } } }).executors.catalog.models.claude;
    expect(models.map((entry) => [entry.id, entry.disabled])).toEqual([
      ["on-model", false],
      ["off-model", true],
    ]);
  });

  it("rejects a non-boolean flag rather than treating it as enabled", () => {
    const validated = policyWith({ ...catalog, models: { claude: [{ id: "on-model", disabled: "yes" }] } });
    expect(validated.ok).toBe(false);
  });

  it("refuses a profile suggestion that points at a disabled model", () => {
    const validated = policyWith({ ...catalog, profiles: { focused: { claude: { model: "off-model", effort: "low" } } } });
    expect(validated.ok).toBe(false);
  });
});
