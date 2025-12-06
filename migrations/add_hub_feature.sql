-- ============================================
-- HUB FEATURE - Social + Financial Command Center
-- Migration: add_hub_feature.sql
-- ============================================

-- 1. Household Goals (must be created first - referenced by hub_messages)
CREATE TABLE IF NOT EXISTS public.hub_household_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.household_links(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Goal details
  name TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC DEFAULT 0,
  target_date DATE,
  
  -- Visual
  icon TEXT DEFAULT 'target',
  color TEXT DEFAULT '#38bdf8',
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hub_goals_household ON public.hub_household_goals(household_id, status);


-- 2. Alerts (must be created before hub_messages - referenced by it)
CREATE TABLE IF NOT EXISTS public.hub_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  household_id UUID REFERENCES public.household_links(id) ON DELETE CASCADE,
  
  -- Alert classification
  alert_type TEXT NOT NULL 
    CHECK (alert_type IN (
      'bill_due',           -- Recurring payment due
      'budget_warning',     -- 80%+ of budget used
      'budget_exceeded',    -- Over budget
      'unusual_spending',   -- Anomaly detected
      'goal_milestone',     -- Goal hit 25/50/75%
      'streak_at_risk',     -- About to break streak
      'weekly_summary',     -- Auto weekly digest
      'monthly_summary'     -- Auto monthly digest
    )),
  
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('action', 'warning', 'info', 'success')),
  
  -- Content
  title TEXT NOT NULL,
  message TEXT,
  
  -- Reference to related item
  recurring_payment_id UUID REFERENCES public.recurring_payments(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.user_categories(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  action_taken BOOLEAN DEFAULT FALSE,
  
  -- When
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Some alerts expire (e.g., daily summary)
);

CREATE INDEX IF NOT EXISTS idx_hub_alerts_user ON public.hub_alerts(user_id, is_dismissed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_alerts_active ON public.hub_alerts(user_id, is_dismissed, is_read) 
  WHERE is_dismissed = FALSE;


-- 3. Chat Messages (between household members)
CREATE TABLE IF NOT EXISTS public.hub_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.household_links(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Message content
  message_type TEXT NOT NULL DEFAULT 'text' 
    CHECK (message_type IN ('text', 'system', 'transaction', 'goal', 'alert')),
  content TEXT, -- For text messages
  
  -- For transaction/goal/alert messages (references)
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  goal_id UUID REFERENCES public.hub_household_goals(id) ON DELETE SET NULL,
  alert_id UUID REFERENCES public.hub_alerts(id) ON DELETE SET NULL,
  
  -- Metadata
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- For replies
  reply_to_id UUID REFERENCES public.hub_messages(id) ON DELETE SET NULL
);

-- Index for fast chat loading
CREATE INDEX IF NOT EXISTS idx_hub_messages_household ON public.hub_messages(household_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_messages_unread ON public.hub_messages(household_id, sender_user_id, is_read) 
  WHERE is_read = FALSE;


-- 2. Activity Feed Items
CREATE TABLE IF NOT EXISTS public.hub_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.household_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- What type of activity
  activity_type TEXT NOT NULL 
    CHECK (activity_type IN (
      'transaction_added', 
      'transaction_edited',
      'transaction_deleted',
      'goal_created',
      'goal_progress',
      'goal_completed',
      'budget_alert',
      'milestone',
      'streak'
    )),
  
  -- Reference to the actual item
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.hub_household_goals(id) ON DELETE SET NULL,
  
  -- Cached display data (so we don't need joins for feed)
  title TEXT NOT NULL,
  subtitle TEXT,
  amount NUMERIC,
  icon TEXT,
  color TEXT,
  
  -- Engagement
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast feed loading
CREATE INDEX IF NOT EXISTS idx_hub_feed_household ON public.hub_feed(household_id, created_at DESC);


-- 3. Feed Reactions (likes, comments)
CREATE TABLE IF NOT EXISTS public.hub_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id UUID NOT NULL REFERENCES public.hub_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'comment')),
  comment_text TEXT, -- Only for comments
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for likes only (one like per user per item)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_reactions_unique_like 
  ON public.hub_reactions(feed_item_id, user_id) 
  WHERE reaction_type = 'like';

CREATE INDEX IF NOT EXISTS idx_hub_reactions_feed ON public.hub_reactions(feed_item_id);


-- 5. User Streaks & Stats (for scoreboard)
CREATE TABLE IF NOT EXISTS public.hub_user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  household_id UUID REFERENCES public.household_links(id) ON DELETE CASCADE,
  
  -- Period
  stat_period TEXT NOT NULL CHECK (stat_period IN ('daily', 'weekly', 'monthly', 'yearly', 'alltime')),
  period_start DATE NOT NULL,
  
  -- Stats
  total_spent NUMERIC DEFAULT 0,
  total_income NUMERIC DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  
  -- Streaks
  under_budget_streak INTEGER DEFAULT 0,
  logging_streak INTEGER DEFAULT 0,
  
  -- Calculated
  daily_average NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, stat_period, period_start)
);

