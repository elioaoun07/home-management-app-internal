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
ANTHROPIC_API_KEY=                 # Claude — ERA Ask AI (/api/era/ask); other AI routes still use Gemini
ANTHROPIC_MODEL=                   # optional, default claude-haiku-5-5 (HUB-107)
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

ERA agent recovery is opt-in until the owner applies `migrations/2026-10-10_era-execution-journal.sql` and refreshes the committed DB-state snapshot. Set `NEXT_PUBLIC_ERA_DURABLE_EXECUTION=true` and rebuild to enable saved plans and recovery cards. The default is off, preserving the Phase 2 execution path. This client flag is not an authorization boundary; the journal API always authenticates and checks ownership.

```env
NEXT_PUBLIC_ERA_DURABLE_EXECUTION=  # "true" only after owner applies the execution-journal migration
NEXT_PUBLIC_APP_URL=               # app root URL (used in push notification links)
NEXT_PUBLIC_ENABLE_SW=             # set to "false" to disable service worker during debugging
DEV_USER_ID=                       # override auth user in local development
```

## PM Mobile Relay (`pnpm pm` bridge, optional)

```env
PM_BRIDGE=                         # set to "1" to start the laptop bridge alongside `pnpm pm` (also: --no-bridge flag)
PM_SPRINT_RELAY=                   # set to "1" only after owner applies 2026-10-03_pm-sprint-planning-relay.sql; enables phone sprint edits
PM_STEWARD_STALE_MS=               # coordinator silence interval; default 180000, integer 1000–86400000 ms; observation only, never retries jobs
PM_OWNER_USER_ID=                  # the Supabase auth user id /pm/live commands and snapshots are scoped to (RLS: user_id = auth.uid())
PM_NOTIFY_URL=                     # optional override for the push endpoint; defaults to `${NEXT_PUBLIC_SITE_URL}/api/pm/notify`
```

Reuses `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_SUPABASE_SERVICE_ROLE_KEY` / `CRON_SECRET` already above. Outbound-only: the bridge makes calls out to Supabase and to `/api/pm/notify`; it never opens a listening port, so `pnpm pm`'s `127.0.0.1` binding is unaffected. See `migrations/2026-07-25_pm-mobile-relay.sql`.
