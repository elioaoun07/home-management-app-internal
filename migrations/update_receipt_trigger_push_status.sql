-- Migration: Update message receipt trigger to set push_status for budget/reminder threads
-- This allows the trigger to set push_status directly, avoiding RLS issues

-- 1. Update the trigger function to include push_status
CREATE OR REPLACE FUNCTION create_message_receipts()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id uuid;
  v_partner_id uuid;
  v_thread_purpose text;
  v_should_push boolean;
BEGIN
  -- Get household member IDs
  SELECT owner_user_id, partner_user_id 
  INTO v_owner_id, v_partner_id
  FROM public.household_links 
  WHERE id = NEW.household_id;
  
  -- Get thread purpose to determine if we should set push_status
  SELECT purpose INTO v_thread_purpose
  FROM public.hub_chat_threads
  WHERE id = NEW.thread_id;
  
  -- Only set push_status for budget and reminder threads
  v_should_push := v_thread_purpose IN ('budget', 'reminder');
  
  -- Insert receipt for owner if they're not the sender
  IF v_owner_id IS NOT NULL AND v_owner_id != NEW.sender_user_id THEN
    INSERT INTO public.hub_message_receipts (message_id, user_id, status, push_status)
    VALUES (NEW.id, v_owner_id, 'sent', CASE WHEN v_should_push THEN 'pending' ELSE NULL END)
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;
  
  -- Insert receipt for partner if they're not the sender
  IF v_partner_id IS NOT NULL AND v_partner_id != NEW.sender_user_id THEN
    INSERT INTO public.hub_message_receipts (message_id, user_id, status, push_status)
    VALUES (NEW.id, v_partner_id, 'sent', CASE WHEN v_should_push THEN 'pending' ELSE NULL END)
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the message insert
  RAISE WARNING 'create_message_receipts failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add RLS policy to allow senders to update receipts of their messages (for push_status)
DROP POLICY IF EXISTS "Senders can update receipts of their messages" ON public.hub_message_receipts;
CREATE POLICY "Senders can update receipts of their messages"
  ON public.hub_message_receipts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.hub_messages m
      WHERE m.id = message_id AND m.sender_user_id = auth.uid()
    )
  );

-- 3. Add RLS policy to allow household members to view each other's push subscriptions
-- This is needed so we can send push notifications to our partner
DROP POLICY IF EXISTS "Household members can view partner push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Household members can view partner push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.household_links
      WHERE active = true
      AND (
        (owner_user_id = auth.uid() AND partner_user_id = user_id)
        OR (partner_user_id = auth.uid() AND owner_user_id = user_id)
      )
    )
  );

-- Comment explaining the change
COMMENT ON FUNCTION create_message_receipts() IS 'Auto-creates receipts when a message is inserted. Sets push_status=pending for budget/reminder threads.';
COMMENT ON POLICY "Household members can view partner push subscriptions" ON public.push_subscriptions IS 'Allows household members to fetch partner push subscriptions for sending notifications';
