-- WHAT: Adds an optional attachment (ticket / QR confirmation screenshot or PDF) to a trip place.
-- WHY:  Owner wants to store a booking QR code or ticket directly on the place.
-- RUN:  Manually in Supabase SQL Editor. Safe to re-run.
-- NOTE: No new table, so no new RLS policy: trip_places keeps its existing policies.
--       The file lives in the existing private `trip-documents` bucket; this column holds
--       only the storage path (never a signed URL). get_trip_bundle uses to_jsonb(p),
--       so it returns the new column without any function change.

ALTER TABLE public.trip_places
  ADD COLUMN IF NOT EXISTS attachment_path text;
