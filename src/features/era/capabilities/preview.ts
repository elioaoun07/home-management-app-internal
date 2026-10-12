import { getCapability } from "./registry";
import { inputSchema } from "./discovery";
import { effectiveActionSchema, type EffectiveAction } from "./effectiveAction";
import type { EraPlanStep } from "./plan";

export function initialAction(step: EraPlanStep, referenceDate: Date): EffectiveAction {
  const cap = getCapability(step.capabilityId);
  const parsed = cap && inputSchema(cap).safeParse(step.slots);
  const values = parsed && parsed.success
    ? cap!.confirmation?.initialValues?.(parsed.data as Record<string, unknown>, referenceDate) ?? parsed.data
    : Object.fromEntries(Object.entries(step.slots).map(([k, v]) => [k,
        v && typeof v === "object" && "step" in v && "field" in v
          ? `Pending · ${v.step}.${v.field}` : v]));
  return effectiveActionSchema.parse({ capabilityId: step.capabilityId, values: JSON.parse(JSON.stringify(values)) });
}

export function actionFields(action: EffectiveAction, timeZone: string) {
  const contract = getCapability(action.capabilityId)?.confirmation;
  return {
    title: contract?.title ?? getCapability(action.capabilityId)?.description ?? "Unavailable action",
    fields: Object.entries(action.values).filter(([key, value]) => key !== "unresolvedGroup" || value !== null).map(([key, value]) => {
      let display = value === null
        ? (key === "groupId" ? "General" : ["category_id", "subcategory_id", "description"].includes(key) ? "None" : "Unresolved")
        : Array.isArray(value) ? value.join(" · ") : String(value);
      if (typeof value === "string" && value.startsWith("Pending · ")) display = "Pending";
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value))
        display = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value)) + ` · ${timeZone}`;
      return { label: contract?.fields[key] ?? key, value: display };
    }),
  };
}
