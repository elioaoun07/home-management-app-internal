---
type: feature-doc
module: nfc-tags
tags:
  - type/feature-doc
  - module/nfc-tags
  - status/active
---

# NFC Tags — Overview

> **Type:** Standalone Module
> **Source paths:** `src/features/nfc/`, `src/app/nfc/[tag]/`, `src/app/api/nfc/`
> **Related:** [[Prerequisites Overview]] (Junction — connects NFC with Items)

---

## Purpose

Authenticated NFC tag system for household automation. Each NFC tag maps to a generic reusable URL slug (`/nfc/[tag]`), with behavior stored server-side. Tags have multiple states that cycle on each tap (auto-flip), and state changes trigger the prerequisite engine to activate dormant items.

**Hard Rule:** NFC tag URLs must NEVER be hardcoded to a specific purpose. Always use generic reusable slugs (e.g., `/nfc/main-door`, `/nfc/kitchen-1`). All behavior is configured server-side via the `nfc_tags` table.

---

## Architecture

### NFC Tap Flow

1. User taps NFC tag → phone opens `/nfc/{tag_slug}`
2. Server component verifies auth → redirects to `/login` if needed
3. Client fetches tag config → computes auto-flip next state
4. Shows confirm UI with 3s countdown (can override)
5. POST `/api/nfc/{slug}/tap` → flips state → logs → evaluates prerequisites
6. Branches to state-specific UI (e.g., arriving → welcome, leaving → checklist)

### State Auto-Flip

States are an ordered array (e.g., `["leaving", "arriving"]`). Each tap advances to the next state in the cycle. Override button allows manual state selection.

### NFC Tag Configuration

- **tag_slug**: URL-safe unique identifier (e.g., `main-door`)
- **states**: Ordered array of possible states (minimum 2)
- **current_state**: Last recorded state (null if never tapped)
- **location_name**: Human-readable location
- **icon**: Icon identifier for UI

---

## Database Tables

### `nfc_tags`

| Column                 | Type                 | Notes                  |
| ---------------------- | -------------------- | ---------------------- |
| id                     | uuid PK              |                        |
| user_id                | uuid FK → auth.users | Tag owner              |
| tag_slug               | text UNIQUE          | URL slug               |
| label                  | text                 | Display name           |
| location_name          | text                 | Physical location      |
| icon                   | text                 | Icon identifier        |
| states                 | jsonb                | Array of state strings |
| current_state          | text                 | Last recorded state    |
| is_active              | boolean              | Enable/disable         |
| created_at, updated_at | timestamptz          |                        |

### `nfc_state_log`

| Column         | Type                       | Notes            |
| -------------- | -------------------------- | ---------------- |
| id             | uuid PK                    |                  |
| tag_id         | uuid FK → nfc_tags CASCADE |                  |
| previous_state | text                       | State before tap |
| new_state      | text                       | State after tap  |
| changed_by     | uuid FK → auth.users       | Who tapped       |
| metadata_json  | jsonb                      | Extra context    |
| changed_at     | timestamptz                |                  |

---

## API Routes

| Route                     | Method | Purpose                                       |
| ------------------------- | ------ | --------------------------------------------- |
| `/api/nfc`                | GET    | List user's tags                              |
| `/api/nfc`                | POST   | Create new tag                                |
| `/api/nfc/[slug]`         | GET    | Get tag config + state                        |
| `/api/nfc/[slug]`         | PATCH  | Update tag                                    |
| `/api/nfc/[slug]`         | DELETE | Delete tag                                    |
| `/api/nfc/[slug]/tap`     | POST   | Record tap, flip state, trigger prerequisites |
| `/api/nfc/[slug]/history` | GET    | State change log                              |

---

## Feature Hooks (`src/features/nfc/hooks.ts`)

| Hook                    | Type     | Purpose              |
| ----------------------- | -------- | -------------------- |
| `useNfcTags()`          | Query    | List all tags        |
| `useNfcTag(slug)`       | Query    | Single tag config    |
| `useNfcTap(slug)`       | Mutation | Tap → flip + trigger |
| `useNfcHistory(slug)`   | Query    | State history        |
| `useCreateNfcTag()`     | Mutation | Create tag           |
| `useUpdateNfcTag(slug)` | Mutation | Update tag           |
| `useDeleteNfcTag()`     | Mutation | Delete tag           |

---

## Setup: Adding a New NFC Tag

1. Program NFC chip with URL: `https://your-app.com/nfc/{slug}`
2. Create tag record via API or admin UI:
   ```sql
   INSERT INTO nfc_tags (user_id, tag_slug, label, location_name, states)
   VALUES ('your-user-id', 'main-door', 'Main Door', 'Home Entrance', '["leaving", "arriving"]');
   ```
3. Create dormant tasks with prerequisites targeting this tag (see [[Prerequisites Overview]])

### Example: Main Door Tag

- **Slug:** `main-door`
- **States:** `["leaving", "arriving"]`
- **Leaving:** Shows checklist (turn off oven, lock balcony, etc.)
- **Arriving:** Shows welcome message + dashboard redirect

---

## Gotchas

- NFC tags require authentication — unauthenticated users redirect to login with return URL
- State auto-flip is based on array order — reordering states changes the cycle
- The tap route is the integration point with the prerequisite engine
- State log is append-only — never delete history entries
- Tag slugs are globally unique (not per-user) to prevent URL conflicts
