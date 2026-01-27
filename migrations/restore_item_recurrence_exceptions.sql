-- ============================================================
-- RESTORE ITEM RECURRENCE EXCEPTIONS TABLE
-- ============================================================
-- This table was previously dropped in cleanup_unused_tables.sql
-- but is now needed for the "Edit Single Occurrence" feature.
-- ============================================================

-- Recreate the recurrence exceptions table
CREATE TABLE IF NOT EXISTS public.item_recurrence_exceptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  exdate timestamp with time zone NOT NULL,
  override_payload_json jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_recurrence_exceptions_pkey PRIMARY KEY (id),
  CONSTRAINT item_recurrence_exceptions_rule_id_fkey FOREIGN KEY (rule_id) 
    REFERENCES public.item_recurrence_rules(id) ON DELETE CASCADE,
  -- Prevent duplicate exceptions for the same date
  CONSTRAINT item_recurrence_exceptions_unique_exdate UNIQUE (rule_id, exdate)
);

-- Index for efficient lookups by rule_id
CREATE INDEX IF NOT EXISTS item_recurrence_exceptions_rule_idx 
  ON public.item_recurrence_exceptions(rule_id);

-- Enable RLS
ALTER TABLE public.item_recurrence_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage exceptions for their own items (via rule → item ownership)
DROP POLICY IF EXISTS "Users can manage recurrence exceptions" ON public.item_recurrence_exceptions;
CREATE POLICY "Users can manage recurrence exceptions" ON public.item_recurrence_exceptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.item_recurrence_rules r
      JOIN public.items i ON i.id = r.item_id
      WHERE r.id = item_recurrence_exceptions.rule_id 
        AND i.user_id = auth.uid()
    )
  );

-- Also allow household members to manage exceptions for shared items
DROP POLICY IF EXISTS "Household members can manage recurrence exceptions" ON public.item_recurrence_exceptions;
CREATE POLICY "Household members can manage recurrence exceptions" ON public.item_recurrence_exceptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.item_recurrence_rules r
      JOIN public.items i ON i.id = r.item_id
      JOIN public.household_links hl ON hl.active = true
        AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = i.user_id)
          OR
          (hl.partner_user_id = auth.uid() AND hl.owner_user_id = i.user_id)
        )
      WHERE r.id = item_recurrence_exceptions.rule_id 
        AND i.is_public = true
    )
  );

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.item_recurrence_exceptions IS 
  'Stores exceptions to recurring items - either skip dates or overrides for specific occurrences';

COMMENT ON COLUMN public.item_recurrence_exceptions.rule_id IS 
  'The recurrence rule this exception applies to';

COMMENT ON COLUMN public.item_recurrence_exceptions.exdate IS 
  'The specific date/time of the occurrence being modified or skipped';

COMMENT ON COLUMN public.item_recurrence_exceptions.override_payload_json IS 
  'JSON containing override values for this occurrence. NULL means skip the occurrence entirely.
   Example: {"title": "Modified Title", "start_at": "2025-01-27T10:00:00Z", "modified_fields": ["title", "start_at"]}';

COMMENT ON COLUMN public.item_recurrence_exceptions.created_at IS 
  'When this exception was created';
