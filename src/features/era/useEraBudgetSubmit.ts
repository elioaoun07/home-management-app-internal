"use client";

// src/features/era/useEraBudgetSubmit.ts
// Junction-module hook: wires ERA's command bar to the Budget standalone.
//
// Phase 0.1 — natural language only (parseSpeechExpense). Phase 2 will add
// AI fallback for low-confidence parses.
//
// Picks the user's default account (or first expense account), runs the
// existing NLP parser used by the mic, and POSTs to /api/drafts so the
// resulting transaction shows up in the existing Drafts review screen.

import { useMyAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import type { ParsedExpense } from "@/lib/nlp/speechExpense";
import { parseSpeechExpense } from "@/lib/nlp/speechExpense";
import { qk } from "@/lib/queryKeys";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

export type EraBudgetSubmitResult =
  | {
      ok: true;
      draftId: string;
      parsed: ParsedExpense;
      accountId: string;
    }
  | {
      ok: false;
      reason: "no-account" | "no-amount" | "request-failed" | "offline";
      message: string;
    };

/**
 * Pick the account ERA should use for budget drafts. Preference:
 * 1. The user's flagged default account
 * 2. The first visible expense account
 * 3. The first visible account of any kind
 */
function pickDefaultAccount(
  accounts: Array<{ id: string; type?: string; is_default?: boolean }>,
): string | null {
  if (!accounts.length) return null;
  const flagged = accounts.find((a) => a.is_default);
  if (flagged) return flagged.id;
  const expense = accounts.find((a) => a.type === "expense");
  return (expense ?? accounts[0]).id;
}

export function useEraBudgetSubmit() {
  const queryClient = useQueryClient();

  // Use OWN accounts — we never want to draft a transaction on the partner's
  // account from ERA. The user can switch accounts later in the draft review.
  const { data: accounts } = useMyAccounts();

  const accountId = useMemo(
    () => (accounts ? pickDefaultAccount(accounts) : null),
    [accounts],
  );

  const { data: categories } = useCategories(accountId ?? undefined);

  const submit = useCallback(
    async (sentence: string): Promise<EraBudgetSubmitResult> => {
      if (!accountId) {
        return {
          ok: false,
          reason: "no-account",
          message: "No account available to draft a transaction.",
        };
      }

      const parsed = parseSpeechExpense(sentence, categories ?? []);

      if (!parsed.amount || parsed.amount <= 0) {
        return {
          ok: false,
          reason: "no-amount",
          message: 'I couldn\'t find an amount. Try "I paid $25 for car fuel".',
        };
      }

      try {
        const res = await safeFetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: accountId,
            amount: parsed.amount,
            category_id: parsed.categoryId || null,
            subcategory_id: parsed.subcategoryId || null,
            description: sentence,
            voice_transcript: sentence,
            confidence_score: parsed.confidenceScore || null,
            date: parsed.date || new Date().toISOString().split("T")[0],
          }),
        });

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Failed to save draft" }));
          return {
            ok: false,
            reason: "request-failed",
            message: err.error || "Failed to save draft",
          };
        }

        const data = (await res.json()) as { draft: { id: string } };

        // Cache invalidation — mirror the mic flow (VoiceEntryButton).
        queryClient.invalidateQueries({ queryKey: qk.drafts() });
        queryClient.invalidateQueries({ queryKey: ["account-balance"] });

        // Hard Rule #1 — every toast must have Undo.
        toast.success("Draft saved", {
          icon: ToastIcons.success,
          duration: 4000,
          description: parsed.categoryName
            ? `${parsed.amount.toFixed(2)} · ${parsed.categoryName}${
                parsed.subcategoryName ? ` / ${parsed.subcategoryName}` : ""
              }`
            : `${parsed.amount.toFixed(2)}`,
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await safeFetch(`/api/drafts/${data.draft.id}`, {
                  method: "DELETE",
                });
                queryClient.invalidateQueries({ queryKey: qk.drafts() });
                queryClient.invalidateQueries({
                  queryKey: ["account-balance"],
                });
                toast.success("Draft removed");
              } catch {
                toast.error("Couldn't undo — open Drafts to remove it.");
              }
            },
          },
        });

        return {
          ok: true,
          draftId: data.draft.id,
          parsed,
          accountId,
        };
      } catch (err) {
        return {
          ok: false,
          reason: "offline",
          message:
            err instanceof Error
              ? err.message
              : "Network error — try again when online.",
        };
      }
    },
    [accountId, categories, queryClient],
  );

  return {
    submit,
    /** True once accounts + categories have loaded enough to draft. */
    ready: Boolean(accountId),
    accountId,
  };
}
