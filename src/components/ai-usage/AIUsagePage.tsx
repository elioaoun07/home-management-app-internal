"use client";

import { Button } from "@/components/ui/button";
import {
  nextCycleStartIfExpired,
  useAIModels,
  useAutoAdvanceAIModel,
  useUpcomingAISessions,
} from "@/features/ai-usage";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AddModelDialog } from "./AddModelDialog";
import { ModelCard } from "./ModelCard";

export function AIUsagePage() {
  const tc = useThemeClasses();
  const { data: models = [], isLoading } = useAIModels();
  const { data: upcoming = [] } = useUpcomingAISessions();
  const autoAdvance = useAutoAdvanceAIModel();
  const [addOpen, setAddOpen] = useState(false);

  // Auto-advance any model whose cycle has expired since last open.
  // Runs once per model id per mount to avoid loops.
  const advancedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const m of models) {
      if (advancedRef.current.has(m.id)) continue;
      const next = nextCycleStartIfExpired(m);
      if (next) {
        advancedRef.current.add(m.id);
        autoAdvance.mutate({ id: m.id, cycle_start_date: next });
      }
    }
  }, [models, autoAdvance]);

  return (
    <main className={`min-h-screen ${tc.bgPage}`}>
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-24 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className={`text-2xl font-semibold ${tc.textHighlight}`}>
              AI Usage
            </h1>
            <p className={`text-sm ${tc.textMuted}`}>
              Track your token consumption and pace across models.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/focus"
              className={`text-xs px-3 py-2 rounded-lg border ${tc.border} ${tc.textMuted} ${tc.textHover}`}
            >
              Back
            </Link>
            <Button
              onClick={() => setAddOpen(true)}
              className="h-9 px-3 text-sm"
            >
              Add model
            </Button>
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : models.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          <div className="space-y-4">
            {models.map((m) => (
              <ModelCard
                key={m.id}
                model={m}
                upcoming={upcoming.filter((s) => s.model_id === m.id)}
              />
            ))}
          </div>
        )}
      </div>

      <AddModelDialog open={addOpen} onOpenChange={setAddOpen} />
    </main>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const tc = useThemeClasses();
  return (
    <div
      className={`neo-card rounded-xl p-8 text-center space-y-3 border ${tc.border}`}
    >
      <h2 className={`text-lg font-medium ${tc.textHighlight}`}>
        No models yet
      </h2>
      <p className={`text-sm ${tc.textMuted}`}>
        Add your first AI model to start tracking usage %, pace, and forecast
        upcoming AI-tagged tasks from your schedule.
      </p>
      <Button onClick={onAdd}>Add your first model</Button>
    </div>
  );
}
