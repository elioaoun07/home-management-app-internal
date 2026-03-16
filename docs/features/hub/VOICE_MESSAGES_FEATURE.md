# Voice Messages Feature for Budget/Reminder Chats

## Overview

Voice messaging has been added to Budget and Reminder chat threads. Users can now record voice messages with real-time transcription, and recipients can both listen to the audio and read the transcript.

## Features

### 1. WhatsApp-Style Voice Recording

- Available only in **Budget** and **Reminder** purpose threads
- Tap the microphone button (replaces send when input is empty) to start recording immediately
- Inline recording UI shows: delete, timer, waveform, pause, send
- Real-time transcription as you speak
- Tap send to send or trash to cancel
- No preview step - direct send like WhatsApp

### 2. Voice Playback

- Custom audio player with waveform visualization
- Play/pause controls
- Time display showing current position and duration
- Collapsible transcript below the audio player

### 3. Transcription

- Uses Web Speech API for real-time speech-to-text
- Transcript is stored with the message for searchability
- Transcript can be expanded/collapsed by the recipient

## Files Created/Modified

### New Files

1. **`migrations/add_voice_messages.sql`**
   - Adds `voice_url`, `voice_transcript`, and `voice_duration` columns to `hub_messages`
   - Creates index for efficient querying of voice messages

2. **`src/components/hub/InlineVoiceRecorder.tsx`**
   - WhatsApp-style inline recording component
   - Starts recording immediately on mount
   - Shows delete, timer, waveform, pause/resume, send buttons
   - Handles transcription via Web Speech API

3. **`src/components/hub/VoiceMessagePlayer.tsx`**
   - Component for playing voice messages
   - Custom audio player with waveform visualization
   - Collapsible transcript display

4. **`src/app/api/hub/voice-message/route.ts`**
   - API endpoint for uploading voice messages
   - Uploads audio to Supabase Storage (`voice-messages` bucket)
   - Creates message with voice data

### Modified Files

1. **`src/components/hub/HubPage.tsx`**
   - Added dynamic imports for voice components
   - Added `isVoiceMode` state for toggling voice input
   - Added voice button in input area for budget/reminder threads
   - Added VoiceMessagePlayer rendering for voice messages

2. **`src/features/hub/hooks.ts`**
   - Added voice fields to `HubMessage` type:
     - `voice_url?: string | null`
     - `voice_transcript?: string | null`
     - `voice_duration?: number | null`

3. **`schema.sql`**
   - Added voice columns to `hub_messages` table definition

## Database Migration

Run the migration to add voice message support:

```sql
-- Run in Supabase SQL Editor
\i migrations/add_voice_messages.sql
```

Or manually run:

```sql
ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS voice_url text;

ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS voice_transcript text;

ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS voice_duration integer;
```

## Storage Bucket

The API will automatically create the `voice-messages` storage bucket if it doesn't exist. The bucket is configured with:

- Private access (requires authentication)
- 10MB file size limit
- Allowed MIME types: `audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/wav`

## Usage

### Recording a Voice Message

1. Navigate to a Budget or Reminder chat thread
2. Click the microphone icon in the input area
3. Allow microphone access if prompted
4. Speak your message - transcription appears in real-time
5. Click the stop button when finished
6. Preview the recording and transcript
7. Click "Send" to send or "Cancel" to discard

### Playing a Voice Message

1. Voice messages show with a custom audio player
2. Click the play button to listen
3. Click "Show transcript" to read the text
4. Transcript is searchable in chat search

## Browser Compatibility

- **Audio Recording**: Supported in all modern browsers
- **Speech Recognition**: Supported in Chrome, Edge, Safari (may not work in Firefox)
- Fallback: If speech recognition isn't supported, voice messages can still be sent without transcription

## Architecture

```
User Records → MediaRecorder (audio) + SpeechRecognition (text)
                    ↓
           VoiceMessageRecorder
                    ↓
         POST /api/hub/voice-message
                    ↓
    ┌───────────────┴───────────────┐
    ↓                               ↓
Supabase Storage             hub_messages table
(audio file)            (voice_url, voice_transcript)
    ↓                               ↓
    └───────────────┬───────────────┘
                    ↓
          VoiceMessagePlayer
        (plays audio + shows transcript)
```
