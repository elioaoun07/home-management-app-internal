"use client";

// src/features/era/useEraHandoff.ts
// HUB-78 — the precision-form side of an ERA handoff (plan §4 component 9).
// Reads `?era=<messageId>`, loads the owner-bound proposal, and refuses an
// expired or already-consumed one. `consume()` runs after a successful save:
// it deletes the draft the capture had created (so exactly one record
// results) and appends the consumed marker.

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { qk } from "@/lib/queryKeys";
import { safeFetch } from "@/lib/safeFetch";
import type { EraHandoff } from "./engine";

export function useEraHandoff() {
  const params = useSearchParams();
  const messageId = params.get("era");
  const queryClient = useQueryClient();
  const [handoff, setHandoff] = useState<EraHandoff | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "expired" | "consumed" | "missing">("idle");

  useEffect(() => {
    if (!messageId) return;
    let cancelled = false;
    setStatus("loading");
    safeFetch(`/api/era/messages/${encodeURIComponent(messageId)}`, { timeoutMs: 8_000 })
      .then(async (res) => {
        if (!res.ok) return cancelled || setStatus("missing");
        const data = (await res.json()) as { handoff: EraHandoff; consumed: boolean; expired: boolean };
        if (cancelled) return;
        if (data.consumed) return setStatus("consumed");
        if (data.expired) return setStatus("expired");
        setHandoff(data.handoff);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("missing"));
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  const consume = useCallback(
    async (transactionId?: string | null) => {
      if (!messageId || !handoff) return;
      if (handoff.draftId) {
        await safeFetch(`/api/drafts/${handoff.draftId}`, { method: "DELETE" }).catch(() => null);
        queryClient.invalidateQueries({ queryKey: qk.drafts() });
      }
      await safeFetch(`/api/era/messages/${encodeURIComponent(messageId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: transactionId ?? null }),
      }).catch(() => null);
      setHandoff(null);
      setStatus("consumed");
    },
    [messageId, handoff, queryClient],
  );

  return { messageId, handoff, status, consume };
}
