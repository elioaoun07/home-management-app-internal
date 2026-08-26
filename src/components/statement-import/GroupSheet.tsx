"use client";

// The one place where a merchant gets decided.
//
// The review list stays a flat list of merchants; everything you can do to a
// merchant happens here, in a sheet with room to be readable. The primary
// action is the category grid at the top — tap a category and the sheet closes
// itself, so the common case is exactly two taps per merchant.
//
// Per-row work (a different category for one row, a date correction, skipping
// a row) lives under a collapsed "Rows" disclosure, because on a normal
// statement it is the exception, and putting it inline is what made the old
// screen unreadable on a phone.

import { CategoryPicker } from "@/components/statement-import/CategoryPicker";
import { TransferToggle } from "@/components/statement-import/TransferToggle";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { formatStatementDate } from "@/features/statement-import/sessionModel";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getCurrencySymbol } from "@/lib/currency";
import type { GroupCategory, RowDecision } from "@/lib/statementImportSession";
import { cn } from "@/lib/utils";
import type { ParsedTransaction } from "@/types/statement";
import { ArrowRight, ChevronDown, ChevronLeft, EyeOff, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  rows: ParsedTransaction[];
  /** The account the STATEMENT belongs to — the default target for its rows. */
  accountId: string;
  /** Every account a row can be re-targeted at, for the per-row override. */
  accounts: Array<{ id: string; name: string; currency?: string }>;
  /** The account a given row will actually be created in. */
  resolveAccount: (row: ParsedTransaction) => string;
  currency: string;
  groupCategory: GroupCategory | undefined;
  decisions: Record<string, RowDecision>;
  resolveCategory: (row: ParsedTransaction) => GroupCategory;
  onGroupCategoryChange: (next: GroupCategory) => void;
  onRowChange: (rowId: string, patch: Partial<RowDecision>) => void;
  onShiftGroupDates: (days: number) => void;
  focusRowId?: string | null;
  /** Shows the year on every date — only when this statement spans more than one. */
  showYear?: boolean;
  /**
   * Overrides RowControls' default transfer-destination list ("every other
   * account") with a kind-scoped one — the Transfers tab passes its own
   * `destinations` (partner accounts for a person row, the owner's own for
   * cash) so re-opening the transfer option from inside this shared sheet
   * offers the same choices the card itself would.
   */
  transferDestinations?: Array<{ id: string; name: string }>;
};

