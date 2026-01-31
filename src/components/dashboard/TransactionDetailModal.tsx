"use client";

import {
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "@/components/icons/FuturisticIcons";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import {
  useDeleteTransaction,
  useUpdateTransaction,
} from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { isToday, isYesterday, yyyyMmDd } from "@/lib/utils/date";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type EditField = "date" | "account" | "category" | "subcategory" | null;

type Transaction = {
  id: string;
  date: string;
  category: string | null;
  subcategory: string | null;
  amount: number;
  description: string | null;
  account_id: string;
  inserted_at: string;
  account_name?: string;
  user_theme?: string;
  user_id?: string;
  is_owner?: boolean;
};

type Props = {
  transaction: Transaction;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  currentUserId?: string;
};

export default function TransactionDetailModal({
  transaction,
  onClose,
  onSave,
  onDelete,
  currentUserId,
}: Props) {
  const themeClasses = useThemeClasses();
  const [isClosing, setIsClosing] = useState(false);
  const [editingField, setEditingField] = useState<EditField>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Helper to format date display
  const humanDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  // Animated close handler
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250); // Match the close animation duration
  }, [onClose]);

  // Check if current user owns this transaction
  const isOwner =
    transaction.is_owner ??
    (!currentUserId ||
      !transaction.user_id ||
      transaction.user_id === currentUserId);

  const deleteMutation = useDeleteTransaction();
  const updateMutation = useUpdateTransaction();

  const [formData, setFormData] = useState({
    date: transaction.date,
    amount: transaction.amount.toString(),
    description: transaction.description || "",
    account_id: transaction.account_id,
    category_id: "",
    subcategory_id: "",
  });
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>(
    transaction.account_id,
  );

  const handleSave = () => {
    // Close modal with animation, then trigger mutation
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      // Optimistic update - mutation hook handles cache updates
      updateMutation.mutate(
        {
          id: transaction.id,
          date: formData.date,
          amount: parseFloat(formData.amount),
          description: formData.description,
          account_id: formData.account_id,
          category_id: formData.category_id || null,
          subcategory_id: formData.subcategory_id || null,
        },
        {
          onSuccess: () => {
            onSave();
          },
        },
      );
    }, 200);
  };

  const handleDelete = () => {
    if (!confirm("Delete this transaction?")) return;

    // Close modal with animation, then trigger mutation
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      // Optimistic delete - mutation hook handles cache updates
      deleteMutation.mutate(transaction.id, {
        onSuccess: () => {
          onDelete();
        },
      });
    }, 200);
  };

  // Load accounts and categories
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories(selectedAccount ?? undefined);

  // Build category lists (support DB-flat and default nested shapes)
  const topCategories: Array<{
    id: string;
    name: string;
    sub: Array<{ id: string; name: string }>;
  }> = [];
  if (categories && Array.isArray(categories)) {
    const anyHasParent = (categories as any[]).some((c) =>
      Object.prototype.hasOwnProperty.call(c, "parent_id"),
    );
    if (anyHasParent) {
      // DB-flat shape: group by parent_id
      const byId: Record<string, any> = {};
      for (const c of categories as any[]) byId[c.id] = c;
      const parents = (categories as any[]).filter((c) => !c.parent_id);
      for (const p of parents) {
        const subs = (categories as any[]).filter((s) => s.parent_id === p.id);
        topCategories.push({
          id: p.id,
          name: p.name,
          sub: subs.map((s) => ({ id: s.id, name: s.name })),
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

  // When categories/account load, try to map the current transaction names to ids
  // Use effect to pre-select category/subcategory when possible
  useEffect(() => {
    if (!categories) return;
    if (transaction.category) {
      const found = (categories as any[]).find(
        (c) => c.name === transaction.category || c.id === transaction.category,
      );
      if (found) {
        setFormData((prev) => ({ ...prev, category_id: found.id }));
        if (transaction.subcategory) {
          // try nested
          const subFound = (found.subcategories || []).find(
            (s: any) =>
              s.name === transaction.subcategory ||
              s.id === transaction.subcategory,
          );
          if (subFound)
            setFormData((prev) => ({ ...prev, subcategory_id: subFound.id }));
          else {
            // try flat children
            const child = (categories as any[]).find(
              (c) =>
                c.parent_id === found.id &&
                (c.name === transaction.subcategory ||
                  c.id === transaction.subcategory),
            );
            if (child)
              setFormData((prev) => ({ ...prev, subcategory_id: child.id }));
          }
        }
      }
    }
    // map account id
    if (transaction.account_id) {
      setFormData((prev) => ({ ...prev, account_id: transaction.account_id }));
      setSelectedAccount(transaction.account_id);
    }
  }, [categories, transaction]);

  // Lock body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Use portal to render modal at document.body level, escaping any scroll containers
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{
          animation: isClosing
            ? "modalBackdropFadeOut 0.25s ease-in forwards"
            : "modalBackdropFadeIn 0.2s ease-out forwards",
        }}
      />

      {/* Modal Panel */}
      <div
        className={`relative w-full max-w-md md:max-w-lg ${themeClasses.modalBg} rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col neo-glow`}
        style={{
          maxHeight: "calc(100vh - 120px)",
          animation: isClosing
            ? "modalSlideDown 0.25s cubic-bezier(0.4, 0, 1, 1) forwards"
            : "modalSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle Indicator */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3">
          <h2 className="text-lg font-semibold text-white">
            {isOwner ? "Transaction Details" : "View Transaction"}
          </h2>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg ${themeClasses.hoverBgSubtle} transition-colors`}
          >
            <XIcon
              className={`w-5 h-5 ${themeClasses.headerText} ${themeClasses.iconGlow}`}
            />
          </button>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="px-4 pb-4 space-y-3 flex-1 overflow-y-auto overscroll-contain"
        >
          {/* Amount - Big & Central */}
          <div className="text-center py-3">
            {isOwner ? (
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
                  className="text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-emerald-400 w-44 pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            ) : (
              <p className="text-4xl font-bold text-emerald-400">
                <BlurredAmount>${transaction.amount.toFixed(2)}</BlurredAmount>
              </p>
            )}
          </div>

          {/* Compact Fields */}
          <div className="space-y-1">
            {/* Date Row - Tap to expand inline calendar */}
            <div>
              <button
                onClick={() =>
                  isOwner &&
                  setEditingField(editingField === "date" ? null : "date")
                }
                disabled={!isOwner}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 transition-colors ${isOwner ? "hover:bg-white/8 active:scale-[0.99]" : ""}`}
              >
                <span className={`text-sm ${themeClasses.textMuted}`}>
                  Date
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${themeClasses.text}`}>
                    {humanDate(formData.date)}
                  </span>
                  {isOwner && (
                    <span
                      className={`text-white/30 transition-transform ${editingField === "date" ? "rotate-90" : ""}`}
                    >
                      ›
                    </span>
                  )}
                </div>
              </button>
              {editingField === "date" && (
                <div className="mt-2 p-3 rounded-xl bg-slate-800/95 border border-white/10 animate-in fade-in slide-in-from-top-1 duration-150">
                  <Calendar
                    mode="single"
                    selected={new Date(formData.date + "T00:00:00")}
                    onSelect={(d) => {
                      if (d) {
                        setFormData({ ...formData, date: yyyyMmDd(d) });
                        setEditingField(null);
                      }
                    }}
                    className="rounded-md"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          date: yyyyMmDd(new Date()),
                        });
                        setEditingField(null);
                      }}
                    >
                      Today
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const y = new Date();
                        y.setDate(y.getDate() - 1);
                        setFormData({ ...formData, date: yyyyMmDd(y) });
                        setEditingField(null);
                      }}
                    >
                      Yesterday
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Account Row - Tap to expand */}
            <div>
              <button
                onClick={() =>
                  isOwner &&
                  setEditingField(editingField === "account" ? null : "account")
                }
                disabled={!isOwner}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 transition-colors ${isOwner ? "hover:bg-white/8 active:scale-[0.99]" : ""}`}
              >
                <span className={`text-sm ${themeClasses.textMuted}`}>
                  Account
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${themeClasses.text}`}>
                    {accounts?.find((a: any) => a.id === formData.account_id)
                      ?.name || "—"}
                  </span>
                  {isOwner && (
                    <span
                      className={`text-white/30 transition-transform ${editingField === "account" ? "rotate-90" : ""}`}
                    >
                      ›
                    </span>
                  )}
                </div>
              </button>
              {editingField === "account" && (
                <div className="mt-2 p-3 rounded-xl bg-white/5 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  {(accounts || []).map((a: any) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          account_id: a.id,
                          category_id: "",
                          subcategory_id: "",
                        }));
                        setSelectedAccount(a.id);
                        setEditingField(null);
                      }}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 text-left ${
                        formData.account_id === a.id
                          ? "bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/50"
                          : `bg-white/5 ${themeClasses.text} hover:bg-white/10`
                      }`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Category Row - Tap to expand */}
            <div>
              <button
                onClick={() =>
                  isOwner &&
                  setEditingField(
                    editingField === "category" ? null : "category",
                  )
                }
                disabled={!isOwner}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 transition-colors ${isOwner ? "hover:bg-white/8 active:scale-[0.99]" : ""}`}
              >
                <span className={`text-sm ${themeClasses.textMuted}`}>
                  Category
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${themeClasses.text}`}>
                    {topCategories.find((c) => c.id === formData.category_id)
                      ?.name ||
                      transaction.category ||
                      "—"}
                  </span>
                  {isOwner && (
                    <span
                      className={`text-white/30 transition-transform ${editingField === "category" ? "rotate-90" : ""}`}
                    >
                      ›
                    </span>
                  )}
                </div>
              </button>
              {editingField === "category" && (
                <div className="mt-2 p-3 rounded-xl bg-white/5 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  {topCategories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          category_id: c.id,
                          subcategory_id: "",
                        }));
                        setEditingField(c.sub?.length ? "subcategory" : null);
                      }}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 text-left ${
                        formData.category_id === c.id
                          ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                          : `bg-white/5 ${themeClasses.text} hover:bg-white/10`
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Subcategory Row - Only if category has subs */}
            {(() => {
              const sel = topCategories.find(
                (tc) => tc.id === formData.category_id,
              );
              if (!sel?.sub?.length) return null;
              return (
                <div>
                  <button
                    onClick={() =>
                      isOwner &&
                      setEditingField(
                        editingField === "subcategory" ? null : "subcategory",
                      )
                    }
                    disabled={!isOwner}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 transition-colors ${isOwner ? "hover:bg-white/8 active:scale-[0.99]" : ""}`}
                  >
                    <span className={`text-sm ${themeClasses.textMuted}`}>
                      Subcategory
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${themeClasses.text}`}
                      >
                        {sel.sub.find((s) => s.id === formData.subcategory_id)
                          ?.name ||
                          transaction.subcategory ||
                          "—"}
                      </span>
                      {isOwner && (
                        <span
                          className={`text-white/30 transition-transform ${editingField === "subcategory" ? "rotate-90" : ""}`}
                        >
                          ›
                        </span>
                      )}
                    </div>
                  </button>
                  {editingField === "subcategory" && (
                    <div className="mt-2 p-3 rounded-xl bg-white/5 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                      {sel.sub.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              subcategory_id: s.id,
                            }));
                            setEditingField(null);
                          }}
                          className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 text-left ${
                            formData.subcategory_id === s.id
                              ? "bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/50"
                              : `bg-white/5 ${themeClasses.text} hover:bg-white/10`
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Note Row - Inline editable */}
            {isOwner ? (
              <div className="px-4 py-3 rounded-xl bg-white/5">
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Add note..."
                  className={`w-full bg-transparent text-sm ${themeClasses.text} focus:outline-none placeholder:text-white/30`}
                />
              </div>
            ) : transaction.description ? (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5">
                <span className={`text-sm ${themeClasses.textMuted}`}>
                  Note
                </span>
                <span className={`text-sm ${themeClasses.text}`}>
                  {transaction.description}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        {isOwner ? (
          <div className="p-4 pt-2 flex gap-3 border-t border-white/5">
            <Button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              variant="outline"
              className="flex-1 h-11 shadow-[0_0_0_1px_rgba(239,68,68,0.3)_inset] text-red-400 hover:bg-red-500/10 hover:shadow-[0_0_0_1px_rgba(239,68,68,0.5)_inset]"
            >
              <Trash2Icon className="w-4 h-4 mr-2" />
              {deleteMutation.isPending ? "..." : "Delete"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex-1 h-11 neo-gradient"
            >
              <SaveIcon className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "..." : "Save"}
            </Button>
          </div>
        ) : (
          <div className="p-4 pt-2 border-t border-white/5">
            <p className={`text-center ${themeClasses.textMuted} text-xs`}>
              👀 Viewing partner's transaction
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
