// src/app/api/notifications/send-transaction-reminders/route.ts
//
// @deprecated Use /api/cron/daily-reminder instead
// This route is kept for backward compatibility.
// The new unified endpoint handles preferred_time correctly.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Redirect to the new unified cron endpoint
  const baseUrl = req.nextUrl.origin;
  const newUrl = `${baseUrl}/api/cron/daily-reminder`;

  const response = await fetch(newUrl, {
    method: "GET",
    headers: {
      authorization: req.headers.get("authorization") || "",
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
