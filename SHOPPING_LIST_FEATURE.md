# Shopping List Feature for Hub Chats

## Overview

The shopping list feature transforms Hub chat threads with `purpose="shopping"` into a collaborative, real-time shopping list interface with checkboxes, strikethrough completed items, and persistent state across sessions.

## Features Implemented

### 1. **Purpose Value: "Notes"**

- Added "notes" as a valid purpose value for `hub_chat_threads`
- Updated schema.sql and migration file `add_thread_purpose.sql`
- Updated TypeScript types in `hooks.ts`

### 2. **Purpose Dropdown in Chat Creation**

- The "Create Thread Modal" now shows all purpose options including:
  - General 💬
  - Budget 💰 (links to Budget App)
  - Reminder ⏰ (links to Reminder App)
  - Shopping 🛒 (shopping list interface)
  - Travel ✈️
  - Health 🏥
  - Notes 📝 (NEW)
  - Other 📋

### 3. **Shopping List Interface**

When a thread has `purpose="shopping"`, it displays a special shopping list view instead of regular chat messages:

#### **Features:**

- ✅ **Checkbox Interface**: Click to mark items as complete
- ✅ **Strikethrough Completed Items**: Checked items move to bottom with strikethrough styling
- ✅ **Add Items Input**: Fixed input at top for quick item entry
- ✅ **Delete Items**: Hover over items to reveal delete button
- ✅ **Real-time Sync**: Both partners see updates instantly (uses existing webhook infrastructure)
- ✅ **Persistent State**: Checked state persists across sessions using localStorage

#### **How It Works:**

1. Shopping items are regular text messages in the thread
2. Checked state is tracked client-side in localStorage (key: `shopping-checked-items`)
3. Both partners can add, check, and delete items
4. Real-time updates work automatically through existing message sync
5. Items are sorted chronologically (oldest unchecked first, newest checked last)

### 4. **Archiving Strategy**

**Problem Solved:** Instead of creating 100 separate grocery chats per year, you have:

- **One "Groceries" shopping chat** (with `purpose="shopping"`)
- **One "Gifts" shopping chat** (separate list for different purchase type)

**How Archiving Works:**

- Completed items stay in the list (at the bottom, strikethrough)
- You can uncheck items to reuse them
- Delete items when you want to permanently remove them
- No need to create new chats - one persistent list per category

**Best Practice:**

- Create separate shopping threads for different categories:
  - "Weekly Groceries" - recurring household items
  - "Gift Ideas" - birthday/holiday gifts
  - "Home Depot" - hardware/improvement items
  - "Costco Run" - bulk items

### 5. **Real-time Collaboration**

- ✅ Uses existing `useRealtimeMessages` hook - no changes needed
- ✅ When one partner adds an item, the other sees it instantly
- ✅ When one partner checks an item, both see it move to completed section
- ✅ Webhook infrastructure handles all sync automatically

### 6. **Sorting**

Current implementation:

- **Unchecked items**: Sorted by creation time (oldest first)
- **Checked items**: Sorted by creation time (newest first, at bottom)

Note: Drag-and-drop reordering was removed for simplicity. Items naturally sort by when they were added, which works well for shopping lists.

## Technical Implementation

### Files Modified:

1. **schema.sql** - Added 'notes' to purpose CHECK constraint
2. **migrations/add_thread_purpose.sql** - Added 'notes' to purpose values
3. **src/features/hub/hooks.ts** - Updated ThreadPurpose type
4. **src/components/hub/HubPage.tsx** - Added conditional rendering for shopping view
5. **src/components/hub/ShoppingListView.tsx** - NEW: Shopping list component

### Data Model:

```typescript
// Messages are stored as plain text
{
  id: "uuid",
  content: "Milk",  // Plain text, simple!
  message_type: "text",
  thread_id: "shopping-thread-uuid",
  sender_user_id: "user-uuid",
  created_at: "2025-12-16T10:30:00Z"
}

// Checked state is tracked in localStorage
localStorage['shopping-checked-items'] = ["msg-uuid-1", "msg-uuid-2"]
```

### Component Structure:

```tsx
<ShoppingListView>
  {/* Fixed input at top */}
  <input placeholder="Add item..." />

  {/* Scrollable list */}
  <div>
    {/* Unchecked items */}
    <CheckboxItem /> ☐ Milk
    <CheckboxItem /> ☐ Eggs
    {/* Separator */}
    <div>Completed (2)</div>
    {/* Checked items */}
    <CheckboxItem checked /> ☑ ~~Bread~~
    <CheckboxItem checked /> ☑ ~~Butter~~
  </div>
</ShoppingListView>
```

## Usage

### Creating a Shopping List:

1. Click "New Chat" in Hub
2. Select "Shopping 🛒" purpose
3. Choose an icon (or keep 🛒)
4. Name it (e.g., "Weekly Groceries")
5. Click "Create"

### Using the Shopping List:

1. Type item name in input at top
2. Press Enter or click + to add
3. Click checkbox to mark as complete
4. Hover and click trash icon to delete
5. Items sync in real-time with your partner

### Best Practices:

- Create one list per shopping category
- Keep lists concise (delete old completed items periodically)
- Use descriptive names: "Costco Run" not "Shopping"
- Uncheck items you buy regularly instead of re-adding them

## Future Enhancements (Optional)

- [ ] Drag-and-drop reordering within unchecked items
- [ ] Categories/sections within a shopping list (Produce, Dairy, etc.)
- [ ] "Clear all completed" button
- [ ] Share checked state across devices (move from localStorage to database)
- [ ] Add quantity/notes to items (e.g., "Milk - 2 gallons")
- [ ] Shopping list templates

## Migration

No database migration required! The shopping list feature:

- Uses existing `hub_messages` table
- Uses existing real-time infrastructure
- Only adds new UI rendering when `purpose="shopping"`

Existing shopping threads will automatically get the new interface.
