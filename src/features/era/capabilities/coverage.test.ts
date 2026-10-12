import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ERA_CAPABILITIES } from "./registry";
import { applicationModules, capabilityDescriptors } from "./discovery";
import { auditCapabilityCoverage, exportedMethods, inventoryApis } from "../../../../scripts/era/apiInventory";

const root = path.resolve(__dirname, "../../../..");

describe("ERA integration coverage", () => {
  it("inventories exported API handlers without mistaking comments or internal functions for endpoints", () => {
    expect(exportedMethods(`
      // export async function DELETE() {}
      function PUT() {}
      export async function GET() {}
      export const POST = wrapper;
      export { handler as PATCH } from './internal';
    `)).toEqual(["GET", "PATCH", "POST"]);
  });

  it("reports new backend operations as unreviewed without granting authority", () => {
    const report = auditCapabilityCoverage([
      { path: "/api/wardrobe/new-feature", file: "route.ts", methods: ["GET", "POST"] },
    ], []);
    expect(report.errors).toEqual([]);
    expect(report.operations).toHaveLength(2);
    expect(report.operations.every((row) => row.status === "unreviewed" && !row.executable)).toBe(true);
  });

  it("rejects deleted routes and changed methods in registered adapters", () => {
    const report = auditCapabilityCoverage([
      { path: "/api/example", file: "route.ts", methods: ["GET"] },
    ], [{ id: "example.write", sources: [
      { kind: "api", path: "/api/example", methods: ["POST"] },
      { kind: "api", path: "/api/missing", methods: ["GET"] },
    ] }]);
    expect(report.errors).toEqual([
      "example.write: missing POST /api/example", "example.write: missing source /api/missing",
    ]);
  });

  it("all registered API sources still exist; optionally emits the full discovery report", () => {
    const routes = inventoryApis(root);
    expect(routes.length).toBeGreaterThan(200);
    const capabilities = capabilityDescriptors(ERA_CAPABILITIES);
    const report = auditCapabilityCoverage(routes, capabilities);
    expect(report.errors).toEqual([]);
    expect(report.operations.some((operation) => operation.path.startsWith("/api/healthcare"))).toBe(true);
    expect(report.operations.some((operation) => operation.path.startsWith("/api/trips"))).toBe(true);
    if (process.env.ERA_CAPABILITIES_REPORT === "1") {
      const directory = path.join(root, ".tmp/era-capabilities");
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify({
        version: 1,
        authority: "Only registered capability IDs are executable; API operations are discovery evidence, not approved tools.",
        capabilities, modules: applicationModules(ERA_CAPABILITIES), ...report,
      }, null, 2));
    }
  });
});
