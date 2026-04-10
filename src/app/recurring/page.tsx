"use client";

import {
  CalendarClockIcon,
  CheckIcon,
  Edit2Icon,
  ListIcon,
  LockIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "@/components/icons/FuturisticIcons";
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
import {
  type RecurringPayment,
  useConfirmPayment,
  useCreateRecurringPayment,
  useDeleteRecurringPayment,
  useRecurringPayments,
  useUpdateRecurringPayment,
} from "@/features/recurring/useRecurringPayments";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  getMemberDisplayName,
  useHouseholdMembers,
} from "@/hooks/useHouseholdMembers";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import { useEffect, useMemo, useState } from "react";
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

export default function RecurringPage() {
  const themeClasses = useThemeClasses();
  const { data: recurringPayments = [], isLoading } = useRecurringPayments();
  const { data: accounts = [] } = useMyAccounts();
  const defaultAccount = accounts.find((a) => a.is_default) || accounts[0];
  const { data: categories = [] } = useCategories(defaultAccount?.id);
  const { data: householdData } = useHouseholdMembers();
  const currentUserId = householdData?.currentUserId ?? null;
  const members = householdData?.members ?? [];

  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(
    null,
  );
  const [confirmingPayment, setConfirmingPayment] =
    useState<RecurringPayment | null>(null);
  const [viewMode, setViewMode] = useState<"comfort" | "compact">("comfort");

  const createMutation = useCreateRecurringPayment();
  const updateMutation = useUpdateRecurringPayment();
  const deleteMutation = useDeleteRecurringPayment();
  const confirmMutation = useConfirmPayment();

  // Form state
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

  // Confirm payment form state
  const [confirmFormData, setConfirmFormData] = useState({
    amount: "",
    description: "",
    date: "",
    account_id: "",
    category_id: "",
    subcategory_id: "",
  });

  // Sort by recurrence_day (day of month) for chronological monthly order
  const sortedPayments = useMemo(() => {
    return [...recurringPayments].sort((a, b) => {
      const dayA = a.recurrence_day ?? new Date(a.next_due_date).getDate();
      const dayB = b.recurrence_day ?? new Date(b.next_due_date).getDate();
      return dayA - dayB;
    });
  }, [recurringPayments]);

  // Monthly total
  const monthlyTotal = useMemo(() => {
    return recurringPayments.reduce((sum, p) => {
      if (p.recurrence_type === "monthly") return sum + p.amount;
      if (p.recurrence_type === "weekly") return sum + p.amount * 4.33;
      if (p.recurrence_type === "daily") return sum + p.amount * 30;
      if (p.recurrence_type === "yearly") return sum + p.amount / 12;
      return sum;
    }, 0);
  }, [recurringPayments]);

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
      setShowAddDrawer(true);
    }
  }, [editingPayment]);

  useEffect(() => {
    if (confirmingPayment) {
      setConfirmFormData({
        amount: confirmingPayment.amount.toString(),
        description: confirmingPayment.description || confirmingPayment.name,
        date: new Date().toISOString().split("T")[0],
        account_id: confirmingPayment.account_id,
        category_id: confirmingPayment.category_id || "",
        subcategory_id: confirmingPayment.subcategory_id || "",
      });
    }
  }, [confirmingPayment]);

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
      if (editingPayment) {
        await updateMutation.mutateAsync({
          id: editingPayment.id,
          name: formData.name,
          amount: parseFloat(formData.amount),
          description: formData.description || null,
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
        // Toast with undo shown by hook
      } else {
        await createMutation.mutateAsync({
          account_id: formData.account_id,
          category_id: formData.category_id || null,
          subcategory_id: formData.subcategory_id || null,
          name: formData.name,
          amount: parseFloat(formData.amount),
          description: formData.description || null,
          recurrence_type: formData.recurrence_type,
          recurrence_day: formData.recurrence_day
            ? parseInt(formData.recurrence_day)
            : null,
          next_due_date: formData.next_due_date,
          payment_method: formData.payment_method,
          is_private: formData.is_private,
        });
        // Toast with undo shown by hook
      }

      resetForm();
      setShowAddDrawer(false);
      setEditingPayment(null);
    } catch {
      // Error toast shown by hook
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      // Toast with undo shown by hook
    } catch {
      // Error toast shown by hook
    }
  };

  const handleConfirmPayment = async () => {
    if (!confirmingPayment) return;

    try {
      const result = await confirmMutation.mutateAsync({
        id: confirmingPayment.id,
        amount: parseFloat(confirmFormData.amount),
        description: confirmFormData.description,
        date: confirmFormData.date,
        account_id: confirmFormData.account_id || undefined,
        category_id: confirmFormData.category_id || null,
        subcategory_id: confirmFormData.subcategory_id || null,
      });

      const transactionId: string | undefined =
        result?.transaction?.id ?? result?.id;

      toast.success("Payment confirmed!", {
        icon: ToastIcons.success,
        description: result?.next_due_date
          ? `Next payment due: ${format(new Date(result.next_due_date), "MMM d, yyyy")}`
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

      setConfirmingPayment(null);
    } catch {
      // Error toast shown by hook
    }
  };

  const getDueDateInfo = (payment: RecurringPayment) => {
    const dueDate = new Date(payment.next_due_date);
    const isDueToday = isToday(dueDate);
    const isOverdue = isPast(dueDate) && !isDueToday;
    const isDue = isDueToday || isOverdue;
    const isUpcoming = !isDue; // future — payment is up to date

    return {
      isDue,
      isDueToday,
      isOverdue,
      isUpcoming,
      formatted: isDueToday
        ? "Due Today"
        : isOverdue
          ? `Overdue by ${formatDistanceToNow(dueDate)}`
          : `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`,
      date: format(dueDate, "MMM d, yyyy"),
    };
  };

  const subcategories = formData.category_id
    ? categories.filter((c: any) => c.parent_id === formData.category_id)
    : [];

  const confirmSubcategories = confirmFormData.category_id
    ? categories.filter((c: any) => c.parent_id === confirmFormData.category_id)
    : [];

  if (isLoading) {
    return (
      <div
        className={cn(
          "min-h-screen flex items-center justify-center",
          themeClasses.bgPage,
        )}
      >
        <div className={themeClasses.text}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen pb-32", themeClasses.bgPage)}>
      <div className="max-w-2xl mx-auto p-4">
        {/* Sticky Header */}
        <div
          className={cn(
            "sticky top-14 z-30 pb-3 mb-3 -mx-4 px-4 pt-3 border-b backdrop-blur-md",
            "bg-[hsl(var(--header-bg)/0.95)]",
            themeClasses.border,
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className={cn("text-2xl font-bold", themeClasses.text)}>
                Recurring Payments
              </h1>
              <p className={cn("text-sm", themeClasses.textMuted)}>
                {recurringPayments.length} active &middot; $
                {monthlyTotal.toFixed(0)}/mo
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <button
                onClick={() =>
                  setViewMode((v) => (v === "comfort" ? "compact" : "comfort"))
                }
                className={cn(
                  "p-2 rounded-lg active:scale-95 transition-all",
                  themeClasses.bgSurface,
                  themeClasses.bgHover,
                )}
                title={
                  viewMode === "comfort"
                    ? "Switch to compact view"
                    : "Switch to comfort view"
                }
              >
                <ListIcon
                  className={cn(
                    "w-4 h-4",
                    viewMode === "compact"
                      ? themeClasses.textHighlight
                      : themeClasses.text,
                  )}
                />
              </button>
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
            </div>
          </div>
        </div>

        {/* List */}
        {sortedPayments.length === 0 ? (
          <div className="neo-card p-8 text-center">
            <CalendarClockIcon
              className={cn("w-16 h-16 mx-auto mb-4", themeClasses.textFaint)}
            />
            <p className={cn("mb-2", themeClasses.textMuted)}>
              No recurring payments yet
            </p>
            <p className={cn("text-sm", themeClasses.textFaint)}>
              Tap the + button to add your first recurring payment
            </p>
          </div>
        ) : viewMode === "compact" ? (
          /* ── Compact List View ── */
          <div className="space-y-0.5">
            {/* Column header */}
            <div className="flex items-center gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-white/30">
              <span className="w-8 text-center">Day</span>
              <span className="flex-1">Name</span>
              <span className="w-16 text-right">Amount</span>
              <span className="w-12 text-center">Type</span>
              <span className="w-8" />
            </div>
            {sortedPayments.map((payment) => {
              const dueDateInfo = getDueDateInfo(payment);
              const day =
                payment.recurrence_day ??
                new Date(payment.next_due_date).getDate();
              const isManual =
                (payment.payment_method ?? "manual") === "manual";
              const isOwner =
                !currentUserId || payment.user_id === currentUserId;

              return (
                <div
                  key={payment.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all border",
                    dueDateInfo.isOverdue
                      ? "border-red-500/40 bg-red-500/5"
                      : dueDateInfo.isDueToday
                        ? cn(
                            themeClasses.bgActive,
                            themeClasses.borderActive,
                            "neo-glow",
                          )
                        : "border-transparent hover:bg-white/5",
                  )}
                >
                  {/* Day */}
                  <span
                    className={cn(
                      "w-8 text-center text-sm font-bold tabular-nums",
                      dueDateInfo.isOverdue
                        ? "text-red-400"
                        : dueDateInfo.isDueToday
                          ? themeClasses.textHighlight
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
                        ? setConfirmingPayment(payment)
                        : isOwner
                          ? setEditingPayment(payment)
                          : undefined
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-white truncate">
                        {payment.name}
                      </p>
                      {payment.is_private && isOwner && (
                        <LockIcon className="w-3 h-3 text-white/30 flex-shrink-0" />
                      )}
                    </div>
                    {!isOwner && (
                      <p className="text-[10px] text-purple-400/70 truncate">
                        {getMemberDisplayName(members, payment.user_id)}
                      </p>
                    )}
                    {payment.category && isOwner && (
                      <p className="text-[10px] text-white/30 truncate">
                        {payment.category.name}
                      </p>
                    )}
                  </div>

                  {/* Amount */}
                  <span
                    className={cn(
                      "w-16 text-right text-sm font-semibold tabular-nums",
                      dueDateInfo.isOverdue
                        ? "text-red-400"
                        : themeClasses.textHighlight,
                    )}
                  >
                    ${payment.amount.toFixed(0)}
                  </span>

                  {/* Method badge */}
                  <span
                    className={cn(
                      "w-12 text-center text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      isManual
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-blue-500/15 text-blue-400",
                    )}
                  >
                    {isManual ? "Cash" : "Auto"}
                  </span>

                  {/* Log transaction button */}
                  <div className="w-8 flex justify-center">
                    {isManual ? (
                      <button
                        onClick={() => setConfirmingPayment(payment)}
                        className={cn(
                          "p-1.5 rounded-md active:scale-95 transition-all",
                          dueDateInfo.isOverdue
                            ? "bg-red-500/20"
                            : dueDateInfo.isDueToday
                              ? themeClasses.bgActive
                              : themeClasses.bgSurface,
                        )}
                      >
                        <CheckIcon
                          className={cn(
                            "w-3.5 h-3.5",
                            dueDateInfo.isOverdue
                              ? "text-red-400"
                              : dueDateInfo.isDueToday
                                ? themeClasses.textHighlight
                                : themeClasses.text,
                          )}
                        />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {/* Compact total row */}
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-3 mt-2 rounded-lg border",
                themeClasses.border,
                themeClasses.bgSurface,
              )}
            >
              <span className="w-8" />
              <span className="flex-1 text-sm font-semibold text-white/60">
                Monthly Total
              </span>
              <span
                className={cn(
                  "w-16 text-right text-sm font-bold tabular-nums",
                  themeClasses.textHighlight,
                )}
              >
                ${monthlyTotal.toFixed(0)}
              </span>
              <span className="w-12" />
              <span className="w-8" />
            </div>
          </div>
        ) : (
          /* ── Comfort Card View ── */
          <div className="space-y-3">
            {sortedPayments.map((payment) => {
              const dueDateInfo = getDueDateInfo(payment);
              const IconComponent = payment.category
                ? getCategoryIcon(payment.category.name, payment.category.slug)
                : CalendarClockIcon;
              const isManual =
                (payment.payment_method ?? "manual") === "manual";
              const day =
                payment.recurrence_day ??
                new Date(payment.next_due_date).getDate();
              const isOwner =
                !currentUserId || payment.user_id === currentUserId;

              return (
                <div
                  key={payment.id}
                  className={cn(
                    "neo-card p-4 transition-all border",
                    dueDateInfo.isOverdue
                      ? "border-red-500/50 bg-red-500/5 neo-glow"
                      : dueDateInfo.isDueToday
                        ? cn(
                            "neo-glow",
                            themeClasses.borderActive,
                            themeClasses.bgActive,
                          )
                        : "border-green-500/20 bg-green-500/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          dueDateInfo.isOverdue
                            ? "bg-red-500/15"
                            : dueDateInfo.isDueToday
                              ? themeClasses.bgActive
                              : themeClasses.bgSurface,
                        )}
                      >
                        <IconComponent
                          className={cn(
                            "w-5 h-5",
                            dueDateInfo.isOverdue
                              ? "text-red-400"
                              : dueDateInfo.isDueToday
                                ? themeClasses.textHighlight
                                : themeClasses.text,
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-white">
                            {payment.name}
                          </h3>
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                              isManual
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-blue-500/15 text-blue-400",
                            )}
                          >
                            {isManual ? "Cash" : "Auto"}
                          </span>
                          {payment.is_private && isOwner && (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/40 font-medium">
                              <LockIcon className="w-2.5 h-2.5" />
                              Private
                            </span>
                          )}
                          {!isOwner && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-medium">
                              {getMemberDisplayName(members, payment.user_id)}
                            </span>
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-2xl font-bold mb-2",
                            dueDateInfo.isOverdue
                              ? "text-red-400"
                              : themeClasses.textHighlight,
                          )}
                        >
                          ${payment.amount.toFixed(2)}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={cn(
                              "px-2 py-1 rounded-full font-medium",
                              dueDateInfo.isOverdue
                                ? "bg-red-500/15 text-red-400"
                                : dueDateInfo.isDueToday
                                  ? cn(
                                      themeClasses.bgActive,
                                      themeClasses.textHighlight,
                                    )
                                  : "bg-green-500/15 text-green-400",
                            )}
                          >
                            {dueDateInfo.formatted}
                          </span>
                          <span className={themeClasses.textMuted}>
                            {day}
                            {getOrdinalSuffix(day)} of each month
                          </span>
                          {payment.category && (
                            <span className={themeClasses.textMuted}>
                              {payment.category.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      {/* Log transaction (manual payments — visible to owner and partner) */}
                      {isManual && (
                        <button
                          onClick={() => setConfirmingPayment(payment)}
                          className={cn(
                            "p-2 rounded-lg active:scale-95 transition-all",
                            dueDateInfo.isOverdue
                              ? "bg-red-500/15 hover:bg-red-500/25"
                              : dueDateInfo.isDueToday
                                ? cn(themeClasses.bgActive, themeClasses.bgHover)
                                : cn(themeClasses.bgSurface, themeClasses.bgHover),
                          )}
                        >
                          <CheckIcon
                            className={cn(
                              "w-4 h-4",
                              dueDateInfo.isOverdue
                                ? "text-red-400"
                                : dueDateInfo.isDueToday
                                  ? themeClasses.textHighlight
                                  : themeClasses.text,
                            )}
                          />
                        </button>
                      )}
                      {/* Edit/Delete — owner only */}
                      {isOwner && (
                        <>
                          <button
                            onClick={() => setEditingPayment(payment)}
                            className={cn(
                              "p-2 rounded-lg active:scale-95 transition-all",
                              themeClasses.bgSurface,
                              themeClasses.bgHover,
                            )}
                          >
                            <Edit2Icon
                              className={cn("w-4 h-4", themeClasses.text)}
                            />
                          </button>
                          <button
                            onClick={() => handleDelete(payment.id)}
                            className="p-2 rounded-lg bg-[#ef4444]/10 hover:bg-[#ef4444]/20 active:scale-95 transition-all"
                          >
                            <Trash2Icon className="w-4 h-4 text-[#ef4444]" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add/Edit Drawer */}
        {showAddDrawer && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end">
            <div
              className={`w-full ${themeClasses.surfaceBg} rounded-t-3xl h-[92vh] flex flex-col`}
            >
              {/* Fixed Header */}
              <div
                className={`flex items-center justify-between p-6 pb-4 border-b ${themeClasses.border} flex-shrink-0`}
              >
                <h2 className={`text-xl font-bold ${themeClasses.headerText}`}>
                  {editingPayment ? "Edit Payment" : "Add Recurring Payment"}
                </h2>
                <button
                  onClick={() => {
                    setShowAddDrawer(false);
                    setEditingPayment(null);
                  }}
                  className={`p-2 rounded-lg ${themeClasses.bgSurface} ${themeClasses.bgHover}`}
                >
                  <XIcon className={`w-5 h-5 ${themeClasses.headerText}`} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto flex-1 p-6 pt-4">
                <div className="space-y-4 pb-32">
                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
                      Name *
                    </Label>
                    <Input
                      placeholder="e.g., Internet Bill, Netflix"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className={`${themeClasses.formControlBg} text-white`}
                    />
                  </div>

                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
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
                      className={`${themeClasses.formControlBg} text-white`}
                    />
                  </div>

                  {/* Payment Method Toggle */}
                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
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
                            : cn(
                                "border-white/10 text-white/50",
                                themeClasses.bgSurface,
                              ),
                        )}
                      >
                        <div className="text-base mb-0.5">💵</div>
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
                            : cn(
                                "border-white/10 text-white/50",
                                themeClasses.bgSurface,
                              ),
                        )}
                      >
                        <div className="text-base mb-0.5">🏦</div>
                        <div>Auto / Online</div>
                        <div className="text-[10px] text-white/30 mt-0.5">
                          Info only (via statement)
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
                      Account *
                    </Label>
                    <Select
                      value={formData.account_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, account_id: value })
                      }
                    >
                      <SelectTrigger
                        className={`${themeClasses.formControlBg} text-white`}
                      >
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
                      Category
                    </Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          category_id: value,
                          subcategory_id: "",
                        })
                      }
                    >
                      <SelectTrigger
                        className={`${themeClasses.formControlBg} text-white`}
                      >
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter((c: any) => !c.parent_id)
                          .map((category: any) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {subcategories.length > 0 && (
                    <div>
                      <Label
                        className={`text-sm ${themeClasses.labelText} mb-2 block`}
                      >
                        Subcategory
                      </Label>
                      <Select
                        value={formData.subcategory_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, subcategory_id: value })
                        }
                      >
                        <SelectTrigger
                          className={`${themeClasses.formControlBg} text-white`}
                        >
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                          {subcategories.map((sub: any) => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
                      Repeat *
                    </Label>
                    <Select
                      value={formData.recurrence_type}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, recurrence_type: value })
                      }
                    >
                      <SelectTrigger
                        className={`${themeClasses.formControlBg} text-white`}
                      >
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
                      <Label
                        className={`text-sm ${themeClasses.labelText} mb-2 block`}
                      >
                        Day of Month
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="1-31"
                        min="1"
                        max="31"
                        value={formData.recurrence_day}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            recurrence_day: e.target.value,
                          })
                        }
                        className={`${themeClasses.formControlBg} text-white`}
                      />
                    </div>
                  )}

                  {formData.recurrence_type === "weekly" && (
                    <div>
                      <Label
                        className={`text-sm ${themeClasses.labelText} mb-2 block`}
                      >
                        Day of Week
                      </Label>
                      <Select
                        value={formData.recurrence_day}
                        onValueChange={(value) =>
                          setFormData({ ...formData, recurrence_day: value })
                        }
                      >
                        <SelectTrigger
                          className={`${themeClasses.formControlBg} text-white`}
                        >
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
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
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
                      className={`${themeClasses.formControlBg} text-white`}
                    />
                  </div>

                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
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
                      className={`${themeClasses.formControlBg} text-white`}
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
                      themeClasses.bgSurface,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <LockIcon className="w-4 h-4" />
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
                        formData.is_private
                          ? "bg-white/30"
                          : "bg-white/10",
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

        {/* Confirm Payment — Log as Transaction */}
        {confirmingPayment && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end">
            <div
              className={`w-full ${themeClasses.surfaceBg} rounded-t-3xl h-[85vh] flex flex-col`}
            >
              {/* Fixed Header */}
              <div
                className={`flex items-center justify-between p-6 pb-4 border-b ${themeClasses.border} flex-shrink-0`}
              >
                <div>
                  <h2
                    className={`text-xl font-bold ${themeClasses.headerText}`}
                  >
                    Log Transaction
                  </h2>
                  <p className={`text-sm ${themeClasses.headerTextMuted}`}>
                    {confirmingPayment.name}
                  </p>
                </div>
                <button
                  onClick={() => setConfirmingPayment(null)}
                  className={`p-2 rounded-lg ${themeClasses.bgSurface} ${themeClasses.bgHover}`}
                >
                  <XIcon className={`w-5 h-5 ${themeClasses.headerText}`} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto flex-1 p-6 pt-4">
                <div className="space-y-4 pb-32">
                  {/* Amount */}
                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
                      Amount
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={confirmFormData.amount}
                      onChange={(e) =>
                        setConfirmFormData({
                          ...confirmFormData,
                          amount: e.target.value,
                        })
                      }
                      className={`${themeClasses.formControlBg} text-white`}
                    />
                  </div>

                  {/* Account */}
                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
                      Account
                    </Label>
                    <Select
                      value={confirmFormData.account_id}
                      onValueChange={(value) =>
                        setConfirmFormData({
                          ...confirmFormData,
                          account_id: value,
                        })
                      }
                    >
                      <SelectTrigger
                        className={`${themeClasses.formControlBg} text-white`}
                      >
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category */}
                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
                      Category
                    </Label>
                    <Select
                      value={confirmFormData.category_id}
                      onValueChange={(value) =>
                        setConfirmFormData({
                          ...confirmFormData,
                          category_id: value,
                          subcategory_id: "",
                        })
                      }
                    >
                      <SelectTrigger
                        className={`${themeClasses.formControlBg} text-white`}
                      >
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter((c: any) => !c.parent_id)
                          .map((category: any) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subcategory */}
                  {confirmSubcategories.length > 0 && (
                    <div>
                      <Label
                        className={`text-sm ${themeClasses.labelText} mb-2 block`}
                      >
                        Subcategory
                      </Label>
                      <Select
                        value={confirmFormData.subcategory_id}
                        onValueChange={(value) =>
                          setConfirmFormData({
                            ...confirmFormData,
                            subcategory_id: value,
                          })
                        }
                      >
                        <SelectTrigger
                          className={`${themeClasses.formControlBg} text-white`}
                        >
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                          {confirmSubcategories.map((sub: any) => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
                      Description
                    </Label>
                    <Input
                      value={confirmFormData.description}
                      onChange={(e) =>
                        setConfirmFormData({
                          ...confirmFormData,
                          description: e.target.value,
                        })
                      }
                      className={`${themeClasses.formControlBg} text-white`}
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <Label
                      className={`text-sm ${themeClasses.labelText} mb-2 block`}
                    >
                      Date
                    </Label>
                    <Input
                      type="date"
                      value={confirmFormData.date}
                      onChange={(e) =>
                        setConfirmFormData({
                          ...confirmFormData,
                          date: e.target.value,
                        })
                      }
                      className={`${themeClasses.formControlBg} text-white`}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => setConfirmingPayment(null)}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmPayment}
                      disabled={confirmMutation.isPending}
                      className="flex-1 neo-gradient text-white"
                    >
                      {confirmMutation.isPending
                        ? "Logging..."
                        : "Log Transaction"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
