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
import { useMyAccounts } from "@/features/accounts/hooks";
import { useCreateTransfer } from "@/features/transfers/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";
import { format } from "date-fns";
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

// Map URL slugs → template IDs.
// Legacy slugs (salary-wallet, wallet-refill, salary-to-wallet) are intentionally
// excluded so they continue using the fromAccountName/toAccountName URL params
// without overriding them with a template.
const SLUG_TO_TEMPLATE_ID: Record<string, string> = {
  "salary-deposit": "salary-deposit",
  "refill-wallet": "refill-wallet",
  "savings": "savings",
  // "transfer" is generic — no pre-selected template (returns null)
};

type NfcWalletTransferPromptProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  fromAccountName?: string; // backward-compat override when no template matches
  toAccountName?: string;   // backward-compat override when no template matches
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
  const { data: accounts = [], isLoading: accountsLoading } = useMyAccounts();
  const createTransfer = useCreateTransfer();

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(
    () => (templateId ? (SLUG_TO_TEMPLATE_ID[templateId] ?? null) : null),
  );
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState(initialAmount ?? "");

  const activeTemplate =
    TEMPLATES.find((t) => t.id === activeTemplateId) ?? null;

  // When a template is active, use its fixed accounts; otherwise fall back to URL params
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
    setFromAccountId(""); // Clear manual picks — let template auto-match take over
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

  // Warn when a template's fixed account can't be matched
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
      onOpenChange(false);
    } catch {
      // The mutation hook shows the toast.
    }
  };

  const dialogTitle = activeTemplate?.label ?? "Quick Transfer";
  const dialogDescription =
    fromAccount && toAccount
      ? `Move money from ${fromAccount.name} to ${toAccount.name}.`
      : activeTemplate
        ? `${effectiveFromName ?? "Select source"} → ${effectiveToName ?? "Select destination"}`
        : "Pick a template or select accounts below.";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent
        className={cn(
          "max-w-[calc(100vw-2rem)] sm:max-w-sm border p-5",
          themeClasses.bgPage,
          themeClasses.border,
        )}
      >
        <DialogHeader>
          <DialogTitle
            className={cn("flex items-center gap-2 text-lg", themeClasses.text)}
          >
            <ArrowRightIcon className={cn("h-5 w-5", themeClasses.glow)} />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {accountsLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Resolving your accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-amber-300">
              No accounts are available yet. Open the expense form once while
              online so ERA can create your default accounts.
            </p>
            <Button className="w-full" type="button" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <form className="space-y-4 pt-1" onSubmit={handleSubmit}>
            {/* Template toggles */}
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-all",
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
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                Could not auto-find the default accounts for this template.
                Pick them below and the transfer will still work.
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <div className="space-y-1.5">
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
                  <SelectTrigger className="h-11">
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
                  "mb-1.5 flex h-8 w-8 items-center justify-center rounded-full",
                  themeClasses.bgSurface,
                )}
              >
                <ArrowRightIcon className={cn("h-4 w-4", themeClasses.text)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">To</Label>
                <Select
                  value={selectedToAccountId}
                  onValueChange={setToAccountId}
                  disabled={!selectedFromAccountId}
                >
                  <SelectTrigger className="h-11">
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

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <DollarSignIcon className={cn("h-4 w-4", themeClasses.glow)} />
                Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
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
                    "h-12 pl-8 text-lg font-semibold",
                    themeClasses.inputFocusForce,
                  )}
                  disabled={createTransfer.isPending}
                />
              </div>
            </div>

            {fromAccount && toAccount && parsedAmount > 0 && (
              <div
                className={cn("rounded-lg p-3 text-sm", themeClasses.bgSurface)}
              >
                <span className="font-semibold">
                  ${parsedAmount.toFixed(2)}
                </span>{" "}
                {fromAccount.name} → {toAccount.name}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createTransfer.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {createTransfer.isPending ? "Transferring..." : "Done"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
