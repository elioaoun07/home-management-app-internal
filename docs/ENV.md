# Environment Variables

## Required

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Backend

```env
SUPABASE_SERVICE_ROLE_KEY=         # admin ops (cron, batch)
GOOGLE_AI_API_KEY=                 # Gemini AI
GEMINI_MODEL=                      # optional, default gemini-flash-latest (auto-updates to latest Flash model, lightweight, future-proof)
GEMINI_FALLBACK_MODEL=             # optional, default gemini-flash-lite-latest (lighter variant, separate quota bucket; auto-updates to latest Flash-Lite)
CRON_SECRET=                       # cron job auth (Bearer token)
VOICE_SECRET=                      # voice endpoint JWT
AZURE_TTS_KEY=                     # Azure Cognitive Services TTS key
AZURE_TTS_REGION=                  # Azure TTS region (e.g. eastus)
```

## Push Notifications

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your@email.com
```

## Google Calendar Sync (one-way backup, optional)

```env
GOOGLE_CLIENT_ID=                  # Google Cloud OAuth 2.0 Web client ID (Calendar API enabled)
GOOGLE_CLIENT_SECRET=              # OAuth client secret
GOOGLE_REDIRECT_URI=               # must exactly match the redirect URI registered in Google Cloud Console, e.g. https://yourapp.com/api/gcal/callback
```

Setup: in Google Cloud Console, create a project (or reuse one), enable the **Google Calendar API**, create an **OAuth 2.0 Client ID** (Application type: Web application), add `GOOGLE_REDIRECT_URI`'s value to "Authorized redirect URIs". Without these three vars, `/api/gcal/connect` returns 503 and the sync stays a no-op — the rest of the app is unaffected.

## Optional / Dev

```env
NEXT_PUBLIC_APP_URL=               # app root URL (used in push notification links)
NEXT_PUBLIC_ENABLE_SW=             # set to "false" to disable service worker during debugging
DEV_USER_ID=                       # override auth user in local development
```
