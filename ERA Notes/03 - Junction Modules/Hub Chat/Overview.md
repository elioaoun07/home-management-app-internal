---
created: 2026-03-23
type: overview
module: hub-chat
module-type: junction
tags:
  - type/overview
  - module/hub-chat
---

# Hub Chat

> **Source:** `src/app/hub/`, `src/features/hub/`, `src/components/hub/`
> **DB Tables:** `hub_chat_threads`, `hub_messages`, `hub_message_actions`
> **Type:** Junction — connects Budget, Reminders, Shopping List

## Docs in This Module

- [[Chat to Transaction Quickstart]]
- [[Voice Messages]]
- [[Private Chats]]

## Key Concepts

- Long-press → action menu → NLP parsing → transaction/reminder creation
- WhatsApp-style voice recording with transcription
- Private threads with `is_private` column

## See Also

- [[Message Actions Overview|Message Actions]]
- [[Shopping List Overview|Shopping List]]
- [[Household Sharing Setup]]
