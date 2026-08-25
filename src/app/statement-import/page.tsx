"use client";

// /statement-import — the statement audit workbench.
//
// The flow: pick the account → upload the PDF/CSV → every row is matched
// against transactions already logged (the posting lag is handled by the
// matcher, not the user) → only unmatched rows need a category → save.
//
// Mobile shape (this is a phone-first screen — a statement gets imported on the
// couch, not at a desk):
//   • the review list is a flat list of MERCHANTS, one tap target each, showing
//     only merchant, money, and whether a category is set;
//   • tapping one opens GroupSheet, where a category grid takes one tap and
//     closes the sheet — two taps per merchant, which is the whole loop;
//   • everything rare (per-row category, date fix, skip) hides inside that
//     sheet instead of crowding the list.
//
// Work is saved to IndexedDB after every change, so navigating away, creating a
// category, or reloading no longer destroys the session.

import { GroupSheet } from "@/components/statement-import/GroupSheet";
import { ImportHistory } from "@/components/statement-import/ImportHistory";
import { MatchedRowCard } from "@/components/statement-import/MatchedRowCard";
import { OtherAccountSheet } from "@/components/statement-import/OtherAccountSheet";
import { ReviewGroupCard } from "@/components/statement-import/ReviewGroupCard";
import { ReviewStepper } from "@/components/statement-import/ReviewStepper";
import { ScrollableTabs } from "@/components/statement-import/ScrollableTabs";
import { TransferRowCard } from "@/components/statement-import/TransferRowCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHouseholdAccounts, useMyAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import {
  useCommitStatement,
  useParseStatement,
  useReconcileStatement,
} from "@/features/statement-import/hooks";
import {
  actionLane,
  bucketCounts,
  buildCommitActions,
  convertAtRate,
  buildReviewGroups,
  countOpen,
  countUndecided,
  describeCommitAction,
  getBucket,
  pickAccount,
  resolveRowAccount,
  resolveRowCategory,
  skippedGroupCounts,
  skipReason,
  stagedNetAmount,
  undecidedRows,
  type ActionLane,
  type SkipGroup,
} from "@/features/statement-import/sessionModel";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { useHouseholdPartner } from "@/hooks/useHouseholdPartner";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getCurrencySymbol } from "@/lib/currency";
import { getErrorMessage } from "@/lib/errors";
import { qk } from "@/lib/queryKeys";
import {
  deleteSession,
  listSessions,
  saveSession,
  type GroupCategory,
  type RowDecision,
  type StatementSession,
} from "@/lib/statementImportSession";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type { ParsedTransaction } from "@/types/statement";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  EyeOff,
  Layers,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Phase = "upload" | "working" | "review" | "receipt";
// "imported" (fingerprint already in the ledger — machine certain) is split
// from "matched" (the matcher thinks this is one of your manual logs — a
// judgement call). See the Bucket doc comment in sessionModel.ts.
// Five of these are buckets (a partition of every row); "ready" is a
// CROSS-CUTTING view of what Save will write, so a staged row appears both in
// its own tab and here. That is the point: deciding a row stages it, it does
// not file it away somewhere new.
type BucketFilter =
  | "review"
  | "transfers"
  | "ready"
  | "imported"
  | "matched"
  | "skipped";

interface Receipt {
  created: number;
  stamped: number;
  drafts_confirmed: number;
  rekeyed: number;
  skips_recorded: number;
  skips_removed: number;
  skipped: number;
  errors: number;
  mappings_saved: number;
}

const DAY_MS = 86_400_000;

