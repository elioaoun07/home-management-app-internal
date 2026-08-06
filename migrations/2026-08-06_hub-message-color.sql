-- migrations/2026-08-06_hub-message-color.sql
--
-- Hub Chat — per-message color tag (HUB-11). Lets a household member tag any
-- message with a color from a fixed 8-color preset (no color has app-defined
-- meaning — the household decides, e.g. one color per person, or
-- transfer-vs-expense) and filter a thread down to one color at a time.
-- Message Actions' "Select All" reads this column client-side to scope bulk
-- convert to the active color filter — no new table, no RLS change (access
-- to hub_messages is already gated at the thread/household level by the
-- existing API routes).
--
-- Run the whole file in the Supabase SQL Editor. Idempotent: IF NOT EXISTS
-- guards on the column and index.

ALTER TABLE public.hub_messages
  ADD COLUMN IF NOT EXISTS color text
    CHECK (
      color IS NULL OR color = ANY (ARRAY[
        'rose'::text,
        'orange'::text,
        'amber'::text,
        'lime'::text,
        'emerald'::text,
        'cyan'::text,
        'indigo'::text,
        'fuchsia'::text
      ])
    );

COMMENT ON COLUMN public.hub_messages.color IS
  'Optional user-assigned color tag (HUB-11) for message categorization/filtering. Fixed 8-color preset enforced by the CHECK constraint; no color has a fixed meaning — the household assigns whatever it means to them (e.g. per-person, or transfer vs expense). Independent of message_type / message actions.';

-- Speeds up the color-filtered read path (thread_id + color) without paying
-- index cost for the common case of untagged messages.
CREATE INDEX IF NOT EXISTS idx_hub_messages_thread_color
  ON public.hub_messages (thread_id, color)
  WHERE color IS NOT NULL;
