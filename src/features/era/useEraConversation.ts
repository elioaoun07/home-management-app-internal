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
import { ToastIcons } from "@/lib/toastIcons";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { eraKeys } from "./queryKeys";
import { pickActiveConversation } from "./thread";
import type { FaceKey, Intent } from "./types";
import { useEraStore } from "./useEraStore";

export interface EraConversation {
  id: string;
  user_id: string;
  title: string | null;
  active_face_key: FaceKey;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  /**
   * HUB-86 — started in this tab and not yet confirmed by the server: the
   * next write carries `ensure_conversation` so the row is created first.
   */
  local?: boolean;
}

/**
 * `era_messages.intent_kind`: the turn's intent, or a bookkeeping kind —
 * an Ask AI answer, a filed report, a consumed handoff.
 */
export type EraMessageKind =
  | Intent["kind"]
  | "ai_answer"
  | "issue_report"
  | "handoff_consumed";

/** A History picker row (GET /api/era/conversations?history=1). */
export interface EraConversationSummary {
  id: string;
  title: string;
  active_face_key: FaceKey;
  created_at: string;
  updated_at: string;
}

export interface EraMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent_kind: EraMessageKind | null;
  intent_face: FaceKey | null;
  intent_payload: Record<string, unknown> | null;
  draft_transaction_id: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

// HUB-86 — conversations this tab started (a fresh chat's first sentence
// names its own conversation so the turn never waits on a round trip). Kept
// until the server's list includes them, so a refetch racing the first write
// cannot drop the chat the person is typing in.
const seededConversations = new Map<string, EraConversation>();

async function fetchConversations(): Promise<EraConversation[]> {
  const res = await fetch("/api/era/conversations?limit=20");
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  const list: EraConversation[] = await res.json();
  for (const c of list) seededConversations.delete(c.id);
  return [...seededConversations.values(), ...list];
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
 * The conversation the next sentence joins, or null for a fresh chat — the
 * most recent one active inside 6 hours, unless this session chose (New
 * chat, History, a fresh chat's first sentence). See pickActiveConversation.
 */
export function useActiveEraConversation() {
  const { data, ...rest } = useEraConversations();
  const explicit = useEraStore((s) => s.explicitConversation);
  return {
    ...rest,
    data: pickActiveConversation(data, explicit),
  };
}

// ---------------------------------------------------------------------------
// New chat (HUB-86)
// ---------------------------------------------------------------------------

/**
 * New chat survives a reload: the closed conversation's id is remembered so
 * automatic selection does not bring it back. Per device, best effort — the
 * page works without storage.
 */
const NEW_CHAT_MARKER = "era.newChatFrom";

function readNewChatMarker(): string | null {
  try {
    return window.localStorage.getItem(NEW_CHAT_MARKER);
  } catch {
    return null;
  }
}

function writeNewChatMarker(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(NEW_CHAT_MARKER, id);
    else window.localStorage.removeItem(NEW_CHAT_MARKER);
  } catch {
    /* storage unavailable — New chat still applies to this session */
  }
}

/** Re-applies a New chat from before a reload once the list has loaded. */
export function useRestoreNewChat() {
  const { data } = useEraConversations();
  useEffect(() => {
    if (!data) return;
    const marker = readNewChatMarker();
    if (!marker) return;
    const store = useEraStore.getState();
    if (store.explicitConversation === undefined && data[0]?.id === marker) {
      store.setExplicitConversation(null);
    } else if (data[0]?.id !== marker) {
      writeNewChatMarker(null);
    }
  }, [data]);
}

function cachedMessages(queryClient: QueryClient, conversationId: string) {
  return (
    queryClient.getQueryData<EraMessagesPage>(eraKeys.messages(conversationId))
      ?.messages ?? []
  );
}

function currentConversation(queryClient: QueryClient): EraConversation | null {
  return pickActiveConversation(
    queryClient.getQueryData<EraConversation[]>(eraKeys.conversations()),
    useEraStore.getState().explicitConversation,
  );
}

/**
 * Starts a fresh chat: the next sentence opens a new conversation and "it"
 * points at nothing until something new is created. The previous chat stays
 * in History, untouched.
 */
export function useStartNewEraChat() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    const store = useEraStore.getState();
    const active = currentConversation(queryClient);
    store.resetConversationContext();
    store.setExplicitConversation(null);
    const hasTurns =
      active !== null &&
      cachedMessages(queryClient, active.id).some((m) => m.role !== "system");
    writeNewChatMarker(hasTurns && active ? active.id : null);
  }, [queryClient]);
}

/** Starts a conversation in this tab; the first write creates it server-side. */
function startLocalConversation(
  queryClient: QueryClient,
  face: FaceKey,
): EraConversation {
  const now = new Date().toISOString();
  const conversation: EraConversation = {
    id: crypto.randomUUID(),
    user_id: "local",
    title: null,
    active_face_key: face,
    is_archived: false,
    created_at: now,
    updated_at: now,
    local: true,
  };
  seededConversations.set(conversation.id, conversation);
  queryClient.setQueryData<EraConversation[]>(eraKeys.conversations(), (old) => [
    conversation,
    ...(old ?? []).filter((c) => c.id !== conversation.id),
  ]);
  queryClient.setQueryData<EraMessagesPage>(eraKeys.messages(conversation.id), {
    messages: [],
    nextCursor: null,
  });
  useEraStore.getState().setExplicitConversation(conversation.id);
  writeNewChatMarker(null);
  return conversation;
}

