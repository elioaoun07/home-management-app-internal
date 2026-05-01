# Graph Report - src  (2026-05-01)

## Corpus Check
- Large corpus: 624 files · ~593,575 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 2655 nodes · 3067 edges · 74 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 568 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Route Handlers|API Route Handlers]]
- [[_COMMUNITY_Page Components & Client Handlers|Page Components & Client Handlers]]
- [[_COMMUNITY_Secondary API Routes|Secondary API Routes]]
- [[_COMMUNITY_Dashboard & AI Usage|Dashboard & AI Usage]]
- [[_COMMUNITY_Admin UI & Tooling|Admin UI & Tooling]]
- [[_COMMUNITY_Auth & Data API Routes|Auth & Data API Routes]]
- [[_COMMUNITY_Reminders & Calendar|Reminders & Calendar]]
- [[_COMMUNITY_Finance Detail Views|Finance Detail Views]]
- [[_COMMUNITY_Debts Module|Debts Module]]
- [[_COMMUNITY_Mixed API Routes|Mixed API Routes]]
- [[_COMMUNITY_AI Chat Engine|AI Chat Engine]]
- [[_COMMUNITY_Navigation & Deep Links|Navigation & Deep Links]]
- [[_COMMUNITY_Voice & Watch UI|Voice & Watch UI]]
- [[_COMMUNITY_Notification System|Notification System]]
- [[_COMMUNITY_Accounts Module|Accounts Module]]
- [[_COMMUNITY_Date & Time Utilities|Date & Time Utilities]]
- [[_COMMUNITY_Recurring Payments|Recurring Payments]]
- [[_COMMUNITY_Theme & Preferences|Theme & Preferences]]
- [[_COMMUNITY_Catalogue Module|Catalogue Module]]
- [[_COMMUNITY_Hub Cache & Persistence|Hub Cache & Persistence]]
- [[_COMMUNITY_Push Notifications|Push Notifications]]
- [[_COMMUNITY_IncomeExpense Analytics|Income/Expense Analytics]]
- [[_COMMUNITY_Product Scraper|Product Scraper]]
- [[_COMMUNITY_Page Entry Points|Page Entry Points]]
- [[_COMMUNITY_Recipe Cooking Mode|Recipe Cooking Mode]]
- [[_COMMUNITY_Statement Import|Statement Import]]
- [[_COMMUNITY_AI Conversations|AI Conversations]]
- [[_COMMUNITY_Mobile Expense Form|Mobile Expense Form]]
- [[_COMMUNITY_Category Manager|Category Manager]]
- [[_COMMUNITY_Balance History Cache|Balance History Cache]]
- [[_COMMUNITY_AI Models Manager|AI Models Manager]]
- [[_COMMUNITY_Item Links & Deals|Item Links & Deals]]
- [[_COMMUNITY_Notification Settings|Notification Settings]]
- [[_COMMUNITY_Comparison Analytics|Comparison Analytics]]
- [[_COMMUNITY_Insight Engine|Insight Engine]]
- [[_COMMUNITY_Statement Import Dialog|Statement Import Dialog]]
- [[_COMMUNITY_Meal Planner|Meal Planner]]
- [[_COMMUNITY_Custom Recurrence Picker|Custom Recurrence Picker]]
- [[_COMMUNITY_Reminder Templates|Reminder Templates]]
- [[_COMMUNITY_Hub Page|Hub Page]]
- [[_COMMUNITY_Balance History Cache Utils|Balance History Cache Utils]]
- [[_COMMUNITY_Recurring Upcoming Widget|Recurring Upcoming Widget]]
- [[_COMMUNITY_Swipeable Transaction Item|Swipeable Transaction Item]]
- [[_COMMUNITY_Category V2 Charts|Category V2 Charts]]
- [[_COMMUNITY_Notes List View|Notes List View]]
- [[_COMMUNITY_Smart Alert Picker|Smart Alert Picker]]
- [[_COMMUNITY_Split Bill Context|Split Bill Context]]
- [[_COMMUNITY_Category Mutation Hooks|Category Mutation Hooks]]
- [[_COMMUNITY_Forecast Engine|Forecast Engine]]
- [[_COMMUNITY_Category API Routes|Category API Routes]]
- [[_COMMUNITY_Sidebar UI|Sidebar UI]]
- [[_COMMUNITY_Briefing to Speech|Briefing to Speech]]
- [[_COMMUNITY_Balance Reset Editor|Balance Reset Editor]]
- [[_COMMUNITY_Sync Context|Sync Context]]
- [[_COMMUNITY_Watch Error Boundary|Watch Error Boundary]]
- [[_COMMUNITY_Draft Hooks|Draft Hooks]]
- [[_COMMUNITY_Anomaly Detection|Anomaly Detection]]
- [[_COMMUNITY_Misc API Routes|Misc API Routes]]
- [[_COMMUNITY_New Category Drawer|New Category Drawer]]
- [[_COMMUNITY_QR Scanner|QR Scanner]]
- [[_COMMUNITY_Privacy Blur Context|Privacy Blur Context]]
- [[_COMMUNITY_Section Order Preferences|Section Order Preferences]]
- [[_COMMUNITY_Statement Parser Utils|Statement Parser Utils]]
- [[_COMMUNITY_Health API Route|Health API Route]]
- [[_COMMUNITY_Auth API Route A|Auth API Route A]]
- [[_COMMUNITY_Auth API Route B|Auth API Route B]]
- [[_COMMUNITY_Mixed API Route A|Mixed API Route A]]
- [[_COMMUNITY_Mixed API Route B|Mixed API Route B]]
- [[_COMMUNITY_Atlas Page|Atlas Page]]
- [[_COMMUNITY_AI Model Dialog|AI Model Dialog]]
- [[_COMMUNITY_Account Select|Account Select]]
- [[_COMMUNITY_New Subcategory Drawer|New Subcategory Drawer]]
- [[_COMMUNITY_Template Quick Entry|Template Quick Entry]]
- [[_COMMUNITY_Query Invalidation|Query Invalidation]]

