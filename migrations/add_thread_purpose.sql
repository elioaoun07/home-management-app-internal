-- ============================================
-- HUB CHAT THREADS - Add purpose and external URL support
-- Migration: add_thread_purpose.sql
-- ============================================
-- This enables linking conversations to external PWA apps
-- and matching actions (transaction, reminder) to conversation purpose

-- 1. Add purpose column (nullable for backward compatibility)
-- Purpose values: 'budget', 'reminder', 'general', etc.
ALTER TABLE public.hub_chat_threads 
ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'general' 
CHECK (purpose IN ('general', 'budget', 'reminder', 'shopping', 'travel', 'health', 'notes', 'other'));

-- 2. Add external_url column for PWA deep links
-- Stores the URL to navigate to when opening the external app
ALTER TABLE public.hub_chat_threads 
ADD COLUMN IF NOT EXISTS external_url TEXT;

-- 3. Add external_app_name for display purposes
ALTER TABLE public.hub_chat_threads 
ADD COLUMN IF NOT EXISTS external_app_name TEXT;

-- 4. Create index for quick purpose lookups
CREATE INDEX IF NOT EXISTS idx_hub_threads_purpose ON public.hub_chat_threads(purpose);

-- 5. Update existing Budget thread (if exists) - you may need to adjust the title match
UPDATE public.hub_chat_threads 
SET 
  purpose = 'budget',
  external_url = 'https://home-management-app-internal.vercel.app/expense',
  external_app_name = 'Budget App'
WHERE LOWER(title) LIKE '%budget%' AND purpose = 'general';

-- 6. Update existing Reminder thread (if exists)
UPDATE public.hub_chat_threads 
SET 
  purpose = 'reminder',
  external_url = 'https://home-manager-pwa.vercel.app/',
  external_app_name = 'Reminder App'
WHERE LOWER(title) LIKE '%reminder%' AND purpose = 'general';

-- 7. Add comment for documentation
COMMENT ON COLUMN public.hub_chat_threads.purpose IS 'Purpose of conversation: budget, reminder, general, etc. Determines default action types for messages';
COMMENT ON COLUMN public.hub_chat_threads.external_url IS 'URL to external PWA app for this conversation type';
COMMENT ON COLUMN public.hub_chat_threads.external_app_name IS 'Display name of the external app';

-- ============================================
-- RECOMMENDED EXTERNAL APP CONFIGURATION
-- ============================================
-- 
-- Budget App URL: https://home-management-app-internal.vercel.app/expense
-- - Purpose: 'budget'
-- - Default action: 'transaction'
-- - When user long-presses a message, suggest "Add Transaction"
--
-- Reminder App URL: https://home-manager-pwa.vercel.app/
-- - Purpose: 'reminder'  
-- - Default action: 'reminder'
-- - When user long-presses a message, suggest "Add Reminder"
--
-- Note on Cross-App Authentication:
-- Both apps use Supabase Auth. As long as:
-- 1. User is logged in on both PWAs (installed on mobile)
-- 2. The session cookie/token is valid
-- The user will remain authenticated when navigating between apps.
-- If session expires, user will need to re-authenticate on that specific app.
