// One discovery contract for the model, application introspection and repo audit.
// Sources are evidence only; the registry's execute function grants authority.
import { z } from "zod";
import { ERA_REACH } from "../reach";
import type { EraCapability, EraCapabilityResult } from "./types";

type Catalog = Readonly<Record<string, EraCapability<unknown>>>;

export function inputSchema(capability: EraCapability<unknown>) {
  return capability.slots instanceof z.ZodObject
    ? capability.slots.strict()
    : capability.slots;
}

/** Fail visibly for an unsupported schema rather than advertise a weaker one. */
function jsonSchema(schema: z.ZodType, io: "input" | "output") {
  const { $schema: dialect, ...contract } = z.toJSONSchema(schema, { io });
  void dialect;
  return contract;
}

export function capabilityDescriptors(catalog: Catalog) {
  return Object.values(catalog).map((capability) => ({
    id: capability.id,
    module: capability.module,
    entity: capability.entity,
    operation: capability.operation,
    description: capability.description,
    input: jsonSchema(inputSchema(capability), "input"),
    outputs: Object.fromEntries(
      Object.entries(capability.outputs ?? {}).map(([field, output]) => [
        field,
        jsonSchema(output.schema, "output"),
      ]),
    ),
    constraints: capability.constraints ?? [],
    entityRefSlot: capability.entityRefSlot,
    referenceSource: capability.referenceSource,
    destructive: capability.destructive === true,
    confirmationRequired: capability.operation !== "read",
    // This describes recovery policy, NOT source idempotency certification.
    recovery: capability.operation === "read" ? "refetch" : "inspect-before-retry",
    sources: capability.sources,
  }));
}

export function describeCapabilityCatalog(catalog: Catalog): string {
  return capabilityDescriptors(catalog)
    .map((capability) => [
      `- ${capability.id} (${capability.entity}, ${capability.operation}) — ${capability.description}`,
      `module: ${capability.module}`,
      `slots: ${JSON.stringify(capability.input)}`,
      ...(Object.keys(capability.outputs).length ? [
        `dependency outputs: ${Object.keys(capability.outputs).join(", ")}`,
        `output schemas: ${JSON.stringify(capability.outputs)}`,
      ] : []),
      ...(capability.entityRefSlot ? [
        `entity reference: ${capability.entityRefSlot}; FOCUS or an earlier ${capability.referenceSource?.entity}.${capability.referenceSource?.field} output only`,
      ] : []),
      ...capability.constraints,
      capability.confirmationRequired
        ? "Requires Confirm; an unknown write outcome must be inspected, never automatically replayed."
        : "Read only.",
    ].join(" | "))
    .join("\n");
}

/** Native inline reach and executable agent reach are deliberately separate. */
export function applicationModules(catalog: Catalog) {
  return ERA_REACH.map((row) => ({
    module: row.module,
    page: row.route,
    topics: row.words,
    capabilities: Object.values(catalog)
      .filter((capability) => capability.module === row.module)
      .map((capability) => ({
        id: capability.id,
        description: capability.description,
        operation: capability.operation,
      })),
    limitation: row.note,
  }));
}

export function describeModuleAvailability(catalog: Catalog): string {
  return applicationModules(catalog).map((row) =>
    `- ${row.module}: ${row.capabilities.length
      ? row.capabilities.map((capability) => capability.id).join(", ")
      : "no registered agent actions"}; ${row.page ? "precision page available" : "no owner page"}`,
  ).join("\n");
}

export function describeApplication(catalog: Catalog, query?: string): EraCapabilityResult {
  const words = query?.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean) ?? [];
  const modules = applicationModules(catalog).filter((row) => {
    const searchable = [row.module, ...row.topics,
      ...row.capabilities.map((capability) => `${capability.id} ${capability.description}`),
    ].join(" ").toLowerCase();
    return words.every((word) => searchable.includes(word));
  });
  return {
    ok: true,
    text: modules.length ? modules.map((row) =>
      `${row.module} · ${row.capabilities.length
        ? row.capabilities.map((capability) => capability.description).join(" ")
        : "Use the app page."}${row.page ? ` (${row.page})` : ""}`,
    ).join("\n") : "No matching capabilities.",
    metadata: { modules },
  };
}
