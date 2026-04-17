# New Expense Form - Design Guide & Enhancement Guide

> **Complete design reference for the New Expense entry form component system.** Use this guide to understand the architecture, make enhancements, and collaborate on UI/UX improvements.

---

## Table of Contents

1. [Overview](#overview)
2. [Component Hierarchy](#component-hierarchy)
3. [File Structure](#file-structure)
4. [Core Components](#core-components)
5. [Design System](#design-system)
6. [State Management](#state-management)
7. [Enhancement Guidelines](#enhancement-guidelines)
8. [Accessibility & Mobile-First](#accessibility--mobile-first)
9. [Key Features](#key-features)
10. [Dependencies & Libraries](#dependencies--libraries)

---

## Overview

The **New Expense Form** is the primary interface for users to record financial transactions. It's a mobile-first, progressive multi-step form with support for:

- ✅ Real-time balance updates
- ✅ Offline-first functionality (works without internet, syncs when online)
- ✅ Voice entry with NLP parsing
- ✅ Split bills & debt tracking
- ✅ Draft saving
- ✅ Multiple accounts & categories
- ✅ 4-theme support (blue/pink/frost/calm) + privacy mode

### Key Statistics

| Metric                     | Value                                    |
| -------------------------- | ---------------------------------------- |
| **Entry Point**            | `/app/expense/page.tsx`                  |
| **Total Components**       | 36 files in `components/expense/`        |
| **Main Form**              | `MobileExpenseForm.tsx` (~500 LOC)       |
| **Form State**             | `ExpenseFormContext.tsx` (React Context) |
| **Lazy-Loaded Components** | 5 major drawers/dialogs                  |
| **Supported Themes**       | 4 (blue, pink, frost, calm)              |
| **Mobile Breakpoint**      | All sizes, thumb-zone optimized          |

---

## Component Hierarchy

```
/app/expense (Page Route)
    ↓
ExpenseClientWrapper.tsx (mode detection)
    ↓
MobileExpenseForm.tsx (MAIN - form orchestration)
    ├── AccountBalance.tsx (header - shows wallet balance)
    ├── AmountInput.tsx (amount field with calculator)
    ├── VoiceEntryButton.tsx (mic icon for voice entry)
    ├── CategoryGrid.tsx (category selection)
    ├── SubcategoryGrid.tsx (nested categories)
    ├── DescriptionField.tsx (optional notes)
    │
    ├── [Lazy-Loaded Drawers]
    │   ├── CalculatorDialog.tsx (in-app calculator)
    │   ├── NewAccountDrawer.tsx (create/edit accounts)
    │   ├── NewCategoryDrawer.tsx (create/edit categories)
    │   ├── NewSubcategoryDrawer.tsx (create/edit subcategories)
    │   └── TemplateDialog.tsx (reuse past transactions)
    │
    ├── [Optional Modals]
    │   ├── SplitBillModal.tsx (split with partner)
    │   ├── DebtSettlementModal.tsx (track shared debt)
    │   ├── TransferDialog.tsx (move between accounts)
    │   └── DraftTransactionsDialog.tsx (saved drafts)
    │
    └── [Supporting UI]
        ├── ExpenseTagsBar.tsx (quick category tags)
        ├── AccountSelect.tsx (dropdown for accounts)
        ├── BalanceHistoryDrawer.tsx (past balance snapshots)
        └── DraftTransactionsBadge.tsx (draft count indicator)

[Providers]
├── ExpenseFormContext (form state)
├── SyncContext (offline queue)
└── AppModeContext (budget vs items mode)
```

---

## File Structure

### **Quick Reference: Where to Find Things**

```
src/
├── app/expense/
│   ├── page.tsx                          ← Entry point (RSC)
│   ├── ExpenseClientWrapper.tsx          ← Client-side mode detection
│   ├── layout.tsx                        ← Layout wrapper
│   ├── loading.tsx                       ← Skeleton loader
│   └── error.tsx                         ← Error boundary
│
├── components/expense/                   ← ALL 36 FORM COMPONENTS
│   ├── MobileExpenseForm.tsx             ★ MAIN (form logic + steps)
│   ├── ExpenseFormContext.tsx            ★ STATE (React Context)
│   │
│   ├── [Step 1: Amount Input]
│   │   ├── AmountInput.tsx
│   │   ├── CalculatorDialog.tsx
│   │   └── VoiceEntryButton.tsx
│   │
│   ├── [Step 2: Account Selection]
│   │   ├── AccountSelect.tsx
│   │   ├── AccountBalance.tsx
│   │   └── NewAccountDrawer.tsx
│   │
│   ├── [Step 3: Category Selection]
│   │   ├── CategoryGrid.tsx
│   │   ├── CategoryManagerDialog.tsx
│   │   └── NewCategoryDrawer.tsx
│   │
│   ├── [Step 4: Subcategory Selection]
│   │   ├── SubcategoryGrid.tsx
│   │   └── NewSubcategoryDrawer.tsx
│   │
│   ├── [Step 5: Description & Options]
│   │   ├── DescriptionField.tsx
│   │   ├── ExpenseTagsBar.tsx
│   │   └── ExpenseTagsBarWrapper.tsx
│   │
│   ├── [Optional Features]
│   │   ├── SplitBillModal.tsx
│   │   ├── SplitBillHandler.tsx
│   │   ├── DebtSettlementModal.tsx
│   │   ├── TransferDialog.tsx
│   │   ├── DraftsDrawer.tsx
│   │   ├── DraftTransactionsBadge.tsx
│   │   ├── DraftTransactionsDialog.tsx
│   │   ├── TemplateDialog.tsx
│   │   ├── TemplateDrawer.tsx
│   │   ├── TemplateQuickEntryButton.tsx
│   │   ├── OfflinePendingDrawer.tsx
│   │   ├── BalanceHistoryDrawer.tsx
│   │   ├── FuturePaymentsDrawer.tsx
│   │   ├── DebtsDrawer.tsx
│   │   ├── DebtSettlementModal.tsx
│   │   ├── LaunchTemplateDialog.tsx
│   │   ├── ReminderTemplateDialog.tsx
│   │   ├── AddExpenseButton.tsx
│   │   ├── AddCategoryDialog.tsx
│   │   ├── EditableWidgetGrid.tsx
│   │   └── DraftTransactionsBadge.tsx
│   │
│   └── [Utility Components]
│       └── ExpenseForm.tsx (legacy, check if still used)
│
├── components/ui/                        ← SHADCN/UI PRIMITIVES
│   ├── button.tsx
│   ├── input.tsx
│   ├── drawer.tsx
│   ├── dialog.tsx
│   ├── calendar.tsx
│   ├── card.tsx
│   ├── checkbox.tsx
│   ├── select.tsx
│   ├── textarea.tsx
│   ├── label.tsx
│   ├── popover.tsx
│   ├── dropdown-menu.tsx
│   ├── BlurredAmount.tsx                 (privacy mode)
│   └── SyncIndicator.tsx                 (offline status)
│
├── components/icons/
│   └── FuturisticIcons.tsx               ← Custom SVG icons
│
├── features/                             ← SHARED HOOKS (NO CROSS-FEATURE IMPORTS)
│   ├── accounts/
│   │   └── hooks.ts (useMyAccounts, useCreateAccount, etc.)
│   ├── categories/
│   │   ├── hooks.ts (useCategories, useDeleteCategory, etc.)
│   │   └── useCategoriesQuery.ts
│   ├── transactions/
│   │   └── useDashboardTransactions.ts (useAddTransaction, useDeleteTransaction)
│   ├── debts/
│   │   └── useDebts.ts
│   └── preferences/
│       ├── useLbpSettings.ts (exchange rate in thousands)
│       └── useSectionOrder.ts
│
├── lib/                                  ← SHARED UTILITIES
│   ├── queryKeys.ts                      (cache key constants)
│   ├── queryConfig.ts                    (cache times)
│   ├── safeFetch.ts                      (offline-aware fetch)
│   ├── toastIcons.tsx                    (toast notifications)
│   ├── theme-colors.ts                   (color definitions)
│   ├── balance-utils.ts                  (account math)
│   ├── connectivityManager.ts            (online/offline detection)
│   ├── utils/
│   │   ├── date.ts                       (timezone-safe date handling)
│   │   ├── splitBill.ts                  (split calculations)
│   │   ├── getCategoryIcon.tsx           (category → icon mapping)
│   │   └── index.ts (cn utility)
│   ├── stores/
│   │   └── offlinePendingStore.ts        (IndexedDB offline queue)
│   └── nlp/
│       └── speechExpense.ts              (voice-to-expense parsing)
│
├── types/
│   └── domain.ts                         (TypeScript interfaces)
│
├── constants/
│   └── layout.ts                         (MOBILE_NAV_HEIGHT, etc.)
│
├── hooks/
│   ├── useThemeClasses.ts                (color utilities)
│   ├── useViewMode.ts                    (watch vs mobile)
│   ├── useFuturePaymentAlerts.ts         (toast alerts)
│   └── useLongPress.ts                   (edit interactions)
│
├── contexts/
│   ├── ExpenseFormContext.tsx            (form state)
│   ├── SyncContext.tsx                   (offline sync)
│   ├── AppModeContext.tsx                (budget vs items)
│   └── ThemeContext.tsx                  (theme switching)
│
└── migrations/
    └── schema.sql                        (database structure)
```

---

## Core Components

### **1. MobileExpenseForm.tsx** ⭐ MAIN FORM

**Purpose:** Orchestrates the entire form flow, manages multi-step navigation

**Responsibilities:**

- Renders form steps (Amount → Account → Category → Description → Confirm)
- Handles step navigation (forward/backward)
- Manages draft saving
- Triggers transaction submission
- Shows balance updates in real-time

**Key Props:** None (uses ExpenseFormContext)

**State Managed:**

```typescript
{
  step: 1-5,
  amount: string,
  accountId: string,
  categoryId: string,
  subcategoryId?: string,
  description: string,
  date: string,
  isSplitBill: boolean,
  isDraft: boolean
}
```

**Enhancement Ideas:**

- Add animations between steps (Framer Motion)
- Show progress indicator (e.g., "Step 2 of 5")
- Add form validation summary
- Add keyboard shortcuts (← → for nav)

---

### **2. ExpenseFormContext.tsx** ⭐ STATE MANAGEMENT

**Purpose:** Centralized form state using React Context

**Exports:**

```typescript
useExpenseForm() → {
  // State
  step, amount, accountId, categoryId, description, date, isSplitBill, isDraft

  // Actions
  setStep(), setAmount(), setAccountId(), setCategoryId(),
  setDescription(), setDate(), setSplitBill(), saveDraft()
}
```

**Why Context?**

- Multiple child components need access to form state
- Avoids prop drilling
- Easy to reset on form submission

**Enhancement Ideas:**

- Add form validation status to context
- Add error messages state
- Add isDirty flag for unsaved changes warning

---

### **3. AmountInput.tsx**

**Purpose:** Main amount field with calculator integration

**Features:**

- Real-time number formatting
- Copy-paste support
- Toggle currency (USD ↔ LBP with live rate)
- Quick amount buttons (presets)
- Calculator icon opens CalculatorDialog

**Accessibility:**

- `inputMode="decimal"` (not `type="number"` - iOS issues)
- Proper labeling
- Keyboard navigation support

**Enhancement Ideas:**

- Add decimals toggle (0.00 vs 0)
- Add currency conversion preview
- Add recent amounts quick-select

---

### **4. AccountSelect.tsx & AccountBalance.tsx**

**Purpose:** Choose account and display current balance

**AccountSelect:**

- Dropdown of all user's accounts
- Shows account type (Expense/Income/Saving)
- Quick "New Account" button

**AccountBalance:**

- Displays current balance for selected account
- Shows last updated timestamp
- Links to balance history drawer
- Shows pending drafts count

**Enhancement Ideas:**

- Add account icons (wallet, card, piggy bank)
- Show account balance trend (↑ trending up)
- Add account color indicators
- Show low balance warning

---

### **5. CategoryGrid.tsx & SubcategoryGrid.tsx**

**Purpose:** Visual category/subcategory selection

**Features:**

- Grid of category cards with icons
- Color-coded by category
- Tap to select
- "Add New" button for custom categories
- Search/filter support

**Category Icon System:**

- Uses `getCategoryIcon()` utility
- Lucide icons + custom SVGs
- Color from category definition

**Enhancement Ideas:**

- Add category search bar
- Add "recently used" categories
- Add category search with fuzzy matching
- Show subcategory count on main categories
- Add drag-to-reorder (Framer Motion)

---

### **6. VoiceEntryButton.tsx**

**Purpose:** Voice-to-expense NLP conversion

**Flow:**

1. User taps mic button
2. Browser records audio (Web Audio API)
3. Sends to `/api/ai-chat/voice` endpoint
4. NLP parses: amount, category, description
5. Auto-fills form fields

**Voice Parsing Logic:**

```
Input: "Spent 50 on groceries"
Output: {
  amount: 50,
  category: "Food & Groceries",
  description: "groceries"
}
```

**Enhancement Ideas:**

- Add waveform visualization during recording
- Add voice confirmation ("You said $50 for Food?")
- Add dialect/accent support
- Show parsing confidence score

---

### **7. CalculatorDialog.tsx**

**Purpose:** In-app calculator for complex amount calculations

**Features:**

- Basic math operations (+, -, ×, ÷)
- Percentage calculations
- Clear button
- Result auto-fills amount field

**Enhancement Ideas:**

- Add split calculator (quick divide by N)
- Add tip calculator
- Add percentage discounts
- Add calculation history

---

### **8. Split Bill & Debt Components**

**SplitBillModal.tsx:**

- Split expense with household partner
- Choose split ratio (50/50, custom, etc.)
- Shows settlement calculation
- Displays who owes whom

**DebtSettlementModal.tsx:**

- Track shared debts
- Mark settled/pending
- Shows debt history

**Enhancement Ideas:**

- Add group splits (split 3+ ways)
- Add expense history between users
- Add settlement notifications
- Add debt timeline view

---

## Design System

### **Colors & Theming**

The app supports **4 themes**:

```typescript
// src/lib/theme-colors.ts
{
  blue:   { primary: #06B6D4, accent: #0EA5E9 },   // Cyan/Sky
  pink:   { primary: #EC4899, accent: #F43F5E },   // Pink/Rose
  frost:  { primary: #06B6D4, accent: #0EA5E9 },   // Frost (blue default)
  calm:   { primary: #06B6D4, accent: #0EA5E9 }    // Calm (blue default)
}

// Theme color identity = user's personal identity
// If user has blue theme → they are always blue
// Partner with pink theme → they are always pink
// Colors persist across both phones
```

### **Using Theme Colors**

```tsx
// Hook provides theme utilities
const { theme } = useTheme(); // "blue" | "pink" | "frost" | "calm"
const tc = useThemeClasses(); // color class strings

// In JSX:
<div className={tc.bgPage}>           {/* Page background */}
<button className={tc.btnPrimary}>    {/* Primary button */}
<span className={tc.textAccent}>      {/* Accent text */}
```

### **Color Identity Rules** ⚠️ IMPORTANT

**Rule:** Colors are **person-absolute**, not role-relative.

❌ WRONG:

```tsx
// Blue on current user's phone, Pink on partner's phone
const myColor = theme === "blue" ? "blue-400" : "pink-400";
```

✅ CORRECT:

```tsx
// If user has blue theme, they're always blue everywhere
if (theme === "blue") {
  myColor = "blue-400"; // This user = blue
  partnerColor = "pink-400"; // Partner = pink
} else {
  myColor = "pink-400"; // This user = pink
  partnerColor = "blue-400"; // Partner = blue
}
```

### **Dark Mode & Privacy Mode**

- **Dark Mode:** Default. No light mode support currently.
- **Privacy Mode:** Blurs amounts using `BlurredAmount.tsx` component

### **Typography**

```
Headings:       font-semibold text-lg/xl
Body:           font-normal text-base
Small/Captions: font-normal text-sm text-white/60
```

### **Spacing & Layout**

```
Page padding:     px-4 py-6
Card padding:     p-4
Button height:    h-12 (48px - thumb-friendly)
Input height:     h-11 (44px - thumb-friendly)
Gap between items: gap-3 (12px)
```

### **Icons**

#### Custom Futuristic Icons (`FuturisticIcons.tsx`)

```
CalculatorIcon, PlusIcon, MicIcon, SaveIcon,
CalendarIcon, XIcon, SquareIcon, Edit2Icon,
CheckIcon, ArrowRightIcon, RefreshIcon, ChevronLeftIcon
```

#### Lucide Icons (from lucide-react)

```
Calendar, GripVertical, FolderTree, Lightbulb,
Check, MinusCircle, MapPin, Eye, EyeOff, X, PenLine, WifiOff
```

**Category Icons:**

- Use `getCategoryIcon(categoryName)` → Lucide icon + color
- Fallback: `FolderTree` icon if no match

---

## State Management

### **Form State** (ExpenseFormContext)

```typescript
interface ExpenseFormState {
  step: 1 | 2 | 3 | 4 | 5;
  amount: string; // User input: "100.50"
  accountId: string; // Selected account UUID
  categoryId: string; // Selected category UUID
  subcategoryId?: string; // Optional subcategory
  description: string; // Notes/tags
  date: string; // ISO date: "2026-04-17"
  isSplitBill: boolean; // Split with partner?
  isDraft: boolean; // Save as draft?
  splitData?: {
    partnerAmount: number;
    currentUserAmount: number;
  };
}
```

### **Cache & Queries** (React Query)

All data is cached with specific durations:

```typescript
BALANCE:        5 min   // Account balance (frequently changing)
TRANSACTIONS:   2 min   // Recent expenses
ACCOUNTS:       1 hour  // Account list
CATEGORIES:     1 hour  // Category list
RECURRING:      30 min  // Recurring payments
DRAFTS:         1 min   // Draft transactions
```

**Key Functions:**

```typescript
// Invalidate all balance-related queries when transaction added
invalidateAccountData(queryClient, accountId);

// Available from: src/lib/queryInvalidation.ts
```

### **Offline Queue** (IndexedDB)

When offline:

1. Transaction attempt fails
2. IndexedDB stores mutation
3. SyncIndicator shows "Pending"
4. When online again, syncs automatically
5. Query cache refreshes

**Queue Location:** `src/lib/offlineQueue.ts`

---

## Enhancement Guidelines

### **Adding a New Form Field**

**Step 1:** Add to ExpenseFormContext state

```typescript
// src/components/expense/ExpenseFormContext.tsx
interface ExpenseFormState {
  // ... existing fields
  newField: string; // ← ADD HERE
}

// Add setter
setNewField: (value: string) => void;
```

**Step 2:** Create component

```typescript
// src/components/expense/NewFieldComponent.tsx
export function NewFieldComponent() {
  const { newField, setNewField } = useExpenseForm();

  return (
    <input
      value={newField}
      onChange={(e) => setNewField(e.target.value)}
      className="..."
    />
  );
}
```

**Step 3:** Add to form step

```typescript
// src/components/expense/MobileExpenseForm.tsx
{step === 3 && <NewFieldComponent />}
```

**Step 4:** Include in submission

```typescript
// When creating transaction
const payload = {
  amount,
  accountId,
  categoryId,
  description,
  newField, // ← ADD HERE
  date,
  isSplitBill,
};
```

---

### **Adding a New Dialog/Drawer**

**Step 1:** Create component (lazy-loadable)

```typescript
// src/components/expense/NewDrawer.tsx
export function NewDrawer({ isOpen, onClose }) {
  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent>
        {/* Content */}
      </DrawerContent>
    </Drawer>
  );
}
```

**Step 2:** Add to MobileExpenseForm with dynamic import

```typescript
const NewDrawer = dynamic(() => import('./NewDrawer').then(m => m.NewDrawer), {
  loading: () => <div>Loading...</div>,
  ssr: false
});
```

**Step 3:** Add state and trigger

```typescript
const [isNewDrawerOpen, setIsNewDrawerOpen] = useState(false);

return (
  <>
    <button onClick={() => setIsNewDrawerOpen(true)}>Open</button>
    <NewDrawer isOpen={isNewDrawerOpen} onClose={() => setIsNewDrawerOpen(false)} />
  </>
);
```

---

### **Adding New Category Icons**

**Step 1:** Check `getCategoryIcon()` mapping

```typescript
// src/lib/utils/getCategoryIcon.tsx
const iconMap = {
  "Food & Groceries": Calendar,
  Transportation: Car,
  // ... etc
};
```

**Step 2:** Add new mapping

```typescript
const iconMap = {
  // ... existing
  "Your New Category": YourLucideIcon,
};
```

**Step 3:** Import icon from lucide-react

```typescript
import { YourLucideIcon } from "lucide-react";
```

---

### **Styling Best Practices**

**DO:**

- Use theme variables: `bg-[var(--theme-bg)]`
- Use `cn()` utility for conditional classes
- Follow shadcn/ui patterns (components/ui/)
- Mobile-first: design for small screens first

**DON'T:**

- Hardcode colors: ❌ `bg-blue-500`
- Use `neo-card` on floating panels (use solid bg instead)
- Edit `components/ui/` files (auto-generated)
- Use `px-6` on mobile (too wide, use `px-4`)

---

## Accessibility & Mobile-First

### **Keyboard Navigation**

- All buttons keyboard accessible
- Tab order logical (top-to-bottom)
- Focus visible indicators
- Escape key closes modals

### **Screen Readers**

- Semantic HTML (`<button>`, `<label>`, `<input>`)
- `aria-label` on icon buttons
- `aria-describedby` for amount field (show USD/LBP)
- `role="alert"` for toast notifications

### **Mobile-First Design Principles**

1. **Thumb Zones**
   - Buttons min 48px tall (h-12)
   - Tap targets 44px+ (spacing)
   - Bottom of screen = prime real estate

2. **Responsive Design**
   - Mobile: Full width, column layout
   - Tablet: 2-column grids
   - Desktop: 3-column grids (if supported)

3. **Touch Interactions**
   - Single tap = select/open
   - Double tap = favorite/pin
   - Long press = edit/options
   - Swipe = (if using Framer Motion)

4. **Performance**
   - Lazy-load heavy components (5 drawers)
   - No layout shift on load (use skeleton loaders)
   - Optimize image sizes
   - Cache images aggressively

---

## Key Features

### **1. Real-Time Balance Updates**

When user adds transaction:

```
1. Form submitted
2. Transaction created in DB
3. Account balance updated
4. Query cache invalidated
5. AccountBalance component re-renders with new balance
```

### **2. Offline-First Support**

```
ONLINE:  Add transaction → Success → Update cache
OFFLINE: Add transaction → Store in IndexedDB → SyncIndicator="Pending"
         [User goes online]
         → Sync engine retries → Success → Update cache
```

### **3. Voice Entry (NLP)**

```
Mic tap → Record audio → Send to /api/ai-chat/voice
  → Parse with Gemini AI → Extract amount, category, description
  → Auto-fill form → User confirms → Submit
```

### **4. Multi-Account Support**

- Users can create multiple accounts (checking, savings, credit card, cash)
- Each account has own balance
- Transactions scoped to account
- Transfers move between accounts

### **5. Split Bills**

```
User enters $100 expense
Chooses "Split with partner"
System shows: "You pay $50, Partner owes $50"
Creates transaction + debt tracking
```

### **6. Draft Saving**

```
User fills form, clicks "Save Draft" instead of "Submit"
Draft stored in DB with isSdraft=true
Later: User can "Resume Draft" to edit and submit
```

---

## Dependencies & Libraries

### **React & State**

- `react 19` - UI framework
- `@tanstack/react-query 5` - Data fetching & caching
- `zustand 5` - Lightweight state management (offline queue)

### **UI & Styling**

- `tailwindcss 4` - Utility CSS
- `radix-ui` - Accessible components (via shadcn/ui)
- `shadcn/ui` - Pre-built components (button, input, drawer, dialog, etc.)
- `lucide-react` - Icon library (40+ icons)
- `framer-motion` - Animations & drag-reorder

### **Forms & Validation**

- `zod` - Schema validation (API routes)
- `react-hook-form` - (if used in future)

### **Date & Time**

- `date-fns` - Date utilities
- `rrule.js` - Recurring events (ISO 8601 RRULE)

### **Notifications**

- `sonner` - Toast notifications
- `next-pwa` - Service worker for offline (implicit)

### **API & Server**

- `next.js 16` - Server-side + App Router
- `@supabase/supabase-js` - Database client

### **Utilities**

- `classnames` (via `cn()` in utils.ts) - Conditional CSS classes
- `clsx` - (alternative)

---

## Quick Start for Designers

### **To View the Form Locally:**

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Open browser
http://localhost:3000/expense
```

### **To Make a Style Change:**

1. Open component file (e.g., `src/components/expense/AmountInput.tsx`)
2. Modify Tailwind classes or JSX
3. Save → hot reload → see changes instantly
4. No build step needed for CSS changes

### **To Test Different Themes:**

1. Open app → Settings gear icon
2. Choose theme (blue/pink/frost/calm)
3. All colors update instantly
4. Design should work in all 4 themes

### **To Test Mobile:**

```bash
# Chrome DevTools
Ctrl+Shift+I → Device toolbar → iPhone/Android
```

Or use your phone:

```bash
# Get your computer's IP
ipconfig getifaddr en0   (Mac)
hostname -I              (Linux)

# Visit from phone
http://<YOUR_IP>:3000/expense
```

---

## Documentation Links

| Resource                  | Location                                          |
| ------------------------- | ------------------------------------------------- |
| **Feature Doc**           | `ERA Notes/02 - Standalone Modules/Transactions/` |
| **Architecture Patterns** | `ERA Notes/01 - Architecture/Common Patterns.md`  |
| **Design System**         | `ERA Notes/04 - UI & Design/`                     |
| **API Routes**            | `.github/instructions/api-routes.instructions.md` |
| **Component Rules**       | `.github/instructions/components.instructions.md` |
| **Project Rules**         | `CLAUDE.md` (read before major changes)           |
| **Database Schema**       | `migrations/schema.sql`                           |

---

## Common Questions

### **Q: How do I add a new expense tag/label?**

A: Add to `ExpenseTagsBar.tsx` array, update category filtering logic in `CategoryGrid.tsx`.

### **Q: How do I change the form step order?**

A: Modify step numbers in `MobileExpenseForm.tsx` switch statement. Update `ExpenseFormState` if needed.

### **Q: How do I add more currency support (beyond USD/LBP)?**

A: Update `useLbpSettings.ts` to support additional currencies, add to dropdown in `AmountInput.tsx`.

### **Q: How do I make the form wider on tablets?**

A: Wrap main content in responsive div:

```tsx
<div className="max-w-xl mx-auto md:max-w-2xl">{/* Form content */}</div>
```

### **Q: How do I add animations between steps?**

A: Use Framer Motion in `MobileExpenseForm.tsx`:

```tsx
import { motion } from "framer-motion";

<motion.div
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
>
  {/* Step content */}
</motion.div>;
```

---

## Final Notes

**This form is production-ready but designed for continuous enhancement.** Every component is modular and independently testable. Follow the patterns established in existing code for consistency.

**Key Principle:** Mobile-first, offline-safe, progressively enhanced.

Good luck with your enhancements! 🚀

---

_Last updated: April 17, 2026_
_For questions, refer to `CLAUDE.md` (project rules) or ERA Notes vault (detailed docs)_
