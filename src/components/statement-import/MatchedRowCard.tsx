"use client";

// One reconciled statement row: what the bank says, what you had already
// logged, and the drift between them (posting lag, amount difference) stated
// plainly instead of hidden.
//
// Mobile shape: two lines of fact, badges for the drift, and buttons only when
// a decision is actually owed. Nothing here is an icon-only 28px target any
// more — every action is a labelled 40px control.

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getCurrencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type {
  MatchCandidate,
  ParsedTransaction,
  RowClassification,
} from "@/types/statement";
import { Check } from "lucide-react";

type Props = {
  row: ParsedTransaction;
  classification: RowClassification;
  currency: string;
  accepted: boolean;
  acceptedAmount?: number;
  onAcceptMatch: () => void;
  onAcceptBankAmount: () => void;
  onDetach: () => void;
  onPickCandidate?: (transactionId: string) => void;
  pickedCandidateId?: string;
};

function shortDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function Badges({
  candidate,
  currency,
  tc,
}: {
  candidate: MatchCandidate;
  currency: string;
  tc: ReturnType<typeof useThemeClasses>;
}) {
  const symbol = getCurrencySymbol(currency);
  const drift = Math.abs(candidate.amount_diff) >= 0.01;
  if (candidate.date_diff === 0 && candidate.kind !== "draft" && !drift) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      {candidate.date_diff !== 0 && (
        <span className={cn("rounded-full px-2 py-0.5", tc.pillBg, tc.textMuted)}>
          posted {candidate.date_diff > 0 ? "+" : ""}
          {candidate.date_diff}d
        </span>
      )}
      {candidate.kind === "draft" && (
        <span className={cn("rounded-full px-2 py-0.5", tc.pillBg, tc.textMuted)}>
          draft
        </span>
      )}
      {drift && (
        <span className="rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-500">
          bank {candidate.amount_diff > 0 ? "+" : "−"}
          {symbol}
          {Math.abs(candidate.amount_diff).toFixed(2)}
        </span>
      )}
    </div>
  );
}

export function MatchedRowCard({
  row,
  classification,
  currency,
  accepted,
  acceptedAmount,
  onAcceptMatch,
  onAcceptBankAmount,
  onDetach,
  onPickCandidate,
  pickedCandidateId,
}: Props) {
  const tc = useThemeClasses();
  const symbol = getCurrencySymbol(currency);

  const candidate =
    classification.status === "matched" || classification.status === "probable"
      ? classification
      : null;

  const needsConfirm = classification.status === "probable" && !accepted;
  const amountDrift =
    candidate && Math.abs(candidate.amount_diff) >= 0.01 && acceptedAmount === undefined;

  return (
    <div className={cn("rounded-2xl px-4 py-3.5 flex flex-col gap-2.5", tc.sectionCard)}>
      <div className="flex items-baseline gap-3">
        <p
          className={cn(
            "text-[15px] font-medium truncate flex-1 min-w-0",
            tc.headerText,
          )}
        >
          {row.description}
        </p>
        <span className={cn("text-sm tabular-nums shrink-0", tc.text)}>
          {symbol}
          {row.amount.toFixed(2)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {accepted && classification.status !== "already_imported" && (
          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
        )}
        <p className={cn("text-xs truncate", tc.textFaint)}>
          {shortDate(row.date)}
          {classification.status === "already_imported"
            ? " · imported before"
            : candidate
              ? ` · you logged "${candidate.description || "no description"}"`
              : ""}
        </p>
      </div>

      {candidate && <Badges candidate={candidate} currency={currency} tc={tc} />}

      {classification.status === "ambiguous" && (
        <div className="flex flex-col gap-1.5">
          <p className={cn("text-xs", tc.textMuted)}>Which one is it?</p>
          {classification.candidates.map((option) => (
            <button
              key={option.transaction_id}
              type="button"
              onClick={() => onPickCandidate?.(option.transaction_id)}
              className={cn(
                "rounded-xl px-3 py-2.5 text-left flex items-center gap-2 min-h-[48px]",
                tc.pillBg,
                pickedCandidateId === option.transaction_id &&
                  tc.ringSelectionStrong,
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={cn("text-xs truncate", tc.text)}>
                  {option.description || "(no description)"}
                </p>
                <p className={cn("text-[11px]", tc.textFaint)}>
                  {shortDate(option.date)} · {symbol}
                  {option.amount.toFixed(2)}
                </p>
              </div>
              {pickedCandidateId === option.transaction_id && (
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {(needsConfirm || amountDrift || classification.status !== "already_imported") && (
        <div className="flex flex-wrap gap-2">
          {needsConfirm && (
            <button
              type="button"
              onClick={onAcceptMatch}
              className={cn(
                "rounded-xl px-4 h-10 text-xs font-medium flex-1 min-w-[120px]",
                tc.buttonPrimary,
              )}
            >
              Same thing
            </button>
          )}
          {amountDrift && (
            <button
              type="button"
              onClick={onAcceptBankAmount}
              className={cn(
                "rounded-xl px-4 h-10 text-xs flex-1 min-w-[120px]",
                tc.buttonOutline,
              )}
            >
              Use {symbol}
              {row.amount.toFixed(2)}
            </button>
          )}
          {classification.status !== "already_imported" && (
            <button
              type="button"
              onClick={onDetach}
              className={cn(
                "rounded-xl px-4 h-10 text-xs",
                tc.buttonGhost,
                tc.textMuted,
              )}
            >
              Not a match
            </button>
          )}
        </div>
      )}
    </div>
  );
}
