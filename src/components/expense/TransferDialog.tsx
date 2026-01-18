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
import { useMyAccounts } from "@/features/accounts/hooks";
import { useCreateTransfer } from "@/features/transfers/hooks";
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
  const { data: accounts = [], isLoading: accountsLoading } = useMyAccounts();
  const createTransfer = useCreateTransfer();

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Filter accounts for destination dropdown (exclude source)
  const availableDestinations = accounts.filter((a) => a.id !== fromAccountId);

  // Get account details for display
  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  const resetForm = () => {
    setFromAccountId("");
    setToAccountId("");
    setAmount("");
    setDescription("");
    setDate(format(new Date(), "yyyy-MM-dd"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromAccountId || !toAccountId) {
      toast.error("Please select both accounts");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      await createTransfer.mutateAsync({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: parseFloat(amount),
        description: description || undefined,
        date,
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
      <DialogContent className="sm:max-w-md">
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
            Move money from one account to another. The source account balance
            will decrease and the destination will increase.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* From Account */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">From Account</Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select source account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
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
                className={cn("h-5 w-5 rotate-90", themeClasses.text)}
              />
            </div>
          </div>

          {/* To Account */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">To Account</Label>
            <Select
              value={toAccountId}
              onValueChange={setToAccountId}
              disabled={!fromAccountId}
            >
              <SelectTrigger className="h-11">
                <SelectValue
                  placeholder={
                    fromAccountId
                      ? "Select destination account"
                      : "Select source first"
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
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <DollarSignIcon className={cn("h-4 w-4", themeClasses.glow)} />
              Amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                $
              </span>
              <Input
                type="number"
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

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              placeholder="e.g., Monthly savings, Wallet refill"
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
          {fromAccount && toAccount && amount && parseFloat(amount) > 0 && (
            <div
              className={cn("p-3 rounded-lg text-sm", themeClasses.surfaceBg)}
            >
              <p className="text-muted-foreground">Preview:</p>
              <p className="font-medium mt-1">
                Transfer{" "}
                <span className="text-green-500">
                  ${parseFloat(amount).toFixed(2)}
                </span>{" "}
                from{" "}
                <span className={getAccountTypeTextColor(fromAccount.type)}>
                  {fromAccount.name}
                </span>{" "}
                to{" "}
                <span className={getAccountTypeTextColor(toAccount.type)}>
                  {toAccount.name}
                </span>
              </p>
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
