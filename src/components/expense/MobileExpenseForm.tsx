/**
 * Mobile-First Expense Entry Component
 * Optimized for thumb-zone interactions and quick entry
 */
"use client";

import {
  CalculatorIcon,
  CheckIcon,
  ChevronLeftIcon,
  PlusIcon,
  XIcon,
} from "@/components/icons/FuturisticIcons";
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
import { MOBILE_CONTENT_BOTTOM_OFFSET } from "@/constants/layout";
import {
  useDeleteAccount,
  useMyAccounts,
  useReorderAccounts,
} from "@/features/accounts/hooks";
import {
  useDeleteCategory,
  useReorderCategories,
} from "@/features/categories/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import {
  useSectionOrder,
  type SectionKey,
} from "@/features/preferences/useSectionOrder";
import {
  useAddTransaction,
  useDeleteTransaction,
} from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { format } from "date-fns";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import { AlertTriangle, GripVertical, Minus, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { toast } from "sonner";
import AccountBalance from "./AccountBalance";
import CalculatorDialog from "./CalculatorDialog";
import { useExpenseForm } from "./ExpenseFormContext";
import NewAccountDrawer from "./NewAccountDrawer";
import NewCategoryDrawer from "./NewCategoryDrawer";
import VoiceEntryButton from "./VoiceEntryButton";

type Step = SectionKey | "confirm";

// Delete confirmation state type
type DeleteConfirmState = {
  id: string;
  name: string;
  color?: string;
  type: "account" | "category" | "subcategory";
  step: "first" | "second";
} | null;

// Long press hook for edit mode
function useLongPress(callback: () => void, threshold = 500) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      callback();
    }, threshold);
  }, [callback, threshold]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
  };
}

