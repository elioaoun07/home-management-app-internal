// src/features/accounts/hooks.ts
"use client";

import { qk } from "@/lib/queryKeys";
import type { Account, AccountType } from "@/types/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// --- Query ---
async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch("/api/accounts", { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as Account[];
}

export function useAccounts() {
  return useQuery({
    queryKey: qk.accounts(), // shared key
    queryFn: fetchAccounts,
  });
}

// --- Mutations ---
type CreateAccountInput = { name: string; type: AccountType };

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
    { previous?: Account[]; tempId: string }
  >({
    mutationFn: createAccount,
    onMutate: async ({ name, type }) => {
      await qc.cancelQueries({ queryKey: qk.accounts() });
      const previous = qc.getQueryData<Account[]>(qk.accounts());

      const tempId = `temp-${Date.now()}`;
      const optimistic: Account = {
        id: tempId,
        user_id: "",
        name: name.trim(),
        type,
        inserted_at: new Date().toISOString(),
      };

      qc.setQueryData<Account[]>(qk.accounts(), (old = []) => [
        optimistic,
        ...old,
      ]);

      return { previous, tempId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.accounts(), ctx.previous);
    },
    onSuccess: (created, _vars, ctx) => {
      qc.setQueryData<Account[]>(qk.accounts(), (old = []) => [
        created,
        ...old.filter((a) => a.id !== ctx?.tempId),
      ]);
    },
    onSettled: () => {
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
