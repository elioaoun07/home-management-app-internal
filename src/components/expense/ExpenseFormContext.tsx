"use client";

import { createContext, ReactNode, useContext, useState } from "react";

type Step = "amount" | "account" | "category" | "subcategory" | "confirm";

interface ExpenseFormContextType {
  step: Step;
  setStep: (step: Step) => void;
  amount: string;
  setAmount: (amount: string) => void;
  selectedAccountId: string | undefined;
  setSelectedAccountId: (id: string | undefined) => void;
  selectedCategoryId: string | undefined;
  setSelectedCategoryId: (id: string | undefined) => void;
  selectedSubcategoryId: string | undefined;
  setSelectedSubcategoryId: (id: string | undefined) => void;
  date: Date;
  setDate: (date: Date) => void;
  description: string;
  setDescription: (desc: string) => void;
  applyTemplate: (template: {
    account_id: string;
    category_id?: string;
    subcategory_id?: string | null;
    amount: string;
    description?: string | null;
  }) => void;
  resetForm: () => void;
}

const ExpenseFormContext = createContext<ExpenseFormContextType | undefined>(
  undefined
);

export function ExpenseFormProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>();
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());

  const applyTemplate = (template: {
    account_id: string;
    category_id?: string;
    subcategory_id?: string | null;
    amount: string;
    description?: string | null;
  }) => {
    setSelectedAccountId(template.account_id);
    setSelectedCategoryId(template.category_id);
    setSelectedSubcategoryId(template.subcategory_id || undefined);
    setAmount(template.amount);
    setDescription(template.description || "");
    setStep("confirm");
  };

  const resetForm = () => {
    setAmount("");
    setSelectedAccountId(undefined);
    setSelectedCategoryId(undefined);
    setSelectedSubcategoryId(undefined);
    setDescription("");
    setDate(new Date());
    setStep("amount");
  };

  return (
    <ExpenseFormContext.Provider
      value={{
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
        date,
        setDate,
        description,
        setDescription,
        applyTemplate,
        resetForm,
      }}
    >
      {children}
    </ExpenseFormContext.Provider>
  );
}

export function useExpenseForm() {
  const context = useContext(ExpenseFormContext);
  if (!context) {
    throw new Error("useExpenseForm must be used within ExpenseFormProvider");
  }
  return context;
}
