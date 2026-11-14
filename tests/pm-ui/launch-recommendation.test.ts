import { describe, it, expect } from "vitest";
import { launchRecommendation } from "../../scripts/pm/app/launchRecommendationModel";
import type { V2Catalogue } from "../../scripts/pm/app/types";
const tiers = [{ id: "tier:CLAUDE_MID", kind: "tier", alias: "CLAUDE_MID", selector: "fixture", defaultEffort: "medium" }];
const catalogue = { executors: [{ id: "claude", models: [{ id: "fixture", label: "Fixture", efforts: ["medium", "high"] }], supportedEfforts: ["medium", "high"] }] } as V2Catalogue;
describe("Markdown launch recommendation", () => {
  it("resolves the selected item's alias and prioritizes its explicit effort", () => {
    expect(launchRecommendation({ contract: "- **Tier:** CLAUDE_MID, effort high; owner review." }, tiers, catalogue)).toMatchObject({ executor: "claude", model: "fixture", effort: "high", supported: true });
  });
  it("uses the registry default when effort is omitted", () => {
    expect(launchRecommendation({ contract: "**Tier:** CLAUDE_MID." }, tiers, catalogue)?.effort).toBe("medium");
  });
  it("does not mistake code examples or unrelated tier mentions for a recommendation", () => {
    expect(launchRecommendation({ contract: "Use CLAUDE_MID later\n```md\n**Tier:** CLAUDE_MID\n```" }, tiers, catalogue)).toBeNull();
  });
  it("retains unsupported recommendations without substituting another model", () => {
    expect(launchRecommendation({ contract: "**Tier:** CLAUDE_MID, effort max" }, tiers, catalogue)).toMatchObject({ model: "fixture", effort: "max", supported: false });
    expect(launchRecommendation({ contract: "**Tier:** CLAUDE_MID" }, [], catalogue)).toMatchObject({ alias: "CLAUDE_MID", model: "", supported: false });
  });
});
