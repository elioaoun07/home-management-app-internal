import React from "react";
import { actionFields, initialAction } from "@/features/era/capabilities/preview";
import type { EffectiveAction } from "@/features/era/capabilities/effectiveAction";
import type { EraPlan } from "@/features/era/capabilities/plan";

/** Shared by transient and saved cards. Labels/values never come from plan prose. */
export function EraActionPreview({ plan, consent, referenceDate, timeZone, completed = [] }: {
  plan: EraPlan;
  consent?: Record<string, EffectiveAction>;
  referenceDate: string;
  timeZone: string;
  completed?: string[];
}) {
  return <ol className="space-y-3 text-[13px] text-white/80" aria-label="Effective actions">
    {plan.steps.filter(s => !completed.includes(s.id)).map(step => {
      const action = consent?.[step.id] ?? initialAction(step, new Date(referenceDate));
      const preview = actionFields(action, timeZone);
      return <li key={step.id} className="min-w-0 break-words">
        <p className="font-medium text-white/90">{preview.title}</p>
        <dl className="mt-1 space-y-1">
          {preview.fields.map((f, i) => <div key={i} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
            <dt className="text-white/40">{f.label}</dt><dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{f.value}</dd>
          </div>)}
        </dl>
      </li>;
    })}
  </ol>;
}
