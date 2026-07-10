// src/features/items/gcalSync.ts
// Client-side triggers for the one-way Google Calendar sync.
//
// The items mutation hooks in useItems.ts write directly to Supabase from
// the browser when online, so the sync calls inside /api/items/* never see
// those mutations (they only run on offline-queue replay). Every online
// mutation that can affect a synced event calls one of these after its
// write succeeds. Both are best-effort: failures are swallowed — calendar
// sync is a backup channel and must never break an item mutation. The daily
// /api/cron/gcal-reconcile pass heals anything missed here.

import { safeFetch } from "@/lib/safeFetch";

// The route calls Google synchronously — long-running per Hard Rule 6, so an
// explicit generous timeout (default 3 s would abort and falsely markOffline).
const SYNC_TIMEOUT_MS = 30_000;

/** Fire-and-forget: push the item's current state to Google Calendar
 * (or remove its event if it became ineligible). Never await this from a
 * mutation — it must not add latency to the primary write. */
export function triggerGcalSync(itemId: string): void {
  void safeFetch("/api/gcal/sync-item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId }),
    timeoutMs: SYNC_TIMEOUT_MS,
  }).catch(() => {});
}

/** Remove the item's Google event. AWAIT this BEFORE hard-deleting the row —
 * once the row is gone its google_event_id is lost and the Google event
 * orphans forever (the reconcile cron can't see deleted rows either).
 * Swallows all errors: a Google outage must never block a delete. */
export async function removeFromGcalBeforeDelete(itemId: string): Promise<void> {
  try {
    await safeFetch("/api/gcal/sync-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, action: "delete" }),
      timeoutMs: SYNC_TIMEOUT_MS,
    });
  } catch {
    // Best-effort — the delete proceeds regardless.
  }
}
