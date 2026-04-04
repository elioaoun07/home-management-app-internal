"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { safeFetch } from "@/lib/safeFetch";
import type {
  CreateChecklistItemInput,
  CreateNfcTagInput,
  NfcDbChecklistItem,
  NfcStateLog,
  NfcTag,
  NfcTapResult,
  UpdateChecklistItemInput,
  UpdateNfcTagInput,
} from "@/types/nfc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ============================================
// QUERIES
// ============================================

async function fetchNfcTags(): Promise<NfcTag[]> {
  const res = await fetch("/api/nfc");
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

async function fetchNfcTag(slug: string): Promise<NfcTag> {
  const res = await fetch(`/api/nfc/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

async function fetchNfcHistory(
  slug: string,
  limit = 50,
): Promise<NfcStateLog[]> {
  const res = await fetch(
    `/api/nfc/${encodeURIComponent(slug)}/history?limit=${limit}`,
  );
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

/** List all NFC tags for the current user */
export function useNfcTags() {
  return useQuery({
    queryKey: qk.nfcTags(),
    queryFn: fetchNfcTags,
    staleTime: CACHE_TIMES.NFC,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/** Get a single NFC tag by slug */
export function useNfcTag(slug: string) {
  return useQuery({
    queryKey: qk.nfcTag(slug),
    queryFn: () => fetchNfcTag(slug),
    staleTime: CACHE_TIMES.NFC,
    enabled: !!slug,
  });
}

/** Get state change history for an NFC tag */
export function useNfcHistory(slug: string, limit = 50) {
  return useQuery({
    queryKey: qk.nfcHistory(slug),
    queryFn: () => fetchNfcHistory(slug, limit),
    staleTime: CACHE_TIMES.TRANSACTIONS, // 2 min — history changes on each tap
    enabled: !!slug,
  });
}

/** Items connected to an NFC tag via prerequisites, grouped by target_state */
export type NfcTagItemsResult = Record<
  string,
  Array<{
    id: string;
    title: string;
    type: string;
    priority: string;
    status: string;
    user_id: string;
    responsible_user_id: string | null;
  }>
>;

async function fetchNfcTagItems(slug: string): Promise<NfcTagItemsResult> {
  const res = await fetch(`/api/nfc/${encodeURIComponent(slug)}/items`);
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

/** Get items linked to an NFC tag via prerequisites */
export function useNfcTagItems(slug: string) {
  return useQuery({
    queryKey: qk.nfcTagItems(slug),
    queryFn: () => fetchNfcTagItems(slug),
    staleTime: CACHE_TIMES.TRANSACTIONS,
    enabled: !!slug,
  });
}

// ============================================
// MUTATIONS
// ============================================

/** Tap an NFC tag — flip state and evaluate prerequisites */
export function useNfcTap(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetState?: string): Promise<NfcTapResult> => {
      const res = await safeFetch(`/api/nfc/${encodeURIComponent(slug)}/tap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetState ? { target_state: targetState } : {}),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.nfcTag(slug) });
      queryClient.invalidateQueries({ queryKey: qk.nfcHistory(slug) });
      queryClient.invalidateQueries({ queryKey: qk.nfcTags() });
    },
  });
}

/** Create a new NFC tag */
export function useCreateNfcTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNfcTagInput): Promise<NfcTag> => {
      const res = await safeFetch("/api/nfc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.nfcTags() });
    },
  });
}

/** Update an NFC tag */
export function useUpdateNfcTag(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateNfcTagInput): Promise<NfcTag> => {
      const res = await safeFetch(`/api/nfc/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.nfcTag(slug) });
      queryClient.invalidateQueries({ queryKey: qk.nfcTags() });
    },
  });
}

/** Delete an NFC tag */
export function useDeleteNfcTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slug: string): Promise<void> => {
      const res = await safeFetch(`/api/nfc/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.nfcTags() });
    },
  });
}

// ============================================
// CHECKLIST ITEMS (DB-backed)
// ============================================

async function fetchChecklistItems(
  slug: string,
): Promise<NfcDbChecklistItem[]> {
  const res = await fetch(`/api/nfc/${encodeURIComponent(slug)}/checklist`);
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return res.json();
}

/** Get all checklist items for a tag (all states) */
export function useNfcChecklist(slug: string) {
  return useQuery({
    queryKey: qk.nfcChecklist(slug),
    queryFn: () => fetchChecklistItems(slug),
    staleTime: CACHE_TIMES.NFC,
    enabled: !!slug,
  });
}

/** Add a checklist item to a tag */
export function useAddChecklistItem(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: CreateChecklistItemInput,
    ): Promise<NfcDbChecklistItem> => {
      const res = await safeFetch(
        `/api/nfc/${encodeURIComponent(slug)}/checklist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.nfcChecklist(slug) });
    },
  });
}

/** Update a checklist item */
export function useUpdateChecklistItem(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: UpdateChecklistItemInput & { id: string },
    ): Promise<NfcDbChecklistItem> => {
      const res = await safeFetch(
        `/api/nfc/${encodeURIComponent(slug)}/checklist`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.nfcChecklist(slug) });
    },
  });
}

/** Delete a checklist item */
export function useDeleteChecklistItem(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string): Promise<void> => {
      const res = await safeFetch(
        `/api/nfc/${encodeURIComponent(slug)}/checklist?itemId=${itemId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.nfcChecklist(slug) });
    },
  });
}

/** Toggle checklist item completion for a tap session */
export function useToggleChecklistCompletion(slug: string) {
  return useMutation({
    mutationFn: async (input: {
      checklist_item_id: string;
      state_log_id: string;
      completed: boolean;
    }): Promise<{ completed: boolean }> => {
      const res = await safeFetch(
        `/api/nfc/${encodeURIComponent(slug)}/checklist/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      return res.json();
    },
  });
}
