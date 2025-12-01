# Bank Statement Import Feature

## Overview

This feature allows you to upload PDF or CSV bank statements and automatically import transactions into your budget app. The system learns from your categorization choices, making future imports faster.

**Optimized for Lebanese bank statements** (Fresh USD and similar formats).

## How to Use

### 1. Access the Feature

1. Go to **Settings** (⚙️ icon)
2. Click on **Statement Import** in the sidebar
3. Click **Import Statement** to upload a file

### 2. Upload Your Statement

**Three options available:**

#### Option A: CSV File (Recommended)

1. Open your bank statement PDF
2. Select and copy the transaction table
3. Paste into Excel/Google Sheets
4. Export as CSV
5. Upload the CSV file

#### Option B: PDF File

- Drag & drop your bank statement PDF, or click to browse
- Works best with text-based PDFs (most bank e-statements)
- Scanned/image PDFs are not currently supported

#### Option C: Paste CSV Data

- Click "Or paste CSV data directly"
- Paste your statement data
- Click "Parse CSV Data"

### Expected CSV Format

```
DATE,TRANSACTIONS,MONEY OUT,MONEY IN,BALANCE
01/01/2025,"POS Purchase SPINNEYS DBAYEH METN - 123456",45.50,-,1234.50
02/01/2025,"Online Purchase TOTERS - 789012",15.00,-,1219.50
03/01/2025,"Transfer from John Doe",-,100.00,1319.50
```

- **DATE**: DD/MM/YYYY format
- **TRANSACTIONS**: Description text
- **MONEY OUT**: Expense amount (or `-` for none)
- **MONEY IN**: Income amount (or `-` for none)
- **BALANCE**: Running balance (optional)

### 3. Review Transactions

After upload, you'll see a list of extracted transactions:

- **Matched** (green badge): The merchant was recognized
- **Needs Category** (yellow badge): New merchant - assign a category

For each transaction, you can:

- Select/deselect for import (checkbox)
- Expand to edit details (click the chevron)
- Assign Account, Category, and Subcategory

### 4. Training the System

When you assign a category to an unmatched transaction:

- The system saves this as a **Merchant Mapping**
- Next time this merchant appears, it will be auto-categorized!

Example: First time you see "KHOURY HOME" → Assign to Shopping → Home
→ Next import: All KHOURY HOME transactions are auto-categorized!

### 5. Managing Merchant Mappings

Click **Merchant Mappings** to:

- View all learned merchant patterns
- Add new patterns manually
- Delete incorrect mappings
- See how often each mapping has been used

## Pre-configured Merchants

The system comes with knowledge of common Lebanese merchants:

### Groceries & Food

| Pattern            | Name              |
| ------------------ | ----------------- |
| SPINNEYS           | Spinneys          |
| CARREFOUR          | Carrefour         |
| FAHED              | Fahed Supermarket |
| BOUCHERIES ANTOINE | Antoine's         |
| TOTERS             | Toters            |
| ZOMATO             | Zomato            |
| TALABAT            | Talabat           |

### Telecom

| Pattern           | Name  |
| ----------------- | ----- |
| ALFA              | Alfa  |
| TOUCH / MIC / MTC | Touch |
| OGERO             | Ogero |
| IDM               | IDM   |

### Utilities

| Pattern     | Name                 |
| ----------- | -------------------- |
| EDL         | Electricité du Liban |
| ELECTRICITE | EDL                  |

### Shopping

| Pattern         | Name        |
| --------------- | ----------- |
| KHOURY HOME     | Khoury Home |
| ABED TAHAN      | Abed Tahan  |
| ABC / ASHRAFIEH | ABC Mall    |
| CITY MALL       | City Mall   |
| LeMall          | LeMall      |
| MALIK'S         | Malik's     |
| VIRGIN          | Virgin      |

### Transport

| Pattern | Name   |
| ------- | ------ |
| UBER    | Uber   |
| BOLT    | Bolt   |
| CAREEM  | Careem |

### Entertainment

| Pattern       | Name          |
| ------------- | ------------- |
| NETFLIX       | Netflix       |
| SPOTIFY       | Spotify       |
| GRAND CINEMAS | Grand Cinemas |
| CINEMACITY    | Cinemacity    |

### Transaction Types Detected

- **POS Purchase**: In-store card payment
- **Online Purchase**: E-commerce payment
- **Bill Payment**: Utility/service bills
- **Transfer In/Out**: Bank transfers
- **Reversal**: Refunds (auto-detected)

## Tips for Best Results

1. **CSV is most reliable**: Copy from PDF to Excel, then export as CSV
2. **Use DD/MM/YYYY dates**: The parser expects day/month/year format
3. **Review first import carefully**: Set categories correctly to train the system
4. **Add common merchants**: Use Merchant Mappings to pre-configure frequent merchants
5. **Reversals auto-convert to income**: Transaction reversals are detected automatically

## Database Tables

The feature uses two tables (run the migration in `migrations/add_statement_import.sql`):

### merchant_mappings

- `merchant_pattern`: Text to match in descriptions
- `merchant_name`: Clean display name
- `category_id`, `subcategory_id`: Auto-assign these
- `account_id`: Default account for this merchant
- `use_count`: How often this mapping was used

### statement_imports

- Tracks import history
- `file_name`, `transactions_count`, `status`

## Limitations

- Only text-based PDFs (not scanned images)
- No duplicate detection (manual review recommended)
- Web view only (not available in mobile/watch views)

## Troubleshooting

### "No transactions found"

- Try CSV format instead of PDF
- Check that dates are in DD/MM/YYYY format
- Ensure columns are: DATE, TRANSACTIONS, MONEY OUT, MONEY IN, BALANCE

### "Wrong amounts"

- Make sure amounts use comma for thousands (e.g., "1,234.50")
- Use period for decimal point
- Use "-" for empty amounts, not 0 or blank

### "Categories not matching"

- Check Merchant Mappings for typos in patterns
- Patterns are case-insensitive
- Add more specific patterns if needed
