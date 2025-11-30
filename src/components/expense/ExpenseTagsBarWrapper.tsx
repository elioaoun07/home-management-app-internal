"use client";

import { MOBILE_CONTENT_BOTTOM_OFFSET } from "@/constants/layout";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useExpenseForm } from "./ExpenseFormContext";
import ExpenseTagsBar from "./ExpenseTagsBar";

export default function ExpenseTagsBarWrapper() {
  const {
    step,
    setStep,
    amount,
    selectedAccountId,
    selectedCategoryId,
    selectedSubcategoryId,
    date,
    setDate,
    isEditMode,
    exitEditModeRef,
  } = useExpenseForm();

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories(selectedAccountId);

  const selectedAccount = accounts.find((a: any) => a.id === selectedAccountId);
  const selectedCategory = categories.find(
    (c: any) => c.id === selectedCategoryId
  );

  const subcategories = selectedCategoryId
    ? categories.filter((c: any) => c.parent_id === selectedCategoryId)
    : [];
  const selectedCategoryData = categories.find(
    (c: any) => c.id === selectedCategoryId
  );
  const nestedSubcategories =
    (selectedCategoryData as any)?.subcategories || [];
  const allSubcategories = [...subcategories, ...nestedSubcategories];
  const selectedSubcategory = allSubcategories.find(
    (s: any) => s.id === selectedSubcategoryId
  );

  const handleExitEditMode = () => {
    if (exitEditModeRef.current) {
      exitEditModeRef.current();
    }
  };

  return (
    <>
      <ExpenseTagsBar
        selectedAccount={selectedAccount}
        amount={amount}
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        date={date}
        onAccountClick={() => setStep("account")}
        onAmountClick={() => setStep("amount")}
        onCategoryClick={() => setStep("category")}
        onDateChange={setDate}
      />

      {/* Floating Done Button - rendered at layout level to be in front of tags bar */}
      <AnimatePresence>
        {isEditMode && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={handleExitEditMode}
            style={{
              bottom: `calc(env(safe-area-inset-bottom) + ${MOBILE_CONTENT_BOTTOM_OFFSET + 16}px)`,
            }}
            className="fixed right-4 z-[999] w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Check className="w-7 h-7" strokeWidth={3} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
