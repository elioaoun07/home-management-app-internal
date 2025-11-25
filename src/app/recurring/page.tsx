"use client";

import {
  CalendarClockIcon,
  CheckIcon,
  Edit2Icon,
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
import { useAccounts } from "@/features/accounts/hooks";
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
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function RecurringPage() {
  const themeClasses = useThemeClasses();
  const { data: recurringPayments = [], isLoading } = useRecurringPayments();
  const { data: accounts = [] } = useAccounts();
  const defaultAccount = accounts.find((a) => a.is_default) || accounts[0];
  const { data: categories = [] } = useCategories(defaultAccount?.id);

  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingPayment, setEditingPayment] = useState<RecurringPayment | null>(
    null
  );
  const [confirmingPayment, setConfirmingPayment] =
    useState<RecurringPayment | null>(null);

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
  });

  // Confirm payment form state
  const [confirmFormData, setConfirmFormData] = useState({
    amount: "",
    description: "",
    date: "",
  });

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
      });
    }
  }, [confirmingPayment]);

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
        });
        toast.success("Recurring payment updated");
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
        });
        toast.success("Recurring payment created");
      }

      // Reset form
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
      });
      setShowAddDrawer(false);
      setEditingPayment(null);
    } catch (error) {
      toast.error("Failed to save recurring payment");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this recurring payment?")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success("Recurring payment deleted");
      } catch (error) {
        toast.error("Failed to delete recurring payment");
      }
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
      });

      toast.success("Payment confirmed!", {
        description: `Next payment due: ${format(new Date(result.next_due_date), "MMM d, yyyy")}`,
      });

      setConfirmingPayment(null);
    } catch (error) {
      toast.error("Failed to confirm payment");
    }
  };

  const getDueDateInfo = (payment: RecurringPayment) => {
    const dueDate = new Date(payment.next_due_date);
    const isDue = isPast(dueDate) || isToday(dueDate);

    return {
      isDue,
      isOverdue: isPast(dueDate) && !isToday(dueDate),
      formatted: isToday(dueDate)
        ? "Due Today"
        : isDue
          ? `Overdue by ${formatDistanceToNow(dueDate)}`
          : `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`,
      date: format(dueDate, "MMM d, yyyy"),
    };
  };

  const subcategories = formData.category_id
    ? categories.filter((c: any) => c.parent_id === formData.category_id)
    : [];

  if (isLoading) {
    return (
      <div
        className={cn(
          "min-h-screen flex items-center justify-center",
          themeClasses.bgPage
        )}
      >
        <div className={themeClasses.text}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen pb-32", themeClasses.bgPage)}>
      <div className="max-w-2xl mx-auto p-4">
        {/* Sticky Header with Add Button */}
        <div
          className={cn(
            "sticky top-14 z-30 pb-4 mb-2 -mx-4 px-4 pt-4 border-b",
            themeClasses.bgPage,
            themeClasses.border
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className={cn("text-2xl font-bold", themeClasses.text)}>
                Recurring Payments
              </h1>
              <p className={cn("text-sm", themeClasses.textMuted)}>
                {recurringPayments.length} active{" "}
                {recurringPayments.length === 1 ? "payment" : "payments"}
              </p>
            </div>
            <button
              onClick={() => {
                setEditingPayment(null);
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
                });
                setShowAddDrawer(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full neo-gradient text-white neo-glow hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="text-sm font-semibold">Add</span>
            </button>
          </div>
        </div>

        {/* List */}
        {recurringPayments.length === 0 ? (
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
        ) : (
          <div className="space-y-3">
            {recurringPayments.map((payment) => {
              const dueDateInfo = getDueDateInfo(payment);
              const IconComponent = payment.category
                ? getCategoryIcon(payment.category.name, payment.category.slug)
                : CalendarClockIcon;

              return (
                <div
                  key={payment.id}
                  className={cn(
                    "neo-card p-4 transition-all",
                    dueDateInfo.isDue &&
                      cn(
                        "neo-glow",
                        themeClasses.borderActive,
                        themeClasses.bgActive
                      )
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          dueDateInfo.isDue
                            ? themeClasses.bgActive
                            : themeClasses.bgSurface
                        )}
                      >
                        <IconComponent
                          className={cn(
                            "w-5 h-5",
                            dueDateInfo.isDue
                              ? themeClasses.textHighlight
                              : themeClasses.text
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white mb-1">
                          {payment.name}
                        </h3>
                        <p
                          className={cn(
                            "text-2xl font-bold mb-2",
                            themeClasses.textHighlight
                          )}
                        >
                          ${payment.amount.toFixed(2)}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={cn(
                              "px-2 py-1 rounded-full",
                              dueDateInfo.isDue
                                ? cn(
                                    themeClasses.bgActive,
                                    themeClasses.textHighlight
                                  )
                                : cn(themeClasses.bgSurface, themeClasses.text)
                            )}
                          >
                            {dueDateInfo.formatted}
                          </span>
                          <span className={themeClasses.textMuted}>
                            {payment.recurrence_type}
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
                      {dueDateInfo.isDue && (
                        <button
                          onClick={() => setConfirmingPayment(payment)}
                          className={cn(
                            "p-2 rounded-lg active:scale-95 transition-all",
                            themeClasses.bgActive,
                            themeClasses.bgHover
                          )}
                        >
                          <CheckIcon
                            className={cn(
                              "w-4 h-4",
                              themeClasses.textHighlight
                            )}
                          />
                        </button>
                      )}
                      <button
                        onClick={() => setEditingPayment(payment)}
                        className={cn(
                          "p-2 rounded-lg active:scale-95 transition-all",
                          themeClasses.bgSurface,
                          themeClasses.bgHover
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
                      type="number"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      className={`${themeClasses.formControlBg} text-white`}
                    />
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
                        type="number"
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

        {/* Confirm Payment Dialog */}
        {confirmingPayment && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className={`${themeClasses.surfaceBg} rounded-2xl p-6 max-w-md w-full`}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-xl font-bold ${themeClasses.headerText}`}>
                  Confirm Payment
                </h2>
                <button
                  onClick={() => setConfirmingPayment(null)}
                  className={`p-2 rounded-lg ${themeClasses.bgSurface} ${themeClasses.bgHover}`}
                >
                  <XIcon className={`w-5 h-5 ${themeClasses.headerText}`} />
                </button>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-white text-lg mb-2">
                  {confirmingPayment.name}
                </h3>
                <p className={`text-sm ${themeClasses.headerTextMuted}`}>
                  This will create a transaction and schedule the next payment.
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <Label
                    className={`text-sm ${themeClasses.labelText} mb-2 block`}
                  >
                    Amount
                  </Label>
                  <Input
                    type="number"
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
              </div>

              <div className="flex gap-3">
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
                  {confirmMutation.isPending ? "Confirming..." : "Confirm"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
