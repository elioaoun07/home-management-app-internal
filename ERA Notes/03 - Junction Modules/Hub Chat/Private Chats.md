---
created: 2026-03-23
type: feature-doc
module: hub-chat
module-type: junction
status: active
tags:
  - type/feature-doc
  - module/hub-chat
---
# Private vs Public Chat Conversations

## Overview

You can now create **Private** or **Public** chat conversations in the Hub:

- 🌐 **Public** (default) - Visible to all household members
- 🔒 **Private** - Only visible to you (the creator)

---

## How to Create a Private Chat

### When Creating a New Conversation:

1. Click the **+ button** to create a new conversation
2. In the modal, you'll see a **Privacy** toggle at the top
3. Click the toggle to switch between:
   - 🌐 **Public** (Blue toggle on left) - Visible to household
   - 🔒 **Private** (Purple toggle on right) - Only you can see it

### Visual Indicators:

**Privacy Toggle:**

- 🌐 = Public (Blue)
- 🔒 = Private (Purple)

**In Chat List:**

- Private chats show a **🔒 lock icon** next to the title
- Public chats have no special indicator

---

## Use Cases

### 🔒 Use Private Chats For:

- Personal shopping lists (surprise gifts, etc.)
- Private reminders or notes
- Personal budget tracking
- Items you don't want to share with household

### 🌐 Use Public Chats For:

- Shared grocery lists
- Household bills and expenses
- Joint trip planning
- Family reminders
- Shared notes

---

## Database Changes

The migration adds:

- `is_private` boolean column to `hub_chat_threads` table (defaults to `false`)
- API filtering to show only:
  - All public threads
  - Private threads created by the current user

---

## Migration Required

Run this SQL to enable the feature:

```sql
-- Add is_private column
ALTER TABLE public.hub_chat_threads
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
```

Or use the quick migration script:

```bash
psql $DATABASE_URL -f scripts/run-migration.sql
```

---

## Technical Details

### API Changes:

- `GET /api/hub/threads` - Now filters threads based on privacy
  - Shows: `is_private = false OR (is_private = true AND created_by = current_user)`
- `POST /api/hub/threads` - Accepts `is_private` parameter

### Type Updates:

- `HubChatThread` type includes `is_private?: boolean`

### UI Updates:

- Privacy toggle in CreateThread modal
- 🔒 lock icon indicator in thread list
- Purple color scheme for private chats

---

## Privacy Guarantee

Private chats are **truly private**:

- ✅ Only visible in your thread list
- ✅ Not accessible by other household members via API
- ✅ Filtered at database query level
- ✅ Clear visual indicator so you always know what's private

---

**Perfect for keeping surprise gifts secret or maintaining personal notes within your household budget app!** 🎁🔒
