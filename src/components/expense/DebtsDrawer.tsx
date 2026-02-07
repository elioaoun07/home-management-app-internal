"use client";

import { Trash2Icon, XIcon } from "@/components/icons/FuturisticIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { DebtStatus } from "@/features/debts/types";
import {
  useDebts,
  useDeleteDebt,
  useUnarchiveDebt,
} from "@/features/debts/useDebts";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";

const DebtSettlementModal = dynamic(
  () => import("@/components/expense/DebtSettlementModal"),
  { ssr: false },
);

interface DebtsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DebtsDrawer({ open, onOpenChange }: DebtsDrawerProps) {
  const themeClasses = useThemeClasses();
  const [activeTab, setActiveTab] = useState<"open" | "archived" | "closed">(
    "open",
  );
  const { data: debts = [], isLoading } = useDebts(activeTab);
  const deleteDebt = useDeleteDebt();
  const unarchiveDebt = useUnarchiveDebt();

  // Settlement modal state
  const [settlementData, setSettlementData] = useState<{
    debtId: string;
    debtorName: string;
    originalAmount: number;
    returnedAmount: number;
    accountId: string;
  } | null>(null);

  const handleDelete = (debtId: string) => {
    deleteDebt.mutate(debtId, {
      onSuccess: () => toast.success("Debt deleted"),
      onError: () => toast.error("Failed to delete debt"),
    });
  };

  const handleUnarchive = (debtId: string) => {
    unarchiveDebt.mutate(debtId, {
      onSuccess: () => toast.success("Debt unarchived"),
      onError: () => toast.error("Failed to unarchive debt"),
    });
  };

  const getStatusBadge = (status: DebtStatus) => {
    switch (status) {
      case "open":
        return (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-400/30 text-xs">
            Open
          </Badge>
        );
      case "archived":
        return (
          <Badge className="bg-white/10 text-white/50 border-white/10 text-xs">
            Archived
          </Badge>
        );
      case "closed":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-400/30 text-xs">
            Settled
          </Badge>
        );
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            "max-h-[85vh] border-t",
            themeClasses.modalBg,
            themeClasses.border,
          )}
        >
          <DrawerHeader className="border-b border-white/5 pb-3">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-white flex items-center gap-2">
                <span className="text-orange-400">💸</span> Debts
              </DrawerTitle>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <XIcon className="w-5 h-5 text-white/50" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-3 bg-white/5 rounded-xl p-1">
              {(["open", "archived", "closed"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                    activeTab === tab
                      ? tab === "open"
                        ? "bg-orange-500/20 text-orange-400"
                        : tab === "closed"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-white/10 text-white"
                      : "text-white/50 hover:text-white/70",
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </DrawerHeader>

          <div className="overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-white/30">Loading...</div>
            ) : debts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">
                  {activeTab === "open"
                    ? "🎉"
                    : activeTab === "archived"
                      ? "📦"
                      : "✅"}
                </div>
                <p className="text-white/40 text-sm">
                  {activeTab === "open"
                    ? "No open debts"
                    : activeTab === "archived"
                      ? "No archived debts"
                      : "No settled debts"}
                </p>
              </div>
            ) : (
              debts.map((debt: any) => {
                const remaining = debt.original_amount - debt.returned_amount;
                const progress =
                  debt.original_amount > 0
                    ? (debt.returned_amount / debt.original_amount) * 100
                    : 0;

                return (
                  <div
                    key={debt.id}
                    className={cn(
                      "p-4 rounded-xl border transition-all",
                      debt.status === "open"
                        ? "bg-orange-500/5 border-orange-400/20"
                        : debt.status === "closed"
                          ? "bg-emerald-500/5 border-emerald-400/20"
                          : "bg-white/5 border-white/10",
                    )}
                  >
                    {/* Top Row */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium truncate">
                            {debt.debtor_name}
                          </span>
                          {getStatusBadge(debt.status)}
                        </div>
                        {debt.notes && (
                          <p className="text-xs text-white/40 mt-1 truncate">
                            {debt.notes}
                          </p>
                        )}
                        <p className="text-xs text-white/30 mt-1">
                          {format(new Date(debt.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <span
                          className={cn(
                            "text-lg font-bold",
                            debt.status === "closed"
                              ? "text-emerald-400"
                              : "text-orange-400",
                          )}
                        >
                          ${debt.original_amount.toFixed(2)}
                        </span>
                        {debt.returned_amount > 0 &&
                          debt.status !== "closed" && (
                            <p className="text-xs text-emerald-400/70">
                              -${debt.returned_amount.toFixed(2)} returned
                            </p>
                          )}
                      </div>
                    </div>

                    {/* Progress Bar (for open/archived with partial returns) */}
                    {debt.returned_amount > 0 && debt.status !== "closed" && (
                      <div className="mt-3">
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-white/30 mt-1">
                          ${remaining.toFixed(2)} remaining
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      {debt.status === "open" && (
                        <Button
                          onClick={() =>
                            setSettlementData({
                              debtId: debt.id,
                              debtorName: debt.debtor_name,
                              originalAmount: debt.original_amount,
                              returnedAmount: debt.returned_amount,
                              accountId: debt.transaction?.account_id || "",
                            })
                          }
                          size="sm"
                          className="flex-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-400/20"
                        >
                          Settle
                        </Button>
                      )}
                      {debt.status === "archived" && (
                        <>
                          <Button
                            onClick={() => handleUnarchive(debt.id)}
                            size="sm"
                            className="flex-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-400/20"
                          >
                            Unarchive & Settle
                          </Button>
                        </>
                      )}
                      <Button
                        onClick={() => handleDelete(debt.id)}
                        size="sm"
                        variant="ghost"
                        className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2Icon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Settlement Modal */}
      {settlementData && (
        <DebtSettlementModal
          {...settlementData}
          onClose={() => setSettlementData(null)}
        />
      )}
    </>
  );
}
