# Chat Message to Transaction Feature

## 🎯 Overview

This feature allows users to quickly convert chat messages into transactions by **holding/long-pressing** on any message in the Hub chat threads. Perfect for capturing expense reminders from your household partner or personal notes.

## ✨ Key Features

### 1. **Smart Message Parsing**

- **Amount Detection**: Automatically extracts amounts from various formats:
  - `$20`, `20$`, `20 dollars`, `20 USD`, `20.50$`
- **Category Matching**: Intelligently matches category and subcategory from message text
  - Example: "fuel" → Transport - Fuel
  - Example: "coffee" → Food - Coffee
  - Uses fuzzy matching for flexible recognition
- **Full Message as Description**: Preserves the entire message as the transaction description

### 2. **Intuitive Hold Gesture**

- **Long Press**: Hold on any message bubble for 500ms
- **Haptic Feedback**: Vibration confirms the action (on supported devices)
- **Visual Feedback**: Message scales slightly during press
- **Action Menu**: Beautiful modal appears with available actions

### 3. **Optimal Action Menu UI**

- **Context-Aware Position**: Menu appears above the message bubble
- **Blur Backdrop**: Darkens background for focus
- **Extensible Design**: Ready for future actions (copy, forward, delete, etc.)
- **Single Tap to Close**: Tap backdrop to dismiss

### 4. **Smart Transaction Modal**

- **Pre-filled Data**:
  - Amount (if detected)
  - Category & Subcategory (if matched)
  - Description (full message text)
  - Default Account (auto-selected)
  - Today's Date (default)
- **Easy Override**: All fields are editable
- **Category Dropdown**: Shows only categories for selected account
- **Validation**: Ensures valid amount before saving

## 🚀 Usage

### Basic Flow

1. **Send/Receive Message**

   ```
   Partner: "Don't forget to add 20$ as fuel today"
   ```

2. **Long Press Message**
   - Hold finger on message bubble for 0.5 seconds
   - Feel haptic vibration (mobile)

3. **Select "Add as Transaction"**
   - Action menu appears
   - Tap "Add as Transaction"

4. **Review & Save**
   - Modal opens with pre-filled data:
     - Amount: $20
     - Category: Transport
     - Subcategory: Fuel
     - Description: "Don't forget to add 20$ as fuel today"
   - Adjust if needed
   - Tap "Add Transaction"

## 🔧 Technical Implementation

### Files Created

#### 1. Message Parser (`src/lib/nlp/messageTransactionParser.ts`)

```typescript
parseMessageForTransaction(message: string, categories: Category[])
```

- Extracts amount using regex patterns
- Matches categories using fuzzy string matching
- Returns structured transaction data with confidence score

#### 2. Long Press Hook (`src/hooks/useLongPress.ts`)

```typescript
useLongPress({
  onLongPress: (e) => void,
  onClick?: (e) => void,
  delay?: number,
  shouldPreventDefault?: boolean
})
```

- Cross-platform (mobile & desktop)
- Provides haptic feedback
- Handles touch and mouse events

#### 3. Transaction Modal (`src/components/hub/AddTransactionFromMessageModal.tsx`)

- Dedicated modal for creating transactions from messages
- Pre-fills all detected data
- Validates before submission
- Shows success/error toasts

### Files Modified

#### `src/components/hub/HubPage.tsx`

- Added long-press handlers to message bubbles
- Added action menu state management
- Integrated transaction modal
- Lazy-loaded modal for performance

### Dependencies

- **Sonner**: Toast notifications
- **React Query**: Transaction mutations
- **Existing Hooks**: `useAccounts`, `useCategories`, `useAddTransaction`

## 📊 Matching Algorithm

### Amount Extraction

Supports multiple formats:

- Currency before: `$20`, `$20.50`
- Currency after: `20$`, `20.50$`
- Word format: `20 dollars`, `20 USD`, `20 euro`

### Category Matching

1. **Subcategory First** (more specific):
   - Exact match: `fuel` → Fuel
   - Word boundary: `as fuel today` → Fuel
   - Partial match: `fueling` → Fuel (0.7 threshold)

