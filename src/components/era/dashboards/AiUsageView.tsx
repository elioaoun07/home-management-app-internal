"use client";

// ERA AI Usage — desktop-only tab next to Artifacts. One month at a time:
// per local day, the chats that reached the model (click → reopen the chat),
// calls (auto-escalations counted separately), tokens and estimated cost.
// Native-only turns never call a model, so they never appear. See
// src/features/era/aiUsage.ts.

import {
  type AiUsageChat,
  type AiUsageTotals,
  formatUsd,
  monthKeyOf,
  shiftMonth,
} from "@/features/era/aiUsage";
import { dateOfDayKey } from "@/features/era/widgets/useEraArtifacts";
import { useEraAiUsage } from "@/features/era/useEraAiUsage";
import { useResumeEraConversation } from "@/features/era/useEraConversation";
import { useEraStore } from "@/features/era/useEraStore";
import type { FaceKey } from "@/features/era/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { EraStatCard } from "./EraStatCard";

const HUE = 190;
const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

const surface = {
  background: `hsla(${HUE}, 18%, 7%, 0.82)`,
  border: `1px solid hsla(${HUE}, 55%, 45%, 0.22)`,
};
const rule = { borderColor: `hsla(${HUE}, 55%, 45%, 0.12)` };

const monthLabel = (key: string) =>
  dateOfDayKey(`${key}-01`).toLocaleDateString([], { month: "long", year: "numeric" });
const dayLabel = (key: string) =>
  dateOfDayKey(key).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

function Cost({ t }: { t: AiUsageTotals }) {
  return (
    <span title={t.unpricedTokens ? `${t.unpricedTokens.toLocaleString()} tokens unpriced` : undefined}>
      {formatUsd(t.cost)}
      {t.unpricedTokens > 0 && "+"}
    </span>
  );
}

function Calls({ t }: { t: AiUsageTotals }) {
  return (
    <>
      {t.calls}
      {t.autoCalls > 0 && <span className="ml-1 text-xs text-white/40">({t.autoCalls} auto)</span>}
    </>
  );
}

export function AiUsageView() {
  const currentMonth = monthKeyOf(new Date());
  const [monthKey, setMonthKey] = useState(currentMonth);
  const { data, isLoading, isError } = useEraAiUsage(monthKey);
  const resume = useResumeEraConversation();
  const setActiveView = useEraStore((s) => s.setActiveView);

  const openChat = (chat: AiUsageChat) => {
    resume.mutate({ ...chat, active_face_key: chat.active_face_key as FaceKey });
    setActiveView("hub");
  };

  const total = data?.total;
  const days = data?.days ?? [];
  const navBtn = "flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/70 disabled:opacity-25";
  const num = "px-3 py-2.5 text-right tabular-nums";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-3 pb-6">
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label="Previous month" onClick={() => setMonthKey(shiftMonth(monthKey, -1))} className={navBtn}>
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-h-11 flex-1 rounded-xl px-3 py-2.5 text-center text-base font-medium text-white/85" style={surface}>
          {monthLabel(monthKey)}
        </div>
        <button
          type="button"
          aria-label="Next month"
          disabled={monthKey >= currentMonth}
          onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
          className={navBtn}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <EraStatCard label="Est. cost" value={total ? formatUsd(total.cost) : "—"} hue={HUE} loading={isLoading} />
        <EraStatCard
          label="Tokens"
          value={total ? compact.format(total.input + total.output) : "—"}
          sub={total ? `${compact.format(total.input)} in · ${compact.format(total.output)} out` : undefined}
          hue={HUE}
          loading={isLoading}
        />
        <EraStatCard
          label="AI calls"
          value={total?.calls ?? "—"}
          sub={total?.autoCalls ? `${total.autoCalls} auto` : undefined}
          hue={HUE}
          loading={isLoading}
        />
      </div>

      {isError && (
        <div className="rounded-2xl p-6 text-center text-sm text-white/50" style={surface}>
          Couldn&apos;t load usage
        </div>
      )}

      {!isLoading && !isError && days.length === 0 && (
        <div className="rounded-2xl p-6 text-center text-sm text-white/50" style={surface}>
          Nothing
        </div>
      )}

      {days.length > 0 && total && (
        <div className="overflow-hidden rounded-2xl" style={surface}>
          <table className="w-full text-sm text-white/80">
            <thead
              className="text-xs font-medium uppercase tracking-wide"
              style={{ background: `hsla(${HUE}, 60%, 40%, 0.12)`, color: `hsl(${HUE}, 72%, 68%)` }}
            >
              <tr>
                <th className="px-3 py-2 text-left">Day</th>
                <th className="px-3 py-2 text-left">Chats</th>
                <th className="px-3 py-2 text-right">Calls</th>
                <th className="px-3 py-2 text-right">Input</th>
                <th className="px-3 py-2 text-right">Output</th>
                <th className="px-3 py-2 text-right">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.key} className="border-t align-top" style={rule}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/85">{dayLabel(d.key)}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-col items-start">
                      {d.chats.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => openChat(c)}
                          className="max-w-[18rem] truncate py-1 text-left text-cyan-400 hover:underline"
                        >
                          {c.title}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className={num}><Calls t={d} /></td>
                  <td className={num}>{d.input.toLocaleString()}</td>
                  <td className={num}>{d.output.toLocaleString()}</td>
                  <td className={num}><Cost t={d} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-semibold text-white/90">
              <tr className="border-t" style={{ borderColor: `hsla(${HUE}, 55%, 45%, 0.3)` }}>
                <td className="px-3 py-2.5" colSpan={2}>Total</td>
                <td className={num}><Calls t={total} /></td>
                <td className={num}>{total.input.toLocaleString()}</td>
                <td className={num}>{total.output.toLocaleString()}</td>
                <td className={num}><Cost t={total} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
