// src/components/hub/AddTransactionFromMessageModal.tsx
"use client";

import { SaveIcon, XIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useCreateMessageAction } from "@/features/hub/messageActions";
import { useAddTransaction } from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { yyyyMmDd } from "@/lib/utils/date";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

interface Props {
  messageId: string;
  initialAmount: number;
  initialDescription: string;
  initialCategoryId: string | null;
  initialSubcategoryId: string | null;
  initialDate: string | null;
  onClose: () => void;
  onSuccess: (messageId: string) => void;
}

export default function AddTransactionFromMessageModal({
  messageId,
  initialAmount,
  initialDescription,
  initialCategoryId,
  initialSubcategoryId,
  initialDate,
  onClose,
  onSuccess,
}: Props) {
  const themeClasses = useThemeClasses();
  const [isClosing, setIsClosing] = useState(false);
  const addMutation = useAddTransaction();
  const createActionMutation = useCreateMessageAction();

  // Get accounts and default account
  const { data: accounts = [] } = useAccounts();
  const defaultAccount = accounts.find((a: any) => a.is_default);
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>(
    defaultAccount?.id
  );

  // Get categories for selected account
  const { data: categories = [] } = useCategories(selectedAccount);

  // Form state
  const [formData, setFormData] = useState({
    amount: initialAmount.toString(),
    description: initialDescription,
    date: initialDate || yyyyMmDd(new Date()),
    account_id: defaultAccount?.id || "",
    category_id: initialCategoryId || "",
    subcategory_id: initialSubcategoryId || "",
  });

  // Update account when defaultAccount loads
  useEffect(() => {
    if (defaultAccount && !formData.account_id) {
      setFormData((prev) => ({ ...prev, account_id: defaultAccount.id }));
      setSelectedAccount(defaultAccount.id);
    }
  }, [defaultAccount, formData.account_id]);

  // Animated close handler
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
  }, [onClose]);

  // Handle save
  const handleSave = () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!formData.account_id) {
      toast.error("Please select an account");
      return;
    }

    // Close modal with animation, then create transaction
    setIsClosing(true);
    setTimeout(() => {
      addMutation.mutate(
        {
          amount: parseFloat(formData.amount),
          description: formData.description,
          date: formData.date,
          account_id: formData.account_id,
          category_id: formData.category_id || null,
          subcategory_id: formData.subcategory_id || null,
        },
        {
          onSuccess: async (transaction) => {
            // Create message action linking to transaction (await it)
            try {
              await createActionMutation.mutateAsync({
                messageId,
                actionType: "transaction",
                transactionId: transaction.id,
              });
            } catch (err) {
              toast.error(
                "Transaction added, but action tracking failed. Check console."
              );
            }

            toast.success("Transaction added!");
            onSuccess(messageId);
            onClose();
          },
          onError: (error) => {
            toast.error("Failed to add transaction");
            onClose();
          },
        }
      );
    }, 200);
  };

  // Build category lists
  const topCategories: Array<{
    id: string;
    name: string;
    sub: Array<{ id: string; name: string }>;
  }> = [];

  if (categories && Array.isArray(categories)) {
    const anyHasParent = (categories as any[]).some((c) =>
      Object.prototype.hasOwnProperty.call(c, "parent_id")
    );
    if (anyHasParent) {
      // DB-flat shape
      const parents = (categories as any[]).filter((c: any) => !c.parent_id);
      for (const p of parents) {
        const subs = (categories as any[]).filter(
          (s: any) => s.parent_id === p.id
        );
        topCategories.push({
          id: p.id,
          name: p.name,
          sub: subs.map((s: any) => ({ id: s.id, name: s.name })),
        });
      }
    } else {
      // Default nested shape
      for (const c of categories as any[]) {
        topCategories.push({
          id: c.id,
          name: c.name,
          sub: (c.subcategories || []).map((s: any) => ({
            id: s.id,
            name: s.name,
          })),
        });
      }
    }
  }

  // Lock body scroll
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center overflow-hidden"
      onClick={handleClose}
      style={{
        animation: isClosing
          ? "modalBackdropFadeOut 0.25s ease-in forwards"
          : "modalBackdropFadeIn 0.2s ease-out forwards",
      }}
    >
      {/* Backdrop - exclude bottom nav area on mobile */}
      <div
        className="absolute inset-0 bottom-[72px] md:bottom-0 bg-black/60 backdrop-blur-sm"
        style={{
          animation: isClosing
            ? "modalBackdropFadeOut 0.25s ease-in forwards"
            : "modalBackdropFadeIn 0.2s ease-out forwards",
        }}
      />

      {/* Modal Panel */}
      <div
        className={`relative w-full max-w-md mb-[72px] md:mb-0 ${themeClasses.modalBg} rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col neo-glow`}
        style={{
          maxHeight: "calc(100vh - 120px)",
          animation: isClosing
            ? "modalSlideDown 0.25s cubic-bezier(0.4, 0, 1, 1) forwards"
            : "modalSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3">
          <h2 className="text-lg font-semibold text-white">
            Add Transaction from Message
          </h2>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg ${themeClasses.hoverBgSubtle} transition-colors`}
          >
            <XIcon className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 space-y-3 flex-1 overflow-y-auto">
          {/* Amount */}
          <div className="text-center py-3">
            <div className="relative inline-flex items-center">
              <span className="absolute left-2 text-3xl font-bold text-emerald-400/70">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-emerald-400 w-44 pl-8"
              />
            </div>
          </div>

          {/* Date */}
          <div className="px-4 py-3 rounded-xl bg-white/5">
            <p className="text-xs text-white/50 mb-1">Date</p>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="bg-transparent border-none text-white p-0 focus:ring-0"
            />
          </div>

          {/* Account */}
          <div className="px-4 py-3 rounded-xl bg-white/5">
            <p className="text-xs text-white/50 mb-2">Account</p>
            <select
              value={formData.account_id}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  account_id: e.target.value,
                  category_id: "",
                  subcategory_id: "",
                });
                setSelectedAccount(e.target.value);
              }}
              className="w-full bg-transparent border-none text-white focus:ring-0"
            >
              <option value="">Select account</option>
              {(accounts || []).map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category - Always shown */}
          <div className="px-4 py-3 rounded-xl bg-white/5">
            <p className="text-xs text-white/50 mb-2">
              Category{" "}
              {!formData.category_id && (
                <span className="text-amber-400">(Select manually)</span>
              )}
            </p>
            <select
              value={formData.category_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  category_id: e.target.value,
                  subcategory_id: "",
                })
              }
              className="w-full bg-transparent border-none text-white focus:ring-0"
            >
              <option value="">Select category</option>
              {topCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          {(() => {
            const sel = topCategories.find(
              (tc) => tc.id === formData.category_id
            );
            if (!sel?.sub?.length) return null;
            return (
              <div className="px-4 py-3 rounded-xl bg-white/5">
                <p className="text-xs text-white/50 mb-2">Subcategory</p>
                <select
                  value={formData.subcategory_id}
                  onChange={(e) =>
                    setFormData({ ...formData, subcategory_id: e.target.value })
                  }
                  className="w-full bg-transparent border-none text-white focus:ring-0"
                >
                  <option value="">Select subcategory</option>
                  {sel.sub.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })()}

          {/* Description */}
          <div className="px-4 py-3 rounded-xl bg-white/5">
            <p className="text-xs text-white/50 mb-1">Description</p>
            <Input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Add note..."
              className="bg-transparent border-none text-white p-0 focus:ring-0"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 pt-2 flex gap-3 border-t border-white/5">
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1"
            disabled={addMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={addMutation.isPending}
            className="flex-1 neo-gradient"
          >
            <SaveIcon className="w-4 h-4 mr-2" />
            {addMutation.isPending ? "Saving..." : "Add Transaction"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
