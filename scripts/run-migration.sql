-- ============================================
-- SHOPPING ITEM LINKS - QUICK MIGRATION
-- ============================================
-- Run this to add item URL support to your shopping lists
-- Execute in Supabase SQL Editor or via: psql $DATABASE_URL -f scripts/run-migration.sql

-- 1. Add enable_item_urls to hub_chat_threads (toggle per chat)
ALTER TABLE public.hub_chat_threads
ADD COLUMN IF NOT EXISTS enable_item_urls BOOLEAN DEFAULT FALSE;

-- 2. Add item_url to hub_messages (URL for each item)
ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS item_url TEXT DEFAULT NULL;

-- 3. Add is_private to hub_chat_threads (private chats only visible to creator)
ALTER TABLE public.hub_chat_threads
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- 4. Add color to hub_chat_threads (custom color for each chat)
ALTER TABLE public.hub_chat_threads
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;

-- 5. Verify installation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hub_chat_threads' AND column_name = 'enable_item_urls'
  ) THEN
    RAISE NOTICE '✅ Column enable_item_urls added successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to add enable_item_urls column';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hub_messages' AND column_name = 'item_url'
  ) THEN
    RAISE NOTICE '✅ Column item_url added successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to add item_url column';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hub_chat_threads' AND column_name = 'is_private'
  ) THEN
    RAISE NOTICE '✅ Column is_private added successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to add is_private column';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'hub_chat_threads' AND column_name = 'color'
  ) THEN
    RAISE NOTICE '✅ Column color added successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to add color column';
  END IF;

  RAISE NOTICE '🎉 Migration completed! You can now use item links, private chats, and custom colors.';
END $$;

