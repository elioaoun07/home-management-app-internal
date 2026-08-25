"use client";

// One row on the Transfers tab — a person-to-person transfer OR a cash
// withdrawal. Both ask the SAME question, so they are one component with one
// control:
//
//     Transfer  =  the money moved somewhere else and was not spent
//     Spent     =  the money left for good; it needs a category
//
// Only the destination differs: a person transfer goes to the partner's
// account (a household `transfers` row), a withdrawal goes to one of the
// owner's own accounts (a self `transfers` row). "To wallet" used to be the
// label and it never said from where, to where, or why it wasn't just spending.
//
// Nothing here disappears when it is decided. A decided row keeps its place and
// grows a "will be saved" line, because picking an option is staging, not
// saving — Save at the bottom is the only thing that writes.

import { CategoryChip } from "@/components/statement-import/CategoryChip";
import { CategoryPickerSheet } from "@/components/statement-import/CategoryPickerSheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultDescriptionFor } from "@/features/statement-import/sessionModel";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getCurrencySymbol } from "@/lib/currency";
import type { GroupCategory, RowDecision } from "@/lib/statementImportSession";
import { cn } from "@/lib/utils";
import type { ParsedTransaction, RowClassification } from "@/types/statement";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { useState } from "react";

type CategoryRef = { name: string; color: string; slug?: string | null } | null;
type AccountRef = { id: string; name: string };

function shortDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

type Props = {
  row: ParsedTransaction;
  classification: RowClassification;
  decision: RowDecision | undefined;
  currency: string;
  /**
   * "person" → partner destination + household transfer.
   * "cash"   → own account + self transfer.
   * "exchange" → own-account currency exchange: own account, self transfer,
   *   and NO Transfer/Spent toggle — an exchange is a move by definition, so
   *   offering "Spent" would only invite a wrong answer.
   */
  kind: "person" | "cash" | "exchange";
  /** Heading — the counterparty, or the withdrawal type. */
  title: string;
  /** "in" for money received, "out" for money sent. Cash withdrawals are always "out". */
  direction: "in" | "out";
  /** The account the statement belongs to — the FROM side of any transfer. */
  statementAccountName: string;
  /** Destinations offered under Transfer: partner accounts, or the owner's own. */
  destinations: AccountRef[];
  /**
   * Names ANY account id, including one missing from `destinations`.
   *
   * The partner's account list arrives from a separate query, so on resume the
   * row already carries a chosen destination while `destinations` is still
   * empty — and a `Select` whose value is not among its items renders the
   * PLACEHOLDER. The owner's saved choice read as "Pick account", i.e. as if it
   * had been discarded.
   */
  accountName: (id: string) => string;
  /** The account a "Spent" row would create its transaction in. */
  spendAccountId: string;
  spendAccountName: string;
  resolvedCategory: GroupCategory;
  categoryOf: (id: string | null | undefined) => CategoryRef;
  /**
   * FX facts for an `exchange` row, straight off the bank line. `toAmount` is
   * null when the chosen destination is not in `toCurrency` — the quoted rate
   * does not apply to it, so the move goes 1:1 and the card says so rather
   * than multiplying by a number that means nothing for that account.
   */
  conversion?: {
    rate: number;
    fromCurrency: string;
    toCurrency: string;
    toAmount: number | null;
  };
  /** Person transfers to the partner carry the partner's identity colour (Hard Rule #14). */
  partnerText: string;
  partnerRing: string;
  onRowChange: (rowId: string, patch: Partial<RowDecision>) => void;
};

