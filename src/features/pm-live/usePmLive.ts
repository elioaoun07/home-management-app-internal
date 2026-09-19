// src/features/pm-live/usePmLive.ts
// Realtime plumbing for the legacy /pm/live view (?ui=legacy): subscribes
// `pm_live` (read) into the store, and issues commands into `pm_commands` (write),
// resolving each command's promise when the laptop bridge (scripts/pm/bridge.mjs)
// records its receipt. RLS on both tables is flat `user_id = auth.uid()`.
//
// Command Center Phase 4 (DLV-104): the cache is bound to the signed-in owner and
// replaced by a complete read; an account switch clears it; a command id exists
// before the insert and its receipt is observed before sending, and a timeout
// reports what the receipt says rather than calling the command failed.
//
// Mount this ONCE, at the app shell. Everything else reads the store through
// selectors and takes `sendCommand` from usePmCommand().
"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef } from "react";
import { loadCache, purgeOtherOwners, saveCache } from "./cache";
import { pmLiveSnapshots, usePmLiveStore } from "./store";
import type { CommandOutcome, CommandType } from "./types";

const DEFAULT_COMMAND_TIMEOUT_MS = 20_000;
/** preflight/launch run baseline validation on the laptop before answering. */
const LAUNCH_COMMAND_TIMEOUT_MS = 60_000;
const LIVENESS_TICK_MS = 5_000;
const CACHE_DEBOUNCE_MS = 1_000;
const SETTLED = ["done", "failed", "expired", "unknown"];

type CommandRow = { id: string; status: string; result: Record<string, unknown> | null; error: string | null };

/** Mounts realtime + cache persistence. Call exactly once. */
export function usePmLiveConnection() {
  const supabase = supabaseBrowser();
  const userId = usePmLiveStore((s) => s.userId);

  // ---- initial load: this owner's cache first (works offline), then a complete live read ----
  useEffect(() => {
    const { hydrate, replaceRows, reset, setLoading, setUserId } = usePmLiveStore.getState();

    let cancelled = false;
    (async () => {
      // getSession reads the local session, so an offline cold open still knows whose copy to show.
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id || null;
      purgeOtherOwners(uid);
      if (cancelled) return;
      if (!uid) {
        reset();
        setLoading(false);
        return;
      }
      const cached = loadCache(uid);
      if (cached) hydrate(cached);
      setUserId(uid);

      const { data: rows, error } = await supabase.from("pm_live").select("id, kind, payload").eq("user_id", uid);
      if (cancelled) return;
      // A failed read keeps this owner's saved copy; a complete read replaces it.
      if (!error && rows) replaceRows(rows);
      setLoading(false);
    })();

    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user?.id || null;
      const current = usePmLiveStore.getState().userId;
      if (current && next !== current) {
        usePmLiveStore.getState().reset();
        purgeOtherOwners(next);
        location.reload();
      }
    });

    return () => {
      cancelled = true;
      auth.subscription.unsubscribe();
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

  // ---- persist this owner's copy (debounced — snapshots can land in bursts) ----
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = usePmLiveStore.subscribe(() => {
      const { loading, userId: owner } = usePmLiveStore.getState();
      if (loading || !owner) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => saveCache(owner, pmLiveSnapshots()), CACHE_DEBOUNCE_MS);
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
 * Command dispatch. The id is generated here, the waiter is registered before the
 * insert, and a receipt that landed before the realtime event is read back
 * directly. A timeout answers with what the receipt says; it never claims the
 * command failed or stopped.
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
          const unknown = row.status === "claimed" && !!row.result && (row.result as { outcome_unknown?: boolean }).outcome_unknown;
          if (!SETTLED.includes(row.status) && !unknown) return;
          inflightRef.current.get(row.id)?.(row);
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
      const id = crypto.randomUUID();
      const inflight = inflightRef.current;
      const fromRow = (row: CommandRow): CommandOutcome => {
        const unknown = row.status === "unknown" || (row.status === "claimed" && (row.result as { outcome_unknown?: boolean } | null)?.outcome_unknown);
        return unknown
          ? { ok: false, error: "Outcome unknown", result: row.result || undefined }
          : { ok: row.status === "done", error: row.error || undefined, result: row.result || undefined };
      };
      const readBack = async () => {
        const { data } = await supabase.from("pm_commands").select("id, status, result, error").eq("id", id).maybeSingle();
        return (data as CommandRow | null) ?? null;
      };
      return new Promise<CommandOutcome>((resolve) => {
        let done = false;
        const finish = (outcome: CommandOutcome) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          inflight.delete(id);
          resolve(outcome);
        };
        inflight.set(id, (row) => finish(fromRow(row)));
        const timer = setTimeout(async () => {
          const row = await readBack();
          if (row && (SETTLED.includes(row.status) || fromRow(row).error === "Outcome unknown")) return finish(fromRow(row));
          finish({ ok: false, error: row ? (row.status === "claimed" ? "Acknowledged — no result yet" : "No receipt yet") : "Not sent" });
        }, timeoutMs);
        void (async () => {
          const { error } = await supabase.from("pm_commands").insert({ id, type, payload });
          if (error && error.code !== "23505") return finish({ ok: false, error: error.message || "failed to queue command" });
          const row = await readBack();
          if (row && SETTLED.includes(row.status)) finish(fromRow(row));
        })();
      });
    },
    [supabase],
  );
}
