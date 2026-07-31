// src/components/pm-live/CaptureSheet.tsx
// Quick-add to the PM Idea Inbox (`0 - Inbox.md`, "## New").
//
// The bridge has executed `capture` — journaled, with a full pre-image backup
// and a working Undo — since the relay shipped, but nothing in the UI could
// ever issue one, which also left the Undo strip permanently unreachable. This
// is that missing affordance. The entry lands raw and untriaged on purpose;
// `/triage-inbox` is what turns it into a canonical checklist item later.
"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { useBridgeLive } from "@/features/pm-live/store";
import type { SendCommand } from "@/features/pm-live/types";

export function CaptureSheet({ onClose, sendCommand }: { onClose: () => void; sendCommand: SendCommand }) {
  const bridgeLive = useBridgeLive();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    const outcome = await sendCommand("capture", { text: trimmed });
    setBusy(false);
    if (outcome.ok) onClose();
    else setError(outcome.error || "capture failed");
  }

  return (
    <Sheet
      title="Capture to Inbox"
      subtitle="0 - Inbox.md · triage it later on the laptop"
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="pm-btn flex-1">
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !text.trim()} data-variant="primary" className="pm-btn flex-1">
            {busy ? "Saving…" : "Capture"}
          </button>
        </div>
      }
    >
      <textarea
        autoFocus
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Balances drift after editing a transfer…"
        className="pm-input resize-none"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />
      <p className="mt-2 text-[12.5px]" style={{ color: "var(--pm-fg-3)" }}>
        Saved as an unchecked line under <span className="font-mono">## New</span>. Revertible from the Undo strip.
      </p>
      {!bridgeLive && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--pm-warn)" }}>
          The laptop bridge is offline — this will time out until `pnpm pm --bridge` is running.
        </p>
      )}
      {error && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--pm-warn)" }}>
          {error}
        </p>
      )}
    </Sheet>
  );
}
