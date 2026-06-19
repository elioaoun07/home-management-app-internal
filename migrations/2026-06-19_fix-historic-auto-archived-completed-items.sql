-- Backfill: archive any one-time (non-recurring) item that's already
-- status='completed' whose due/start date is 1+ month old but hasn't been
-- archived yet. Matches ARCHIVE_COMPLETED_OLDER_THAN_MONTHS = 1 in
-- src/app/api/items/[id]/complete/route.ts and
-- src/app/api/items/[id]/actions/route.ts.
--
-- Recurring items are intentionally excluded — archiving them would hide
-- ALL their future occurrences, not just an old completed one. See
-- ERA Notes/02 - Standalone Modules/Items & Reminders/Overview.md, Hard Rule #8.

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1 — Preview. Run this first and review the rows.
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  i.id,
  i.title,
  i.type,
  i.status,
  i.archived_at,
  COALESCE(rd.due_at, ed.start_at) AS occurrence_date
FROM items i
LEFT JOIN reminder_details rd ON rd.item_id = i.id
LEFT JOIN event_details ed ON ed.item_id = i.id
WHERE i.status = 'completed'
  AND i.archived_at IS NULL
  AND i.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM item_recurrence_rules r WHERE r.item_id = i.id
  )
  AND COALESCE(rd.due_at, ed.start_at) < (now() - INTERVAL '1 month');

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2 — Apply. Uncomment and run after reviewing STEP 1's output.
-- ───────────────────────────────────────────────────────────────────────────
-- UPDATE items i
-- SET archived_at = now()
-- WHERE i.status = 'completed'
--   AND i.archived_at IS NULL
--   AND i.deleted_at IS NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM item_recurrence_rules r WHERE r.item_id = i.id
--   )
--   AND COALESCE(
--     (SELECT rd.due_at FROM reminder_details rd WHERE rd.item_id = i.id),
--     (SELECT ed.start_at FROM event_details ed WHERE ed.item_id = i.id)
--   ) < (now() - INTERVAL '1 month');
