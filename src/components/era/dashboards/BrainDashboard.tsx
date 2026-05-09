"use client";

// ERA Brain Dashboard — household memory grid, quick-save form.

import { useEraStore } from "@/features/era/useEraStore";
import {
  useCreateMemory,
  useDeleteMemory,
  useMemories,
} from "@/features/memories/hooks";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { EraStatCard } from "./EraStatCard";

const HUE = 220;
const ACCENT = `hsl(${HUE}, 72%, 68%)`;

export function BrainDashboard() {
  const { data: rawMemories, isLoading } = useMemories();
  const memories = Array.isArray(rawMemories) ? rawMemories : [];
  const createMemory = useCreateMemory();
  const deleteMemory = useDeleteMemory();
  const setPendingTranscript = useEraStore((s) => s.setPendingTranscript);

  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!label.trim() || !value.trim()) return;
    setSaving(true);
    try {
      await createMemory.mutateAsync({
        label: label.trim(),
        value: value.trim(),
      });
      setLabel("");
      setValue("");
      setAddOpen(false);
    } catch {
      // silently ignore — user can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-3 pb-6">
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3">
        <EraStatCard
          hue={HUE}
          label="Memories saved"
          value={isLoading ? "…" : memories.length}
          sub="in your household"
          loading={isLoading}
        />
        <EraStatCard
          hue={HUE}
          label="Latest"
          value={memories[0]?.label ?? "—"}
          sub={memories[0]?.value ?? "nothing yet"}
          loading={isLoading}
        />
      </div>

      {/* Memory grid */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: `hsla(${HUE}, 18%, 7%, 0.82)`,
          border: `1px solid hsla(${HUE}, 55%, 45%, 0.18)`,
          backdropFilter: "blur(14px)",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.13em]"
            style={{ color: `hsla(${HUE}, 60%, 65%, 0.65)` }}
          >
            All memories
          </p>
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-opacity hover:opacity-80"
            style={{
              background: `hsla(${HUE}, 45%, 20%, 0.6)`,
              border: `1px solid hsla(${HUE}, 55%, 45%, 0.22)`,
              color: ACCENT,
            }}
          >
            <Plus className="size-3" />
            Add
          </button>
        </div>

        {/* Quick add form */}
        {addOpen && (
          <div
            className="mb-4 flex flex-col gap-2 rounded-xl p-3"
            style={{
              background: `hsla(${HUE}, 20%, 9%, 0.7)`,
              border: `1px solid hsla(${HUE}, 50%, 40%, 0.18)`,
            }}
          >
            <input
              type="text"
              placeholder="Label (e.g. car maintenance number)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/75 outline-none placeholder:text-white/25 focus:bg-white/8"
            />
            <input
              type="text"
              placeholder="Value (e.g. 70-123456)"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/75 outline-none placeholder:text-white/25 focus:bg-white/8"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!label.trim() || !value.trim() || saving}
              className="self-end rounded-full px-4 py-1 text-xs font-medium transition-opacity disabled:opacity-30"
              style={{ background: ACCENT, color: "#0d1220" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-white/5"
              />
            ))}
          </div>
        ) : memories.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/30">
            No memories yet. Say{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              style={{ color: `hsla(${HUE}, 60%, 65%, 0.6)` }}
              onClick={() => {
                setPendingTranscript("Remember the ");
              }}
            >
              "Remember the car maintenance number is…"
            </button>
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {memories.map((m) => (
              <div
                key={m.id}
                className="group relative flex flex-col gap-1 rounded-xl px-3 py-2.5"
                style={{
                  background: `hsla(${HUE}, 20%, 9%, 0.6)`,
                  border: `1px solid hsla(${HUE}, 50%, 40%, 0.12)`,
                }}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: `hsla(${HUE}, 60%, 65%, 0.55)` }}
                >
                  {m.label}
                </span>
                <span className="text-sm text-white/70">{m.value}</span>

                <button
                  type="button"
                  onClick={() => deleteMemory.mutate(m.id)}
                  className="absolute right-2 top-2 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