function shiftIso(iso: string, days: number): string {
  const shifted = new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * One date if every row in the group shares it, otherwise the earliest and
 * latest as a range. A merchant group can legitimately span weeks (a
 * multi-month import groups "Monthly Charges" together, since grouping is by
 * merchant, not by date), so a single date would misrepresent the group.
 */
function groupDateLabel(rows: Array<{ date: string }>): string {
  const dates = rows.map((r) => r.date).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first === last ? shortDate(first) : `${shortDate(first)} – ${shortDate(last)}`;
}

export default function StatementImportPage() {
  const router = useRouter();
  const tc = useThemeClasses();
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useMyAccounts();
  const parseStatement = useParseStatement();
  const reconcile = useReconcileStatement();
  const commit = useCommitStatement();

  const [phase, setPhase] = useState<Phase>("upload");
  const [accountId, setAccountId] = useState("");
  const [session, setSession] = useState<StatementSession | null>(null);
  const [resumable, setResumable] = useState<StatementSession[]>([]);
  const [filter, setFilter] = useState<BucketFilter>("review");
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [stepperOpen, setStepperOpen] = useState(false);
  // Review holds three unrelated jobs; stacking them made one long scroll.
  type ReviewSection = "categorize" | "other" | "maybe";
  const [reviewSection, setReviewSection] = useState<ReviewSection>("categorize");
  // Transfers holds two unrelated jobs too — people and cash need different
  // controls (a partner/category decision vs. a wallet/spent one).
  type TransfersSection = "people" | "cash" | "exchange";
  const [transfersSection, setTransfersSection] =
    useState<TransfersSection>("people");
  // Skipped holds three unrelated populations (see skipReason in
  // sessionModel.ts): what I set aside now, what an earlier import remembered,
  // and own-account moves the matcher re-derives every run. One flat list put a
  // 3-row decision inside 85 rows of noise.
  const [skipSection, setSkipSection] = useState<SkipGroup>("session");
  const [openOtherRowId, setOpenOtherRowId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // Transient on purpose: a currency hint is only trustworthy at the moment we
  // read the file, so it is never persisted into the session (a stale hint kept
  // warning about a mismatch that wasn't real).
  const [currencyWarning, setCurrencyWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const account = useMemo(
    () => accounts.find((a: { id: string }) => a.id === accountId),
    [accounts, accountId],
  );

  const { data: categories = [] } = useCategories(accountId);

  // The destination of a household transfer must be the PARTNER's account —
  // the transfers API rejects anything else — so the picker only offers those.
  //
  // `useHouseholdAccounts()`, NOT `useAccounts()`: the latter exposes only the
  // partner's `is_public` accounts, so a partner who keeps their accounts
  // private produced an EMPTY dropdown with no error anywhere. A household
  // transfer is exactly the case that is allowed to name a private partner
  // account (BUD-13), and `TransferDialog` — the working precedent — sources
  // it the same way. Identify the partner explicitly rather than by
  // subtracting the owner's list, so an account missing from `useMyAccounts`
  // (hidden, say) can never be mistaken for the partner's.
  const { data: allHouseholdAccounts = [] } = useHouseholdAccounts();
  const { data: householdData } = useHouseholdMembers();
  // Name resolved server-side from auth metadata — `profiles` (what
  // useHouseholdMembers reads) can be empty and degrade every name to an
  // email prefix. Falls back to the members list if the endpoint is unreachable.
  const { data: resolvedPartner } = useHouseholdPartner(
    householdData?.currentUserId ?? undefined,
  );
  const partner =
    resolvedPartner ?? householdData?.members.find((m) => !m.isCurrentUser);
  const partnerAccounts = useMemo(
    () =>
      allHouseholdAccounts
        .filter(
          (a) => !!partner && a.user_id === partner.id && a.visible !== false,
        )
        // Both members name their accounts the same way ("Debit Card - NEO",
        // "Salary", "Wallet" exist on both sides), so a bare account name in
        // this picker is genuinely ambiguous — it reads as the owner's own.
        .map((a) => ({
          id: a.id,
          name: partner ? `${a.name} · ${partner.displayName}` : a.name,
        })),
    [allHouseholdAccounts, partner],
  );

  // Where a cash withdrawal can land: the owner's OWN accounts, minus the one
  // the statement belongs to (money cannot move to where it came from).
  const ownDestinations = useMemo(
    () =>
      accounts
        .filter((a: { id: string }) => a.id !== accountId)
        // Currency is part of the identity here: an FX exchange row has to land
        // in the account that is actually in the target currency, and several
        // own accounts share a name shape ("Trip - Italy", "Trip - Greece").
        .map((a: { id: string; name: string; currency?: string }) => ({
          id: a.id,
          name: a.currency ? `${a.name} · ${a.currency}` : a.name,
        })),
    [accounts, accountId],
  );

  /**
   * Any account id this page can be asked to name — own, partner's, or one a
   * cross-account flag points at. Partner accounts carry the partner's name
   * because both members use the same account names.
   */
  const accountNameById = useCallback(
    (id: string) => {
      const own = accounts.find((a: { id: string }) => a.id === id);
      if (own) return own.name;
      const shared = allHouseholdAccounts.find((a) => a.id === id);
      if (shared) {
        return partner && shared.user_id === partner.id
          ? `${shared.name} · ${partner.displayName}`
          : shared.name;
      }
      return session?.account_names?.[id] ?? "Account";
    },
    [accounts, allHouseholdAccounts, partner, session],
  );

  // Hard Rule #14 — colour follows the PERSON, not the viewer. My theme picks
  // my colour; the partner always gets the other one.
  const { theme } = useTheme();
  const partnerText = theme === "pink" ? "text-blue-400" : "text-pink-400";
  const partnerRing =
    theme === "pink" ? "border-blue-500/40" : "border-pink-500/40";

  const accountRefs = useMemo(
    () =>
      accounts.map(
        (a: {
          id: string;
          type: string;
          is_default?: boolean;
          currency?: string;
        }) => ({
          id: a.id,
          type: a.type as "expense" | "income" | "saving",
          is_default: a.is_default,
          currency: a.currency,
        }),
      ),
    [accounts],
  );

  const accountCurrencyById = useCallback(
    (id: string) =>
      accounts.find((a: { id: string }) => a.id === id)?.currency as
        | string
        | undefined,
    [accounts],
  );

  // No default account, deliberately. This picker chooses where a whole
  // statement's money lands, and pre-filling it meant the choice could be made
  // by not noticing: the dropdown already read "Wallet", Upload was already
  // enabled, and the account was never shown again for the rest of the review.
  // A bulk money write should not have a silently pre-selected target.

  useEffect(() => {
    listSessions().then(setResumable);
  }, []);

  // The category lists are cached for an hour and persisted across reloads;
  // refresh once per account so a category made elsewhere is present here.
  useEffect(() => {
    if (!accountId) return;
    queryClient.invalidateQueries({
      queryKey: qk.categories(accountId),
      refetchType: "all",
    });
  }, [accountId, queryClient]);

  const persist = useCallback((next: StatementSession) => {
    setSession(next);
    void saveSession(next);
  }, []);

  const updateDecision = useCallback(
    (rowId: string, patch: Partial<RowDecision>) => {
      setSession((current) => {
        if (!current) return current;
        const existing = current.decisions[rowId] ?? { resolution: "undecided" as const };
        const merged: RowDecision = { ...existing, ...patch };

        // `undefined` means "clear my override and follow the group again".
        if (patch.category_id === undefined && "category_id" in patch) {
          delete merged.category_id;
          delete merged.subcategory_id;
        }
        if (patch.category_id !== undefined && merged.resolution === "undecided") {
          merged.resolution = "create";
        }

        // Skipping withdraws a Restore. Kept here rather than at each call
        // site because every skip button in this screen means the same thing,
        // and a stale `restored: true` would keep emitting an `unskip` action
        // for a row the owner has just set aside again.
        if (patch.resolution === "skip") merged.restored = false;

        const next = {
          ...current,
          decisions: { ...current.decisions, [rowId]: merged },
        };
        void saveSession(next);
        return next;
      });
    },
    [],
  );

  const updateGroupCategory = useCallback(
    (groupKey: string, value: GroupCategory) => {
      setSession((current) => {
        if (!current) return current;
        const next = {
          ...current,
          group_categories: { ...current.group_categories, [groupKey]: value },
        };
        void saveSession(next);
        return next;
      });
    },
    [],
  );

  /**
   * Set every row still in Review aside in one go.
   *
   * The Undo restores the exact prior decisions rather than clearing them
   * (Hard Rule #1): some of those rows may have carried a category or a rename
   * the owner had already chosen, and a blanket reset would throw that away.
   */
  const skipAllInReview = useCallback(() => {
    setSession((current) => {
      if (!current) return current;
      const targets = current.rows.filter(
        (row) =>
          getBucket(current.classifications[row.id], current.decisions[row.id]) ===
          "review",
      );
      if (targets.length === 0) return current;

      const before = { ...current.decisions };
      const decisions = { ...current.decisions };
      for (const row of targets) {
        decisions[row.id] = {
          ...(decisions[row.id] ?? { resolution: "undecided" as const }),
          resolution: "skip",
        };
      }
      const next = { ...current, decisions };
      void saveSession(next);

      toast.success(`${targets.length} row(s) skipped`, {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => {
            setSession((latest) => {
              if (!latest) return latest;
              const restored = { ...latest, decisions: before };
              void saveSession(restored);
              return restored;
            });
          },
        },
      });

      return next;
    });
  }, []);

  const runImport = async (file: File) => {
    if (!accountId || !account) {
      toast.error("Pick an account first", { icon: ToastIcons.error });
      return;
    }

    setPhase("working");
    try {
      const parsed = await parseStatement.mutateAsync({ file, accountId });

      const rows = parsed.transactions;
      const reconciled = await reconcile.mutateAsync({
        account_id: accountId,
        statement_id: parsed.statement_id,
        rows: rows.map((r: ParsedTransaction) => ({
          id: r.id,
          date: r.date,
          description: r.description,
          amount: r.amount,
          type: r.type,
          statement_hash: r.statement_hash ?? "",
        })),
      });

      const classifications = Object.fromEntries(
        reconciled.results.map(({ row_id, ...rest }) => [row_id, rest]),
      );

      const next: StatementSession = {
        id: parsed.statement_id,
        file_name: file.name,
        account_id: accountId,
        account_name: account.name,
        account_currency: parsed.account_currency,
        created_at: Date.now(),
        updated_at: Date.now(),
        rows,
        classifications,
        decisions: {},
        group_categories: {},
        account_names: reconciled.account_names,
      };

      setCurrencyWarning(
        parsed.currency_mismatch ? parsed.statement_currency : null,
      );
      persist(next);
      setPhase("review");
      setFilter(reconciled.summary.unmatched > 0 ? "review" : "matched");

      // Informational, not a mutation — nothing has been written yet, so there
      // is nothing to undo (Hard Rule 1 applies to mutation toasts).
      const { matched, already_imported, other_account, unmatched } =
        reconciled.summary;
      toast.info(`${matched} already logged · ${unmatched} to review`, {
        icon: ToastIcons.success,
        description:
          [
            already_imported > 0 ? `${already_imported} imported before` : null,
            other_account > 0 ? `${other_account} in another account` : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
      });
    } catch (error) {
      setPhase("upload");
      toast.error(getErrorMessage(error, "Could not read that statement"), {
        icon: ToastIcons.error,
      });
    }
  };

  const resume = async (saved: StatementSession) => {
    setSession(saved);
    setAccountId(saved.account_id);
    setPhase("review");
  };

  const discard = async (id: string) => {
    const removed = resumable.find((s) => s.id === id) ?? session;
    await deleteSession(id);
    setResumable(await listSessions());
    if (session?.id === id) {
      setSession(null);
      setPhase("upload");
    }
    toast.success("Review discarded", {
      icon: ToastIcons.delete,
      duration: 4000,
      action: removed
        ? {
            label: "Undo",
            onClick: async () => {
              await saveSession(removed);
              setResumable(await listSessions());
            },
          }
        : undefined,
    });
  };

  const doCommit = async () => {
    if (!session) return;
    const actions = buildCommitActions(session, accountRefs);
    if (actions.length === 0) {
      toast.error("Nothing to save yet", { icon: ToastIcons.error });
      return;
    }

    try {
      const result = await commit.mutateAsync({
        statement_id: session.id,
        file_name: session.file_name,
        account_id: session.account_id,
        actions,
      });

      setReceipt(result);
      setPhase("receipt");
      await deleteSession(session.id);
      setResumable(await listSessions());

      // No success toast: the receipt screen below IS the confirmation, and a
      // toast here could only offer an Undo that doesn't exist — reversing a
      // commit means un-creating rows, un-stamping matches and re-drafting
      // confirmations (that lives in Import history as a full revert).
      // Errors still surface, since the receipt only counts them.
      if (result.errors > 0) {
        toast.error(`${result.errors} row(s) could not be saved`, {
          icon: ToastIcons.error,
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save"), {
        icon: ToastIcons.error,
      });
    }
  };

  const counts = session
    ? bucketCounts(session)
    : { matched: 0, imported: 0, review: 0, transfers: 0, skipped: 0 };
  const undecided = session ? countUndecided(session) : 0;
  // Review-scoped `undecided` still drives the stepper and progress bar; the
  // Save button and resume banner need the wider "review OR transfers, still
  // no action" count so they stay honest now that transfers live outside the
  // review bucket.
  const openCount = useMemo(() => (session ? countOpen(session) : 0), [session]);
  const stepperQueue = useMemo(
    () => (session ? undecidedRows(session) : []),
    [session],
  );
  const currency = session?.account_currency ?? account?.currency ?? "USD";

  // Categories are ACCOUNT-SCOPED, and a row does not always land in the
  // statement's account: `suggestAccountForRow` redirects a money-OUT row off
  // an income/saving statement to the default expense account, and money IN
  // from a person off an expense statement to the income one. So the picker
  // for such a row lists a DIFFERENT account's categories — and a map built
  // only from the statement's account could not name the category that came
  // back. The chip fell back to "Choose category" and the owner's pick looked
  // like it had been thrown away the instant they made it.
  //
  // Hence one map spanning every account this screen can target. `useCategories`
  // no-ops on undefined, so nothing extra is fetched when the statement account
  // already is the suggested one.
  const incomeAccountId = useMemo(
    () => pickAccount(accountRefs, "income") ?? accountId,
    [accountRefs, accountId],
  );
  const expenseAccountId = useMemo(
    () => pickAccount(accountRefs, "expense") ?? accountId,
    [accountRefs, accountId],
  );
  const { data: incomeCategories = [] } = useCategories(
    incomeAccountId !== accountId ? incomeAccountId : undefined,
  );
  const { data: expenseCategories = [] } = useCategories(
    expenseAccountId !== accountId ? expenseAccountId : undefined,
  );

  const categoryById = useMemo(() => {
    const map = new Map<string, { name: string; color: string; slug?: string | null }>();
    // Statement account LAST so its own names win any id collision.
    for (const list of [expenseCategories, incomeCategories, categories]) {
      for (const c of list) {
        map.set(c.id, {
          name: c.name,
          color: c.color || tc.defaultAccentColor,
          slug: c.slug,
        });
      }
    }
    return map;
  }, [categories, incomeCategories, expenseCategories, tc.defaultAccentColor]);

  const categoryOf = useCallback(
    (id: string | null | undefined) => (id ? (categoryById.get(id) ?? null) : null),
    [categoryById],
  );

  // Rows the matcher half-matched and the user has not ruled on yet. They are
  // shown as match cards, never as "categorize me" rows: categorizing one
  // creates a second transaction for money that is already logged. Answering
  // "not a match" sets resolution:"create", which drops the row into the
  // merchant groups below — the old screen left it stuck on the match card.
  const matchDecisionRows = useMemo(() => {
    if (!session) return [];
    return session.rows.filter((row) => {
      const classification = session.classifications[row.id];
      if (!classification) return false;
      if (
        classification.status !== "probable" &&
        classification.status !== "ambiguous"
      ) {
        return false;
      }
      const decision = session.decisions[row.id];
      if (getBucket(classification, decision) !== "review") return false;
      return decision?.resolution !== "create";
    });
  }, [session]);

  // Rows whose twin already exists under a DIFFERENT account. Hoisted out of
  // the merchant list for the same reason probable matches are: categorizing
  // one silently creates a second copy of money that is already recorded.
  const otherAccountRows = useMemo(() => {
    if (!session) return [];
    return session.rows.filter((row) => {
      const classification = session.classifications[row.id];
      if (classification?.status !== "other_account") return false;
      const decision = session.decisions[row.id];
      if (getBucket(classification, decision) !== "review") return false;
      return decision?.resolution !== "create";
    });
  }, [session]);

  // EVERY person-to-person transfer still waiting on a decision — partner or
  // not, sent or received. getBucket() routes every one of these (and nothing
  // else) to the "transfers" bucket, so this list and the tab count agree by
  // construction; Review no longer double-counts them.
  //
  // Gating this on the household name match was wrong: the tab is called
  // "Transfers", so a transfer belongs in it regardless of who the counterparty
  // is — and tying VISIBILITY to a name match meant a missed match hid the row
  // in the merchant list instead of merely costing a tap. The match only
  // pre-selects the household path on the card.
  const transferPeopleRows = useMemo(() => {
    if (!session) return [];
    return session.rows.filter((row) => {
      const c = session.classifications[row.id];
      if (c?.status !== "person_transfer") return false;
      return getBucket(c, session.decisions[row.id]) === "transfers";
    });
  }, [session]);

  // ATM / voucher cash withdrawals still waiting on "to wallet" vs "spent".
  const transferCashRows = useMemo(() => {
    if (!session) return [];
    return session.rows.filter((row) => {
      const c = session.classifications[row.id];
      if (!c?.withdrawal) return false;
      return getBucket(c, session.decisions[row.id]) === "transfers";
    });
  }, [session]);

  // Own-account currency exchanges still waiting on a destination account.
  // Only the OUT leg is here — the identical bank line appears on the other
  // account's statement too, and recording both would write the movement twice
  // (getBucket / RowClassification.exchange).
  const transferExchangeRows = useMemo(() => {
    if (!session) return [];
    return session.rows.filter((row) => {
      const c = session.classifications[row.id];
      if (!c?.exchange) return false;
      return getBucket(c, session.decisions[row.id]) === "transfers";
    });
  }, [session]);

  // Merchant groups, each carrying the state the list needs to render: total,
  // whether every row has a category, and how many rows opted out of the
  // group's choice.
  const reviewGroups = useMemo(() => {
    if (!session) return [];
    // Transfers and withdrawals are excluded from the review bucket itself
    // now (getBucket), so buildReviewGroups never sees them — only the
    // probable-match and other-account rows still need hoisting out here.
    const pendingMatch = new Set([
      ...matchDecisionRows.map((r) => r.id),
      ...otherAccountRows.map((r) => r.id),
    ]);
    return buildReviewGroups(session)
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => !pendingMatch.has(row.id)),
      }))
      .filter((group) => group.rows.length > 0)
      .map((group) => {
        const resolved = group.rows.map((row) =>
          resolveRowCategory(row, session),
        );
        const missing = resolved.filter((r) => !r.category_id).length;
        const first = resolved.find((r) => r.category_id)?.category_id ?? null;
        // The subcategory is only shown when EVERY row agrees on it — the same
        // rule the parent chip uses. Rows that disagree resolve to nothing,
        // which is the honest answer for a summary card.
        const firstSub = resolved[0]?.subcategory_id ?? null;
        const subAgrees =
          !!firstSub && resolved.every((r) => r.subcategory_id === firstSub);
        return {
          ...group,
          total: group.rows.reduce((sum, r) => sum + r.amount, 0),
          // Append the target account when the rows do NOT land in the
          // statement's own — an auto-suggested redirect is a money decision
          // and must be visible on the card, not only inside the sheet.
          dateLabel: (() => {
            const base = groupDateLabel(group.rows);
            const targets = new Set(
              group.rows.map((r) => resolveRowAccount(r, session, accountRefs)),
            );
            if (targets.size !== 1) return base;
            const [target] = [...targets];
            if (target === session.account_id) return base;
            const name = accounts.find(
              (a: { id: string }) => a.id === target,
            )?.name;
            return name ? `${base} · ${name}` : base;
          })(),
          // Only call a group "set" once every row in it has a category — a
          // half-categorized merchant still owes work.
          category: missing === 0 && first ? categoryOf(first) : null,
          subcategory: missing === 0 && subAgrees ? categoryOf(firstSub) : null,
          overrides: group.rows.filter(
            (row) => session.decisions[row.id]?.category_id !== undefined,
          ).length,
        };
      });
  }, [
    session,
    categoryOf,
    matchDecisionRows,
    otherAccountRows,
    accountRefs,
    accounts,
  ]);

  // Keep the sub-nav on something that exists: answering the last row of a
  // section would otherwise leave an empty pane with no indication why.
  useEffect(() => {
    if (reviewSection === "other" && otherAccountRows.length === 0)
      setReviewSection("categorize");
    if (reviewSection === "maybe" && matchDecisionRows.length === 0)
      setReviewSection("categorize");
  }, [reviewSection, otherAccountRows.length, matchDecisionRows.length]);

  const openOtherRow = useMemo(() => {
    if (!session || !openOtherRowId) return null;
    const row = session.rows.find((r) => r.id === openOtherRowId);
    const classification = session.classifications[openOtherRowId];
    if (!row || classification?.status !== "other_account") return null;
    return {
      row,
      twin: {
        account:
          session.account_names?.[classification.account_id] ??
          accounts.find((a: { id: string }) => a.id === classification.account_id)
            ?.name ??
          "Other account",
        date: classification.date,
        amount: classification.amount,
        description: classification.description,
      },
    };
  }, [session, openOtherRowId, accounts]);

  const openGroup = openGroupKey
    ? (reviewGroups.find((g) => g.key === openGroupKey) ?? null)
    : null;

  // The group can vanish under the sheet (its last row was skipped).
  useEffect(() => {
    if (openGroupKey && !openGroup) setOpenGroupKey(null);
  }, [openGroupKey, openGroup]);

  // Everything Save would write, in plain language. Built from the SAME
  // `buildCommitActions` the commit uses, so the Ready tab can never promise
  // something the commit won't do.
  const stagedActions = useMemo(() => {
    if (!session) return [];
    const rowById = new Map(session.rows.map((r) => [r.id, r]));
    return buildCommitActions(session, accountRefs).map((action) => ({
      action,
      described: describeCommitAction(
        action,
        accountNameById,
        accountCurrencyById,
      ),
      row: rowById.get(action.row_id),
    }));
  }, [session, accountRefs, accountNameById, accountCurrencyById]);

  const saveCount = stagedActions.length;

  // Ready is the last screen before a bulk money write, so it has to separate
  // what moves money from what only stamps a match and what only teaches the
  // next import. Flat, those read as the same kind of thing — which is why
  // "Log" sitting next to "Restore" was unreadable.
  const readyLanes = useMemo(() => {
    const lanes: Record<ActionLane, typeof stagedActions> = {
      money: [],
      match: [],
      memory: [],
    };
    for (const entry of stagedActions) lanes[actionLane(entry.action)].push(entry);
    return lanes;
  }, [stagedActions]);

  const readyNet = useMemo(
    () => stagedNetAmount(stagedActions.map((entry) => entry.action)),
    [stagedActions],
  );

  const READY_LANES: Array<[ActionLane, string]> = [
    ["money", "Money"],
    ["match", "Matches"],
    ["memory", "Memory"],
  ];

  const visibleRows = useMemo(() => {
    if (!session) return [];
    return session.rows.filter(
      (row) =>
        getBucket(session.classifications[row.id], session.decisions[row.id]) ===
        filter,
    );
  }, [session, filter]);

  // Every skipped row with the reason it is here, ready to be split by section.
  const skippedRows = useMemo(() => {
    if (!session) return [];
    const out: Array<{
      row: ParsedTransaction;
      reason: ReturnType<typeof skipReason>;
    }> = [];
    for (const row of session.rows) {
      const classification = session.classifications[row.id];
      const decision = session.decisions[row.id];
      if (getBucket(classification, decision) !== "skipped") continue;
      out.push({
        row,
        reason: skipReason(classification, decision, accountNameById),
      });
    }
    return out;
  }, [session, accountNameById]);

  const skipCounts = useMemo(
    () =>
      session
        ? skippedGroupCounts(session)
        : { session: 0, standing: 0, auto: 0 },
    [session],
  );

  // The three jobs the Transfers tab can hold, in tab order. Sections with no
  // rows are never shown, and `activeTransfersSection` keeps the pane on one
  // that exists — answering the last row of a section used to leave an empty
  // pane with no indication why.
  const TRANSFER_SECTIONS: Array<
    [TransfersSection, string, ParsedTransaction[]]
  > = [
    ["people", "People", transferPeopleRows],
    ["cash", "Cash", transferCashRows],
    ["exchange", "Exchange", transferExchangeRows],
  ];

  const activeTransfersSection: TransfersSection =
    TRANSFER_SECTIONS.find(
      ([value, , rows]) => value === transfersSection && rows.length > 0,
    )?.[0] ??
    TRANSFER_SECTIONS.find(([, , rows]) => rows.length > 0)?.[0] ??
    "people";

  const SKIP_SECTIONS: Array<[SkipGroup, string]> = [
    ["session", "This import"],
    ["standing", "Previously skipped"],
    ["auto", "Own moves"],
  ];

  // Land on a section that has rows — opening Skipped on an empty "This import"
  // is what made the tab read as broken when everything in it was remembered.
  useEffect(() => {
    if (filter !== "skipped") return;
    if (skipCounts[skipSection] > 0) return;
    const fallback = SKIP_SECTIONS.find(([g]) => skipCounts[g] > 0)?.[0];
    if (fallback) setSkipSection(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, skipSection, skipCounts.session, skipCounts.standing, skipCounts.auto]);

  const BUCKET_LABEL: Record<string, string> = {
    review: "Review",
    transfers: "Transfers",
    imported: "Imported",
    matched: "Logged",
    skipped: "Skipped",
  };

  const reviewTotal = counts.review;
  const reviewDone = reviewTotal - undecided;

  return (
    <div className={cn("min-h-screen pt-16 pb-32", tc.bgPage)}>
      {phase === "upload" && (
        <div className="max-w-2xl mx-auto px-4 pt-3 flex flex-col gap-4">
          {resumable.length > 0 && (
            <div className="flex flex-col gap-2">
              {resumable.map((saved) => (
                <div
                  key={saved.id}
                  className={cn(
                    "rounded-2xl px-4 py-3 flex items-center gap-3",
                    tc.sectionCard,
                  )}
                >
                  <RotateCcw className={cn("w-4 h-4 shrink-0", tc.text)} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm truncate", tc.headerText)}>
                      {saved.file_name}
                    </p>
                    <p className={cn("text-xs", tc.textFaint)}>
                      {countOpen(saved)} left · {saved.account_name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => resume(saved)}
                    className={cn(
                      "rounded-xl px-4 h-10 text-xs font-medium shrink-0",
                      tc.buttonPrimary,
                    )}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => discard(saved.id)}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      tc.buttonGhost,
                      tc.textMuted,
                    )}
                    aria-label="Discard saved review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-12 rounded-2xl text-base">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(
                  (a: { id: string; name: string; currency?: string }) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.currency || "USD"}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) runImport(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!accountId}
            className={cn(
              "rounded-2xl border-2 border-dashed py-12 flex flex-col items-center gap-2 disabled:opacity-50",
              tc.dashedBorder,
              tc.dashedBorderHover,
              tc.dashedBgHover,
            )}
          >
            <Upload className={cn("w-7 h-7", tc.text)} />
            <span className={cn("text-base", tc.text)}>Upload statement</span>
            <span className={cn("text-xs", tc.textFaint)}>PDF or CSV</span>
          </button>

          {/* Every save is a record that can be opened and walked back —
              a bulk import you cannot undo is the real hazard here. */}
          <ImportHistory />
        </div>
      )}

      {phase === "working" && (
        <div className="flex flex-col items-center gap-3 py-24">
          <Loader2 className={cn("w-8 h-8 animate-spin", tc.text)} />
          <p className={cn("text-sm", tc.loadingText)}>
            {parseStatement.isPending
              ? "Reading the statement…"
              : "Matching against what you logged…"}
          </p>
        </div>
      )}

      {phase === "review" && session && (
        <>
          {/* Opaque via tc.bgPage, not var(--theme-bg): the CSS variable is
              set by ThemeContext at runtime and does not reliably cover the
              cards scrolling underneath (Hard Rule 15's guidance for panels
              that float over content). */}
          <div className={cn("sticky top-16 z-20", tc.bgPage)}>
            <div className="max-w-2xl mx-auto px-4 pt-2 pb-2.5 flex flex-col gap-2.5">
              {/* The target account was invisible for the whole review — the
                  only place it appeared was the currency-mismatch banner,
                  which usually never fires. Since the fingerprint is keyed to
                  it, changing it means re-parsing, so "Change" restarts rather
                  than pretending to edit in place. */}
              <div className="flex items-center gap-2">
                <p className={cn("text-xs truncate min-w-0 flex-1", tc.textMuted)}>
                  Importing into{" "}
                  <span className={cn("font-medium", tc.headerText)}>
                    {session.account_name}
                  </span>{" "}
                  · {session.account_currency}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Start over and choose a different account?\n\nThe statement fingerprints are built from "${session.account_name}", so the file has to be read again. This review's decisions will be discarded.`,
                      )
                    ) {
                      void discard(session.id);
                    }
                  }}
                  className={cn(
                    "text-[11px] h-8 px-2 rounded-lg shrink-0",
                    tc.textFaint,
                  )}
                >
                  Change
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className={cn("h-1.5 rounded-full flex-1", tc.progressBg)}>
                  <div
                    className={cn("h-full rounded-full transition-all", tc.progressFill)}
                    style={{
                      width: `${reviewTotal === 0 ? 100 : (reviewDone / reviewTotal) * 100}%`,
                    }}
                  />
                </div>
                <span className={cn("text-[11px] shrink-0", tc.textFaint)}>
                  {reviewTotal === 0
                    ? "all matched"
                    : `${reviewDone}/${reviewTotal} done`}
                </span>
              </div>

              {/* The count IS the information here ("Skipped 85"), so the bar
                  scrolls rather than truncating it away. */}
              <ScrollableTabs
                value={filter}
                onChange={setFilter}
                tabs={[
                  { value: "review", label: "Review", count: counts.review },
                  {
                    value: "transfers",
                    label: "Transfers",
                    count: counts.transfers,
                  },
                  { value: "imported", label: "Imported", count: counts.imported },
                  { value: "matched", label: "Logged", count: counts.matched },
                  { value: "skipped", label: "Skipped", count: counts.skipped },
                  // LAST, deliberately. Ready is not another bucket to browse —
                  // it is the final stage, the one screen that says what the
                  // Save button below is about to do. Sitting third it read as
                  // just another filter.
                  { value: "ready", label: "Ready", count: saveCount },
                ]}
              />
            </div>
          </div>

          <div className="max-w-2xl mx-auto px-4 pt-1 flex flex-col gap-2">
            {currencyWarning && (
              <div className="rounded-2xl px-4 py-3 flex items-start gap-2 bg-amber-500/10">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-500">
                  Statement says {currencyWarning}, {session.account_name} is in{" "}
                  {session.account_currency} — amounts save as{" "}
                  {session.account_currency}.
                </p>
              </div>
            )}

            {filter === "review" && (
              <>
                {reviewGroups.length === 0 &&
                  matchDecisionRows.length === 0 &&
                  otherAccountRows.length === 0 && (
                    <EmptyState text="Nothing left to review." />
                  )}

                {(otherAccountRows.length > 0 ||
                  matchDecisionRows.length > 0) && (
                  <ScrollableTabs
                    size="sm"
                    value={reviewSection}
                    onChange={setReviewSection}
                    tabs={(
                      [
                        ["categorize", "Categorize", reviewGroups.length],
                        ["other", "Other account", otherAccountRows.length],
                        ["maybe", "Maybe logged", matchDecisionRows.length],
                      ] as Array<[ReviewSection, string, number]>
                    )
                      .filter(([, , count]) => count > 0)
                      .map(([value, label, count]) => ({
                        value,
                        label,
                        count,
                      }))}
                  />
                )}


                {reviewSection === "other" && otherAccountRows.length > 0 && (
                  <>
                    {otherAccountRows.map((row) => {
                      const classification = session.classifications[row.id];
                      if (classification?.status !== "other_account") return null;
                      const where =
                        session.account_names?.[classification.account_id] ??
                        accounts.find(
                          (a: { id: string }) =>
                            a.id === classification.account_id,
                        )?.name ??
                        "another account";
                      return (
                        <div
                          key={row.id}
                          className={cn(
                            "rounded-2xl px-4 py-3.5 flex flex-col gap-2.5",
                            tc.sectionCard,
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenOtherRowId(row.id)}
                            className="text-left flex flex-col gap-1 active:scale-[0.99] transition-transform"
                          >
                            <div className="flex items-baseline gap-3">
                              <p
                                className={cn(
                                  "text-[15px] font-medium truncate flex-1 min-w-0",
                                  tc.headerText,
                                )}
                              >
                                {row.description}
                              </p>
                              <span
                                className={cn(
                                  "text-sm tabular-nums shrink-0",
                                  tc.text,
                                )}
                              >
                                {getCurrencySymbol(currency)}
                                {row.amount.toFixed(2)}
                              </span>
                            </div>

                            <p className={cn("text-[11px]", tc.textFaint)}>
                              {shortDate(row.date)}
                            </p>

                            <p className={cn("text-xs", tc.textMuted)}>
                              Also in{" "}
                              <span className={cn("font-medium", tc.headerText)}>
                                {where}
                              </span>
                            </p>
                          </button>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateDecision(row.id, { resolution: "skip" })
                              }
                              className={cn(
                                "rounded-xl px-4 h-10 text-xs font-medium flex-1 min-w-[120px]",
                                tc.buttonPrimary,
                              )}
                            >
                              Skip
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateDecision(row.id, { resolution: "create" })
                              }
                              className={cn(
                                "rounded-xl px-4 h-10 text-xs flex-1 min-w-[120px]",
                                tc.buttonOutline,
                              )}
                            >
                              Import
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Offered only past a couple of rows: below that the merchant
                    list is already the shorter path, and a stepper would add a
                    screen to save none. */}
                {reviewSection === "categorize" && undecided > 2 && (
                  <button
                    type="button"
                    onClick={() => setStepperOpen(true)}
                    className={cn(
                      "rounded-2xl h-12 text-sm font-medium flex items-center justify-center gap-2",
                      tc.buttonOutline,
                    )}
                  >
                    <Layers className="w-4 h-4" />
                    Review {undecided} one at a time
                  </button>
                )}

                {/* Bulk escape hatch: a statement can be mostly rows that are
                    not spending at all, and clearing them one at a time is the
                    slowest part of the review. Undo-able, and each skip is
                    remembered by fingerprint so the next upload does not ask
                    again. */}
                {reviewSection === "categorize" && counts.review > 0 && (
                  <button
                    type="button"
                    onClick={skipAllInReview}
                    className={cn(
                      "rounded-2xl h-11 text-xs flex items-center justify-center gap-2",
                      tc.buttonGhost,
                      tc.textMuted,
                    )}
                  >
                    <EyeOff className="w-4 h-4" />
                    Skip all {counts.review}
                  </button>
                )}

                {reviewSection === "maybe" && matchDecisionRows.length > 0 && (
                  <>
                    {matchDecisionRows.map((row) => {
                      const decision = session.decisions[row.id];
                      return (
                        <MatchedRowCard
                          key={row.id}
                          row={row}
                          classification={session.classifications[row.id]!}
                          currency={currency}
                          accepted={false}
                          acceptedAmount={decision?.accept_amount}
                          onAcceptMatch={() =>
                            updateDecision(row.id, {
                              resolution: "accept_match",
                            })
                          }
                          onAcceptBankAmount={() =>
                            updateDecision(row.id, {
                              resolution: "accept_match",
                              accept_amount: row.amount,
                            })
                          }
                          onDetach={() =>
                            updateDecision(row.id, { resolution: "create" })
                          }
                          pickedCandidateId={decision?.linked_transaction_id}
                          onPickCandidate={(transactionId) =>
                            updateDecision(row.id, {
                              resolution: "link",
                              linked_transaction_id: transactionId,
                            })
                          }
                        />
                      );
                    })}
                  </>
                )}

                {reviewSection === "categorize" &&
                  reviewGroups.map((group) => (
                  <ReviewGroupCard
                    key={group.key}
                    label={group.label}
                    rowCount={group.rows.length}
                    total={group.total}
                    currency={currency}
                    category={group.category}
                    subcategory={group.subcategory}
                    overrides={group.overrides}
                    dateLabel={group.dateLabel}
                    onOpen={() => setOpenGroupKey(group.key)}
                  />
                ))}
              </>
            )}

            {filter === "transfers" && (
              <>
                {TRANSFER_SECTIONS.filter(([, , rows]) => rows.length > 0)
                  .length > 1 && (
                  <ScrollableTabs
                    size="sm"
                    value={transfersSection}
                    onChange={setTransfersSection}
                    tabs={TRANSFER_SECTIONS.filter(
                      ([, , rows]) => rows.length > 0,
                    ).map(([value, label, rows]) => ({
                      value,
                      label,
                      count: rows.length,
                    }))}
                  />
                )}

                {transferPeopleRows.length === 0 &&
                  transferCashRows.length === 0 &&
                  transferExchangeRows.length === 0 && (
                    <EmptyState text="No transfers in this statement." />
                  )}

                {activeTransfersSection === "exchange" &&
                  transferExchangeRows.map((row) => {
                    const c = session.classifications[row.id]!;
                    const exchange = c.exchange!;
                    const destinationId = session.decisions[row.id]
                      ?.transfer_to_account_id;
                    const converts =
                      !!destinationId &&
                      accountCurrencyById(destinationId) === exchange.to_currency;
                    return (
                      <TransferRowCard
                        key={row.id}
                        row={row}
                        classification={c}
                        decision={session.decisions[row.id]}
                        currency={currency}
                        kind="exchange"
                        title={`${exchange.from_currency} → ${exchange.to_currency}`}
                        direction="out"
                        statementAccountName={session.account_name}
                        // Every own account except the statement's. The list is
                        // NOT filtered to the target currency: an owner may
                        // deliberately land it elsewhere, and a picker that
                        // silently hides accounts is how a row becomes
                        // un-answerable. The rate simply does not apply to a
                        // mismatched account, and the card says so.
                        destinations={ownDestinations}
                        accountName={accountNameById}
                        spendAccountId={session.account_id}
                        spendAccountName={session.account_name}
                        resolvedCategory={resolveRowCategory(row, session)}
                        categoryOf={categoryOf}
                        conversion={{
                          rate: exchange.rate,
                          fromCurrency: exchange.from_currency,
                          toCurrency: exchange.to_currency,
                          toAmount: converts
                            ? convertAtRate(row.amount, exchange.rate)
                            : null,
                        }}
                        partnerText={partnerText}
                        partnerRing={partnerRing}
                        onRowChange={updateDecision}
                      />
                    );
                  })}

                {activeTransfersSection === "people" &&
                  transferPeopleRows.map((row) => {
                    const c = session.classifications[row.id];
                    if (c?.status !== "person_transfer") return null;
                    return (
                      <TransferRowCard
                        key={row.id}
                        row={row}
                        classification={c}
                        decision={session.decisions[row.id]}
                        currency={currency}
                        kind="person"
                        title={c.counterparty}
                        direction={c.direction}
                        statementAccountName={session.account_name}
                        destinations={partnerAccounts}
                        accountName={accountNameById}
                        spendAccountId={resolveRowAccount(row, session, accountRefs)}
                        spendAccountName={accountNameById(
                          resolveRowAccount(row, session, accountRefs),
                        )}
                        resolvedCategory={resolveRowCategory(row, session)}
                        categoryOf={categoryOf}
                        partnerText={partnerText}
                        partnerRing={partnerRing}
                        onRowChange={updateDecision}
                      />
                    );
                  })}

                {activeTransfersSection === "cash" &&
                  transferCashRows.map((row) => {
                    const c = session.classifications[row.id]!;
                    return (
                      <TransferRowCard
                        key={row.id}
                        row={row}
                        classification={c}
                        decision={session.decisions[row.id]}
                        currency={currency}
                        kind="cash"
                        title={
                          c.withdrawal?.kind === "voucher"
                            ? "Voucher Withdrawal"
                            : "ATM Cash Withdrawal"
                        }
                        direction="out"
                        statementAccountName={session.account_name}
                        destinations={ownDestinations}
                        accountName={accountNameById}
                        // Not the statement's account: a withdrawal off an
                        // income/saving statement is unrepresentable there
                        // (getBalanceDelta can only ADD), so it defaults to the
                        // expense account — and the category grid has to offer
                        // THAT account's categories or the commit rejects the
                        // pair as a category/account mismatch.
                        spendAccountId={resolveRowAccount(row, session, accountRefs)}
                        spendAccountName={accountNameById(
                          resolveRowAccount(row, session, accountRefs),
                        )}
                        resolvedCategory={resolveRowCategory(row, session)}
                        categoryOf={categoryOf}
                        partnerText={partnerText}
                        partnerRing={partnerRing}
                        onRowChange={updateDecision}
                      />
                    );
                  })}
              </>
            )}

            {filter === "ready" && (
              <>
                {stagedActions.length === 0 && (
                  <EmptyState text="Nothing staged yet." />
                )}

                {/* The headline of the final stage: what Save does to the
                    balance, in one signed number, next to how much of the list
                    is bookkeeping that touches nothing. */}
                {stagedActions.length > 0 && (
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-4 flex items-center gap-4",
                      tc.sectionCard,
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-2xl font-semibold tabular-nums",
                          readyNet < 0 ? tc.headerText : "text-emerald-500",
                        )}
                      >
                        {readyNet < 0 ? "−" : "+"}
                        {getCurrencySymbol(currency)}
                        {Math.abs(readyNet).toFixed(2)}
                      </p>
                      <p className={cn("text-[11px]", tc.textFaint)}>
                        {readyLanes.money.length} money ·{" "}
                        {readyLanes.match.length} matches ·{" "}
                        {readyLanes.memory.length} memory
                      </p>
                    </div>
                  </div>
                )}

                {READY_LANES.map(([lane, label]) =>
                  readyLanes[lane].length === 0 ? null : (
                    <div key={lane} className="flex flex-col gap-1.5">
                      <SectionLabel text={label} />
                      {readyLanes[lane].map(({ action, described, row }) => (
                        <div
                          key={`${action.kind}-${action.row_id}`}
                          className={cn(
                            "rounded-2xl px-4 py-3 flex items-center gap-3",
                            tc.sectionCard,
                          )}
                        >
                          <span
                            className={cn(
                              "rounded-full px-2.5 h-6 text-[11px] font-medium flex items-center shrink-0",
                              lane === "money"
                                ? tc.buttonPrimary
                                : cn(tc.buttonOutline, tc.textMuted),
                            )}
                          >
                            {described.verb}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-sm truncate", tc.headerText)}>
                              {described.title}
                            </p>
                            {described.detail && (
                              <p className={cn("text-[11px] truncate", tc.textFaint)}>
                                {described.detail}
                              </p>
                            )}
                          </div>
                          {row && lane === "money" && (
                            <span
                              className={cn(
                                "text-sm tabular-nums shrink-0",
                                tc.textMuted,
                              )}
                            >
                              {getCurrencySymbol(currency)}
                              {row.amount.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ),
                )}
              </>
            )}

            {filter === "imported" && (
              <>
                {visibleRows.length === 0 && (
                  <EmptyState text="Nothing imported before." />
                )}

                {groupRowsByDate(visibleRows).map(([date, dateRows]) => (
                  <div key={date} className="flex flex-col gap-1.5">
                    <SectionLabel text={longDate(date)} />
                    {dateRows.map((row) => (
                      <div
                        key={row.id}
                        className={cn(
                          "rounded-2xl px-4 py-3 flex items-center gap-3",
                          tc.sectionCard,
                        )}
                      >
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <p
                          className={cn(
                            "text-sm truncate min-w-0 flex-1",
                            tc.text,
                          )}
                        >
                          {row.description}
                        </p>
                        <span
                          className={cn(
                            "text-sm tabular-nums shrink-0",
                            tc.textMuted,
                          )}
                        >
                          {getCurrencySymbol(currency)}
                          {row.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}

            {filter === "skipped" && (
              <>
                <ScrollableTabs
                  size="sm"
                  value={skipSection}
                  onChange={setSkipSection}
                  tabs={SKIP_SECTIONS.map(([value, label]) => ({
                    value,
                    label,
                    count: skipCounts[value],
                  }))}
                />

                {skippedRows.filter((e) => e.reason.group === skipSection)
                  .length === 0 && <EmptyState text="Nothing here." />}

                {skippedRows
                  .filter((entry) => entry.reason.group === skipSection)
                  .map(({ row, reason }) => (
                    <div
                      key={row.id}
                      className={cn(
                        "rounded-2xl px-4 py-3 flex items-center gap-3",
                        tc.sectionCard,
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm truncate", tc.headerText)}>
                          {row.description}
                        </p>
                        {/* Amount, date, and WHY it is here — the tab could
                            not answer the last one at all before. */}
                        <p className={cn("text-xs truncate", tc.textFaint)}>
                          {getCurrencySymbol(currency)}
                          {row.amount.toFixed(2)} · {shortDate(row.date)} ·{" "}
                          {reason.label}
                        </p>
                      </div>
                      {reason.restorable && (
                        <button
                          type="button"
                          onClick={() => {
                            const classification =
                              session.classifications[row.id];
                            // Where the row actually lands — the same real
                            // classification getBucket routes on, computed
                            // BEFORE the decision changes so the toast names
                            // it correctly.
                            const destination = getBucket(classification, {
                              resolution: "undecided",
                              restored: true,
                            });
                            updateDecision(row.id, {
                              resolution: "undecided",
                              restored: true,
                            });
                            toast.success(
                              `Restored to ${BUCKET_LABEL[destination]}`,
                              {
                                icon: ToastIcons.success,
                                duration: 4000,
                                action: {
                                  label: "Undo",
                                  onClick: () =>
                                    updateDecision(row.id, {
                                      resolution: "skip",
                                    }),
                                },
                              },
                            );
                          }}
                          className={cn(
                            "rounded-xl px-4 h-10 text-xs shrink-0",
                            tc.buttonOutline,
                          )}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  ))}
              </>
            )}

            {filter === "matched" && (
              <>
                {visibleRows.length === 0 && <EmptyState text="Nothing here." />}

                {visibleRows.map((row) => {
                  const classification = session.classifications[row.id];
                  if (!classification) return null;
                  const decision = session.decisions[row.id];

                  return (
                    <MatchedRowCard
                      key={row.id}
                      row={row}
                      classification={classification}
                      currency={currency}
                      accepted
                      acceptedAmount={decision?.accept_amount}
                      onAcceptMatch={() =>
                        updateDecision(row.id, { resolution: "accept_match" })
                      }
                      onAcceptBankAmount={() =>
                        updateDecision(row.id, {
                          resolution: "accept_match",
                          accept_amount: row.amount,
                        })
                      }
                      onDetach={() =>
                        updateDecision(row.id, { resolution: "create" })
                      }
                      pickedCandidateId={decision?.linked_transaction_id}
                      onPickCandidate={(transactionId) =>
                        updateDecision(row.id, {
                          resolution: "link",
                          linked_transaction_id: transactionId,
                        })
                      }
                    />
                  );
                })}
              </>
            )}
          </div>
        </>
      )}

      {phase === "receipt" && receipt && (
        <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check className="w-7 h-7 text-emerald-500" />
            </span>
            <h2 className={cn("text-lg font-semibold", tc.headerText)}>
              Statement reconciled
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat value={receipt.created} label="created" />
            <Stat value={receipt.stamped} label="matched" />
            <Stat value={receipt.drafts_confirmed} label="drafts" />
          </div>

          {/* Only shown when it happened — on a healthy statement it is 0 and
              the extra tile would be noise. */}
          {receipt.rekeyed > 0 && (
            <p className={cn("text-xs text-center", tc.textFaint)}>
              {receipt.rekeyed} re-fingerprinted
            </p>
          )}

          {receipt.errors > 0 && (
            <p className="text-xs text-amber-500 text-center">
              {receipt.errors} row(s) failed — re-upload to retry them
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSession(null);
                setReceipt(null);
                setPhase("upload");
              }}
              className={cn("rounded-xl px-4 h-12 flex-1 text-sm", tc.buttonOutline)}
            >
              Import another
            </button>
            <button
              type="button"
              onClick={() => router.push("/expense")}
              className={cn(
                "rounded-xl px-4 h-12 flex-1 text-sm font-medium",
                tc.buttonPrimary,
              )}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {openGroup && session && (
        <GroupSheet
          open={!!openGroup}
          onOpenChange={(next) => !next && setOpenGroupKey(null)}
          label={openGroup.label}
          rows={openGroup.rows}
          accountId={session.account_id}
          accounts={accounts}
          resolveAccount={(row) => resolveRowAccount(row, session, accountRefs)}
          currency={currency}
          groupCategory={session.group_categories[openGroup.key]}
          decisions={session.decisions}
          resolveCategory={(row) => resolveRowCategory(row, session)}
          onGroupCategoryChange={(next) =>
            updateGroupCategory(openGroup.key, next)
          }
          onRowChange={updateDecision}
          onShiftGroupDates={(days) => {
            openGroup.rows.forEach((row) => {
              const current = session.decisions[row.id]?.date || row.date;
              updateDecision(row.id, { date: shiftIso(current, days) });
            });
          }}
        />
      )}

      {phase === "review" && session && openOtherRow && (
        <OtherAccountSheet
          open={!!openOtherRow}
          onOpenChange={(next) => !next && setOpenOtherRowId(null)}
          row={openOtherRow.row}
          twin={openOtherRow.twin}
          currency={currency}
          onSkip={() =>
            updateDecision(openOtherRow.row.id, { resolution: "skip" })
          }
          onImport={() =>
            updateDecision(openOtherRow.row.id, { resolution: "create" })
          }
        />
      )}

      {phase === "review" && session && (
        <ReviewStepper
          open={stepperOpen}
          onOpenChange={setStepperOpen}
          rows={stepperQueue}
          accountId={session.account_id}
          currency={currency}
          decisions={session.decisions}
          resolveCategory={(row) => resolveRowCategory(row, session)}
          onRowChange={updateDecision}
        />
      )}

      {phase === "review" && session && (
        <div
          className={cn(
            "fixed bottom-0 inset-x-0 z-30 border-t px-4 pt-3",
            tc.border,
            tc.bgPage,
          )}
          style={{
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => discard(session.id)}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                tc.buttonGhost,
                tc.textMuted,
              )}
              aria-label="Discard this review"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={doCommit}
              disabled={commit.isPending || saveCount === 0}
              className={cn(
                "rounded-xl h-12 flex-1 text-sm font-medium disabled:opacity-50",
                tc.buttonPrimary,
              )}
            >
              {commit.isPending
                ? "Saving…"
                : openCount > 0
                  ? `Save ${saveCount} · ${openCount} left`
                  : `Save ${saveCount} rows`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Newest date first; rows inside a date keep their statement order. */
function groupRowsByDate(
  rows: ParsedTransaction[],
): Array<[string, ParsedTransaction[]]> {
  const byDate = new Map<string, ParsedTransaction[]>();
  for (const row of rows) {
    const bucket = byDate.get(row.date);
    if (bucket) bucket.push(row);
    else byDate.set(row.date, [row]);
  }
  return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function longDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function SectionLabel({ text }: { text: string }) {
  const tc = useThemeClasses();
  return (
    <p className={cn("text-[11px] uppercase tracking-wider px-1 pt-2", tc.textFaint)}>
      {text}
    </p>
  );
}

function EmptyState({ text }: { text: string }) {
  const tc = useThemeClasses();
  return <p className={cn("text-sm py-12 text-center", tc.textFaint)}>{text}</p>;
}

function Stat({ value, label }: { value: number; label: string }) {
  const tc = useThemeClasses();
  return (
    <div
      className={cn(
        "rounded-2xl py-4 flex flex-col items-center gap-0.5",
        tc.sectionCard,
      )}
    >
      <span className={cn("text-2xl font-semibold tabular-nums", tc.headerText)}>
        {value}
      </span>
      <span className={cn("text-[11px]", tc.textFaint)}>{label}</span>
    </div>
  );
}
