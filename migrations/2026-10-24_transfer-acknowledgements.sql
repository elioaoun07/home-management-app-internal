-- migrations/2026-10-24_transfer-acknowledgements.sql
--
-- WHAT: New table transfer_acknowledgements — one row per (user, incoming transfer)
--       the user has acknowledged in the IncomingTransferSheet.
-- WHY:  The acknowledgement was stored in localStorage (per device), so the sheet
--       reappeared on every other device/browser. Server-side rows sync it.
-- RUN:  manually in Supabase SQL Editor. Safe to re-run (idempotent guards below).

-- 1. Table (user-owned: direct user_id policies, no EXISTS subqueries)
CREATE TABLE IF NOT EXISTS public.transfer_acknowledgements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transfer_id uuid NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transfer_acknowledgements_pkey PRIMARY KEY (user_id, transfer_id)
);

-- 2. Index for "recent acks for this user" reads
CREATE INDEX IF NOT EXISTS transfer_acknowledgements_user_ack_idx
  ON public.transfer_acknowledgements (user_id, acknowledged_at DESC);

-- 3. RLS
ALTER TABLE public.transfer_acknowledgements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transfer_acknowledgements'
      AND policyname = 'transfer_acknowledgements_own'
  ) THEN
    CREATE POLICY transfer_acknowledgements_own
      ON public.transfer_acknowledgements
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
