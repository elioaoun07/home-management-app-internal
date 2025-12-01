// src/features/accounts/hooks.ts
"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import type { Account, AccountType } from "@/types/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// --- Query ---
async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch("/api/accounts");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as Account[];
}

// Fetch only current user's accounts (not partner's)
async function fetchOwnAccounts(): Promise<Account[]> {
  const res = await fetch("/api/accounts?own=true");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as Account[];
}

// Fetch accounts including hidden ones (for edit mode)
async function fetchOwnAccountsWithHidden(): Promise<Account[]> {
  const res = await fetch("/api/accounts?own=true&includeHidden=true");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as Account[];
}

/**
 * OPTIMIZED: Accounts with smart caching (includes partner's accounts for dashboard)
 * - 1 hour staleTime (accounts rarely change)
 * - No refetch on mount
 */
export function useAccounts() {
  return useQuery({
    queryKey: qk.accounts(), // shared key
    queryFn: fetchAccounts,
    staleTime: CACHE_TIMES.ACCOUNTS, // 1 hour - accounts rarely change
    refetchOnMount: false, // Don't refetch on mount
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch only the current user's own accounts (for add transaction forms)
 * Use this when user should only see their own accounts, not partner's
 */
export function useMyAccounts() {
  return useQuery({
    queryKey: [...qk.accounts(), "own"], // separate key from useAccounts
    queryFn: fetchOwnAccounts,
    staleTime: CACHE_TIMES.ACCOUNTS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch accounts including hidden ones (for edit mode in wiggle)
 */
export function useMyAccountsWithHidden() {
  return useQuery({
    queryKey: [...qk.accounts(), "own", "withHidden"],
    queryFn: fetchOwnAccountsWithHidden,
    staleTime: CACHE_TIMES.ACCOUNTS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

// --- Mutations ---
type CreateAccountInput = {
  name: string;
  type: AccountType;
  country_code?: string;
  location_name?: string;
  with_default_categories?: boolean;
};

async function createAccount(input: CreateAccountInput): Promise<Account> {
  const res = await fetch("/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let msg = "Failed to create account";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as Account;
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation<
    Account,
    Error,
    CreateAccountInput,
    { previous?: Account[]; previousOwn?: Account[]; tempId: string }
  >({
    mutationFn: createAccount,
    onMutate: async ({ name, type, country_code, location_name }) => {
      // Cancel all account queries
      await qc.cancelQueries({ queryKey: qk.accounts() });

      const previous = qc.getQueryData<Account[]>(qk.accounts());
      const previousOwn = qc.getQueryData<Account[]>([...qk.accounts(), "own"]);

      const tempId = `temp-${Date.now()}`;
      const optimistic: Account = {
        id: tempId,
        user_id: "",
        name: name.trim(),
        type,
        inserted_at: new Date().toISOString(),
        country_code,
        location_name,
      };

      // Update both caches optimistically
      qc.setQueryData<Account[]>(qk.accounts(), (old = []) => [
        optimistic,
        ...old,
      ]);
      qc.setQueryData<Account[]>([...qk.accounts(), "own"], (old = []) => [
        optimistic,
        ...old,
      ]);

      return { previous, previousOwn, tempId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.accounts(), ctx.previous);
      if (ctx?.previousOwn)
        qc.setQueryData([...qk.accounts(), "own"], ctx.previousOwn);
    },
    onSuccess: (created, _vars, ctx) => {
      // Update both caches with the real account
      qc.setQueryData<Account[]>(qk.accounts(), (old = []) => [
        created,
        ...old.filter((a) => a.id !== ctx?.tempId),
      ]);
      qc.setQueryData<Account[]>([...qk.accounts(), "own"], (old = []) => [
        created,
        ...old.filter((a) => a.id !== ctx?.tempId),
      ]);
    },
    onSettled: () => {
      // Invalidate both queries
      qc.invalidateQueries({ queryKey: qk.accounts(), refetchType: "active" });
    },
  });
}

// Set default account mutation
async function setDefaultAccount(accountId: string): Promise<void> {
  const res = await fetch(`/api/accounts/${accountId}/default`, {
    method: "PATCH",
  });
  if (!res.ok) {
    let msg = "Failed to set default account";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
}

export function useSetDefaultAccount() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: setDefaultAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts() });
    },
  });
}

// Delete account mutation
async function deleteAccount(accountId: string): Promise<void> {
  const res = await fetch(`/api/accounts/${accountId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    let msg = "Failed to delete account";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    string,
    {
      previous?: Account[];
      previousOwn?: Account[];
      previousWithHidden?: Account[];
    }
  >({
    mutationFn: deleteAccount,
    onMutate: async (accountId) => {
      await qc.cancelQueries({ queryKey: qk.accounts() });

      const previous = qc.getQueryData<Account[]>(qk.accounts());
      const previousOwn = qc.getQueryData<Account[]>([...qk.accounts(), "own"]);
      const previousWithHidden = qc.getQueryData<Account[]>([
        ...qk.accounts(),
        "own",
        "withHidden",
      ]);

      // Optimistically remove from visible caches (soft-delete sets visible=false)
      qc.setQueryData<Account[]>(qk.accounts(), (old = []) =>
        old.filter((a) => a.id !== accountId)
      );
      qc.setQueryData<Account[]>([...qk.accounts(), "own"], (old = []) =>
        old.filter((a) => a.id !== accountId)
      );
      // Update withHidden to mark as hidden
      qc.setQueryData<Account[]>(
        [...qk.accounts(), "own", "withHidden"],
        (old = []) =>
          old.map((a) => (a.id === accountId ? { ...a, visible: false } : a))
      );

      return { previous, previousOwn, previousWithHidden };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.accounts(), ctx.previous);
      if (ctx?.previousOwn)
        qc.setQueryData([...qk.accounts(), "own"], ctx.previousOwn);
      if (ctx?.previousWithHidden)
        qc.setQueryData(
          [...qk.accounts(), "own", "withHidden"],
          ctx.previousWithHidden
        );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.accounts(), refetchType: "active" });
    },
  });
}

// Unhide account mutation
async function unhideAccount(accountId: string): Promise<void> {
  const res = await fetch(`/api/accounts/${accountId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visible: true }),
  });
  if (!res.ok) {
    let msg = "Failed to unhide account";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
}

export function useUnhideAccount() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: unhideAccount,
    onSuccess: () => {
      // Invalidate all account queries to refresh
      qc.invalidateQueries({ queryKey: qk.accounts() });
    },
  });
}

// Reorder accounts mutation
async function reorderAccounts(
  updates: Array<{ id: string; position: number }>
): Promise<void> {
  const res = await fetch("/api/accounts/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) {
    let msg = "Failed to reorder accounts";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
}

export function useReorderAccounts() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    Array<{ id: string; position: number }>,
    { previous?: Account[]; previousOwn?: Account[] }
  >({
    mutationFn: reorderAccounts,
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: qk.accounts() });

      const previous = qc.getQueryData<Account[]>(qk.accounts());
      const previousOwn = qc.getQueryData<Account[]>([...qk.accounts(), "own"]);

      // Create position map
      const positionMap = new Map(updates.map((u) => [u.id, u.position]));

      // Optimistically update positions in both caches
      const updatePositions = (accounts: Account[]): Account[] => {
        return accounts
          .map((a) => ({
            ...a,
            position: positionMap.has(a.id)
              ? positionMap.get(a.id)!
              : ((a as any).position ?? 0),
          }))
          .sort(
            (a, b) => ((a as any).position ?? 0) - ((b as any).position ?? 0)
          );
      };

      qc.setQueryData<Account[]>(qk.accounts(), (old = []) =>
        updatePositions(old)
      );
      qc.setQueryData<Account[]>([...qk.accounts(), "own"], (old = []) =>
        updatePositions(old)
      );

      return { previous, previousOwn };
    },
    onError: (_err, _updates, ctx) => {
      // Revert to previous state on error
      if (ctx?.previous) qc.setQueryData(qk.accounts(), ctx.previous);
      if (ctx?.previousOwn)
        qc.setQueryData([...qk.accounts(), "own"], ctx.previousOwn);
      // Only refetch on error to ensure we have correct server state
      qc.invalidateQueries({ queryKey: qk.accounts(), refetchType: "active" });
    },
    // No onSettled - we trust the optimistic update on success
  });
}
