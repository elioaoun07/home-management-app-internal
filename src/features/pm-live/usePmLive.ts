// src/features/pm-live/usePmLive.ts
// Realtime plumbing for /pm/live: subscribes `pm_live` (read) into the store,
// and issues commands into `pm_commands` (write), resolving each command's
// promise when the laptop bridge (scripts/pm/bridge.mjs) flips its row to
// done/failed. RLS on both tables is flat `user_id = auth.uid()` (Hard Rule 20)
// so `postgres_changes` works without the household-subquery caveat noted in
// src/features/hub/hooks.ts.
//
// Mount this ONCE, at the app shell. Everything else reads the store through
// selectors and takes `sendCommand` from usePmCommand().
"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef } from "react";
import { loadCache, saveCache } from "./cache";
import { pmLiveSnapshots, usePmLiveStore } from "./store";
import type { CommandOutcome, CommandType } from "./types";

const DEFAULT_COMMAND_TIMEOUT_MS = 20_000;
/** preflight/launch run baseline validation on the laptop before answering. */
const LAUNCH_COMMAND_TIMEOUT_MS = 60_000;
const LIVENESS_TICK_MS = 5_000;
const CACHE_DEBOUNCE_MS = 1_000;

type CommandRow = { id: string; status: string; result: Record<string, unknown> | null; error: string | null };

/** Mounts realtime + cache persistence. Call exactly once. */
export function usePmLiveConnection() {
  const supabase = supabaseBrowser();
  const userId = usePmLiveStore((s) => s.userId);

  // ---- initial load: cache first (works offline), then live rows ----
  useEffect(() => {
    const { applyRows, hydrate, setLoading, setUserId } = usePmLiveStore.getState();
    const cached = loadCache();
    if (cached) hydrate(cached);

    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      if (cancelled || !uid) {
        setLoading(false);
        return;
      }
      setUserId(uid);

      const { data: rows } = await supabase.from("pm_live").select("id, kind, payload").eq("user_id", uid);
      if (cancelled) return;
      applyRows(rows || []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // ---- realtime: pm_live rows ----
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`pm-live-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pm_live", filter: `user_id=eq.${userId}` },
        (payload) => {
          const { applyRow, dropRow } = usePmLiveStore.getState();
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string } | undefined;
            if (old?.id) dropRow(old.id);
            return;
          }
          const row = payload.new as { id: string; payload: unknown } | undefined;
          if (row) applyRow(row.id, row.payload);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  // ---- persist to localStorage (debounced — snapshots can land in bursts) ----
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = usePmLiveStore.subscribe(() => {
      if (usePmLiveStore.getState().loading) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => saveCache(pmLiveSnapshots()), CACHE_DEBOUNCE_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // ---- bridge liveness ticker ----
  useEffect(() => {
    const t = setInterval(() => usePmLiveStore.getState().tick(), LIVENESS_TICK_MS);
    return () => clearInterval(t);
  }, []);
}

/**
 * Command dispatch: insert into `pm_commands`, then await the bridge flipping
 * the row. The result arrives over a realtime UPDATE rather than a poll, so
 * this channel lives here alongside the promise map it resolves.
 */
export function usePmCommand() {
  const supabase = supabaseBrowser();
  const userId = usePmLiveStore((s) => s.userId);
  const inflightRef = useRef<Map<string, (row: CommandRow) => void>>(new Map());

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`pm-commands-client-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pm_commands", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as CommandRow;
          if (row.status !== "done" && row.status !== "failed" && row.status !== "expired") return;
          const waiter = inflightRef.current.get(row.id);
          if (waiter) {
            waiter(row);
            inflightRef.current.delete(row.id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  return useCallback(
    async (type: CommandType, payload: Record<string, unknown>, opts?: { timeoutMs?: number }): Promise<CommandOutcome> => {
      const timeoutMs = opts?.timeoutMs ?? (type === "launch" || type === "preflight" ? LAUNCH_COMMAND_TIMEOUT_MS : DEFAULT_COMMAND_TIMEOUT_MS);
      const { data, error } = await supabase.from("pm_commands").insert({ type, payload }).select("id").single();
      if (error || !data) return { ok: false, error: error?.message || "failed to queue command" };
      const id = data.id as string;
      const inflight = inflightRef.current;
      return new Promise<CommandOutcome>((resolve) => {
        const timer = setTimeout(() => {
          inflight.delete(id);
          resolve({ ok: false, error: "timed out waiting for the laptop bridge — is `pnpm pm --bridge` running?" });
        }, timeoutMs);
        inflight.set(id, (row) => {
          clearTimeout(timer);
          resolve({ ok: row.status === "done", error: row.error || undefined, result: row.result || undefined });
        });
      });
    },
    [supabase],
  );
}
