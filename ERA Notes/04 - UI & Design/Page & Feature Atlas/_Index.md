---
created: 2026-04-28
type: ui
module: cross-cutting
module-type: n/a
status: active
tags:
  - type/ui
  - scope/atlas
  - scope/index
---

# Page & Feature Atlas — Master Index

> Central index of every page and feature in the app. Each row links to a detail entry in this folder.
>
> See [[README]] for workflow. View interactively at `/atlas` in the app.

---

## How to use

- **Hand-off to a designer?** Send this file. Each entry lists exact files to edit.
- **Asking AI for a precise change?** Find the row, open its MD, copy the file path.
- **Adding something new?** Copy `_Template.md` → fill it in → add a row here → run `pnpm atlas`.

---

## Auth & Onboarding

| Slug                    | Route                    | Detail                    |
| ----------------------- | ------------------------ | ------------------------- |
| `landing`               | `/`                      | [[landing]]               |
| `login`                 | `/login`                 | [[login]]                 |
| `signup`                | `/signup`                | [[signup]]                |
| `welcome`               | `/welcome`               | [[welcome]]               |
| `reset-password`        | `/reset-password`        | [[reset-password]]        |
| `reset-password-update` | `/reset-password/update` | [[reset-password-update]] |
| `auth-reset`            | `/auth/reset`            | [[auth-reset]]            |

## Main Tabs (Mobile bottom nav)

| Slug        | Route        | Detail        |
| ----------- | ------------ | ------------- |
| `dashboard` | `/dashboard` | [[dashboard]] |
| `expense`   | `/expense`   | [[expense]]   |
| `reminders` | `/reminders` | [[reminders]] |
| `recurring` | `/recurring` | [[recurring]] |

## Standalone Pages

| Slug             | Route             | Detail             |
| ---------------- | ----------------- | ------------------ |
| `focus`          | `/focus`          | [[focus]]          |
| `catalogue`      | `/catalogue`      | [[catalogue]]      |
| `recipe`         | `/recipe`         | [[recipe]]         |
| `chat`           | `/chat`           | [[chat]]           |
| `alerts`         | `/alerts`         | [[alerts]]         |
| `settings`       | `/settings`       | [[settings]]       |
| `nfc`            | `/nfc`            | [[nfc]]            |
| `nfc-tag`        | `/nfc/[tag]`      | [[nfc-tag]]        |
| `g-tag`          | `/g/[tag]`        | [[g-tag]]          |
| `g-drinks-admin` | `/g/drinks-admin` | [[g-drinks-admin]] |
| `expense-drafts` | `/expense/drafts` | [[expense-drafts]] |

## Utility Routes

| Slug            | Route            | Detail            |
| --------------- | ---------------- | ----------------- |
| `quick-expense` | `/quick-expense` | [[quick-expense]] |
| `qr-expense`    | `/qr/expense`    | [[qr-expense]]    |
| `error-logs`    | `/error-logs`    | [[error-logs]]    |
| `ai-usage`      | `/ai-usage`      | [[ai-usage]]      |
| `atlas`         | `/atlas`         | [[atlas]]         |
| `offline`       | `/offline`       | [[offline]]       |
| `temp`          | `/temp`          | [[temp]]          |

## Feature Modules (Standalone)

> Code-only modules in `src/features/*`. Not directly routable; consumed by pages.

| Slug                       | Module dir                       | Detail                       |
| -------------------------- | -------------------------------- | ---------------------------- |
| `feature-accounts`         | `src/features/accounts/`         | [[feature-accounts]]         |
| `feature-ai-usage`         | `src/features/ai-usage/`         | [[feature-ai-usage]]         |
| `feature-analytics`        | `src/features/analytics/`        | [[feature-analytics]]        |
| `feature-balance`          | `src/features/balance/`          | [[feature-balance]]          |
| `feature-blink`            | `src/features/blink/`            | [[feature-blink]]            |
| `feature-budget`           | `src/features/budget/`           | [[feature-budget]]           |
| `feature-catalogue`        | `src/features/catalogue/`        | [[feature-catalogue]]        |
| `feature-categories`       | `src/features/categories/`       | [[feature-categories]]       |
| `feature-dashboard`        | `src/features/dashboard/`        | [[feature-dashboard]]        |
| `feature-debts`            | `src/features/debts/`            | [[feature-debts]]            |
| `feature-drafts`           | `src/features/drafts/`           | [[feature-drafts]]           |
| `feature-future-purchases` | `src/features/future-purchases/` | [[feature-future-purchases]] |
| `feature-hub`              | `src/features/hub/`              | [[feature-hub]]              |
| `feature-inventory`        | `src/features/inventory/`        | [[feature-inventory]]        |
| `feature-items`            | `src/features/items/`            | [[feature-items]]            |
| `feature-navigation`       | `src/features/navigation/`       | [[feature-navigation]]       |
| `feature-nfc`              | `src/features/nfc/`              | [[feature-nfc]]              |
| `feature-preferences`      | `src/features/preferences/`      | [[feature-preferences]]      |
| `feature-recipes`          | `src/features/recipes/`          | [[feature-recipes]]          |
| `feature-recurring`        | `src/features/recurring/`        | [[feature-recurring]]        |
| `feature-reminders`        | `src/features/reminders/`        | [[feature-reminders]]        |
| `feature-statement-import` | `src/features/statement-import/` | [[feature-statement-import]] |
| `feature-today`            | `src/features/today/`            | [[feature-today]]            |
| `feature-transactions`     | `src/features/transactions/`     | [[feature-transactions]]     |
| `feature-transfers`        | `src/features/transfers/`        | [[feature-transfers]]        |

---

## Maintenance

- Stub entries are seeded by `node scripts/seed-atlas.mjs` (idempotent — safe to re-run).
- After editing any MD here, run `pnpm atlas` to regenerate `public/atlas/atlas.json`.
- The in-app viewer at **`/atlas`** reads that JSON.
- Hard Rule #20 in `CLAUDE.md` requires keeping this index and the per-page files in sync with the codebase.
