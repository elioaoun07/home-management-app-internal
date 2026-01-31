-- Migration: Add voice message support to hub_messages
-- Date: 2026-01-31
-- Description: Adds voice_url and voice_transcript columns for voice messages in chat

-- 1. Add voice_url column to store the audio file URL
ALTER TABLE public.hub_messages 
ADD COLUMN IF NOT EXISTS voice_url text;

-- 2. Add voice_transcript column to store the transcription
ALTER TABLE public.hub_messages 
ADD COLUMN IF NOT EXISTS voice_transcript text;

-- 3. Add voice_duration column to store audio duration in seconds
ALTER TABLE public.hub_messages 
ADD COLUMN IF NOT EXISTS voice_duration integer;

-- 4. Create index for efficient querying of voice messages
CREATE INDEX IF NOT EXISTS idx_hub_messages_voice_url ON public.hub_messages(voice_url) 
WHERE voice_url IS NOT NULL;

-- 5. Add comments for documentation
COMMENT ON COLUMN public.hub_messages.voice_url IS 'URL to the voice message audio file in storage';
COMMENT ON COLUMN public.hub_messages.voice_transcript IS 'Transcription of the voice message content';
COMMENT ON COLUMN public.hub_messages.voice_duration IS 'Duration of the voice message in seconds';

-- 6. Create storage bucket for voice messages (run in Supabase dashboard or via admin API)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'voice-messages',
--   'voice-messages', 
--   false,
--   10485760, -- 10MB limit
--   ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']
-- )
-- ON CONFLICT (id) DO NOTHING;
