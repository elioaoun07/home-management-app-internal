/**
 * Item Reminders Cron Endpoint
 *
 * Sends push notifications for due item_alerts (tasks, reminders, events).
 * This is SEPARATE from daily transaction reminders.
 *
 * Cron schedule: every 1 minute
 * Endpoint: GET /api/cron/item-reminders
 *
 * What this does:
 * 1. Finds item_alerts with trigger_at in the past hour that haven't fired
 * 2. Filters out alerts whose parent item has been archived or soft-deleted
 * 3. Suppresses alerts for occurrences that have been cancelled, skipped, or
 *    completed (per-occurrence suppression for recurring items)
 * 4. Creates a notification in the unified notifications table
 * 5. Sends push notification to user's devices
 * 6. Marks alert as fired and reschedules recurring alerts to the next occurrence
 */

import { sendPushToUser } from "@/lib/pushSender";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildFullRRuleString } from "@/lib/utils/date";
import { NextRequest, NextResponse } from "next/server";
import { RRule } from "rrule";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

type AlertRow = {
  id: string;
  item_id: string;
  trigger_at: string | null;
  offset_minutes: number | null;
  channel: string;
  kind: string;
  occurrence_date: string | null;
  items: {
    id: string;
    user_id: string;
    responsible_user_id: string | null;
    notify_all_household: boolean | null;
    title: string;
    description: string | null;
    type: string;
    priority: string;
    archived_at: string | null;
    deleted_at: string | null;
    item_recurrence_rules:
      | {
          id: string;
          rrule: string;
          start_anchor: string;
          end_until: string | null;
          count: number | null;
        }[]
      | null;
  } | null;
};

/**
 * Compute the occurrence_date this alert is firing for.
 * For relative alerts: trigger_at + offset = occurrence time.
 * For absolute alerts: trigger_at IS the occurrence time.
 * Falls back to alert.occurrence_date if persisted, else derived.
 */
function deriveOccurrenceDate(alert: {
  trigger_at: string | null;
  offset_minutes: number | null;
  kind: string;
  occurrence_date: string | null;
}): Date | null {
  if (alert.occurrence_date) return new Date(alert.occurrence_date);
  if (!alert.trigger_at) return null;
  const triggerAt = new Date(alert.trigger_at);
  if (alert.kind === "relative" && alert.offset_minutes != null) {
    return new Date(triggerAt.getTime() + alert.offset_minutes * 60 * 1000);
  }
  return triggerAt;
}

