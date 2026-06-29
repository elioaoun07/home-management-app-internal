"use client";

import {
  ArrowRightIcon,
  DollarSignIcon,
} from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/features/accounts/hooks";
import { useCreateTransfer } from "@/features/transfers/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type TransferTemplate = {
  id: string;
  label: string;
  from: string | null; // null = user specifies
  to: string | null;   // null = user specifies
  description: string;
};

const TEMPLATES: TransferTemplate[] = [
  {
    id: "salary-deposit",
    label: "Salary Deposit",
    from: "Salary",
    to: "Drawer",
    description: "Salary Deposit",
  },
  {
    id: "refill-wallet",
    label: "Refill Wallet",
    from: "Drawer",
    to: "Wallet",
    description: "Wallet Refill",
  },
  {
    id: "savings",
    label: "Savings",
    from: null,
    to: "Wallet",
    description: "Savings Transfer",
  },
];

// Suggested next template after completing one — helps multi-step salary day flow.
const NEXT_TEMPLATE_ID: Record<string, string> = {
  "salary-deposit": "refill-wallet",
};

const SLUG_TO_TEMPLATE_ID: Record<string, string> = {
  "salary-deposit": "salary-deposit",
  "refill-wallet": "refill-wallet",
  "savings": "savings",
};

type CompletedTransfer = {
  from: string;
  to: string;
  amount: number;
};

type NfcWalletTransferPromptProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  fromAccountName?: string;
  toAccountName?: string;
  initialAmount?: string;
};

function normalizeAccountName(value: string) {
  return value.trim().toLowerCase();
}

function findAccountByReference(
  accounts: Account[],
  accountReference: string | null,
) {
  if (!accountReference) return undefined;
  const normalized = normalizeAccountName(accountReference);
  const idMatch = accounts.find(
    (a) => normalizeAccountName(a.id) === normalized,
  );
  if (idMatch) return idMatch;
  const exact = accounts.find(
    (a) => normalizeAccountName(a.name) === normalized,
  );
  if (exact) return exact;
  return accounts.find((a) =>
    normalizeAccountName(a.name).includes(normalized),
  );
}

function formatAccountType(type: Account["type"]) {
  if (type === "income") return "Income";
  if (type === "saving") return "Saving";
  return "Expense";
}

