# Voice Entry with Draft Transactions

## Overview

Voice entry now saves transactions as **drafts** that require review and confirmation before being saved to the database. This ensures accuracy when NLP doesn't match categories correctly.

## How It Works

### 1. **Voice Input**

- User speaks into the microphone (on expense form Amount step)
- Speech recognition captures: "Spent fifty dollars on groceries at Walmart"

### 2. **NLP Processing**

- Extracts amount: `$50`
- Attempts category matching with confidence score
- If confidence < 80% or ambiguous → saved as draft
- High confidence matches → still saved as draft for verification

### 3. **Draft Creation**

- Transaction saved to database with `is_draft=true`
- Stores:
  - Original voice transcript
  - Parsed amount
  - Best-guess category/subcategory
  - Confidence score (0-1)
  - Current date and account

### 4. **Review & Confirm**

- Floating badge shows draft count
- Click badge to open Draft Transactions dialog
- Review each draft:
  - See original voice input
  - Edit amount, category, subcategory, description, date
  - Confirm to save as real transaction
  - Delete if incorrect

## Files Added/Modified

### New Files

1. **migrations/add_draft_transactions.sql** - Database schema
2. **src/app/api/drafts/route.ts** - GET/POST drafts
3. **src/app/api/drafts/[id]/route.ts** - PATCH/DELETE draft
4. **src/components/expense/DraftTransactionsDialog.tsx** - Review UI
5. **src/components/expense/DraftTransactionsBadge.tsx** - Floating indicator

### Modified Files

1. **src/lib/nlp/speechExpense.ts** - Added confidence scores
2. **src/components/expense/VoiceEntryButton.tsx** - Saves as draft
3. **src/components/expense/ExpenseForm.tsx** - Passes accountId
4. **src/app/layout.tsx** - Added DraftTransactionsBadge

## Database Schema

```sql
ALTER TABLE transactions ADD COLUMN is_draft boolean DEFAULT false;
ALTER TABLE transactions ADD COLUMN voice_transcript text;
ALTER TABLE transactions ADD COLUMN confidence_score numeric(3,2);
```

## Usage

### User Flow

1. Navigate to Expense tab
2. Click microphone icon on Amount step
3. Speak transaction: "Paid $25 for lunch at Chipotle"
4. Voice entry saved as draft (toast notification)
5. See floating badge "1 Draft" in bottom-right
6. Click badge to review
7. Edit if needed (fix category, amount, etc.)
8. Click "Confirm & Save"
9. Transaction now appears in dashboard

### Developer Integration

**VoiceEntryButton Props:**

```tsx
<VoiceEntryButton
  categories={categories}
  accountId={currentAccountId} // Required for drafts
  onDraftCreated={() => {
    // Optional callback
    toast.success("Voice entry saved!");
  }}
  onParsed={/* Fallback if no accountId */}
/>
```

## API Endpoints

### GET /api/drafts

Returns all draft transactions for current user

**Response:**

```json
{
  "drafts": [
    {
      "id": "uuid",
      "amount": 50.0,
      "category": "Food & Dining",
      "subcategory": "Groceries",
      "voice_transcript": "fifty dollars for groceries",
      "confidence_score": 0.85,
      "date": "2025-11-21",
      "account_id": "uuid",
      "accounts": { "name": "Wallet" }
    }
  ]
}
```

### POST /api/drafts

Create new draft transaction

**Body:**

```json
{
  "account_id": "uuid",
  "amount": 50,
  "category": "Food & Dining",
  "subcategory": "Groceries",
  "description": "groceries at walmart",
  "voice_transcript": "fifty dollars for groceries",
  "confidence_score": 0.85
}
```

### PATCH /api/drafts/:id

Confirm draft (sets `is_draft=false`)

**Body:**

```json
{
  "amount": 50,
  "category": "Food & Dining",
  "subcategory": "Groceries",
  "description": "Walmart groceries",
  "date": "2025-11-21",
  "account_id": "uuid"
}
```

### DELETE /api/drafts/:id

Delete draft transaction

## Features

✅ Voice input saved as draft automatically  
✅ Confidence scoring for category matches  
✅ Floating badge shows draft count  
✅ Edit all fields before confirming  
✅ Original voice transcript preserved  
✅ Delete incorrect drafts  
✅ Cache invalidation on confirm

## Migration Instructions

1. Run migration in Supabase SQL Editor:

   ```sql
   -- Copy content from migrations/add_draft_transactions.sql
   ```

2. Test voice entry:
   - Go to Expense tab
   - Click microphone
   - Say: "Spent twenty dollars on coffee"
   - Check for draft badge

3. Review draft:
   - Click "1 Draft" badge
   - Edit if needed
   - Confirm to save

## Benefits

1. **Accuracy** - Review before committing to database
2. **Flexibility** - Edit any field if NLP misunderstands
3. **Confidence** - See how well category was matched
4. **History** - Keep original voice input for reference
5. **Safety** - Can delete if completely wrong

## Future Enhancements

- Voice command to go directly to drafts
- Batch confirm multiple drafts
- Smart learning from confirmed corrections
- Voice re-recording for unclear audio
- Auto-confirm high confidence matches (optional setting)
