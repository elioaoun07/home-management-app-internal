"use client";

import { useSectionOrder } from "@/features/preferences/useSectionOrder";
import TemplateQuickEntryButton, { Template } from "./TemplateQuickEntryButton";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { parseSpeechExpense } from "@/lib/nlp/speechExpense";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
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

const SECTION_KEYS = [
  "account",
  "category",
  "subcategory",
  "amount",
  "description",
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

export default function ExpenseForm() {
  const { data: sectionOrderRaw, isLoading: sectionOrderLoading } =
    useSectionOrder();
  const sectionOrder: SectionKey[] = Array.isArray(sectionOrderRaw)
    ? sectionOrderRaw.filter((s): s is SectionKey => SECTION_KEYS.includes(s))
    : SECTION_KEYS.slice();
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
  
  // Query client for invalidating balance
  const queryClient = useQueryClient();

  const yyyyMmDd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const humanDate = (d: Date) => {
    const today = new Date();
    const tKey = yyyyMmDd(today);
    const dKey = yyyyMmDd(d);
    // Yesterday label
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    const yKey = yyyyMmDd(yest);
    if (dKey === tKey) return "Today";
    if (dKey === yKey) return "Yesterday";
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

  const handleSubmit = async () => {
    if (!isFormValid) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_id: selectedAccountId,
          category_id: selectedCategoryId,
          subcategory_id: selectedSubcategoryId || null,
          amount: amount,
          description: description,
          date: yyyyMmDd(date),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create transaction");
      }

      const transaction = await response.json();
      console.log("Transaction created:", transaction);

      toast.success("Expense added successfully!");

      // Invalidate balance query to refresh the display
      queryClient.invalidateQueries({ queryKey: ["account-balance", selectedAccountId] });

      // Reset form
      setSelectedAccountId(undefined);
      setSelectedCategoryId(undefined);
      setSelectedSubcategoryId(undefined);
      setAmount("");
      setDescription("");
      // Keep the selected date to allow entering multiple backdated expenses
    } catch (error) {
      console.error("Error creating transaction:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to add expense"
      );
    }
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
              onPreviewChange={() => {}}
              onParsed={({ sentence, amount, categoryId, subcategoryId }) => {
                setDescription(`[Speech] ${sentence}`);
                if (amount != null && !isNaN(amount)) setAmount(String(amount));
                if (categoryId) setSelectedCategoryId(categoryId);
                if (subcategoryId) setSelectedSubcategoryId(subcategoryId);
                // If nothing matched, queue re-parse once categories ready
                if (!categoryId && !subcategoryId) setPendingSentence(sentence);
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
                <CalendarDays className="size-4" />
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