export function TransferRowCard({
  row,
  classification,
  decision,
  currency,
  kind,
  title,
  direction,
  statementAccountName,
  destinations,
  accountName,
  spendAccountId,
  spendAccountName,
  resolvedCategory,
  categoryOf,
  conversion,
  partnerText,
  partnerRing,
  onRowChange,
}: Props) {
  const tc = useThemeClasses();
  const [pickerOpen, setPickerOpen] = useState(false);
  const symbol = getCurrencySymbol(currency);
  const received = direction === "in";

  // The owner's explicit pick always wins. With nothing picked yet, fall back
  // to the strongest hint available: a matched household name for a person
  // transfer, the bank's own "voucher" wording for a withdrawal (a voucher is
  // a payment, plain ATM cash is a move).
  const mode: "transfer" | "spent" =
    kind === "exchange"
      ? "transfer"
      : decision?.treat_as_transfer === true
        ? "transfer"
        : decision?.treat_as_transfer === false
          ? "spent"
          : kind === "person"
            ? classification.status === "person_transfer" &&
              classification.household_match
              ? "transfer"
              : "spent"
            : classification.withdrawal?.kind === "voucher"
              ? "spent"
              : "transfer";

  const chosenDestinationId = decision?.transfer_to_account_id;
  // Always renderable, list loaded or not — see the `accountName` prop.
  const destination = chosenDestinationId
    ? (destinations.find((a) => a.id === chosenDestinationId) ?? {
        id: chosenDestinationId,
        name: accountName(chosenDestinationId),
      })
    : undefined;
  const options =
    destination && !destinations.some((a) => a.id === destination.id)
      ? [destination, ...destinations]
      : destinations;
  // Only the sender can record a household transfer — the transfers API
  // requires the creator to own the from-account.
  const waitingOnSender = kind === "person" && mode === "transfer" && received;

  const staged =
    mode === "transfer"
      ? waitingOnSender
        ? null
        : destination
          ? {
              verb: kind === "cash" ? "Move" : "Send",
              detail: `${statementAccountName} → ${destination.name}`,
            }
          : null
      : resolvedCategory.category_id
        ? { verb: "Log", detail: spendAccountName }
        : null;

  const isPartnerMoney = kind === "person" && mode === "transfer";

  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-3.5 flex flex-col gap-2.5 border",
        tc.sectionCard,
        isPartnerMoney ? partnerRing : "border-transparent",
      )}
    >
      <div className="flex items-baseline gap-3">
        <p
          className={cn(
            "text-[15px] font-medium truncate flex-1 min-w-0",
            isPartnerMoney ? partnerText : tc.headerText,
          )}
        >
          {title}
        </p>
        <span
          className={cn(
            "text-sm tabular-nums shrink-0",
            received ? "text-emerald-500" : tc.text,
          )}
        >
          {received ? "+" : ""}
          {symbol}
          {row.amount.toFixed(2)}
        </span>
      </div>

      <p
        className={cn(
          "text-[11px] flex items-center gap-1",
          received ? "text-emerald-500" : tc.textFaint,
        )}
      >
        {shortDate(row.date)} ·{" "}
        <span className="inline-flex items-center gap-0.5">
          {received ? (
            <ArrowDownLeft className="w-3 h-3" />
          ) : (
            <ArrowUpRight className="w-3 h-3" />
          )}
          {received ? "received" : "sent"}
        </span>
      </p>

      {/* The bank already stated the rate and both currencies; only the
          destination account is unknown. */}
      {conversion && (
        <p className={cn("text-[11px] tabular-nums", tc.textMuted)}>
          {row.amount.toFixed(2)} {conversion.fromCurrency} →{" "}
          {conversion.toAmount === null
            ? `1:1 (not ${conversion.toCurrency})`
            : `${conversion.toAmount.toFixed(2)} ${conversion.toCurrency}`}{" "}
          @ {conversion.rate}
        </p>
      )}

      {/* The one decision this card exists for. An exchange has no second
          answer — it moved, by definition — so it gets no toggle. */}
      {kind !== "exchange" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              onRowChange(row.id, {
                treat_as_transfer: true,
                category_id: undefined,
                subcategory_id: undefined,
                resolution: "undecided",
              })
            }
            className={cn(
              "rounded-xl h-10 text-xs flex-1",
              mode === "transfer" ? tc.buttonPrimary : tc.buttonOutline,
            )}
          >
            Transfer
          </button>
          <button
            type="button"
            onClick={() =>
              onRowChange(row.id, {
                treat_as_transfer: false,
                transfer_to_account_id: undefined,
                resolution: "undecided",
              })
            }
            className={cn(
              "rounded-xl h-10 text-xs flex-1",
              mode === "spent" ? tc.buttonPrimary : tc.buttonOutline,
            )}
          >
            Spent
          </button>
        </div>
      )}

      {mode === "transfer" ? (
        waitingOnSender ? (
          <p className={cn("text-xs", tc.textMuted)}>
            Waiting for the sender&apos;s import
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <span className={cn("text-[11px] shrink-0", tc.textFaint)}>
              {statementAccountName}
            </span>
            <ArrowRight className={cn("w-3.5 h-3.5 shrink-0", tc.textFaint)} />
            <Select
              value={decision?.transfer_to_account_id ?? ""}
              onValueChange={(next) =>
                onRowChange(row.id, {
                  transfer_to_account_id: next,
                  treat_as_transfer: true,
                  resolution: "create",
                })
              }
            >
              <SelectTrigger className="h-10 rounded-lg text-xs flex-1 min-w-0">
                <SelectValue placeholder="Pick account" />
              </SelectTrigger>
              <SelectContent>
                {options.length === 0 ? (
                  <div className={cn("px-2 py-3 text-xs", tc.textMuted)}>
                    No accounts available
                  </div>
                ) : (
                  options.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )
      ) : (
        <>
          <input
            type="text"
            value={decision?.description ?? ""}
            onChange={(e) =>
              onRowChange(row.id, { description: e.target.value })
            }
            placeholder={defaultDescriptionFor(row, classification)}
            maxLength={500}
            aria-label="Save this as"
            className={cn("rounded-lg px-3 h-10 text-xs w-full", tc.formInput)}
          />
          <CategoryChip
            category={categoryOf(resolvedCategory.category_id)}
            subcategory={categoryOf(resolvedCategory.subcategory_id)}
            onClick={() => setPickerOpen(true)}
          />
        </>
      )}

      <p className={cn("text-[11px] truncate", tc.textFaint)}>
        Bank: {row.description}
      </p>

      {/* What Save will actually do with this row — the row stays put and says
          so, instead of vanishing the moment it is answered. */}
      {staged && (
        <p className="text-[11px] flex items-center gap-1.5 text-emerald-500">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {staged.verb} · {staged.detail}
          </span>
        </p>
      )}

      <button
        type="button"
        onClick={() => onRowChange(row.id, { resolution: "skip" })}
        className={cn("text-[11px] self-end h-8 px-2", tc.textFaint)}
      >
        Skip
      </button>

      {mode === "spent" && (
        <CategoryPickerSheet
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          accountId={spendAccountId}
          categoryId={resolvedCategory.category_id}
          subcategoryId={resolvedCategory.subcategory_id}
          onChange={(next) => onRowChange(row.id, next)}
        />
      )}
    </div>
  );
}
