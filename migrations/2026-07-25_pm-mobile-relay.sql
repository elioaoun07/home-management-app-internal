-- migrations/2026-07-25_pm-mobile-relay.sql
--
-- WHAT: Two relay tables for the mobile PM Command Center (/pm/live):
--       1. pm_live      — laptop-published snapshot rows (parsed checklist tasks,
--                          distilled delivery session state, bridge heartbeat, fleet
--                          rollup). One row per logical stream, keyed by `id`.
--       2. pm_commands  — phone-issued command queue, drained by the laptop bridge
--                          (scripts/pm/bridge.mjs). Numbered-file discipline on disk
--                          (scripts/delivery/controls.mjs) is mirrored here as a
--                          status state machine instead: pending -> claimed -> done|failed.
--       + RLS on both: flat user_id = auth.uid(), one policy per verb, NO EXISTS-
--         subquery policies anywhere (Hard Rule 20). Realtime enabled on both so the
--         phone gets sub-second updates and the bridge can subscribe instead of poll.
-- WHY:  ERA Notes/10 - Project Management/PM Dashboard Refactor/ + Delivery 10x/ —
--       the phone has no live view of PM checklists or delivery sessions today.
--       The relay is outbound-only from the laptop (it makes Supabase calls; nothing
--       inbound reaches pm-server), so it does NOT widen pm-server's 127.0.0.1 binding
--       — see Delivery 10x/6 - Design Debates & Rejected Ideas.md for the amendment
--       to the "Remote decision controls" rejection this design threads.
-- RUN:  manually in Supabase SQL Editor. Safe to re-run (idempotent guards below).
-- NOTE: `pm_commands.type` is a second line of defence only — the bridge's in-code
--       allowlist is authoritative and is stricter than this CHECK (e.g. it further
--       restricts which gates `answer`/`cancel` may target). Types intentionally
--       NOT included here because they are never issued from mobile: set-budget,
--       set-config, rotate, fork, and any spec/plan/uat/blocked gate decision.

-- ── 1. pm_live ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pm_live (
  id text NOT NULL,                             -- 'tasks' | 'bridge' | 'fleet' | 'session:<sessionId>'
  user_id uuid NOT NULL,
  kind text NOT NULL,                            -- 'tasks' | 'bridge' | 'fleet' | 'session'
  payload jsonb NOT NULL,
  rev bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_live_pkey PRIMARY KEY (id),
  CONSTRAINT pm_live_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS pm_live_user_idx ON public.pm_live (user_id);

-- ── 2. pm_commands ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pm_commands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(), -- browser client inserts without knowing its own id; RLS WITH CHECK still enforces it

  type text NOT NULL CHECK (type IN (
    'tick', 'capture', 'preflight', 'launch',
    'pause', 'abort-turn', 'resume', 'cancel', 'answer', 'ask'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'done', 'failed', 'expired')),
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT pm_commands_pkey PRIMARY KEY (id),
  CONSTRAINT pm_commands_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS pm_commands_pending_idx ON public.pm_commands (user_id, status, created_at);

-- ── 3. RLS — flat user_id policies, one per verb ───────────────────────────

ALTER TABLE public.pm_live ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_commands ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pm_live' AND policyname = 'pm_live_select_own') THEN
    CREATE POLICY pm_live_select_own ON public.pm_live FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pm_live' AND policyname = 'pm_live_insert_own') THEN
    CREATE POLICY pm_live_insert_own ON public.pm_live FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pm_live' AND policyname = 'pm_live_update_own') THEN
    CREATE POLICY pm_live_update_own ON public.pm_live FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pm_live' AND policyname = 'pm_live_delete_own') THEN
    CREATE POLICY pm_live_delete_own ON public.pm_live FOR DELETE USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pm_commands' AND policyname = 'pm_commands_select_own') THEN
    CREATE POLICY pm_commands_select_own ON public.pm_commands FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pm_commands' AND policyname = 'pm_commands_insert_own') THEN
    CREATE POLICY pm_commands_insert_own ON public.pm_commands FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pm_commands' AND policyname = 'pm_commands_update_own') THEN
    CREATE POLICY pm_commands_update_own ON public.pm_commands FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pm_commands' AND policyname = 'pm_commands_delete_own') THEN
    CREATE POLICY pm_commands_delete_own ON public.pm_commands FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ── 4. Realtime — phone subscribes to pm_live, bridge subscribes to pm_commands ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pm_live'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_live;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pm_commands'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pm_commands;
  END IF;
END $$;
