-- Migration: add_guest_drinks.sql
-- Guest drink selections for the portal

CREATE TABLE IF NOT EXISTS guest_drinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES guest_portal_tags(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES guest_sessions(id) ON DELETE CASCADE,
  guest_name TEXT,
  drink_selection TEXT NOT NULL, -- 'water', 'soft_drink', 'red_wine', 'white_wine', 'whisky_single', 'whisky_blended', 'other'
  other_drink TEXT, -- If 'other' is selected, specify here
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guest_drinks_tag ON guest_drinks(tag_id);
CREATE INDEX IF NOT EXISTS idx_guest_drinks_session ON guest_drinks(session_id);

-- Unique constraint - one drink selection per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_drinks_unique_session ON guest_drinks(session_id);
