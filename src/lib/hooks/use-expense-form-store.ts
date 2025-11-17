import { create } from "zustand";

export type ExpenseFormState = {
  amount: string;
  selectedAccountId?: string;
  selectedAccountName?: string;
  selectedCategoryId?: string;
  selectedCategoryName?: string;
  selectedCategoryIcon?: string;
  selectedSubcategoryId?: string;
  selectedSubcategoryName?: string;
  date: Date;
  step: string;
  actions: {
    setAmount: (amount: string) => void;
    setAccountId: (id: string, name: string) => void;
    setCategoryId: (id: string, name: string, icon?: string) => void;
    setSubcategoryId: (id?: string, name?: string) => void;
    setDate: (date: Date) => void;
    setStep: (step: string) => void;
    reset: () => void;
  };
};

export const useExpenseFormStore = create<ExpenseFormState>((set) => ({
  amount: "",
  date: new Date(),
  step: "amount",
  actions: {
    setAmount: (amount) => set({ amount }),
    setAccountId: (selectedAccountId, selectedAccountName) =>
      set({ selectedAccountId, selectedAccountName }),
    setCategoryId: (
      selectedCategoryId,
      selectedCategoryName,
      selectedCategoryIcon
    ) =>
      set({ selectedCategoryId, selectedCategoryName, selectedCategoryIcon }),
    setSubcategoryId: (selectedSubcategoryId, selectedSubcategoryName) =>
      set({ selectedSubcategoryId, selectedSubcategoryName }),
    setDate: (date) => set({ date }),
    setStep: (step) => set({ step }),
    reset: () =>
      set({
        amount: "",
        selectedCategoryId: undefined,
        selectedCategoryName: undefined,
        selectedCategoryIcon: undefined,
        selectedSubcategoryId: undefined,
        selectedSubcategoryName: undefined,
        step: "amount",
      }),
  },
}));
