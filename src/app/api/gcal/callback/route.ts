// src/app/api/gcal/callback/route.ts
// OAuth return leg for the one-way Google Calendar sync. Exchanges the
// auth code for a refresh_token, creates a dedicated "ERA" calendar on
// first connect (idempotent — reuses the stored calendar id on reconnect),
// and stores the connection. Redirects back to Settings either way so the
// UI can show success/error without the user losing their place.

import { exchangeCodeForTokens, getOAuth2Client } from "@/lib/gcal/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { google } from "googleapis";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function redirectToSettings(
  request: NextRequest,
  status: "connected" | "error",
  message?: string,
) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("gcal", status);
  if (message) url.searchParams.set("gcal_message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gcal_oauth_state")?.value;
  cookieStore.delete("gcal_oauth_state");

  if (oauthError) return redirectToSettings(request, "error", oauthError);
  if (!code || !state || state !== expectedState) {
    return redirectToSettings(request, "error", "invalid_state");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return redirectToSettings(request, "error", "no_refresh_token");
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const admin = supabaseAdmin();
    const { data: existing } = await admin
      .from("google_calendar_connections")
      .select("google_calendar_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let calendarId = existing?.google_calendar_id;
    if (!calendarId) {
      const created = await calendar.calendars.insert({
        requestBody: { summary: "ERA (from budget app)" },
      });
      calendarId = created.data.id ?? undefined;
    }

    if (!calendarId) {
      return redirectToSettings(request, "error", "calendar_create_failed");
    }

    const { error: upsertError } = await admin
      .from("google_calendar_connections")
      .upsert(
        {
          user_id: user.id,
          refresh_token: tokens.refresh_token,
          google_calendar_id: calendarId,
          sync_enabled: true,
          sync_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (upsertError) return redirectToSettings(request, "error", upsertError.message);

    return redirectToSettings(request, "connected");
  } catch (err) {
    return redirectToSettings(
      request,
      "error",
      err instanceof Error ? err.message : "unknown",
    );
  }
}
