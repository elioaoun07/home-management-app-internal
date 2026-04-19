"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  computeStatus,
  forecastTotal,
  useDeleteAIModel,
  useResetAIModelCycle,
  useUpdateAIModel,
} from "@/features/ai-usage";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import type { AIUsageModel, UpcomingAISession } from "@/types/aiUsage";
import { useMemo, useState } from "react";
import { AddSessionUsage } from "./AddSessionUsage";
import { SessionTypesEditor } from "./SessionTypesEditor";
import { UpcomingSessionsList } from "./UpcomingSessionsList";
import { UsageGauge } from "./UsageGauge";

const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

const STATUS_COLORS: Record<string, string> = {
  "on-pace": "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  ahead: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  behind: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  critical: "text-red-400 bg-red-500/10 border-red-500/40",
};

export function ModelCard({
  model,
  upcoming,
}: {
  model: AIUsageModel;
  upcoming: UpcomingAISession[];
}) {
  const tc = useThemeClasses();
  const update = useUpdateAIModel();
  const resetCycle = useResetAIModelCycle();
  const deleteModel = useDeleteAIModel();

  const status = useMemo(() => computeStatus(model), [model]);
  const upcomingTotal = forecastTotal(upcoming);

  const [editing, setEditing] = useState(false);
  const [editingDayOfMonth, setEditingDayOfMonth] = useState(false);
  const [editMode, setEditMode] = useState<"day" | "anchor">(
    model.cycle_anchor_date ? "anchor" : "day",
  );
  const [draftPct, setDraftPct] = useState(String(model.current_usage_pct));
  const [draftDay, setDraftDay] = useState(String(model.cycle_start_day ?? ""));
  const [draftAnchor, setDraftAnchor] = useState(model.cycle_anchor_date ?? "");
  const [expanded, setExpanded] = useState(false);

  const openResetEditor = () => {
    setEditMode(model.cycle_anchor_date ? "anchor" : "day");
    setDraftDay(String(model.cycle_start_day ?? ""));
    setDraftAnchor(model.cycle_anchor_date ?? "");
    setEditingDayOfMonth(true);
  };

  const cancelResetEditor = () => {
    setDraftDay(String(model.cycle_start_day ?? ""));
    setDraftAnchor(model.cycle_anchor_date ?? "");
    setEditMode(model.cycle_anchor_date ? "anchor" : "day");
    setEditingDayOfMonth(false);
  };

  const saveResetEditor = async () => {
    if (editMode === "anchor") {
      if (!draftAnchor || !/^\d{4}-\d{2}-\d{2}$/.test(draftAnchor)) {
        cancelResetEditor();
        return;
      }
      await update.mutateAsync({
        id: model.id,
        cycle_anchor_date: draftAnchor,
        cycle_start_day: null,
      });
    } else {
      const max = model.refresh_frequency === "weekly" ? 7 : 31;
      const day = draftDay ? parseInt(draftDay, 10) : null;
      if (!day || day < 1 || day > max) {
        cancelResetEditor();
        return;
      }
      await update.mutateAsync({
        id: model.id,
        cycle_start_day: day,
        cycle_anchor_date: null,
      });
    }
    setEditingDayOfMonth(false);
  };

  const saveUsage = async () => {
    const pct = Number(draftPct.replace(",", "."));
    if (Number.isNaN(pct) || pct < 0) {
      setDraftPct(String(model.current_usage_pct));
      setEditing(false);
      return;
    }
    await update.mutateAsync({ id: model.id, current_usage_pct: pct });
    setEditing(false);
  };

  return (
    <div className={`neo-card rounded-xl p-4 space-y-4 border ${tc.border}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className={`text-base font-semibold ${tc.textHighlight} truncate`}
          >
            {model.name}
          </h2>
          <p className={`text-xs ${tc.textMuted} capitalize`}>
            {model.refresh_frequency} cycle · {status.cycleStart} →{" "}
            {status.cycleEnd}
          </p>
          {model.refresh_frequency === "weekly" && (
            <div className={`text-xs ${tc.textMuted} mt-1`}>
              {editingDayOfMonth ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1">
                    {[
                      { val: "day" as const, label: "Day of week" },
                      { val: "anchor" as const, label: "Specific date" },
                    ].map(({ val, label }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setEditMode(val)}
                        className={`px-2 py-0.5 text-[11px] rounded border transition ${
                          editMode === val
                            ? `${tc.bgActive} ${tc.textHighlight} ${tc.borderActive}`
                            : `${tc.border} ${tc.textMuted}`
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {editMode === "day" ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>Resets on </span>
                      <div className="flex gap-1">
                        {[
                          { label: "Mon", val: 1 },
                          { label: "Tue", val: 2 },
                          { label: "Wed", val: 3 },
                          { label: "Thu", val: 4 },
                          { label: "Fri", val: 5 },
                          { label: "Sat", val: 6 },
                          { label: "Sun", val: 7 },
                        ].map(({ label, val }) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setDraftDay(String(val))}
                            className={`w-6 h-6 text-xs rounded transition ${
                              parseInt(draftDay, 10) === val
                                ? `${tc.bgActive} ${tc.textHighlight} border ${tc.borderActive}`
                                : `${tc.border} border ${tc.textMuted}`
                            }`}
                          >
                            {label[0]}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={saveResetEditor}
                        disabled={update.isPending}
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelResetEditor}
                        className={`text-xs ${tc.textFaint}`}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>Anchor </span>
                      <input
                        type="date"
                        value={draftAnchor}
                        onChange={(e) => setDraftAnchor(e.target.value)}
                        className="h-6 px-1 text-xs border rounded bg-white/5"
                      />
                      <button
                        onClick={saveResetEditor}
                        disabled={update.isPending || !draftAnchor}
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelResetEditor}
                        className={`text-xs ${tc.textFaint}`}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={openResetEditor} className={`${tc.textHover}`}>
                  {model.cycle_anchor_date
                    ? `Resets weekly from ${model.cycle_anchor_date}`
                    : `Resets on ${
                        model.cycle_start_day
                          ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                              model.cycle_start_day - 1
                            ]
                          : "Monday"
                      }`}
                </button>
              )}
            </div>
          )}

          {model.refresh_frequency === "monthly" && (
            <div className={`text-xs ${tc.textMuted} mt-1`}>
              {editingDayOfMonth ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1">
                    {[
                      { val: "day" as const, label: "Day of month" },
                      { val: "anchor" as const, label: "Specific date" },
                    ].map(({ val, label }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setEditMode(val)}
                        className={`px-2 py-0.5 text-[11px] rounded border transition ${
                          editMode === val
                            ? `${tc.bgActive} ${tc.textHighlight} ${tc.borderActive}`
                            : `${tc.border} ${tc.textMuted}`
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {editMode === "day" ? (
                    <div className="flex items-center gap-2">
                      <span>Resets day </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={draftDay}
                        onChange={(e) =>
                          setDraftDay(
                            e.target.value
                              ? String(parseInt(e.target.value, 10) || "")
                              : "",
                          )
                        }
                        className="w-10 h-6 px-1 text-xs text-center border rounded bg-white/5"
                      />
                      <button
                        onClick={saveResetEditor}
                        disabled={update.isPending}
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelResetEditor}
                        className={`text-xs ${tc.textFaint}`}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>Anchor </span>
                      <input
                        type="date"
                        value={draftAnchor}
                        onChange={(e) => setDraftAnchor(e.target.value)}
                        className="h-6 px-1 text-xs border rounded bg-white/5"
                      />
                      <button
                        onClick={saveResetEditor}
                        disabled={update.isPending || !draftAnchor}
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelResetEditor}
                        className={`text-xs ${tc.textFaint}`}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={openResetEditor} className={`${tc.textHover}`}>
                  {model.cycle_anchor_date
                    ? `Resets monthly from ${model.cycle_anchor_date}`
                    : `Resets day ${model.cycle_start_day ?? 1}`}
                </button>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            if (
              confirm(
                `Reset cycle for "${model.name}"? Usage will return to 0%.`,
              )
            ) {
              resetCycle.mutate(model.id);
            }
          }}
          disabled={resetCycle.isPending}
          className={`text-xs px-2 py-1 rounded border ${tc.border} ${tc.textMuted} ${tc.textHover}`}
        >
          Reset now
        </button>
      </div>

      {/* Usage gauge + % input */}
      <div className="space-y-3">
        <UsageGauge status={status} />

        <div className="flex items-center justify-between gap-3">
          <div className={`text-xs ${tc.textMuted}`}>Current usage</div>
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={draftPct}
                onChange={(e) => setDraftPct(e.target.value)}
                className="h-8 w-20 text-right"
                autoFocus
              />
              <span className={`text-sm ${tc.textMuted}`}>%</span>
              <Button
                onClick={saveUsage}
                disabled={update.isPending}
                className="h-8 px-3 text-xs"
              >
                Save
              </Button>
              <button
                onClick={() => {
                  setDraftPct(String(model.current_usage_pct));
                  setEditing(false);
                }}
                className={`text-xs ${tc.textFaint} ${tc.textHover}`}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setDraftPct(String(model.current_usage_pct));
                setEditing(true);
              }}
              className={`text-sm font-medium ${tc.textHighlight} ${tc.textHover}`}
            >
              Edit ({fmt(status.currentPct)}%)
            </button>
          )}
        </div>
      </div>

      {/* Add this session */}
      <AddSessionUsage model={model} />

      {/* Status banner */}
      <div
        className={`rounded-lg border px-3 py-2 text-sm ${
          STATUS_COLORS[status.status] ?? STATUS_COLORS["on-pace"]
        }`}
      >
        {status.advice}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="Remaining" value={`${fmt(status.remainingPct)}%`} muted />
        <Stat
          label="Daily avg so far"
          value={`${fmt(status.dailyPaceSoFar)}%/day`}
          muted
        />
        <Stat
          label="Safe pace"
          value={`${fmt(status.paceToFinish)}%/day`}
          muted
        />
        <Stat
          label="Rest days to catch up"
          value={status.restDaysNeeded > 0 ? `${status.restDaysNeeded}` : "—"}
          muted
        />
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <div className={`text-xs font-medium ${tc.textMuted}`}>
            Upcoming AI sessions ({upcoming.length}) — forecast{" "}
            <span className={tc.textHighlight}>{fmt(upcomingTotal)}%</span>
          </div>
          <UpcomingSessionsList
            sessions={upcoming}
            remainingPct={status.remainingPct}
          />
        </div>
      )}

      {/* Expandable: session types editor + delete */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`text-xs ${tc.textMuted} ${tc.textHover}`}
        >
          {expanded ? "Hide" : "Show"} session types
        </button>
        <button
          onClick={() => {
            if (
              confirm(
                `Delete model "${model.name}"? Its session types will also be removed.`,
              )
            ) {
              deleteModel.mutate(model.id);
            }
          }}
          className="text-xs text-red-400 hover:text-red-300"
          disabled={deleteModel.isPending}
        >
          Delete model
        </button>
      </div>

      {expanded && <SessionTypesEditor modelId={model.id} />}
    </div>
  );
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  const tc = useThemeClasses();
  return (
    <div className={`rounded-lg px-3 py-2 ${muted ? "bg-white/5" : ""}`}>
      <div className={`text-[11px] ${tc.textFaint}`}>{label}</div>
      <div className={`text-sm font-medium ${tc.textHighlight}`}>{value}</div>
    </div>
  );
}