## God Nodes (most connected - your core abstractions)
1. `supabaseServer()` - 188 edges
2. `safeFetch()` - 52 edges
3. `format()` - 46 edges
4. `supabaseAdmin()` - 30 edges
5. `useThemeClasses()` - 28 edges
6. `PATCH()` - 23 edges
7. `DELETE()` - 23 edges
8. `generateContentWithFallback()` - 15 edges
9. `AddFlexibleFromCatalogueDialog()` - 14 edges
10. `generateInsights()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `PATCH()` --calls--> `supabaseServer()`  [INFERRED]
  app\api\ai-chat\route.ts → lib\supabase\server.ts
- `GET()` --calls--> `supabaseServer()`  [INFERRED]
  app\api\transactions\split-bill\route.ts → lib\supabase\server.ts
- `handleConfirmRecurring()` --calls--> `format()`  [INFERRED]
  app\recurring\page.tsx → components\web\WebEvents.tsx
- `deleteCategory()` --calls--> `safeFetch()`  [INFERRED]
  components\expense\CategoryManagerDialog.tsx → lib\safeFetch.ts
- `handleSubmit()` --calls--> `format()`  [INFERRED]
  components\expense\MobileExpenseForm.tsx → components\web\WebEvents.tsx

## Communities

### Community 0 - "API Route Handlers"
Cohesion: 0.01
Nodes (153): GET(), POST(), PATCH(), POST(), POST(), GET(), POST(), GET() (+145 more)

### Community 1 - "Page Components & Client Handlers"
Cohesion: 0.02
Nodes (58): handleGenerate(), handleLink(), handleSignOut(), deleteBudgetAllocation(), saveBudgetAllocation(), createCategory(), createItem(), createModule() (+50 more)

### Community 2 - "Secondary API Routes"
Cohesion: 0.02
Nodes (55): POST(), GET(), GET(), getPartnerUserId(), getEndTime(), handleSubmit(), resetForm(), GET() (+47 more)

### Community 3 - "Dashboard & AI Usage"
Cohesion: 0.03
Nodes (31): fetchUpcomingAISessions(), itemWhen(), useCatalogueItems(), useCatalogueModules(), fetchUserId(), fetchHouseholdMembers(), useHouseholdMembers(), fetchFlexibleSchedules() (+23 more)

### Community 4 - "Admin UI & Tooling"
Cohesion: 0.02
Nodes (29): AlertsPage(), AtlasTree(), AddExpenseButton(), AmountInput(), DescriptionField(), DraggableItem(), FlexibleRoutinesPool(), useThemeClasses() (+21 more)

### Community 5 - "Auth & Data API Routes"
Cohesion: 0.03
Nodes (51): GET(), POST(), POST(), GET(), POST(), GET(), POST(), POST() (+43 more)

### Community 6 - "Reminders & Calendar"
Cohesion: 0.04
Nodes (45): calculateAge(), getBirthdayDisplayName(), getBirthdaysForDate(), getOrdinalSuffix(), expandRecurringItems(), getItemDate(), modalDate(), areAllSubtasksCompleted() (+37 more)

### Community 7 - "Finance Detail Views"
Cohesion: 0.04
Nodes (35): humanDate(), humanDate(), cn(), formatCurrency(), formatDateHeader(), humanDate(), getTimeLabel(), GET() (+27 more)

### Community 8 - "Debts Module"
Cohesion: 0.07
Nodes (33): fetchDebts(), useDebts(), useOpenDebtCount(), useOutstandingDebtAmount(), useOfflineAware(), doProbe(), handleBrowserOffline(), isReallyOnline() (+25 more)

### Community 9 - "Mixed API Routes"
Cohesion: 0.08
Nodes (19): POST(), DELETE(), formatTransfer(), GET(), PATCH(), POST(), POST(), adjustAccountBalance() (+11 more)

### Community 10 - "AI Chat Engine"
Cohesion: 0.08
Nodes (39): fetchBudgetContext(), GET(), getMonthlyTokenUsage(), isRateLimited(), logMessagesToDatabase(), PATCH(), POST(), recordRateLimitError() (+31 more)

### Community 11 - "Navigation & Deep Links"
Cohesion: 0.07
Nodes (16): DeepLinkHandler(), useTab(), useTabSafe(), DashboardClientWrapper(), prefetchDashboardData(), ExpenseLayout(), useViewMode(), GuestHeader() (+8 more)

### Community 13 - "Voice & Watch UI"
Cohesion: 0.11
Nodes (14): commit(), chooseBest(), classifyAmounts(), flattenCategories(), normalize(), parseMathExpression(), parseNumbers(), parseRelativeDate() (+6 more)

### Community 14 - "Notification System"
Cohesion: 0.08
Nodes (6): getActionRoute(), handleDismiss(), handleNotificationClick(), handleQuickAction(), isInfoOnly(), navigateForNotification()

### Community 15 - "Accounts Module"
Cohesion: 0.08
Nodes (5): useAccounts(), useMyAccounts(), useCategories(), ExpenseFormProvider(), ExpenseTagsBarWrapper()

### Community 16 - "Date & Time Utilities"
Cohesion: 0.14
Nodes (22): applyTimePeriod(), computeEaster(), extractTitle(), formatDateToYYYYMMDD(), getEndOfMonth(), getEndOfWeek(), getEndOfYear(), getHolidaysForYear() (+14 more)

### Community 17 - "Recurring Payments"
Cohesion: 0.11
Nodes (10): addAmount(), buildAdvice(), classify(), computeStatus(), cycleLength(), getCycleWindow(), nextCycleStartIfExpired(), parseLocalDate() (+2 more)

### Community 18 - "Theme & Preferences"
Cohesion: 0.1
Nodes (13): ThemeProvider(), useTheme(), getCachedPreferences(), setCachedPreferences(), readLocal(), usePreferences(), writeLocal(), useUserPreferences() (+5 more)

### Community 19 - "Catalogue Module"
Cohesion: 0.11
Nodes (2): handleBreadcrumbClick(), navigateToModules()

### Community 20 - "Hub Cache & Persistence"
Cohesion: 0.18
Nodes (12): addDismissedAlert(), addMessageToLocalCache(), cleanupDismissedAlerts(), cleanupOldCache(), getCachedMessages(), getCachedThreads(), getDismissedAlerts(), getStorageItem() (+4 more)

### Community 22 - "Push Notifications"
Cohesion: 0.13
Nodes (9): createLocalPushSubscription(), getDeviceType(), getOrCreateDeviceId(), getPushEnabledFromStorage(), removeSubscription(), saveSubscriptionToApi(), storeVapidKeyInIdb(), urlBase64ToUint8Array() (+1 more)

### Community 23 - "Income/Expense Analytics"
Cohesion: 0.18
Nodes (13): calculateIncomeExpenseSummary(), calculateSavingsRate(), filterTransactionsByAccountType(), getAccountType(), getExpenseCategories(), getExpenseTransactions(), getIncomeTransactions(), getSavingTransactions() (+5 more)

### Community 24 - "Product Scraper"
Cohesion: 0.22
Nodes (16): DELETE(), extractBasicProductInfo(), extractFromJinaContent(), extractGCSProductInfo(), extractStoreName(), extractTitleFromUrlSlug(), fetchWithJinaReader(), fetchWithRetry() (+8 more)

### Community 25 - "Page Entry Points"
Cohesion: 0.11
Nodes (9): Home(), UserMenu(), DashboardPage(), ExpensePage(), NfcAdminPage(), SettingsRoute(), supabaseServerRSC(), NfcTagPage() (+1 more)

### Community 26 - "Recipe Cooking Mode"
Cohesion: 0.12
Nodes (2): addTimeToTimer(), stopAlarmSound()

### Community 28 - "Statement Import"
Cohesion: 0.2
Nodes (13): cleanMerchantName(), convertToUITransactions(), detectFormat(), extractMerchant(), extractMerchantPattern(), getTransactionType(), parseCSV(), parseCSVLine() (+5 more)

### Community 29 - "AI Conversations"
Cohesion: 0.13
Nodes (3): deleteConversation(), generateSessionId(), startNewConversation()

### Community 32 - "Mobile Expense Form"
Cohesion: 0.13
Nodes (3): getNextStepLabel(), getTransactionLabel(), handleSubmit()

### Community 34 - "Category Manager"
Cohesion: 0.2
Nodes (9): deleteCategory(), getDisplaySubs(), getSubs(), handleDragEnd(), handleRootDragEnd(), handleSubDragEnd(), normalizeSequential(), patchSubcategoryName() (+1 more)

### Community 35 - "Balance History Cache"
Cohesion: 0.15
Nodes (4): getArchiveCacheKey(), getDailyCacheKey(), useBalanceArchives(), useDailySummaries()

### Community 36 - "AI Models Manager"
Cohesion: 0.16
Nodes (3): fetchModels(), fetchSessionTypes(), parseOrThrow()

### Community 37 - "Item Links & Deals"
Cohesion: 0.16
Nodes (3): useItemLinks(), useRefreshAllLinks(), useRefreshLink()

### Community 38 - "Notification Settings"
Cohesion: 0.22
Nodes (7): formatTime(), getPreference(), getPreferenceValue(), getPreferredTimes(), handleSubscribe(), handleTimeChange(), handleToggleSecondReminder()

### Community 39 - "Comparison Analytics"
Cohesion: 0.2
Nodes (8): comparePeriods(), getCurrentSeasonComparison(), getDailySpending(), getMonthlySpending(), getMonthOverMonth(), getSameMonthLastYear(), getSeason(), getYearOverYear()

### Community 40 - "Insight Engine"
Cohesion: 0.27
Nodes (13): budgetOverrunInsight(), categoryConcentrationInsight(), consistencyInsight(), dayOfWeekInsight(), debtInsight(), generateInsights(), incomeChangeInsight(), largeTransactionsInsight() (+5 more)

### Community 41 - "Statement Import Dialog"
Cohesion: 0.21
Nodes (5): handleAddCustom(), handleFileChange(), handleFileUpload(), handleKeyDown(), handleParseCsvText()

### Community 42 - "Meal Planner"
Cohesion: 0.18
Nodes (2): getWeekStart(), goToCurrentWeek()

### Community 48 - "Custom Recurrence Picker"
Cohesion: 0.31
Nodes (6): buildRRule(), cn(), describeRRule(), getOrdinalSuffix(), handleSave(), parseRRule()

### Community 56 - "Reminder Templates"
Cohesion: 0.28
Nodes (4): TemplateDrawer(), useCreateReminderTemplate(), useLaunchReminderTemplate(), useReminderTemplates()

### Community 57 - "Hub Page"
Cohesion: 0.25
Nodes (2): generateSessionId(), startNewChat()

### Community 58 - "Balance History Cache Utils"
Cohesion: 0.25
Nodes (2): getBhHistCacheKey(), useBalanceHistory()

### Community 59 - "Recurring Upcoming Widget"
Cohesion: 0.22
Nodes (2): useRecurringPayments(), RecurringUpcomingWidget()

### Community 60 - "Swipeable Transaction Item"
Cohesion: 0.29
Nodes (2): handleMouseUp(), handleTouchEnd()

### Community 61 - "Category V2 Charts"
Cohesion: 0.32
Nodes (3): build12Months(), buildBuckets(), dateToBucketKey()

### Community 63 - "Notes List View"
Cohesion: 0.29
Nodes (2): createTopic(), handleTopicSwitch()

### Community 64 - "Smart Alert Picker"
Cohesion: 0.29
Nodes (2): formatTime12h(), getDisplayText()

### Community 66 - "Split Bill Context"
Cohesion: 0.29
Nodes (4): useSplitBillModal(), SplitBillHandler(), useCompleteSplitBill(), usePendingSplits()

### Community 67 - "Category Mutation Hooks"
Cohesion: 0.43
Nodes (7): manageCategoryOperation(), useBulkUpdateCategories(), useCategoryManagement(), useCreateCategory(), useDeleteCategory(), useReorderCategories(), useUpdateCategory()

### Community 68 - "Forecast Engine"
Cohesion: 0.43
Nodes (6): detectTrend(), generateForecast(), linearRegression(), nextMonth(), residualStdDev(), weightedMovingAverage()

### Community 69 - "Category API Routes"
Cohesion: 0.52
Nodes (6): bulkUpdateCategories(), createCategory(), deleteCategory(), POST(), reorderCategories(), updateCategory()

### Community 73 - "Sidebar UI"
Cohesion: 0.33
Nodes (2): SidebarMenuButton(), useSidebar()

### Community 77 - "Briefing to Speech"
Cohesion: 0.52
Nodes (6): applySSML(), briefingToSpeech(), collectListRun(), conversationalRewrite(), escapeXml(), joinNaturally()

### Community 80 - "Balance Reset Editor"
Cohesion: 0.4
Nodes (2): cancelResetEditor(), saveResetEditor()

### Community 86 - "Sync Context"
Cohesion: 0.33
Nodes (2): useSyncSafe(), SyncIndicator()

### Community 87 - "Watch Error Boundary"
Cohesion: 0.33
Nodes (1): WatchErrorBoundary

### Community 89 - "Draft Hooks"
Cohesion: 0.4
Nodes (2): useDraftCount(), useDrafts()

### Community 91 - "Anomaly Detection"
Cohesion: 0.67
Nodes (5): detectCategoryAnomalies(), detectTransactionAnomalies(), getSeverity(), mean(), stdDev()

### Community 93 - "Misc API Routes"
Cohesion: 0.5
Nodes (2): GET(), getPartnerUserId()

### Community 98 - "New Category Drawer"
Cohesion: 0.5
Nodes (2): handleCreate(), resetForm()

### Community 101 - "QR Scanner"
Cohesion: 0.5
Nodes (2): handleScan(), parseQRUrl()

### Community 109 - "Privacy Blur Context"
Cohesion: 0.4
Nodes (2): usePrivacyBlur(), BlurredAmount()

### Community 111 - "Section Order Preferences"
Cohesion: 0.5
Nodes (2): getCachedSectionOrder(), useSectionOrder()

### Community 112 - "Statement Parser Utils"
Cohesion: 0.7
Nodes (4): extractMerchantName(), findMerchantMapping(), parseDate(), parseStatementText()

### Community 113 - "Health API Route"
Cohesion: 0.83
Nodes (3): emptyResponse(), GET(), round()

### Community 128 - "Auth API Route A"
Cohesion: 1.0
Nodes (2): getBaseUrl(), POST()

### Community 129 - "Auth API Route B"
Cohesion: 1.0
Nodes (2): getBaseUrl(), POST()

### Community 131 - "Mixed API Route A"
Cohesion: 1.0
Nodes (2): GET(), POST()

### Community 132 - "Mixed API Route B"
Cohesion: 1.0
Nodes (2): GET(), POST()

### Community 133 - "Atlas Page"
Cohesion: 1.0
Nodes (2): AtlasPage(), loadAtlas()

### Community 138 - "AI Model Dialog"
Cohesion: 1.0
Nodes (2): reset(), submit()

### Community 150 - "Account Select"
Cohesion: 1.0
Nodes (2): onAddAccount(), setSelected()

### Community 152 - "New Subcategory Drawer"
Cohesion: 1.0
Nodes (2): handleCreate(), resetForm()

### Community 154 - "Template Quick Entry"
Cohesion: 1.0
Nodes (2): async(), refreshTemplates()

### Community 168 - "Query Invalidation"
Cohesion: 1.0
Nodes (2): clearAnalyticsLocalStorage(), invalidateAccountData()

## Knowledge Gaps
- **Thin community `Catalogue Module`** (19 nodes): `WebCatalogue.tsx`, `cn()`, `getModuleIcon()`, `handleAddItem()`, `handleAddModule()`, `handleAddToCalendar()`, `handleBreadcrumbClick()`, `handleDeleteCategory()`, `handleDeleteItem()`, `handleDeleteModule()`, `handleEditCategory()`, `handleEditItem()`, `handleEditModule()`, `handleToggleFavorite()`, `handleTogglePin()`, `handleViewItem()`, `navigateToCategories()`, `navigateToItems()`, `navigateToModules()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Recipe Cooking Mode`** (18 nodes): `RecipeCookingMode.tsx`, `addSubstitution()`, `addTimeToTimer()`, `cn()`, `formatQuantity()`, `formatTime()`, `getIngredientUsedInSteps()`, `groupBySection()`, `handleAskSubstitution()`, `handleSubmitFeedback()`, `parseFraction()`, `pauseResumeTimer()`, `scaleIngredientsLocally()`, `startAlarmSound()`, `startTimer()`, `stopAlarmSound()`, `stopTimerAlarm()`, `toggleStep()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Meal Planner`** (12 nodes): `WebMealPlanner.tsx`, `cn()`, `formatDate()`, `formatDateDisplay()`, `getDayName()`, `getWeekStart()`, `goToCurrentWeek()`, `goToNextWeek()`, `goToPreviousWeek()`, `handleDayClick()`, `handleRemoveMealPlan()`, `handleSelectRecipe()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hub Page`** (9 nodes): `HubPage.tsx`, `catch()`, `cn()`, `generateSessionId()`, `handleKeyDown()`, `if()`, `loadHistory()`, `startNewChat()`, `switch()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Balance History Cache Utils`** (9 nodes): `clearHistBhCache()`, `fetchBalanceHistory()`, `formatChangeAmount()`, `getBhHistCacheKey()`, `getChangeTypeInfo()`, `readBhHistCache()`, `useBalanceHistory()`, `writeBhHistCache()`, `hooks.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Recurring Upcoming Widget`** (9 nodes): `RecurringUpcomingWidget.tsx`, `useRecurringPayments.ts`, `useConfirmPayment()`, `useCreateRecurringPayment()`, `useDeleteRecurringPayment()`, `useRecurringPayments()`, `useUpdateRecurringPayment()`, `cn()`, `RecurringUpcomingWidget()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Swipeable Transaction Item`** (8 nodes): `SwipeableTransactionItem.tsx`, `cn()`, `handleMouseDown()`, `handleMouseMove()`, `handleMouseUp()`, `handleTouchEnd()`, `handleTouchMove()`, `handleTouchStart()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Notes List View`** (8 nodes): `NotesListView.tsx`, `createTopic()`, `filterItems()`, `handleEditKeyPress()`, `handleTopicSwitch()`, `highlightText()`, `NotebookLine()`, `startEditing()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Smart Alert Picker`** (8 nodes): `SmartAlertPicker.tsx`, `cn()`, `formatTime12h()`, `getDisplayText()`, `handleClickOutside()`, `handlePresetClick()`, `handleSaveCustom()`, `isPresetSelected()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sidebar UI`** (7 nodes): `sidebar.tsx`, `cn()`, `handleKeyDown()`, `SidebarMenu()`, `SidebarMenuButton()`, `SidebarMenuItem()`, `useSidebar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Balance Reset Editor`** (6 nodes): `cancelResetEditor()`, `fmt()`, `openResetEditor()`, `saveResetEditor()`, `saveUsage()`, `ModelCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sync Context`** (6 nodes): `SyncIndicator.tsx`, `SyncProvider()`, `SyncContext.tsx`, `useSyncSafe()`, `cn()`, `SyncIndicator()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Watch Error Boundary`** (6 nodes): `WatchErrorBoundary.tsx`, `WatchErrorBoundary`, `.componentDidCatch()`, `.constructor()`, `.getDerivedStateFromError()`, `.render()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Draft Hooks`** (6 nodes): `fetchDrafts()`, `useConfirmDraft()`, `useDeleteDraft()`, `useDraftCount()`, `useDrafts()`, `useDrafts.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc API Routes`** (5 nodes): `route.ts`, `route.ts`, `route.ts`, `GET()`, `getPartnerUserId()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `New Category Drawer`** (5 nodes): `NewCategoryDrawer.tsx`, `handleAddSubcategory()`, `handleCreate()`, `handleRemoveSubcategory()`, `resetForm()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `QR Scanner`** (5 nodes): `QRScannerDrawer.tsx`, `handleCloseConfirm()`, `handleScan()`, `handleSubmit()`, `parseQRUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Privacy Blur Context`** (5 nodes): `BlurredAmount.tsx`, `PrivacyBlurProvider()`, `PrivacyBlurContext.tsx`, `usePrivacyBlur()`, `BlurredAmount()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Section Order Preferences`** (5 nodes): `useSectionOrder.ts`, `getCachedSectionOrder()`, `useSectionOrder()`, `useUpdatePreferences()`, `useUpdateSectionOrder()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth API Route A`** (3 nodes): `route.ts`, `getBaseUrl()`, `POST()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth API Route B`** (3 nodes): `route.ts`, `getBaseUrl()`, `POST()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mixed API Route A`** (3 nodes): `route.ts`, `GET()`, `POST()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mixed API Route B`** (3 nodes): `route.ts`, `GET()`, `POST()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Atlas Page`** (3 nodes): `page.tsx`, `AtlasPage()`, `loadAtlas()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AI Model Dialog`** (3 nodes): `reset()`, `submit()`, `AddModelDialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Account Select`** (3 nodes): `AccountSelect.tsx`, `onAddAccount()`, `setSelected()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `New Subcategory Drawer`** (3 nodes): `NewSubcategoryDrawer.tsx`, `handleCreate()`, `resetForm()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Template Quick Entry`** (3 nodes): `TemplateQuickEntryButton.tsx`, `async()`, `refreshTemplates()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Query Invalidation`** (3 nodes): `clearAnalyticsLocalStorage()`, `invalidateAccountData()`, `queryInvalidation.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `format()` connect `Secondary API Routes` to `Mobile Expense Form`, `Dashboard & AI Usage`, `Reminders & Calendar`, `Finance Detail Views`, `Comparison Analytics`, `Category V2 Charts`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Why does `supabaseServer()` connect `API Route Handlers` to `Secondary API Routes`, `Category API Routes`, `Auth & Data API Routes`, `Mixed API Routes`, `AI Chat Engine`, `Health API Route`, `Product Scraper`, `Page Entry Points`, `Statement Import`, `Misc API Routes`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **Why does `AddFlexibleFromCatalogueDialog()` connect `Dashboard & AI Usage` to `Theme & Preferences`, `Secondary API Routes`, `Admin UI & Tooling`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Are the 187 inferred relationships involving `supabaseServer()` (e.g. with `GET()` and `POST()`) actually correct?**
  _`supabaseServer()` has 187 INFERRED edges - model-reasoned connections that need verification._
- **Are the 51 inferred relationships involving `safeFetch()` (e.g. with `submit()` and `resendReset()`) actually correct?**
  _`safeFetch()` has 51 INFERRED edges - model-reasoned connections that need verification._
- **Are the 44 inferred relationships involving `format()` (e.g. with `GET()` and `GET()`) actually correct?**
  _`format()` has 44 INFERRED edges - model-reasoned connections that need verification._
- **Are the 29 inferred relationships involving `supabaseAdmin()` (e.g. with `POST()` and `GET()`) actually correct?**
  _`supabaseAdmin()` has 29 INFERRED edges - model-reasoned connections that need verification._