"use client";

// src/features/era/useEraConversation.ts
// Persistence hooks for ERA conversations + messages.
//
// Architecture:
//   - React Query is the hot in-memory cache.
//   - Postgres (era_conversations, era_messages) is the source of truth.
//   - Supabase Realtime keeps multi-device transcripts in sync.
//   - useCreateEraMessage uses safeFetch so writes degrade to the offline
//     queue when offline (Hard Rule #6).

import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { eraKeys } from "./queryKeys";
import type { FaceKey, Intent } from "./types";

export interface EraConversation {
  id: string;
  user_id: string;
  title: string | null;
  active_face_key: FaceKey;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface EraMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent_kind: Intent["kind"] | null;
  intent_face: FaceKey | null;
  intent_payload: Record<string, unknown> | null;
  draft_transaction_id: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

async function fetchConversations(): Promise<EraConversation[]> {
  const res = await fetch("/api/era/conversations?limit=20");
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

export function useEraConversations() {
  return useQuery({
    queryKey: eraKeys.conversations(),
    queryFn: fetchConversations,
    staleTime: CACHE_TIMES.RECURRING, // 30 min — conversations rarely change
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Returns the most recently updated conversation, or null. ERA's command bar
 * uses this to decide whether to append to an existing session or auto-create
 * a new one (the API supports auto_create_conversation: true).
 */
export function useActiveEraConversation() {
  const { data, ...rest } = useEraConversations();

  // Roll a new conversation after 6 hours of inactivity.
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const candidate = data?.[0] ?? null;
  const stillFresh =
    candidate &&
    Date.now() - new Date(candidate.updated_at).getTime() < SIX_HOURS_MS;

  return {
    ...rest,
    data: stillFresh ? candidate : null,
  };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

async function fetchMessages(
  conversationId: string,
): Promise<{ messages: EraMessage[]; nextCursor: string | null }> {
  const res = await fetch(
    `/api/era/messages?conversationId=${encodeURIComponent(conversationId)}&limit=50`,
  );
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

export function useEraMessages(conversationId: string | null) {
  return useQuery({
    queryKey: eraKeys.messages(conversationId),
    queryFn: () => fetchMessages(conversationId as string),
    enabled: !!conversationId,
    staleTime: CACHE_TIMES.TRANSACTIONS, // 2 min
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Subscribes the active conversation to Supabase Realtime so messages
 * inserted from another device appear live.
 */
export function useEraMessagesRealtime(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
    const supabase = supabaseBrowser();

    const channel = supabase
      .channel(`era:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "era_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: eraKeys.messages(conversationId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}

// ---------------------------------------------------------------------------
// Create message (with auto-create conversation)
// ---------------------------------------------------------------------------

export interface CreateEraMessageInput {
  conversation_id: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  intent_kind?: Intent["kind"] | null;
  intent_face?: FaceKey | null;
  intent_payload?: Record<string, unknown> | null;
  draft_transaction_id?: string | null;
}

export interface CreateEraMessageResult {
  message: EraMessage;
  conversation_id: string;
}

export function useCreateEraMessage() {
  const queryClient = useQueryClient();

  return useMutation<CreateEraMessageResult, Error, CreateEraMessageInput>({
    mutationFn: async (input) => {
      // Strip null/undefined so the API zod schema (which uses
      // `.optional()` on most fields) doesn't choke on JSON nulls.
      const payload: Record<string, unknown> = {
        role: input.role,
        content: input.content,
        auto_create_conversation: !input.conversation_id,
      };
      if (input.conversation_id)
        payload.conversation_id = input.conversation_id;
      if (input.intent_kind) payload.intent_kind = input.intent_kind;
      if (input.intent_face) payload.intent_face = input.intent_face;
      if (input.intent_payload) payload.intent_payload = input.intent_payload;
      if (input.draft_transaction_id)
        payload.draft_transaction_id = input.draft_transaction_id;

      const res = await safeFetch("/api/era/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (result) => {
      // Refresh both the messages list for this conversation and the
      // conversations list (updated_at changed).
      queryClient.invalidateQueries({
        queryKey: eraKeys.messages(result.conversation_id),
      });
      queryClient.invalidateQueries({ queryKey: eraKeys.conversations() });
    },
  });
}
