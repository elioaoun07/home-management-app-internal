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
  useMyAccountsWithHidden,
  useReorderAccounts,
  useUnhideAccount,
} from "@/features/accounts/hooks";
import {
  useDeleteCategory,
  useReorderCategories,
  useUnhideCategory,
} from "@/features/categories/hooks";
import {
  useCategories,
  useCategoriesWithHidden,
} from "@/features/categories/useCategoriesQuery";
import {
  useCreateDebt,
  useCreateStandaloneDebt,
} from "@/features/debts/useDebts";
import { useLbpSettings } from "@/features/preferences/useLbpSettings";
import {
  useSectionOrder,
  type SectionKey,
} from "@/features/preferences/useSectionOrder";
import {
  useAddTransaction,
  useDeleteTransaction,
} from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { isReallyOnline } from "@/lib/connectivityManager";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import { Eye, EyeOff, GripVertical, X } from "lucide-react";
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
import NewSubcategoryDrawer from "./NewSubcategoryDrawer";
import VoiceEntryButton from "./VoiceEntryButton";

type Step = SectionKey | "confirm";

/**
 * Helper to determine if an account type uses positive balance logic
 * Income and Saving accounts: positive amounts increase balance
 * Expense accounts: positive amounts decrease balance
 */
function isPositiveBalanceType(type: string | undefined): boolean {
  return type === "income" || type === "saving";
}

/**
 * Get the display label for an account type
 */
