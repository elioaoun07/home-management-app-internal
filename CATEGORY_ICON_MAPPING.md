# Category Icon Mapping System

## Overview

Each category now has its own unique futuristic SVG icon, replacing the previous emoji-based system. Icons are automatically mapped based on category names and slugs.

## Icon Mapping

### Category-Specific Icons

| Category Type         | Icon Component      | Visual                          |
| --------------------- | ------------------- | ------------------------------- |
| **Income**            | `IncomeIcon`        | Dollar sign in circle with glow |
| **Food & Dining**     | `FoodIcon`          | Fork and knife utensils         |
| **Coffee**            | `CoffeeIcon`        | Coffee cup with steam           |
| **Transport**         | `TransportIcon`     | Car/vehicle icon                |
| **Shopping**          | `ShoppingBagIcon`   | Shopping bag                    |
| **Bills & Utilities** | `BillIcon`          | Question mark in circle         |
| **Home & Housing**    | `HomeIcon`          | House structure                 |
| **Health**            | `HealthIcon`        | Heart icon                      |
| **Entertainment**     | `EntertainmentIcon` | Movie/screen icon               |
| **Education**         | `EducationIcon`     | Graduation cap/books            |
| **Gifts**             | `GiftIcon`          | Gift box with bow               |

### Default Fallback

- **Uncategorized/Others**: `DollarSignIcon` - Standard dollar sign icon

## Implementation

### Icon Mapping Function

```typescript
import { getCategoryIcon } from '@/lib/utils/getCategoryIcon';

// Get icon component for a category
const IconComponent = getCategoryIcon(categoryName, categorySlug);

// Render with neon glow
<IconComponent className="w-6 h-6 text-[#06b6d4]/80 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
```

### Glow Color Mapping

```typescript
import { getCategoryGlowClass } from "@/lib/utils/getCategoryIcon";

// Get appropriate glow for category color
const glowClass = getCategoryGlowClass(category.color);
```

## Matching Logic

The `getCategoryIcon` function uses intelligent string matching:

1. **Primary Keywords**: Checks category name and slug for primary keywords (e.g., "income", "food", "transport")
2. **Secondary Keywords**: Checks for related terms (e.g., "salary", "bonus" → Income; "restaurant", "dining" → Food)
3. **Subcategory Keywords**: Specific terms like "coffee", "fuel", "parking" get specialized icons
4. **Case Insensitive**: All matching is case-insensitive
5. **Fallback**: Returns `DollarSignIcon` if no match found

## Examples

### Category Grid (Expense Form)

```tsx
{
  categories.map((category) => {
    const IconComponent = getCategoryIcon(category.name, category.slug);
    return (
      <button key={category.id}>
        <IconComponent
          className={cn(
            "w-8 h-8 text-[#06b6d4]/80",
            getCategoryGlowClass(category.color)
          )}
        />
        <span>{category.name}</span>
      </button>
    );
  });
}
```

### Transaction Items

```tsx
{
  transactions.map((tx) => {
    const IconComponent = getCategoryIcon(tx.category);
    return (
      <div key={tx.id}>
        <IconComponent className="w-5 h-5 text-[#06b6d4]/70" />
        <span>{tx.category}</span>
      </div>
    );
  });
}
```

### Category Detail View

```tsx
const IconComponent = getCategoryIcon(category);
return (
  <div>
    <IconComponent className="w-12 h-12 text-[#06b6d4] drop-shadow-[0_0_15px_rgba(6,182,212,0.7)]" />
    <h1>{category}</h1>
  </div>
);
```

## Visual Consistency

### Icon Sizes

- **Category Grid**: 8×8 (w-8 h-8) - Large for selection
- **Transaction List**: 5×5 (w-5 h-5) - Compact for lists
- **Category Header**: 12×12 (w-12 h-12) - Prominent for details
- **Stats Cards**: 6×6 (w-6 h-6) - Balanced for widgets

### Glow Effects

All icons use neon drop-shadow effects:

- **Default Cyan**: `drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]`
- **Green**: `drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]`
- **Blue**: `drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]`
- **Yellow**: `drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]`
- **Red**: `drop-shadow-[0_0_8px_rgba(248,113,113,0.6)]`

### Color Mapping

The system supports automatic glow color mapping based on category colors:

```typescript
const colorMap = {
  green: "rgba(20,184,166,0.6)",
  blue: "rgba(56,189,248,0.6)",
  cyan: "rgba(6,182,212,0.6)",
  red: "rgba(248,113,113,0.6)",
  yellow: "rgba(252,211,77,0.6)",
  orange: "rgba(251,146,60,0.6)",
  purple: "rgba(168,85,247,0.6)",
  pink: "rgba(236,72,153,0.6)",
};
```

## Components Updated

All components now use the category icon mapping:

1. ✅ **MobileExpenseForm** - Category selection grid
2. ✅ **SwipeableTransactionItem** - Transaction list items
3. ✅ **EnhancedMobileDashboard** - Recent transactions widget
4. ✅ **CategoryDetailView** - Category detail header
5. ✅ **TransactionDetailModal** - Transaction edit modal

## Adding New Icons

To add a new category-specific icon:

1. **Create SVG Icon** in `FuturisticIcons.tsx`:

```tsx
export const NewCategoryIcon = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* SVG paths */}
  </svg>
);
```

2. **Update getCategoryIcon** function in `src/lib/utils/getCategoryIcon.tsx`:

```tsx
if (name.includes("newcategory") || slug.includes("newcategory")) {
  return NewCategoryIcon;
}
```

3. **Import in getCategoryIcon**:

```tsx
import { NewCategoryIcon } from "@/components/icons/FuturisticIcons";
```

## Design Philosophy

- **Minimal & Futuristic**: Clean line art with neon glows
- **Consistent Style**: All icons use 2px stroke width, 24×24 viewBox
- **Recognizable**: Icons clearly represent their categories
- **Performance**: SVG components, not image files
- **Scalable**: Works at any size without quality loss
- **Themeable**: Colors and glows adapt to app theme

## Migration Notes

### From Emoji System

Previously, categories used emoji strings (🍔, 🚗, 💡) stored in `defaultCategories.ts`. The new system:

1. **Automatic Mapping**: No need to manually assign icons
2. **Type-Safe**: Icon components instead of string emojis
3. **Customizable**: Easy to style with Tailwind classes
4. **Consistent**: Same visual style across all categories
5. **Performance**: No font/emoji rendering issues

### Backward Compatibility

- Old emoji values in database are ignored
- System uses category name/slug for mapping
- No database migration needed
- Works with existing category structure

## Troubleshooting

### Icon Not Appearing

1. Check category name matches a keyword in `getCategoryIcon`
2. Verify icon component is imported
3. Ensure className includes proper size (e.g., `w-6 h-6`)

### Wrong Icon Displayed

1. Category name might match multiple patterns
2. Add more specific matching logic to `getCategoryIcon`
3. Order matters - more specific checks should come first

### Styling Issues

1. Ensure parent has proper color context (text-[#color])
2. Check drop-shadow filter is supported
3. Verify Tailwind JIT is compiling custom classes

## Performance

- **Zero Runtime**: Icon mapping happens at render time
- **Tree Shaking**: Unused icon components are eliminated
- **No Images**: Pure SVG, no HTTP requests
- **Fast Rendering**: Native SVG performance
- **Small Bundle**: Each icon ~0.5KB gzipped

---

**Created**: January 2025  
**Version**: 1.0  
**Status**: Production Ready