/**
 * Where a turn's rows go: the active conversation, or — in a fresh chat — a
 * new one named here. `ensure` asks the first write to create it.
 */
export function eraConversationTarget(
  queryClient: QueryClient,
  face: FaceKey,
): { id: string; ensure: boolean } {
  const active = currentConversation(queryClient);
  if (active) return { id: active.id, ensure: Boolean(active.local) };
  return { id: startLocalConversation(queryClient, face).id, ensure: true };
}

// ---------------------------------------------------------------------------
// History (HUB-52)
// ---------------------------------------------------------------------------

async function fetchHistory(): Promise<EraConversationSummary[]> {
  const res = await fetch("/api/era/conversations?history=1&limit=50");
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

export function useEraConversationHistory(enabled: boolean) {
  return useQuery({
    queryKey: eraKeys.history(),
    queryFn: fetchHistory,
    enabled,
    staleTime: CACHE_TIMES.TRANSACTIONS, // 2 min — refreshed on every open after that
    refetchOnWindowFocus: false,
  });
}

async function patchConversation(
  id: string,
  body: { action: "resume" } | { action: "archive"; archived: boolean },
): Promise<EraConversation> {
  const res = await safeFetch(`/api/era/conversations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

/** Continue a past chat: it becomes the active one, with a clean context. */
export function useResumeEraConversation() {
  const queryClient = useQueryClient();
  return useMutation<EraConversation, Error, EraConversationSummary, { previous: string | null | undefined }>({
    mutationFn: (summary) => patchConversation(summary.id, { action: "resume" }),
    onMutate: (summary) => {
      const store = useEraStore.getState();
      const previous = store.explicitConversation;
      const now = new Date().toISOString();
      queryClient.setQueryData<EraConversation[]>(eraKeys.conversations(), (old) => {
        const existing = old?.find((c) => c.id === summary.id);
        const row: EraConversation = existing
          ? { ...existing, updated_at: now }
          : {
              id: summary.id,
              user_id: "",
              title: null,
              active_face_key: summary.active_face_key,
              is_archived: false,
              created_at: summary.created_at,
              updated_at: now,
            };
        return [row, ...(old ?? []).filter((c) => c.id !== summary.id)];
      });
      store.resetConversationContext();
      store.setExplicitConversation(summary.id);
      writeNewChatMarker(null);
      return { previous };
    },
    onSuccess: (row) => {
      queryClient.setQueryData<EraConversation[]>(eraKeys.conversations(), (old) => [
        row,
        ...(old ?? []).filter((c) => c.id !== row.id),
      ]);
      queryClient.invalidateQueries({ queryKey: eraKeys.history() });
    },
    onError: (_error, _summary, context) => {
      useEraStore.getState().setExplicitConversation(context?.previous);
      queryClient.invalidateQueries({ queryKey: eraKeys.conversations() });
      toast.error("Couldn't open that chat");
    },
  });
}

/** Hide a chat from History (messages kept). Undo restores it. */
export function useArchiveEraConversation() {
  const queryClient = useQueryClient();

  const restore = useCallback(
    async (id: string) => {
      try {
        await patchConversation(id, { action: "archive", archived: false });
        toast.success("Restored", { icon: ToastIcons.success });
      } catch {
        toast.error("Couldn't restore");
      }
      queryClient.invalidateQueries({ queryKey: eraKeys.history() });
      queryClient.invalidateQueries({ queryKey: eraKeys.conversations() });
    },
    [queryClient],
  );

  return useMutation<EraConversation, Error, EraConversationSummary>({
    mutationFn: (summary) =>
      patchConversation(summary.id, { action: "archive", archived: true }),
    onSuccess: (_row, summary) => {
      const store = useEraStore.getState();
      if (currentConversation(queryClient)?.id === summary.id) {
        store.resetConversationContext();
        store.setExplicitConversation(null);
      }
      queryClient.setQueryData<EraConversationSummary[]>(eraKeys.history(), (old) =>
        (old ?? []).filter((c) => c.id !== summary.id),
      );
      queryClient.setQueryData<EraConversation[]>(eraKeys.conversations(), (old) =>
        (old ?? []).filter((c) => c.id !== summary.id),
      );
      toast.success("Archived", {
        icon: ToastIcons.success,
        duration: 4000,
        action: { label: "Undo", onClick: () => void restore(summary.id) },
      });
    },
    onError: () => {
      toast.error("Couldn't archive");
    },
  });
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
  intent_kind?: EraMessageKind | null;
  intent_face?: FaceKey | null;
  intent_payload?: Record<string, unknown> | null;
  draft_transaction_id?: string | null;
  /** HUB-86 — the conversation was started in this tab; create it first. */
  ensure_conversation?: boolean;
}

export interface CreateEraMessageResult {
  message: EraMessage;
  conversation_id: string;
}

export type EraMessagesPage = {
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
      if (input.ensure_conversation && input.conversation_id)
        payload.ensure_conversation = true;

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

      // A conversation started in this tab now exists server-side.
      const seeded = seededConversations.get(result.conversation_id);
      if (seeded?.local) {
        seededConversations.set(result.conversation_id, { ...seeded, local: false });
        queryClient.setQueryData<EraConversation[]>(eraKeys.conversations(), (old) =>
          (old ?? []).map((c) =>
            c.id === result.conversation_id ? { ...c, local: false } : c,
          ),
        );
      }

      // updated_at changed, so the active conversation ordering may change.
      queryClient.invalidateQueries({ queryKey: eraKeys.conversations() });
      queryClient.invalidateQueries({ queryKey: eraKeys.history() });
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
