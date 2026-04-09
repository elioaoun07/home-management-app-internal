// src/lib/pushSender.ts
// Shared push notification delivery utility.
// Sends to ALL active subscriptions for a user (not just primary).
// On 410/404: immediately deactivates the subscription (no grace period).
// HTTP 410 = permanently gone. There is no point retrying a dead FCM token.
// Auto-heal happens on the client side when the user next opens the app.

import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { logPushEvent } from "./pushLogger";

let vapidConfigured = false;

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
  deactivated: string[]; // subscription IDs immediately deactivated on 410
  allFailed: boolean;
}

/**
 * Send a push notification to every active subscription for a user.
 *
 * - Sends to ALL subscriptions (not just the most recent).
 * - On 410/404: immediately deactivates the subscription. No grace period.
 *   The client will auto-heal the next time the user opens the app.
 * - On other errors: logs but keeps subscription active (may be transient).
 * - Updates push_subscriptions.last_used_at on success.
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
    .select("id, endpoint, p256dh, auth, device_name, last_used_at")
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

      // Success — update last_used_at and clear any stale failure tracking
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
        // 410/404 = FCM token is permanently gone. Deactivate immediately.
        // The client will auto-heal when the user next opens the app.
        result.failed++;
        result.deactivated.push(sub.id);
        console.log(
          `[pushSender] Subscription ${sub.id.substring(0, 8)} got ${statusCode} — deactivating immediately`,
        );
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false, failed_at: now })
          .eq("id", sub.id);
        logPushEvent(supabase, {
          user_id: userId,
          subscription_id: sub.id,
          event_type: "send_failure_410_deactivated",
          device_name: sub.device_name,
          endpoint_preview: endpointPreview,
          error_code: statusCode,
          error_message: errMessage,
          notification_id: notificationId,
          notification_title: notificationTitle,
          metadata: { deactivated_immediately: true },
        });
      } else {
        // Transient error (503, network, etc.) — don't deactivate
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

  result.allFailed = subscriptions.length > 0 && result.sent === 0;

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