export function GroupSheet({
  open,
  onOpenChange,
  label,
  rows,
  accountId,
  accounts,
  resolveAccount,
  currency,
  groupCategory,
  decisions,
  resolveCategory,
  onGroupCategoryChange,
  onRowChange,
  onShiftGroupDates,
  focusRowId,
  showYear = false,
  transferDestinations,
}: Props) {
  const tc = useThemeClasses();
  const symbol = getCurrencySymbol(currency);
  const shortDate = (iso: string) => formatStatementDate(iso, { year: showYear });
  const { data: categories = [] } = useCategories(accountId);

  // Which target the picker writes to: the whole merchant, or one row of it.
  const [rowTarget, setRowTarget] = useState<string | null>(null);
  const [showRows, setShowRows] = useState(false);

  useEffect(() => {
    if (!open) {
      setRowTarget(null);
      setShowRows(false);
      return;
    }

    // Open on the rows expanded, not behind an extra tap — a multi-row group
    // is exactly why the owner opened this sheet in the first place.
    setShowRows(true);
    if (focusRowId && rows.some((candidate) => candidate.id === focusRowId)) {
      setRowTarget(focusRowId);
    }
  }, [focusRowId, open, rows]);

  const nameOf = useMemo(
    () => (id: string | null | undefined) =>
      id ? (categories.find((c) => c.id === id)?.name ?? null) : null,
    [categories],
  );

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const single = rows.length === 1;
  const row = rowTarget ? rows.find((r) => r.id === rowTarget) : null;

  // With no explicit group pick, show what the rows actually resolve to (a
  // learned merchant mapping, usually) — otherwise the list card reads
  // "Travel" while the grid underneath shows nothing selected. Rows that
  // disagree resolve to nothing, which is the honest answer.
  const effective = useMemo((): GroupCategory => {
    if (groupCategory) return groupCategory;
    const resolved = rows.map((r) => resolveCategory(r));
    const first = resolved[0];
    if (!first?.category_id) return { category_id: null, subcategory_id: null };
    return resolved.every((r) => r.category_id === first.category_id)
      ? first
      : { category_id: null, subcategory_id: null };
  }, [groupCategory, rows, resolveCategory]);

  const target: GroupCategory = row ? resolveCategory(row) : effective;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn(tc.cardBg)}>
        {/* Phone-width column even on a desktop, so the category grid keeps
            its tile proportions instead of stretching across the screen. */}
        <div className="mx-auto w-full max-w-md flex flex-col min-h-0 flex-1">
          <div className="px-4 pt-3 pb-2 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <DrawerTitle
                className={cn(
                  "text-base font-semibold truncate",
                  tc.headerText,
                )}
              >
                {label || "(no merchant)"}
              </DrawerTitle>
              <p className={cn("text-xs mt-0.5", tc.textFaint)}>
                {single
                  ? `${shortDate(rows[0].date)} · ${symbol}${rows[0].amount.toFixed(2)}`
                  : `${rows.length} rows · ${symbol}${total.toFixed(2)}`}
              </p>
            </div>
          </div>

          <div className="px-4 pb-4 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
            {row && (
              <button
                type="button"
                onClick={() => setRowTarget(null)}
                className={cn(
                  "flex items-center gap-1.5 h-9 text-xs self-start",
                  tc.textMuted,
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="truncate max-w-[220px]">
                  just {shortDate(row.date)} · {symbol}
                  {row.amount.toFixed(2)}
                </span>
              </button>
            )}

            {/* A row sent to another account must pick from THAT account's
                categories — `user_categories.account_id` is NOT NULL and the
                commit route rejects a category belonging elsewhere. */}
            {!(
              (row && decisions[row.id]?.action_kind === "transfer") ||
              (single && decisions[rows[0].id]?.action_kind === "transfer")
            ) && (
              <CategoryPicker
                accountId={row ? resolveAccount(row) : accountId}
                categoryId={target.category_id}
                subcategoryId={target.subcategory_id}
                onChange={(next) => {
                  if (row) onRowChange(row.id, next);
                  else onGroupCategoryChange(next);
                }}
                onDone={() => {
                  if (row) setRowTarget(null);
                  else onOpenChange(false);
                }}
              />
            )}

            {/* Per-row detail — deliberately behind a tap. */}
            {!row &&
              (single ? (
                <RowControls
                  row={rows[0]}
                  decision={decisions[rows[0].id]}
                  ownCategoryName={null}
                  accounts={accounts}
                  transferDestinations={transferDestinations}
                  statementAccountId={accountId}
                  rowAccountId={resolveAccount(rows[0])}
                  symbol={symbol}
                  onRowChange={onRowChange}
                  onPickOwnCategory={null}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRows((v) => !v)}
                    className={cn(
                      "h-11 flex items-center gap-2 text-xs",
                      tc.textMuted,
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform",
                        !showRows && "-rotate-90",
                      )}
                    />
                    {rows.length} rows
                  </button>

                  {showRows && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[11px]", tc.textFaint)}>
                          Shift dates
                        </span>
                        {[-1, -2, -3].map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => onShiftGroupDates(days)}
                            className={cn(
                              "rounded-full px-3 h-8 text-[11px]",
                              tc.pillBg,
                              tc.textMuted,
                            )}
                          >
                            {days}d
                          </button>
                        ))}
                      </div>

                      {rows.map((r) => (
                        <RowControls
                          key={r.id}
                          row={r}
                          decision={decisions[r.id]}
                          ownCategoryName={
                            decisions[r.id]?.category_id !== undefined
                              ? nameOf(decisions[r.id]?.category_id)
                              : null
                          }
                          accounts={accounts}
                          transferDestinations={transferDestinations}
                          statementAccountId={accountId}
                          rowAccountId={resolveAccount(r)}
                          symbol={symbol}
                          onRowChange={onRowChange}
                          onPickOwnCategory={() => setRowTarget(r.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>

          <div
            className="px-4 pt-2 pb-4"
            style={{
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
            }}
          >
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(
                "w-full rounded-xl h-12 text-sm font-medium",
                tc.buttonOutline,
              )}
            >
              Done
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function RowControls({
  row,
  decision,
  ownCategoryName,
  accounts,
  transferDestinations,
  statementAccountId,
  rowAccountId,
  symbol,
  onRowChange,
  onPickOwnCategory,
}: {
  row: ParsedTransaction;
  decision: RowDecision | undefined;
  ownCategoryName: string | null;
  accounts: Array<{ id: string; name: string; currency?: string }>;
  /** Overrides the default "every other account" destination list — see the GroupSheet prop of the same name. */
  transferDestinations?: Array<{ id: string; name: string }>;
  statementAccountId: string;
  rowAccountId: string;
  symbol: string;
  onRowChange: (rowId: string, patch: Partial<RowDecision>) => void;
  onPickOwnCategory: (() => void) | null;
}) {
  const tc = useThemeClasses();
  const redirected = rowAccountId !== statementAccountId;
  const actionKind = decision?.action_kind ?? "transaction";
  const transferAccounts =
    transferDestinations ??
    accounts.filter((account) => account.id !== statementAccountId);

  return (
    <div className={cn("rounded-xl p-3 flex flex-col gap-2.5", tc.pillBg)}>
      <div className="flex items-center justify-between">
        <span className={cn("text-[11px]", tc.textFaint)}>Transfer</span>
        <TransferToggle
          checked={actionKind === "transfer"}
          onChange={() =>
            onRowChange(
              row.id,
              actionKind === "transfer"
                ? {
                    action_kind: "transaction",
                    transfer_to_account_id: undefined,
                    resolution: "undecided",
                  }
                : {
                    action_kind: "transfer",
                    account_id: undefined,
                    category_id: null,
                    subcategory_id: null,
                    resolution: "undecided",
                  },
            )
          }
        />
      </div>

      {/* The bank's own words stay on screen even while renamed — they are
          what the dedupe fingerprint is built from, so hiding them would make
          it look like the rename changed the key. It does not. */}
      {/* Amount sits with the bank line so a multi-row merchant can be read
          row by row: previously only the group TOTAL was visible, and the date
          was the only per-row fact on screen. */}
      <div className="flex items-baseline gap-2">
        <p className={cn("text-[11px] truncate flex-1 min-w-0", tc.textFaint)}>
          Bank: {row.description}
        </p>
        <span
          className={cn("text-xs font-medium tabular-nums shrink-0", tc.text)}
        >
          {symbol}
          {row.amount.toFixed(2)}
        </span>
      </div>

      <input
        type="text"
        value={decision?.description ?? ""}
        onChange={(e) => onRowChange(row.id, { description: e.target.value })}
        placeholder={row.description}
        maxLength={500}
        aria-label="Save this transaction as"
        className={cn("rounded-lg px-2 h-10 text-xs w-full", tc.formInput)}
      />

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={decision?.date || row.date}
          onChange={(e) => onRowChange(row.id, { date: e.target.value })}
          className={cn("rounded-lg px-2 h-10 text-xs flex-1", tc.formInput)}
        />

        {actionKind === "transaction" && onPickOwnCategory && (
          <button
            type="button"
            onClick={onPickOwnCategory}
            className={cn(
              "h-10 px-3 rounded-lg text-xs flex items-center gap-1.5 shrink-0",
              ownCategoryName ? tc.buttonOutline : tc.buttonGhost,
              !ownCategoryName && tc.textMuted,
            )}
          >
            <Tag className="w-3.5 h-3.5" />
            <span className="truncate max-w-[80px]">
              {ownCategoryName ?? "Own"}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onRowChange(row.id, { resolution: "skip" })}
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
            tc.buttonGhost,
            tc.textMuted,
          )}
          aria-label="Skip this row"
        >
          <EyeOff className="w-4 h-4" />
        </button>
      </div>

      {/* Per-row destination. The everyday case is one statement → one
          account; this exists for the rows that genuinely belong elsewhere —
          bank fees on a salary statement are a charge, not income. Changing it
          CLEARS the row's category, because categories are scoped to an
          account and the commit route rejects one from the wrong account. */}
      {actionKind === "transaction" ? (
        <Select
          value={rowAccountId}
          onValueChange={(next) =>
            onRowChange(row.id, {
              account_id: next === statementAccountId ? undefined : next,
              category_id: null,
              subcategory_id: null,
            })
          }
        >
          <SelectTrigger
            className={cn(
              "h-10 rounded-lg text-xs",
              redirected && tc.ringSelectionStrong,
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.id === statementAccountId ? `${a.name} (statement)` : a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="flex items-center gap-2">
          <span className={cn("text-[11px] truncate", tc.textFaint)}>
            {row.type === "debit" ? "Statement" : "Account"}
          </span>
          <ArrowRight className={cn("w-3.5 h-3.5 shrink-0", tc.textFaint)} />
          <Select
            value={decision?.transfer_to_account_id ?? ""}
            onValueChange={(next) =>
              onRowChange(row.id, {
                action_kind: "transfer",
                transfer_to_account_id: next,
                resolution: "create",
              })
            }
          >
            <SelectTrigger className="h-10 rounded-lg text-xs flex-1 min-w-0">
              <SelectValue placeholder="Pick account" />
            </SelectTrigger>
            <SelectContent>
              {transferAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {row.type === "credit" && (
            <span className={cn("text-[11px] truncate", tc.textFaint)}>
              Statement
            </span>
          )}
        </div>
      )}

      {actionKind === "transaction" && ownCategoryName && (
        <button
          type="button"
          onClick={() =>
            onRowChange(row.id, {
              category_id: undefined,
              subcategory_id: undefined,
            })
          }
          className={cn("text-[11px] self-start h-8", tc.textFaint)}
        >
          Follow the merchant again
        </button>
      )}
    </div>
  );
}
