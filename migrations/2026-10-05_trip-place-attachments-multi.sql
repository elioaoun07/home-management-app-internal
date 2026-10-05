-- WHAT: Replaces trip_places.attachment_path (single) with attachment_paths text[] (many).
-- WHY:  One booking (e.g. a train) often has several QR codes / tickets; they belong to one place.
-- RUN:  Manually in Supabase SQL Editor, AFTER 2026-10-05_trip-place-attachment.sql (or on its own;
--       the guards below make either order safe). Safe to re-run.
-- NOTE: No new table, no new policy. Files stay in the private `trip-documents` bucket.

ALTER TABLE public.trip_places
  ADD COLUMN IF NOT EXISTS attachment_paths text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'trip_places' AND column_name = 'attachment_path'
  ) THEN
    UPDATE public.trip_places
       SET attachment_paths = ARRAY[attachment_path]
     WHERE attachment_path IS NOT NULL AND attachment_paths = '{}';
    ALTER TABLE public.trip_places DROP COLUMN attachment_path;
  END IF;
END $$;
