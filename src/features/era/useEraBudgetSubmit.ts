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
import type { UICategory } from "@/features/categories/useCategoriesQuery";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { extractAmount } from "@/lib/nlp/amount";
import type { ParsedExpense } from "@/lib/nlp/speechExpense";
import { parseSpeechExpense } from "@/lib/nlp/speechExpense";
import { qk } from "@/lib/queryKeys";
import { RequestTimeoutError, safeFetch } from "@/lib/safeFetch";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

export type EraBudgetSubmitResult =
  | {
      ok: true;
      draftId: string;
      parsed: ParsedExpense;
      accountId: string;
      currency: string;
    }
  | {
      ok: false;
      reason:
        | "no-account"
        | "no-currency-account"
        | "currency-unclear"
        | "no-amount"
        | "request-failed"
        | "offline"
        | "uncertain";
      message: string;
    };

/**
 * HUB-75 — amounts are native-currency (`500k lbp` = 500000 LBP), and an
 * account's balance is kept in its own currency, so a marked amount may only
 * land on an account in that currency. No conversion is ever inferred: with
 * no matching account the capture fails honestly instead of drafting 500000
 * on a USD account. An unmarked `k` amount on a non-LBP default asks for the
 * currency rather than guessing.
 */
export function pickDraftAccount(
  accounts: DraftAccount[],
  sentence: string,
):
  | { ok: true; accountId: string }
  | { ok: false; reason: "no-account" | "no-currency-account" | "currency-unclear"; currency?: string } {
  // A bare `k` amount ("taxi 250k") must be seen here too, or it would fall
  // through to the USD default as 250,000 dollars (HUB-78 Gym gate).
  const bare = extractAmount(sentence, { allowBare: true });
  const found = extractAmount(sentence) ?? (bare?.kShorthand ? bare : undefined);
  if (found?.currency) {
    const inCurrency = accounts.filter((a) => (a.currency ?? "USD") === found.currency);
    const id = pickDefaultAccount(inCurrency);
    return id
      ? { ok: true, accountId: id }
      : { ok: false, reason: "no-currency-account", currency: found.currency };
  }
  const id = pickDefaultAccount(accounts);
  if (!id) return { ok: false, reason: "no-account" };
  if (found?.kShorthand) {
    const acct = accounts.find((a) => a.id === id);
    if ((acct?.currency ?? "USD") !== "LBP") return { ok: false, reason: "currency-unclear" };
  }
  return { ok: true, accountId: id };
}

/**
 * Pick the account ERA should use for budget drafts. Preference:
 * 1. The user's flagged default account
 * 2. The first visible expense account
 * 3. The first visible account of any kind
 */
type DraftAccount = { id: string; type?: string; is_default?: boolean; currency?: string };

function pickDefaultAccount(accounts: DraftAccount[]): string | null {
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
      if (!accountId || !accounts) {
        return {
          ok: false,
          reason: "no-account",
          message: "No account available to draft a transaction.",
        };
      }

      const target = pickDraftAccount(accounts, sentence);
      if (!target.ok) {
        return {
          ok: false,
          reason: target.reason,
          message:
            target.reason === "no-currency-account"
              ? `No ${target.currency} account.`
              : target.reason === "currency-unclear"
                ? "Which currency?"
                : "No account available to draft a transaction.",
        };
      }
      const draftAccountId = target.accountId;

      // Categories are per-account. A currency-routed draft on another
      // account uses that account's cached categories, or none — never the
      // default account's category IDs.
      const draftCategories =
        draftAccountId === accountId
          ? (categories ?? [])
          : (queryClient.getQueryData<UICategory[]>(qk.categories(draftAccountId)) ?? []);
      const parsed = parseSpeechExpense(sentence, draftCategories);

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
            account_id: draftAccountId,
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

        // HUB-78 — the receipt (Undo + Change) is shown by useEraTurn, which
        // owns the handoff message id the Change button opens.

        return {
          ok: true,
          draftId: data.draft.id,
          parsed,
          accountId: draftAccountId,
          currency: accounts.find((a) => a.id === draftAccountId)?.currency ?? "USD",
        };
      } catch (err) {
        // HUB-37 — a timeout AFTER the request left may have created the
        // draft: "uncertain", never retried. Only a refusal before sending
        // is "offline" (the caller keeps the text for a retry).
        if (err instanceof RequestTimeoutError) {
          return { ok: false, reason: "uncertain", message: "Not sure it saved. Check Drafts." };
        }
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
    [accountId, accounts, categories, queryClient],
  );

  return {
    submit,
    /** True once accounts + categories have loaded enough to draft. */
    ready: Boolean(accountId),
    accountId,
  };
}
