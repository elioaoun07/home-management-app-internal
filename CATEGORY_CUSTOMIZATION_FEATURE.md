# Category Customization Feature

## Overview

This feature allows users to fully customize their category and subcategory lists within the Settings page. Users can reorder categories, add/remove items, change colors, and these customizations will be reflected throughout the application, especially in the dashboard.

## Features

### 1. Category Management UI

- **Location**: Settings → Categories tab (next to Accounts)
- **Capabilities**:
  - View all categories organized by account
  - Drag-and-drop reordering for both categories and subcategories
  - Add new categories and subcategories
  - Edit category name, icon, and color
  - Delete categories (with validation for subcategories)
  - Color picker for custom category colors

### 2. Dashboard Integration

- Category names in the dashboard now display in their custom colors
- Color customization applies to:
  - Category breakdown section (widget view)
  - Transaction list items (list view)
  - Progress bars and visual indicators
  - All category references throughout the app

### 3. API Endpoints

#### `/api/categories/manage` (POST)

Unified endpoint for all category operations:

**Operations:**

- `create` - Create a new category or subcategory
- `update` - Update category properties (name, icon, color, visibility, position)
- `delete` - Soft delete (hide) or hard delete a category
- `reorder` - Batch update positions for drag-and-drop reordering
- `bulk_update` - Update multiple categories in one request

**Request Format:**

```json
{
  "operation": "create|update|delete|reorder|bulk_update",
  "data": {
    // Operation-specific data
  }
}
```

**Examples:**

Create Category:

```json
{
  "operation": "create",
  "data": {
    "name": "Entertainment",
    "icon": "🎬",
    "color": "#ff6b6b",
    "account_id": "uuid",
    "parent_id": null
  }
}
```

Update Category:

```json
{
  "operation": "update",
  "data": {
    "id": "uuid",
    "name": "Updated Name",
    "color": "#4ecdc4"
  }
}
```

Reorder Categories:

```json
{
  "operation": "reorder",
  "data": {
    "account_id": "uuid",
    "categories": [
      { "id": "uuid1", "position": 0 },
      { "id": "uuid2", "position": 1 }
    ]
  }
}
```

### 4. Database Schema

The existing `user_categories` table supports customization with these fields:

- `position` - Integer for custom ordering (0-based, lower values appear first)
- `color` - Hex color code (e.g., "#38bdf8")
- `visible` - Boolean for soft deletion (hidden categories preserved for historical data)
- `icon` - Emoji or text icon
- `parent_id` - For subcategory hierarchy

**Indexes Added:**

```sql
-- For efficient ordering queries
CREATE INDEX idx_user_categories_position
ON user_categories(user_id, account_id, position)
WHERE visible = true;

-- For parent-child relationships
CREATE INDEX idx_user_categories_parent
ON user_categories(parent_id)
WHERE parent_id IS NOT NULL;
```

### 5. React Hooks

**useCategoryManagement()**
Comprehensive hook providing all category operations:

```typescript
const { create, update, delete, reorder, bulkUpdate, isLoading } = useCategoryManagement();

// Create a category
await create.mutateAsync({
  name: "Food & Dining",
  icon: "🍔",
  color: "#ffa94d",
  account_id: accountId
});

// Update a category
await update.mutateAsync({
  id: categoryId,
  color: "#ff6b6b"
});

// Delete a category
await delete.mutateAsync({
  id: categoryId,
  hard_delete: false // Soft delete by default
});

// Reorder categories
await reorder.mutateAsync({
  account_id: accountId,
  categories: [
    { id: "uuid1", position: 0 },
    { id: "uuid2", position: 1 }
  ]
});
```

### 6. Components

**CategoryManagement Component**

- Path: `src/components/settings/CategoryManagement.tsx`
- Features:
  - Account selector to manage categories per account
  - Hierarchical category display with expand/collapse
  - Drag-and-drop using @dnd-kit
  - Inline editing forms
  - Color picker integration
  - Validation (prevents deleting categories with subcategories)

### 7. Transaction Service Updates

The `SupabaseTransactionService` now includes category colors in transaction queries:

