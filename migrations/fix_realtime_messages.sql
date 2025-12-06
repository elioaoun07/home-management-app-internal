-- =============================================================================
-- FIX: Enable Realtime for Hub Messages and Receipts
-- Run this ENTIRE script in Supabase SQL Editor
-- =============================================================================

-- STEP 1: Check current publication status (for debugging)
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- =============================================================================
-- STEP 2: Enable REPLICA IDENTITY (required for realtime to track changes)
-- =============================================================================
ALTER TABLE public.hub_messages REPLICA IDENTITY FULL;
ALTER TABLE public.hub_message_receipts REPLICA IDENTITY FULL;

-- =============================================================================
-- STEP 3: Add tables to realtime publication (ignore errors if already added)
-- =============================================================================
DO $$
BEGIN
  -- Try to add hub_messages to realtime
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hub_messages;
    RAISE NOTICE 'Added hub_messages to realtime publication';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'hub_messages already in realtime publication';
  END;
  
  -- Try to add hub_message_receipts to realtime
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hub_message_receipts;
    RAISE NOTICE 'Added hub_message_receipts to realtime publication';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'hub_message_receipts already in realtime publication';
  END;
END $$;

-- =============================================================================
-- STEP 4: Verify tables are in publication
-- =============================================================================
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- =============================================================================
-- STEP 5: Fix RLS policies to allow senders to receive receipt updates via realtime
-- The key issue: Realtime respects RLS, so senders need to be able to SELECT receipts
-- =============================================================================

-- Drop and recreate the sender policy to be more permissive
DROP POLICY IF EXISTS "Senders can view receipts of their messages" ON public.hub_message_receipts;
CREATE POLICY "Senders can view receipts of their messages"
  ON public.hub_message_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hub_messages m
      WHERE m.id = hub_message_receipts.message_id 
        AND m.sender_user_id = auth.uid()
    )
  );

-- =============================================================================
-- STEP 6: Update functions with SECURITY DEFINER (bypass RLS for DB operations)
-- =============================================================================

-- Function to get receipt statuses for a sender's messages (bypasses RLS)
CREATE OR REPLACE FUNCTION get_message_receipt_statuses(p_message_ids uuid[])
RETURNS TABLE (message_id uuid, status text) AS $$
BEGIN
  RETURN QUERY
  SELECT r.message_id, r.status
  FROM public.hub_message_receipts r
  WHERE r.message_id = ANY(p_message_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_message_receipts()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id uuid;
  v_partner_id uuid;
BEGIN
  SELECT owner_user_id, partner_user_id 
  INTO v_owner_id, v_partner_id
  FROM public.household_links 
  WHERE id = NEW.household_id;
  
  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.sender_user_id THEN
    INSERT INTO public.hub_message_receipts (message_id, user_id, status)
    VALUES (NEW.id, v_owner_id, 'sent')
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;
  
  IF v_partner_id IS NOT NULL AND v_partner_id != NEW.sender_user_id THEN
    INSERT INTO public.hub_message_receipts (message_id, user_id, status)
    VALUES (NEW.id, v_partner_id, 'sent')
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_message_receipts failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_messages_delivered(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.hub_message_receipts
  SET status = 'delivered', delivered_at = now()
  WHERE user_id = p_user_id 
    AND status = 'sent';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_thread_messages_read(p_user_id uuid, p_thread_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.hub_message_receipts r
  SET status = 'read', read_at = now()
  FROM public.hub_messages m
  WHERE r.message_id = m.id
    AND r.user_id = p_user_id 
    AND m.thread_id = p_thread_id
    AND r.status != 'read';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 7: Ensure trigger exists
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_create_message_receipts ON public.hub_messages;
CREATE TRIGGER trigger_create_message_receipts
  AFTER INSERT ON public.hub_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_receipts();

-- =============================================================================
-- STEP 8: Grant necessary permissions
-- =============================================================================
GRANT SELECT ON public.hub_messages TO authenticated;
GRANT SELECT ON public.hub_message_receipts TO authenticated;
GRANT UPDATE ON public.hub_message_receipts TO authenticated;

-- =============================================================================
-- DONE! Verify with:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Should show both hub_messages and hub_message_receipts
-- =============================================================================
