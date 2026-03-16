# Standalone PWA Apps Plan

> **Created**: February 13, 2026  
> **Status**: Implemented ✅

---

## Overview

This document outlines the architecture for creating standalone PWA installable apps for different features of the Budget Manager app. The key principle is that **only the main Expense app should show the bottom navigation bar**—all standalone apps (Chat, Reminders, Catalogue, Recipe) have a minimal header with back navigation only.

---

## Problem Solved

Previously, when installing standalone apps like Catalogue or Recipe, they incorrectly showed the bottom navigation bar. This made them feel like part of the main app rather than independent utilities.

**Solution**: Route-based exclusion in `MobileNav.tsx` and a dedicated standalone header in `ConditionalHeader.tsx`.

---

## Architecture

### Navigation Bar Visibility

| Route                 | Bottom Nav | Header Style                       |
| --------------------- | ---------- | ---------------------------------- |
| `/expense` (main app) | ✅ Shows   | Full header with app title         |
| `/dashboard` (tab)    | ✅ Shows   | Full header                        |
| `/catalogue`          | ❌ Hidden  | Standalone header with back button |
| `/recipe`             | ❌ Hidden  | Standalone header with back button |
| `/chat`               | ❌ Hidden  | Standalone header with back button |
| `/reminders`          | ❌ Hidden  | Standalone header with back button |
| `/g/*` (guest portal) | ❌ Hidden  | No header                          |

### Route Exclusion Logic

```tsx
// In MobileNav.tsx
const standaloneRoutes = [
  "/g/",
  "/catalogue",
  "/recipe",
  "/chat",
  "/reminders",
];
if (standaloneRoutes.some((route) => pathname?.startsWith(route))) {
  return null;
}
```

### Standalone Header Configuration

Each standalone app has its own accent color in `ConditionalHeader.tsx`:

```tsx
const STANDALONE_APPS = {
  "/catalogue": {
    title: "Catalogue",
    color: "from-emerald-400 to-emerald-600",
  },
  "/recipe": { title: "Recipes", color: "from-orange-400 to-orange-600" },
  "/chat": { title: "Hub Chat", color: "from-cyan-400 to-cyan-600" },
  "/reminders": { title: "Reminders", color: "from-amber-400 to-amber-600" },
};
```

---

## Implemented Apps

### 1. Chat Standalone App

- **Route**: `/chat`
- **Manifest**: `/manifests/chat.webmanifest`
- **Theme Color**: `#06b6d4` (cyan-500)
- **Component**: Renders `HubPage` from existing hub feature

**Files Created**:

- `src/app/chat/page.tsx`
- `src/app/chat/layout.tsx`
- `public/manifests/chat.webmanifest`

### 2. Reminders Standalone App

- **Route**: `/reminders`
- **Manifest**: `/manifests/reminders.webmanifest`
- **Theme Color**: `#f59e0b` (amber-500)
- **Component**: New `StandaloneRemindersPage` with focus view

**Files Created**:

- `src/app/reminders/page.tsx`
- `src/app/reminders/layout.tsx`
- `src/components/reminder/StandaloneRemindersPage.tsx`
- `public/manifests/reminders.webmanifest`

### 3. Catalogue (Fixed)

- **Route**: `/catalogue`
- **Manifest**: `/manifests/catalogue.webmanifest` (existing)
- **Theme Color**: `#10b981` (emerald-500)
- **Fix**: Now excluded from navigation bar

### 4. Recipe (Fixed)

- **Route**: `/recipe`
- **Manifest**: `/manifests/recipe.webmanifest` (existing)
- **Theme Color**: `#f97316` (orange-500)
- **Fix**: Now excluded from navigation bar

---

## Files Modified

| File                                           | Change                            |
| ---------------------------------------------- | --------------------------------- |
| `src/components/layouts/MobileNav.tsx`         | Added standalone route exclusion  |
| `src/components/layouts/ConditionalHeader.tsx` | Added standalone header rendering |

## Files Created

| File                                                  | Purpose                            |
| ----------------------------------------------------- | ---------------------------------- |
| `src/app/chat/page.tsx`                               | Chat standalone page               |
| `src/app/chat/layout.tsx`                             | Chat metadata & manifest link      |
| `src/app/reminders/page.tsx`                          | Reminders standalone page          |
| `src/app/reminders/layout.tsx`                        | Reminders metadata & manifest link |
| `src/components/reminder/StandaloneRemindersPage.tsx` | Reminders UI component             |
| `public/manifests/chat.webmanifest`                   | Chat PWA manifest                  |
| `public/manifests/reminders.webmanifest`              | Reminders PWA manifest             |

---

## Icon Requirements

Each standalone app needs 4 icon sizes in `public/`:

| Icon      | Sizes                                                                                       |
| --------- | ------------------------------------------------------------------------------------------- |
| Chat      | `chat-180.png`, `chat-192.png`, `chat-512.png`, `chat-maskable-512.png`                     |
| Reminders | `reminders-180.png`, `reminders-192.png`, `reminders-512.png`, `reminders-maskable-512.png` |

### Icon Design Specification

**Consistent style** with per-app accent colors:

| App           | Accent Color      | Icon Concept        |
| ------------- | ----------------- | ------------------- |
| Budget (main) | Indigo (#6366f1)  | Wallet/chart        |
| Chat          | Cyan (#06b6d4)    | Message bubble      |
| Reminders     | Amber (#f59e0b)   | Bell with checkmark |
| Catalogue     | Emerald (#10b981) | Grid/book           |
| Recipe        | Orange (#f97316)  | Chef hat/utensils   |

**Base design**: Rounded square with gradient background, simple icon in center, subtle shadow.

---

## How to Install Standalone Apps

1. Navigate to the standalone route (e.g., `/chat`)
2. Browser will detect the manifest and offer "Add to Home Screen"
3. Each app will have its own icon and launch independently

---

## Future Standalone Apps (Ideas)

- **Quick Expense** (`/quick-expense`) - Fast expense entry only
- **Recurring Payments** (`/recurring`) - Payment scheduler
- **Future Purchases** (`/savings`) - Savings goals tracker

To add a new standalone app:

1. Create route with page.tsx and layout.tsx
2. Add manifest to `public/manifests/`
3. Add icons to `public/`
4. Add route to `standaloneRoutes` array in `MobileNav.tsx`
5. Add configuration to `STANDALONE_APPS` in `ConditionalHeader.tsx`

---

## Testing Checklist

- [ ] Navigate to `/chat` - no bottom nav
- [ ] Navigate to `/reminders` - no bottom nav
- [ ] Navigate to `/catalogue` - no bottom nav
- [ ] Navigate to `/recipe` - no bottom nav
- [ ] Navigate to `/expense` - bottom nav shows
- [ ] Install each app separately and verify icons
- [ ] Verify back button navigates to `/expense`
