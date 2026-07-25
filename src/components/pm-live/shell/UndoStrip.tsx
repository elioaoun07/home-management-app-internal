// src/components/pm-live/shell/UndoStrip.tsx
// Revert the newest journaled bridge write. Deliberately NOT a sonner toast:
// the bridge's undo journal survives a reload and a reopened app, so a 4s toast
// would under-promise what's actually available. The offer rides the bridge
// heartbeat, so it appears/disappears on its own (see bridge.mjs lastUndoable).
"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { useUndoable } from "@/features/pm-live/store";
import type { SendCommand } from "@/features/pm-live/types";

export function UndoStrip({ sendCommand }: { sendCommand: SendCommand }) {
  const undoable = useUndoable();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!undoable) return null;

  async function undo() {
    setBusy(true);
    setError("");
    const outcome = await sendCommand("undo", {});
    setBusy(false);
    if (!outcome.ok) setError(outcome.error || "undo failed");
  }

  return (
    <div className="shrink-0 border-b" style={{ borderColor: "var(--pm-border)", backgroundColor: "var(--pm-surface)" }}>
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="flex-1 min-w-0 truncate text-[12px]" style={{ color: "var(--pm-fg-2)" }}>
          {undoable.label}
        </span>
        <button onClick={undo} disabled={busy} className="pm-btn shrink-0" style={{ color: "var(--pm-accent)" }}>
          <Undo2 size={13} />
          {busy ? "Undoing…" : "Undo"}
        </button>
      </div>
      {error && (
        <p className="px-4 pb-2 text-[12px]" style={{ color: "var(--pm-warn)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
