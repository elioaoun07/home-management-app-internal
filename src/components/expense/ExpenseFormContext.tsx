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
