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

type EraMessagesPage = {
  messages: EraMessage[];
  nextCursor: string | null;
};

type CreateEraMessageContext = {
  conversationId: string | null;
  optimisticId: string | null;
};

// Keep writes ordered without making the visible turn wait for Postgres. This
// matters when a user row and its assistant row are submitted back-to-back.
const conversationWriteQueues = new Map<
  string,
  Promise<CreateEraMessageResult>
>();

function enqueueConversationWrite(
  conversationId: string,
  write: () => Promise<CreateEraMessageResult>,
): Promise<CreateEraMessageResult> {
  const previous = conversationWriteQueues.get(conversationId);
  const current = previous ? previous.then(write) : write();
  conversationWriteQueues.set(conversationId, current);

  void current.then(
    () => {
      if (conversationWriteQueues.get(conversationId) === current) {
        conversationWriteQueues.delete(conversationId);
      }
    },
    () => {
      if (conversationWriteQueues.get(conversationId) === current) {
        conversationWriteQueues.delete(conversationId);
      }
    },
  );

  return current;
}

export function useCreateEraMessage() {
  const queryClient = useQueryClient();

  return useMutation<
    CreateEraMessageResult,
    Error,
    CreateEraMessageInput,
    CreateEraMessageContext
  >({
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

      const write = async () => {
        const res = await safeFetch("/api/era/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        return res.json() as Promise<CreateEraMessageResult>;
      };

      return input.conversation_id
        ? enqueueConversationWrite(input.conversation_id, write)
        : write();
    },
    onMutate: async (input) => {
      const conversationId = input.conversation_id;
      if (!conversationId) {
        return { conversationId: null, optimisticId: null };
      }

      const cachedPage = queryClient.getQueryData<EraMessagesPage>(
        eraKeys.messages(conversationId),
      );
      if (cachedPage) {
        await queryClient.cancelQueries({
          queryKey: eraKeys.messages(conversationId),
        });
      }

      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      const optimisticMessage: EraMessage = {
        id: optimisticId,
        conversation_id: conversationId,
        user_id: "optimistic",
        role: input.role,
        content: input.content,
        intent_kind: input.intent_kind ?? null,
        intent_face: input.intent_face ?? null,
        intent_payload: input.intent_payload ?? null,
        draft_transaction_id: input.draft_transaction_id ?? null,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<EraMessagesPage>(
        eraKeys.messages(conversationId),
        (old) => ({
          messages: [...(old?.messages ?? []), optimisticMessage],
          nextCursor: old?.nextCursor ?? null,
        }),
      );

      return { conversationId, optimisticId };
    },
    onSuccess: (result, _input, context) => {
      queryClient.setQueryData<EraMessagesPage>(
        eraKeys.messages(result.conversation_id),
        (old) => {
          const current = old?.messages ?? [];
          const withoutServerDuplicate = current.filter(
            (message) => message.id !== result.message.id,
          );
          const optimisticIndex = withoutServerDuplicate.findIndex(
            (message) => message.id === context?.optimisticId,
          );

          const messages = [...withoutServerDuplicate];
          if (optimisticIndex >= 0) {
            messages[optimisticIndex] = result.message;
          } else {
            messages.push(result.message);
          }

          return {
            messages,
            nextCursor: old?.nextCursor ?? null,
          };
        },
      );

      // updated_at changed, so the active conversation ordering may change.
      queryClient.invalidateQueries({ queryKey: eraKeys.conversations() });
    },
    onError: (_error, _input, context) => {
      if (!context?.conversationId || !context.optimisticId) return;
      queryClient.setQueryData<EraMessagesPage>(
        eraKeys.messages(context.conversationId),
        (old) => ({
          messages: (old?.messages ?? []).filter(
            (message) => message.id !== context.optimisticId,
          ),
          nextCursor: old?.nextCursor ?? null,
        }),
      );
    },
  });
}
