/**
 * Mobile-First Expense Entry Component
 * Optimized for thumb-zone interactions and quick entry
 */
"use client";

import {
  CalculatorIcon,
  CheckIcon,
  ChevronLeftIcon,
  XIcon,
} from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOBILE_CONTENT_BOTTOM_OFFSET } from "@/constants/layout";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import {
  useSectionOrder,
  type SectionKey,
} from "@/features/preferences/useSectionOrder";
import { cn } from "@/lib/utils";
import {
  getCategoryGlowClass,
  getCategoryIcon,
} from "@/lib/utils/getCategoryIcon";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import AccountBalance from "./AccountBalance";
import CalculatorDialog from "./CalculatorDialog";
import { useExpenseForm } from "./ExpenseFormContext";
import VoiceEntryButton from "./VoiceEntryButton";

type Step = SectionKey | "confirm";

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
  } = useExpenseForm();

  const { data: sectionOrder } = useSectionOrder(undefined, { sync: false });

  const stepFlow = useMemo<Step[]>(() => {
    if (!sectionOrder || sectionOrder.length === 0) {
      return ["amount", "account", "category", "subcategory"];
    }
    return [...sectionOrder];
  }, [sectionOrder]);

  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const { data: categories = [] } = useCategories(selectedAccountId);
  const queryClient = useQueryClient();

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
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: selectedAccountId,
          category_id: selectedCategoryId,
          subcategory_id: selectedSubcategoryId || null,
          amount: amount,
          description: description || null,
          date: format(date, "yyyy-MM-dd"),
          is_private: isPrivate,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create transaction");
      }

      const newTransaction = await response.json();

      toast.success("Expense added!", {
        description: `$${amount} for ${selectedCategory?.name}`,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              const deleteResponse = await fetch(
                `/api/transactions/${newTransaction.id}`,
                {
                  method: "DELETE",
                }
              );

              if (!deleteResponse.ok) {
                throw new Error("Failed to delete transaction");
              }

              await Promise.all([
                queryClient.invalidateQueries({
                  queryKey: ["account-balance", selectedAccountId],
                }),
                queryClient.invalidateQueries({
                  queryKey: ["transactions"],
                  refetchType: "active",
                }),
              ]);

              toast.success("Transaction deleted");
            } catch (error) {
              toast.error("Failed to undo transaction");
            }
          },
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["account-balance", selectedAccountId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["transactions"],
          refetchType: "active",
        }),
      ]);

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
    } catch (error) {
      toast.error("Failed to add expense");
    } finally {
      setIsSubmitting(false);
    }
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
          <div className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-b from-bg-card-custom to-bg-medium border-b border-[#1a2942] px-3 pb-2 shadow-2xl shadow-black/10 backdrop-blur-xl slide-in-top">
            <div className="flex items-center justify-between mb-2 pt-16">
              {step !== firstValidStep ? (
                <button
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(5);
                    goBack();
                  }}
                  suppressHydrationWarning
                  className="p-1.5 -ml-2 rounded-lg bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all duration-200 border border-[#1a2942] hover:shadow-md"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-accent drop-shadow-[0_0_6px_rgba(56,189,248,0.3)]" />
                </button>
              ) : (
                <div className="w-8" />
              )}
              <h1 className="text-sm font-semibold text-white">New Expense</h1>
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
                    ? "bg-primary/10 border border-[#1a2942] opacity-50 cursor-not-allowed"
                    : "bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all border border-[#1a2942]"
                )}
              >
                <XIcon className="w-5 h-5 text-accent drop-shadow-[0_0_6px_rgba(248,113,113,0.4)]" />
              </button>
            </div>
            <div className="h-0.5 bg-bg-card-custom rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-primary via-secondary to-teal transition-all duration-500 ease-out neo-glow-sm glow-pulse-primary"
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
              "fixed left-0 right-0 overflow-y-auto px-3 py-3 bg-bg-dark",
              selectedAccountId && step === "amount"
                ? "top-[205px]"
                : "top-[80px]"
            )}
            style={contentAreaStyles}
          >
            {step === "amount" && (
              <div key="amount-step" className="space-y-3 step-slide-in">
                <div>
                  <Label className="text-xs text-[#22d3ee] font-medium mb-1 block">
                    How much did you spend?
                  </Label>
                  <div className="mt-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[hsl(var(--text-muted-light)/0.6)]">
                      $
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      suppressHydrationWarning
                      className="text-3xl font-bold h-16 pl-10 pr-14 border-2 text-center bg-bg-card-custom border-[#22d3ee]/30 text-white placeholder:text-[hsl(var(--input-placeholder)/0.3)] focus:border-[#22d3ee] focus:ring-2 focus:ring-[#22d3ee]/20 focus:scale-[1.02] transition-all duration-200 neo-card bounce-in"
                      autoFocus
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button
                        onClick={() => setShowCalculator(true)}
                        suppressHydrationWarning
                        className="p-2 rounded-lg neo-card bg-primary/10 border border-[#1a2942] hover:bg-primary/20 active:scale-95 transition-all"
                      >
                        <CalculatorIcon className="w-5 h-5 text-[#22d3ee] drop-shadow-[0_0_8px_rgba(20,184,166,0.4)]" />
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
                        className="p-2 rounded-lg neo-card bg-secondary/10 border border-secondary/30 hover:bg-secondary/20 active:scale-95 transition-all"
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
                      className="h-9 text-sm font-semibold neo-card bg-bg-card-custom border-[#1a2942] hover:bg-primary/10 hover:border-[#1a2942] hover:scale-105 active:scale-95 transition-all category-appear"
                      onClick={() => setAmount(val.toString())}
                    >
                      <span className="text-[#22d3ee]">${val}</span>
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
                      "neo-card p-3 rounded-lg border transition-all duration-300 active:scale-95 flex items-center gap-2",
                      isPrivate
                        ? "border-secondary/60 bg-secondary/25 neo-glow"
                        : "border-[#1a2942] bg-bg-card-custom hover:border-[#1a2942]/80"
                    )}
                  >
                    <span className="text-sm font-medium text-secondary/80">
                      Private Transaction
                    </span>
                    <svg
                      className={cn(
                        "w-5 h-5 transition-all duration-500",
                        isPrivate
                          ? "text-secondary animate-pulse"
                          : "text-accent/60"
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
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
                <Label className="text-base font-semibold text-secondary">
                  Which account?
                </Label>
                <div className="space-y-2">
                  {accounts.map((account: any, index: number) => (
                    <button
                      key={account.id}
                      onClick={() => {
                        setSelectedAccountId(account.id);
                        const next = getNextStep();
                        if (next) {
                          setStep(next);
                        } else {
                          handleSubmit();
                        }
                      }}
                      style={{ animationDelay: `${index * 40}ms` }}
                      className={cn(
                        "w-full p-2.5 rounded-lg border text-left transition-all active:scale-[0.98] category-appear",
                        selectedAccountId === account.id
                          ? "neo-card border-[#06b6d4]/60 bg-primary/10 neo-glow-sm"
                          : "neo-card border-[#1a2942] bg-bg-card-custom hover:border-[#1a2942]/80 hover:bg-primary/5"
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
                  ))}
                </div>
              </div>
            )}

            {step === "category" && (
              <div key="category-step" className="space-y-3 step-slide-in">
                <Label className="text-base font-semibold text-[#22d3ee]">
                  What category?
                </Label>
                <div className="grid grid-cols-2 gap-2 pb-4">
                  {categories
                    .filter((c: any) => !c.parent_id)
                    .map((category: any, index: number) => (
                      <button
                        key={category.id}
                        onClick={() => {
                          setSelectedCategoryId(category.id);
                          const hasSubcategories =
                            categories.some(
                              (c: any) => c.parent_id === category.id
                            ) || (category as any).subcategories?.length > 0;

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
                        disabled={isSubmitting}
                        style={{ animationDelay: `${index * 30}ms` }}
                        className={cn(
                          "p-2.5 rounded-lg border text-left transition-all active:scale-95 min-h-[65px] category-appear",
                          selectedCategoryId === category.id
                            ? "neo-card border-[#06b6d4]/60 bg-primary/10 neo-glow-sm"
                            : "neo-card border-[#1a2942] bg-bg-card-custom hover:border-[#1a2942]/80 hover:bg-primary/5",
                          isSubmitting && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex flex-col items-center justify-center gap-1 h-full">
                          {(() => {
                            const IconComponent = getCategoryIcon(
                              category.name,
                              category.slug
                            );
                            return (
                              <IconComponent
                                className={cn(
                                  "w-8 h-8 text-[#22d3ee]",
                                  getCategoryGlowClass(category.color)
                                )}
                              />
                            );
                          })()}
                          <span className="font-semibold text-center text-xs text-white">
                            {category.name}
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {step === "subcategory" && (
              <div
                key="subcategory-step"
                className="space-y-4 step-slide-in pb-4"
              >
                {allSubcategories.length > 0 && (
                  <>
                    <Label className="text-base font-semibold text-[#22d3ee]">
                      More specific?
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSelectedSubcategoryId(undefined)}
                        className={cn(
                          "p-2.5 rounded-lg border text-center transition-all active:scale-95 min-h-[55px] flex items-center justify-center category-appear",
                          !selectedSubcategoryId
                            ? "neo-card border-[#22d3ee]/60 bg-[#22d3ee]/25 neo-glow shadow-lg"
                            : "neo-card border-[#1a2942] bg-bg-card-custom hover:border-[#1a2942]/80 hover:bg-primary/5"
                        )}
                      >
                        <span
                          className={cn(
                            "font-semibold text-xs",
                            !selectedSubcategoryId
                              ? "text-[#22d3ee]"
                              : "text-white"
                          )}
                        >
                          None
                        </span>
                      </button>
                      {allSubcategories.map((sub: any, index: number) => (
                        <button
                          key={sub.id}
                          onClick={() => setSelectedSubcategoryId(sub.id)}
                          style={{ animationDelay: `${(index + 1) * 30}ms` }}
                          className={cn(
                            "p-2.5 rounded-lg border text-center transition-all active:scale-95 min-h-[55px] flex items-center justify-center category-appear",
                            selectedSubcategoryId === sub.id
                              ? "neo-card border-[#22d3ee]/60 bg-[#22d3ee]/25 neo-glow shadow-lg"
                              : "neo-card border-[#1a2942] bg-bg-card-custom hover:border-[#1a2942]/80 hover:bg-primary/5"
                          )}
                        >
                          <span
                            className={cn(
                              "font-semibold text-xs",
                              selectedSubcategoryId === sub.id
                                ? "text-[#22d3ee]"
                                : "text-white"
                            )}
                          >
                            {sub.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="space-y-2 pt-2">
                  <Label className="text-sm font-medium text-secondary/80">
                    Add a note (optional)
                  </Label>
                  <Input
                    type="text"
                    placeholder="e.g., Lunch with team"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-bg-card-custom border-[#1a2942] text-white placeholder:text-primary/30 focus:border-secondary focus:ring-2 focus:ring-secondary/20 h-11"
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
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Adding..."
                    : getNextStep()
                      ? "Next"
                      : "Add Expense"}
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
        </>
      )}
    </div>
  );
}
