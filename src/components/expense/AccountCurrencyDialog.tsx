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
import { useUpdateAccount } from "@/features/accounts/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { getErrorMessage } from "@/lib/errors";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "LBP", name: "Lebanese Pound" },
  { code: "AED", name: "UAE Dirham" },
  { code: "TRY", name: "Turkish Lira" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Pick<Account, "id" | "name" | "currency" | "exchange_rate"> | null;
};

export default function AccountCurrencyDialog({
  open,
  onOpenChange,
  account,
}: Props) {
  const themeClasses = useThemeClasses();
  const updateAccountMutation = useUpdateAccount();

  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState("");

  useEffect(() => {
    if (account && open) {
      setCurrency(account.currency ?? "USD");
      setExchangeRate(
        account.exchange_rate && account.exchange_rate !== 1
          ? String(account.exchange_rate)
          : "",
      );
    }
  }, [account, open]);

  const parsedRate = parseFloat(exchangeRate);
  const rateNeeded = currency !== "USD";
  const rateValid = !rateNeeded || (exchangeRate.trim() !== "" && parsedRate > 0);

  const handleSave = () => {
    if (!account) return;
    if (!rateValid) {
      toast.error("Enter the exchange rate to USD", {
        icon: ToastIcons.error,
      });
      return;
    }

    const prevCurrency = account.currency ?? "USD";
    const prevRate = account.exchange_rate ?? 1;
    const nextRate = rateNeeded ? parsedRate : 1;

    updateAccountMutation.mutate(
      { id: account.id, currency, exchange_rate: nextRate },
      {
        onSuccess: () => {
          toast.success("Account currency updated", {
            icon: ToastIcons.update,
            description: `${account.name} is now ${currency}${rateNeeded ? ` @ ${nextRate}` : ""}`,
            duration: 4000,
            action: {
              label: "Undo",
              onClick: () =>
                updateAccountMutation.mutate({
                  id: account.id,
                  currency: prevCurrency,
                  exchange_rate: prevRate,
                }),
            },
          });
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(
            getErrorMessage(error, "Failed to update account currency"),
            { icon: ToastIcons.error },
          );
        },
      },
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-bg-dark border-t border-slate-800 max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle
            className={`text-lg font-semibold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
          >
            Account Currency
          </DrawerTitle>
          <DrawerDescription className="text-slate-400 text-sm">
            {account?.name}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Label className={`text-sm font-medium ${themeClasses.text}`}>
              Currency
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCurrency(c.code)}
                  className={cn(
                    "p-2 rounded-lg border text-center transition-all active:scale-95",
                    currency === c.code
                      ? `neo-card ${themeClasses.borderActive} bg-gradient-to-br from-blue-500/20 to-cyan-500/10 shadow-lg shadow-blue-500/10`
                      : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover}`,
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      currency === c.code ? "text-blue-400" : "text-slate-300",
                    )}
                  >
                    {c.code}
                  </span>
                </button>
              ))}
            </div>

            {rateNeeded && (
              <div className="space-y-1 mt-2">
                <p className="text-[11px] text-slate-500">
                  Exchange rate to USD — 1 {currency} = ? USD. New
                  transactions freeze this rate; past transactions keep the
                  rate they were logged at.
                </p>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g., 1.09"
                  value={exchangeRate}
                  onChange={(e) =>
                    setExchangeRate(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  className={cn(
                    "h-11 bg-bg-card-custom text-white placeholder:text-slate-500",
                    themeClasses.border,
                  )}
                />
              </div>
            )}
          </div>
        </div>

        <DrawerFooter className="pt-2 pb-6">
          <Button
            onClick={handleSave}
            disabled={!rateValid || updateAccountMutation.isPending}
            className="w-full h-12 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateAccountMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <DrawerClose asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full h-11 bg-transparent",
                themeClasses.border,
                themeClasses.text,
              )}
            >
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
