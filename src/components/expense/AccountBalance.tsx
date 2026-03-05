"use client";

import {
  ArrowRightIcon,
  Edit2Icon,
  RefreshIcon,
  SaveIcon,
  XIcon,
} from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSyncSafe } from "@/contexts/SyncContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  CACHE_TIMES,
  getCachedBalance,
  setCachedBalance,
} from "@/lib/queryConfig";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import BalanceHistoryDrawer from "./BalanceHistoryDrawer";
import DebtsDrawer from "./DebtsDrawer";
import FuturePaymentsDrawer from "./FuturePaymentsDrawer";
import TransferDialog from "./TransferDialog";

interface AccountBalanceProps {
  accountId: string | undefined;
  accountName?: string;
}

interface Balance {
  account_id: string;
  balance: number;
  updated_at: string;
  balance_set_at?: string;
  pending_drafts?: number;
  draft_count?: number;
  future_payment_total?: number;
  future_payment_count?: number;
  debt_count?: number;
  outstanding_debt?: number;
}

export default function AccountBalance({
  accountId,
  accountName,
}: AccountBalanceProps) {
  const themeClasses = useThemeClasses();
  const queryClient = useQueryClient();
  const sync = useSyncSafe();
  const isOffline = sync ? !sync.isOnline : false;
  const offlinePendingCount = sync?.offlinePendingCount ?? 0;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showDebts, setShowDebts] = useState(false);
  const [showFuturePayments, setShowFuturePayments] = useState(false);

  // Listen for the custom event dispatched by the due-date toast "View" button
  useEffect(() => {
    const handler = () => setShowFuturePayments(true);
    window.addEventListener("open-future-payments", handler);
    return () => window.removeEventListener("open-future-payments", handler);
  }, []);

  // Get cached balance for instant display
  const cachedBalance = accountId ? getCachedBalance(accountId) : null;

  // Fetch balance with smart caching
  // Balance will be fetched:
  // 1. First time (no cache)
  // 2. When cache expires (5 minutes)
  // 3. When explicitly invalidated after mutations
  // 4. When window regains focus (for multi-device sync)
  const {
    data: balance,
    isLoading,
    isFetching,
    error,
  } = useQuery<Balance>({
    queryKey: ["account-balance", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const res = await fetch(`/api/accounts/${accountId}/balance`);
      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ error: "Failed to fetch balance" }));
        throw new Error(errorData.error || "Failed to fetch balance");
      }
      const data = await res.json();
      // Cache to localStorage for instant next load
      setCachedBalance(accountId, data.balance);
      return data;
    },
    enabled: !!accountId,
    retry: 1,
    // OPTIMIZED: Use cached data, refetch when stale
    staleTime: CACHE_TIMES.BALANCE, // 5 minutes
    refetchOnMount: "always", // Always check on mount
    refetchOnWindowFocus: true, // Sync across devices when tab gains focus
    // Use cached balance as placeholder for instant UI
    placeholderData: cachedBalance
      ? {
          account_id: accountId!,
          balance: cachedBalance.balance,
          updated_at: cachedBalance.updatedAt,
        }
      : undefined,
  });

  // Handle errors with useEffect (new React Query pattern)
  useEffect(() => {
    if (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load balance. Please refresh.",
      );
    }
  }, [error]);

  // Update balance mutation
  const updateBalanceMutation = useMutation({
    mutationFn: async (newBalance: number) => {
      if (!accountId) throw new Error("No account selected");
      const res = await fetch(`/api/accounts/${accountId}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance: newBalance }),
      });
      if (!res.ok) throw new Error("Failed to update balance");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["account-balance", accountId],
      });
      toast.success("Balance updated successfully");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update balance",
      );
    },
  });

  const handleEdit = () => {
    setEditValue(String(balance?.balance || 0));
    setIsEditing(true);
  };

  const handleSave = () => {
    const newBalance = parseFloat(editValue);
    if (isNaN(newBalance)) {
      toast.error("Please enter a valid number");
      return;
    }
    updateBalanceMutation.mutate(newBalance);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
  };

  if (!accountId) {
    return null;
  }

  if (error) {
    return (
      <div
        className={`neo-card ${themeClasses.surfaceBg} border-yellow-500/20 p-4 mb-4`}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <Label className="text-sm font-medium text-yellow-400">
              Account Balance - Setup Required
            </Label>
            <p className="text-xs text-yellow-300/70 mt-1">
              Database table not found. Please run the migration script to
              enable balance tracking.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("neo-card p-4 mb-4", themeClasses.cardBg)}>
        <div className="animate-pulse">
          <div
            className={cn("h-4 rounded w-24 mb-2", themeClasses.bgSurface)}
          ></div>
          <div className={cn("h-8 rounded w-32", themeClasses.bgSurface)}></div>
        </div>
      </div>
    );
  }

  const currentBalance = balance?.balance || 0;

  return (
    <div
      className={cn(
        "neo-card p-2.5 shadow-lg relative",
        themeClasses.cardBg,
        isOffline
          ? "border border-dashed border-white/20 opacity-70"
          : themeClasses.border,
      )}
    >
      {/* Offline hint icon */}
      {isOffline && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5">
          <WifiOff className="w-3 h-3 text-white/30" />
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Label
            className={cn(
              "text-[10px] font-medium uppercase tracking-wider",
              themeClasses.textHighlight,
            )}
          >
            {accountName || "Account"} Balance
          </Label>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1.5">
              <Input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className={cn(
                  "h-8 w-32 text-lg font-bold text-white focus:ring-2",
                  themeClasses.inputBg,
                  themeClasses.border,
                  themeClasses.focusBorder,
                  themeClasses.focusRing,
                )}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 bg-[#14b8a6]/20 hover:bg-[#14b8a6]/30 border border-[#14b8a6]/30"
                onClick={handleSave}
                disabled={updateBalanceMutation.isPending}
              >
                <SaveIcon className="h-4 w-4 text-[#14b8a6] drop-shadow-[0_0_6px_rgba(20,184,166,0.5)]" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
                onClick={handleCancel}
                disabled={updateBalanceMutation.isPending}
              >
                <XIcon className="h-4 w-4 text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 mt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowHistory(true)}
                  className={cn(
                    "text-xl font-bold tabular-nums bg-gradient-to-r bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity",
                    themeClasses.titleGradient,
                    themeClasses.glow,
                    isFetching && "opacity-70",
                  )}
                  title="View balance history"
                >
                  ${currentBalance.toFixed(2)}
                </button>
                {/* Subtle loading indicator while syncing */}
                {isFetching && (
                  <div
                    className={cn("animate-spin", themeClasses.textHighlight)}
                  >
                    <RefreshIcon className="h-3.5 w-3.5" />
                  </div>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-7 w-7 rounded-lg active:scale-95 transition-all",
                    themeClasses.bgActive,
                    themeClasses.bgHover,
                    themeClasses.inputBorder,
                  )}
                  onClick={handleEdit}
                >
                  <Edit2Icon
                    className={cn(
                      "h-3.5 w-3.5",
                      themeClasses.textHighlight,
                      themeClasses.glow,
                    )}
                  />
                </Button>
                <TransferDialog
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-7 w-7 rounded-lg active:scale-95 transition-all",
                        themeClasses.bgActive,
                        themeClasses.bgHover,
                        themeClasses.inputBorder,
                      )}
                      title="Transfer between accounts"
                    >
                      <ArrowRightIcon
                        className={cn(
                          "h-3.5 w-3.5",
                          themeClasses.textHighlight,
                          themeClasses.glow,
                        )}
                      />
                    </Button>
                  }
                />
              </div>
              <span
                className={
                  balance?.pending_drafts && balance.pending_drafts > 0
                    ? "text-xs font-medium text-amber-400/90 drop-shadow-[0_0_6px_rgba(251,191,36,0.3)]"
                    : `text-xs ${themeClasses.textFaint} font-medium`
                }
              >
                {String(balance?.draft_count ?? 0)} pending draft
                {Number(balance?.draft_count ?? 0) !== 1 ? "s" : ""}
                {balance?.pending_drafts && balance.pending_drafts > 0
                  ? ` ($${balance.pending_drafts.toFixed(2)})`
                  : ""}
              </span>
              {/* Offline pending transactions hint */}
              {isOffline && offlinePendingCount > 0 && (
                <span className="text-xs font-medium text-white/40 italic">
                  {offlinePendingCount} offline change{offlinePendingCount !== 1 ? "s" : ""} pending
                </span>
              )}
              {/* Future payments info */}
              {balance?.future_payment_count &&
              balance.future_payment_count > 0 ? (
                <button
                  onClick={() => setShowFuturePayments(true)}
                  className="text-xs font-medium text-blue-400/90 drop-shadow-[0_0_6px_rgba(96,165,250,0.3)] hover:text-blue-300 transition-colors text-left"
                >
                  {balance.future_payment_count} future payment
                  {balance.future_payment_count !== 1 ? "s" : ""}
                  {` ($${(balance.future_payment_total ?? 0).toFixed(2)})`}
                </button>
              ) : null}
              {/* Open debts info */}
              {balance?.debt_count && balance.debt_count > 0 ? (
                <button
                  onClick={() => setShowDebts(true)}
                  className="text-xs font-medium text-orange-400/90 drop-shadow-[0_0_6px_rgba(251,146,60,0.3)] hover:text-orange-300 transition-colors text-left"
                >
                  {balance.debt_count} open debt
                  {balance.debt_count !== 1 ? "s" : ""}
                  {` ($${(balance.outstanding_debt ?? 0).toFixed(2)} owed)`}
                </button>
              ) : null}
            </div>
          )}
        </div>
        {!isEditing && balance?.balance_set_at && (
          <div className="text-[10px] text-[hsl(var(--text-muted-light)/0.5)] text-right">
            <span className="font-medium">Set on</span>
            <br />
            <span>{new Date(balance.balance_set_at).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Balance History Drawer */}
      {accountId && (
        <BalanceHistoryDrawer
          accountId={accountId}
          accountName={accountName}
          open={showHistory}
          onOpenChange={setShowHistory}
        />
      )}

      {/* Debts Drawer */}
      <DebtsDrawer open={showDebts} onOpenChange={setShowDebts} />

      {/* Future Payments Drawer */}
      <FuturePaymentsDrawer
        open={showFuturePayments}
        onOpenChange={setShowFuturePayments}
        accountId={accountId}
      />
    </div>
  );
}
