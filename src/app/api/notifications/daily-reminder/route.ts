/**
 * Daily Transaction Logging Reminder
 *
 * @deprecated Use /api/cron/daily-reminder instead
 * This route is kept for backward compatibility but redirects to the new unified cron endpoint.
 *
 * The new endpoint:
 * - Respects user's preferred_time from notification_preferences
 * - Should be called every 5 minutes (not once daily)
 * - Handles timezone properly
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Redirect to the new unified cron endpoint
  const newUrl = new URL("/api/cron/daily-reminder", req.url);

  // Forward the authorization header
  const response = await fetch(newUrl.toString(), {
    method: "GET",
    headers: {
      authorization: req.headers.get("authorization") || "",
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
