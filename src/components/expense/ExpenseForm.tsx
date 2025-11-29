"use client";

import {
  useSectionOrder,
  type SectionKey,
} from "@/features/preferences/useSectionOrder";
import TemplateQuickEntryButton, { Template } from "./TemplateQuickEntryButton";

import { CalendarIcon as CalendarDaysIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { useAddTransaction } from "@/features/transactions/useDashboardTransactions";
import { parseSpeechExpense } from "@/lib/nlp/speechExpense";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { isToday, isYesterday, yyyyMmDd } from "@/lib/utils/date";
import { format } from "date-fns";
import { useEffect, useMemo, useState, type JSX } from "react";
import { toast } from "sonner";
import AccountBalance from "./AccountBalance";
import AccountSelect from "./AccountSelect";
import AddExpenseButton from "./AddExpenseButton";
import AmountInput from "./AmountInput";
import CategoryGrid from "./CategoryGrid";
import DescriptionField from "./DescriptionField";
import SubcategoryGrid from "./SubcategoryGrid";
import VoiceEntryButton from "./VoiceEntryButton";

export default function ExpenseForm() {
  const { data: sectionOrderRaw, isLoading: sectionOrderLoading } =
    useSectionOrder();
  const sectionOrder: SectionKey[] = Array.isArray(sectionOrderRaw)
    ? sectionOrderRaw
    : ["amount", "account", "category", "subcategory"];
  const [selectedAccountId, setSelectedAccountId] = useState<string>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>();
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [pendingSentence, setPendingSentence] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(new Date());

  // Get accounts for balance display
  const { data: accounts = [] } = useAccounts();
  const selectedAccount = accounts.find((a: any) => a.id === selectedAccountId);

  // Mutation for adding transactions with optimistic updates
  const addTransactionMutation = useAddTransaction();

  const humanDate = (d: Date) => {
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    // Use a deterministic format to avoid locale-based hydration mismatches
    return format(d, "MMM d, yyyy");
  };

  // Categories for NLP matching
  const { data: categories = [] } = useCategories(selectedAccountId);

  // Helper: get parent category id for a subcategory
  const getParentForSub = (subId?: string) => {
    if (!subId) return undefined;
    // DB-flat: find item with this id and read parent_id
    for (const c of categories as any[]) {
      if (c && c.id === subId) {
        if ("parent_id" in c && c.parent_id) return c.parent_id as string;
        break;
      }
    }
    // Nested default: search subcategories
    for (const c of categories as any[]) {
      if (c?.subcategories) {
        const hit = c.subcategories.find((s: any) => s.id === subId);
        if (hit) return c.id as string;
      }
    }
    return undefined;
  };

  // When category changes, clear subcategory only if it doesn't belong to the new category
  useEffect(() => {
    if (!selectedCategoryId) {
      setSelectedSubcategoryId(undefined);
      return;
    }
    if (!selectedSubcategoryId) return;
    const parentId = getParentForSub(selectedSubcategoryId);
    if (parentId && parentId !== selectedCategoryId) {
      setSelectedSubcategoryId(undefined);
    }
  }, [selectedCategoryId, selectedSubcategoryId, categories]);

  // If we spoke while categories were still loading, re-parse when they arrive
  useEffect(() => {
    if (!pendingSentence) return;
    if (!categories || (categories as any[]).length === 0) return;
    const reparsed = parseSpeechExpense(pendingSentence, categories);
    if (reparsed.categoryId) setSelectedCategoryId(reparsed.categoryId);
    if (reparsed.subcategoryId)
      setSelectedSubcategoryId(reparsed.subcategoryId);
    if (reparsed.amount != null && !isNaN(reparsed.amount)) {
      // don’t override if user already typed an amount
      setAmount((prev) => (prev ? prev : String(reparsed.amount)));
    }
    if (reparsed.categoryId || reparsed.subcategoryId) setPendingSentence(null);
  }, [pendingSentence, categories]);

  // Check if form is valid for submission
  const isFormValid =
    selectedAccountId && selectedCategoryId && amount && parseFloat(amount) > 0;

  // Look up selected category/subcategory data for optimistic UI
  const selectedCategory = categories.find(
    (c: any) => c.id === selectedCategoryId
  );
  // Subcategory might be in flat list or nested
  const selectedSubcategory = selectedSubcategoryId
    ? categories.find((c: any) => c.id === selectedSubcategoryId) ||
      (selectedCategory as any)?.subcategories?.find(
        (s: any) => s.id === selectedSubcategoryId
      )
    : undefined;

  const handleSubmit = () => {
    if (!isFormValid) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Store values for the mutation, including display names for optimistic UI
    const txData = {
      account_id: selectedAccountId!,
      category_id: selectedCategoryId!,
      subcategory_id: selectedSubcategoryId || null,
      amount: parseFloat(amount),
      description: description || undefined,
      date: yyyyMmDd(date),
      _optimistic: {
        category_name: (selectedCategory as any)?.name ?? null,
        subcategory_name: (selectedSubcategory as any)?.name ?? null,
        account_name: selectedAccount?.name ?? null,
        category_icon: (selectedCategory as any)?.icon ?? null,
        category_color: (selectedCategory as any)?.color ?? null,
        subcategory_color: (selectedSubcategory as any)?.color ?? null,
      },
    };

    // Reset form immediately for instant UI feedback
    setSelectedAccountId(undefined);
    setSelectedCategoryId(undefined);
    setSelectedSubcategoryId(undefined);
    setAmount("");
    setDescription("");

    // Optimistic add - mutation hook handles cache updates
    addTransactionMutation.mutate(txData, {
      onSuccess: () => {
        toast.success("Expense added!", {
          icon: ToastIcons.create,
          description: `$${txData.amount.toFixed(2)} added`,
        });
      },
      onError: (error) => {
        console.error("Error creating transaction:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to add expense",
          { icon: ToastIcons.error }
        );
      },
    });
  };

  const sectionComponents: Record<SectionKey, JSX.Element> = useMemo(
    () => ({
      account: (
        <AccountSelect
          value={selectedAccountId}
          onChange={setSelectedAccountId}
          key="account"
        />
      ),
      category: (
        <CategoryGrid
          accountId={selectedAccountId}
          selectedCategoryId={selectedCategoryId}
          onCategorySelect={setSelectedCategoryId}
          key="category"
        />
      ),
      subcategory: (
        <SubcategoryGrid
          accountId={selectedAccountId}
          parentCategoryId={selectedCategoryId}
          selectedSubcategoryId={selectedSubcategoryId}
          onSubcategorySelect={setSelectedSubcategoryId}
          key="subcategory"
        />
      ),
      amount: (
        <AmountInput
          value={amount}
          onChange={setAmount}
          rightExtra={
            <VoiceEntryButton
              categories={categories}
              accountId={selectedAccountId}
              onPreviewChange={() => {}}
              onParsed={({ sentence, amount, categoryId, subcategoryId }) => {
                setDescription(`[Speech] ${sentence}`);
                if (amount != null && !isNaN(amount)) setAmount(String(amount));
                if (categoryId) setSelectedCategoryId(categoryId);
                if (subcategoryId) setSelectedSubcategoryId(subcategoryId);
                // If nothing matched, queue re-parse once categories ready
                if (!categoryId && !subcategoryId) setPendingSentence(sentence);
              }}
              onDraftCreated={() => {
                // Optionally clear form or provide feedback
                toast.success("Voice entry saved! Check drafts to confirm.");
              }}
              variant="icon"
            />
          }
          key="amount"
        />
      ),
      description: (
        <DescriptionField
          value={description}
          onChange={setDescription}
          key="description"
        />
      ),
    }),
    [
      selectedAccountId,
      selectedCategoryId,
      selectedSubcategoryId,
      amount,
      description,
      // speechPreview removed as per patch
    ]
  );

  // Handle template selection: populate all fields except amount/description
  const handleTemplateSelect = (tpl: Template) => {
    setSelectedAccountId(tpl.account_id);
    setSelectedCategoryId(tpl.category_id);
    setSelectedSubcategoryId(tpl.subcategory_id || undefined);
    setAmount(tpl.amount);
    setDescription(""); // Let user enter their own description
  };

  return (
    <div className="space-y-6">
      {/* Avoid hydration mismatch by rendering date label after mount */}
      {/** Track client mount state */}
      {/* eslint-disable react-hooks/rules-of-hooks */}
      {(() => {
        /* This IIFE is only to keep related state near usage; it runs once per render. */
        return null;
      })()}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Quick Expense
          </h1>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 gap-2",
                  // Make button compact on small screens
                  "sm:h-10"
                )}
                aria-label="Select date"
              >
                <CalendarDaysIcon className="size-4 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]" />
                {/* Show label only after mount to prevent SSR/CSR time/locale drift */}
                <DateLabel value={date} formatter={humanDate} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const y = new Date();
                      y.setDate(y.getDate() - 1);
                      setDate(y);
                    }}
                  >
                    Yesterday
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>
      {/* Account Balance Display */}
      <AccountBalance
        accountId={selectedAccountId}
        accountName={selectedAccount?.name}
      />
      {sectionOrderLoading ? (
        <div>Loading preferences...</div>
      ) : (
        sectionOrder.map((section) => (
          <section key={section}>{sectionComponents[section]}</section>
        ))
      )}
      {/* Voice button moved next to Amount input */}
      <section>
        <AddExpenseButton disabled={!isFormValid} onSubmit={handleSubmit} />
      </section>
      <TemplateQuickEntryButton
        onTemplateSelect={handleTemplateSelect}
        onCreateTemplate={() => {}}
        onEditTemplate={() => {}}
        selectedDate={yyyyMmDd(date)}
      />
    </div>
  );
}

function DateLabel({
  value,
  formatter,
}: {
  value: Date;
  formatter: (d: Date) => string;
}) {
  // Ensures consistent client rendering; date-fns format is deterministic
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // We still render on SSR, but suppressHydrationWarning just in case of env diffs
  return (
    <span className="text-sm" suppressHydrationWarning>
      {formatter(value)}
    </span>
  );
}

// Re-parse pending sentence whenever categories become available
// Placed after component to keep body above readable
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function useReparseOnCategories(
  pendingSentence: string | null,
  categories: any[],
  setters: {
    setSelectedCategoryId: (id?: string) => void;
    setSelectedSubcategoryId: (id?: string) => void;
    setAmount: (v: string) => void;
    clearPending: () => void;
  }
) {
  const {
    setSelectedCategoryId,
    setSelectedSubcategoryId,
    setAmount,
    clearPending,
  } = setters;
  // Use an effect in the main component instead; this is a placeholder to signal intent.
}
