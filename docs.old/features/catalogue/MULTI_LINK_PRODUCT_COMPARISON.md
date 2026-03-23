# Multi-Link Product Comparison Feature

## Overview

The Multi-Link Product Comparison feature allows you to add multiple store links to shopping list items and automatically fetch product information (price, stock status, product details) using AI-powered web scraping via the Gemini API.

This is perfect for:

- Comparing prices across different stores (e.g., UPS from Mojitech, AbedTahan, etc.)
- Tracking stock availability at multiple retailers
- Making informed purchasing decisions with all the info in one place

## Features

### ✅ Multiple Links Per Item

- Add unlimited store links to any shopping item
- Each link stores: URL, store name, price, currency, stock status, product title, image

### ✅ AI-Powered Product Scraping

- Gemini AI extracts product info from any e-commerce page
- Automatically detects: price, stock status, product title, brand, model, specs
- Works with any website (Lebanese stores, Amazon, etc.)

### ✅ Price Comparison

- Best deal highlighting (lowest price in stock)
- Sort by price/availability
- Visual indicators for stock status

### ✅ Mobile-First Design

- Bottom sheet on mobile (85vh height)
- Right sidebar on desktop
- Touch-friendly interface

## How to Use

### 1️⃣ Enable Item Links for Your Shopping Chat

1. Open your shopping chat
2. Click the **"Links"** toggle in the header (turns blue when enabled)

### 2️⃣ Add Store Links to an Item

1. Find the shopping item (e.g., "UPS Battery Backup")
2. Click the **Layers icon** (📊) next to the item
3. A comparison sheet opens on the right/bottom
4. Click **"Add Store Link"**
5. Paste the product URL and press Enter
6. AI automatically fetches product info!

### 3️⃣ View & Compare

The comparison sheet shows:

- **Best Deal Banner**: Highlights the lowest price in stock
- **Store Cards**: Each store with price, stock status, and product details
- **Action Buttons**: Visit store, refresh info, delete link

### 4️⃣ Refresh Product Info

- Click the **refresh icon** (🔄) on any store card to update pricing
- Click **refresh all** in the header to update all stores at once

## Example: Your UPS Links

```
Item: UPS Battery Backup

Store 1: Mojitech (Pro Link PRO2000SFCU)
- URL: https://mojitech.net/shop/peripherals/ups-battery-backup/prolink-ups-pro2000sfcu/
- Price: Fetched automatically
- Stock: In Stock / Out of Stock

Store 2: Mojitech (PCE M8 2500VA)
- URL: https://mojitech.net/shop/pc-parts/ups/ups-pce-m8-2500va-1200w/
- Price: Fetched automatically
- Stock: In Stock / Out of Stock

Store 3: Abed Tahan (WB UPS 3000VA)
- URL: https://abedtahan.com/products/wb-ups-3000va
- Price: Fetched automatically
- Stock: In Stock / Out of Stock
```

## Database Schema

New table: `shopping_item_links`

| Column          | Type      | Description                                |
| --------------- | --------- | ------------------------------------------ |
| id              | uuid      | Primary key                                |
| message_id      | uuid      | FK to hub_messages (shopping item)         |
| user_id         | uuid      | FK to auth.users (who added)               |
| url             | text      | Product URL                                |
| store_name      | text      | Extracted store name                       |
| product_title   | text      | Scraped product name                       |
| price           | numeric   | Current price                              |
| currency        | text      | Price currency (USD, LBP, etc.)            |
| stock_status    | text      | in_stock, out_of_stock, low_stock, unknown |
| stock_quantity  | integer   | If available, exact count                  |
| image_url       | text      | Product image URL                          |
| extra_info      | jsonb     | Brand, model, specs, warranty, shipping    |
| last_fetched_at | timestamp | When info was last updated                 |
| fetch_error     | text      | Error message if fetch failed              |

## API Endpoints

### GET /api/hub/item-links?message_id=xxx

Get all links for a shopping item

### POST /api/hub/item-links

Add a new link to an item

```json
{
  "message_id": "uuid",
  "url": "https://...",
  "auto_fetch": true
}
```

### PATCH /api/hub/item-links

Refresh product info for a link

```json
{
  "link_id": "uuid",
  "action": "refresh"
}
```

### DELETE /api/hub/item-links?link_id=xxx

Remove a link from an item

## Migration

Run the migration to enable this feature:

```bash
# Using Supabase SQL Editor
# Copy and paste the contents of:
# migrations/add_shopping_item_links.sql
```

Or run via psql:

```bash
psql $DATABASE_URL -f migrations/add_shopping_item_links.sql
```

## Technical Details

### AI Scraping Process

1. Fetch webpage HTML via server-side request
2. Clean HTML (remove scripts, styles, nav, footer)
3. Truncate to ~30k characters for token limits
4. Send to Gemini 2.0 Flash with extraction prompt
5. Parse JSON response and store in database

### Rate Limiting

- Staggered requests (500ms-1000ms delays)
- Individual store refreshes have 15s timeout
- Graceful error handling with partial data

### Supported Currencies

- USD (default)
- LBP (Lebanese Pound - no decimals)
- EUR, GBP, AED, and others

## Files Created/Modified

### New Files

- `migrations/add_shopping_item_links.sql` - Database schema
- `src/app/api/hub/item-links/route.ts` - API endpoints
- `src/features/hub/itemLinksHooks.ts` - React Query hooks
- `src/components/hub/ProductComparisonSheet.tsx` - Comparison UI

### Modified Files

- `src/components/hub/ShoppingListView.tsx` - Integration
- `src/features/hub/hooks.ts` - Added `has_links` field to HubMessage

## Future Enhancements

- [ ] Price history tracking
- [ ] Price drop notifications
- [ ] Auto-refresh on schedule
- [ ] Share comparisons with partner
- [ ] Export comparison to PDF
- [ ] Currency conversion
- [ ] Wishlist integration
