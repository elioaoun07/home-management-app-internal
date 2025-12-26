"use client";

import { useAccounts } from "@/features/accounts/hooks";
import {
  createContext,
  MutableRefObject,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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
  // Edit mode state (shared so floating button can be rendered at layout level)
  isEditMode: boolean;
  setIsEditMode: (isEdit: boolean) => void;
  // Use ref for callback to avoid re-render loops
  exitEditModeRef: MutableRefObject<(() => void) | null>;
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
  const [isEditMode, setIsEditMode] = useState(false);
  const exitEditModeRef = useRef<(() => void) | null>(null);

  // Get accounts to auto-select default
  const { data: accounts = [] } = useAccounts();
  const defaultAccount = accounts.find((a: any) => a.is_default);

  // Auto-select default account when available
  useEffect(() => {
    if (defaultAccount && !selectedAccountId) {
      setSelectedAccountId(defaultAccount.id);
    }
  }, [defaultAccount, selectedAccountId]);

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
    // Keep default account selected if available
    const newDefaultAccount = accounts.find((a: any) => a.is_default);
    setSelectedAccountId(newDefaultAccount?.id);
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
        isEditMode,
        setIsEditMode,
        exitEditModeRef,
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
