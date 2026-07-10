# Google Calendar Integration Setup Guide

Complete step-by-step instructions to set up one-way Google Calendar sync for your ERA budget app.

---

## Part 1: Set Up Google Cloud Project & Get Credentials

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account (or create one)
3. Click the **Project Selector** at the top (currently shows "My First Project" or similar)
4. Click **NEW PROJECT** (top right)
5. Enter a name: `ERA Budget App`
6. Leave Organization blank (or select yours if you have one)
7. Click **CREATE**
8. Wait 1-2 minutes for the project to be created
9. The new project will auto-select in the Project Selector dropdown

### Step 2: Enable the Google Calendar API

1. In Google Cloud Console, go to the **APIs & Services** menu (left sidebar)
2. Click **Library** (under "APIs & Services")
3. Search for **"Google Calendar API"** in the search box
4. Click the **Google Calendar API** card
5. Click the blue **ENABLE** button
6. Wait for it to enable (usually instant)

### Step 3: Create OAuth 2.0 Credentials

1. In Google Cloud Console, go to **APIs & Services** → **Credentials** (left sidebar)
2. Click the blue **+ CREATE CREDENTIALS** button (top)
3. Select **OAuth client ID** from the dropdown
4. If prompted: "You need to configure the OAuth consent screen first"
   - Click **Configure Consent Screen**
   - Choose **External** (unless your app is internal-only)
   - Click **CREATE**
   - Fill in the form:
     - **App name:** `ERA` (or "ERA Budget App")
     - **User support email:** your email
     - **Developer contact:** your email
   - Click **SAVE AND CONTINUE**
   - On "Scopes" page, click **ADD OR REMOVE SCOPES**
   - Search for and add this single scope:
     - `https://www.googleapis.com/auth/calendar.app.created`
   - (This is the only scope the app requests — it lets ERA create its own
     dedicated calendar and manage events on it, nothing else. Broader scopes
     like `calendar.events` are not needed, and `calendar.events` +
     `calendar.calendarlist` alone actually FAIL with "insufficient
     authentication scopes" when the app creates the ERA calendar.)
   - Click **UPDATE** and **SAVE AND CONTINUE**
   - On "Test users" page, click **ADD USERS** and add your email
   - Click **SAVE AND CONTINUE**
   - Review and click **BACK TO DASHBOARD**

5. Back on Credentials page, click **+ CREATE CREDENTIALS** again
6. Select **OAuth client ID**
7. Choose application type: **Web application**
8. Under "Authorized redirect URIs", click **+ ADD URI**
9. Enter your redirect URI (see below based on your environment):
   - **Local dev:** `http://localhost:3000/api/gcal/callback`
   - **Production:** `https://yourdomain.com/api/gcal/callback` (replace `yourdomain.com` with your actual domain)
10. Click **CREATE**
11. A modal will appear with your credentials:
    - **Client ID** — copy this
    - **Client Secret** — copy this
12. Click **DOWNLOAD** (top right) to save a JSON file as backup
13. Click **OK** to close

---

## Part 2: Configure Your ERA App

### Step 1: Set Environment Variables

Add these three variables to your `.env.local` file in the app root directory:

```env
GOOGLE_CLIENT_ID=<paste your Client ID here>
GOOGLE_CLIENT_SECRET=<paste your Client Secret here>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gcal/callback
```

**Example:**
```env
GOOGLE_CLIENT_ID=1234567890-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-1234567890abcdefghijklmnop
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gcal/callback
```

### Step 2: Restart Your App

If the app is running, stop it and restart:

```bash
# Stop: press Ctrl+C in the terminal
# Then restart:
pnpm dev
```

### Step 3: Run the Database Migration

The app needs a new database table for Google Calendar connections. Run this SQL in your Supabase project:

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the contents of this file:
   ```
   migrations/2026-07-10_google-calendar-sync.sql
   ```
6. Click **RUN** (or Ctrl+Enter)
7. You should see a success message

---

## Part 3: Connect Your Google Account in the App

### Step 1: Open Settings

1. Open the ERA app in your browser (usually `http://localhost:3000`)
2. Log in with your ERA account
3. Click your **profile icon** → **Settings** (or navigate to `/settings`)

### Step 2: Find Google Calendar Settings

1. Scroll down to **Notifications**
2. Find the **"Google Calendar Backup Sync"** section
3. Click **Connect Google Calendar**

### Step 3: Authorize

1. You'll be redirected to Google
2. Sign in if needed (use the account where you want reminders to appear)
3. Google will ask to confirm permissions
4. Click **Allow** (or **Authorize**)
5. You'll be redirected back to Settings
6. Look for a **"connected"** message and a **"Syncing"** status

### Step 4: Verify

1. Go to [Google Calendar](https://calendar.google.com/)
2. Look for a new calendar named **"ERA (from budget app)"** in the left sidebar
3. Create a test reminder in ERA:
   - Go to Reminders/Items
   - Create a new item with a due date/time
   - Within seconds, it should appear in your ERA calendar in Google Calendar

---

## Troubleshooting

### "Google Calendar is not configured" error (503)

**Cause:** The environment variables aren't set or the app wasn't restarted.

**Fix:**
1. Verify `.env.local` has all three variables
2. Stop the app (Ctrl+C)
3. Run `pnpm dev` again

### OAuth redirect fails with "invalid_request"

**Cause:** The redirect URI in Google Cloud doesn't match your app's redirect URI.

**Fix:**
1. Go to Google Cloud Console → **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID
3. Click it to edit
4. Under "Authorized redirect URIs", verify it matches exactly:
   - For local dev: `http://localhost:3000/api/gcal/callback`
   - For production: `https://yourdomain.com/api/gcal/callback`
5. Save changes
6. Restart the app

### "No refresh token" or connection fails silently

**Cause:** Google didn't grant a refresh token (usually happens on second login attempt).

**Fix:**
1. In Google Cloud Console → **OAuth consent screen**, add yourself as a Test user
2. In your Google account settings, revoke access to ERA app:
   - Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
   - Find "ERA" or "ERA Budget App"
   - Click it and remove access
3. Go back to Settings in ERA and click **Connect Google Calendar** again
4. Make sure to click **Allow** when Google asks for permissions

### Calendar not syncing

**Cause:** Sync is disabled, or the database migration wasn't run.

**Fix:**
1. In Settings, check that **"Syncing"** is toggled ON (not "Paused")
2. Verify the migration was run:
   - In Supabase SQL Editor, run: `SELECT * FROM google_calendar_connections;`
   - You should see a row with your user ID

---

## What Gets Synced?

✅ **SYNCS to Google Calendar:**
- Reminders with due dates
- Events with start/end times
- Recurring items (uses the same RRULE)
- Alert times (become Google event reminders)

❌ **DOES NOT sync:**
- System alerts (daily budget reminders, summaries)
- Tasks without dates
- Completed/archived items (automatically deleted from Google Calendar)

---

## Next Steps

1. **Set up Quiet Hours** (optional): Go to Settings → Notifications → Preferences to control when alerts fire
2. **Test a recurring reminder**: Create one in ERA and verify it appears with the same recurrence in Google Calendar
3. **Enable push notifications**: While Google Calendar is the backup, push notifications are still the primary alert channel

---

## Need Help?

- **Environment variables not working?** Make sure you restarted the app after editing `.env.local`
- **Can't find the ERA calendar in Google?** Check if sync is enabled in Settings, and wait 10 seconds — it may not appear instantly
- **Want to disconnect?** In Settings, click **Disconnect** under Google Calendar Backup Sync (your Google Calendar events will remain in Google but won't update anymore)
