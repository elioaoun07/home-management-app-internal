-- Migration: Update trigger to set push_status when creating receipts
-- The trigger creates receipts but wasn't setting push_status

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
    INSERT INTO public.hub_message_receipts (message_id, user_id, status, push_status)
    VALUES (NEW.id, v_owner_id, 'sent', 'pending')
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;
  
  -- Insert receipt for partner if they're not the sender
  IF v_partner_id IS NOT NULL AND v_partner_id != NEW.sender_user_id THEN
    INSERT INTO public.hub_message_receipts (message_id, user_id, status, push_status)
    VALUES (NEW.id, v_partner_id, 'sent', 'pending')
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the message insert
  RAISE WARNING 'create_message_receipts failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