```typescript
// Categories now include color field
.select(`
  id, date, category_id, subcategory_id, amount, description,
  category:user_categories!transactions_category_fk(name, icon, color),
  subcategory:user_categories!transactions_subcategory_fk(name, color)
`)
```

Transaction objects now include:

- `category_color` - Custom color for the category
- `subcategory_color` - Custom color for the subcategory

## Usage Guide

### For Users

1. **Navigate to Settings**
   - Open Settings from the app
   - Click on the "Categories" tab

2. **Select an Account**
   - Choose which account's categories you want to manage
   - Each account can have its own category organization

3. **Reorder Categories**
   - Drag the grip handle (⋮⋮) to reorder items
   - Click "Save Order" to persist changes
   - Reordering is separate for top-level categories and subcategories

4. **Add New Category**
   - Click "Add Category" button
   - Enter name, icon (emoji), and choose a color
   - Click "Create"

5. **Add Subcategory**
   - Click the "+" button next to a parent category
   - Fill in subcategory details
   - Subcategories inherit parent color by default (can be customized)

6. **Edit Category**
   - Click the edit (pencil) icon
   - Modify name, icon, or color
   - Changes save immediately

7. **Delete Category**
   - Click the delete (trash) icon
   - Confirm deletion
   - Note: Cannot delete categories with existing subcategories
   - Deleted categories are hidden but preserved for historical transactions

### For Developers

**Adding Category Color Support to New Components:**

```typescript
// 1. Import the Transaction type with colors
import type { Transaction } from "@/features/transactions/useDashboardTransactions";

// 2. Use the category_color in your component
<span style={{ color: transaction.category_color || "#38bdf8" }}>
  {transaction.category}
</span>

// 3. For category lists, build a color map
import { getCategoryColorsMap, getCategoryColor } from "@/lib/utils/getCategoryColor";

const colorMap = getCategoryColorsMap(transactions);
const categoryColor = getCategoryColor(categoryName, colorMap);
```

**Extending the API:**

To add new category operations, update `/api/categories/manage/route.ts`:

```typescript
// Add new operation type
switch (operation) {
  case "your_operation":
    return await handleYourOperation(supabase, user.id, data);
  // ... existing cases
}

// Implement handler
async function handleYourOperation(supabase, userId, data) {
  // Your logic here
}
```

## Technical Details

### Performance Optimizations

1. **Query Caching**: Categories are cached with React Query
2. **Optimistic Updates**: UI updates immediately before server confirmation
3. **Batch Operations**: Reorder uses bulk updates to minimize requests
4. **Indexed Queries**: Database indexes on position and parent_id fields

### Error Handling

- Validation prevents orphaned subcategories
- Soft deletes preserve data integrity
- Transactions maintain category references even after deletion
- Error messages provide clear user feedback

### Data Flow

1. User interacts with CategoryManagement component
2. Component calls appropriate hook (create/update/delete/reorder)
3. Hook sends request to `/api/categories/manage`
4. API validates and processes operation
5. Database updated with new values
6. React Query invalidates and refetches categories
7. UI updates across all components using categories

## Migration

To apply the database changes:

```sql
-- Run the migration file
\i migrations/add_category_customization.sql
```

This adds:

- Performance indexes
- Constraint validation
- Column comments for documentation

## Future Enhancements

Potential improvements:

- Category templates/presets
- Import/export category configurations
- Category usage analytics
- Duplicate category detection
- Multi-select bulk operations
- Category groups/tags
- Category icons library (beyond emojis)

## Testing Checklist

- [ ] Create a new category
- [ ] Create a subcategory
- [ ] Edit category name, icon, and color
- [ ] Reorder categories via drag-and-drop
- [ ] Reorder subcategories via drag-and-drop
- [ ] Delete a category without subcategories
- [ ] Attempt to delete a category with subcategories (should fail)
- [ ] Verify colors appear in dashboard category breakdown
- [ ] Verify colors appear in transaction list
- [ ] Switch between accounts and verify separate category lists
- [ ] Save order and refresh page to confirm persistence
- [ ] Create transaction with custom-colored category
- [ ] Verify historical transactions preserve deleted category names

## Support

For issues or questions:

- Check console for error messages
- Verify database migration has been applied
- Ensure Supabase policies allow category operations
- Check React Query DevTools for cache state
