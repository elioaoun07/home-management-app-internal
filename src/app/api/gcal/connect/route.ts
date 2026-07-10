// src/app/api/gcal/connect/route.ts
// Starts the one-way Google Calendar OAuth flow. Redirects to Google's
// consent screen; see /api/gcal/callback for the return leg.

import { getAuthUrl, isGoogleCalendarConfigured } from "@/lib/gcal/client";
import { supabaseServer } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar is not configured on this server (missing GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)" },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("gcal_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(getAuthUrl(state));
}
