-- Migration: Optimize item_alerts table for cron-job notification queries
-- This migration adds indexes to dramatically speed up the every-minute cron check

-- Composite index for the main cron-job query pattern:
-- WHERE active = true AND channel = 'push' AND trigger_at <= NOW() AND trigger_at >= (NOW - 1 hour) AND last_fired_at IS NULL
-- The index order is optimized for selectivity: channel and active are low cardinality (filter first),
-- then trigger_at for range scan, and last_fired_at for the NULL check

CREATE INDEX IF NOT EXISTS idx_item_alerts_pending_notifications 
ON item_alerts (channel, active, trigger_at, last_fired_at)
WHERE active = true AND last_fired_at IS NULL;

-- This partial index only includes rows that are active and not yet fired,
-- making the cron-job query extremely fast as it only scans relevant rows

-- Additional index for looking up alerts by item_id (useful for joins)
CREATE INDEX IF NOT EXISTS idx_item_alerts_item_id 
ON item_alerts (item_id);

-- Index for trigger_at to support time-range queries
CREATE INDEX IF NOT EXISTS idx_item_alerts_trigger_at 
ON item_alerts (trigger_at)
WHERE active = true;

-- Create a view for pending alerts that the cron-job can query efficiently
-- This provides a clean interface and ensures consistent query patterns
CREATE OR REPLACE VIEW pending_push_alerts AS
SELECT 
    ia.id,
    ia.item_id,
    ia.trigger_at,
    ia.channel,
    ia.last_fired_at,
    i.user_id,
    i.title,
    i.description,
    i.type,
    i.priority,
    rd.due_at as reminder_due_at
FROM item_alerts ia
JOIN items i ON i.id = ia.item_id
LEFT JOIN reminder_details rd ON rd.item_id = ia.item_id
WHERE ia.active = true 
  AND ia.channel = 'push'
  AND ia.last_fired_at IS NULL;

-- Function to quickly check if there are any pending alerts due now
-- This can be called first to avoid expensive queries when there's nothing to process
CREATE OR REPLACE FUNCTION has_pending_alerts(
    p_since TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '1 hour'),
    p_until TIMESTAMPTZ DEFAULT NOW()
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM item_alerts 
        WHERE active = true 
          AND channel = 'push'
          AND last_fired_at IS NULL
          AND trigger_at >= p_since
          AND trigger_at <= p_until
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get pending alerts count (useful for monitoring)
CREATE OR REPLACE FUNCTION count_pending_alerts(
    p_since TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '1 hour'),
    p_until TIMESTAMPTZ DEFAULT NOW()
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM item_alerts 
    WHERE active = true 
      AND channel = 'push'
      AND last_fired_at IS NULL
      AND trigger_at >= p_since
      AND trigger_at <= p_until;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON INDEX idx_item_alerts_pending_notifications IS 'Optimized partial index for cron-job notification queries';
COMMENT ON VIEW pending_push_alerts IS 'Pre-filtered view of alerts ready to be sent via push notification';
COMMENT ON FUNCTION has_pending_alerts IS 'Quick existence check for pending alerts - use before heavy queries';
COMMENT ON FUNCTION count_pending_alerts IS 'Count pending alerts - useful for monitoring and dashboards';
