"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreateSessionType,
  useDeleteSessionType,
  useSessionTypes,
  useUpdateSessionType,
} from "@/features/ai-usage";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import type { AISessionType } from "@/types/aiUsage";
import { useState } from "react";

export function SessionTypesEditor({ modelId }: { modelId: string }) {
  const tc = useThemeClasses();
  const { data: types = [], isLoading } = useSessionTypes(modelId);
  const create = useCreateSessionType(modelId);

  const [name, setName] = useState("");
  const [pct, setPct] = useState("");

  const add = async () => {
    const trimmed = name.trim();
    const n = Number(pct.replace(",", "."));
    if (!trimmed || Number.isNaN(n) || n < 0) return;
    try {
      await create.mutateAsync({ name: trimmed, estimated_usage_pct: n });
      setName("");
      setPct("");
    } catch {
      /* handled via toast */
    }
  };

  return (
    <div className={`rounded-lg border ${tc.border} p-3 space-y-3`}>
      <div className={`text-xs font-medium ${tc.textMuted}`}>Session types</div>

      {isLoading ? (
        <div className="h-8 rounded bg-white/5 animate-pulse" />
      ) : types.length === 0 ? (
        <p className={`text-xs ${tc.textFaint}`}>
          Define session templates (e.g. &quot;Application&quot; = 25%) so you
          can forecast upcoming AI tasks from your schedule.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {types.map((t) => (
            <SessionTypeRow key={t.id} modelId={modelId} type={t} />
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[1fr_80px_auto] gap-2 items-center">
        <Input
          placeholder="e.g. Application"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 text-sm"
        />
        <Input
          type="text"
          inputMode="decimal"
          placeholder="% used"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          className="h-9 text-sm text-right"
        />
        <Button
          onClick={add}
          disabled={!name.trim() || !pct || create.isPending}
          className="h-9 px-3 text-xs"
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function SessionTypeRow({
  modelId,
  type,
}: {
  modelId: string;
  type: AISessionType;
}) {
  const tc = useThemeClasses();
  const update = useUpdateSessionType(modelId);
  const del = useDeleteSessionType(modelId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(type.name);
  const [pct, setPct] = useState(String(type.estimated_usage_pct));

  const save = async () => {
    const trimmed = name.trim();
    const n = Number(pct.replace(",", "."));
    if (!trimmed || Number.isNaN(n) || n < 0) {
      setEditing(false);
      setName(type.name);
      setPct(String(type.estimated_usage_pct));
      return;
    }
    await update.mutateAsync({
      id: type.id,
      name: trimmed,
      estimated_usage_pct: n,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="grid grid-cols-[1fr_80px_auto_auto] gap-2 items-center">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          type="text"
          inputMode="decimal"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          className="h-8 text-sm text-right"
        />
        <Button onClick={save} className="h-8 px-2 text-xs">
          Save
        </Button>
        <button
          onClick={() => setEditing(false)}
          className={`text-xs ${tc.textFaint}`}
        >
          Cancel
        </button>
      </li>
    );
  }

  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-md border ${tc.border} px-2 py-1.5`}
    >
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${tc.textHighlight} truncate`}>
          {type.name}
        </div>
        <div className={`text-[11px] ${tc.textFaint}`}>
          {Number(type.estimated_usage_pct).toFixed(1)}% per session
        </div>
      </div>
      <button
        onClick={() => setEditing(true)}
        className={`text-xs ${tc.textMuted} ${tc.textHover}`}
      >
        Edit
      </button>
      <button
        onClick={() => {
          if (confirm(`Delete "${type.name}"?`)) del.mutate(type.id);
        }}
        className="text-xs text-red-400 hover:text-red-300"
        disabled={del.isPending}
      >
        Delete
      </button>
    </li>
  );
}
