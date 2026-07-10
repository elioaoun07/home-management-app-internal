# Google Calendar Setup — Quick Reference

**TL;DR:** Get Google Cloud credentials, add them to `.env.local`, run the migration, connect in Settings.

---

## 30-Second Setup

1. **Create Google Cloud Project**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create new project, enable Calendar API

2. **Create OAuth Credentials**
   - APIs & Services → Credentials → OAuth 2.0 Client ID (Web app)
   - Add redirect URI: `http://localhost:3000/api/gcal/callback`
   - Copy Client ID and Secret

3. **Configure App** (add to `.env.local`):
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/gcal/callback
   ```

4. **Restart App** (`pnpm dev`)

5. **Run Migration**
   - In Supabase SQL Editor, run `migrations/2026-07-10_google-calendar-sync.sql`

6. **Connect**
   - Settings → Notifications → Google Calendar → Connect
   - Authorize on Google's screen
   - Done!

---

## For Production

Change the redirect URI:
```env
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/gcal/callback
```

Update the same URI in Google Cloud Console under Credentials.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Google Calendar is not configured" | Add env vars to `.env.local`, restart app |
| OAuth redirect fails | Check redirect URI in Google Cloud matches exactly |
| Not syncing | Verify sync is ON in Settings, run the migration |
| Can't find ERA calendar | Wait 10s, check sync is enabled, refresh Google Calendar |

---

## Full Setup Guide

See **`docs/GOOGLE-CALENDAR-SETUP.md`** for detailed step-by-step instructions with screenshots.
