-- migrations/2026-06-19_daily-items-summary-notification-type.sql
-- Notifications & Alerts campaign, Phase 1 (W1): the daily items summary cron
-- and the daily transaction reminder cron both wrote notification_type =
-- 'daily_reminder', so neither in-app routing (getActionRoute) nor push
-- routing (sw.js) could tell them apart -- both opened /expense even though
-- the items summary should open /reminders. Split them into a dedicated type.
--
-- Run this whole file once in the Supabase SQL Editor.

ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'daily_items_summary';
