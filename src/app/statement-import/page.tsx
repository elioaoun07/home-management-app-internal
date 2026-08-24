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
import { ReviewGroupCard } from "@/components/statement-import/ReviewGroupCard";
import { ReviewStepper } from "@/components/statement-import/ReviewStepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import {
  useCommitStatement,
  useParseStatement,
  useReconcileStatement,
} from "@/features/statement-import/hooks";
import {
  bucketCounts,
  buildCommitActions,
  buildReviewGroups,
  countUndecided,
  getBucket,
  resolveRowCategory,
  undecidedRows,
} from "@/features/statement-import/sessionModel";
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
type BucketFilter = "review" | "imported" | "matched" | "skipped";

interface Receipt {
  created: number;
  stamped: number;
  drafts_confirmed: number;
  skipped: number;
  errors: number;
  mappings_saved: number;
}

const DAY_MS = 86_400_000;

function shiftIso(iso: string, days: number): string {
  const shifted = new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
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

  // Default to the user's default account once accounts load.
  useEffect(() => {
    if (accountId || accounts.length === 0) return;
    const preferred =
      accounts.find((a: { is_default?: boolean }) => a.is_default) ?? accounts[0];
    setAccountId(preferred.id);
  }, [accounts, accountId]);

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
      };

      setCurrencyWarning(
        parsed.currency_mismatch ? parsed.statement_currency : null,
      );
      persist(next);
      setPhase("review");
      setFilter(reconciled.summary.unmatched > 0 ? "review" : "matched");

      // Informational, not a mutation — nothing has been written yet, so there
      // is nothing to undo (Hard Rule 1 applies to mutation toasts).
      const { matched, already_imported, unmatched } = reconciled.summary;
      toast.info(`${matched} already logged · ${unmatched} to review`, {
        icon: ToastIcons.success,
        description:
          already_imported > 0
            ? `${already_imported} imported before`
            : undefined,
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
    const actions = buildCommitActions(session);
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
    : { matched: 0, imported: 0, review: 0, skipped: 0 };
  const undecided = session ? countUndecided(session) : 0;
  const stepperQueue = useMemo(
    () => (session ? undecidedRows(session) : []),
    [session],
  );
  const currency = session?.account_currency ?? account?.currency ?? "USD";

  const categoryById = useMemo(() => {
    const map = new Map<string, { name: string; color: string; slug?: string | null }>();
    for (const c of categories) {
      map.set(c.id, {
        name: c.name,
        color: c.color || tc.defaultAccentColor,
        slug: c.slug,
      });
    }
    return map;
  }, [categories, tc.defaultAccentColor]);

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

  // Merchant groups, each carrying the state the list needs to render: total,
  // whether every row has a category, and how many rows opted out of the
  // group's choice.
  const reviewGroups = useMemo(() => {
    if (!session) return [];
    const pendingMatch = new Set(matchDecisionRows.map((r) => r.id));
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
        return {
          ...group,
          total: group.rows.reduce((sum, r) => sum + r.amount, 0),
          // Only call a group "set" once every row in it has a category — a
          // half-categorized merchant still owes work.
          category:
            missing === 0 && first ? (categoryById.get(first) ?? null) : null,
          overrides: group.rows.filter(
            (row) => session.decisions[row.id]?.category_id !== undefined,
          ).length,
        };
      });
  }, [session, categoryById, matchDecisionRows]);

  const openGroup = openGroupKey
    ? (reviewGroups.find((g) => g.key === openGroupKey) ?? null)
    : null;

  // The group can vanish under the sheet (its last row was skipped).
  useEffect(() => {
    if (openGroupKey && !openGroup) setOpenGroupKey(null);
  }, [openGroupKey, openGroup]);

  const saveCount = useMemo(
    () => (session ? buildCommitActions(session).length : 0),
    [session],
  );

  const visibleRows = useMemo(() => {
    if (!session) return [];
    return session.rows.filter(
      (row) =>
        getBucket(session.classifications[row.id], session.decisions[row.id]) ===
        filter,
    );
  }, [session, filter]);

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
                      {countUndecided(saved)} left · {saved.account_name}
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
            <span className={cn("text-xs", tc.textFaint)}>
              PDF or CSV · rows you already logged are matched for you
            </span>
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

              {/* Four tabs on a phone means short labels — the count carries
                  the meaning, so each label is one word and never wraps. */}
              <div className={cn("flex gap-1 p-1 rounded-xl", tc.pillBg)}>
                {(
                  [
                    ["review", "Review", counts.review],
                    ["imported", "Imported", counts.imported],
                    ["matched", "Logged", counts.matched],
                    ["skipped", "Skipped", counts.skipped],
                  ] as Array<[BucketFilter, string, number]>
                ).map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={cn(
                      "flex-1 rounded-lg h-9 text-[11px] font-medium px-1 truncate",
                      filter === value ? tc.buttonPrimary : tc.textMuted,
                    )}
                  >
                    {label} {count}
                  </button>
                ))}
              </div>
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
                {reviewGroups.length === 0 && matchDecisionRows.length === 0 && (
                  <EmptyState text="Nothing left to review." />
                )}

                {/* Offered only past a couple of rows: below that the merchant
                    list is already the shorter path, and a stepper would add a
                    screen to save none. */}
                {undecided > 2 && (
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

                {matchDecisionRows.length > 0 && (
                  <>
                    <SectionLabel text="Might already be logged" />
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
                    {reviewGroups.length > 0 && (
                      <SectionLabel text="Needs a category" />
                    )}
                  </>
                )}

                {reviewGroups.map((group) => (
                  <ReviewGroupCard
                    key={group.key}
                    label={group.label}
                    rowCount={group.rows.length}
                    total={group.total}
                    currency={currency}
                    category={group.category}
                    overrides={group.overrides}
                    onOpen={() => setOpenGroupKey(group.key)}
                  />
                ))}
              </>
            )}

            {/* Already in the ledger: a receipt, not a worklist. Nothing here
                is actionable, so it reads as a dated scan rather than a stack
                of cards with buttons the owner must resist pressing. */}
            {filter === "imported" && (
              <>
                {visibleRows.length === 0 && (
                  <EmptyState text="Nothing from this statement was imported before." />
                )}
                {visibleRows.length > 0 && (
                  <p className={cn("text-[11px] px-1 pt-1", tc.textFaint)}>
                    {visibleRows.length} row(s) already in your ledger — the
                    statement fingerprint matched, so they are left untouched.
                  </p>
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

            {(filter === "matched" || filter === "skipped") && (
              <>
                {visibleRows.length === 0 && <EmptyState text="Nothing here." />}
                {filter === "matched" && visibleRows.length > 0 && (
                  <p className={cn("text-[11px] px-1 pt-1", tc.textFaint)}>
                    Matched to something you logged yourself. Check the bank's
                    wording against yours — detach any that are not the same
                    purchase.
                  </p>
                )}
                {visibleRows.map((row) => {
                  const classification = session.classifications[row.id];
                  if (!classification) return null;
                  const decision = session.decisions[row.id];

                  if (filter === "skipped") {
                    return (
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
                          <p className={cn("text-xs", tc.textFaint)}>
                            {getCurrencySymbol(currency)}
                            {row.amount.toFixed(2)} ·{" "}
                            {classification.status === "transfer"
                              ? "transfer"
                              : "skipped"}
                          </p>
                        </div>
                        {classification.status !== "transfer" && (
                          <button
                            type="button"
                            onClick={() =>
                              updateDecision(row.id, { resolution: "undecided" })
                            }
                            className={cn(
                              "rounded-xl px-4 h-10 text-xs shrink-0",
                              tc.buttonOutline,
                            )}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    );
                  }

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
                : undecided > 0
                  ? `Save ${saveCount} · ${undecided} left`
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
