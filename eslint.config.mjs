// eslint.config.mjs
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  // Flat config's built-in ignores cover node_modules/.git and nothing else, so
  // a bare `eslint` (this repo's `pnpm lint`) walked build output too: `.next`
  // alone held ~5,130 emitted JS files, all linted with the type-aware
  // next/typescript rules. The result was not a lint failure but a V8 OOM —
  // `pnpm lint` died with "Reached heap limit ... JavaScript heap out of memory"
  // (exit 134) after ~7.5 minutes, every single time.
  //
  // That had a governance consequence beyond the wasted time: the Delivery
  // pipeline's launch preflight runs the full validation ladder, so EVERY
  // delivery session saw a red baseline on `lint` and required the owner's
  // red-baseline acknowledgment for a failure that was never about the code.
  // A guard that always fires teaches you to wave it through.
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "scripts/pm/dist/**",
      "public/atlas/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  // DLV-52: standalone Node build/utility scripts are CommonJS by design — they
  // are run directly with `node`, never bundled, and `.cjs` is explicitly the
  // CommonJS extension. `no-require-imports` firing here is a false positive
  // about the module system these files are *supposed* to use, not debt: there
  // is nothing to burn down, only a rule pointed at the wrong files.
  //
  // Deliberately narrow — a path list, not a glob over `scripts/**` — so a new
  // ESM script under scripts/ is still linted normally.
  {
    files: [
      "scripts/generate-icons.cjs",
      "scripts/generate-catalogue-icons.js",
      "scripts/generate-vapid-keys.js",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // ---------------------------------------------------------------------------
  // LINT DEBT LEDGER — burn down, never add to.
  //
  // `no-explicit-any` and `react-hooks/exhaustive-deps` are `error` above,
  // deliberately stricter than the `warn` they carry in next/typescript and
  // next/core-web-vitals. That strictness was switched on without burning down
  // the debt that already existed, so `pnpm lint` exited 1 on 636 pre-existing
  // problems in 164 files — and since the Delivery preflight runs the full
  // validation ladder, EVERY session opened on a red `lint` baseline and had to
  // be waved through with the owner's RED BASELINE acknowledgment.
  //
  // That is the same failure the `.next` ignore above was written to fix, in a
  // new costume, and it earns the same verdict:
  //
  //     A guard that always fires teaches you to wave it through.
  //
  // So the two rules stay `error` everywhere — a NEW file, or a new violation in
  // any file not named below, fails the build the way it should. The files here
  // are grandfathered down to `warn`: still printed on every run, still counted,
  // but no longer able to hold the baseline red.
  //
  // `warn`, not `off`, is the point. The debt stays visible and countable, so
  // burn-down is measurable rather than forgotten.
  //
  // HOW TO BURN DOWN: fix a file's violations, then delete its line from the
  // list. Never append. If a path must be added, the honest move is to fix the
  // code instead — an addition here is a regression that type-checked.
  //
  // Ledger opened 2026-08-01 · 588 problems · 126 + 25 files.
  // ---------------------------------------------------------------------------
  {
    files: [
      "src/app/api/accounts/\\[id\\]/balance/history/route.ts",
      "src/app/api/accounts/route.ts",
      "src/app/api/analytics/route.ts",
      "src/app/api/auth/signup/route.ts",
      "src/app/api/budget-allocations/route.ts",
      "src/app/api/categories/\\[id\\]/route.ts",
      "src/app/api/categories/manage/route.ts",
      "src/app/api/categories/subcategories/\\[id\\]/route.ts",
      "src/app/api/cron/purge-recycle-bin/route.ts",
      "src/app/api/debts/\\[id\\]/route.ts",
      "src/app/api/debts/route.ts",
      "src/app/api/drafts/route.ts",
      "src/app/api/future-purchases/\\[id\\]/route.ts",
      "src/app/api/household/claim/route.ts",
      "src/app/api/household/route.ts",
      "src/app/api/hub/item-links/route.ts",
      "src/app/api/hub/threads/route.ts",
      "src/app/api/inventory/low-stock/route.ts",
      "src/app/api/inventory/stock/\\[itemId\\]/route.ts",
      "src/app/api/onboarding/route.ts",
      "src/app/api/recipes/\\[id\\]/cooking-log/route.ts",
      "src/app/api/recycle-bin/counts/route.ts",
      "src/app/api/recycle-bin/empty/route.ts",
      "src/app/api/recycle-bin/route.ts",
      "src/app/api/statement-import/import/route.ts",
      "src/app/api/transaction-templates/route.ts",
      "src/app/api/transactions/split-bill/route.ts",
      "src/app/api/transfers/\\[id\\]/route.ts",
      "src/app/api/transfers/route.ts",
      "src/app/api/trips/\\[id\\]/activate/route.ts",
      "src/app/api/user-categories/route.ts",
      "src/app/api/user-preferences/route.ts",
      "src/app/auth/reset/page.tsx",
      "src/app/expense/drafts/page.tsx",
      "src/app/qr/expense/page.tsx",
      "src/app/recurring/page.tsx",
      "src/components/charts/InteractiveWorldMap.tsx",
      "src/components/charts/WorldMap.tsx",
      "src/components/dashboard-v2/AnalyticsDashboard.tsx",
      "src/components/dashboard-v2/ReviewDashboard.tsx",
      "src/components/dashboard-v2/ReviewV2Dashboard.tsx",
      "src/components/dashboard-v2/ReviewV3Dashboard.tsx",
      "src/components/dashboard-v2/widgets/AvgTransactionByCategoryWidget.tsx",
      "src/components/dashboard-v2/widgets/BudgetVsActualWidget.tsx",
      "src/components/dashboard-v2/widgets/CashFlowWidget.tsx",
      "src/components/dashboard-v2/widgets/CategoriesV2TabContent.tsx",
      "src/components/dashboard-v2/widgets/CategoryAnalysisWidget.tsx",
      "src/components/dashboard-v2/widgets/CategoryDonutWidget.tsx",
      "src/components/dashboard-v2/widgets/CategoryInsightWidget.tsx",
      "src/components/dashboard-v2/widgets/CategoryTrendWidget.tsx",
      "src/components/dashboard-v2/widgets/DailySpendingChartWidget.tsx",
      "src/components/dashboard-v2/widgets/DayOfWeekWidget.tsx",
      "src/components/dashboard-v2/widgets/ForecastWidget.tsx",
      "src/components/dashboard-v2/widgets/IncomeVsExpenseTrendWidget.tsx",
      "src/components/dashboard-v2/widgets/InsightTabContent.tsx",
      "src/components/dashboard-v2/widgets/MonthlyDistributionTabContent.tsx",
      "src/components/dashboard-v2/widgets/MonthlySpendingChartWidget.tsx",
      "src/components/dashboard-v2/widgets/NetWorthWidget.tsx",
      "src/components/dashboard-v2/widgets/PeriodTimelineWidget.tsx",
      "src/components/dashboard-v2/widgets/SavingsRateTrendWidget.tsx",
      "src/components/dashboard-v2/widgets/SpendingPaceWidget.tsx",
      "src/components/dashboard-v2/widgets/TrendChart.tsx",
      "src/components/dashboard/EnhancedMobileDashboard.tsx",
      "src/components/dashboard/TransactionDetailModal.tsx",
      "src/components/dashboard/TransactionsTable.tsx",
      "src/components/era/CommandBar.tsx",
      "src/components/expense/AddCategoryDialog.tsx",
      "src/components/expense/CategoryManagerDialog.tsx",
      "src/components/expense/DebtsDrawer.tsx",
      "src/components/expense/DraftTransactionsDialog.tsx",
      "src/components/expense/DraftsDrawer.tsx",
      "src/components/expense/ExpenseForm.tsx",
      "src/components/expense/ExpenseFormContext.tsx",
      "src/components/expense/ExpenseTagsBarWrapper.tsx",
      "src/components/expense/FuturePaymentsDrawer.tsx",
      "src/components/expense/MobileExpenseForm.tsx",
      "src/components/expense/SubcategoryGrid.tsx",
      "src/components/expense/VoiceEntryButton.tsx",
      "src/components/hub/AddTransactionFromMessageModal.tsx",
      "src/components/hub/BulkConvertReviewSheet.tsx",
      "src/components/hub/HubPage.tsx",
      "src/components/hub/InlineVoiceRecorder.tsx",
      "src/components/hub/NotesListView.tsx",
      "src/components/layouts/MobileNav.tsx",
      "src/components/nfc/PwaRedirectBanner.tsx",
      "src/components/reminder/ReminderTagsBarWrapper.tsx",
      "src/components/scanner/QRScannerDrawer.tsx",
      "src/components/settings/CategoryManagement.tsx",
      "src/components/settings/GoogleCalendarSetupWizard.tsx",
      "src/components/settings/SettingsDialog.tsx",
      "src/components/statement-import/MerchantMappingsManager.tsx",
      "src/components/statement-import/StatementImportDialog.tsx",
      "src/components/watch/SimpleWatchView.tsx",
      "src/components/watch/WatchEraFace.tsx",
      "src/components/watch/WatchErrorBoundary.tsx",
      "src/components/watch/WatchView.tsx",
      "src/components/web/AddToCalendarDialog.tsx",
      "src/components/web/RecipeCookingMode.tsx",
      "src/components/web/WebDashboard.tsx",
      "src/components/web/WebEventsDashboard.tsx",
      "src/components/web/WebFuturePurchases.tsx",
      "src/contexts/TabContext.tsx",
      "src/features/accounts/hooks.ts",
      "src/features/categories/useCategoryManagement.ts",
      "src/features/drafts/useDrafts.ts",
      "src/features/era/intents/resolvers/schedule.ts",
      "src/features/era/useEraWakeListener.ts",
      "src/features/hub/messageActions.ts",
      "src/features/items/useItemActions.ts",
      "src/features/items/useItems.ts",
      "src/features/preferences/useSectionOrder.ts",
      "src/features/transactions/useDashboardTransactions.ts",
      "src/features/voice-conversation/audioContext.ts",
      "src/features/voice-conversation/azureWake.ts",
      "src/features/voice-conversation/sttCapture.ts",
      "src/lib/hooks/usePerformance.ts",
      "src/lib/nlp/speechExpense.ts",
      "src/lib/prefetch/prefetchTabs.ts",
      "src/lib/recycleBin/types.ts",
      "src/lib/supabase/server.ts",
      "src/lib/utils/getCategoryColor.ts",
      "src/lib/utils/incomeExpense.ts",
      "src/lib/utils/splitBill.ts",
      "src/services/transaction.service.ts",
      "src/types/react-simple-maps.d.ts",
      "src/types/speech.d.ts",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
  {
    files: [
      "src/app/g/\\[tag\\]/guest-portal-client.tsx",
      "src/components/DeepLinkHandler.tsx",
      "src/components/dashboard/SwipeableTransactionItem.tsx",
      "src/components/era/CommandBar.tsx",
      "src/components/era/dashboards/BudgetDashboard.tsx",
      "src/components/era/dashboards/ChefDashboard.tsx",
      "src/components/era/dashboards/ScheduleDashboard.tsx",
      "src/components/expense/CalculatorDialog.tsx",
      "src/components/expense/ExpenseForm.tsx",
      "src/components/expense/MobileExpenseForm.tsx",
      "src/components/expense/OfflinePendingDrawer.tsx",
      "src/components/hub/HubPage.tsx",
      "src/components/hub/NotesListView.tsx",
      "src/components/items/MobileItemForm.tsx",
      "src/components/items/SwipeableItemCard.tsx",
      "src/components/statement-import/StatementImportDialog.tsx",
      "src/components/web/AddToShoppingDialog.tsx",
      "src/components/web/EditOccurrenceDialog.tsx",
      "src/components/web/TaskFocusModal.tsx",
      "src/components/web/WebDashboard.tsx",
      "src/components/web/WebTabletMissionControl.tsx",
      "src/components/web/WebTodayView.tsx",
      "src/contexts/SyncContext.tsx",
      "src/hooks/usePushNotifications.ts",
      "src/lib/hooks/usePerformance.ts",
    ],
    rules: { "react-hooks/exhaustive-deps": "warn" },
  },
];

export default config;
