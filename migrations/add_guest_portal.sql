-- Migration: Add Guest Portal tables
-- Created: 2026-02-07
-- Description: Tables for the Welcome Home guest portal (QR/NFC tag system)
-- These tables store guest sessions, chat messages, allergies, and feedback
-- All accessed via service-role (no RLS needed - guests are unauthenticated)

-- =============================================================================
-- GUEST PORTAL TAGS (generic QR/NFC tag registry)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.guest_portal_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- The host/owner
  tag_slug text NOT NULL UNIQUE, -- e.g. 'front-door', 'kitchen-1'
  label text, -- Human-readable display label (can change)
  destination text NOT NULL DEFAULT 'welcome', -- What this tag currently maps to
  is_active boolean NOT NULL DEFAULT true,
  wifi_ssid text, -- WiFi network name
  wifi_password text, -- WiFi password (stored for API-only access, never shown raw on page)
  bio_data jsonb DEFAULT '{}'::jsonb,
  -- Format: { "sleep_time": "11:00 PM", "wake_time": "8:00 AM", "house_rules_extra": [], "schedule_today": null }
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT guest_portal_tags_pkey PRIMARY KEY (id),
  CONSTRAINT guest_portal_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guest_portal_tags_slug ON public.guest_portal_tags(tag_slug);
CREATE INDEX IF NOT EXISTS idx_guest_portal_tags_user ON public.guest_portal_tags(user_id);

-- =============================================================================
-- GUEST SESSIONS (temporary visitors)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.guest_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  guest_name text, -- Entered by guest, nullable (anonymous)
  fingerprint text, -- Browser fingerprint hash (non-PII identifier)
  user_agent text, -- Browser user agent string
  ip_hash text, -- Hashed IP for dedup (not storing raw IP)
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT guest_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT guest_sessions_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.guest_portal_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_tag ON public.guest_sessions(tag_id);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_fingerprint ON public.guest_sessions(fingerprint);

-- =============================================================================
-- GUEST CHAT MESSAGES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.guest_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  session_id uuid NOT NULL,
  sender text NOT NULL CHECK (sender IN ('guest', 'host', 'bot')),
  message text NOT NULL,
  guest_name text, -- Denormalized for quick display
  metadata jsonb DEFAULT '{}'::jsonb, -- { "quick_action": "bedtime", "bot_intent": "schedule" }
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT guest_chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT guest_chat_messages_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.guest_portal_tags(id) ON DELETE CASCADE,
  CONSTRAINT guest_chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.guest_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guest_chat_tag ON public.guest_chat_messages(tag_id);
CREATE INDEX IF NOT EXISTS idx_guest_chat_session ON public.guest_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_guest_chat_created ON public.guest_chat_messages(created_at);

-- =============================================================================
-- GUEST ALLERGIES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.guest_allergies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  session_id uuid NOT NULL,
  guest_name text,
  allergies text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT guest_allergies_pkey PRIMARY KEY (id),
  CONSTRAINT guest_allergies_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.guest_portal_tags(id) ON DELETE CASCADE,
  CONSTRAINT guest_allergies_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.guest_sessions(id) ON DELETE CASCADE
);

-- One allergy entry per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_allergies_session ON public.guest_allergies(session_id);

-- =============================================================================
-- GUEST FEEDBACK (anonymous)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.guest_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL,
  feedback_type text NOT NULL CHECK (feedback_type IN ('suggestion', 'complaint')),
  message text NOT NULL,
  -- No session_id link = truly anonymous
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT guest_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT guest_feedback_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.guest_portal_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guest_feedback_tag ON public.guest_feedback(tag_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================
-- Disable RLS on guest tables since they're accessed via service role only
-- The API routes handle authorization

ALTER TABLE public.guest_portal_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_feedback ENABLE ROW LEVEL SECURITY;

-- Host (owner) can manage their own tags
CREATE POLICY "Hosts can manage their tags" ON public.guest_portal_tags
  FOR ALL USING (user_id = auth.uid());

-- Service role bypass for guest operations (unauthenticated guests use API routes with service role)
-- No guest-facing RLS policies needed - API routes use supabaseAdmin()

-- =============================================================================
-- SEED: Default guest portal tag for dev/first use
-- =============================================================================
INSERT INTO public.guest_portal_tags (user_id, tag_slug, label, destination, wifi_ssid, wifi_password, bio_data)
VALUES (
  '1cb9c50a-2a41-4fb3-8e90-2e270ca28830',
  'home',
  'Front Door',
  'welcome',
  'Wifi@home7',
  'E_wIf!7_H',
  '{
    "sleep_time": "11:00 PM",
    "wake_time": "8:00 AM",
    "house_rules_extra": ["Please keep the balcony door closed at night", "Shoes off inside the house please 🙏"],
    "schedule_today": null
  }'::jsonb
)
ON CONFLICT (tag_slug) DO NOTHING;
