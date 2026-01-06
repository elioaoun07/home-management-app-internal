-- Migration: Add Responsible User RLS Policies
-- This migration adds RLS policies for responsible user feature:
-- 1. Responsible users can view items they're responsible for
-- 2. Responsible users can update items (mark complete, add subtasks, postpone)
-- 3. Owners retain full control over their items

-- ============================================
-- UPDATE ITEMS SELECT POLICY
-- ============================================

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view own and partner public items" ON public.items;

-- Create new SELECT policy that allows:
-- 1. Users to view their own items (both public and private)
-- 2. Users to view items they're responsible for
-- 3. Users to view their partner's PUBLIC items
CREATE POLICY "Users can view own responsible and partner public items" ON public.items
  FOR SELECT USING (
    -- User's own items (owner)
    auth.uid() = user_id
    OR
    -- Items user is responsible for (assigned to them)
    auth.uid() = responsible_user_id
    OR
    -- Partner's public items (household sharing)
    (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.household_links
        WHERE active = true
        AND (
          (owner_user_id = auth.uid() AND partner_user_id = items.user_id)
          OR
          (partner_user_id = auth.uid() AND owner_user_id = items.user_id)
        )
      )
    )
  );

-- ============================================
-- UPDATE ITEMS UPDATE POLICY
-- ============================================

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own items" ON public.items;

-- Create new UPDATE policy that allows:
-- 1. Owners can update anything
-- 2. Responsible users can update: status, updated_at (for completing, postponing)
CREATE POLICY "Users can update own or responsible items" ON public.items
  FOR UPDATE USING (
    -- Owner has full update access
    auth.uid() = user_id
    OR
    -- Responsible user can update items assigned to them (if public)
    (
      auth.uid() = responsible_user_id
      AND is_public = true
    )
  )
  WITH CHECK (
    -- Owner can change anything
    auth.uid() = user_id
    OR
    -- Responsible user can only update if they're still responsible and item is public
    (
      auth.uid() = responsible_user_id
      AND is_public = true
    )
  );

-- ============================================
-- UPDATE ITEM_SUBTASKS POLICIES FOR RESPONSIBLE USERS
-- ============================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert own item subtasks" ON public.item_subtasks;

-- Create new INSERT policy that allows:
-- 1. Owners can insert subtasks
-- 2. Responsible users can insert subtasks on public items
CREATE POLICY "Users can insert own or responsible item subtasks" ON public.item_subtasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = parent_item_id
      AND (
        items.user_id = auth.uid()
        OR
        (items.responsible_user_id = auth.uid() AND items.is_public = true)
      )
    )
  );

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own item subtasks" ON public.item_subtasks;

-- Create new UPDATE policy for subtasks
CREATE POLICY "Users can update own or responsible item subtasks" ON public.item_subtasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = parent_item_id
      AND (
        items.user_id = auth.uid()
        OR
        (items.responsible_user_id = auth.uid() AND items.is_public = true)
      )
    )
  );

-- ============================================
-- UPDATE REMINDER_DETAILS POLICIES FOR RESPONSIBLE USERS
-- ============================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own reminder details" ON public.reminder_details;

-- Create new UPDATE policy that allows responsible users to update reminder status
CREATE POLICY "Users can update own or responsible reminder details" ON public.reminder_details
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = item_id
      AND (
        items.user_id = auth.uid()
        OR
        (items.responsible_user_id = auth.uid() AND items.is_public = true)
      )
    )
  );

-- ============================================
-- UPDATE ITEM_OCCURRENCE_ACTIONS POLICIES FOR RESPONSIBLE USERS
-- ============================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert own item occurrence actions" ON public.item_occurrence_actions;

-- Create new INSERT policy that allows responsible users to mark occurrences
CREATE POLICY "Users can insert own or responsible item occurrence actions" ON public.item_occurrence_actions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = item_id
      AND (
        items.user_id = auth.uid()
        OR
        (items.responsible_user_id = auth.uid() AND items.is_public = true)
      )
    )
  );

-- ============================================
-- HOUSEHOLD MEMBERS VIEW FOR PICKLIST (OPTIONAL)
-- ============================================

-- NOTE: The useHouseholdMembers hook already fetches household members
-- directly from household_links and profiles tables, so this view is 
-- not strictly required. Uncomment below if you want a database-level view.

-- If you have a profiles table with (id, display_name, email), you can use:
/*
CREATE OR REPLACE VIEW public.household_members AS
SELECT 
  hl.id as household_id,
  hl.owner_user_id,
  hl.owner_email,
  hl.partner_user_id,
  hl.partner_email,
  COALESCE(owner_profile.display_name, hl.owner_email, 'Owner') as owner_display_name,
  COALESCE(partner_profile.display_name, hl.partner_email, 'Partner') as partner_display_name,
  hl.active
FROM public.household_links hl
LEFT JOIN public.profiles owner_profile ON owner_profile.id = hl.owner_user_id
LEFT JOIN public.profiles partner_profile ON partner_profile.id = hl.partner_user_id
WHERE hl.active = true
AND (
  hl.owner_user_id = auth.uid()
  OR hl.partner_user_id = auth.uid()
);

GRANT SELECT ON public.household_members TO authenticated;
*/

-- ============================================
-- COMMENT ON POLICIES
-- ============================================

COMMENT ON POLICY "Users can view own responsible and partner public items" ON public.items IS 
  'Users can view: 1) their own items, 2) items they are responsible for, 3) partner public items';

COMMENT ON POLICY "Users can update own or responsible items" ON public.items IS 
  'Owners have full update access. Responsible users can update public items assigned to them (mark complete, postpone, etc.)';
