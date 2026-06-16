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
# Quick Start: Chat to Transaction

## 🎯 What it does

Convert chat messages into transactions with a long press!

## 🚀 How to use

### Step 1: Find a message

Any message in your household chat threads.

Example: "Don't forget to add 20$ as fuel today"

### Step 2: Long press (hold)

Press and hold on the message bubble for 0.5 seconds.
You'll feel a vibration (on mobile).

### Step 3: Tap "Add as Transaction"

Action menu appears → Tap the transaction option.

### Step 4: Review and save

Modal opens with:

- **Amount**: $20 (detected automatically)
- **Category**: Transport (matched from "fuel")
- **Subcategory**: Fuel
- **Description**: Full message text
- **Account**: Your default account
- **Date**: Today

Adjust anything if needed, then tap "Add Transaction" ✅

## 💡 Tips

### Best Practices

✅ Include amount with $ or "dollars"
✅ Mention category keywords (fuel, food, coffee, etc.)
✅ Be specific for better auto-detection

### Examples That Work Well

- "20$ fuel" → Transport - Fuel
- "15 dollars coffee" → Food - Coffee
- "50$ groceries today" → Food - Groceries
- "30$ parking downtown" → Transport - Parking

### If Auto-detection Misses

No problem! All fields are editable:

- Type/adjust the amount
- Select category from dropdown
- Choose subcategory
- Edit description

## 🎨 What to Expect

### Visual Feedback

- Message scales down when pressed
- Action menu slides in smoothly
- Backdrop dims the background
- Transaction modal animates from bottom (mobile)

### After Saving

- ✅ Success toast appears
- Transaction added to dashboard
- Modal closes automatically

## 🔧 Requirements

- Must be in a household chat thread
- Must have at least one account
- Message can be from you or partner

## ❓ Troubleshooting

**Q: Long press doesn't work?**

- Make sure you're holding for at least 0.5 seconds
- Try on the message bubble itself, not empty space

**Q: No categories shown?**

- Create an account first (Settings → Accounts)
- Categories load automatically for your default account

**Q: Amount not detected?**

- Manually enter the amount in the modal
- The parser looks for: $X, X$, X dollars

**Q: Category not matched?**

- Use the dropdown to select manually
- Parser is smart but not perfect

## 📦 Bulk convert ("Multi-add")

For sweeping a noisy conversation in one pass instead of one-at-a-time:

1. Long press any message → tap **Multi-add…**
2. Selection mode turns on with checkboxes. **Select all** auto-checks only rows with a detected number for budget threads (`parseMessageForTransaction`), or all eligible rows for reminder threads (`parseSmartText`).
3. Tap the primary button to open the **review sheet** — one editable row per selected message, prefilled the same way as the single-message flow.
4. Each row has a **Confirm** toggle. Leave it off (or leave the row incomplete) and it's saved as a **draft** instead of being discarded:
   - Budget: draft transaction (`/api/drafts`) — same place voice/incomplete entries land. Future-dated rows are always forced to draft even if confirmed.
   - Reminder: draft schedule item (`items.status='draft'`) — reviewed via the amber **Draft Reminders** pill on the Items dashboard.
5. Tap **Save** — one summary toast with a 4s **Undo** that reverses every created record and message-action link.
6. Converted/drafted messages disappear from the thread (same auto-archive as the single-message flow).

Budget rows share **one account** for the whole batch (not per-row) — pick it at the top of the sheet.

## 🆕 Coming Soon

- Copy message action
- Forward to AI assistant
- Better date detection ("yesterday", "last Monday")

---

**Need help?** Check the full documentation in `CHAT_TO_TRANSACTION_FEATURE.md`