2. **Parent Category** (fallback):
   - Matches parent if no subcategory found
   - Lower threshold (0.6) for flexibility

### Confidence Score

- 0-1 scale combining:
  - 50% weight: Amount found
  - 50% weight: Category match quality

## 🎨 UI/UX Details

### Action Menu

- **Position**: Centered above message, 10px gap
- **Animation**: Fade + zoom-in (200ms)
- **Backdrop**: Black/20 with blur
- **Card Style**: Neo-card with gradient border
- **Icon**: Emerald gradient dollar sign
- **Text**: Clear primary + secondary labels

### Transaction Modal

- **Layout**: Bottom sheet on mobile, centered on desktop
- **Animation**: Slide up (450ms cubic-bezier)
- **Sections**:
  1. Amount (large, centered)
  2. Date picker
  3. Account selector
  4. Category dropdowns
  5. Description field
- **Buttons**: Cancel (outline) + Save (gradient)

### Visual Feedback

- **Message Press**: Subtle scale-down (0.95)
- **Button Hover**: Background color change
- **Loading States**: Disabled + "Saving..." text

## 📱 Mobile Optimization

- **Touch-friendly**: Large tap targets (44px+)
- **Haptic Feedback**: Confirms long-press
- **No Scroll Conflict**: `shouldPreventDefault` handled
- **Bottom Sheet**: Transaction modal slides from bottom
- **Keyboard**: Auto-focus on amount field

## 🔮 Future Enhancements

### Action Menu Extensions

- ✅ Add as Transaction (implemented)
- 📋 Copy Message
- ↗️ Forward to AI
- 🗑️ Delete Message (if owner)
- 📌 Pin Message
- 📎 Add Attachment

### Parser Improvements

- Date extraction: "yesterday", "last Monday"
- Multi-currency support
- Recurring pattern detection
- Split transactions from one message

### AI Integration

- Suggest category based on message context
- Learn from user corrections
- Auto-categorize based on sender

## 🐛 Edge Cases Handled

- ✅ No default account → Shows account selector
- ✅ No amount detected → Allows manual entry
- ✅ No category match → Manual selection
- ✅ System messages → Long press disabled
- ✅ Empty message → Graceful handling
- ✅ Invalid amount → Validation error
- ✅ Network error → Error toast

## 📈 Performance

- **Lazy Loading**: Transaction modal loaded on-demand
- **Efficient Parsing**: Runs only on long-press
- **Query Caching**: Accounts/categories cached
- **Optimistic Updates**: UI responds instantly
- **Bundle Size**: ~3KB additional (parser + hook)

## 🎯 Usage Examples

### Example 1: Simple Expense

```
Message: "Added 50$ for lunch"
Result:
  Amount: 50
  Category: Food & Dining (if matched)
  Description: "Added 50$ for lunch"
```

### Example 2: With Category

```
Message: "Don't forget 30 dollars for fuel"
Result:
  Amount: 30
  Category: Transport
  Subcategory: Fuel
  Description: "Don't forget 30 dollars for fuel"
```

### Example 3: No Match

```
Message: "Remember the thing"
Result:
  Amount: 0 (manual entry)
  Category: None (manual selection)
  Description: "Remember the thing"
```

## 🔐 Security & Privacy

- ✅ RLS Policies: Only household members see messages
- ✅ User Validation: Transaction created under current user
- ✅ Account Access: Validates account ownership
- ✅ Private Transactions: Respects privacy settings

## 🎓 User Tips

1. **Be Specific**: Include amount and category keywords
   - Good: "20$ fuel today"
   - Better: "Added 20$ for fuel at gas station"

2. **Standard Formats**: Use common currency symbols
   - ✅ `$20`, `20$`, `20 dollars`
   - ⚠️ Avoid: `twenty bucks`, `20 bux`

3. **Category Keywords**: Use exact category names when possible
   - Transport, Food, Shopping, Bills, etc.

4. **Review Before Saving**: Always check pre-filled data
   - Parser is smart but not perfect
   - Easy to adjust before saving

---

**Last Updated**: December 7, 2025
**Version**: 1.0.0
**Author**: Budget App Team
