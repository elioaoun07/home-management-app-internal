"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateAIModel } from "@/features/ai-usage";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import type { RefreshFrequency } from "@/types/aiUsage";
import { useState } from "react";

export function AddModelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const tc = useThemeClasses();
  const create = useCreateAIModel();
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<RefreshFrequency>("monthly");
  const [currentPct, setCurrentPct] = useState("0");
  const [cycleStartDay, setCycleStartDay] = useState<number | null>(null);
  const [resetMode, setResetMode] = useState<"day" | "anchor">("day");
  const [anchorDate, setAnchorDate] = useState<string>("");

  const reset = () => {
    setName("");
    setFrequency("monthly");
    setCurrentPct("0");
    setCycleStartDay(null);
    setResetMode("day");
    setAnchorDate("");
  };

  const submit = async () => {
    const pct = Number(currentPct.replace(",", ".")) || 0;
    if (!name.trim()) return;
    if (resetMode === "anchor" && !anchorDate) return;
    try {
      await create.mutateAsync({
        name: name.trim(),
        refresh_frequency: frequency,
        current_usage_pct: pct,
        cycle_start_day: resetMode === "day" ? cycleStartDay : null,
        cycle_anchor_date: resetMode === "anchor" ? anchorDate : null,
      });
      reset();
      onOpenChange(false);
    } catch {
      /* handled by mutation toast */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className={tc.bgPage}>
        <DialogHeader>
          <DialogTitle>Add AI model</DialogTitle>
          <DialogDescription>
            Track a new AI model&apos;s usage independently.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-model-name">Model name</Label>
            <Input
              id="ai-model-name"
              placeholder="e.g. Claude Sonnet 4.7"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Refresh frequency</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["weekly", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFrequency(f);
                    if (f === "weekly") setCycleStartDay(null);
                  }}
                  className={`h-10 rounded-lg border text-sm capitalize transition ${
                    frequency === f
                      ? `${tc.borderActive} ${tc.textHighlight} ${tc.bgActive}`
                      : `${tc.border} ${tc.textMuted}`
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {frequency === "weekly" && (
            <div className="space-y-1.5">
              <Label>Reset mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { val: "day", label: "Day of week" },
                    { val: "anchor", label: "Specific date" },
                  ] as const
                ).map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setResetMode(val)}
                    className={`h-10 rounded-lg border text-sm transition ${
                      resetMode === val
                        ? `${tc.borderActive} ${tc.textHighlight} ${tc.bgActive}`
                        : `${tc.border} ${tc.textMuted}`
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequency === "weekly" && resetMode === "day" && (
            <div className="space-y-1.5">
              <Label>Reset day of week</Label>
              <div className="grid grid-cols-7 gap-1.5">
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
                    onClick={() => setCycleStartDay(val)}
                    className={`h-8 rounded text-xs font-medium transition ${
                      cycleStartDay === val
                        ? `${tc.bgActive} ${tc.textHighlight} ${tc.borderActive} border`
                        : `${tc.border} border ${tc.textMuted}`
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className={`text-xs ${tc.textFaint}`}>
                Leave blank to reset every 7 days from creation.
              </p>
            </div>
          )}

          {frequency === "monthly" && (
            <div className="space-y-1.5">
              <Label>Reset mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { val: "day", label: "Day of month" },
                    { val: "anchor", label: "Specific date" },
                  ] as const
                ).map(({ val, label }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setResetMode(val)}
                    className={`h-10 rounded-lg border text-sm transition ${
                      resetMode === val
                        ? `${tc.borderActive} ${tc.textHighlight} ${tc.bgActive}`
                        : `${tc.border} ${tc.textMuted}`
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequency === "monthly" && resetMode === "day" && (
            <div className="space-y-1.5">
              <Label htmlFor="ai-cycle-day">Reset day of month (1–31)</Label>
              <Input
                id="ai-cycle-day"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 1 or 15"
                value={cycleStartDay ?? ""}
                onChange={(e) => {
                  const v = e.target.value
                    ? parseInt(e.target.value, 10)
                    : null;
                  setCycleStartDay(v && v >= 1 && v <= 31 ? v : null);
                }}
              />
              <p className={`text-xs ${tc.textFaint}`}>
                Leave blank to reset on the calendar month boundary.
              </p>
            </div>
          )}

          {resetMode === "anchor" && (
            <div className="space-y-1.5">
              <Label htmlFor="ai-anchor-date">Anchor reset date</Label>
              <Input
                id="ai-anchor-date"
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
              />
              <p className={`text-xs ${tc.textFaint}`}>
                {frequency === "weekly"
                  ? "Cycle rolls forward 7 days from this date, forever."
                  : "Cycle rolls forward 1 month from this date, forever."}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ai-model-pct">Current usage (%)</Label>
            <Input
              id="ai-model-pct"
              type="text"
              inputMode="decimal"
              value={currentPct}
              onChange={(e) => setCurrentPct(e.target.value)}
            />
            <p className={`text-xs ${tc.textFaint}`}>
              Enter whatever your provider dashboard shows right now.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Adding…" : "Add model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
