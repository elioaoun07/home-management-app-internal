"use client";

import { CheckIcon, PlusIcon, XIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useLbpSettings } from "@/features/preferences/useLbpSettings";
import {
  type FuturePayment,
  useConfirmFuturePayment,
  useDeleteFuturePayment,
  useFuturePayments,
} from "@/features/recurring/useFuturePayments";
import {
  type RecurringPayment,
  useConfirmPayment,
  useCreateRecurringPayment,
  useDeleteRecurringPayment,
  useRecurringPayments,
  useUpdateRecurringPayment,
} from "@/features/recurring/useRecurringPayments";
import {
  useConfirmDraft,
  useDeleteDraft,
  useDrafts,
} from "@/features/drafts/useDrafts";
import {
  getMemberDisplayName,
  useHouseholdMembers,
} from "@/hooks/useHouseholdMembers";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import {
  format,
  formatDistanceToNow,
  isPast,
  isToday,
  isTomorrow,
} from "date-fns";
import {
  Banknote,
  Calendar,
  CalendarClock,
  Edit2,
  FileText,
  Lock,
  Power,
  Trash2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function getOrdinalSuffix(day: number) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

type TabMode = "recurring" | "future" | "draft";

type DraftItem = {
  id: string;
  date: string;
  amount: number;
  description: string;
  category_id: string | null;
  subcategory_id: string | null;
  voice_transcript: string | null;
  confidence_score: number | null;
  inserted_at: string;
  account_id: string;
  accounts: { name: string };
  category?: { name: string } | null;
  subcategory?: { name: string } | null;
};

export default function RecurringPage() {
  const tc = useThemeClasses();
  const { data: recurringPayments = [], isLoading: isLoadingRecurring } =
    useRecurringPayments();
  const { data: futurePayments = [], isLoading: isLoadingFuture } =
    useFuturePayments();
  const { data: accounts = [] } = useMyAccounts();
  const defaultAccount = accounts.find((a) => a.is_default) || accounts[0];
  const { data: categories = [] } = useCategories(defaultAccount?.id);
  const { data: householdData } = useHouseholdMembers();
  const currentUserId = householdData?.currentUserId ?? null;
  const members = householdData?.members ?? [];

  const [activeTab, setActiveTab] = useState<TabMode>("recurring");
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(
    null,
  );
  const [confirmingRecurring, setConfirmingRecurring] =
    useState<RecurringPayment | null>(null);
  const [confirmingFuture, setConfirmingFuture] =
    useState<FuturePayment | null>(null);
  const [confirmingDraft, setConfirmingDraft] = useState<DraftItem | null>(
    null,
  );

  // LBP settings
  const { lbpRate, calculateActualValue } = useLbpSettings();
  const [lbpChangeInput, setLbpChangeInput] = useState("");
  const [lbpExpanded, setLbpExpanded] = useState(false);
  const [confirmLbpInput, setConfirmLbpInput] = useState("");
  const [confirmLbpExpanded, setConfirmLbpExpanded] = useState(false);

  const createMutation = useCreateRecurringPayment();
  const updateMutation = useUpdateRecurringPayment();
  const deleteMutation = useDeleteRecurringPayment();
  const confirmRecurringMutation = useConfirmPayment();
  const confirmFutureMutation = useConfirmFuturePayment();
  const deleteFutureMutation = useDeleteFuturePayment();
  const { data: draftPayments = [], isLoading: isLoadingDrafts } = useDrafts();
  const deleteDraftMutation = useDeleteDraft();
  const confirmDraftMutation = useConfirmDraft();

  // Form state for Add/Edit recurring
  const [formData, setFormData] = useState({
    account_id: "",
    category_id: "",
    subcategory_id: "",
    name: "",
    amount: "",
    description: "",
    recurrence_type: "monthly" as "daily" | "weekly" | "monthly" | "yearly",
    recurrence_day: "",
    next_due_date: "",
    payment_method: "manual" as "manual" | "auto",
    is_private: false,
  });

  // Confirm form state (shared for both recurring and future payment confirmation)
  const [confirmFormData, setConfirmFormData] = useState({
    amount: "",
    description: "",
    date: "",
    account_id: "",
    category_id: "",
    subcategory_id: "",
  });

  // Recurring: separate Cash vs Auto, ordered by day
  const activePayments = useMemo(
    () => recurringPayments.filter((p) => p.is_active !== false),
    [recurringPayments],
  );

  const cashPayments = useMemo(() => {
    return activePayments
      .filter((p) => (p.payment_method ?? "manual") === "manual")
      .sort((a, b) => {
        const dayA = a.recurrence_day ?? new Date(a.next_due_date).getDate();
        const dayB = b.recurrence_day ?? new Date(b.next_due_date).getDate();
        return dayA - dayB;
      });
  }, [activePayments]);

  const autoPayments = useMemo(() => {
    return activePayments
      .filter((p) => p.payment_method === "auto")
      .sort((a, b) => {
        const dayA = a.recurrence_day ?? new Date(a.next_due_date).getDate();
        const dayB = b.recurrence_day ?? new Date(b.next_due_date).getDate();
        return dayA - dayB;
      });
  }, [activePayments]);

  const disabledPayments = useMemo(() => {
    return recurringPayments
      .filter((p) => !p.is_active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [recurringPayments]);

  // Monthly total (active only)
  const monthlyTotal = useMemo(() => {
    return activePayments.reduce((sum, p) => {
      if (p.recurrence_type === "monthly") return sum + p.amount;
      if (p.recurrence_type === "weekly") return sum + p.amount * 4.33;
      if (p.recurrence_type === "daily") return sum + p.amount * 30;
      if (p.recurrence_type === "yearly") return sum + p.amount / 12;
      return sum;
    }, 0);
  }, [activePayments]);

  // Future payments: separate due/overdue vs upcoming
  const dueFuturePayments = useMemo(
    () =>
      futurePayments.filter(
        (p) =>
          isPast(new Date(p.scheduled_date)) ||
          isToday(new Date(p.scheduled_date)),
      ),
    [futurePayments],
  );
  const upcomingFuturePayments = useMemo(
    () =>
      futurePayments.filter(
        (p) =>
          !isPast(new Date(p.scheduled_date)) &&
          !isToday(new Date(p.scheduled_date)),
      ),
    [futurePayments],
  );
  const futureTotal = useMemo(
    () => futurePayments.reduce((s, p) => s + p.amount, 0),
    [futurePayments],
  );

  useEffect(() => {
    if (defaultAccount) {
      setFormData((prev) => ({ ...prev, account_id: defaultAccount.id }));
    }
  }, [defaultAccount]);

  useEffect(() => {
    if (editingPayment) {
      setFormData({
        account_id: editingPayment.account_id,
        category_id: editingPayment.category_id || "",
        subcategory_id: editingPayment.subcategory_id || "",
        name: editingPayment.name,
        amount: editingPayment.amount.toString(),
        description: editingPayment.description || "",
        recurrence_type: editingPayment.recurrence_type,
        recurrence_day: editingPayment.recurrence_day?.toString() || "",
        next_due_date: editingPayment.next_due_date,
        payment_method: editingPayment.payment_method || "manual",
        is_private: editingPayment.is_private ?? false,
      });
      setLbpChangeInput(
        editingPayment.lbp_change_received
          ? editingPayment.lbp_change_received.toString()
          : "",
      );
      setLbpExpanded(!!editingPayment.lbp_change_received);
      setShowAddDrawer(true);
    }
  }, [editingPayment]);

  // Auto-populate confirm form + name-match for partner
  const populateConfirmForm = useCallback(
    async (
      payment: {
        name?: string;
        amount: number;
        description?: string | null;
        account_id: string;
        category_id?: string | null;
        subcategory_id?: string | null;
        user_id?: string;
        account?: { name: string } | null;
        accounts?: { name: string } | null;
        category?: { name: string; slug?: string | null } | null;
        subcategory?: { name: string; slug?: string | null } | null;
      },
      isOwner: boolean,
    ) => {
      // Pre-populate LBP from the recurring payment if available
      const lbpVal = (payment as any).lbp_change_received;
      setConfirmLbpInput(lbpVal ? lbpVal.toString() : "");
      setConfirmLbpExpanded(!!lbpVal);

      if (isOwner) {
        setConfirmFormData({
          amount: payment.amount.toString(),
          description: payment.description || payment.name || "",
          date: new Date().toISOString().split("T")[0],
          account_id: payment.account_id,
          category_id: payment.category_id || "",
          subcategory_id: payment.subcategory_id || "",
        });
        return;
      }

      // Partner is confirming — resolve fields by matching slugs client-side
      // (owner's IDs don't exist in partner's dropdowns; slug is the canonical cross-user key)
      const ownerAccountName = (
        payment.account?.name ||
        payment.accounts?.name ||
        ""
      ).toLowerCase();
      const ownerCategorySlug = payment.category?.slug || "";
      const ownerSubcategorySlug = payment.subcategory?.slug || "";
      // Name fallbacks for categories that pre-date slug generation
      const ownerCategoryName = (payment.category?.name || "").toLowerCase();
      const ownerSubcategoryName = (
        payment.subcategory?.name || ""
      ).toLowerCase();

      // Match account by name (accounts have no slug column)
      const matchedAccount = ownerAccountName
        ? accounts.find((a) => a.name.toLowerCase() === ownerAccountName)
        : undefined;

      // Match category by slug (preferred) or name fallback
      const topCategories = categories.filter((c: any) => !c.parent_id);
      const matchedCategory = ownerCategorySlug
        ? topCategories.find((c: any) => c.slug === ownerCategorySlug)
        : ownerCategoryName
          ? topCategories.find(
              (c: any) => c.name.toLowerCase() === ownerCategoryName,
            )
          : undefined;

      // Match subcategory by slug (preferred) or name fallback
      let matchedSubcategory: any = undefined;
      if (matchedCategory && (ownerSubcategorySlug || ownerSubcategoryName)) {
        const subs = categories.filter(
          (c: any) => c.parent_id === matchedCategory.id,
        );
        matchedSubcategory = ownerSubcategorySlug
          ? subs.find((c: any) => c.slug === ownerSubcategorySlug)
          : subs.find(
              (c: any) => c.name.toLowerCase() === ownerSubcategoryName,
            );
      }

      setConfirmFormData({
        amount: payment.amount.toString(),
        description: payment.description || payment.name || "",
        date: new Date().toISOString().split("T")[0],
        account_id: matchedAccount?.id || "",
        category_id: matchedCategory?.id || "",
        subcategory_id: matchedSubcategory?.id || "",
      });
    },
    [accounts, categories],
  );

  useEffect(() => {
    if (confirmingRecurring) {
      const isOwner =
        !currentUserId || confirmingRecurring.user_id === currentUserId;
      populateConfirmForm(confirmingRecurring, isOwner);
    }
  }, [confirmingRecurring, currentUserId, populateConfirmForm]);

  useEffect(() => {
    if (confirmingFuture) {
      const isOwner =
        !currentUserId || confirmingFuture.user_id === currentUserId;
      populateConfirmForm(
        {
          ...confirmingFuture,
          name: confirmingFuture.description,
        },
        isOwner,
      );
    }
  }, [confirmingFuture, currentUserId, populateConfirmForm]);

  useEffect(() => {
    if (confirmingDraft) {
      populateConfirmForm(
        { ...confirmingDraft, name: confirmingDraft.description },
        true,
      );
    }
  }, [confirmingDraft, populateConfirmForm]);

  const resetForm = () => {
    setFormData({
      account_id: defaultAccount?.id || "",
      category_id: "",
      subcategory_id: "",
      name: "",
      amount: "",
      description: "",
      recurrence_type: "monthly",
      recurrence_day: "",
      next_due_date: "",
      payment_method: "manual",
      is_private: false,
    });
    setLbpChangeInput("");
    setLbpExpanded(false);
  };

  const handleSubmit = async () => {
    if (
      !formData.name ||
      !formData.amount ||
      !formData.account_id ||
      !formData.next_due_date
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      const parsedLbpChange = lbpChangeInput
        ? parseFloat(lbpChangeInput)
        : null;
      if (editingPayment) {
        await updateMutation.mutateAsync({
          id: editingPayment.id,
          name: formData.name,
          amount: parseFloat(formData.amount),
          description: formData.description || null,
          lbp_change_received: parsedLbpChange,
          category_id: formData.category_id || null,
          subcategory_id: formData.subcategory_id || null,
          recurrence_type: formData.recurrence_type,
          recurrence_day: formData.recurrence_day
            ? parseInt(formData.recurrence_day)
            : null,
          next_due_date: formData.next_due_date,
          payment_method: formData.payment_method,
          is_private: formData.is_private,
        });
      } else {
        await createMutation.mutateAsync({
          account_id: formData.account_id,
          category_id: formData.category_id || null,
          subcategory_id: formData.subcategory_id || null,
          name: formData.name,
          amount: parseFloat(formData.amount),
          description: formData.description || null,
          lbp_change_received: parsedLbpChange,
          recurrence_type: formData.recurrence_type,
          recurrence_day: formData.recurrence_day
            ? parseInt(formData.recurrence_day)
            : null,
          next_due_date: formData.next_due_date,
          payment_method: formData.payment_method,
          is_private: formData.is_private,
        });
      }
      resetForm();
      setShowAddDrawer(false);
      setEditingPayment(null);
    } catch {
      // Error toast shown by hook
    }
  };

  const handleConfirmDraft = async () => {
    if (!confirmingDraft) return;
    try {
      await confirmDraftMutation.mutateAsync({
        id: confirmingDraft.id,
        amount: confirmFormData.amount,
        category_id: confirmFormData.category_id,
        subcategory_id: confirmFormData.subcategory_id || undefined,
        description: confirmFormData.description,
        date: confirmFormData.date,
        account_id: confirmFormData.account_id || confirmingDraft.account_id,
      });
      setConfirmingDraft(null);
    } catch {
      // Error toast shown by hook
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      // Error toast shown by hook
    }
  };

  // Confirm Recurring Payment
  const handleConfirmRecurring = async () => {
    if (!confirmingRecurring) return;
    try {
      const parsedConfirmLbp = confirmLbpInput
        ? parseFloat(confirmLbpInput)
        : null;
      const result = await confirmRecurringMutation.mutateAsync({
        id: confirmingRecurring.id,
        amount: parseFloat(confirmFormData.amount),
        description: confirmFormData.description,
        date: confirmFormData.date,
        account_id: confirmFormData.account_id || undefined,
        category_id: confirmFormData.category_id || null,
        subcategory_id: confirmFormData.subcategory_id || null,
        lbp_change_received: parsedConfirmLbp,
      });
      const transactionId: string | undefined =
        result?.transaction?.id ?? result?.id;
      toast.success("Payment confirmed!", {
        icon: ToastIcons.success,
        description: result?.next_due_date
          ? `Next due: ${format(new Date(result.next_due_date), "MMM d, yyyy")}`
          : undefined,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (!transactionId) {
              toast.error("Cannot undo — transaction ID unavailable");
              return;
            }
            try {
              await safeFetch(`/api/transactions/${transactionId}`, {
                method: "DELETE",
              });
              toast.success("Transaction removed", { icon: ToastIcons.delete });
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
      setConfirmingRecurring(null);
    } catch {
      // Error toast shown by hook
    }
  };

  // Confirm Future Payment
  const handleConfirmFuture = async () => {
    if (!confirmingFuture) return;
    try {
      const parsedConfirmLbp = confirmLbpInput
        ? parseFloat(confirmLbpInput)
        : null;
      const result = await confirmFutureMutation.mutateAsync({
        id: confirmingFuture.id,
        amount: parseFloat(confirmFormData.amount),
        description: confirmFormData.description,
        date: confirmFormData.date,
        account_id: confirmFormData.account_id || undefined,
        category_id: confirmFormData.category_id || null,
        subcategory_id: confirmFormData.subcategory_id || null,
        lbp_change_received: parsedConfirmLbp,
      });
      const transactionId: string | undefined = result?.transaction?.id;
      toast.success("Future payment confirmed!", {
        icon: ToastIcons.success,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (!transactionId) {
              toast.error("Cannot undo — transaction ID unavailable");
              return;
            }
            try {
              await safeFetch(`/api/transactions/${transactionId}`, {
                method: "DELETE",
              });
              toast.success("Transaction removed", { icon: ToastIcons.delete });
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
      setConfirmingFuture(null);
    } catch {
      // Error toast shown by hook
    }
  };

  const getDueDateInfo = (payment: RecurringPayment) => {
    const dueDate = new Date(payment.next_due_date);
    const isDueToday = isToday(dueDate);
    const isOverdue = isPast(dueDate) && !isDueToday;
    const isDue = isDueToday || isOverdue;
    return {
      isDue,
      isDueToday,
      isOverdue,
      formatted: isDueToday
        ? "Due Today"
        : isOverdue
          ? `Overdue by ${formatDistanceToNow(dueDate)}`
          : `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`,
    };
  };

  const subcategories = formData.category_id
    ? categories.filter((c: any) => c.parent_id === formData.category_id)
    : [];
  const confirmSubcategories = confirmFormData.category_id
    ? categories.filter((c: any) => c.parent_id === confirmFormData.category_id)
    : [];

  const isLoading =
    activeTab === "recurring"
      ? isLoadingRecurring
      : activeTab === "future"
        ? isLoadingFuture
        : isLoadingDrafts;

  if (isLoading) {
    return (
      <div
        className={cn(
          "min-h-screen flex items-center justify-center",
          tc.bgPage,
        )}
      >
        <div className={tc.text}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen pb-32", tc.bgPage)}>
      <div className="max-w-2xl mx-auto p-4">
        {/* Sticky Header */}
        <div
          className={cn(
            "sticky top-14 z-30 pb-3 mb-3 -mx-4 px-4 pt-3 border-b backdrop-blur-md",
            "bg-[hsl(var(--header-bg)/0.95)]",
            tc.border,
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className={cn("text-2xl font-bold", tc.text)}>Payments</h1>
              <p className={cn("text-sm", tc.textMuted)}>
                {activeTab === "recurring"
                  ? `${activePayments.length} active · $${monthlyTotal.toFixed(0)}/mo`
                  : activeTab === "future"
                    ? `${futurePayments.length} scheduled · $${futureTotal.toFixed(0)} total`
                    : `${draftPayments.length} draft${draftPayments.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            {activeTab === "recurring" && (
              <button
                onClick={() => {
                  setEditingPayment(null);
                  resetForm();
                  setShowAddDrawer(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full neo-gradient text-white neo-glow hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                <PlusIcon className="w-4 h-4" />
                <span className="text-sm font-semibold">Add</span>
              </button>
            )}
          </div>

          {/* Tab toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/5">
            <button
              onClick={() => setActiveTab("recurring")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === "recurring"
                  ? cn("bg-white/10", tc.textHighlight, "shadow-sm")
                  : "text-white/40 hover:text-white/60",
              )}
            >
              <CalendarClock className="w-4 h-4" />
              Recurring
            </button>
            <button
              onClick={() => setActiveTab("future")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === "future"
                  ? cn("bg-white/10", tc.textHighlight, "shadow-sm")
                  : "text-white/40 hover:text-white/60",
              )}
            >
              <Calendar className="w-4 h-4" />
              Future
              {dueFuturePayments.length > 0 && (
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                  {dueFuturePayments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("draft")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === "draft"
                  ? cn("bg-white/10", tc.textHighlight, "shadow-sm")
                  : "text-white/40 hover:text-white/60",
              )}
            >
              <FileText className="w-4 h-4" />
              Drafts
              {draftPayments.length > 0 && (
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/10 text-white/60 text-[10px] font-bold">
                  {draftPayments.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ═══ RECURRING PAYMENTS TAB ═══ */}
        {activeTab === "recurring" && (
          <>
            {activePayments.length === 0 && disabledPayments.length === 0 ? (
              <div className="neo-card p-8 text-center">
                <CalendarClock
                  className={cn("w-16 h-16 mx-auto mb-4", tc.textFaint)}
                />
                <p className={cn("mb-2", tc.textMuted)}>
                  No recurring payments yet
                </p>
                <p className={cn("text-sm", tc.textFaint)}>
                  Tap the + button to add your first recurring payment
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Cash / Manual Section */}
                {cashPayments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                        <Banknote className="w-3 h-3" /> Cash / Manual
                      </span>
                      <span className="text-[10px] text-white/25">
                        ({cashPayments.length})
                      </span>
                    </div>
                    <RecurringSection
                      payments={cashPayments}
                      tc={tc}
                      currentUserId={currentUserId}
                      members={members}
                      getDueDateInfo={getDueDateInfo}
                      onConfirm={setConfirmingRecurring}
                      onEdit={setEditingPayment}
                      onDelete={handleDelete}
                    />
                  </div>
                )}

                {/* Auto / Online Section */}
                {autoPayments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Auto / Online
                      </span>
                      <span className="text-[10px] text-white/25">
                        ({autoPayments.length})
                      </span>
                    </div>
                    <RecurringSection
                      payments={autoPayments}
                      tc={tc}
                      currentUserId={currentUserId}
                      members={members}
                      getDueDateInfo={getDueDateInfo}
                      onConfirm={setConfirmingRecurring}
                      onEdit={setEditingPayment}
                      onDelete={handleDelete}
                      onToggle={(p) =>
                        updateMutation.mutate({
                          id: p.id,
                          is_active: false,
                        })
                      }
                      isAutoSection
                    />
                  </div>
                )}

                {/* Disabled Subscriptions */}
                {disabledPayments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1">
                        <Power className="w-3 h-3" /> Disabled
                      </span>
                      <span className="text-[10px] text-white/20">
                        ({disabledPayments.length})
                      </span>
                    </div>
                    <div className="space-y-0.5 opacity-50">
                      {disabledPayments.map((payment) => {
                        const day =
                          payment.recurrence_day ??
                          new Date(payment.next_due_date).getDate();
                        return (
                          <div
                            key={payment.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent hover:bg-white/5"
                          >
                            <span className="w-8 text-center text-sm font-bold tabular-nums text-white/30">
                              {day}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white/40 truncate line-through">
                                {payment.name}
                              </p>
                              {payment.category && (
                                <p className="text-[10px] text-white/20 truncate">
                                  {payment.category.name}
                                </p>
                              )}
                            </div>
                            <span className="w-16 text-right text-sm font-semibold tabular-nums text-white/30">
                              ${payment.amount.toFixed(0)}
                            </span>
                            <div className="w-8 flex justify-center">
                              <button
                                onClick={() =>
                                  updateMutation.mutate({
                                    id: payment.id,
                                    is_active: true,
                                  })
                                }
                                className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
                              >
                                <Power className="w-3.5 h-3.5 text-white/40" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Total row */}
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg border",
                    tc.border,
                    tc.bgSurface,
                  )}
                >
                  <span className="w-8" />
                  <span className="flex-1 text-sm font-semibold text-white/60">
                    Monthly Total
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      tc.textHighlight,
                    )}
                  >
                    ${monthlyTotal.toFixed(0)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ FUTURE PAYMENTS TAB ═══ */}
        {activeTab === "future" && (
          <>
            {futurePayments.length === 0 ? (
              <div className="neo-card p-8 text-center">
                <Calendar
                  className={cn("w-16 h-16 mx-auto mb-4", tc.textFaint)}
                />
                <p className={cn("mb-2", tc.textMuted)}>No future payments</p>
                <p className={cn("text-sm", tc.textFaint)}>
                  Schedule a future payment from the New Expense form by picking
                  a future date
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Due Now */}
                {dueFuturePayments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                        Due Now
                      </span>
                    </div>
                    <FutureSection
                      payments={dueFuturePayments}
                      tc={tc}
                      currentUserId={currentUserId}
                      members={members}
                      onConfirm={setConfirmingFuture}
                      onDelete={(id) => deleteFutureMutation.mutate(id)}
                      isDue
                    />
                  </div>
                )}

                {/* Upcoming */}
                {upcomingFuturePayments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                        Upcoming
                      </span>
                    </div>
                    <FutureSection
                      payments={upcomingFuturePayments}
                      tc={tc}
                      currentUserId={currentUserId}
                      members={members}
                      onConfirm={setConfirmingFuture}
                      onDelete={(id) => deleteFutureMutation.mutate(id)}
                      isDue={false}
                    />
                  </div>
                )}

                {/* Total row */}
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg border",
                    tc.border,
                    tc.bgSurface,
                  )}
                >
                  <span className="flex-1 text-sm font-semibold text-white/60">
                    Total Scheduled
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      tc.textHighlight,
                    )}
                  >
                    ${futureTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ DRAFT PAYMENTS TAB ═══ */}
        {activeTab === "draft" && (
          <>
            {draftPayments.length === 0 ? (
              <div className="neo-card p-8 text-center">
                <FileText
                  className={cn("w-16 h-16 mx-auto mb-4", tc.textFaint)}
                />
                <p className={cn("mb-2", tc.textMuted)}>No drafts</p>
                <p className={cn("text-sm", tc.textFaint)}>
                  Drafts appear here when an expense is saved without being
                  confirmed
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-white/30">
                  <span className="w-14 text-center">Date</span>
                  <span className="flex-1">Description</span>
                  <span className="w-16 text-right">Amount</span>
                  <span className="w-16" />
                </div>
                {draftPayments.map((draft) => (
                  <DraftRow
                    key={draft.id}
                    draft={draft}
                    tc={tc}
                    onConfirm={setConfirmingDraft}
                    onDelete={(id) => deleteDraftMutation.mutate(id)}
                  />
                ))}
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg border",
                    tc.border,
                    tc.bgSurface,
                  )}
                >
                  <span className="flex-1 text-sm font-semibold text-white/60">
                    Total Drafts
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      tc.textHighlight,
                    )}
                  >
                    ${draftPayments.reduce((s, d) => s + d.amount, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ ADD/EDIT RECURRING DRAWER ═══ */}
        {showAddDrawer && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end">
            <div
              className={`w-full ${tc.bgSurface} rounded-t-3xl h-[92vh] flex flex-col`}
            >
              <div
                className={`flex items-center justify-between p-6 pb-4 border-b ${tc.border} flex-shrink-0`}
              >
                <h2 className={`text-xl font-bold ${tc.text}`}>
                  {editingPayment ? "Edit Payment" : "Add Recurring Payment"}
                </h2>
                <button
                  onClick={() => {
                    setShowAddDrawer(false);
                    setEditingPayment(null);
                  }}
                  className={`p-2 rounded-lg ${tc.bgSurface} ${tc.bgHover}`}
                >
                  <XIcon className={`w-5 h-5 ${tc.text}`} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-6 pt-4">
                <div className="space-y-4 pb-32">
                  <div>
                    <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                      Name *
                    </Label>
                    <Input
                      placeholder="e.g., Internet Bill, Netflix"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className={`${tc.inputBg} text-white`}
                    />
                  </div>
                  <div>
                    <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                      Amount *
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      className={`${tc.inputBg} text-white`}
                    />
                  </div>

                  {/* LBP Change */}
                  {lbpRate && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Label className={`text-sm ${tc.textMuted}`}>
                          LBP Change
                        </Label>
                        {!lbpExpanded && (
                          <button
                            type="button"
                            onClick={() => setLbpExpanded(true)}
                            className={cn(
                              "h-6 px-2 rounded-full text-[10px] font-bold border transition-all active:scale-95",
                              lbpChangeInput && parseFloat(lbpChangeInput) > 0
                                ? `${tc.bgActive} ${tc.borderActive} ${tc.text}`
                                : `${tc.bgSurface} ${tc.border} ${tc.textMuted}`,
                            )}
                          >
                            LBP
                          </button>
                        )}
                      </div>
                      {lbpExpanded && (
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "flex-1 flex items-center gap-1 h-10 px-3 rounded-md border",
                              tc.inputBg,
                              tc.border,
                            )}
                          >
                            <span
                              className={`text-xs ${tc.textFaint} shrink-0`}
                            >
                              LBP
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="000"
                              value={lbpChangeInput}
                              onChange={(e) =>
                                setLbpChangeInput(e.target.value)
                              }
                              className="flex-1 bg-transparent border-none outline-none text-right text-sm text-white placeholder:opacity-30"
                            />
                            {lbpChangeInput && (
                              <span
                                className={`text-xs ${tc.textFaint} shrink-0`}
                              >
                                ,000
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setLbpExpanded(false);
                              setLbpChangeInput("");
                            }}
                            className={`p-2 rounded-md ${tc.bgSurface} ${tc.bgHover}`}
                          >
                            <XIcon className={`w-4 h-4 ${tc.textMuted}`} />
                          </button>
                        </div>
                      )}
                      {lbpExpanded &&
                        formData.amount &&
                        parseFloat(formData.amount) > 0 &&
                        lbpChangeInput &&
                        parseFloat(lbpChangeInput) > 0 && (
                          <p className={`text-xs mt-1 ${tc.textFaint}`}>
                            ≈{" "}
                            <span className={`font-semibold ${tc.text}`}>
                              $
                              {calculateActualValue(
                                parseFloat(formData.amount),
                                parseFloat(lbpChangeInput),
                              )?.toFixed(2) ?? "—"}
                            </span>
                          </p>
                        )}
                    </div>
                  )}

                  {/* Payment Method Toggle */}
                  <div>
                    <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                      Payment Method
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, payment_method: "manual" })
                        }
                        className={cn(
                          "px-4 py-3 rounded-xl text-sm font-medium transition-all border",
                          formData.payment_method === "manual"
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                            : cn("border-white/10 text-white/50", tc.bgSurface),
                        )}
                      >
                        <Banknote className="w-5 h-5 mx-auto mb-0.5" />
                        <div>Cash / Manual</div>
                        <div className="text-[10px] text-white/30 mt-0.5">
                          Log via confirm
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, payment_method: "auto" })
                        }
                        className={cn(
                          "px-4 py-3 rounded-xl text-sm font-medium transition-all border",
                          formData.payment_method === "auto"
                            ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                            : cn("border-white/10 text-white/50", tc.bgSurface),
                        )}
                      >
                        <Zap className="w-5 h-5 mx-auto mb-0.5" />
                        <div>Auto / Online</div>
                        <div className="text-[10px] text-white/30 mt-0.5">
                          Info only (via statement)
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                      Account *
                    </Label>
                    <Select
                      value={formData.account_id}
                      onValueChange={(v) =>
                        setFormData({ ...formData, account_id: v })
                      }
                    >
                      <SelectTrigger className={`${tc.inputBg} text-white`}>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                      Category
                    </Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(v) =>
                        setFormData({
                          ...formData,
                          category_id: v,
                          subcategory_id: "",
                        })
                      }
                    >
                      <SelectTrigger className={`${tc.inputBg} text-white`}>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter((c: any) => !c.parent_id)
                          .map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {subcategories.length > 0 && (
                    <div>
                      <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                        Subcategory
                      </Label>
                      <Select
                        value={formData.subcategory_id}
                        onValueChange={(v) =>
                          setFormData({ ...formData, subcategory_id: v })
                        }
                      >
                        <SelectTrigger className={`${tc.inputBg} text-white`}>
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                          {subcategories.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                      Repeat *
                    </Label>
                    <Select
                      value={formData.recurrence_type}
                      onValueChange={(v: any) =>
                        setFormData({ ...formData, recurrence_type: v })
                      }
                    >
                      <SelectTrigger className={`${tc.inputBg} text-white`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.recurrence_type === "monthly" && (
                    <div>
                      <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                        Day of Month
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="1-31"
                        value={formData.recurrence_day}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            recurrence_day: e.target.value,
                          })
                        }
                        className={`${tc.inputBg} text-white`}
                      />
                    </div>
                  )}

                  {formData.recurrence_type === "weekly" && (
                    <div>
                      <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                        Day of Week
                      </Label>
                      <Select
                        value={formData.recurrence_day}
                        onValueChange={(v) =>
                          setFormData({ ...formData, recurrence_day: v })
                        }
                      >
                        <SelectTrigger className={`${tc.inputBg} text-white`}>
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                      Next Due Date *
                    </Label>
                    <Input
                      type="date"
                      value={formData.next_due_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          next_due_date: e.target.value,
                        })
                      }
                      className={`${tc.inputBg} text-white`}
                    />
                  </div>

                  <div>
                    <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                      Description
                    </Label>
                    <Input
                      placeholder="Optional notes"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className={`${tc.inputBg} text-white`}
                    />
                  </div>

                  {/* Private toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        is_private: !formData.is_private,
                      })
                    }
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all",
                      formData.is_private
                        ? "bg-white/8 border-white/20 text-white"
                        : "border-white/8 text-white/40",
                      tc.bgSurface,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="w-4 h-4" />
                      <div className="text-left">
                        <div className="text-sm font-medium">Private</div>
                        <div className="text-[10px] text-white/30">
                          Only you can see this payment
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "w-9 h-5 rounded-full transition-all relative",
                        formData.is_private ? "bg-white/30" : "bg-white/10",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                          formData.is_private ? "left-4" : "left-0.5",
                        )}
                      />
                    </div>
                  </button>

                  <Button
                    onClick={handleSubmit}
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    className="w-full h-12 text-base font-semibold neo-gradient text-white"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingPayment
                        ? "Update Payment"
                        : "Add Payment"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CONFIRM DRAWER (shared for recurring + future) ═══ */}
        {(confirmingRecurring || confirmingFuture || confirmingDraft) && (
          <ConfirmDrawer
            title={
              confirmingRecurring
                ? confirmingRecurring.name
                : confirmingFuture
                  ? confirmingFuture.description || "Future Payment"
                  : confirmingDraft!.description || "Draft"
            }
            tc={tc}
            formData={confirmFormData}
            setFormData={setConfirmFormData}
            accounts={accounts}
            categories={categories}
            subcategories={confirmSubcategories}
            isPending={
              confirmRecurringMutation.isPending ||
              confirmFutureMutation.isPending ||
              confirmDraftMutation.isPending
            }
            onConfirm={
              confirmingRecurring
                ? handleConfirmRecurring
                : confirmingFuture
                  ? handleConfirmFuture
                  : handleConfirmDraft
            }
            onClose={() => {
              setConfirmingRecurring(null);
              setConfirmingFuture(null);
              setConfirmingDraft(null);
            }}
            lbpRate={lbpRate}
            calculateActualValue={calculateActualValue}
            lbpChangeInput={confirmLbpInput}
            setLbpChangeInput={setConfirmLbpInput}
            lbpExpanded={confirmLbpExpanded}
            setLbpExpanded={setConfirmLbpExpanded}
          />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   RECURRING SECTION (compact rows)
   ═══════════════════════════════════════════════════ */
function RecurringSection({
  payments,
  tc,
  currentUserId,
  members,
  getDueDateInfo,
  onConfirm,
  onEdit,
  onDelete,
  onToggle,
  isAutoSection,
}: {
  payments: RecurringPayment[];
  tc: ReturnType<typeof useThemeClasses>;
  currentUserId: string | null;
  members: any[];
  getDueDateInfo: (p: RecurringPayment) => {
    isDue: boolean;
    isDueToday: boolean;
    isOverdue: boolean;
    formatted: string;
  };
  onConfirm: (p: RecurringPayment) => void;
  onEdit: (p: RecurringPayment) => void;
  onDelete: (id: string) => void;
  onToggle?: (p: RecurringPayment) => void;
  isAutoSection?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {/* Column header */}
      <div className="flex items-center gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-white/30">
        <span className="w-8 text-center">Day</span>
        <span className="flex-1">Name</span>
        <span className="w-16 text-right">Amount</span>
        <span className="w-8" />
      </div>
      {payments.map((payment) => {
        const dueDateInfo = getDueDateInfo(payment);
        const day =
          payment.recurrence_day ?? new Date(payment.next_due_date).getDate();
        const isManual = (payment.payment_method ?? "manual") === "manual";
        const isOwner = !currentUserId || payment.user_id === currentUserId;
        // Auto subscriptions: toggle on/off (no overdue styling)
        // Auto bills: confirm as transaction (show overdue + confirm)
        const catSlug = payment.category?.slug?.toLowerCase() ?? "";
        const catName = payment.category?.name?.toLowerCase() ?? "";
        const isSubscriptionCategory =
          catSlug === "subscription" || catName === "subscription";
        const isAutoSubscription = isAutoSection && isSubscriptionCategory;
        const isAutoBills = isAutoSection && !isAutoSubscription;

        return (
          <div
            key={payment.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all border",
              isAutoSubscription
                ? "border-transparent hover:bg-white/5"
                : dueDateInfo.isOverdue
                  ? "border-red-500/40 bg-red-500/5"
                  : dueDateInfo.isDueToday
                    ? cn(tc.bgActive, tc.borderActive, "neo-glow")
                    : "border-transparent hover:bg-white/5",
            )}
          >
            {/* Day */}
            <span
              className={cn(
                "w-8 text-center text-sm font-bold tabular-nums",
                isAutoSubscription
                  ? "text-white/60"
                  : dueDateInfo.isOverdue
                    ? "text-red-400"
                    : dueDateInfo.isDueToday
                      ? tc.textHighlight
                      : "text-white/60",
              )}
            >
              {day}
            </span>

            {/* Name + category */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() =>
                isManual
                  ? onConfirm(payment)
                  : isAutoBills
                    ? onConfirm(payment)
                    : isOwner
                      ? onEdit(payment)
                      : undefined
              }
            >
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-white truncate">
                  {payment.name}
                </p>
                {payment.is_private && isOwner && (
                  <Lock className="w-3 h-3 text-white/30 flex-shrink-0" />
                )}
              </div>
              {!isOwner && (
                <p className="text-[10px] text-purple-400/70 truncate">
                  {getMemberDisplayName(members, payment.user_id)}
                </p>
              )}
              {payment.category && (
                <p className="text-[10px] text-white/30 truncate">
                  {payment.category.name}
                </p>
              )}
            </div>

            {/* Amount */}
            <span
              className={cn(
                "w-16 text-right text-sm font-semibold tabular-nums",
                isAutoSubscription
                  ? tc.textHighlight
                  : dueDateInfo.isOverdue
                    ? "text-red-400"
                    : tc.textHighlight,
              )}
            >
              ${payment.amount.toFixed(0)}
            </span>

            {/* Actions */}
            <div className="w-8 flex justify-center">
              {isManual ? (
                <button
                  onClick={() => onConfirm(payment)}
                  className={cn(
                    "p-1.5 rounded-md active:scale-95 transition-all",
                    dueDateInfo.isOverdue
                      ? "bg-red-500/20"
                      : dueDateInfo.isDueToday
                        ? tc.bgActive
                        : tc.bgSurface,
                  )}
                >
                  <CheckIcon
                    className={cn(
                      "w-3.5 h-3.5",
                      dueDateInfo.isOverdue
                        ? "text-red-400"
                        : dueDateInfo.isDueToday
                          ? tc.textHighlight
                          : tc.text,
                    )}
                  />
                </button>
              ) : isAutoSubscription ? (
                <button
                  onClick={() => onToggle?.(payment)}
                  className={cn(
                    "p-1.5 rounded-md active:scale-95 transition-all",
                    tc.bgSurface,
                  )}
                >
                  <Power className={cn("w-3.5 h-3.5 text-blue-400/60")} />
                </button>
              ) : isAutoBills ? (
                <button
                  onClick={() => onConfirm(payment)}
                  className={cn(
                    "p-1.5 rounded-md active:scale-95 transition-all",
                    dueDateInfo.isOverdue
                      ? "bg-red-500/20"
                      : dueDateInfo.isDueToday
                        ? tc.bgActive
                        : tc.bgSurface,
                  )}
                >
                  <CheckIcon
                    className={cn(
                      "w-3.5 h-3.5",
                      dueDateInfo.isOverdue
                        ? "text-red-400"
                        : dueDateInfo.isDueToday
                          ? tc.textHighlight
                          : tc.text,
                    )}
                  />
                </button>
              ) : isOwner ? (
                <button
                  onClick={() => onEdit(payment)}
                  className={cn(
                    "p-1.5 rounded-md active:scale-95 transition-all",
                    tc.bgSurface,
                  )}
                >
                  <Edit2 className={cn("w-3.5 h-3.5", tc.text)} />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   FUTURE PAYMENTS SECTION (compact rows)
   ═══════════════════════════════════════════════════ */
function FutureSection({
  payments,
  tc,
  currentUserId,
  members,
  onConfirm,
  onDelete,
  isDue,
}: {
  payments: FuturePayment[];
  tc: ReturnType<typeof useThemeClasses>;
  currentUserId: string | null;
  members: any[];
  onConfirm: (p: FuturePayment) => void;
  onDelete: (id: string) => void;
  isDue: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {payments.map((payment) => {
        const scheduledDate = new Date(payment.scheduled_date);
        const isOwner = !currentUserId || payment.user_id === currentUserId;
        const overdue = isPast(scheduledDate) && !isToday(scheduledDate);

        const getTimeLabel = () => {
          if (isToday(scheduledDate)) return "Today";
          if (isTomorrow(scheduledDate)) return "Tomorrow";
          if (overdue) return `${formatDistanceToNow(scheduledDate)} overdue`;
          return `in ${formatDistanceToNow(scheduledDate)}`;
        };

        return (
          <div
            key={payment.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all border",
              isDue
                ? overdue
                  ? "border-red-500/40 bg-red-500/5"
                  : cn(tc.bgActive, tc.borderActive, "neo-glow")
                : "border-transparent hover:bg-white/5",
            )}
          >
            {/* Date */}
            <span
              className={cn(
                "w-14 text-center text-[11px] font-bold",
                overdue
                  ? "text-red-400"
                  : isDue
                    ? tc.textHighlight
                    : "text-white/50",
              )}
            >
              {format(scheduledDate, "MMM d")}
            </span>

            {/* Description */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => onConfirm(payment)}
            >
              <p className="text-sm font-medium text-white truncate">
                {payment.description || "Scheduled payment"}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-white/30">
                {!isOwner && (
                  <span className="text-purple-400/70">
                    {getMemberDisplayName(members, payment.user_id)}
                  </span>
                )}
                {payment.category && <span>{payment.category.name}</span>}
                {payment.accounts && <span>{payment.accounts.name}</span>}
              </div>
            </div>

            {/* Time label */}
            <span
              className={cn(
                "text-[10px] font-semibold shrink-0",
                overdue
                  ? "text-red-400"
                  : isDue
                    ? tc.textHighlight
                    : "text-blue-400",
              )}
            >
              {getTimeLabel()}
            </span>

            {/* Amount */}
            <span
              className={cn(
                "w-16 text-right text-sm font-semibold tabular-nums",
                overdue ? "text-red-400" : tc.textHighlight,
              )}
            >
              ${payment.amount.toFixed(0)}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onConfirm(payment)}
                className={cn(
                  "p-1.5 rounded-md active:scale-95 transition-all",
                  overdue
                    ? "bg-red-500/20"
                    : isDue
                      ? tc.bgActive
                      : tc.bgSurface,
                )}
              >
                <CheckIcon
                  className={cn(
                    "w-3.5 h-3.5",
                    overdue
                      ? "text-red-400"
                      : isDue
                        ? tc.textHighlight
                        : tc.text,
                  )}
                />
              </button>
              {isOwner && (
                <button
                  onClick={() => onDelete(payment.id)}
                  className="p-1.5 rounded-md bg-[#ef4444]/10 hover:bg-[#ef4444]/20 active:scale-95 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#ef4444]" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DRAFT ROW (compact)
   ═══════════════════════════════════════════════════ */
function DraftRow({
  draft,
  tc,
  onConfirm,
  onDelete,
}: {
  draft: DraftItem;
  tc: ReturnType<typeof useThemeClasses>;
  onConfirm: (d: DraftItem) => void;
  onDelete: (id: string) => void;
}) {
  const draftDate = new Date(draft.date);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all border border-transparent hover:bg-white/5">
      <span className="w-14 text-center text-[11px] font-bold text-white/50">
        {format(draftDate, "MMM d")}
      </span>
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onConfirm(draft)}
      >
        <p className="text-sm font-medium text-white truncate">
          {draft.description || "Draft payment"}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-white/30">
          {draft.category && <span>{draft.category.name}</span>}
          {draft.accounts && <span>{draft.accounts.name}</span>}
        </div>
      </div>
      <span
        className={cn(
          "w-16 text-right text-sm font-semibold tabular-nums",
          tc.textHighlight,
        )}
      >
        ${draft.amount.toFixed(0)}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onConfirm(draft)}
          className={cn(
            "p-1.5 rounded-md active:scale-95 transition-all",
            tc.bgSurface,
          )}
        >
          <CheckIcon className={cn("w-3.5 h-3.5", tc.text)} />
        </button>
        <button
          onClick={() => onDelete(draft.id)}
          className="p-1.5 rounded-md bg-[#ef4444]/10 hover:bg-[#ef4444]/20 active:scale-95 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5 text-[#ef4444]" />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CONFIRM DRAWER — Log as Transaction (shared)
   ═══════════════════════════════════════════════════ */
function ConfirmDrawer({
  title,
  tc,
  formData,
  setFormData,
  accounts,
  categories,
  subcategories,
  isPending,
  onConfirm,
  onClose,
  lbpRate,
  calculateActualValue,
  lbpChangeInput,
  setLbpChangeInput,
  lbpExpanded,
  setLbpExpanded,
}: {
  title: string;
  tc: ReturnType<typeof useThemeClasses>;
  formData: {
    amount: string;
    description: string;
    date: string;
    account_id: string;
    category_id: string;
    subcategory_id: string;
  };
  setFormData: React.Dispatch<
    React.SetStateAction<{
      amount: string;
      description: string;
      date: string;
      account_id: string;
      category_id: string;
      subcategory_id: string;
    }>
  >;
  accounts: any[];
  categories: any[];
  subcategories: any[];
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
  lbpRate: number | null;
  calculateActualValue: (
    amountPaid: number,
    lbpChangeReceived: number | null,
  ) => number | null;
  lbpChangeInput: string;
  setLbpChangeInput: (v: string) => void;
  lbpExpanded: boolean;
  setLbpExpanded: (v: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end">
      <div
        className={`w-full ${tc.bgSurface} rounded-t-3xl h-[85vh] flex flex-col`}
      >
        <div
          className={`flex items-center justify-between p-6 pb-4 border-b ${tc.border} flex-shrink-0`}
        >
          <div>
            <h2 className={`text-xl font-bold ${tc.text}`}>Log Transaction</h2>
            <p className={`text-sm ${tc.textMuted}`}>{title}</p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${tc.bgSurface} ${tc.bgHover}`}
          >
            <XIcon className={`w-5 h-5 ${tc.text}`} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 pt-4">
          <div className="space-y-4 pb-32">
            <div>
              <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                Amount
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
                className={`${tc.inputBg} text-white`}
              />
            </div>

            {/* LBP Change */}
            {lbpRate && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label className={`text-sm ${tc.textMuted}`}>
                    LBP Change
                  </Label>
                  {!lbpExpanded && (
                    <button
                      type="button"
                      onClick={() => setLbpExpanded(true)}
                      className={cn(
                        "h-6 px-2 rounded-full text-[10px] font-bold border transition-all active:scale-95",
                        lbpChangeInput && parseFloat(lbpChangeInput) > 0
                          ? `${tc.bgActive} ${tc.borderActive} ${tc.text}`
                          : `${tc.bgSurface} ${tc.border} ${tc.textMuted}`,
                      )}
                    >
                      LBP
                    </button>
                  )}
                </div>
                {lbpExpanded && (
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex-1 flex items-center gap-1 h-10 px-3 rounded-md border",
                        tc.inputBg,
                        tc.border,
                      )}
                    >
                      <span className={`text-xs ${tc.textFaint} shrink-0`}>
                        LBP
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="000"
                        value={lbpChangeInput}
                        onChange={(e) => setLbpChangeInput(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-right text-sm text-white placeholder:opacity-30"
                      />
                      {lbpChangeInput && (
                        <span className={`text-xs ${tc.textFaint} shrink-0`}>
                          ,000
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLbpExpanded(false);
                        setLbpChangeInput("");
                      }}
                      className={`p-2 rounded-md ${tc.bgSurface} ${tc.bgHover}`}
                    >
                      <XIcon className={`w-4 h-4 ${tc.textMuted}`} />
                    </button>
                  </div>
                )}
                {lbpExpanded &&
                  formData.amount &&
                  parseFloat(formData.amount) > 0 &&
                  lbpChangeInput &&
                  parseFloat(lbpChangeInput) > 0 && (
                    <p className={`text-xs mt-1 ${tc.textFaint}`}>
                      ≈{" "}
                      <span className={`font-semibold ${tc.text}`}>
                        $
                        {calculateActualValue(
                          parseFloat(formData.amount),
                          parseFloat(lbpChangeInput),
                        )?.toFixed(2) ?? "—"}
                      </span>
                    </p>
                  )}
              </div>
            )}

            <div>
              <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                Account
              </Label>
              <Select
                value={formData.account_id}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, account_id: v }))
                }
              >
                <SelectTrigger className={`${tc.inputBg} text-white`}>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                Category
              </Label>
              <Select
                value={formData.category_id}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    category_id: v,
                    subcategory_id: "",
                  }))
                }
              >
                <SelectTrigger className={`${tc.inputBg} text-white`}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c: any) => !c.parent_id)
                    .map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {subcategories.length > 0 && (
              <div>
                <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                  Subcategory
                </Label>
                <Select
                  value={formData.subcategory_id}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      subcategory_id: v,
                    }))
                  }
                >
                  <SelectTrigger className={`${tc.inputBg} text-white`}>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                Description
              </Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className={`${tc.inputBg} text-white`}
              />
            </div>
            <div>
              <Label className={`text-sm ${tc.textMuted} mb-2 block`}>
                Date
              </Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    date: e.target.value,
                  }))
                }
                className={`${tc.inputBg} text-white`}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={isPending}
                className="flex-1 neo-gradient text-white"
              >
                {isPending ? "Logging..." : "Log Transaction"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
