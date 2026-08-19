"use client";

// Import history — every statement commit, openable and revertible.
//
// A statement import writes dozens of rows at once, so the safety net is not
// "be careful" but "you can put it back". Each card opens to show exactly what
// the import did to each transaction and how that transaction looks now; the
// revert walks the whole batch backwards (rows, balances, merchant mappings).
//
// Deliberately no success toast, matching the commit flow: the result panel IS
// the confirmation, and a toast here could only offer an Undo that does not
// exist (re-running an import means re-reading the file).

import {
  useRevertStatementImport,
  useStatementImportDetail,
  useStatementImports,
} from "@/features/statement-import/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getCurrencySymbol } from "@/lib/currency";
import { getErrorMessage } from "@/lib/errors";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type {
  RevertImportResult,
  StatementImport,
  StatementImportEntry,
} from "@/types/statement";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ACTION_LABEL: Record<StatementImportEntry["action"], string> = {
  create: "Created",
  stamp: "Matched",
  confirm_draft: "Draft confirmed",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ImportHistory() {
  const tc = useThemeClasses();
  const { data, isLoading } = useStatementImports();
  const [openId, setOpenId] = useState<string | null>(null);
  // Collapsed by default: the upload screen's job is "start an import", and a
  // stack of past imports underneath it buried that on a phone.
  const [showList, setShowList] = useState(false);

  const imports = data?.imports ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <Loader2 className={cn("w-4 h-4 animate-spin", tc.text)} />
        <span className={cn("text-xs", tc.loadingText)}>
          Loading import history…
        </span>
      </div>
    );
  }

  if (imports.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setShowList((v) => !v)}
        className="flex items-center gap-2 px-1 h-11"
        aria-expanded={showList}
      >
        <History className={cn("w-4 h-4", tc.textFaint)} />
        <span className={cn("text-xs font-medium", tc.labelTextMuted)}>
          Past imports ({imports.length})
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform",
            tc.textFaint,
            !showList && "-rotate-90",
          )}
        />
      </button>

      {showList &&
        imports.map((record) => (
          <ImportCard
            key={record.id}
            record={record}
            open={openId === record.id}
            onToggle={() => setOpenId(openId === record.id ? null : record.id)}
          />
        ))}
    </div>
  );
}

function ImportCard({
  record,
  open,
  onToggle,
}: {
  record: StatementImport;
  open: boolean;
  onToggle: () => void;
}) {
  const tc = useThemeClasses();
  const isReverted =
    record.status === "reverted" || record.status === "partially_reverted";

  const summary = [
    record.created_count > 0 ? `${record.created_count} created` : null,
    record.stamped_count > 0 ? `${record.stamped_count} matched` : null,
    record.drafts_confirmed_count > 0
      ? `${record.drafts_confirmed_count} drafts`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("rounded-xl overflow-hidden", tc.sectionCard)}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 flex items-center gap-3 text-left"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className={cn("w-4 h-4 shrink-0", tc.textFaint)} />
        ) : (
          <ChevronRight className={cn("w-4 h-4 shrink-0", tc.textFaint)} />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm truncate", tc.headerText)}>
            {record.file_name}
          </p>
          <p className={cn("text-xs truncate", tc.textFaint)}>
            {record.account_name ?? "Unknown account"} ·{" "}
            {formatDate(record.imported_at)}
            {summary ? ` · ${summary}` : ""}
          </p>
        </div>
        {isReverted && (
          <span
            className={cn(
              "text-[10px] rounded-full px-2 py-0.5 shrink-0",
              "bg-amber-500/10 text-amber-500",
            )}
          >
            {record.status === "partially_reverted" ? "Part reverted" : "Reverted"}
          </span>
        )}
      </button>

      {open && <ImportDetail record={record} />}
    </div>
  );
}

