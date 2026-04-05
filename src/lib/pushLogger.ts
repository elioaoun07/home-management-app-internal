// src/lib/pushLogger.ts
// Structured push notification event logger.
// Writes to `push_event_logs` table (see migrations/schema.sql).
// All calls are fire-and-forget — logging never throws or blocks delivery.

import type { SupabaseClient } from "@supabase/supabase-js";

export type PushEventType =
  | "send_success"          // push delivered successfully
  | "send_failure_410"      // FCM returned 410/404 — token dead, grace period started
  | "send_failure_other"    // transient error (503, network, etc.)
  | "grace_period_retry"    // subscription in grace period, retrying hourly
  | "grace_period_expired"  // 72h up — subscription deactivated
  | "subscribed"            // new subscription registered from client
  | "subscription_failing"  // foreground sync detected failed_at — told client to resubscribe
  | "force_resubscribe"     // client force-resubscribed (fresh FCM token)
  | "sw_token_rotation"     // pushsubscriptionchange: new token synced via SW route
  | "health_check_ok"       // periodic background sync: subscription healthy
  | "health_check_failing"  // periodic background sync: subscription needs renewal
  | "health_check_healed";  // periodic background sync: subscription healed autonomously

export interface PushEventPayload {
  user_id?: string | null;
  subscription_id?: string | null;
  event_type: PushEventType;
  device_name?: string | null;
  endpoint_preview?: string | null;      // first 60 chars of endpoint for identification
  error_code?: number | null;
  error_message?: string | null;
  notification_id?: string | null;
  notification_title?: string | null;    // what notification was being sent
  metadata?: Record<string, unknown> | null;
}

/**
 * Log a push notification lifecycle event.
 * Always fire-and-forget — never awaited in critical paths.
 */
export async function logPushEvent(
  supabase: SupabaseClient,
  payload: PushEventPayload,
): Promise<void> {
  try {
    await supabase.from("push_event_logs").insert({
      user_id: payload.user_id ?? null,
      subscription_id: payload.subscription_id ?? null,
      event_type: payload.event_type,
      device_name: payload.device_name ?? null,
      endpoint_preview: payload.endpoint_preview
        ? payload.endpoint_preview.substring(0, 80)
        : null,
      error_code: payload.error_code ?? null,
      error_message: payload.error_message
        ? payload.error_message.substring(0, 500)
        : null,
      notification_id: payload.notification_id ?? null,
      notification_title: payload.notification_title
        ? payload.notification_title.substring(0, 200)
        : null,
      metadata: payload.metadata ?? null,
    });
  } catch {
    // Logging must never throw — push delivery takes priority
  }
}
