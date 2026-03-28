// src/lib/pushSender.ts
// Shared push notification delivery utility.
// Sends to ALL active subscriptions for a user (not just primary),
// standardizes 410/404 handling (mark inactive, never delete),
// and updates notification push_status if a notificationId is provided.

import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

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
  deactivated: string[]; // subscription IDs marked is_active=false
  allFailed: boolean;
}

/**
 * Send a push notification to every active subscription for a user.
 *
 * - Sends to ALL subscriptions (not just the most recent).
 * - On 410/404: marks subscription is_active=false (never deletes).
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

  for (const sub of subscriptions) {
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

      await supabase
        .from("push_subscriptions")
        .update({ last_used_at: now })
        .eq("id", sub.id);
    } catch (err: unknown) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? (err as { statusCode: number }).statusCode
          : null;

      if (statusCode === 410 || statusCode === 404) {
        // Permanently invalid — mark inactive for cleanup on next subscribe
        result.deactivated.push(sub.id);
        console.log(
          `[pushSender] Subscription ${sub.id.substring(0, 8)} gone (${statusCode}) — marking inactive`,
        );
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("id", sub.id);
      } else {
        // Transient error (503, network, etc.) — don't deactivate
        result.failed++;
        console.error(
          `[pushSender] ✗ Push failed for ${sub.device_name} (status ${statusCode ?? "unknown"}):`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  result.allFailed =
    subscriptions.length > 0 && result.sent === 0 && result.deactivated.length === 0
      ? false // only transient failures, don't report allFailed
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
