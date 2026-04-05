// src/lib/pushSender.ts
// Shared push notification delivery utility.
// Sends to ALL active subscriptions for a user (not just primary),
// uses a 72-hour grace period for 410/404 failures (Android FCM token rotation),
// and updates notification push_status if a notificationId is provided.

import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { logPushEvent } from "./pushLogger";

let vapidConfigured = false;

// Grace period: how long to keep a failing subscription active before deactivating.
// Android FCM rotates tokens unpredictably; pushsubscriptionchange doesn't always fire.
// 72 hours gives the user time to open the app and re-sync via foreground sync.
const GRACE_PERIOD_MS = 72 * 60 * 60 * 1000; // 72 hours

// Don't retry a failing subscription more than once per hour to avoid log spam.
const RETRY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export interface PushResult {
  sent: number;
  failed: number;
  deactivated: string[]; // subscription IDs marked is_active=false (after grace period)
  allFailed: boolean;
}

/**
 * Send a push notification to every active subscription for a user.
 *
 * - Sends to ALL subscriptions (not just the most recent).
 * - On 410/404: starts a grace period (sets failed_at) instead of immediately
 *   deactivating. Only deactivates after 72h of continuous failure.
 *   This prevents Android FCM token rotation from permanently killing push.
 * - On other errors: logs but keeps subscription active (may be transient).
 * - Updates push_subscriptions.last_used_at on success, clears failed_at.
 * - If notificationId is provided, updates notifications.push_status.
 */
