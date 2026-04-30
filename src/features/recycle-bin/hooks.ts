// src/features/recycle-bin/hooks.ts
"use client";

import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const recycleBinKeys = {
  all: ["recycle-bin"] as const,
  list: (
    moduleId: string,
    params: {
      q?: string;
      filters?: Record<string, unknown>;
      deletedFrom?: string;
      deletedTo?: string;
      ownOnly?: boolean;
      page?: number;
    },
  ) => ["recycle-bin", "list", moduleId, params] as const,
  counts: (ownOnly: boolean) => ["recycle-bin", "counts", { ownOnly }] as const,
};

export interface RecycleBinListItem {
  moduleId: string;
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  deletedAt: string;
  raw: Record<string, unknown>;
}

export interface RecycleBinListResponse {
  rows: RecycleBinListItem[];
  total: number;
  hasMore: boolean;
}

function buildListUrl(
  moduleId: string,
  params: {
    q?: string;
    filters?: Record<string, unknown>;
    deletedFrom?: string;
    deletedTo?: string;
    ownOnly?: boolean;
    page?: number;
  },
) {
  const sp = new URLSearchParams();
  sp.set("module", moduleId);
  if (params.q) sp.set("q", params.q);
  if (params.deletedFrom) sp.set("deletedFrom", params.deletedFrom);
  if (params.deletedTo) sp.set("deletedTo", params.deletedTo);
  if (params.ownOnly) sp.set("ownOnly", "true");
  if (params.page) sp.set("page", String(params.page));
  if (params.filters && Object.keys(params.filters).length > 0) {
    sp.set("filters", JSON.stringify(params.filters));
  }
  return `/api/recycle-bin?${sp.toString()}`;
}

export function useRecycleBinList(
  moduleId: string,
  params: {
    q?: string;
    filters?: Record<string, unknown>;
    deletedFrom?: string;
    deletedTo?: string;
    ownOnly?: boolean;
    page?: number;
  },
) {
  return useQuery<RecycleBinListResponse>({
    queryKey: recycleBinKeys.list(moduleId, params),
    queryFn: async () => {
      const res = await fetch(buildListUrl(moduleId, params));
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useRecycleBinCounts(ownOnly: boolean) {
  return useQuery<{ counts: Record<string, number> }>({
    queryKey: recycleBinKeys.counts(ownOnly),
    queryFn: async () => {
      const res = await fetch(
        `/api/recycle-bin/counts${ownOnly ? "?ownOnly=true" : ""}`,
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

function invalidateAfterChange(
  queryClient: ReturnType<typeof useQueryClient>,
  moduleId: string,
) {
  queryClient.invalidateQueries({ queryKey: recycleBinKeys.all });
  // Best-effort: invalidate a known shape-key for the affected module so the
  // module's main UI refreshes. Modules use varied keys; broad invalidation
  // by string prefix is safest here.
  queryClient.invalidateQueries({ queryKey: [moduleId] });
  // Also invalidate common shared keys
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: ["account-balance"] });
  queryClient.invalidateQueries({ queryKey: ["analytics"] });
  queryClient.invalidateQueries({ queryKey: ["items"] });
}

export function useRestore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { module: string; id: string }) => {
      const res = await safeFetch("/api/recycle-bin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_data, vars) => {
      invalidateAfterChange(queryClient, vars.module);
      toast.success("Restored", {
        icon: ToastIcons.success,
        duration: 4000,
      });
    },
    onError: () => {
      toast.error("Failed to restore", { icon: ToastIcons.error });
    },
  });
}

export function usePurge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { module: string; id: string }) => {
      const sp = new URLSearchParams({
        module: vars.module,
        id: vars.id,
      });
      const res = await safeFetch(`/api/recycle-bin?${sp.toString()}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_data, vars) => {
      invalidateAfterChange(queryClient, vars.module);
      toast.success("Permanently deleted", {
        icon: ToastIcons.delete,
        duration: 4000,
      });
    },
    onError: () => {
      toast.error("Failed to delete", { icon: ToastIcons.error });
    },
  });
}

export function useEmptyBin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { module?: string; ownOnly?: boolean }) => {
      const res = await safeFetch("/api/recycle-bin/empty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data, vars) => {
      invalidateAfterChange(queryClient, vars.module ?? "");
      toast.success(`Bin emptied (${data?.deleted ?? 0})`, {
        icon: ToastIcons.delete,
        duration: 4000,
      });
    },
    onError: () => {
      toast.error("Failed to empty bin", { icon: ToastIcons.error });
    },
  });
}
