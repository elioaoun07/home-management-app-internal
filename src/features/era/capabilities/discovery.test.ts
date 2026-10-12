import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ERA_CAPABILITIES } from "./registry";
import { capabilityDescriptors, describeApplication, describeCapabilityCatalog, inputSchema } from "./discovery";
import { ERA_REACH } from "../reach";
import { needsAgentPlan } from "./plan";
import { buildSystemPrompt, parseAskAIResponse } from "@/lib/ai/eraAskProposal";

describe("ERA self-describing capabilities", () => {
  it("capability questions reach discovery without teaching per-module utterances", () => {
    expect(needsAgentPlan("What can you do in Trips?")).toBe(true);
    expect(needsAgentPlan("Which features can you use in my wardrobe?")).toBe(true);
    expect(needsAgentPlan("What can we cook tonight?")).toBe(false);
  });
  it("advertises the real input/output types, limits and recovery boundaries", () => {
    const descriptors = capabilityDescriptors(ERA_CAPABILITIES);
    const shopping = descriptors.find((capability) => capability.id === "shopping.add")!;
    expect(shopping.input).toMatchObject({
      type: "object", required: ["items"], additionalProperties: false,
      properties: { items: { type: "array", minItems: 1, maxItems: 50, items: { type: "string", maxLength: 200 } } },
    });
    expect(shopping.confirmationRequired).toBe(true);
    expect(shopping.recovery).toBe("inspect-before-retry");
    expect(descriptors.find((capability) => capability.id === "recipe.ingredients")?.outputs)
      .toMatchObject({ ingredients: { type: "array", items: { type: "string" } } });
    expect(descriptors.every((capability) => ERA_REACH.some((row) => row.module === capability.module))).toBe(true);
  });

  it("a new contract and schema change become discoverable without editing a prompt or adding utterances", () => {
    const catalog = {
      "recipe.search": { ...ERA_CAPABILITIES["recipe.search"],
        id: "recipe.search", description: "Find a saved dish", slots: z.object({ dish: z.string().max(23) }),
      },
      "wardrobe.read": { ...ERA_CAPABILITIES["recipe.list"],
        id: "wardrobe.read", module: "Outfits", description: "List saved wardrobe pieces",
      },
    };
    const prompt = describeCapabilityCatalog(catalog);
    expect(prompt).toContain("wardrobe.read");
    expect(prompt).toContain("List saved wardrobe pieces");
    expect(prompt).toContain('"maxLength":23');
    expect(describeApplication(catalog, "wardrobe").text).toContain("List saved wardrobe pieces");
  });

  it("precision-page awareness cannot turn an unsupported backend into a proposed tool", async () => {
    const result = await ERA_CAPABILITIES["app.capabilities"].execute({ query: "trips" });
    expect(result.text).toContain("Trips");
    expect(result.text).toContain("/trips");
    expect(result.metadata?.modules).toMatchObject([{ module: "Trips", capabilities: [] }]);
    expect(parseAskAIResponse(JSON.stringify({
      kind: "propose_action", text: "Activate trip", capabilityId: "trip.activate", slotsJson: "{}",
    }))?.kind).toBe("prose");
  });

  it("offers the same cross-module knowledge on every face and keeps routes out of executable schemas", () => {
    for (const face of ["budget", "schedule", "chef", "brain"] as const) {
      const prompt = buildSystemPrompt({ face });
      expect(prompt).toContain("app.capabilities");
      expect(prompt).toContain("Healthcare: no registered agent actions");
      expect(prompt).toContain("inspect");
      expect(prompt).not.toContain("/api/items");
    }
  });

  it("single-action proposals reject unadvertised slots instead of silently stripping them", () => {
    expect(inputSchema(ERA_CAPABILITIES["memory.save"]).safeParse({
      label: "Wifi", value: "secret", overwrite: true,
    }).success).toBe(false);
    expect(parseAskAIResponse(JSON.stringify({ kind: "propose_action", text: "Save",
      capabilityId: "memory.save", slotsJson: JSON.stringify({ label: "Wifi", value: "secret", overwrite: true }),
    }))?.kind).toBe("prose");
  });
});