export async function sendPushToUser(
  supabase: SupabaseClient,
  userId: string,
  payload: string,
  notificationId?: string,
): Promise<PushResult> {
  const result: PushResult = {
    sent: 0,
    failed: 0,
    deactivated: [],
    allFailed: false,
  };

  if (!ensureVapidConfigured()) {
    console.warn("[pushSender] VAPID keys not configured, skipping push");
    return result;
  }

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, device_name, last_used_at, failed_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("last_used_at", { ascending: false });

  if (error) {
    console.error("[pushSender] Failed to query subscriptions:", error.message);
    return result;
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log(
      `[pushSender] No active subscriptions for user ${userId.substring(0, 8)}`,
    );
    return result;
  }

  console.log(
    `[pushSender] Sending to ${subscriptions.length} subscription(s) for user ${userId.substring(0, 8)}`,
  );

  const now = new Date().toISOString();

  // Extract notification title for log context (best-effort JSON parse)
  let notificationTitle: string | null = null;
  try {
    const parsed = JSON.parse(payload) as { title?: string };
    notificationTitle = parsed.title ?? null;
  } catch {
    // Not JSON or no title — fine
  }

  for (const sub of subscriptions) {
    const endpointPreview = sub.endpoint.substring(0, 80);

    // ── Grace period logic for previously-failed subscriptions ──
    if (sub.failed_at) {
      const failedAt = new Date(sub.failed_at).getTime();
      const timeSinceFailure = Date.now() - failedAt;

      if (timeSinceFailure > GRACE_PERIOD_MS) {
        // Grace period expired (72h+) — permanently deactivate
        result.deactivated.push(sub.id);
        const hoursDown = Math.round(timeSinceFailure / 3600000);
        console.log(
          `[pushSender] Subscription ${sub.id.substring(0, 8)} failed for ${hoursDown}h — deactivating`,
        );
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("id", sub.id);
        logPushEvent(supabase, {
          user_id: userId,
          subscription_id: sub.id,
          event_type: "grace_period_expired",
          device_name: sub.device_name,
          endpoint_preview: endpointPreview,
          notification_id: notificationId,
          notification_title: notificationTitle,
          metadata: { hours_in_grace_period: hoursDown },
        });
        continue;
      }

      if (timeSinceFailure < RETRY_INTERVAL_MS) {
        // Failed recently — skip until next retry window (avoid log spam)
        result.failed++;
        continue;
      }

      // Between 1h and 72h — retry once to check if endpoint recovered
      const hoursAgo = Math.round(timeSinceFailure / 3600000);
      console.log(
        `[pushSender] Retrying ${sub.device_name} (${sub.id.substring(0, 8)}) — in grace period (${hoursAgo}h)`,
      );
      logPushEvent(supabase, {
        user_id: userId,
        subscription_id: sub.id,
        event_type: "grace_period_retry",
        device_name: sub.device_name,
        endpoint_preview: endpointPreview,
        notification_id: notificationId,
        notification_title: notificationTitle,
        metadata: { hours_in_grace_period: hoursAgo },
      });
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );

      result.sent++;
      console.log(`[pushSender] ✓ Sent to ${sub.device_name} (${sub.id.substring(0, 8)})`);

      // Success — update last_used_at and clear any failure tracking
      await supabase
        .from("push_subscriptions")
        .update({ last_used_at: now, failed_at: null })
        .eq("id", sub.id);
      logPushEvent(supabase, {
        user_id: userId,
        subscription_id: sub.id,
        event_type: "send_success",
        device_name: sub.device_name,
        endpoint_preview: endpointPreview,
        notification_id: notificationId,
        notification_title: notificationTitle,
      });
    } catch (err: unknown) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? (err as { statusCode: number }).statusCode
          : null;
      const errMessage =
        err instanceof Error ? err.message : String(err);

      if (statusCode === 410 || statusCode === 404) {
        result.failed++;

        if (!sub.failed_at) {
          // First failure — start grace period instead of deactivating.
          // This is likely Android FCM token rotation; the user's foreground
          // sync or SW pushsubscriptionchange handler will register a new token.
          console.log(
            `[pushSender] Subscription ${sub.id.substring(0, 8)} got ${statusCode} — starting 72h grace period (likely FCM token rotation)`,
          );
          await supabase
            .from("push_subscriptions")
            .update({ failed_at: now })
            .eq("id", sub.id);
          logPushEvent(supabase, {
            user_id: userId,
            subscription_id: sub.id,
            event_type: "send_failure_410",
            device_name: sub.device_name,
            endpoint_preview: endpointPreview,
            error_code: statusCode,
            error_message: errMessage,
            notification_id: notificationId,
            notification_title: notificationTitle,
            metadata: { grace_period_started: true },
          });
        } else {
          // Already in grace period — just log (don't update failed_at)
          const hoursAgo = Math.round(
            (Date.now() - new Date(sub.failed_at).getTime()) / 3600000,
          );
          console.log(
            `[pushSender] Subscription ${sub.id.substring(0, 8)} still failing (${statusCode}, ${hoursAgo}h into grace period)`,
          );
          logPushEvent(supabase, {
            user_id: userId,
            subscription_id: sub.id,
            event_type: "send_failure_410",
            device_name: sub.device_name,
            endpoint_preview: endpointPreview,
            error_code: statusCode,
            error_message: errMessage,
            notification_id: notificationId,
            notification_title: notificationTitle,
            metadata: { hours_in_grace_period: hoursAgo },
          });
        }
      } else {
        // Transient error (503, network, etc.) — don't track as permanent failure
        result.failed++;
        console.error(
          `[pushSender] ✗ Push failed for ${sub.device_name} (status ${statusCode ?? "unknown"}):`,
          err instanceof Error ? err.message : err,
        );
        logPushEvent(supabase, {
          user_id: userId,
          subscription_id: sub.id,
          event_type: "send_failure_other",
          device_name: sub.device_name,
          endpoint_preview: endpointPreview,
          error_code: statusCode,
          error_message: errMessage,
          notification_id: notificationId,
          notification_title: notificationTitle,
        });
      }
    }
  }

  result.allFailed =
    subscriptions.length > 0 && result.sent === 0 && result.deactivated.length === 0
      ? false // only transient/grace-period failures, don't report allFailed
      : result.sent === 0;

  if (notificationId) {
    const pushStatus = result.sent > 0 ? "sent" : "failed";
    await supabase
      .from("notifications")
      .update({
        push_status: pushStatus,
        push_sent_at: result.sent > 0 ? now : null,
      })
      .eq("id", notificationId);
  }

  return result;
}
