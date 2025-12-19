// src/app/api/notifications/send-due/route.ts
// DEPRECATED: Use /api/cron/item-reminders instead
// This route redirects to the new unified cron endpoint for backwards compatibility

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.VERCEL_URL ||
  "http://localhost:3000";

export async function POST(req: NextRequest) {
  console.log(
    "[DEPRECATED] /api/notifications/send-due called - redirecting to /api/cron/item-reminders"
  );

  try {
    const response = await fetch(`${BASE_URL}/api/cron/item-reminders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.get("authorization") || "",
      },
    });

    const data = await response.json();
    return NextResponse.json(
      {
        ...data,
        deprecated: true,
        message:
          "This endpoint is deprecated. Use /api/cron/item-reminders instead.",
      },
      { status: response.status }
    );
  } catch (error) {
    console.error("Redirect error:", error);
    return NextResponse.json(
      { error: "Failed to redirect to new endpoint" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