function ImportDetail({ record }: { record: StatementImport }) {
  const tc = useThemeClasses();
  const { data: detail, isLoading } = useStatementImportDetail(record.id);
  const revert = useRevertStatementImport();
  const [confirming, setConfirming] = useState(false);
  const [revertMappings, setRevertMappings] = useState(true);
  const [result, setResult] = useState<RevertImportResult | null>(null);

  const currency = getCurrencySymbol(record.account_currency ?? undefined);

  if (isLoading || !detail) {
    return (
      <div className="px-3 pb-3">
        <Loader2 className={cn("w-4 h-4 animate-spin", tc.text)} />
      </div>
    );
  }

  const entries = detail.entries ?? [];
  const pending = entries.filter((e) => !e.reverted_at);
  const driftedCount = pending.filter((e) => e.current?.drifted).length;
  const learnedCount = (detail.learned_mappings ?? []).length;

  const doRevert = async () => {
    try {
      const outcome = await revert.mutateAsync({
        id: record.id,
        revert_mappings: revertMappings,
        account_id: record.account_id,
      });
      setResult(outcome);
      setConfirming(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not revert this import"), {
        icon: ToastIcons.error,
      });
    }
  };

  return (
    <div className="px-3 pb-3 flex flex-col gap-3">
      {/* What it touched, row by row. */}
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {entries.length === 0 && (
          <p className={cn("text-xs py-2", tc.textFaint)}>
            This import recorded no row-level changes.
          </p>
        )}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className={cn("text-xs truncate", tc.text)}>
                {entry.current?.description || entry.row_id}
              </p>
              <p className={cn("text-[11px]", tc.textFaint)}>
                {ACTION_LABEL[entry.action]}
                {entry.current
                  ? ` · ${currency}${entry.current.amount.toFixed(2)}`
                  : " · row no longer exists"}
                {entry.reverted_at ? " · reverted" : ""}
              </p>
            </div>
            {!entry.reverted_at && entry.current?.drifted && (
              <span className="text-[10px] text-amber-500 shrink-0">
                edited since
              </span>
            )}
          </div>
        ))}
      </div>

      {result ? (
        <div className={cn("rounded-lg p-3 text-xs flex flex-col gap-1", tc.pillBg)}>
          <p className={tc.headerText}>Import reverted</p>
          <p className={tc.textMuted}>
            {result.deleted} transaction(s) moved to the Recycle Bin ·{" "}
            {result.unstamped} un-matched · {result.redrafted} back to draft
          </p>
          {result.removed_after_edit > 0 && (
            <p className="text-amber-500">
              {result.removed_after_edit} of them had been edited since the
              import — they were created by it, so they went too.
            </p>
          )}
          {(result.skipped.drifted > 0 || result.skipped.gone > 0) && (
            <p className="text-amber-500">
              {result.skipped.drifted} row(s) changed too much to undo safely
              and {result.skipped.gone} no longer exist — both were left alone.
            </p>
          )}
          {(result.mappings_restored > 0 || result.mappings_deleted > 0) && (
            <p className={tc.textFaint}>
              {result.mappings_deleted} merchant(s) forgotten,{" "}
              {result.mappings_restored} restored to their previous category.
            </p>
          )}
        </div>
      ) : pending.length === 0 ? (
        <p className={cn("text-xs", tc.textFaint)}>
          Nothing left to revert in this import.
        </p>
      ) : confirming ? (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg p-3 flex items-start gap-2 bg-amber-500/10">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-500 flex flex-col gap-1">
              <p>
                This removes {pending.filter((e) => e.action === "create").length}{" "}
                transaction(s) this import created, un-matches{" "}
                {pending.filter((e) => e.action === "stamp").length}, and puts{" "}
                {pending.filter((e) => e.action === "confirm_draft").length} back
                to draft. Balances move back with them.
              </p>
              {driftedCount > 0 && (
                <p>
                  {driftedCount} row(s) were edited after the import. Rows the
                  import created go anyway; the rest are left untouched.
                </p>
              )}
              <p className={tc.textFaint}>
                Removed rows go to the Recycle Bin, so this is recoverable.
              </p>
            </div>
          </div>

          {learnedCount > 0 && (
            <label className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                checked={revertMappings}
                onChange={(e) => setRevertMappings(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className={cn("text-xs", tc.textMuted)}>
                Also forget the {learnedCount} merchant(s) it learned
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={cn("rounded-lg px-3 h-9 text-xs flex-1", tc.buttonOutline)}
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={doRevert}
              disabled={revert.isPending}
              className={cn(
                "rounded-lg px-3 h-9 text-xs flex-1 disabled:opacity-50",
                tc.buttonPrimary,
              )}
            >
              {revert.isPending ? "Reverting…" : "Revert everything"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={cn(
            "rounded-lg px-3 h-9 text-xs flex items-center justify-center gap-2",
            tc.buttonOutline,
          )}
        >
          <Undo2 className="w-3.5 h-3.5" />
          Revert this import
        </button>
      )}
    </div>
  );
}
