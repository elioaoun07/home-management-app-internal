# Shopping List Item Links - Quick Setup

## Error: "Database migration required"

If you see this error when trying to enable item links, you need to run the database migration.

## Quick Fix

### Option 1: Run the quick migration script

```bash
# Using psql (if installed)
psql $DATABASE_URL -f scripts/run-migration.sql

# OR using Supabase CLI
supabase db push

# OR copy/paste into Supabase SQL Editor
cat scripts/run-migration.sql
```

### Option 2: Run the full migration

```bash
# Apply the full migration
psql $DATABASE_URL -f migrations/add_message_archiving.sql
```

### Option 3: Manual SQL (Supabase Dashboard)

1. Go to your Supabase project → SQL Editor
2. Run this SQL:

```sql
-- Add enable_item_urls column to hub_chat_threads
ALTER TABLE public.hub_chat_threads
ADD COLUMN IF NOT EXISTS enable_item_urls BOOLEAN DEFAULT FALSE;

-- Add item_url column to hub_messages
ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS item_url TEXT DEFAULT NULL;
```

3. Refresh your app and try again

## What This Does

- Adds `enable_item_urls` boolean column to `hub_chat_threads` table
- Adds `item_url` text column to `hub_messages` table
- Allows you to enable/disable hyperlinks per shopping chat
- When enabled, you can add product URLs to shopping list items

## Features

✅ Toggle item links on/off per chat (in header)  
✅ Add URLs to shopping items  
✅ Share product links with household members  
✅ Keep grocery lists clean (disable links)  
✅ Enable links for gift shopping (share product pages)
