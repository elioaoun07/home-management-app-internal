-- Migration: Add device_id to guest_sessions for better session isolation
-- Created: 2026-02-21
-- Description: Adds a unique device identifier to ensure each browser instance
--              gets its own session, even if devices have identical fingerprints
--              (e.g., two identical phones with same browser, language, resolution)

-- Add device_id column (nullable for backward compatibility with existing sessions)
ALTER TABLE public.guest_sessions 
ADD COLUMN IF NOT EXISTS device_id text;

-- Add index for efficient lookups by device_id
CREATE INDEX IF NOT EXISTS idx_guest_sessions_device_id 
ON public.guest_sessions(device_id) 
WHERE device_id IS NOT NULL;

-- Note: Existing sessions without device_id will be migrated when the user
-- next visits the portal - the API will populate device_id on the existing session
