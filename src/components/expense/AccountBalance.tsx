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
import { isReallyOnline } from "@/lib/connectivityManager";
import {
  CACHE_TIMES,
  getCachedBalance,
  setCachedBalance,
} from "@/lib/queryConfig";
import { invalidateAccountData } from "@/lib/queryInvalidation";
import { useOfflinePendingStore } from "@/lib/stores/offlinePendingStore";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import BalanceHistoryDrawer from "./BalanceHistoryDrawer";
import DebtsDrawer from "./DebtsDrawer";
import FuturePaymentsDrawer from "./FuturePaymentsDrawer";
import OfflinePendingDrawer from "./OfflinePendingDrawer";
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
  // Primary source: Zustand store (synchronous, instant updates)
  // Fallback: SyncContext (async IDB reads, may lag behind)
  const zustandCount = useOfflinePendingStore((s) => s.count);
  const contextCount = sync?.offlinePendingCount ?? 0;
  const offlinePendingCount = Math.max(zustandCount, contextCount);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showDebts, setShowDebts] = useState(false);
  const [showFuturePayments, setShowFuturePayments] = useState(false);
  const [showOfflinePending, setShowOfflinePending] = useState(false);

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
      // Don't fetch when offline — return cached data silently
      // Use real connectivity check to detect silent WiFi drops
      const actuallyOffline = !isReallyOnline();
      if (actuallyOffline) {
        const offline = getCachedBalance(accountId);
        if (offline) {
          return {
            account_id: accountId,
            balance: offline.balance,
            updated_at: offline.updatedAt,
            _fromCache: true,
          } as Balance & { _fromCache?: boolean };
        }
        throw new Error("Offline – no cached balance");
      }
      try {
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
      } catch (err) {
        // Network failure (connected → lost internet): fall back to cached balance
        if (
          err instanceof TypeError ||
          (err instanceof Error &&
            /network|failed to fetch|load failed/i.test(err.message))
        ) {
          const offline = getCachedBalance(accountId);
          if (offline) {
            return {
              account_id: accountId,
              balance: offline.balance,
              updated_at: offline.updatedAt,
              _fromCache: true,
            } as Balance & { _fromCache?: boolean };
          }
        }
        throw err;
      }
    },
    enabled: !!accountId,
    retry: (failureCount) => {
      // Don't retry when offline — use cached/placeholder silently
      if (!isReallyOnline()) return false;
      return failureCount < 1;
    },
    // OPTIMIZED: Use cached data, refetch when stale
    staleTime: CACHE_TIMES.BALANCE, // 5 minutes
    // Only force-refetch on mount when online; offline uses restored cache
    refetchOnMount: isOffline ? false : "always",
    refetchOnWindowFocus: !isOffline, // Don't try to sync when offline
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
  // Suppress error toasts when offline — cached data is shown instead
  useEffect(() => {
    if (error && !isOffline) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load balance. Please refresh.",
      );
    }
  }, [error, isOffline]);

  // Update balance mutation
  // NOTE: uses fetch() instead of safeFetch() because:
  // (a) this component has its own offline guard via isOffline (SyncContext),
  // (b) balance updates are NOT queued for offline sync — if offline the user
  //     gets a clear error from the fetch itself,
  // (c) safeFetch's 3s pre-flight timeout causes false-offline rejections on
  //     slow connections, blocking the mutation before it even attempts a request.
  const updateBalanceMutation = useMutation({
    mutationFn: async (newBalance: number) => {
      if (isOffline) throw new Error("You're offline — balance not updated.");
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
      invalidateAccountData(queryClient, accountId);
      queryClient.invalidateQueries({
        queryKey: ["daily-summaries"],
        refetchType: "none",
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

  if (error && !isOffline && !balance && !cachedBalance) {
    // Only show error when online AND we have no cached data to display
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
  // When offline, hide actions that require network (edit balance, transfer)
  const showActions = !isOffline;

  return (
    <div
      className={cn(
        "neo-card p-2.5 shadow-lg relative",
        themeClasses.cardBg,
        isOffline
          ? "border border-dashed border-white/15"
          : themeClasses.border,
      )}
    >
      {/* Offline hint badge */}
      {isOffline && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5">
          <WifiOff className="w-3 h-3 text-white/25" />
          <span className="text-[9px] text-white/25 font-medium">Cached</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Label
            className={cn(
              "text-[10px] font-medium uppercase tracking-wider",
              isOffline ? "text-white/30" : themeClasses.textHighlight,
            )}
          >
            {accountName || "Account"} Balance
          </Label>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1.5">
              <Input
                type="text"
                inputMode="decimal"
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
                    "text-2xl font-bold tabular-nums bg-gradient-to-r bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity",
                    isOffline
                      ? "from-white/30 to-white/20" // Greyed out gradient when offline
                      : themeClasses.titleGradient,
                    !isOffline && themeClasses.glow,
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
                {showActions && (
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
                )}
                {showActions && (
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
                )}
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
              {/* Offline pending transactions — always visible like drafts */}
              {isOffline && (
                <button
                  onClick={() => setShowOfflinePending(true)}
                  className={cn(
                    "text-xs font-medium text-left transition-colors",
                    offlinePendingCount > 0
                      ? "text-amber-400/70 hover:text-amber-400"
                      : "text-white/25 hover:text-white/40",
                  )}
                >
                  {offlinePendingCount} pending offline{" "}
                  {offlinePendingCount === 1 ? "transaction" : "transactions"}
                </button>
              )}
              {!isOffline && offlinePendingCount > 0 && (
                <button
                  onClick={() => setShowOfflinePending(true)}
                  className="text-xs font-medium text-amber-400/50 hover:text-amber-400/70 text-left transition-colors"
                >
                  {offlinePendingCount} pending offline{" "}
                  {offlinePendingCount === 1 ? "transaction" : "transactions"}
                </button>
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
        {!isEditing && (
          <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
            {/* Circular dollar icon — ERA design system balance card */}
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center",
                themeClasses.bgSurface,
                themeClasses.inputBorder,
                isOffline && "opacity-40",
              )}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  themeClasses.text,
                  themeClasses.iconGlowMuted,
                )}
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            {balance?.balance_set_at && (
              <div className="text-[9px] text-white/15 text-right leading-none">
                {new Date(balance.balance_set_at).toLocaleDateString()}
              </div>
            )}
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

      {/* Offline Pending Drawer */}
      <OfflinePendingDrawer
        open={showOfflinePending}
        onOpenChange={setShowOfflinePending}
      />
    </div>
  );
}
