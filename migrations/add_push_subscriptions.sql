-- Migration: Add Push Subscriptions for Web Push Notifications
-- This migration adds the push_subscriptions table to store Web Push endpoints per user/device

-- ============================================
-- PUSH SUBSCRIPTIONS TABLE
-- ============================================

CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  -- Web Push subscription data
  endpoint text NOT NULL,
  p256dh text NOT NULL,        -- Public key for encryption
  auth text NOT NULL,          -- Auth secret for encryption
  -- Device info
  device_name text,
  user_agent text,
  -- Status tracking
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamp with time zone,
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  -- Constraints
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (user_id, endpoint)
);

-- Indexes
CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);
CREATE INDEX push_subscriptions_active_idx ON public.push_subscriptions(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER push_subscriptions_updated_at_trigger
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- ============================================
-- NOTIFICATION LOGS TABLE
-- ============================================

-- Track sent notifications for debugging and preventing duplicates
CREATE TABLE public.notification_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_id uuid,                     -- References item_alerts if from a reminder
  subscription_id uuid,              -- The push subscription used
  -- Notification content
  title text NOT NULL,
  body text,
  tag text,                          -- For grouping/replacing notifications
  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'clicked', 'dismissed')),
  error_message text,
  -- Timestamps
  sent_at timestamp with time zone,
  clicked_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  -- Constraints
  CONSTRAINT notification_logs_pkey PRIMARY KEY (id),
  CONSTRAINT notification_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT notification_logs_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.item_alerts(id) ON DELETE SET NULL,
  CONSTRAINT notification_logs_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.push_subscriptions(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX notification_logs_user_id_idx ON public.notification_logs(user_id);
CREATE INDEX notification_logs_alert_id_idx ON public.notification_logs(alert_id);
CREATE INDEX notification_logs_created_at_idx ON public.notification_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification logs"
  ON public.notification_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.push_subscriptions IS 'Web Push subscription endpoints per user/device for sending push notifications';
COMMENT ON COLUMN public.push_subscriptions.endpoint IS 'The Web Push endpoint URL provided by the browser';
COMMENT ON COLUMN public.push_subscriptions.p256dh IS 'The P-256 ECDH public key for encrypting push messages';
COMMENT ON COLUMN public.push_subscriptions.auth IS 'The authentication secret for the subscription';
COMMENT ON TABLE public.notification_logs IS 'Log of all sent push notifications for tracking and debugging';
