"use client";

import { safeFetch } from "@/lib/safeFetch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Memory, MemoryInsert } from "./types";

export const memoriesKeys = {
  all: ["memories"] as const,
  list: () => [...memoriesKeys.all, "list"] as const,
  search: (q: string) => [...memoriesKeys.all, "search", q] as const,
};

async function fetchMemories(q?: string): Promise<Memory[]> {
  const url = q ? `/api/memories?q=${encodeURIComponent(q)}&limit=10` : "/api/memories?limit=20";
  const res = await safeFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function useMemories(q?: string) {
  return useQuery({
    queryKey: q ? memoriesKeys.search(q) : memoriesKeys.list(),
    queryFn: () => fetchMemories(q),
    staleTime: 1000 * 60 * 30,
  });
}

export function useCreateMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: MemoryInsert): Promise<Memory> => {
      const res = await safeFetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status, body });
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memoriesKeys.all });
    },
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await safeFetch(`/api/memories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memoriesKeys.all });
    },
  });
}
