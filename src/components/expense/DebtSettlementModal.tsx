"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettleDebt } from "@/features/debts/useDebts";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

interface DebtSettlementModalProps {
  debtId: string;
  debtorName: string;
  originalAmount: number;
  returnedAmount: number;
  accountId: string;
  onClose: () => void;
}

export default function DebtSettlementModal({
  debtId,
  debtorName,
  originalAmount,
  returnedAmount,
  accountId,
  onClose,
}: DebtSettlementModalProps) {
  const themeClasses = useThemeClasses();
  const [isClosing, setIsClosing] = useState(false);
  const settleDebt = useSettleDebt();

  const remaining = originalAmount - returnedAmount;
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [isPartial, setIsPartial] = useState(false);

  // Animated close
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const handleSettle = () => {
    const settleAmount = parseFloat(amount);
    if (isNaN(settleAmount) || settleAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (settleAmount > remaining) {
      toast.error(`Amount cannot exceed remaining $${remaining.toFixed(2)}`);
      return;
    }

    setIsClosing(true);
    setTimeout(() => {
      settleDebt.mutate(
        { debtId, data: { amount_returned: settleAmount } },
        {
          onSuccess: () => {
            onClose();
          },
          onError: () => {
            toast.error("Failed to settle debt");
            onClose();
          },
        },
      );
    }, 200);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center overflow-hidden"
      onClick={handleClose}
      style={{
        animation: isClosing
          ? "modalBackdropFadeOut 0.25s ease-in forwards"
          : "modalBackdropFadeIn 0.2s ease-out forwards",
      }}
    >
      <div className="absolute inset-0 bottom-[72px] md:bottom-0 bg-black/60 backdrop-blur-sm" />

      <div
        className={`relative w-full max-w-md mb-[72px] md:mb-0 ${themeClasses.modalBg} rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col neo-glow`}
        style={{
          animation: isClosing
            ? "modalSlideDown 0.25s cubic-bezier(0.4, 0, 1, 1) forwards"
            : "modalSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="p-4 pb-3">
          <h2 className="text-lg font-semibold text-white">Settle Debt</h2>
          <p className="text-sm text-white/50 mt-1">
            Record payment from{" "}
            <span className="text-orange-400 font-medium">{debtorName}</span>
          </p>
        </div>

        {/* Debt Summary */}
        <div className="mx-4 p-3 rounded-xl bg-white/5 border border-orange-400/20">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Original debt</span>
            <span className="text-white font-medium">
              ${originalAmount.toFixed(2)}
            </span>
          </div>
          {returnedAmount > 0 && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-white/50">Already returned</span>
              <span className="text-emerald-400 font-medium">
                -${returnedAmount.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm mt-1 pt-1 border-t border-white/5">
            <span className="text-white/70 font-medium">Remaining</span>
            <span className="text-orange-400 font-bold">
              ${remaining.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="p-4 space-y-3">
          {/* Full/Partial Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsPartial(false);
                setAmount(remaining.toFixed(2));
              }}
              className={cn(
                "flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                !isPartial
                  ? "bg-orange-500/20 text-orange-400 border border-orange-400/30"
                  : "bg-white/5 text-white/50 border border-white/10",
              )}
            >
              Full Settlement
            </button>
            <button
              onClick={() => setIsPartial(true)}
              className={cn(
                "flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isPartial
                  ? "bg-orange-500/20 text-orange-400 border border-orange-400/30"
                  : "bg-white/5 text-white/50 border border-white/10",
              )}
            >
              Partial Payment
            </button>
          </div>

          {/* Amount */}
          {isPartial && (
            <div className="space-y-1">
              <label className="text-xs text-white/50">Amount received</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400/70 text-lg font-bold">
                  $
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  max={remaining}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 bg-white/5 border-white/10 text-white text-lg font-bold focus:border-orange-400/50"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-2 flex gap-3 border-t border-white/5">
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1"
            disabled={settleDebt.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSettle}
            disabled={settleDebt.isPending}
            className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0"
          >
            {settleDebt.isPending
              ? "Settling..."
              : isPartial
                ? `Receive $${parseFloat(amount || "0").toFixed(2)}`
                : "Mark as Settled"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