export default function MobileExpenseForm() {
  const {
    step,
    setStep,
    amount,
    setAmount,
    selectedAccountId,
    setSelectedAccountId,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedSubcategoryId,
    setSelectedSubcategoryId,
    description,
    setDescription,
    date,
    setDate,
    setIsEditMode,
    exitEditModeRef,
  } = useExpenseForm();

  const { data: sectionOrder, isLoading: sectionOrderLoading } =
    useSectionOrder();

  const stepFlow = useMemo<Step[]>(() => {
    if (!sectionOrder || sectionOrder.length === 0) {
      return ["amount", "account", "category", "subcategory"];
    }
    return [...sectionOrder];
  }, [sectionOrder]);

  // Use only the current user's own accounts (not partner's) for the expense form
  const { data: accounts = [], isLoading: accountsLoading } = useMyAccounts();
  const defaultAccount = accounts.find((a: any) => a.is_default);

  const getFirstValidStep = (flow: Step[], hasDefault: boolean): Step => {
    for (const s of flow) {
      if (s === "account" && hasDefault) continue;
      return s;
    }
    return flow[0] || "amount";
  };

  const firstValidStep = useMemo(
    () => getFirstValidStep(stepFlow, !!defaultAccount),
    [stepFlow, defaultAccount]
  );

  const [isInitialized, setIsInitialized] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showNewAccountDrawer, setShowNewAccountDrawer] = useState(false);
  const [showNewCategoryDrawer, setShowNewCategoryDrawer] = useState(false);

  // Edit mode states for each section
  const [editModeAccount, setEditModeAccount] = useState(false);
  const [editModeCategory, setEditModeCategory] = useState(false);
  const [editModeSubcategory, setEditModeSubcategory] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track if order has changed (to know whether to save on exit)
  const [accountsOrderChanged, setAccountsOrderChanged] = useState(false);
  const [categoriesOrderChanged, setCategoriesOrderChanged] = useState(false);
  const [subcategoriesOrderChanged, setSubcategoriesOrderChanged] =
    useState(false);

  // Track if save is in progress (to prevent sync from resetting during mutation)
  // These stay true until the NEXT time categories data changes from server
  const [accountsSaving, setAccountsSaving] = useState(false);
  const [categoriesSaving, setCategoriesSaving] = useState(false);
  const [subcategoriesSaving, setSubcategoriesSaving] = useState(false);

  // Track the last saved order to compare and know when server has caught up
  const lastSavedCategoriesRef = useRef<string | null>(null);
  const lastSavedSubcategoriesRef = useRef<string | null>(null);
  const lastSavedAccountsRef = useRef<string | null>(null);

  const { data: categories = [], refetch: refetchCategories } =
    useCategories(selectedAccountId);
  const addTransactionMutation = useAddTransaction();
  const deleteTransactionMutation = useDeleteTransaction();
  const deleteAccountMutation = useDeleteAccount();
  const deleteCategoryMutation = useDeleteCategory(selectedAccountId);
  const reorderAccountsMutation = useReorderAccounts();
  const reorderCategoriesMutation = useReorderCategories(selectedAccountId);
  const themeClasses = useThemeClasses();

  // Ordered lists for drag-and-drop (local state synced with data)
  const [orderedAccounts, setOrderedAccounts] = useState<any[]>([]);
  const [orderedCategories, setOrderedCategories] = useState<any[]>([]);
  const [orderedSubcategories, setOrderedSubcategories] = useState<any[]>([]);

  // Sync accounts with ordered list (only when NOT in edit mode and NOT saving)
  useEffect(() => {
    if (accounts.length > 0 && !editModeAccount && !accountsSaving) {
      // Skip sync if we just saved - keep our local order until next fresh fetch
      if (lastSavedAccountsRef.current) {
        lastSavedAccountsRef.current = null;
        return;
      }
      setOrderedAccounts(accounts);
      setAccountsOrderChanged(false);
    }
  }, [accounts, editModeAccount, accountsSaving]);

  // Sync categories with ordered list (only when NOT in edit mode and NOT saving)
  useEffect(() => {
    if (!editModeCategory && !categoriesSaving) {
      const rootCats = categories.filter((c: any) => !c.parent_id);
      if (rootCats.length > 0) {
        // Skip sync if we just saved - keep our local order until next fresh fetch
        if (lastSavedCategoriesRef.current) {
          // Just clear the flag, don't sync from stale server data
          lastSavedCategoriesRef.current = null;
          return;
        }
        setOrderedCategories(rootCats);
        setCategoriesOrderChanged(false);
      }
    }
  }, [categories, editModeCategory, categoriesSaving]);

  // Sync subcategories with ordered list when category changes (only when NOT in edit mode and NOT saving)
  useEffect(() => {
    if (!editModeSubcategory && !subcategoriesSaving) {
      if (selectedCategoryId) {
        const subs = categories.filter(
          (c: any) => c.parent_id === selectedCategoryId
        );
        const selectedCategoryData = categories.find(
          (c: any) => c.id === selectedCategoryId
        );
        const nestedSubs = (selectedCategoryData as any)?.subcategories || [];
        const newSubs = [...subs, ...nestedSubs];

        // Skip sync if we just saved - keep our local order until next fresh fetch
        if (lastSavedSubcategoriesRef.current) {
          // Just clear the flag, don't sync from stale server data
          lastSavedSubcategoriesRef.current = null;
          return;
        }
        setOrderedSubcategories(newSubs);
        setSubcategoriesOrderChanged(false);
      } else {
        // Only clear if not already empty to avoid infinite loop
        setOrderedSubcategories((prev) => (prev.length > 0 ? [] : prev));
      }
    }
  }, [
    selectedCategoryId,
    categories,
    editModeSubcategory,
    subcategoriesSaving,
  ]);

  // Handle reorder - just update local state and mark as changed
  const handleAccountsReorder = (newOrder: any[]) => {
    setOrderedAccounts(newOrder);
    setAccountsOrderChanged(true);
  };

  const handleCategoriesReorder = (newOrder: any[]) => {
    setOrderedCategories(newOrder);
    setCategoriesOrderChanged(true);
  };

  const handleSubcategoriesReorder = (newOrder: any[]) => {
    setOrderedSubcategories(newOrder);
    setSubcategoriesOrderChanged(true);
  };

  // Save functions - called when exiting edit mode
  const saveAccountsOrder = useCallback(() => {
    if (accountsOrderChanged && orderedAccounts.length > 0) {
      setAccountsSaving(true);
      // Store the order we're saving so we don't reset to it later
      lastSavedAccountsRef.current = orderedAccounts.map((a) => a.id).join(",");
      const updates = orderedAccounts.map((account, index) => ({
        id: account.id,
        position: index,
      }));
      reorderAccountsMutation.mutate(updates, {
        onSuccess: () => {
          toast.success("Accounts reordered", { icon: ToastIcons.update });
          setAccountsSaving(false);
        },
        onError: () => {
          toast.error("Failed to save order", { icon: ToastIcons.error });
          lastSavedAccountsRef.current = null; // Clear on error to allow resync
          setAccountsSaving(false);
        },
      });
    }
    setAccountsOrderChanged(false);
  }, [accountsOrderChanged, orderedAccounts, reorderAccountsMutation]);

  const saveCategoriesOrder = useCallback(() => {
    if (categoriesOrderChanged && orderedCategories.length > 0) {
      setCategoriesSaving(true);
      // Store the order we're saving so we don't reset to it later
      lastSavedCategoriesRef.current = orderedCategories
        .map((c) => c.id)
        .join(",");
      const updates = orderedCategories.map((category, index) => ({
        id: category.id,
        position: index + 1, // API requires 1-based positions
      }));
      reorderCategoriesMutation.mutate(updates, {
        onSuccess: () => {
          toast.success("Categories reordered", { icon: ToastIcons.update });
          setCategoriesSaving(false);
        },
        onError: () => {
          toast.error("Failed to save order", { icon: ToastIcons.error });
          lastSavedCategoriesRef.current = null; // Clear on error to allow resync
          setCategoriesSaving(false);
        },
      });
    }
    setCategoriesOrderChanged(false);
  }, [categoriesOrderChanged, orderedCategories, reorderCategoriesMutation]);

  const saveSubcategoriesOrder = useCallback(() => {
    if (subcategoriesOrderChanged && orderedSubcategories.length > 0) {
      setSubcategoriesSaving(true);
      // Store the order we're saving so we don't reset to it later
      lastSavedSubcategoriesRef.current = orderedSubcategories
        .map((s) => s.id)
        .join(",");
      const updates = orderedSubcategories.map((sub, index) => ({
        id: sub.id,
        position: index + 1, // API requires 1-based positions
      }));
      reorderCategoriesMutation.mutate(updates, {
        onSuccess: () => {
          toast.success("Subcategories reordered", { icon: ToastIcons.update });
          setSubcategoriesSaving(false);
        },
        onError: () => {
          toast.error("Failed to save order", { icon: ToastIcons.error });
          lastSavedSubcategoriesRef.current = null; // Clear on error to allow resync
          setSubcategoriesSaving(false);
        },
      });
    }
    setSubcategoriesOrderChanged(false);
  }, [
    subcategoriesOrderChanged,
    orderedSubcategories,
    reorderCategoriesMutation,
  ]);

  // Check if any edit mode is active
  const isAnyEditMode =
    editModeAccount || editModeCategory || editModeSubcategory;

  // Exit edit mode and save changes if any
  const exitEditModeAccount = useCallback(() => {
    if (accountsOrderChanged) {
      saveAccountsOrder();
    }
    setEditModeAccount(false);
  }, [accountsOrderChanged, saveAccountsOrder]);

  const exitEditModeCategory = useCallback(() => {
    if (categoriesOrderChanged) {
      saveCategoriesOrder();
    }
    setEditModeCategory(false);
  }, [categoriesOrderChanged, saveCategoriesOrder]);

  const exitEditModeSubcategory = useCallback(() => {
    if (subcategoriesOrderChanged) {
      saveSubcategoriesOrder();
    }
    setEditModeSubcategory(false);
  }, [subcategoriesOrderChanged, saveSubcategoriesOrder]);

  // Exit all edit modes (called from floating button or backdrop)
  const exitAllEditModes = useCallback(() => {
    if (editModeAccount) exitEditModeAccount();
    if (editModeCategory) exitEditModeCategory();
    if (editModeSubcategory) exitEditModeSubcategory();
  }, [
    editModeAccount,
    editModeCategory,
    editModeSubcategory,
    exitEditModeAccount,
    exitEditModeCategory,
    exitEditModeSubcategory,
  ]);

  // Sync edit mode state to context (so floating button can be rendered at layout level)
  useEffect(() => {
    setIsEditMode(isAnyEditMode);
  }, [isAnyEditMode, setIsEditMode]);

  // Register the exit callback using ref (no re-renders, no infinite loops)
  // This runs on every render to keep the ref current
  exitEditModeRef.current = () => {
    if (editModeAccount) {
      if (accountsOrderChanged) saveAccountsOrder();
      setEditModeAccount(false);
    }
    if (editModeCategory) {
      if (categoriesOrderChanged) saveCategoriesOrder();
      setEditModeCategory(false);
    }
    if (editModeSubcategory) {
      if (subcategoriesOrderChanged) saveSubcategoriesOrder();
      setEditModeSubcategory(false);
    }
  };

  // Long press handlers for each section
  const accountLongPress = useLongPress(() => {
    setEditModeAccount(true);
    if (navigator.vibrate) navigator.vibrate(50);
  });

  const categoryLongPress = useLongPress(() => {
    setEditModeCategory(true);
    if (navigator.vibrate) navigator.vibrate(50);
  });

  const subcategoryLongPress = useLongPress(() => {
    setEditModeSubcategory(true);
    if (navigator.vibrate) navigator.vibrate(50);
  });

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.step === "first") {
      setDeleteConfirm({ ...deleteConfirm, step: "second" });
    } else {
      setIsDeleting(true);
      try {
        if (deleteConfirm.type === "account") {
          await deleteAccountMutation.mutateAsync(deleteConfirm.id);
          if (selectedAccountId === deleteConfirm.id) {
            setSelectedAccountId(undefined as any);
          }
          toast.success("Account deleted", { icon: ToastIcons.delete });
        } else {
          await deleteCategoryMutation.mutateAsync(deleteConfirm.id);
          if (
            deleteConfirm.type === "category" &&
            selectedCategoryId === deleteConfirm.id
          ) {
            setSelectedCategoryId(undefined as any);
          }
          if (
            deleteConfirm.type === "subcategory" &&
            selectedSubcategoryId === deleteConfirm.id
          ) {
            setSelectedSubcategoryId(undefined);
          }
          toast.success(
            `${deleteConfirm.type === "category" ? "Category" : "Subcategory"} deleted`,
            {
              icon: ToastIcons.delete,
            }
          );
        }
        setDeleteConfirm(null);
      } catch (error: any) {
        toast.error(error.message || "Failed to delete", {
          icon: ToastIcons.error,
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  useEffect(() => {
    if (stepFlow.length > 0 && !accountsLoading) {
      setStep(firstValidStep);
      setIsInitialized(true);
    }
  }, [stepFlow, firstValidStep, accountsLoading]);

  useEffect(() => {
    if (defaultAccount && !selectedAccountId) {
      setSelectedAccountId(defaultAccount.id);
    }
  }, [accounts, selectedAccountId, defaultAccount]);

  const subcategories = selectedCategoryId
    ? categories.filter((c: any) => c.parent_id === selectedCategoryId)
    : [];

  const selectedCategoryData = categories.find(
    (c: any) => c.id === selectedCategoryId
  );
  const nestedSubcategories =
    (selectedCategoryData as any)?.subcategories || [];

  const allSubcategories = [...subcategories, ...nestedSubcategories];

  const selectedAccount = accounts.find((a: any) => a.id === selectedAccountId);
  const selectedCategory = categories.find(
    (c: any) => c.id === selectedCategoryId
  );
  const selectedSubcategory = allSubcategories.find(
    (s: any) => s.id === selectedSubcategoryId
  );

  const canSubmit = amount && selectedAccountId && selectedCategoryId;
  const isAmountStep = step === "amount";
  const closeDisabled =
    isAmountStep && (!amount || Number.parseFloat(amount) <= 0);

  const handleSubmit = async () => {
    if (!canSubmit || addTransactionMutation.isPending) return;

    // Store current values for undo
    const transactionData = {
      account_id: selectedAccountId,
      category_id: selectedCategoryId,
      subcategory_id: selectedSubcategoryId || null,
      amount: parseFloat(amount),
      description: description || undefined,
      date: format(date, "yyyy-MM-dd"),
      is_private: isPrivate,
      // Include display names for optimistic UI
      _optimistic: {
        category_name: selectedCategory?.name ?? null,
        subcategory_name: selectedSubcategory?.name ?? null,
        account_name: selectedAccount?.name ?? null,
        category_icon: (selectedCategory as any)?.icon ?? null,
        category_color: (selectedCategory as any)?.color ?? null,
        subcategory_color: (selectedSubcategory as any)?.color ?? null,
      },
    };

    // Store values for undo before resetting form
    const amountForToast = amount;
    const categoryNameForToast = selectedCategory?.name;
    const isIncomeForToast = selectedAccount?.type === "income";

    // Reset form immediately for instant UI feedback
    setAmount("");
    setSelectedCategoryId(undefined);
    setSelectedSubcategoryId(undefined);
    setDescription("");
    setIsPrivate(false);
    const newDefaultAccount = accounts.find((a: any) => a.is_default);
    if (newDefaultAccount) {
      setSelectedAccountId(newDefaultAccount.id);
    } else {
      setSelectedAccountId(undefined);
    }
    setStep(firstValidStep);

    // Optimistic add - mutation hook handles cache updates
    addTransactionMutation.mutate(transactionData, {
      onSuccess: (newTransaction) => {
        toast.success(isIncomeForToast ? "Income added!" : "Expense added!", {
          icon: ToastIcons.create,
          description: `$${amountForToast} for ${categoryNameForToast}`,
          action: {
            label: "Undo",
            onClick: () => {
              deleteTransactionMutation.mutate(newTransaction.id, {
                onSuccess: () =>
                  toast.success("Transaction undone", {
                    icon: ToastIcons.delete,
                  }),
                onError: () =>
                  toast.error("Failed to undo", { icon: ToastIcons.error }),
              });
            },
          },
        });
      },
      onError: () => {
        toast.error(
          `Failed to add ${selectedAccount?.type === "income" ? "income" : "expense"}`,
          { icon: ToastIcons.error }
        );
      },
    });
  };

  const goBack = () => {
    if (navigator.vibrate) {
      navigator.vibrate([5, 5, 5]); // Triple haptic pulse for premium feel
    }
    const currentIndex = stepFlow.indexOf(step as Step);
    if (currentIndex <= 0) return;

    for (let i = currentIndex - 1; i >= 0; i--) {
      const prevStep = stepFlow[i];
      if (prevStep === "account" && defaultAccount) continue;
      setStep(prevStep);
      return;
    }
  };

  const progress = () => {
    let visibleSteps = [...stepFlow];
    if (defaultAccount && visibleSteps.includes("account")) {
      visibleSteps = visibleSteps.filter((s) => s !== "account");
    }
    const currentIndex = visibleSteps.indexOf(step as Step);
    if (currentIndex === -1) return 0;
    return ((currentIndex + 1) / visibleSteps.length) * 100;
  };

  const getNextStep = (): Step | null => {
    const currentIndex = stepFlow.indexOf(step as Step);
    if (currentIndex === -1) return null;

    for (let i = currentIndex + 1; i < stepFlow.length; i++) {
      const nextStep = stepFlow[i];
      if (nextStep === "account" && defaultAccount) continue;
      return nextStep;
    }
    return null;
  };

  const contentAreaStyles: CSSProperties = {
    bottom: `calc(env(safe-area-inset-bottom) + ${MOBILE_CONTENT_BOTTOM_OFFSET}px)`,
  };

  return (
    <div className="fixed inset-0 top-14 bg-bg-dark flex flex-col">
      {!isInitialized ? (
        <div className="fixed inset-0 top-14 bg-bg-dark loading-fade" />
      ) : (
        <>
          {/* HEADER - TOP DELIMITER - Must be above all other UI elements */}
          <div
            className={`fixed top-0 left-0 right-0 z-[100] bg-gradient-to-b from-bg-card-custom to-bg-medium border-b ${themeClasses.border} px-3 pb-2 shadow-2xl shadow-black/10 backdrop-blur-xl slide-in-top`}
          >
            <div className="flex items-center justify-between mb-2 pt-16">
              {step !== firstValidStep ? (
                <button
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(5);
                    goBack();
                  }}
                  suppressHydrationWarning
                  className={`p-1.5 -ml-2 rounded-lg ${themeClasses.bgSurface} hover:bg-opacity-30 active:scale-95 transition-all duration-200 ${themeClasses.border} hover:shadow-md`}
                >
                  <ChevronLeftIcon
                    className={`w-5 h-5 ${themeClasses.text} ${themeClasses.iconGlow}`}
                  />
                </button>
              ) : (
                <div className="w-8" />
              )}
              <h1
                className={`text-sm font-semibold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent ${themeClasses.glow}`}
              >
                New {selectedAccount?.type === "income" ? "Income" : "Expense"}
              </h1>
              <button
                onClick={
                  closeDisabled
                    ? undefined
                    : () => {
                        setAmount("");
                        setSelectedCategoryId(undefined);
                        setSelectedSubcategoryId(undefined);
                        setDescription("");
                        setStep(firstValidStep);
                      }
                }
                suppressHydrationWarning
                disabled={closeDisabled}
                className={cn(
                  "p-1.5 -mr-2 rounded-lg",
                  closeDisabled
                    ? `${themeClasses.bgSurface} ${themeClasses.border} opacity-50 cursor-not-allowed`
                    : `${themeClasses.bgSurface} hover:bg-opacity-30 active:scale-95 transition-all ${themeClasses.border}`
                )}
              >
                <XIcon className={`w-5 h-5 ${themeClasses.text}`} />
              </button>
            </div>
            <div className="h-0.5 bg-bg-card-custom rounded-full overflow-hidden relative">
              <div
                className={`h-full bg-gradient-to-r ${themeClasses.activeItemGradient} transition-all duration-500 ease-out neo-glow-sm glow-pulse-primary`}
                style={{ width: `${progress()}%` }}
              />
            </div>
            {selectedAccountId && step === "amount" && (
              <div className="mt-2">
                <AccountBalance
                  accountId={selectedAccountId}
                  accountName={selectedAccount?.name}
                />
              </div>
            )}
          </div>

          <div
            className={cn(
              "fixed left-0 right-0 overflow-y-auto px-3 py-3 bg-bg-dark z-[45]",
              selectedAccountId && step === "amount"
                ? "top-[205px]"
                : "top-[80px]"
            )}
            style={contentAreaStyles}
            onClick={(e) => {
              // If in edit mode and clicked on empty space (not a widget), exit edit mode
              if (isAnyEditMode && e.target === e.currentTarget) {
                exitAllEditModes();
              }
            }}
          >
            {step === "amount" && (
              <div key="amount-step" className="space-y-3 step-slide-in">
                <div>
                  <Label
                    className={`text-xs ${themeClasses.text} font-medium mb-1 block text-center`}
                  >
                    How much did you spend?
                  </Label>
                  <div className="mt-1 relative flex items-center">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[hsl(var(--text-muted-light)/0.6)] pointer-events-none z-10">
                      $
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      suppressHydrationWarning
                      className={`text-3xl font-bold h-16 pl-12 pr-24 border-2 text-center bg-bg-card-custom ${themeClasses.border} text-white placeholder:text-[hsl(var(--input-placeholder)/0.3)] ${themeClasses.focusBorder} focus:ring-2 ${themeClasses.focusRing} focus:scale-[1.02] transition-all duration-200 neo-card bounce-in`}
                      autoFocus
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                      <button
                        onClick={() => setShowCalculator(true)}
                        suppressHydrationWarning
                        className={cn(
                          "p-2.5 rounded-lg border active:scale-95 transition-all",
                          themeClasses.border,
                          themeClasses.bgHover
                        )}
                      >
                        <CalculatorIcon
                          className={cn(
                            "w-5 h-5",
                            themeClasses.text,
                            themeClasses.glow
                          )}
                        />
                      </button>
                      <VoiceEntryButton
                        categories={categories}
                        accountId={selectedAccountId}
                        onPreviewChange={() => {}}
                        onParsed={({
                          sentence,
                          amount: voiceAmount,
                          categoryId,
                          subcategoryId,
                        }) => {
                          if (voiceAmount != null && !isNaN(voiceAmount))
                            setAmount(String(voiceAmount));
                          if (categoryId) setSelectedCategoryId(categoryId);
                          if (subcategoryId)
                            setSelectedSubcategoryId(subcategoryId);
                        }}
                        onDraftCreated={() => {
                          toast.success(
                            "Voice entry saved! Check drafts to confirm."
                          );
                        }}
                        className={cn(
                          "p-2.5 rounded-lg border active:scale-95 transition-all",
                          themeClasses.border,
                          themeClasses.bgHover
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 20, 50].map((val, index) => (
                    <Button
                      key={val}
                      variant="outline"
                      style={{ animationDelay: `${100 + index * 40}ms` }}
                      className={cn(
                        "h-9 text-sm font-semibold neo-card bg-bg-card-custom transition-all category-appear hover:scale-105 active:scale-95",
                        themeClasses.border,
                        themeClasses.bgHover,
                        themeClasses.borderHover
                      )}
                      onClick={() => setAmount(val.toString())}
                    >
                      <span className={themeClasses.text}>${val}</span>
                    </Button>
                  ))}
                </div>

                <Button
                  size="lg"
                  className="w-full h-12 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 transition-all active:scale-[0.98] spring-bounce"
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                    const next = getNextStep();
                    if (next) {
                      setStep(next);
                    } else {
                      handleSubmit();
                    }
                  }}
                  disabled={!amount || parseFloat(amount) <= 0}
                >
                  Next
                </Button>
              </div>
            )}

            {step === "amount" && (
              <div>
                {/* Private/Public Lock Icon (shown only on Amount step) */}
                <div className="flex items-center justify-end px-1 py-2">
                  <button
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={cn(
                      "group relative p-3 rounded-xl border transition-all duration-300 active:scale-95 flex items-center gap-2.5 overflow-hidden",
                      isPrivate
                        ? `${themeClasses.borderActive} bg-gradient-to-br ${themeClasses.activeItemGradient} ${themeClasses.activeItemShadow} hover:shadow-[0_0_25px_rgba(20,184,166,0.35),0_0_50px_rgba(6,182,212,0.2)]`
                        : `neo-card ${themeClasses.border} ${themeClasses.borderHover}`
                    )}
                  >
                    {/* Animated background glow when private */}
                    {isPrivate && (
                      <div
                        className={`absolute inset-0 bg-gradient-to-r ${themeClasses.iconBg} animate-[shimmer_3s_ease-in-out_infinite]`}
                      />
                    )}

                    <span
                      className={cn(
                        "relative text-sm font-semibold tracking-wide transition-all duration-300",
                        isPrivate
                          ? `${themeClasses.textActive} drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]`
                          : `${themeClasses.textFaint} ${themeClasses.textHover}`
                      )}
                    >
                      {isPrivate ? "Private" : "Public"}
                    </span>
                    <svg
                      className={cn(
                        "relative w-5 h-5 transition-all duration-500",
                        isPrivate
                          ? `${themeClasses.textActive} drop-shadow-[0_0_10px_rgba(20,184,166,0.8)] animate-pulse`
                          : `${themeClasses.textFaint} ${themeClasses.textHover}`
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      {isPrivate ? (
                        // Locked icon
                        <>
                          <rect
                            x="5"
                            y="11"
                            width="14"
                            height="10"
                            rx="2"
                            ry="2"
                          />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </>
                      ) : (
                        // Unlocked icon
                        <>
                          <rect
                            x="5"
                            y="11"
                            width="14"
                            height="10"
                            rx="2"
                            ry="2"
                          />
                          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {step === "account" && (
              <div key="account-step" className="space-y-3 step-slide-in">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold text-secondary">
                    Which account?
                  </Label>
                  {editModeAccount && (
                    <button
                      onClick={exitEditModeAccount}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors animate-in fade-in"
                    >
                      <X className="w-4 h-4" />
                      Done
                    </button>
                  )}
                </div>

                {editModeAccount && (
                  <p className="text-xs text-cyan-400 animate-in fade-in slide-in-from-top-2">
                    Drag to reorder • Tap{" "}
                    <span className="inline-flex items-center justify-center w-4 h-4 bg-red-500 rounded-full mx-0.5">
                      <Minus className="w-3 h-3 text-white" />
                    </span>{" "}
                    to delete
                  </p>
                )}

                <div {...accountLongPress} className="space-y-2">
                  {editModeAccount ? (
                    <Reorder.Group
                      axis="y"
                      values={orderedAccounts}
                      onReorder={handleAccountsReorder}
                      className="space-y-2"
                    >
                      {orderedAccounts.map((account: any) => (
                        <Reorder.Item
                          key={account.id}
                          value={account}
                          className="relative"
                          whileDrag={{
                            scale: 1.02,
                            boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                            zIndex: 50,
                          }}
                        >
                          <motion.div
                            animate={{
                              rotate: [0, -0.3, 0.3, 0],
                            }}
                            transition={{
                              rotate: {
                                repeat: Infinity,
                                duration: 0.4,
                                ease: "easeInOut",
                              },
                            }}
                          >
                            {/* Delete button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({
                                  id: account.id,
                                  name: account.name,
                                  type: "account",
                                  step: "first",
                                });
                              }}
                              className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg transform transition-transform hover:scale-110 active:scale-95 animate-in fade-in zoom-in duration-200"
                            >
                              <Minus className="w-4 h-4" strokeWidth={3} />
                            </button>

                            <div
                              className={cn(
                                "w-full p-2.5 rounded-lg border text-left transition-all flex items-center gap-2",
                                selectedAccountId === account.id
                                  ? `neo-card ${themeClasses.borderActive} ${themeClasses.bgActive} neo-glow-sm`
                                  : `neo-card ${themeClasses.border} bg-bg-card-custom`
                              )}
                            >
                              {/* Drag handle */}
                              <div className="text-slate-500 cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-base text-white">
                                  {account.name}
                                </div>
                                <div className="text-xs text-accent/70 capitalize mt-0.5">
                                  {account.type}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {accounts.map((account: any, index: number) => (
                        <motion.div
                          key={account.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2, delay: index * 0.03 }}
                          className="relative"
                        >
                          <button
                            onClick={() => {
                              setSelectedAccountId(account.id);
                              const next = getNextStep();
                              if (next) {
                                setStep(next);
                              } else {
                                handleSubmit();
                              }
                            }}
                            className={cn(
                              "w-full p-2.5 rounded-lg border text-left transition-all active:scale-[0.98]",
                              selectedAccountId === account.id
                                ? `neo-card ${themeClasses.borderActive} ${themeClasses.bgActive} neo-glow-sm`
                                : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover} ${themeClasses.bgHover}`
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-semibold text-base text-white">
                                  {account.name}
                                </div>
                                <div className="text-xs text-accent/70 capitalize mt-0.5">
                                  {account.type}
                                </div>
                              </div>
                              {selectedAccountId === account.id && (
                                <CheckIcon className="w-5 h-5 text-secondary drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                              )}
                            </div>
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}

                  {/* Add New Account Button */}
                  {!editModeAccount && (
                    <button
                      onClick={() => setShowNewAccountDrawer(true)}
                      style={{ animationDelay: `${accounts.length * 40}ms` }}
                      className="w-full p-2.5 rounded-lg border-2 border-dashed border-slate-600 hover:border-cyan-500/50 text-center transition-all active:scale-[0.98] category-appear bg-transparent hover:bg-cyan-500/5"
                    >
                      <div className="flex items-center justify-center gap-2 text-slate-400 hover:text-cyan-400">
                        <PlusIcon className="w-5 h-5" />
                        <span className="font-medium">New Account</span>
                      </div>
                    </button>
                  )}
                </div>

                {!editModeAccount && accounts.length > 0 && (
                  <p className="text-[10px] text-slate-600 text-center">
                    Hold to edit accounts
                  </p>
                )}
              </div>
            )}

            {step === "category" && (
              <div key="category-step" className="space-y-3 step-slide-in">
                <div className="flex items-center justify-between">
                  <Label
                    className={`text-base font-semibold ${themeClasses.text}`}
                  >
                    What category?
                  </Label>
                  {editModeCategory && (
                    <button
                      onClick={exitEditModeCategory}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors animate-in fade-in"
                    >
                      <X className="w-4 h-4" />
                      Done
                    </button>
                  )}
                </div>

                {editModeCategory && (
                  <p className="text-xs text-cyan-400 animate-in fade-in slide-in-from-top-2">
                    Drag to reorder • Tap{" "}
                    <span className="inline-flex items-center justify-center w-4 h-4 bg-red-500 rounded-full mx-0.5">
                      <Minus className="w-3 h-3 text-white" />
                    </span>{" "}
                    to delete
                  </p>
                )}

                <div {...categoryLongPress}>
                  {editModeCategory ? (
                    <Reorder.Group
                      axis="y"
                      values={orderedCategories}
                      onReorder={handleCategoriesReorder}
                      className="space-y-2 pb-4"
                    >
                      {orderedCategories.map((category: any) => {
                        const color = category.color || "#22d3ee";
                        const IconComponent = getCategoryIcon(
                          category.name,
                          category.slug
                        );

                        return (
                          <Reorder.Item
                            key={category.id}
                            value={category}
                            className="relative"
                            whileDrag={{
                              scale: 1.02,
                              boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                              zIndex: 50,
                            }}
                          >
                            <motion.div
                              animate={{
                                rotate: [0, -0.3, 0.3, 0],
                              }}
                              transition={{
                                rotate: {
                                  repeat: Infinity,
                                  duration: 0.4,
                                  ease: "easeInOut",
                                },
                              }}
                            >
                              {/* Delete button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm({
                                    id: category.id,
                                    name: category.name,
                                    color: color,
                                    type: "category",
                                    step: "first",
                                  });
                                }}
                                className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg transform transition-transform hover:scale-110 active:scale-95 animate-in fade-in zoom-in duration-200"
                              >
                                <Minus className="w-4 h-4" strokeWidth={3} />
                              </button>

                              <div
                                className={cn(
                                  "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                                  `neo-card ${themeClasses.border} bg-bg-card-custom`
                                )}
                              >
                                {/* Drag handle */}
                                <div className="text-slate-500 cursor-grab active:cursor-grabbing">
                                  <GripVertical className="w-5 h-5" />
                                </div>
                                <div
                                  style={{
                                    color: color,
                                    filter: `drop-shadow(0 0 6px ${color}80)`,
                                  }}
                                >
                                  <IconComponent className="w-6 h-6" />
                                </div>
                                <span className="font-semibold text-sm text-white flex-1">
                                  {category.name}
                                </span>
                              </div>
                            </motion.div>
                          </Reorder.Item>
                        );
                      })}
                    </Reorder.Group>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pb-4">
                      {orderedCategories.length === 0 ? (
                        <div className="col-span-2 text-center py-4">
                          <p className="text-xs text-slate-500 mb-3">
                            No categories yet
                          </p>
                        </div>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {orderedCategories.map(
                            (category: any, index: number) => {
                              const active = selectedCategoryId === category.id;
                              const color = category.color || "#22d3ee";

                              return (
                                <motion.div
                                  key={category.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  transition={{
                                    duration: 0.2,
                                    delay: index * 0.02,
                                  }}
                                  className="relative"
                                >
                                  <button
                                    onClick={() => {
                                      setSelectedCategoryId(category.id);
                                      const hasSubcategories =
                                        categories.some(
                                          (c: any) =>
                                            c.parent_id === category.id
                                        ) ||
                                        (category as any).subcategories
                                          ?.length > 0;

                                      if (
                                        hasSubcategories &&
                                        stepFlow.includes("subcategory")
                                      ) {
                                        const next = getNextStep();
                                        if (next) {
                                          setStep(next);
                                        } else {
                                          handleSubmit();
                                        }
                                      } else {
                                        const next = getNextStep();
                                        if (next) {
                                          setStep(next);
                                        } else {
                                          handleSubmit();
                                        }
                                      }
                                    }}
                                    disabled={addTransactionMutation.isPending}
                                    style={{
                                      borderColor: active ? color : undefined,
                                      backgroundColor: active
                                        ? `${color}20`
                                        : undefined,
                                      boxShadow: active
                                        ? `0 0 15px ${color}40, inset 0 0 0 1px ${color}40`
                                        : undefined,
                                    }}
                                    className={cn(
                                      "w-full p-2.5 rounded-lg border text-left transition-all min-h-[65px] active:scale-95",
                                      active
                                        ? "neo-card neo-glow-sm"
                                        : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover} hover:bg-primary/5`,
                                      addTransactionMutation.isPending &&
                                        "opacity-50 cursor-not-allowed"
                                    )}
                                  >
                                    <div className="flex flex-col items-center justify-center gap-1 h-full">
                                      {(() => {
                                        const IconComponent = getCategoryIcon(
                                          category.name,
                                          category.slug
                                        );
                                        return (
                                          <div
                                            style={{
                                              color: color,
                                              filter: `drop-shadow(0 0 8px ${color}80)`,
                                            }}
                                          >
                                            <IconComponent className="w-7 h-7" />
                                          </div>
                                        );
                                      })()}
                                      <span
                                        className="font-semibold text-center text-xs"
                                        style={{
                                          color: active ? color : "white",
                                        }}
                                      >
                                        {category.name}
                                      </span>
                                    </div>
                                  </button>
                                </motion.div>
                              );
                            }
                          )}
                        </AnimatePresence>
                      )}
                      {/* Add New Category Button - at bottom */}
                      <button
                        onClick={() => setShowNewCategoryDrawer(true)}
                        className="p-2.5 rounded-lg border-2 border-dashed border-slate-600 hover:border-cyan-500/50 text-center transition-all active:scale-95 min-h-[65px] bg-transparent hover:bg-cyan-500/5 flex flex-col items-center justify-center gap-1 category-appear"
                      >
                        <PlusIcon className="w-6 h-6 text-slate-400" />
                        <span className="text-xs text-slate-400">New</span>
                      </button>
                    </div>
                  )}
                </div>

                {!editModeCategory && orderedCategories.length > 0 && (
                  <p className="text-[10px] text-slate-600 text-center -mt-2">
                    Hold to edit categories
                  </p>
                )}
              </div>
            )}

            {step === "subcategory" && (
              <div
                key="subcategory-step"
                className="space-y-4 step-slide-in pb-4"
              >
                {orderedSubcategories.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label
                        className={`text-base font-semibold ${themeClasses.text}`}
                      >
                        More specific?
                      </Label>
                      {editModeSubcategory && (
                        <button
                          onClick={exitEditModeSubcategory}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors animate-in fade-in"
                        >
                          <X className="w-4 h-4" />
                          Done
                        </button>
                      )}
                    </div>

                    {editModeSubcategory && (
                      <p className="text-xs text-cyan-400 animate-in fade-in slide-in-from-top-2">
                        Drag to reorder • Tap{" "}
                        <span className="inline-flex items-center justify-center w-4 h-4 bg-red-500 rounded-full mx-0.5">
                          <Minus className="w-3 h-3 text-white" />
                        </span>{" "}
                        to delete
                      </p>
                    )}

                    <div {...subcategoryLongPress}>
                      {editModeSubcategory ? (
                        <Reorder.Group
                          axis="y"
                          values={orderedSubcategories}
                          onReorder={handleSubcategoriesReorder}
                          className="space-y-2"
                        >
                          {orderedSubcategories.map((sub: any) => {
                            const color = sub.color || "#22d3ee";
                            const IconComponent = getCategoryIcon(sub.name);

                            return (
                              <Reorder.Item
                                key={sub.id}
                                value={sub}
                                className="relative"
                                whileDrag={{
                                  scale: 1.02,
                                  boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                                  zIndex: 50,
                                }}
                              >
                                <motion.div
                                  animate={{
                                    rotate: [0, -0.3, 0.3, 0],
                                  }}
                                  transition={{
                                    rotate: {
                                      repeat: Infinity,
                                      duration: 0.4,
                                      ease: "easeInOut",
                                    },
                                  }}
                                >
                                  {/* Delete button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirm({
                                        id: sub.id,
                                        name: sub.name,
                                        color: color,
                                        type: "subcategory",
                                        step: "first",
                                      });
                                    }}
                                    className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg transform transition-transform hover:scale-110 active:scale-95 animate-in fade-in zoom-in duration-200"
                                  >
                                    <Minus
                                      className="w-4 h-4"
                                      strokeWidth={3}
                                    />
                                  </button>

                                  <div
                                    className={cn(
                                      "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                                      `neo-card ${themeClasses.border} bg-bg-card-custom`
                                    )}
                                  >
                                    {/* Drag handle */}
                                    <div className="text-slate-500 cursor-grab active:cursor-grabbing">
                                      <GripVertical className="w-5 h-5" />
                                    </div>
                                    <div
                                      style={{
                                        color: color,
                                        filter: `drop-shadow(0 0 6px ${color}80)`,
                                      }}
                                    >
                                      <IconComponent className="w-5 h-5" />
                                    </div>
                                    <span className="font-semibold text-sm text-white flex-1">
                                      {sub.name}
                                    </span>
                                  </div>
                                </motion.div>
                              </Reorder.Item>
                            );
                          })}
                        </Reorder.Group>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setSelectedSubcategoryId(undefined)}
                            className={cn(
                              "p-2.5 rounded-lg border text-center transition-all active:scale-95 min-h-[55px] flex items-center justify-center category-appear",
                              !selectedSubcategoryId
                                ? `neo-card ${themeClasses.borderActive} ${themeClasses.bgActive} neo-glow shadow-lg`
                                : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover} ${themeClasses.bgHover}`
                            )}
                          >
                            <span
                              className={cn(
                                "font-semibold text-xs",
                                !selectedSubcategoryId
                                  ? themeClasses.text
                                  : "text-white"
                              )}
                            >
                              None
                            </span>
                          </button>
                          <AnimatePresence mode="popLayout">
                            {orderedSubcategories.map(
                              (sub: any, index: number) => {
                                const active = selectedSubcategoryId === sub.id;
                                const color = sub.color || "#22d3ee";
                                return (
                                  <motion.div
                                    key={sub.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{
                                      duration: 0.2,
                                      delay: index * 0.02,
                                    }}
                                    className="relative"
                                  >
                                    <button
                                      onClick={() =>
                                        setSelectedSubcategoryId(sub.id)
                                      }
                                      style={{
                                        borderColor: active ? color : undefined,
                                        backgroundColor: active
                                          ? `${color}25`
                                          : undefined,
                                        boxShadow: active
                                          ? `0 0 15px ${color}40`
                                          : undefined,
                                      }}
                                      className={cn(
                                        "w-full p-2.5 rounded-lg border text-center transition-all min-h-[55px] flex flex-col items-center justify-center gap-1 active:scale-95",
                                        active
                                          ? "neo-card neo-glow shadow-lg"
                                          : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover} ${themeClasses.bgHover}`
                                      )}
                                    >
                                      {(() => {
                                        const IconComponent = getCategoryIcon(
                                          sub.name
                                        );
                                        return (
                                          <div
                                            style={{
                                              color: color,
                                              filter: `drop-shadow(0 0 6px ${color}80)`,
                                            }}
                                          >
                                            <IconComponent className="w-5 h-5" />
                                          </div>
                                        );
                                      })()}
                                      <span
                                        className="font-semibold text-xs"
                                        style={{
                                          color: active ? color : "white",
                                        }}
                                      >
                                        {sub.name}
                                      </span>
                                    </button>
                                  </motion.div>
                                );
                              }
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>

                    {!editModeSubcategory &&
                      orderedSubcategories.length > 0 && (
                        <p className="text-[10px] text-slate-600 text-center">
                          Hold to edit subcategories
                        </p>
                      )}
                  </>
                )}

                <div className="space-y-2 pt-2">
                  <Label className="text-sm font-medium text-secondary/80">
                    Add a note
                  </Label>
                  <Input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`!bg-bg-card-custom ${themeClasses.border} text-white placeholder:text-slate-500 ${themeClasses.focusBorder} focus:ring-2 ${themeClasses.focusRing} h-11`}
                  />
                </div>

                <Button
                  size="lg"
                  className="w-full h-12 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98]"
                  onClick={() => {
                    const next = getNextStep();
                    if (next) {
                      setStep(next);
                    } else {
                      handleSubmit();
                    }
                  }}
                  disabled={addTransactionMutation.isPending}
                >
                  {addTransactionMutation.isPending
                    ? "Adding..."
                    : getNextStep()
                      ? "Next"
                      : `Add ${selectedAccount?.type === "income" ? "Income" : "Expense"}`}
                </Button>
              </div>
            )}
          </div>

          <CalculatorDialog
            open={showCalculator}
            onOpenChange={setShowCalculator}
            initialValue={amount || "0"}
            onResult={(result) => {
              const rounded = parseFloat(result).toFixed(2);
              setAmount(rounded);
            }}
          />

          <NewAccountDrawer
            open={showNewAccountDrawer}
            onOpenChange={setShowNewAccountDrawer}
            onAccountCreated={(accountId) => {
              // Auto-select the newly created account
              setSelectedAccountId(accountId);
            }}
          />

          {selectedAccountId && (
            <NewCategoryDrawer
              open={showNewCategoryDrawer}
              onOpenChange={setShowNewCategoryDrawer}
              accountId={selectedAccountId}
              onCategoryCreated={async (categoryId: string) => {
                // Refetch categories to get the new subcategories
                await refetchCategories();
                // Auto-select the newly created category
                setSelectedCategoryId(categoryId);
                // Navigate to subcategory step if it's in the flow
                if (stepFlow.includes("subcategory")) {
                  setStep("subcategory");
                }
              }}
            />
          )}

          {/* Delete Confirmation Drawer */}
          <Drawer
            open={deleteConfirm !== null}
            onOpenChange={(open) => !open && setDeleteConfirm(null)}
          >
            <DrawerContent className="bg-bg-dark border-t border-slate-800">
              <DrawerHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <DrawerTitle
                  className={cn(
                    "text-lg font-semibold",
                    deleteConfirm?.step === "second"
                      ? "text-red-400"
                      : themeClasses.text
                  )}
                >
                  {deleteConfirm?.step === "first"
                    ? `Delete ${deleteConfirm?.type === "account" ? "Account" : deleteConfirm?.type === "category" ? "Category" : "Subcategory"}?`
                    : "Are you absolutely sure?"}
                </DrawerTitle>
                <DrawerDescription className="text-slate-400 text-sm">
                  {deleteConfirm?.step === "first" ? (
                    <>
                      You're about to delete{" "}
                      <span
                        className="font-semibold"
                        style={{ color: deleteConfirm?.color || "#22d3ee" }}
                      >
                        {deleteConfirm?.name}
                      </span>
                      . This action cannot be undone.
                    </>
                  ) : (
                    <>
                      This will permanently remove{" "}
                      <span
                        className="font-semibold"
                        style={{ color: deleteConfirm?.color || "#22d3ee" }}
                      >
                        {deleteConfirm?.name}
                      </span>{" "}
                      and all associated data.
                      {deleteConfirm?.type === "category" && (
                        <span className="block mt-1 text-amber-400">
                          All subcategories will also be deleted.
                        </span>
                      )}
                      {deleteConfirm?.type === "account" && (
                        <span className="block mt-1 text-amber-400">
                          All transactions in this account will be orphaned.
                        </span>
                      )}
                    </>
                  )}
                </DrawerDescription>
              </DrawerHeader>

              <DrawerFooter className="pt-2 pb-6">
                <Button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className={cn(
                    "w-full h-12 text-base font-semibold border-0 shadow-lg transition-all",
                    deleteConfirm?.step === "first"
                      ? "bg-red-500/80 hover:bg-red-500 text-white"
                      : "bg-red-600 hover:bg-red-700 text-white animate-pulse"
                  )}
                >
                  {isDeleting
                    ? "Deleting..."
                    : deleteConfirm?.step === "first"
                      ? "Yes, Delete"
                      : "Delete Forever"}
                </Button>
                <DrawerClose asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-11 bg-transparent",
                      themeClasses.border,
                      themeClasses.text
                    )}
                  >
                    Cancel
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>

          {/* Backdrop for clicking outside to exit edit mode */}
          {/* z-[44] keeps it BELOW content (z-[45]) but above regular elements */}
          <AnimatePresence>
            {isAnyEditMode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={exitAllEditModes}
                className="fixed inset-0 z-[44] bg-black/20"
                style={{
                  top:
                    selectedAccountId && step === "amount" ? "205px" : "80px",
                }} // Dynamic: below header
              />
            )}
          </AnimatePresence>

          {/* Floating Done Button is now rendered at layout level (ExpenseTagsBarWrapper) to fix z-index stacking */}
        </>
      )}
    </div>
  );
}
