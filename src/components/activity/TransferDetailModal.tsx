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
import {
  useDeleteTransfer,
  useUpdateTransfer,
  type Transfer,
} from "@/features/transfers/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { isToday, isYesterday, yyyyMmDd } from "@/lib/utils/date";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

type EditField = "date" | "description" | null;

type Props = {
  transfer: Transfer;
  onClose: () => void;
  currentUserId?: string;
};

export default function TransferDetailModal({
  transfer,
  onClose,
  currentUserId,
}: Props) {
  const themeClasses = useThemeClasses();
  const [isClosing, setIsClosing] = useState(false);
  const [editingField, setEditingField] = useState<EditField>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isOwner = transfer.is_owner;
  const isHousehold = transfer.transfer_type === "household";

  const updateMutation = useUpdateTransfer();
  const deleteMutation = useDeleteTransfer();

  const [formData, setFormData] = useState({
    amount: transfer.amount.toString(),
    description: transfer.description || "",
    date: transfer.date,
    fee_amount: transfer.fee_amount.toString(),
    returned_amount: transfer.returned_amount.toString(),
  });

  const humanDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  const handleSave = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      updateMutation.mutate(
        {
          id: transfer.id,
          amount: parseFloat(formData.amount),
          description: formData.description || undefined,
          date: formData.date,
          fee_amount: parseFloat(formData.fee_amount) || 0,
          returned_amount: parseFloat(formData.returned_amount) || 0,
        },
        {
          onSuccess: () => {
            toast.success("Transfer updated", {
              icon: ToastIcons.update,
              duration: 4000,
              action: { label: "Undo", onClick: () => {} },
            });
          },
        },
      );
    }, 200);
  };

  const handleDelete = () => {
    if (!confirm("Delete this transfer?")) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      deleteMutation.mutate(transfer.id, {
        onSuccess: () => {
          toast.success("Transfer deleted", {
            icon: ToastIcons.delete,
            duration: 4000,
            action: { label: "Undo", onClick: () => {} },
          });
        },
      });
    }, 200);
  };

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
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3">
          <h2 className="text-lg font-semibold text-white">
            {isOwner ? "Transfer Details" : "View Transfer"}
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
          {/* Amount */}
          <div className="text-center py-3">
            {isOwner ? (
              <div className="relative inline-flex items-center">
                <span className="absolute left-2 text-3xl font-bold text-cyan-400/70">
                  $
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  className="text-center text-4xl font-bold bg-transparent border-none focus:ring-0 text-cyan-400 w-44 pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            ) : (
              <p className="text-4xl font-bold text-cyan-400">
                <BlurredAmount>${transfer.amount.toFixed(2)}</BlurredAmount>
              </p>
            )}
          </div>

          {/* Accounts (read-only) */}
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="text-center">
              <p className={`text-xs ${themeClasses.textMuted}`}>From</p>
              <p className={`text-sm font-medium ${themeClasses.text}`}>
                {transfer.from_account_name}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400/60" />
            <div className="text-center">
              <p className={`text-xs ${themeClasses.textMuted}`}>To</p>
              <p className={`text-sm font-medium ${themeClasses.text}`}>
                {transfer.to_account_name}
              </p>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-1">
            {/* Type badge */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5">
              <span className={`text-sm ${themeClasses.textMuted}`}>Type</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isHousehold
                    ? "bg-purple-500/20 text-purple-300"
                    : "bg-cyan-500/20 text-cyan-300"
                }`}
              >
                {isHousehold ? "Household" : "Self"}
              </span>
            </div>

            {/* Date Row */}
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
                </div>
              )}
            </div>

            {/* Description */}
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
            ) : transfer.description ? (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5">
                <span className={`text-sm ${themeClasses.textMuted}`}>
                  Note
                </span>
                <span className={`text-sm ${themeClasses.text}`}>
                  {transfer.description}
                </span>
              </div>
            ) : null}

            {/* Household-specific fields */}
            {isHousehold && (
              <>
                {/* Fee Amount */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5">
                  <span className={`text-sm ${themeClasses.textMuted}`}>
                    Fee
                  </span>
                  {isOwner ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.fee_amount}
                      onChange={(e) =>
                        setFormData({ ...formData, fee_amount: e.target.value })
                      }
                      className="w-24 text-right text-sm bg-transparent border-none focus:ring-0 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    <BlurredAmount blurIntensity="sm">
                      <span
                        className={`text-sm font-medium ${themeClasses.text}`}
                      >
                        ${transfer.fee_amount.toFixed(2)}
                      </span>
                    </BlurredAmount>
                  )}
                </div>

                {/* Returned Amount */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5">
                  <span className={`text-sm ${themeClasses.textMuted}`}>
                    Returned
                  </span>
                  {isOwner ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.returned_amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          returned_amount: e.target.value,
                        })
                      }
                      className="w-24 text-right text-sm bg-transparent border-none focus:ring-0 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    <BlurredAmount blurIntensity="sm">
                      <span
                        className={`text-sm font-medium ${themeClasses.text}`}
                      >
                        ${transfer.returned_amount.toFixed(2)}
                      </span>
                    </BlurredAmount>
                  )}
                </div>
              </>
            )}
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
              👀 Viewing partner&apos;s transfer
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