export async function GET(req: NextRequest) {
  if (
    !CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const now = new Date();
  // We used to use a 1-hour lookback, but if the cron ever missed its window
  // (deploy, downtime, even a single skipped minute) the alert was silently
  // dropped. For recurring items we self-heal by advancing trigger_at to the
  // next future occurrence; for one-time alerts we still fire as long as the
  // alert is recent enough to be useful (12h window).
  const LOOKBACK_HOURS = 12;
  const lookbackStart = new Date(
    now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000,
  );
  // Anything older than this for a recurring series is treated as "stale"
  // and self-healed without firing a notification.
  const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

  try {
    const { data: dueAlerts, error: alertsError } = await supabase
      .from("item_alerts")
      .select(
        `
        id,
        item_id,
        trigger_at,
        offset_minutes,
        channel,
        kind,
        occurrence_date,
        items (
          id,
          user_id,
          responsible_user_id,
          notify_all_household,
          title,
          description,
          type,
          priority,
          archived_at,
          deleted_at,
          item_recurrence_rules (id, rrule, start_anchor, end_until, count)
        )
      `,
      )
      .eq("active", true)
      .eq("channel", "push")
      .lte("trigger_at", now.toISOString())
      .gte("trigger_at", lookbackStart.toISOString())
      .is("last_fired_at", null);

    if (alertsError) {
      console.error("Failed to get due alerts:", alertsError);
      return NextResponse.json({ error: alertsError.message }, { status: 500 });
    }

    // Self-heal pass: any RECURRING alert whose trigger_at is older than the
    // lookback window is permanently dead under the standard query above.
    // Advance it to its next future occurrence so future Sundays (etc.) fire.
    // We process up to 200 per run to bound work.
    const { data: ancientRecurringAlerts } = await supabase
      .from("item_alerts")
      .select(
        `
        id,
        item_id,
        trigger_at,
        offset_minutes,
        channel,
        kind,
        occurrence_date,
        items!inner (
          id,
          archived_at,
          deleted_at,
          item_recurrence_rules!inner (id, rrule, start_anchor, end_until, count)
        )
      `,
      )
      .eq("active", true)
      .lt("trigger_at", lookbackStart.toISOString())
      .limit(200);

    let healed = 0;
    for (const stale of (ancientRecurringAlerts ??
      []) as unknown as AlertRow[]) {
      const item = stale.items;
      if (!item || item.archived_at || item.deleted_at) continue;
      if (!item.item_recurrence_rules?.length) continue;
      await maybeRescheduleRecurring(supabase, stale, item);
      healed++;
    }
    if (healed > 0) {
      console.log(
        `[Item Reminders] Self-healed ${healed} ancient recurring alerts`,
      );
    }

    const alerts = (dueAlerts ?? []) as unknown as AlertRow[];
    if (alerts.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        healed,
        message: "No due item alerts",
      });
    }

    console.log(`[Item Reminders] Processing ${alerts.length} due alerts`);

    let sent = 0;
    let failed = 0;
    let suppressed = 0;
    let dropped = 0;

    for (const alert of alerts) {
      const item = alert.items;

      // 1. Drop alerts whose parent item is gone (archived or soft-deleted).
      if (!item) {
        await supabase
          .from("item_alerts")
          .update({ active: false, last_fired_at: now.toISOString() })
          .eq("id", alert.id);
        dropped++;
        continue;
      }
      if (item.archived_at || item.deleted_at) {
        await supabase
          .from("item_alerts")
          .update({ active: false, last_fired_at: now.toISOString() })
          .eq("id", alert.id);
        console.log(
          `[Item Reminders] Alert ${alert.id} dropped — item ${item.id} is ${item.deleted_at ? "deleted" : "archived"}`,
        );
        dropped++;
        continue;
      }

      // 1b. Self-heal stale recurring alerts: if the trigger fired more than
      // STALE_THRESHOLD_MS ago and the item is recurring, skip the (stale)
      // notification but advance the alert to its next future occurrence so
      // it fires correctly going forward. Without this, a single missed cron
      // window would leave the alert permanently dead.
      if (
        alert.trigger_at &&
        item.item_recurrence_rules?.length &&
        now.getTime() - new Date(alert.trigger_at).getTime() >
          STALE_THRESHOLD_MS
      ) {
        await supabase
          .from("item_alerts")
          .update({ last_fired_at: now.toISOString() })
          .eq("id", alert.id);
        await maybeRescheduleRecurring(supabase, alert, item);
        suppressed++;
        console.log(
          `[Item Reminders] Self-healed stale recurring alert ${alert.id}`,
        );
        continue;
      }

      // 2. Per-occurrence suppression check (cancelled/skipped/completed).
      const occurrenceDate = deriveOccurrenceDate(alert);
      if (occurrenceDate) {
        const dayStart = new Date(occurrenceDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const [{ data: actions }, { data: suppressions }] = await Promise.all([
          supabase
            .from("item_occurrence_actions")
            .select("id, action_type")
            .eq("item_id", item.id)
            .gte("occurrence_date", dayStart.toISOString())
            .lt("occurrence_date", dayEnd.toISOString())
            .in("action_type", ["cancelled", "skipped", "completed"]),
          supabase
            .from("item_alert_suppressions")
            .select("id")
            .eq("item_id", item.id)
            .gte("occurrence_date", dayStart.toISOString())
            .lt("occurrence_date", dayEnd.toISOString())
            .limit(1),
        ]);

        if ((actions?.length ?? 0) > 0 || (suppressions?.length ?? 0) > 0) {
          // This occurrence shouldn't fire. Mark fired so it doesn't retry,
          // then advance recurring alerts to the next occurrence below.
          await supabase
            .from("item_alerts")
            .update({ last_fired_at: now.toISOString() })
            .eq("id", alert.id);
          suppressed++;
          await maybeRescheduleRecurring(supabase, alert, item);
          continue;
        }
      }

      // 3. Determine target users.
      let targetUserIds: string[];
      if (item.notify_all_household) {
        // Notify EVERY member of the creator's household. We deliberately do
        // NOT use `.maybeSingle()` here: a household can legitimately have more
        // than one active `household_links` row (re-linking leaves stale-but-
        // active rows), and `.maybeSingle()` ERRORS on multiple rows. That made
        // the whole lookup return null and silently fall back to notifying only
        // the creator — the long-standing "All Household only buzzes one phone"
        // bug. Collect every owner/partner id across all active links instead,
        // always including the creator, deduped. See the canonical robust
        // lookup in `src/app/api/accounts/route.ts`.
        const { data: householdLinks } = await supabase
          .from("household_links")
          .select("owner_user_id, partner_user_id")
          .or(
            `owner_user_id.eq.${item.user_id},partner_user_id.eq.${item.user_id}`,
          )
          .eq("active", true);

        const ids = new Set<string>([item.user_id]);
        for (const link of householdLinks ?? []) {
          if (link.owner_user_id) ids.add(link.owner_user_id);
          if (link.partner_user_id) ids.add(link.partner_user_id);
        }
        targetUserIds = [...ids];
      } else {
        targetUserIds = [item.responsible_user_id || item.user_id];
      }

      const notificationType =
        item.type === "event" ? "item_due" : "item_reminder";
      const icon =
        item.type === "event" ? "📅" : item.type === "task" ? "✅" : "⏰";

      for (const userId of targetUserIds) {
        const { data: notification, error: insertError } = await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            notification_type: notificationType,
            title: item.title,
            message: item.description || `Your ${item.type} is due now`,
            icon,
            severity: item.priority === "urgent" ? "warning" : "info",
            source: "item",
            priority: item.priority || "normal",
            action_type: "complete_task",
            action_url: null,
            action_data: {
              item_id: item.id,
              alert_id: alert.id,
              item_type: item.type,
            },
            item_id: item.id,
            group_key: `item_${item.id}_${alert.id}_${userId}`,
            expires_at: new Date(
              now.getTime() + 24 * 60 * 60 * 1000,
            ).toISOString(),
            push_status: "pending",
          })
          .select()
          .single();

        if (insertError) {
          console.error(
            `Failed to create notification for user ${userId}:`,
            insertError,
          );
          continue;
        }

        const payload = JSON.stringify({
          title: item.title,
          body: item.description || `Your ${item.type} is due now`,
          icon: "/appicon-192.png",
          badge: "/appicon-192.png",
          tag: `item-${item.id}-${userId}`,
          data: {
            type: notificationType,
            notification_id: notification?.id,
            item_id: item.id,
            item_title: item.title,
            alert_id: alert.id,
            occurrence_date: occurrenceDate
              ? occurrenceDate.toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
            is_recurring: !!item.item_recurrence_rules?.length,
            url: `/expense?tab=reminder&item=${item.id}`,
          },
        });

        const pushResult = await sendPushToUser(
          supabase,
          userId,
          payload,
          notification?.id,
        );
        if (pushResult.sent > 0) sent++;
        if (pushResult.allFailed) failed++;
      }

      await supabase
        .from("item_alerts")
        .update({ last_fired_at: now.toISOString() })
        .eq("id", alert.id);

      await maybeRescheduleRecurring(supabase, alert, item);
    }

    return NextResponse.json({
      success: true,
      processed: alerts.length,
      push_sent: sent,
      push_failed: failed,
      suppressed,
      dropped,
      healed,
    });
  } catch (error) {
    console.error("Item reminders cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

/**
 * Advance a recurring alert to its next occurrence, or deactivate the alert
 * when the rrule is exhausted. Persists the new occurrence_date so the next
 * cron pass can cross-check suppressions cleanly.
 */
async function maybeRescheduleRecurring(
  supabase: ReturnType<typeof supabaseAdmin>,
  alert: AlertRow,
  item: NonNullable<AlertRow["items"]>,
) {
  const rule = item.item_recurrence_rules?.[0];
  if (!rule || !alert.trigger_at) return;

  const firedTriggerAt = new Date(alert.trigger_at);
  const currentEventTime =
    alert.kind === "relative" && alert.offset_minutes != null
      ? new Date(firedTriggerAt.getTime() + alert.offset_minutes * 60 * 1000)
      : new Date(firedTriggerAt);
  const rruleStr = buildFullRRuleString(new Date(rule.start_anchor), rule);
  const nextOcc = RRule.fromString(rruleStr).after(currentEventTime, false);

  if (nextOcc) {
    const newTriggerAt =
      alert.kind === "relative" && alert.offset_minutes != null
        ? new Date(
            nextOcc.getTime() - alert.offset_minutes * 60 * 1000,
          ).toISOString()
        : nextOcc.toISOString();
    await supabase
      .from("item_alerts")
      .update({
        trigger_at: newTriggerAt,
        last_fired_at: null,
        occurrence_date: nextOcc.toISOString(),
      })
      .eq("id", alert.id);
    console.log(
      `[Item Reminders] Rescheduled alert ${alert.id} → ${newTriggerAt}`,
    );
  } else {
    await supabase
      .from("item_alerts")
      .update({ active: false })
      .eq("id", alert.id);
    console.log(
      `[Item Reminders] Alert ${alert.id} deactivated — no more occurrences`,
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
