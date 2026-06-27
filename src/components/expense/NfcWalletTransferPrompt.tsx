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
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type NfcWalletTransferPromptProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromAccountName?: string;
  toAccountName?: string;
  initialAmount?: string;
};

function normalizeAccountName(value: string) {
  return value.trim().toLowerCase();
}

function findAccountByName(accounts: Account[], accountName: string) {
  const normalized = normalizeAccountName(accountName);
  const exact = accounts.find((account) => {
    return normalizeAccountName(account.name) === normalized;
  });
  if (exact) return exact;

  return accounts.find((account) => {
    return normalizeAccountName(account.name).includes(normalized);
  });
}

function formatAccountType(type: Account["type"]) {
  if (type === "income") return "Income";
  if (type === "saving") return "Saving";
  return "Expense";
}

export default function NfcWalletTransferPrompt({
  open,
  onOpenChange,
  fromAccountName = "Salary",
  toAccountName = "Wallet",
  initialAmount,
}: NfcWalletTransferPromptProps) {
  const themeClasses = useThemeClasses();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const createTransfer = useCreateTransfer();

  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState(initialAmount ?? "");
  const prefillAppliedRef = useRef(false);

  const fromAccountMatch = useMemo(
    () => findAccountByName(accounts, fromAccountName),
    [accounts, fromAccountName],
  );
  const toAccountMatch = useMemo(
    () => findAccountByName(accounts, toAccountName),
    [accounts, toAccountName],
  );

  const fromAccount = accounts.find((account) => account.id === fromAccountId);
  const toAccount = accounts.find((account) => account.id === toAccountId);
  const destinationAccounts = accounts.filter(
    (account) => account.id !== fromAccountId,
  );

  useEffect(() => {
    if (!open) {
      prefillAppliedRef.current = false;
      setAmount(initialAmount ?? "");
      return;
    }

    if (prefillAppliedRef.current || accountsLoading || accounts.length === 0) {
      return;
    }

    setFromAccountId(fromAccountMatch?.id ?? "");
    setToAccountId(toAccountMatch?.id ?? "");
    setAmount(initialAmount ?? "");
    prefillAppliedRef.current = true;
  }, [
    accounts.length,
    accountsLoading,
    fromAccountMatch?.id,
    initialAmount,
    open,
    toAccountMatch?.id,
  ]);

  useEffect(() => {
    if (fromAccountId && toAccountId === fromAccountId) {
      setToAccountId("");
    }
  }, [fromAccountId, toAccountId]);

  const missingDefaultAccount =
    !accountsLoading &&
    accounts.length > 0 &&
    (!fromAccountMatch || !toAccountMatch);

  const parsedAmount = Number.parseFloat(amount);
  const canSubmit =
    !!fromAccountId &&
    !!toAccountId &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    !createTransfer.isPending;

  const handleClose = () => {
    if (createTransfer.isPending) return;
    onOpenChange(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!fromAccountId || !toAccountId) {
      toast.error("Please select both accounts");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      await createTransfer.mutateAsync({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: parsedAmount,
        description: "NFC wallet refill",
        date: format(new Date(), "yyyy-MM-dd"),
        transfer_type: "self",
      });
      onOpenChange(false);
    } catch {
      // The mutation hook shows the toast.
    }
  };

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
            Fund Wallet
          </DialogTitle>
          <DialogDescription>
            Move money from {fromAccountName} to {toAccountName}.
          </DialogDescription>
        </DialogHeader>

        {accountsLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Resolving your accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-amber-300">
              No accounts are available yet. Open the expense form once while
              online so ERA can create your default Salary and Wallet accounts.
            </p>
            <Button className="w-full" type="button" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <form className="space-y-4 pt-1" onSubmit={handleSubmit}>
            {missingDefaultAccount && (
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                I could not auto-find {fromAccountName} and {toAccountName}.
                Pick the accounts below and this transfer will still work.
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">From</Label>
                <Select value={fromAccountId} onValueChange={setFromAccountId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Salary" />
                  </SelectTrigger>
                  <SelectContent className={themeClasses.bgPage}>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
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
                  value={toAccountId}
                  onValueChange={setToAccountId}
                  disabled={!fromAccountId}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Wallet" />
                  </SelectTrigger>
                  <SelectContent className={themeClasses.bgPage}>
                    {destinationAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
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
                {fromAccount.name} to {toAccount.name}
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
