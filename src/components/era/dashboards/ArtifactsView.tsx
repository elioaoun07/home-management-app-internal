"use client";

// ERA Artifacts — today's log of everything ERA itself created or updated
// (reminders, transactions, transfers, debts, meal plans, memories), each
// row deep-linking back to where it lives. Not a face — no dashboard hue,
// just the neutral chat teal.

import { useEraActivity, type EraActivityItem } from "@/features/era/widgets/useEraActivity";
import { useRouter } from "next/navigation";
import { EraStatCard } from "./EraStatCard";

const HUE = 190;

const ENTITY_LABEL: Record<EraActivityItem["entity_type"], string> = {
  reminder: "Reminder",
  transaction: "Transaction",
  transfer: "Transfer",
  debt: "Debt",
  meal_plan: "Meal plan",
  memory: "Memory",
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ArtifactsView() {
  const { data, isLoading } = useEraActivity();
  const router = useRouter();
  const items = data ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 py-3 pb-6">
      <button type="button" onClick={() => router.push("/activity-log")} className="min-h-11 self-start text-sm text-cyan-400">
        Household activity →
      </button>
      <div className="grid grid-cols-2 gap-3">
        <EraStatCard
          hue={HUE}
          label="Today"
          value={isLoading ? "…" : items.length}
          sub="ERA-created or updated"
          loading={isLoading}
        />
      </div>

      {!isLoading && items.length === 0 && (
        <div
          className="flex flex-col gap-1.5 rounded-2xl p-6 text-center"
          style={{
            background: `hsla(${HUE}, 18%, 7%, 0.82)`,
            border: `1px solid hsla(${HUE}, 55%, 45%, 0.22)`,
          }}
        >
          <p className="text-sm text-white/60">Nothing yet today</p>
          <p className="text-xs text-white/35">
            Ask ERA to do something — a reminder, an expense, a transfer — and it shows up here.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => router.push(item.route)}
            className="flex items-center justify-between gap-3 rounded-2xl p-4 text-left transition-opacity hover:opacity-80"
            style={{
              background: `hsla(${HUE}, 18%, 7%, 0.82)`,
              border: `1px solid hsla(${HUE}, 55%, 45%, 0.22)`,
            }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white/85">{item.title}</p>
              <p className="text-xs text-white/40">{ENTITY_LABEL[item.entity_type]}</p>
            </div>
            <span className="shrink-0 text-xs text-white/40">
              {formatRelativeTime(item.created_at)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
