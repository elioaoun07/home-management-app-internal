"use client";

import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import NfcWalletTransferPrompt from "@/components/expense/NfcWalletTransferPrompt";
import { useTab } from "@/contexts/TabContext";
import { useViewMode } from "@/hooks/useViewMode";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

// Lazy load non-default tabs for faster initial load
// MobileExpenseForm is the default start page, so it's loaded eagerly
const ActivityView = dynamic(
  () => import("@/components/activity/ActivityView"),
  { ssr: false },
);
const MobileReminderForm = dynamic(
  () => import("@/components/reminder/MobileReminderForm"),
  { ssr: false },
);
const RecurringPage = dynamic(() => import("@/app/recurring/page"), {
  ssr: false,
});

// Lazy load view modes that aren't the default mobile view
const SimpleWatchView = dynamic(
  () => import("@/components/watch/SimpleWatchView"),
  { ssr: false },
);
const WatchErrorBoundary = dynamic(
  () =>
    import("@/components/watch/WatchErrorBoundary").then(
      (mod) => mod.WatchErrorBoundary,
    ),
  { ssr: false },
);
const WebViewContainer = dynamic(
  () => import("@/components/web/WebViewContainer"),
  { ssr: false },
);

const WALLET_TRANSFER_SHORTCUTS = new Set([
  // Legacy slugs (backward compat for existing NFC tags)
  "salary-wallet",
  "salary-to-wallet",
  "wallet-refill",
  // New single-URL template slugs
  "salary-deposit",
  "refill-wallet",
  "savings",
  "transfer", // generic — opens modal with template picker
]);

export default function TabContainer() {
  const { viewMode } = useViewMode();
  const { activeTab, isHydrated } = useTab();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dismissedShortcutKey, setDismissedShortcutKey] = useState<
    string | null
  >(null);

  const shortcutValue =
    searchParams.get("transfer") ?? searchParams.get("nfcTransfer");
  const isWalletTransferShortcut = shortcutValue
    ? WALLET_TRANSFER_SHORTCUTS.has(shortcutValue)
    : false;
  const fromAccountName = searchParams.get("from") || "Salary";
  const toAccountName = searchParams.get("to") || "Wallet";
  const initialAmount = searchParams.get("amount") || undefined;

  const shortcutKey = useMemo(
    () =>
      [
        shortcutValue ?? "",
        fromAccountName,
        toAccountName,
        initialAmount ?? "",
      ].join("|"),
    [fromAccountName, initialAmount, shortcutValue, toAccountName],
  );

  const cleanedShortcutUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("transfer");
    params.delete("nfcTransfer");
    params.delete("from");
    params.delete("to");
    params.delete("amount");
    const query = params.toString();
    return query ? `/expense?${query}` : "/expense";
  }, [searchParams]);

  const transferPromptOpen =
    viewMode !== "watch" &&
    isWalletTransferShortcut &&
    dismissedShortcutKey !== shortcutKey;

  const handleTransferPromptOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setDismissedShortcutKey(null);
        return;
      }

      setDismissedShortcutKey(shortcutKey);
      if (isWalletTransferShortcut) {
        router.replace(cleanedShortcutUrl, { scroll: false });
      }
    },
    [cleanedShortcutUrl, isWalletTransferShortcut, router, shortcutKey],
  );

  const walletTransferPrompt = (
    <NfcWalletTransferPrompt
      key={shortcutKey}
      open={transferPromptOpen}
      onOpenChange={handleTransferPromptOpenChange}
      templateId={shortcutValue ?? undefined}
      fromAccountName={fromAccountName}
      toAccountName={toAccountName}
      initialAmount={initialAmount}
    />
  );

  // INSTANT RENDER - No loading screens
  // Always render immediately using cached data
  // APIs run in background, only balance shows loading indicator

  // Watch view replaces the entire interface
  if (viewMode === "watch") {
    return (
      <WatchErrorBoundary>
        <SimpleWatchView />
      </WatchErrorBoundary>
    );
  }

  // Web view - Full responsive dashboard and budget interface
  if (viewMode === "web") {
    return (
      <>
        <WebViewContainer />
        {walletTransferPrompt}
      </>
    );
  }

  // Default mobile view
  // Use visibility to prevent hydration mismatch while avoiding flash
  // Server and client both render with visibility:hidden initially
  // After useLayoutEffect runs, isHydrated becomes true and correct tab is shown
  return (
    <div style={{ visibility: isHydrated ? "visible" : "hidden" }}>
      <div className={activeTab === "dashboard" ? "block" : "hidden"}>
        <ActivityView />
      </div>
      <div className={activeTab === "expense" ? "block" : "hidden"}>
        <main className="h-screen">
          <MobileExpenseForm />
        </main>
      </div>
      <div className={activeTab === "reminder" ? "block" : "hidden"}>
        <main className="h-screen">
          <MobileReminderForm />
        </main>
      </div>
      <div className={activeTab === "recurring" ? "block" : "hidden"}>
        <RecurringPage />
      </div>
      {walletTransferPrompt}
    </div>
  );
}
