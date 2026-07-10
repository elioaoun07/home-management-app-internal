-- One-way (app → Google) Google Calendar backup sync.
-- Only "scheduled" items (Reminders/Events with a due/start time — never
-- system alerts) sync. Google Calendar's own app then fires reliable,
-- offline-capable, lock-screen alarms that survive a delayed or missed
-- cronjob.com push. Edits made directly in Google are NOT read back — this
-- is a one-way publish, reconciled daily by /api/cron/gcal-reconcile.
-- See ERA Notes/03 - Junction Modules/Notifications/.

CREATE TABLE public.google_calendar_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  refresh_token text NOT NULL,
  google_calendar_id text NOT NULL,
  sync_enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamp with time zone,
  sync_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT google_calendar_connections_pkey PRIMARY KEY (id),
  CONSTRAINT google_calendar_connections_user_id_key UNIQUE (user_id),
  CONSTRAINT google_calendar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Client reads its own connection status (Preferences toggle) and can
-- disconnect directly. Insert/update of the refresh_token happens only via
-- the OAuth callback route and the sync engine, both service-role
-- (supabaseAdmin) — no client-writable insert/update policy is needed.
CREATE POLICY google_calendar_connections_select ON public.google_calendar_connections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY google_calendar_connections_delete ON public.google_calendar_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Reuses the existing (previously orphaned) items.google_event_id column as
-- the item -> Google event mapping — no separate join table needed.
-- google_synced_at drives the daily reconcile pass (re-push anything stale
-- or never synced instead of diffing content hashes).
ALTER TABLE public.items ADD COLUMN google_synced_at timestamp with time zone;

COMMENT ON COLUMN public.items.google_event_id IS 'Google Calendar event ID for the one-way backup sync (scheduled items only). Null = not synced or sync disabled for this user.';
COMMENT ON COLUMN public.items.google_synced_at IS 'Last time this item was successfully pushed to Google Calendar. Null = never synced.';