CREATE INDEX IF NOT EXISTS idx_hub_stats_user ON public.hub_user_stats(user_id, stat_period, period_start DESC);


-- 6. Daily Pulse Cache (pre-calculated for speed)
CREATE TABLE IF NOT EXISTS public.hub_daily_pulse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  pulse_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Pre-calculated values
  amount_available NUMERIC, -- Budget remaining ÷ days left
  spent_yesterday NUMERIC,
  under_budget_streak INTEGER DEFAULT 0,
  
  -- Flags
  has_due_bills BOOLEAN DEFAULT FALSE,
  bills_due_today JSONB DEFAULT '[]', -- [{name, amount}]
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, pulse_date)
);

CREATE INDEX IF NOT EXISTS idx_hub_pulse_user ON public.hub_daily_pulse(user_id, pulse_date DESC);


-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all hub tables
ALTER TABLE public.hub_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_household_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_daily_pulse ENABLE ROW LEVEL SECURITY;

-- Hub Messages: Users can see messages from their household
CREATE POLICY "Users can view household messages" ON public.hub_messages
  FOR SELECT USING (
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their household" ON public.hub_messages
  FOR INSERT WITH CHECK (
    sender_user_id = auth.uid() AND
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages" ON public.hub_messages
  FOR UPDATE USING (sender_user_id = auth.uid());

-- Hub Feed: Users can see feed from their household
CREATE POLICY "Users can view household feed" ON public.hub_feed
  FOR SELECT USING (
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert feed items" ON public.hub_feed
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Hub Reactions: Users can see and add reactions
CREATE POLICY "Users can view reactions" ON public.hub_reactions
  FOR SELECT USING (
    feed_item_id IN (
      SELECT id FROM public.hub_feed WHERE household_id IN (
        SELECT id FROM public.household_links 
        WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can add reactions" ON public.hub_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their reactions" ON public.hub_reactions
  FOR DELETE USING (user_id = auth.uid());

-- Hub Alerts: Users can see their own alerts
CREATE POLICY "Users can view their alerts" ON public.hub_alerts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their alerts" ON public.hub_alerts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert alerts" ON public.hub_alerts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Hub User Stats: Users can see stats from their household
CREATE POLICY "Users can view household stats" ON public.hub_user_stats
  FOR SELECT USING (
    user_id = auth.uid() OR
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their stats" ON public.hub_user_stats
  FOR ALL USING (user_id = auth.uid());

-- Hub Household Goals: Users can see goals from their household
CREATE POLICY "Users can view household goals" ON public.hub_household_goals
  FOR SELECT USING (
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage household goals" ON public.hub_household_goals
  FOR ALL USING (
    household_id IN (
      SELECT id FROM public.household_links 
      WHERE owner_user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

-- Hub Daily Pulse: Users can only see their own pulse
CREATE POLICY "Users can view their pulse" ON public.hub_daily_pulse
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their pulse" ON public.hub_daily_pulse
  FOR ALL USING (user_id = auth.uid());


-- ============================================
-- TRIGGER: Auto-create feed item on transaction
-- ============================================

CREATE OR REPLACE FUNCTION public.create_feed_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_household_id UUID;
  v_category_name TEXT;
  v_category_color TEXT;
BEGIN
  -- Get household_id for this user
  SELECT id INTO v_household_id 
  FROM public.household_links 
  WHERE (owner_user_id = NEW.user_id OR partner_user_id = NEW.user_id)
    AND active = TRUE
  LIMIT 1;
  
  -- Only create feed if user is in a household
  IF v_household_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get category name and color
  SELECT name, color INTO v_category_name, v_category_color
  FROM public.user_categories 
  WHERE id = NEW.category_id;
  
  -- Insert feed item
  INSERT INTO public.hub_feed (
    household_id, 
    user_id, 
    activity_type, 
    transaction_id,
    title, 
    subtitle, 
    amount, 
    icon,
    color
  ) VALUES (
    v_household_id, 
    NEW.user_id, 
    'transaction_added', 
    NEW.id,
    COALESCE(v_category_name, 'Expense'),
    NEW.description,
    NEW.amount,
    'receipt',
    v_category_color
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trg_transaction_feed ON public.transactions;

CREATE TRIGGER trg_transaction_feed
AFTER INSERT ON public.transactions
FOR EACH ROW
WHEN (NEW.is_draft = FALSE)
EXECUTE FUNCTION public.create_feed_on_transaction();


-- ============================================
-- TRIGGER: Mark messages as read
-- ============================================

CREATE OR REPLACE FUNCTION public.mark_messages_read()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user views messages, mark unread messages from others as read
  UPDATE public.hub_messages
  SET is_read = TRUE
  WHERE household_id = NEW.household_id
    AND sender_user_id != NEW.sender_user_id
    AND is_read = FALSE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
