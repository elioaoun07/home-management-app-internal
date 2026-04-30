-- ===========================================================================
-- Recycle Bin: universal soft-delete
-- ===========================================================================
-- Adds a `deleted_at TIMESTAMPTZ NULL` column to every in-scope table.
-- `deleted_at IS NULL`     => row is active.
-- `deleted_at IS NOT NULL` => row is in the Recycle Bin.
--
-- A daily cron purges rows where `deleted_at < NOW() - INTERVAL '30 days'`.
--
-- Hub messages and chat threads already have a `deleted_at` column; they are
-- left untouched here.
--
-- IMPORTANT: run this manually in the Supabase SQL Editor.
-- After running, also run the optional backfill block at the bottom IF you
-- want to migrate existing `archived_at`-as-deletion semantics for recipes
-- and catalogue items (see code that previously used `archived_at` to mean
-- "deleted" in /api/recipes and /api/catalogue/items DELETE handlers).
-- ===========================================================================

BEGIN;

-- 1. transactions ------------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS transactions_deleted_at_idx
  ON public.transactions(user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 2. transfers ---------------------------------------------------------------
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS transfers_deleted_at_idx
  ON public.transfers(user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 3. items -------------------------------------------------------------------
-- NOTE: `items` already has `archived_at`. That stays as the user-facing
-- archive flag. `deleted_at` is the trash flag and is distinct.
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS items_deleted_at_idx
  ON public.items(user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 4. recipes -----------------------------------------------------------------
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS recipes_deleted_at_idx
  ON public.recipes(user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 5. catalogue_items ---------------------------------------------------------
ALTER TABLE public.catalogue_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS catalogue_items_deleted_at_idx
  ON public.catalogue_items(user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 6. future_purchases --------------------------------------------------------
ALTER TABLE public.future_purchases
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS future_purchases_deleted_at_idx
  ON public.future_purchases(user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 7. hub_chat_threads, hub_messages -----------------------------------------
-- Already have `deleted_at`. Just ensure indexes exist.
CREATE INDEX IF NOT EXISTS hub_chat_threads_deleted_at_idx
  ON public.hub_chat_threads(household_id, deleted_at)
  WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS hub_messages_deleted_at_idx
  ON public.hub_messages(household_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMIT;

-- ===========================================================================
-- OPTIONAL backfill: migrate `archived_at` -> `deleted_at` for recipes and
-- catalogue items where the existing API uses `archived_at` to mean "deleted".
-- Only run if you want already-deleted records to appear in the Recycle Bin.
-- ===========================================================================
-- BEGIN;
-- UPDATE public.recipes
--   SET deleted_at = archived_at
--   WHERE archived_at IS NOT NULL AND deleted_at IS NULL;
-- UPDATE public.catalogue_items
--   SET deleted_at = archived_at
--   WHERE archived_at IS NOT NULL AND deleted_at IS NULL;
-- COMMIT;
