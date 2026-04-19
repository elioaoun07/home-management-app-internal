"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionTypes, useUpdateAIModel } from "@/features/ai-usage";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import type { AIUsageModel } from "@/types/aiUsage";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Inline "Add this session's consumption" control.
 *
 * - Quick-add chips for each saved session type (+X% in one tap).
 * - Enter total usage % and it shows the delta to add.
 * - Adds to the model's current usage (does not replace it).
 */
export function AddSessionUsage({ model }: { model: AIUsageModel }) {
  const tc = useThemeClasses();
  const update = useUpdateAIModel();
  const { data: sessionTypes = [] } = useSessionTypes(model.id);
  const [totalInput, setTotalInput] = useState("");

  const addAmount = async (deltaPct: number, label?: string) => {
    if (!Number.isFinite(deltaPct) || deltaPct <= 0) return;
    const previousPct = Number(model.current_usage_pct) || 0;
    const newPct = Math.round((previousPct + deltaPct) * 10) / 10;
    try {
      await update.mutateAsync({ id: model.id, current_usage_pct: newPct });
      toast.success(
        label
          ? `+${fmt(deltaPct)}% (${label}) added`
          : `+${fmt(deltaPct)}% added`,
        {
          icon: ToastIcons.update,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await update.mutateAsync({
                  id: model.id,
                  current_usage_pct: previousPct,
                });
                toast.success("Reverted", { icon: ToastIcons.update });
              } catch {
                toast.error("Failed to undo", { icon: ToastIcons.error });
              }
            },
          },
        },
      );
      setTotalInput("");
    } catch {
      /* error toast already surfaced by mutation */
    }
  };

  const currentPct = Number(model.current_usage_pct) || 0;
  const parsedTotal = Number(totalInput.replace(",", "."));
  const deltaPct = parsedTotal - currentPct;
  const canAddManual =
    totalInput.trim() !== "" &&
    Number.isFinite(parsedTotal) &&
    Number.isFinite(deltaPct) &&
    deltaPct > 0;

  return (
    <div className={`rounded-lg border ${tc.border} p-3 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className={`text-xs font-medium ${tc.textMuted}`}>
          Add this session
        </div>
        <div className={`text-[11px] ${tc.textFaint}`}>
          Adds to current usage
        </div>
      </div>

      {sessionTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sessionTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={update.isPending}
              onClick={() =>
                addAmount(Number(t.estimated_usage_pct) || 0, t.name)
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${tc.border} ${tc.textMuted} hover:${tc.bgActive} hover:${tc.textHighlight} transition text-xs`}
            >
              <span className="truncate max-w-[120px]">{t.name}</span>
              <span className={`${tc.textFaint} tabular-nums`}>
                +{fmt(Number(t.estimated_usage_pct) || 0)}%
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
        <Input
          type="text"
          inputMode="decimal"
          placeholder="New total usage, e.g. 70.7"
          value={totalInput}
          onChange={(e) => setTotalInput(e.target.value)}
          className="h-9 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && canAddManual) {
              addAmount(deltaPct);
            }
          }}
        />
        <Button
          onClick={() => addAmount(deltaPct)}
          disabled={!canAddManual || update.isPending}
          className="h-9 px-3 text-xs whitespace-nowrap"
        >
          {canAddManual ? `Add +${fmt(deltaPct)}%` : "Add"}
        </Button>
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}
