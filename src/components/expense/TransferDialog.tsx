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
  DialogTrigger,
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
import { useAccounts, useMyAccounts } from "@/features/accounts/hooks";
import { useCreateTransfer } from "@/features/transfers/hooks";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { AccountType } from "@/types/domain";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Get the display color for an account type
 */
function getAccountTypeColor(type: AccountType): string {
  switch (type) {
    case "income":
      return "bg-green-500";
    case "saving":
      return "bg-purple-500";
    case "expense":
    default:
      return "bg-blue-500";
  }
}

/**
 * Get the text color for an account type
 */
function getAccountTypeTextColor(type: AccountType): string {
  switch (type) {
    case "income":
      return "text-green-500";
    case "saving":
      return "text-purple-500";
    case "expense":
    default:
      return "text-blue-500";
  }
}

interface TransferDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function TransferDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
}: TransferDialogProps) {
  const themeClasses = useThemeClasses();
  const { data: myAccounts = [] } = useMyAccounts();
  const { data: allAccounts = [] } = useAccounts();
  const { data: householdData } = useHouseholdMembers();
  const createTransfer = useCreateTransfer();

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [transferType, setTransferType] = useState<"self" | "household">(
    "self",
  );
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [returnedAmount, setReturnedAmount] = useState("");

  const hasPartner = householdData?.hasPartner ?? false;
  const partner = householdData?.members.find((m) => !m.isCurrentUser);

  // Partner's accounts (for household transfer destination)
  const partnerAccounts = allAccounts.filter(
    (a) => partner && a.user_id === partner.id,
  );

  // Filter accounts for destination dropdown
  const availableDestinations =
    transferType === "household"
      ? partnerAccounts
      : myAccounts.filter((a) => a.id !== fromAccountId);

  // Get account details for display
  const fromAccount = myAccounts.find((a) => a.id === fromAccountId);
  const toAccount =
    transferType === "household"
      ? allAccounts.find((a) => a.id === toAccountId)
      : myAccounts.find((a) => a.id === toAccountId);

  const parsedAmount = parseFloat(amount) || 0;
  const parsedReturned = parseFloat(returnedAmount) || 0;

  // Fee is auto-calculated: amount sent - amount returned = fee (what partner actually spent)
  const parsedFee = parsedReturned > 0 ? parsedAmount - parsedReturned : 0;

  // Net amount for preview
  const senderNet = parsedAmount - parsedReturned;

  const resetForm = () => {
    setTransferType("self");
    setFromAccountId("");
    setToAccountId("");
    setAmount("");
    setDescription("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setReturnedAmount("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromAccountId || !toAccountId) {
      toast.error("Please select both accounts");
      return;
    }

    if (!amount || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (transferType === "household") {
      if (parsedReturned > parsedAmount) {
        toast.error("Returned amount cannot exceed the transfer amount");
        return;
      }
    }

    try {
      await createTransfer.mutateAsync({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: parsedAmount,
        description: description || undefined,
        date,
        transfer_type: transferType,
        recipient_user_id:
          transferType === "household" ? partner?.id : undefined,
        fee_amount: transferType === "household" ? parsedFee : undefined,
        returned_amount:
          transferType === "household" ? parsedReturned : undefined,
      });

      resetForm();
      setOpen(false);
    } catch {
      // Error is handled by the hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className={cn(
              "text-xl flex items-center gap-2",
              themeClasses.dialogTitle,
            )}
          >
            <ArrowRightIcon className={cn("h-5 w-5", themeClasses.glow)} />
            Transfer Between Accounts
          </DialogTitle>
          <DialogDescription>
            Move money between accounts or to your partner.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Transfer Type Toggle */}
          {hasPartner && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Transfer Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTransferType("self");
                    setToAccountId("");
                    setReturnedAmount("");
                  }}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium border transition-all",
                    transferType === "self"
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                      : "border-border/50 text-muted-foreground hover:border-border",
                  )}
                >
                  My Accounts
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTransferType("household");
                    setToAccountId("");
                  }}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium border transition-all",
                    transferType === "household"
                      ? "bg-purple-500/20 border-purple-500 text-purple-400"
                      : "border-border/50 text-muted-foreground hover:border-border",
                  )}
                >
                  To {partner?.displayName || "Partner"}
                </button>
              </div>
            </div>
          )}

          {/* From Account (always current user's) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">From Account</Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select source account" />
              </SelectTrigger>
              <SelectContent>
                {myAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          getAccountTypeColor(a.type),
                        )}
                      />
                      {a.name}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({a.type})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visual Arrow */}
          <div className="flex justify-center">
            <div className={cn("p-2 rounded-full", themeClasses.surfaceBg)}>
              <ArrowRightIcon
                className={cn(
                  "h-5 w-5 rotate-90",
                  transferType === "household"
                    ? "text-purple-400"
                    : themeClasses.text,
                )}
              />
            </div>
          </div>

          {/* To Account */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              To Account
              {transferType === "household" && partner && (
                <span className="text-purple-400 ml-1">
                  ({partner.displayName}&apos;s)
                </span>
              )}
            </Label>
            <Select
              value={toAccountId}
              onValueChange={setToAccountId}
              disabled={!fromAccountId}
            >
              <SelectTrigger className="h-11">
                <SelectValue
                  placeholder={
                    !fromAccountId
                      ? "Select source first"
                      : transferType === "household"
                        ? `Select ${partner?.displayName || "partner"}'s account`
                        : "Select destination account"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableDestinations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          getAccountTypeColor(a.type),
                        )}
                      />
                      {a.name}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({a.type})
                      </span>
                    </div>
                  </SelectItem>
                ))}
                {availableDestinations.length === 0 && fromAccountId && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {transferType === "household"
                      ? "No partner accounts found"
                      : "No other accounts available"}
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <DollarSignIcon className={cn("h-4 w-4", themeClasses.glow)} />
              Amount
              {transferType === "household" && (
                <span className="text-xs text-muted-foreground font-normal">
                  (total sent)
                </span>
              )}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                $
              </span>
              <Input
                type="text"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn(
                  "pl-8 h-11 text-lg font-semibold",
                  themeClasses.inputFocusForce,
                )}
              />
            </div>
          </div>

          {/* Household-specific: Returned Amount */}
          {transferType === "household" && (
            <div className="space-y-2 p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
              <Label className="text-sm font-medium">
                Returned Back{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                  $
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={returnedAmount}
                  onChange={(e) => setReturnedAmount(e.target.value)}
                  className="pl-8 h-10"
                />
              </div>
              {parsedReturned > 0 && parsedAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Fee auto-calculated:{" "}
                  <span className="text-red-400 font-medium">
                    ${parsedFee.toFixed(2)}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              placeholder={
                transferType === "household"
                  ? "e.g., Groceries money, Rent share"
                  : "e.g., Monthly savings, Wallet refill"
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Summary Preview */}
          {fromAccount && toAccount && amount && parsedAmount > 0 && (
            <div
              className={cn("p-3 rounded-lg text-sm", themeClasses.surfaceBg)}
            >
              {transferType === "self" ? (
                <p className="font-medium">
                  <span className="text-green-500">
                    ${parsedAmount.toFixed(2)}
                  </span>{" "}
                  <span className={getAccountTypeTextColor(fromAccount.type)}>
                    {fromAccount.name}
                  </span>{" "}
                  →{" "}
                  <span className={getAccountTypeTextColor(toAccount.type)}>
                    {toAccount.name}
                  </span>
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium">
                    <span className="text-green-500">
                      ${parsedAmount.toFixed(2)}
                    </span>{" "}
                    →{" "}
                    <span className="text-purple-400">
                      {partner?.displayName}
                    </span>
                  </p>
                  {parsedReturned > 0 && (
                    <div className="text-xs space-y-0.5 border-t border-border/30 pt-1">
                      <p>
                        Returned:{" "}
                        <span className="text-green-400">
                          +${parsedReturned.toFixed(2)}
                        </span>
                        {" · "}Fee:{" "}
                        <span className="text-red-400">
                          ${parsedFee.toFixed(2)}
                        </span>
                      </p>
                      <p>
                        You net:{" "}
                        <span className="text-cyan-400 font-semibold">
                          -${senderNet.toFixed(2)}
                        </span>
                        {" · "}
                        {partner?.displayName} net:{" "}
                        <span className="text-purple-400 font-semibold">
                          -${parsedFee.toFixed(2)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
              disabled={createTransfer.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createTransfer.isPending ||
                !fromAccountId ||
                !toAccountId ||
                !amount ||
                parseFloat(amount) <= 0
              }
            >
              {createTransfer.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Transferring...
                </span>
              ) : (
                "Transfer"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
