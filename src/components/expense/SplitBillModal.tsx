"use client";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type SplitBillData = {
  transaction_id: string;
  owner_amount: number;
  owner_description: string;
  category_name: string;
  date?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  splitData: SplitBillData;
  onComplete: (
    amount: number,
    description: string,
    accountId: string
  ) => Promise<void>;
};

export default function SplitBillModal({
  open,
  onClose,
  splitData,
  onComplete,
}: Props) {
  const themeClasses = useThemeClasses();
  const { data: accounts } = useMyAccounts();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setAmount("");
      setDescription("");
      // Default to "Wallet" account if available, otherwise first account
      if (accounts && accounts.length > 0) {
        const walletAccount = accounts.find(
          (a) => a.name.toLowerCase() === "wallet"
        );
        setAccountId(walletAccount ? walletAccount.id : accounts[0].id);
      }
    }
  }, [open, accounts]);

  const ownerAmount = splitData.owner_amount ?? 0;
  const myAmount = parseFloat(amount) || 0;
  const totalAmount = ownerAmount + myAmount;

  const handleSubmit = async () => {
    if (myAmount <= 0 || !accountId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onComplete(myAmount, description, accountId);
      onClose();
    } catch (error) {
      console.error("Failed to complete split bill:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent
        className={cn(
          "neo-card border-2",
          themeClasses.border,
          themeClasses.modalBg
        )}
      >
        <div className="mx-auto w-full max-w-sm flex flex-col max-h-[75vh] overflow-hidden">
          <DrawerHeader className="flex-none">
            <DrawerTitle className="text-center text-lg font-bold">
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Split Bill Request
              </span>
            </DrawerTitle>
            <DrawerDescription className="text-center text-sm text-slate-400">
              Your partner has shared an expense with you
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto min-h-0">
            {/* Partner's portion (read-only) */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50">
              <Label className="text-xs text-slate-400 uppercase tracking-wider">
                Partner's Portion
              </Label>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-blue-400">
                  ${ownerAmount.toFixed(2)}
                </span>
                <span className="text-sm text-slate-400">
                  for {splitData.category_name}
                </span>
              </div>
              {splitData.owner_description && (
                <p className="mt-2 text-sm text-slate-400">
                  "{splitData.owner_description}"
                </p>
              )}
            </div>

            {/* My portion (editable) */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-200">
                Your Portion
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-emerald-400">
                  $
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "pl-8 pr-4 h-14 text-2xl font-bold neo-card",
                    "focus:ring-2 focus:ring-emerald-400/50"
                  )}
                  autoFocus
                />
              </div>

              <div>
                <Label className="text-sm text-slate-400">
                  Payment Account
                </Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="mt-1 neo-card w-full">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {accounts?.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-slate-400">
                  Description (optional)
                </Label>
                <Input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a note about your portion..."
                  className="mt-1 neo-card"
                  maxLength={200}
                />
              </div>
            </div>

            {/* Total display */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-400/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">
                  Combined Total
                </span>
                <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  ${totalAmount.toFixed(2)}
                </span>
              </div>
              <div className="mt-2 flex gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Partner: ${ownerAmount.toFixed(2)}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-pink-400" />
                  You: ${myAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DrawerFooter className="flex-row gap-2 flex-none mt-0 pt-2 pb-8">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">
                Cancel
              </Button>
            </DrawerClose>
            <Button
              onClick={handleSubmit}
              disabled={myAmount <= 0 || !accountId || isSubmitting}
              className={cn(
                "flex-1 neo-gradient text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isSubmitting ? "Saving..." : "Confirm"}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
