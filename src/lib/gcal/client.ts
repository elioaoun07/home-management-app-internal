// src/lib/gcal/client.ts
// Google Calendar OAuth client factory. One-way (app -> Google) sync only —
// see src/lib/gcal/sync.ts. Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
// GOOGLE_REDIRECT_URI (see docs/ENV.md).

import { google } from "googleapis";

// Single granular scope covering the entire API surface we use:
// calendars.insert (the dedicated "ERA" calendar) + events.insert/patch/delete
// on app-created calendars. calendar.events + calendar.calendarlist do NOT
// cover calendars.insert ("insufficient authentication scopes"), and the full
// calendar scope is sensitive (verification burden) — app.created is the
// exact, non-sensitive fit.
const SCOPES = ["https://www.googleapis.com/auth/calendar.app.created"];

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

/** Consent screen URL. `prompt: consent` forces a refresh_token on every connect (Google only issues one on first consent otherwise). */
export function getAuthUrl(state: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/** Calendar API client authenticated as the user via their stored refresh_token. googleapis auto-refreshes the access token per call. */
export function getCalendarClientForUser(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

export function isGoogleNotFoundError(err: unknown): boolean {
  const code = (err as { code?: number; status?: number })?.code;
  const status = (err as { status?: number })?.status;
  return code === 404 || status === 404;
}
