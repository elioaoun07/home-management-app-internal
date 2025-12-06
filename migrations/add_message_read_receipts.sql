-- Migration: Add message read receipts (sent/delivered/read tracking per user)
-- This enables WhatsApp-style message status indicators

-- 1. Create table to track message delivery/read status per recipient
CREATE TABLE IF NOT EXISTS public.hub_message_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,  -- The recipient (not the sender)
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hub_message_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT hub_message_receipts_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.hub_messages(id) ON DELETE CASCADE,
  CONSTRAINT hub_message_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT hub_message_receipts_unique UNIQUE (message_id, user_id)
);

-- 2. Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_hub_message_receipts_message ON public.hub_message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_hub_message_receipts_user ON public.hub_message_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_hub_message_receipts_user_unread ON public.hub_message_receipts(user_id, status) WHERE status != 'read';

-- 3. Function to auto-create receipts when a message is sent
CREATE OR REPLACE FUNCTION create_message_receipts()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id uuid;
  v_partner_id uuid;
BEGIN
  -- Get household member IDs directly
  SELECT owner_user_id, partner_user_id 
  INTO v_owner_id, v_partner_id
  FROM public.household_links 
  WHERE id = NEW.household_id;
  
  -- Insert receipt for owner if they're not the sender
  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.sender_user_id THEN
    INSERT INTO public.hub_message_receipts (message_id, user_id, status)
    VALUES (NEW.id, v_owner_id, 'sent')
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;
  
  -- Insert receipt for partner if they're not the sender
  IF v_partner_id IS NOT NULL AND v_partner_id != NEW.sender_user_id THEN
    INSERT INTO public.hub_message_receipts (message_id, user_id, status)
    VALUES (NEW.id, v_partner_id, 'sent')
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the message insert
  RAISE WARNING 'create_message_receipts failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger to auto-create receipts
DROP TRIGGER IF EXISTS trigger_create_message_receipts ON public.hub_messages;
CREATE TRIGGER trigger_create_message_receipts
  AFTER INSERT ON public.hub_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_receipts();

-- 5. Function to mark messages as delivered (call when user opens the app/chat list)
CREATE OR REPLACE FUNCTION mark_messages_delivered(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.hub_message_receipts
  SET status = 'delivered', delivered_at = now()
  WHERE user_id = p_user_id 
    AND status = 'sent';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to mark messages as read (call when user opens a specific thread)
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

-- 7. Function to get unread count per thread for a user
CREATE OR REPLACE FUNCTION get_thread_unread_count(p_user_id uuid, p_thread_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM public.hub_message_receipts r
    JOIN public.hub_messages m ON r.message_id = m.id
    WHERE r.user_id = p_user_id 
      AND m.thread_id = p_thread_id
      AND r.status != 'read'
  );
END;
$$ LANGUAGE plpgsql;

-- 8. Function to get the first unread message ID for scroll positioning
CREATE OR REPLACE FUNCTION get_first_unread_message_id(p_user_id uuid, p_thread_id uuid)
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT m.id
    FROM public.hub_message_receipts r
    JOIN public.hub_messages m ON r.message_id = m.id
    WHERE r.user_id = p_user_id 
      AND m.thread_id = p_thread_id
      AND r.status != 'read'
    ORDER BY m.created_at ASC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- 9. Enable RLS
ALTER TABLE public.hub_message_receipts ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies - users can only see/update their own receipts
DROP POLICY IF EXISTS "Users can view their own receipts" ON public.hub_message_receipts;
CREATE POLICY "Users can view their own receipts"
  ON public.hub_message_receipts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own receipts" ON public.hub_message_receipts;
CREATE POLICY "Users can update their own receipts"
  ON public.hub_message_receipts FOR UPDATE
  USING (auth.uid() = user_id);

-- 11. Senders can view receipts of their messages (to show read status)
DROP POLICY IF EXISTS "Senders can view receipts of their messages" ON public.hub_message_receipts;
CREATE POLICY "Senders can view receipts of their messages"
  ON public.hub_message_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hub_messages m
      WHERE m.id = message_id AND m.sender_user_id = auth.uid()
    )
  );

-- 12. Allow trigger to insert receipts (SECURITY DEFINER function needs this)
DROP POLICY IF EXISTS "Trigger can insert receipts" ON public.hub_message_receipts;
CREATE POLICY "Trigger can insert receipts"
  ON public.hub_message_receipts FOR INSERT
  WITH CHECK (true);

-- 13. Enable realtime for both tables (ignore if already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hub_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hub_message_receipts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 14. Enable REPLICA IDENTITY for realtime to track changes properly
ALTER TABLE public.hub_messages REPLICA IDENTITY FULL;
ALTER TABLE public.hub_message_receipts REPLICA IDENTITY FULL;