export default function NfcWalletTransferPrompt({
  open,
  onOpenChange,
  templateId,
  fromAccountName = "Salary",
  toAccountName = "Wallet",
  initialAmount,
}: NfcWalletTransferPromptProps) {
  const themeClasses = useThemeClasses();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const createTransfer = useCreateTransfer();

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(
    () => (templateId ? (SLUG_TO_TEMPLATE_ID[templateId] ?? null) : null),
  );
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState(initialAmount ?? "");
  const [completedTransfers, setCompletedTransfers] = useState<CompletedTransfer[]>([]);

  const activeTemplate =
    TEMPLATES.find((t) => t.id === activeTemplateId) ?? null;

  const effectiveFromName =
    activeTemplate !== null ? activeTemplate.from : (fromAccountName ?? null);
  const effectiveToName =
    activeTemplate !== null ? activeTemplate.to : (toAccountName ?? null);

  const fromAccountMatch = useMemo(
    () => findAccountByReference(accounts, effectiveFromName),
    [accounts, effectiveFromName],
  );
  const toAccountMatch = useMemo(
    () => findAccountByReference(accounts, effectiveToName),
    [accounts, effectiveToName],
  );

  const selectedFromAccountId = fromAccountId || fromAccountMatch?.id || "";
  const rawSelectedToAccountId = toAccountId || toAccountMatch?.id || "";
  const selectedToAccountId =
    rawSelectedToAccountId !== selectedFromAccountId
      ? rawSelectedToAccountId
      : "";

  const fromAccount = accounts.find((a) => a.id === selectedFromAccountId);
  const toAccount = accounts.find((a) => a.id === selectedToAccountId);
  const destinationAccounts = accounts.filter(
    (a) => a.id !== selectedFromAccountId,
  );

  const applyTemplate = (id: string) => {
    setActiveTemplateId(id);
    setFromAccountId("");
    setToAccountId("");
  };

  // Reset state when the dialog opens or the templateId prop changes
  useEffect(() => {
    if (open) {
      const resolved = templateId
        ? (SLUG_TO_TEMPLATE_ID[templateId] ?? null)
        : null;
      setActiveTemplateId(resolved);
      setFromAccountId("");
      setToAccountId("");
      setCompletedTransfers([]);
    }
  }, [open, templateId]);

  useEffect(() => {
    setAmount(initialAmount ?? "");
  }, [initialAmount, open]);

  useEffect(() => {
    if (fromAccountId && selectedToAccountId === fromAccountId) {
      setToAccountId("");
    }
  }, [fromAccountId, selectedToAccountId]);

  const missingDefaultAccount =
    !accountsLoading &&
    accounts.length > 0 &&
    activeTemplate !== null &&
    ((activeTemplate.from !== null && !fromAccountMatch) ||
      (activeTemplate.to !== null && !toAccountMatch));

  const parsedAmount = Number.parseFloat(amount);
  const canSubmit =
    !!selectedFromAccountId &&
    !!selectedToAccountId &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    !createTransfer.isPending;

  const handleClose = () => {
    if (createTransfer.isPending) return;
    onOpenChange(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFromAccountId || !selectedToAccountId) {
      toast.error("Please select both accounts");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const description = activeTemplate?.description ?? "Quick Transfer";

    try {
      await createTransfer.mutateAsync({
        from_account_id: selectedFromAccountId,
        to_account_id: selectedToAccountId,
        amount: parsedAmount,
        description,
        date: format(new Date(), "yyyy-MM-dd"),
        transfer_type: "self",
      });

      // Log completed transfer and stay open for the next one
      setCompletedTransfers((prev) => [
        ...prev,
        {
          from: fromAccount?.name ?? "",
          to: toAccount?.name ?? "",
          amount: parsedAmount,
        },
      ]);
      setAmount("");

      // Auto-advance to the natural next template (e.g. salary-deposit → refill-wallet)
      const nextId = activeTemplateId ? NEXT_TEMPLATE_ID[activeTemplateId] : undefined;
      if (nextId) {
        setActiveTemplateId(nextId);
        setFromAccountId("");
        setToAccountId("");
      }
    } catch {
      // The mutation hook shows the toast.
    }
  };

  const dialogTitle =
    completedTransfers.length > 0
      ? "Transfer Session"
      : (activeTemplate?.label ?? "Quick Transfer");

  const dialogDescription =
    completedTransfers.length > 0
      ? `${completedTransfers.length} transfer${completedTransfers.length > 1 ? "s" : ""} done — add another or tap Done.`
      : fromAccount && toAccount
        ? `Move money from ${fromAccount.name} to ${toAccount.name}.`
        : activeTemplate
          ? `${effectiveFromName ?? "Select source"} → ${effectiveToName ?? "Select destination"}`
          : "Pick a template or select accounts below.";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent
        className={cn(
          "max-w-[calc(100vw-3rem)] sm:max-w-md border p-6",
          themeClasses.bgPage,
          themeClasses.border,
        )}
      >
        <DialogHeader>
          <DialogTitle
            className={cn("flex items-center gap-2 text-xl", themeClasses.text)}
          >
            <ArrowRightIcon className={cn("h-5 w-5", themeClasses.glow)} />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription className="text-sm">{dialogDescription}</DialogDescription>
        </DialogHeader>

        {accountsLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Resolving your accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="space-y-5 py-4">
            <p className="text-sm text-amber-300">
              No accounts are available yet. Open the expense form once while
              online so ERA can create your default accounts.
            </p>
            <Button className="h-12 w-full text-base" type="button" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <form className="space-y-5 pt-1" onSubmit={handleSubmit}>
            {/* Completed transfers log */}
            {completedTransfers.length > 0 && (
              <div className="space-y-2">
                {completedTransfers.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-300"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                    <span className="font-semibold">${t.amount.toFixed(2)}</span>
                    <span className="text-green-300/70">{t.from} → {t.to}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Template chips */}
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-all min-h-[2.5rem]",
                    activeTemplateId === t.id
                      ? cn(themeClasses.bgActive, themeClasses.text)
                      : "bg-white/10 text-white/60 hover:bg-white/20",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {missingDefaultAccount && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Could not auto-find the default accounts for this template.
                Pick them below and the transfer will still work.
              </div>
            )}

            {/* From / To selects */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">From</Label>
                <Select
                  value={selectedFromAccountId}
                  onValueChange={(nextAccountId) => {
                    setFromAccountId(nextAccountId);
                    if (selectedToAccountId === nextAccountId) {
                      setToAccountId("");
                    }
                  }}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent className={themeClasses.bgPage}>
                    {accounts.map((account) => (
                      <SelectItem
                        key={account.id}
                        value={account.id}
                        textValue={account.name}
                      >
                        <div className="flex flex-col">
                          <span>{account.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatAccountType(account.type)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div
                className={cn(
                  "mb-1.5 flex h-9 w-9 items-center justify-center rounded-full",
                  themeClasses.bgSurface,
                )}
              >
                <ArrowRightIcon className={cn("h-4 w-4", themeClasses.text)} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/50">To</Label>
                <Select
                  value={selectedToAccountId}
                  onValueChange={setToAccountId}
                  disabled={!selectedFromAccountId}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent className={themeClasses.bgPage}>
                    {destinationAccounts.map((account) => (
                      <SelectItem
                        key={account.id}
                        value={account.id}
                        textValue={account.name}
                      >
                        <div className="flex flex-col">
                          <span>{account.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatAccountType(account.type)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <DollarSignIcon className={cn("h-4 w-4", themeClasses.glow)} />
                Amount
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-lg">
                  $
                </span>
                <Input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue === "" || /^\d*\.?\d*$/.test(nextValue)) {
                      setAmount(nextValue);
                    }
                  }}
                  className={cn(
                    "h-14 pl-9 text-xl font-semibold",
                    themeClasses.inputFocusForce,
                  )}
                  disabled={createTransfer.isPending}
                />
              </div>
            </div>

            {/* Transfer preview */}
            {fromAccount && toAccount && parsedAmount > 0 && (
              <div
                className={cn("rounded-xl px-4 py-3 text-sm", themeClasses.bgSurface)}
              >
                <span className="font-semibold text-base">
                  ${parsedAmount.toFixed(2)}
                </span>{" "}
                {fromAccount.name} → {toAccount.name}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createTransfer.isPending}
                className="h-12 text-base"
              >
                {completedTransfers.length > 0 ? "Done" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="h-12 text-base"
              >
                {createTransfer.isPending ? "Transferring…" : "Transfer"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
