import { z } from "zod";
import { parseSmartText } from "@/lib/smartTextParser";
import { localToISO } from "@/lib/utils/date";

export const effectiveActionSchema = z.object({
  capabilityId: z.string(),
  values: z.record(z.string(), z.json()),
}).strict();
export type EffectiveAction = z.infer<typeof effectiveActionSchema>;
export type BeforeWrite = (action: EffectiveAction) => Promise<boolean>;

/** The same parser/defaults used by reminder creation, anchored to capture. */
export function reminderValues(slots: Record<string, unknown>, referenceDate: Date) {
  const p = parseSmartText(String(slots.rawText), referenceDate);
  return {
    title: (String(slots.title ?? "").trim() || p.title?.trim() || "").trim(),
    due_at: p.dueDate && p.confidence.date > 0 ? localToISO(p.dueDate, p.dueTime || "12:00") : null,
    priority: p.priority,
    recurrence: p.recurrenceRule ?? "Once",
    alert: "Push at due time",
  };
}

export function waitingForConsent(action: EffectiveAction) {
  return { ok: false, text: "Confirm the effective action.", metadata: { notDispatched: true, effectiveAction: action } };
}

export function sameAction(a: EffectiveAction, b: EffectiveAction): boolean {
  const canonical = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    if (v && typeof v === "object") return `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
    return JSON.stringify(v);
  };
  return canonical(a) === canonical(b);
}
