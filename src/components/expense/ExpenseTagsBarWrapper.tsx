"use client";

import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/useCategoriesQuery";
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

  return (
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
  );
}
