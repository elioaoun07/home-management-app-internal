// src/app/qr/layout.tsx
import { ExpenseFormProvider } from "@/components/expense/ExpenseFormContext";

export default function QRLayout({ children }: { children: React.ReactNode }) {
  return <ExpenseFormProvider>{children}</ExpenseFormProvider>;
}
