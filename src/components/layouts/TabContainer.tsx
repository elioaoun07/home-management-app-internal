"use client";

import DashboardClientPage from "@/app/dashboard/DashboardClientPage";
import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import { useTab } from "@/contexts/TabContext";
import { Suspense, lazy } from "react";

// Lazy load pages to reduce bundle size
const DraftsPage = lazy(() => import("@/app/expense/drafts/page"));

export default function TabContainer() {
  const { activeTab } = useTab();

  return (
    <>
      {/* Render all tabs but only show active one - instant switching */}
      {/* Dashboard: Add top padding for fixed header */}
      <div className={activeTab === "dashboard" ? "block pt-14" : "hidden"}>
        <DashboardClientPage />
      </div>

      {/* Expense: Positioning handled internally in MobileExpenseForm */}
      <div className={activeTab === "expense" ? "block" : "hidden"}>
        <main className="h-screen overflow-hidden">
          <MobileExpenseForm />
        </main>
      </div>

      {/* Drafts: Add top padding for fixed header */}
      <div className={activeTab === "drafts" ? "block pt-14" : "hidden"}>
        <Suspense
          fallback={
            <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
              <div className="text-[#38bdf8]">Loading...</div>
            </div>
          }
        >
          <DraftsPage />
        </Suspense>
      </div>
    </>
  );
}
