# Category Customization - Quick Start Guide

## What's New?

You can now fully customize your categories in the Settings page:

- **Reorder** categories and subcategories with drag-and-drop
- **Add/Remove** categories and subcategories
- **Change colors** - category text in dashboard will match your chosen colors
- **Edit** names and icons

## How to Use

### Access Category Management

1. Go to **Settings**
2. Click on the **Categories** tab (next to Accounts)

### Customize Your Categories

#### Reorder Categories

- Drag items up/down using the grip handle (⋮⋮)
- Click **"Save Order"** when done

#### Add a Category

- Click **"Add Category"** button
- Enter name, emoji icon, and pick a color
- Click **"Create"**

#### Add a Subcategory

- Click the **"+"** button next to any category
- Fill in the details
- Click **"Create"**

#### Edit a Category

- Click the **edit icon** (pencil)
- Change name, icon, or color
- Click **"Save"**

#### Delete a Category

- Click the **trash icon**
- Confirm deletion
- Note: Categories with subcategories must have their subcategories deleted first

### Color Customization

The colors you choose will appear in:

- ✅ Dashboard category breakdown widget
- ✅ Transaction list items
- ✅ Category progress bars
- ✅ All category text throughout the app

## Tips

- Each account has its own category list
- Deleted categories are hidden but preserved for historical transactions
- Subcategories can have different colors from their parent
- Use emojis for icons (📱, 🍔, 🚗, etc.)

## Files Created/Modified

### New Files

- `migrations/add_category_customization.sql` - Database migration
- `src/app/api/categories/manage/route.ts` - API endpoint
- `src/components/settings/CategoryManagement.tsx` - Main UI component
- `src/features/categories/useCategoryManagement.ts` - React hooks
- `src/lib/utils/getCategoryColor.ts` - Color utility
- `CATEGORY_CUSTOMIZATION_FEATURE.md` - Full documentation

### Modified Files

- `src/components/settings/SettingsDialog.tsx` - Added Categories tab
- `src/services/transaction.service.ts` - Include colors in queries
- `src/features/transactions/useDashboardTransactions.ts` - Updated type
- `src/components/dashboard/EnhancedMobileDashboard.tsx` - Use category colors
- `src/components/dashboard/SwipeableTransactionItem.tsx` - Use category colors
- `src/features/categories/hooks.ts` - Export new hooks

## Next Steps

1. **Run the migration** (if not already done):

   ```sql
   -- Execute migrations/add_category_customization.sql in your database
   ```

2. **Test the feature**:
   - Open Settings → Categories
   - Create a test category with a custom color
   - Check if the color appears in the dashboard

3. **Customize your categories**:
   - Organize them in your preferred order
   - Choose colors that make sense for your budgeting style
   - Add subcategories for detailed tracking

## Need Help?

See `CATEGORY_CUSTOMIZATION_FEATURE.md` for:

- Detailed API documentation
- Developer integration guide
- Troubleshooting tips
- Technical architecture details
