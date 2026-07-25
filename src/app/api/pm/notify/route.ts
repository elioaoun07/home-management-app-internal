/**
 * PM Mobile Relay — Push Notification Endpoint
 *
 * The laptop bridge (scripts/pm/bridge.mjs) calls this whenever a delivery
 * session emits a `notification.requested` event, transitions to a new
 * `awaiting.gate`, hits a terminal state, errors, or its runner goes silent.
 * This is the ONLY consumer that exists for `notification.requested` today —
 * the event has been emitted by run-session.mjs since DLV-1 and thrown away.
 *
 * Cron-style bearer auth (matches every src/app/api/cron/* route) rather than
 * cookie session auth, because the caller is a background Node process on the
 * laptop, not a browser. Scoped to a single recipient (PM_OWNER_USER_ID) —
 * this is not a general-purpose push-any-user endpoint.
 */

import { sendPushToUser } from "@/lib/pushSender";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const PM_OWNER_USER_ID = process.env.PM_OWNER_USER_ID;

const notifySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  url: z.string().max(500).optional(),
  tag: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  if (
    !CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!PM_OWNER_USER_ID) {
    return NextResponse.json(
      { error: "PM_OWNER_USER_ID is not configured" },
      { status: 503 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = notifySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { title, body, url, tag } = parsed.data;

  const payload = JSON.stringify({
    title,
    body,
    icon: "/appicon-192.png",
    badge: "/appicon-192.png",
    tag: tag || "pm-delivery",
    data: { type: "pm_delivery", url: url || "/pm/live" },
  });

  const result = await sendPushToUser(supabaseAdmin(), PM_OWNER_USER_ID, payload);
  return NextResponse.json({ success: true, ...result });
}