function getTransactionLabel(type: string | undefined): string {
  if (type === "income") return "Income";
  if (type === "saving") return "Deposit";
  return "Expense";
}

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
  // ── Diagnostic: verify this module loaded (not stale SW cache) ──
  if (typeof window !== "undefined" && !(window as any).__expenseFormLogged) {
    (window as any).__expenseFormLogged = true;
    console.log(
      "[OFFLINE] MobileExpenseForm MODULE LOADED (code version: 2026-03-06)",
    );
  }

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

  // Valid steps that have UI rendering
  const VALID_STEPS: readonly Step[] = [
    "amount",
    "account",
    "category",
    "subcategory",
  ];

  const stepFlow = useMemo<Step[]>(() => {
    if (!sectionOrder || sectionOrder.length === 0) {
      return ["amount", "account", "category", "subcategory"];
    }
    // Filter to only include valid steps that have UI
    return sectionOrder.filter((s) => VALID_STEPS.includes(s));
  }, [sectionOrder]);

  // OPTIMIZED: Single API call for accounts - derive visible accounts from it
  const { data: accountsWithHidden = [], isLoading: accountsLoading } =
    useMyAccountsWithHidden();
  // Derive visible accounts (visible !== false) from the full list
  const accounts = useMemo(
    () => accountsWithHidden.filter((a: any) => a.visible !== false),
    [accountsWithHidden],
  );
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
    [stepFlow, defaultAccount],
  );

  const [isInitialized, setIsInitialized] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSplitBill, setIsSplitBill] = useState(false);
  const [splitBillTotal, setSplitBillTotal] = useState("");
  const [isDebt, setIsDebt] = useState(false);
  const [debtorName, setDebtorName] = useState("");
  const [debtAmount, setDebtAmount] = useState(""); // how much the friend owes (defaults to full amount)
  const [showNewAccountDrawer, setShowNewAccountDrawer] = useState(false);
  const [showNewCategoryDrawer, setShowNewCategoryDrawer] = useState(false);
  const [showNewSubcategoryDrawer, setShowNewSubcategoryDrawer] =
    useState(false);

  // LBP change tracking (Lebanon dual-currency)
  const [lbpChangeInput, setLbpChangeInput] = useState("");
  const { lbpRate, calculateActualValue } = useLbpSettings();

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
  // Also fetch categories with hidden ones for edit mode
  const { data: categoriesWithHidden = [] } =
    useCategoriesWithHidden(selectedAccountId);
  const addTransactionMutation = useAddTransaction();
  const createDebtMutation = useCreateDebt();
  const createStandaloneDebtMutation = useCreateStandaloneDebt();
  const deleteTransactionMutation = useDeleteTransaction();
  const queryClient = useQueryClient();
  const deleteAccountMutation = useDeleteAccount();
  const deleteCategoryMutation = useDeleteCategory(selectedAccountId);
  const unhideAccountMutation = useUnhideAccount();
  const unhideCategoryMutation = useUnhideCategory(selectedAccountId);
  const reorderAccountsMutation = useReorderAccounts();
  const reorderCategoriesMutation = useReorderCategories(selectedAccountId);
  const themeClasses = useThemeClasses();

  // Ordered lists for drag-and-drop (local state synced with data)
  const [orderedAccounts, setOrderedAccounts] = useState<any[]>([]);
  const [orderedCategories, setOrderedCategories] = useState<any[]>([]);
  const [orderedSubcategories, setOrderedSubcategories] = useState<any[]>([]);

  // Sync accounts with ordered list (only when NOT in edit mode and NOT saving)
  useEffect(() => {
    if (editModeAccount) {
      // In edit mode, show all accounts including hidden ones
      if (accountsWithHidden.length > 0 && !accountsSaving) {
        if (lastSavedAccountsRef.current) {
          lastSavedAccountsRef.current = null;
          return;
        }
        // Only update if content actually changed to prevent infinite loops
        setOrderedAccounts((prev) => {
          const prevIds = prev.map((a) => a.id).join(",");
          const newIds = accountsWithHidden.map((a: any) => a.id).join(",");
          if (prevIds === newIds) return prev;
          return accountsWithHidden;
        });
        setAccountsOrderChanged(false);
      }
    } else if (accounts.length > 0 && !accountsSaving) {
      // Skip sync if we just saved - keep our local order until next fresh fetch
      if (lastSavedAccountsRef.current) {
        lastSavedAccountsRef.current = null;
        return;
      }
      // Only update if content actually changed to prevent infinite loops
      setOrderedAccounts((prev) => {
        const prevIds = prev.map((a) => a.id).join(",");
        const newIds = accounts.map((a: any) => a.id).join(",");
        if (prevIds === newIds) return prev;
        return accounts;
      });
      setAccountsOrderChanged(false);
    }
  }, [accounts, accountsWithHidden, editModeAccount, accountsSaving]);

  // Sync categories with ordered list (only when NOT in edit mode and NOT saving)
  useEffect(() => {
    if (!categoriesSaving) {
      const dataSource = editModeCategory ? categoriesWithHidden : categories;
      const rootCats = dataSource.filter((c: any) => !c.parent_id);
      if (rootCats.length > 0 || editModeCategory) {
        // Skip sync if we just saved - keep our local order until next fresh fetch
        if (lastSavedCategoriesRef.current && !editModeCategory) {
          // Just clear the flag, don't sync from stale server data
          lastSavedCategoriesRef.current = null;
          return;
        }
        // Only update if content actually changed to prevent infinite loops
        setOrderedCategories((prev) => {
          const prevIds = prev.map((c) => c.id).join(",");
          const newIds = rootCats.map((c: any) => c.id).join(",");
          if (prevIds === newIds) return prev;
          return rootCats;
        });
        setCategoriesOrderChanged(false);
      }
    }
  }, [categories, categoriesWithHidden, editModeCategory, categoriesSaving]);

  // Sync subcategories with ordered list when category changes (only when NOT in edit mode and NOT saving)
  useEffect(() => {
    if (!subcategoriesSaving) {
      if (selectedCategoryId) {
        const dataSource = editModeSubcategory
          ? categoriesWithHidden
          : categories;
        const subs = dataSource.filter(
          (c: any) => c.parent_id === selectedCategoryId,
        );
        const selectedCategoryData = dataSource.find(
          (c: any) => c.id === selectedCategoryId,
        );
        const nestedSubs = (selectedCategoryData as any)?.subcategories || [];
        const newSubs = [...subs, ...nestedSubs];

        // Skip sync if we just saved - keep our local order until next fresh fetch
        if (lastSavedSubcategoriesRef.current && !editModeSubcategory) {
          // Just clear the flag, don't sync from stale server data
          lastSavedSubcategoriesRef.current = null;
          return;
        }
        // Only update if content actually changed to prevent infinite loops
        setOrderedSubcategories((prev) => {
          const prevIds = prev.map((s) => s.id).join(",");
          const newIds = newSubs.map((s: any) => s.id).join(",");
          if (prevIds === newIds) return prev;
          return newSubs;
        });
        setSubcategoriesOrderChanged(false);
      } else {
        // Only clear if not already empty to avoid infinite loop
        setOrderedSubcategories((prev) => (prev.length > 0 ? [] : prev));
      }
    }
  }, [
    selectedCategoryId,
    categories,
    categoriesWithHidden,
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
          toast.success("Account hidden", { icon: ToastIcons.delete });
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
            `${deleteConfirm.type === "category" ? "Category" : "Subcategory"} hidden`,
            {
              icon: ToastIcons.delete,
            },
          );
        }
        setDeleteConfirm(null);
      } catch (error: any) {
        toast.error(error.message || "Failed to hide", {
          icon: ToastIcons.error,
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Use a ref to ensure initialization happens exactly once
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // INSTANT INIT - Wait for accounts to ACTUALLY LOAD (not just "not loading")
    // This ensures we skip the account step correctly when user has a default account.
    // When offline, the persisted cache may take a moment to restore —
    // we wait for real account data to be available, or for the query to settle with empty data online.
    // Only run ONCE after accounts are loaded - use ref to guarantee single execution
    if (
      stepFlow.length > 0 &&
      !hasInitializedRef.current &&
      !accountsLoading &&
      // Guard: don't initialize with empty accounts if we're still restoring cache
      // If online, empty accounts is legitimate (new user). If offline, wait for persisted cache.
      (accounts.length > 0 || isReallyOnline())
    ) {
      hasInitializedRef.current = true;
      console.log(
        `[OFFLINE] Form INITIALIZED: step=${firstValidStep}, accounts=${accounts.length}, categories will load for accountId=${accounts.find((a: any) => a.is_default)?.id || "none"}`,
      );
      setStep(firstValidStep);
      setIsInitialized(true);
    } else if (!hasInitializedRef.current) {
      console.log(
        `[OFFLINE] Form init BLOCKED: stepFlow=${stepFlow.length}, accountsLoading=${accountsLoading}, accounts=${accounts.length}, online=${isReallyOnline()}`,
      );
    }
  }, [stepFlow, firstValidStep, accountsLoading, accounts.length]);

  // Re-derive step if default account becomes available AFTER initialization
  // (e.g., persisted cache restores late, or account loaded from network)
  const prevDefaultRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    if (defaultAccount && prevDefaultRef.current !== defaultAccount.id) {
      prevDefaultRef.current = defaultAccount.id;
      // If currently on the account step and we now have a default, skip to next valid step
      if (step === "account") {
        setStep(firstValidStep);
      }
    }
  }, [defaultAccount, firstValidStep, step]);

  useEffect(() => {
    if (defaultAccount && !selectedAccountId) {
      setSelectedAccountId(defaultAccount.id);
    }
  }, [accounts, selectedAccountId, defaultAccount]);

  const subcategories = selectedCategoryId
    ? categories.filter((c: any) => c.parent_id === selectedCategoryId)
    : [];

  const selectedCategoryData = categories.find(
    (c: any) => c.id === selectedCategoryId,
  );
  const nestedSubcategories =
    (selectedCategoryData as any)?.subcategories || [];

  const allSubcategories = [...subcategories, ...nestedSubcategories];

  const selectedAccount = accounts.find((a: any) => a.id === selectedAccountId);
  const selectedCategory = categories.find(
    (c: any) => c.id === selectedCategoryId,
  );
  const selectedSubcategory = allSubcategories.find(
    (s: any) => s.id === selectedSubcategoryId,
  );

  const canSubmit =
    amount &&
    selectedAccountId &&
    selectedCategoryId &&
    (!isDebt || debtorName.trim());
  const isAmountStep = step === "amount";
  const closeDisabled =
    isAmountStep && (!amount || Number.parseFloat(amount) <= 0);

  const handleSubmit = async () => {
    console.log(
      `[OFFLINE] handleSubmit: canSubmit=${!!canSubmit}, isPending=${addTransactionMutation.isPending}, status=${addTransactionMutation.status}`,
    );
    if (!canSubmit || addTransactionMutation.isPending) {
      console.log("[OFFLINE] handleSubmit: BLOCKED by guard");
      return;
    }

    // Parse LBP change if provided (stored in thousands)
    const parsedLbpChange = lbpChangeInput ? parseFloat(lbpChangeInput) : null;

    // Store current values for undo
    const transactionData = {
      account_id: selectedAccountId,
      category_id: selectedCategoryId,
      subcategory_id: selectedSubcategoryId || null,
      amount: parseFloat(amount),
      description: description || undefined,
      date: format(date, "yyyy-MM-dd"),
      is_private: isPrivate,
      split_requested: isSplitBill,
      total_bill_amount:
        isSplitBill && splitBillTotal ? parseFloat(splitBillTotal) : undefined,
      lbp_change_received: parsedLbpChange,
      // Include display names for optimistic UI
      _optimistic: {
        category_name: selectedCategory?.name ?? null,
        subcategory_name: selectedSubcategory?.name ?? null,
        account_name: selectedAccount?.name ?? null,
        category_color: (selectedCategory as any)?.color ?? null,
        subcategory_color: (selectedSubcategory as any)?.color ?? null,
      },
    };

    // Store values for undo before resetting form
    const amountForToast = amount;
    const categoryNameForToast = selectedCategory?.name;
    const isIncomeForToast = selectedAccount?.type === "income";
    const wasSplitBill = isSplitBill;
    const wasDebt = isDebt;
    const debtorNameForToast = debtorName;
    const debtAmountForSubmit = debtAmount ? parseFloat(debtAmount) : undefined;

    // Auto-detect future payment: if the selected date is in the future, treat as scheduled
    const today = format(new Date(), "yyyy-MM-dd");
    const isFutureDatePayment = transactionData.date > today;

    // Reset form immediately for instant UI feedback
    setAmount("");
    setSelectedCategoryId(undefined);
    setSelectedSubcategoryId(undefined);
    setDescription("");
    setIsPrivate(false);
    setIsSplitBill(false);
    setSplitBillTotal("");
    setIsDebt(false);
    setDebtorName("");
    setDebtAmount("");
    setLbpChangeInput("");
    const newDefaultAccount = accounts.find((a: any) => a.is_default);
    if (newDefaultAccount) {
      setSelectedAccountId(newDefaultAccount.id);
    } else {
      setSelectedAccountId(undefined);
    }
    setStep(firstValidStep);

    // Optimistic add - mutation hook handles cache updates
    if (isFutureDatePayment) {
      // Create future payment via /api/drafts with scheduled_date = the future date
      (async () => {
        try {
          const res = await fetch("/api/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              account_id: transactionData.account_id,
              amount: transactionData.amount,
              category_id: transactionData.category_id,
              subcategory_id: transactionData.subcategory_id,
              description: transactionData.description || "",
              date: transactionData.date,
              scheduled_date: transactionData.date,
            }),
          });
          if (!res.ok) throw new Error("Failed");
          toast.success("Future payment scheduled!", {
            icon: "📅",
            description: `$${amountForToast} for ${categoryNameForToast} — due ${transactionData.date}`,
          });
          queryClient.invalidateQueries({
            queryKey: ["account-balance", transactionData.account_id],
          });
          queryClient.invalidateQueries({ queryKey: ["future-payments"] });
        } catch {
          toast.error("Failed to schedule future payment", {
            icon: ToastIcons.error,
          });
        }
      })();
    } else if (wasDebt && debtorNameForToast) {
      // Create debt (creates transaction + debt record via /api/debts)
      createDebtMutation.mutate(
        {
          account_id: transactionData.account_id,
          category_id: transactionData.category_id,
          subcategory_id: transactionData.subcategory_id || undefined,
          amount: transactionData.amount,
          debt_amount: debtAmountForSubmit,
          description: transactionData.description,
          date: transactionData.date,
          is_private: transactionData.is_private,
          debtor_name: debtorNameForToast,
        },
        {
          onSuccess: () => {
            // Toast is handled by the hook
          },
          onError: () => {
            toast.error("Failed to create debt", { icon: ToastIcons.error });
          },
        },
      );
    } else {
      console.log(
        "[OFFLINE] handleSubmit: calling addTransactionMutation.mutate()",
      );
      addTransactionMutation.mutate(transactionData, {
        onSuccess: (newTransaction) => {
          console.log(
            `[OFFLINE] mutate.onSuccess callback: _offline=${newTransaction?._offline}, id=${newTransaction?.id}`,
          );
          // Offline path: show special toast with "Saved offline" and undo that removes from queue
          if (newTransaction?._offline) {
            toast.success("Saved offline!", {
              icon: (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 ring-2 ring-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.4)]">
                  <svg
                    className="w-3.5 h-3.5 text-amber-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
                  </svg>
                </div>
              ),
              duration: 4000,
              description: `$${amountForToast} for ${categoryNameForToast} — will sync when online`,
              action: {
                label: "Undo",
                onClick: async () => {
                  try {
                    const { removeFromQueue } = await import(
                      "@/lib/offlineQueue"
                    );
                    await removeFromQueue(newTransaction.id);
                    // Restore cached balance
                    if (transactionData.account_id) {
                      const { getCachedBalance, setCachedBalance } =
                        await import("@/lib/queryConfig");
                      const cached = getCachedBalance(
                        transactionData.account_id,
                      );
                      if (cached) {
                        setCachedBalance(
                          transactionData.account_id,
                          cached.balance + parseFloat(amountForToast),
                        );
                      }
                    }
                    // Refresh the balance display
                    queryClient.invalidateQueries({
                      queryKey: ["account-balance"],
                      refetchType: "none",
                    });
                    toast.success("Transaction undone", {
                      icon: ToastIcons.delete,
                    });
                  } catch {
                    toast.error("Failed to undo", { icon: ToastIcons.error });
                  }
                },
              },
            });
            return;
          }

          // Online path: normal success toast
          const successMessage = wasSplitBill
            ? "Split bill sent!"
            : isIncomeForToast
              ? "Income added!"
              : "Expense added!";
          const successDescription = wasSplitBill
            ? `$${amountForToast} for ${categoryNameForToast} - awaiting partner's amount`
            : `$${amountForToast} for ${categoryNameForToast}`;
          toast.success(successMessage, {
            icon: ToastIcons.create,
            duration: 4000,
            description: successDescription,
            action: {
              label: "Undo",
              onClick: () => {
                deleteTransactionMutation.mutate(
                  { id: newTransaction.id, _silent: true },
                  {
                    onSuccess: () =>
                      toast.success("Transaction undone", {
                        icon: ToastIcons.delete,
                      }),
                    onError: () =>
                      toast.error("Failed to undo", { icon: ToastIcons.error }),
                  },
                );
              },
            },
          });
        },
      });
    } // close else (non-debt path)
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
    console.log(
      `[OFFLINE] getNextStep(): no more steps after "${step}" → will call handleSubmit`,
    );
    return null;
  };

  const contentAreaStyles: CSSProperties = {
    bottom: `calc(env(safe-area-inset-bottom) + ${MOBILE_CONTENT_BOTTOM_OFFSET}px)`,
  };

  // NO SKELETON - Form renders instantly with cached data
  // Only the balance component shows loading state while APIs run in background

  // Prevent hydration mismatch by showing consistent UI during initial render
  const showBackButton = isInitialized && step !== firstValidStep;
  // Use 0 during initial render to match server, then actual progress after initialization
  const progressWidth = isInitialized ? progress() : 0;

  return (
    <div className="fixed inset-0 top-14 bg-bg-dark flex flex-col">
      <>
        {/* HEADER - TOP DELIMITER - Must be above all other UI elements */}
        <div
          className={`fixed top-0 left-0 right-0 z-[100] bg-gradient-to-b from-bg-card-custom to-bg-medium border-b ${themeClasses.border} px-3 pb-2 shadow-2xl shadow-black/10 backdrop-blur-xl slide-in-top`}
        >
          <div className="flex items-center justify-between mb-2 pt-16">
            {showBackButton ? (
              <button
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(5);
                  goBack();
                }}
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
              New {getTransactionLabel(selectedAccount?.type)}
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
                  : `${themeClasses.bgSurface} hover:bg-opacity-30 active:scale-95 transition-all ${themeClasses.border}`,
              )}
            >
              <XIcon className={`w-5 h-5 ${themeClasses.text}`} />
            </button>
          </div>
          <div className="h-0.5 bg-bg-card-custom rounded-full overflow-hidden relative">
            <div
              className={`h-full bg-gradient-to-r ${themeClasses.activeItemGradient} transition-all duration-500 ease-out neo-glow-sm glow-pulse-primary`}
              style={{ width: `${progressWidth}%` }}
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
              : "top-[80px]",
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
            <div key="amount-step" className="space-y-4 step-slide-in">
              {/* ── Hero Amount Card ── */}
              <div className="relative rounded-2xl bg-gradient-to-b from-slate-800/60 via-slate-900/40 to-transparent border border-slate-700/40 p-5 space-y-4 overflow-hidden">
                {/* Subtle corner accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/5 to-transparent rounded-bl-full pointer-events-none" />

                {/* Amount input */}
                <div className="relative flex items-center">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[hsl(var(--text-muted-light)/0.4)] pointer-events-none z-10">
                    $
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    suppressHydrationWarning
                    className={`text-2xl font-bold h-14 pl-10 pr-24 border text-center bg-bg-dark/60 ${themeClasses.border} text-white placeholder:text-[hsl(var(--input-placeholder)/0.25)] ${themeClasses.focusBorder} focus:ring-1 ${themeClasses.focusRing} transition-all duration-200 rounded-xl`}
                    autoFocus
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                    <button
                      onClick={() => setShowCalculator(true)}
                      suppressHydrationWarning
                      className={cn(
                        "p-2.5 rounded-lg border active:scale-95 transition-all",
                        themeClasses.border,
                        themeClasses.bgHover,
                      )}
                    >
                      <CalculatorIcon
                        className={cn(
                          "w-5 h-5",
                          themeClasses.text,
                          themeClasses.glow,
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
                          "Voice entry saved! Check drafts to confirm.",
                        );
                      }}
                      className={cn(
                        "p-2.5 rounded-lg border active:scale-95 transition-all",
                        themeClasses.border,
                        themeClasses.bgHover,
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* LBP Change — compact side note aligned right */}
              <div className="flex items-center justify-end gap-2.5 px-1">
                {lbpRate &&
                  lbpChangeInput &&
                  parseFloat(lbpChangeInput) > 0 &&
                  amount &&
                  parseFloat(amount) > 0 && (
                    <span className="text-[11px] text-slate-500">
                      actual{" "}
                      <span className={`font-semibold ${themeClasses.text}`}>
                        $
                        {calculateActualValue(
                          parseFloat(amount),
                          parseFloat(lbpChangeInput),
                        )?.toFixed(2) ?? "—"}
                      </span>
                    </span>
                  )}
                <div
                  className={`relative flex items-center h-7 w-28 px-2 rounded-md border border-dashed bg-transparent ${themeClasses.border} focus-within:border-cyan-500/40 transition-all duration-200 ${
                    !lbpRate ? "opacity-40 cursor-not-allowed" : ""
                  }`}
                >
                  <span className="text-[10px] text-slate-600 pointer-events-none mr-1 shrink-0">
                    LBP
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={lbpRate ? "0" : "—"}
                    value={lbpChangeInput}
                    onChange={(e) => setLbpChangeInput(e.target.value)}
                    disabled={!isInitialized ? true : !lbpRate}
                    suppressHydrationWarning
                    className="flex-1 bg-transparent border-none outline-none text-right text-[11px] text-slate-400 placeholder:text-slate-700 disabled:cursor-not-allowed p-0 w-full"
                  />
                  <span
                    className={`text-[10px] text-slate-600 pointer-events-none ml-0.5 transition-opacity duration-200 ${
                      lbpChangeInput ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    ,000
                  </span>
                </div>
              </div>

              {/* Next button */}
              <Button
                size="lg"
                className="w-full h-12 text-base font-semibold neo-gradient text-white border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5 transition-all active:scale-[0.98] spring-bounce"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(10);
                  const next = getNextStep();
                  console.log(
                    `[OFFLINE] Next button clicked: currentStep="${step}", nextStep="${next}", amount=${amount}, accountId=${selectedAccountId}`,
                  );
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

              {/* ── Optional features (secondary, below Next) ── */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center justify-center gap-2.5">
                  {/* Split Bill Pill */}
                  <button
                    onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(10);
                      setIsSplitBill(!isSplitBill);
                      if (!isSplitBill) {
                        setIsPrivate(false);
                        setIsDebt(false);
                        setDebtorName("");
                        setDebtAmount("");
                      } else {
                        setSplitBillTotal("");
                      }
                    }}
                    suppressHydrationWarning
                    className={cn(
                      "relative h-9 px-4 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 flex items-center gap-1.5",
                      isSplitBill
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-400/40"
                        : "bg-slate-800/60 text-slate-500 border border-slate-700/40 hover:text-slate-300 hover:border-slate-600/60",
                    )}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4v16m-6-8h12"
                      />
                      <circle cx="6" cy="8" r="2" />
                      <circle cx="18" cy="16" r="2" />
                    </svg>
                    Split
                  </button>

                  {/* Debt Pill */}
                  <button
                    onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(10);
                      setIsDebt(!isDebt);
                      if (!isDebt) {
                        setIsSplitBill(false);
                      }
                    }}
                    suppressHydrationWarning
                    className={cn(
                      "relative h-9 px-4 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 flex items-center gap-1.5",
                      isDebt
                        ? "bg-orange-500/15 text-orange-400 border border-orange-400/40"
                        : "bg-slate-800/60 text-slate-500 border border-slate-700/40 hover:text-slate-300 hover:border-slate-600/60",
                    )}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    Debt
                  </button>

                  {/* Private/Public Pill */}
                  <button
                    onClick={() => {
                      if (isSplitBill && !isPrivate) return;
                      setIsPrivate(!isPrivate);
                    }}
                    disabled={isSplitBill}
                    suppressHydrationWarning
                    className={cn(
                      "relative h-9 px-4 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 flex items-center gap-1.5",
                      isSplitBill && "opacity-40 cursor-not-allowed",
                      isPrivate
                        ? `bg-cyan-500/15 ${themeClasses.textActive} border border-cyan-400/40`
                        : "bg-slate-800/60 text-slate-500 border border-slate-700/40 hover:text-slate-300 hover:border-slate-600/60",
                    )}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      {isPrivate ? (
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
                    {isPrivate ? "Private" : "Public"}
                  </button>
                </div>

                {/* Split bill total input - expands below when active */}
                {isSplitBill && (
                  <div className="flex items-center justify-center gap-2 w-full max-w-xs">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/60 text-xs font-bold">
                        $
                      </span>
                      <input
                        type="number"
                        value={splitBillTotal}
                        onChange={(e) => setSplitBillTotal(e.target.value)}
                        placeholder="Total bill"
                        className="w-full h-9 pl-7 pr-2 rounded-lg text-sm bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 placeholder:text-emerald-400/30 focus:outline-none focus:border-emerald-400/60 transition-all text-right"
                        min="0.01"
                        step="0.01"
                      />
                    </div>
                    {splitBillTotal &&
                      amount &&
                      parseFloat(splitBillTotal) > parseFloat(amount) && (
                        <span className="text-[11px] text-emerald-400/70 shrink-0">
                          Partner: $
                          {(
                            parseFloat(splitBillTotal) - parseFloat(amount)
                          ).toFixed(2)}
                        </span>
                      )}
                  </div>
                )}

                {/* Debt inputs - expands below when active */}
                {isDebt && (
                  <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={debtorName}
                        onChange={(e) => setDebtorName(e.target.value)}
                        placeholder="Who owes you?"
                        className="flex-1 min-w-0 h-9 px-3 rounded-lg text-sm bg-orange-500/10 border border-orange-400/30 text-orange-200 placeholder:text-orange-400/30 focus:outline-none focus:border-orange-400/60 transition-all"
                        autoFocus
                      />
                      <div className="relative shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-orange-400/60 text-xs font-bold">
                          $
                        </span>
                        <input
                          type="number"
                          value={debtAmount}
                          onChange={(e) => setDebtAmount(e.target.value)}
                          placeholder={amount || "0.00"}
                          className="w-20 h-9 pl-6 pr-2 rounded-lg text-sm bg-orange-500/10 border border-orange-400/30 text-orange-200 placeholder:text-orange-400/30 focus:outline-none focus:border-orange-400/60 transition-all text-right"
                          min="0.01"
                          step="0.01"
                        />
                      </div>
                    </div>
                    {/* Log Debt directly (standalone — no transaction) */}
                    {debtorName.trim() &&
                      (debtAmount
                        ? parseFloat(debtAmount) > 0
                        : amount && parseFloat(amount) > 0) && (
                        <button
                          onClick={() => {
                            if (navigator.vibrate) navigator.vibrate(10);
                            const name = debtorName.trim();
                            const amt = debtAmount
                              ? parseFloat(debtAmount)
                              : parseFloat(amount);
                            setDebtorName("");
                            setDebtAmount("");
                            setIsDebt(false);
                            createStandaloneDebtMutation.mutate({
                              debtor_name: name,
                              amount: amt,
                              date: format(date, "yyyy-MM-dd"),
                            });
                          }}
                          disabled={createStandaloneDebtMutation.isPending}
                          className="w-full h-8 rounded-lg text-[11px] font-medium transition-all active:scale-95 bg-orange-500/15 text-orange-300 border border-orange-400/30 hover:bg-orange-500/25"
                        >
                          {createStandaloneDebtMutation.isPending
                            ? "Saving…"
                            : "Log Debt Only (no transaction)"}
                        </button>
                      )}
                  </div>
                )}
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
                  <span className="inline-flex items-center justify-center w-4 h-4 bg-amber-500 rounded-full mx-0.5">
                    <EyeOff className="w-2.5 h-2.5 text-white" />
                  </span>{" "}
                  to hide
                </p>
              )}

              <div {...accountLongPress} className="space-y-2">
                {editModeAccount ? (
                  <>
                    <Reorder.Group
                      axis="y"
                      values={orderedAccounts.filter(
                        (a: any) => a.visible !== false,
                      )}
                      onReorder={handleAccountsReorder}
                      className="space-y-2"
                    >
                      {orderedAccounts
                        .filter((a: any) => a.visible !== false)
                        .map((account: any) => (
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
                              {/* Hide button - EyeOff icon */}
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
                                className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center bg-amber-500 text-white shadow-lg transform transition-transform hover:scale-110 active:scale-95 animate-in fade-in zoom-in duration-200"
                              >
                                <EyeOff
                                  className="w-3.5 h-3.5"
                                  strokeWidth={2.5}
                                />
                              </button>

                              <div
                                className={cn(
                                  "w-full p-2.5 rounded-lg border text-left transition-all flex items-center gap-2",
                                  selectedAccountId === account.id
                                    ? `neo-card ${themeClasses.borderActive} ${themeClasses.bgActive} neo-glow-sm`
                                    : `neo-card ${themeClasses.border} bg-bg-card-custom`,
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

                    {/* Hidden accounts section */}
                    {orderedAccounts.filter((a: any) => a.visible === false)
                      .length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5" />
                          Hidden accounts
                        </p>
                        <div className="space-y-2">
                          {orderedAccounts
                            .filter((a: any) => a.visible === false)
                            .map((account: any) => (
                              <div key={account.id} className="relative">
                                {/* Unhide button - Eye icon */}
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await unhideAccountMutation.mutateAsync(
                                        account.id,
                                      );
                                      toast.success("Account restored", {
                                        icon: ToastIcons.create,
                                      });
                                    } catch (error: any) {
                                      toast.error(
                                        error.message || "Failed to restore",
                                        { icon: ToastIcons.error },
                                      );
                                    }
                                  }}
                                  className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500 text-white shadow-lg transform transition-transform hover:scale-110 active:scale-95 animate-in fade-in zoom-in duration-200"
                                >
                                  <Eye
                                    className="w-3.5 h-3.5"
                                    strokeWidth={2.5}
                                  />
                                </button>

                                <div
                                  className={cn(
                                    "w-full p-2.5 rounded-lg border text-left transition-all flex items-center gap-2 opacity-50",
                                    `neo-card border-slate-700/50 bg-slate-800/30`,
                                  )}
                                >
                                  <div className="flex-1">
                                    <div className="font-semibold text-base text-slate-400">
                                      {account.name}
                                    </div>
                                    <div className="text-xs text-slate-500 capitalize mt-0.5">
                                      {account.type}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
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
                              : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover} ${themeClasses.bgHover}`,
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
                  <span className="inline-flex items-center justify-center w-4 h-4 bg-amber-500 rounded-full mx-0.5">
                    <EyeOff className="w-2.5 h-2.5 text-white" />
                  </span>{" "}
                  to hide
                </p>
              )}

              <div {...categoryLongPress}>
                {editModeCategory ? (
                  <>
                    <Reorder.Group
                      axis="y"
                      values={orderedCategories.filter(
                        (c: any) => c.visible !== false,
                      )}
                      onReorder={handleCategoriesReorder}
                      className="space-y-2 pb-4"
                    >
                      {orderedCategories
                        .filter((c: any) => c.visible !== false)
                        .map((category: any) => {
                          const color = category.color || "#22d3ee";
                          const IconComponent = getCategoryIcon(
                            category.name,
                            category.slug,
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
                                {/* Hide button - EyeOff icon */}
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
                                  className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center bg-amber-500 text-white shadow-lg transform transition-transform hover:scale-110 active:scale-95 animate-in fade-in zoom-in duration-200"
                                >
                                  <EyeOff
                                    className="w-3.5 h-3.5"
                                    strokeWidth={2.5}
                                  />
                                </button>

                                <div
                                  className={cn(
                                    "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                                    `neo-card ${themeClasses.border} bg-bg-card-custom`,
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

                    {/* Hidden categories section */}
                    {orderedCategories.filter((c: any) => c.visible === false)
                      .length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50">
                        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5" />
                          Hidden categories
                        </p>
                        <div className="space-y-2">
                          {orderedCategories
                            .filter((c: any) => c.visible === false)
                            .map((category: any) => {
                              const color = category.color || "#22d3ee";
                              const IconComponent = getCategoryIcon(
                                category.name,
                                category.slug,
                              );

                              return (
                                <div key={category.id} className="relative">
                                  {/* Unhide button - Eye icon */}
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        await unhideCategoryMutation.mutateAsync(
                                          category.id,
                                        );
                                        toast.success("Category restored", {
                                          icon: ToastIcons.create,
                                        });
                                      } catch (error: any) {
                                        toast.error(
                                          error.message || "Failed to restore",
                                          { icon: ToastIcons.error },
                                        );
                                      }
                                    }}
                                    className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500 text-white shadow-lg transform transition-transform hover:scale-110 active:scale-95 animate-in fade-in zoom-in duration-200"
                                  >
                                    <Eye
                                      className="w-3.5 h-3.5"
                                      strokeWidth={2.5}
                                    />
                                  </button>

                                  <div
                                    className={cn(
                                      "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 opacity-50",
                                      `neo-card border-slate-700/50 bg-slate-800/30`,
                                    )}
                                  >
                                    <div style={{ color: `${color}60` }}>
                                      <IconComponent className="w-6 h-6" />
                                    </div>
                                    <span className="font-semibold text-sm text-slate-400 flex-1">
                                      {category.name}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </>
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
                                    console.log(
                                      `[OFFLINE] Category clicked: "${category.name}" (id=${category.id}), mutation.isPending=${addTransactionMutation.isPending}, mutation.status=${addTransactionMutation.status}`,
                                    );
                                    setSelectedCategoryId(category.id);
                                    const hasSubcategories =
                                      categories.some(
                                        (c: any) => c.parent_id === category.id,
                                      ) ||
                                      (category as any).subcategories?.length >
                                        0;

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
                                      "opacity-50 cursor-not-allowed",
                                  )}
                                >
                                  <div className="flex flex-col items-center justify-center gap-1 h-full">
                                    {(() => {
                                      const IconComponent = getCategoryIcon(
                                        category.name,
                                        category.slug,
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
                          },
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
                      <span className="inline-flex items-center justify-center w-4 h-4 bg-amber-500 rounded-full mx-0.5">
                        <EyeOff className="w-2.5 h-2.5 text-white" />
                      </span>{" "}
                      to hide
                    </p>
                  )}

                  <div {...subcategoryLongPress}>
                    {editModeSubcategory ? (
                      <>
                        <Reorder.Group
                          axis="y"
                          values={orderedSubcategories.filter(
                            (s: any) => s.visible !== false,
                          )}
                          onReorder={handleSubcategoriesReorder}
                          className="space-y-2"
                        >
                          {orderedSubcategories
                            .filter((s: any) => s.visible !== false)
                            .map((sub: any) => {
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
                                    {/* Hide button - EyeOff icon */}
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
                                      className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center bg-amber-500 text-white shadow-lg transform transition-transform hover:scale-110 active:scale-95 animate-in fade-in zoom-in duration-200"
                                    >
                                      <EyeOff
                                        className="w-3.5 h-3.5"
                                        strokeWidth={2.5}
                                      />
                                    </button>

                                    <div
                                      className={cn(
                                        "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3",
                                        `neo-card ${themeClasses.border} bg-bg-card-custom`,
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

                        {/* Hidden subcategories section */}
                        {orderedSubcategories.filter(
                          (s: any) => s.visible === false,
                        ).length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                              <EyeOff className="w-3.5 h-3.5" />
                              Hidden subcategories
                            </p>
                            <div className="space-y-2">
                              {orderedSubcategories
                                .filter((s: any) => s.visible === false)
                                .map((sub: any) => {
                                  const color = sub.color || "#22d3ee";
                                  const IconComponent = getCategoryIcon(
                                    sub.name,
                                  );

                                  return (
                                    <div key={sub.id} className="relative">
                                      {/* Unhide button - Eye icon */}
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            await unhideCategoryMutation.mutateAsync(
                                              sub.id,
                                            );
                                            toast.success(
                                              "Subcategory restored",
                                              { icon: ToastIcons.create },
                                            );
                                          } catch (error: any) {
                                            toast.error(
                                              error.message ||
                                                "Failed to restore",
                                              { icon: ToastIcons.error },
                                            );
                                          }
                                        }}
                                        className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500 text-white shadow-lg transform transition-transform hover:scale-110 active:scale-95 animate-in fade-in zoom-in duration-200"
                                      >
                                        <Eye
                                          className="w-3.5 h-3.5"
                                          strokeWidth={2.5}
                                        />
                                      </button>

                                      <div
                                        className={cn(
                                          "w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 opacity-50",
                                          `neo-card border-slate-700/50 bg-slate-800/30`,
                                        )}
                                      >
                                        <div style={{ color: `${color}60` }}>
                                          <IconComponent className="w-5 h-5" />
                                        </div>
                                        <span className="font-semibold text-sm text-slate-400 flex-1">
                                          {sub.name}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSelectedSubcategoryId(undefined)}
                          className={cn(
                            "p-2.5 rounded-lg border text-center transition-all active:scale-95 min-h-[55px] flex items-center justify-center category-appear",
                            !selectedSubcategoryId
                              ? `neo-card ${themeClasses.borderActive} ${themeClasses.bgActive} neo-glow shadow-lg`
                              : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover} ${themeClasses.bgHover}`,
                          )}
                        >
                          <span
                            className={cn(
                              "font-semibold text-xs",
                              !selectedSubcategoryId
                                ? themeClasses.text
                                : "text-white",
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
                                        : `neo-card ${themeClasses.border} bg-bg-card-custom ${themeClasses.borderHover} ${themeClasses.bgHover}`,
                                    )}
                                  >
                                    {(() => {
                                      const IconComponent = getCategoryIcon(
                                        sub.name,
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
                            },
                          )}
                        </AnimatePresence>
                        {/* Add New Subcategory Button */}
                        <button
                          onClick={() => setShowNewSubcategoryDrawer(true)}
                          className="p-2.5 rounded-lg border-2 border-dashed border-slate-600 hover:border-cyan-500/50 text-center transition-all active:scale-95 min-h-[55px] bg-transparent hover:bg-cyan-500/5 flex flex-col items-center justify-center gap-1 category-appear"
                        >
                          <PlusIcon className="w-5 h-5 text-slate-400" />
                          <span className="text-xs text-slate-400">New</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {!editModeSubcategory && orderedSubcategories.length > 0 && (
                    <p className="text-[10px] text-slate-600 text-center">
                      Hold to edit subcategories
                    </p>
                  )}
                </>
              )}

              {/* Show add button when no subcategories exist */}
              {orderedSubcategories.length === 0 && (
                <div className="space-y-3">
                  <Label
                    className={`text-base font-semibold ${themeClasses.text}`}
                  >
                    More specific?
                  </Label>
                  <button
                    onClick={() => setShowNewSubcategoryDrawer(true)}
                    className="w-full p-4 rounded-lg border-2 border-dashed border-slate-600 hover:border-cyan-500/50 text-center transition-all active:scale-95 bg-transparent hover:bg-cyan-500/5 flex flex-col items-center justify-center gap-2"
                  >
                    <PlusIcon className="w-6 h-6 text-slate-400" />
                    <span className="text-sm text-slate-400">
                      Add subcategory
                    </span>
                    <span className="text-xs text-slate-500">
                      Optional - for more detailed tracking
                    </span>
                  </button>
                </div>
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
                    : `Add ${getTransactionLabel(selectedAccount?.type)}`}
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

        {selectedAccountId && selectedCategoryId && selectedCategory && (
          <NewSubcategoryDrawer
            open={showNewSubcategoryDrawer}
            onOpenChange={setShowNewSubcategoryDrawer}
            accountId={selectedAccountId}
            parentCategoryId={selectedCategoryId}
            parentCategoryName={selectedCategory.name}
            parentCategoryColor={selectedCategory.color || "#22d3ee"}
            onSubcategoryCreated={async (subcategoryId: string) => {
              // Refetch categories to get the new subcategory
              await refetchCategories();
              // Auto-select the newly created subcategory
              setSelectedSubcategoryId(subcategoryId);
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
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-2">
                <EyeOff className="w-6 h-6 text-amber-500" />
              </div>
              <DrawerTitle
                className={cn(
                  "text-lg font-semibold",
                  deleteConfirm?.step === "second"
                    ? "text-amber-400"
                    : themeClasses.text,
                )}
              >
                {deleteConfirm?.step === "first"
                  ? `Hide ${deleteConfirm?.type === "account" ? "Account" : deleteConfirm?.type === "category" ? "Category" : "Subcategory"}?`
                  : "Confirm hiding?"}
              </DrawerTitle>
              <DrawerDescription className="text-slate-400 text-sm">
                {deleteConfirm?.step === "first" ? (
                  <>
                    You're about to hide{" "}
                    <span
                      className="font-semibold"
                      style={{ color: deleteConfirm?.color || "#22d3ee" }}
                    >
                      {deleteConfirm?.name}
                    </span>
                    . It will be hidden from view but your data is safe.
                  </>
                ) : (
                  <>
                    <span
                      className="font-semibold"
                      style={{ color: deleteConfirm?.color || "#22d3ee" }}
                    >
                      {deleteConfirm?.name}
                    </span>{" "}
                    will be hidden from selection.
                    {deleteConfirm?.type === "category" && (
                      <span className="block mt-1 text-slate-500">
                        Subcategories will also be hidden.
                      </span>
                    )}
                    <span className="block mt-1 text-emerald-400">
                      Your transactions remain safe.
                    </span>
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
                    ? "bg-amber-500/80 hover:bg-amber-500 text-white"
                    : "bg-amber-600 hover:bg-amber-700 text-white",
                )}
              >
                {isDeleting
                  ? "Hiding..."
                  : deleteConfirm?.step === "first"
                    ? "Yes, Hide"
                    : "Hide from view"}
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
                top: selectedAccountId && step === "amount" ? "205px" : "80px",
              }} // Dynamic: below header
            />
          )}
        </AnimatePresence>

        {/* Floating Done Button is now rendered at layout level (ExpenseTagsBarWrapper) to fix z-index stacking */}
      </>
    </div>
  );
}
