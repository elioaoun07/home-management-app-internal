import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import TransactionDetailModal from "./TransactionDetailModal";

vi.mock("react-dom", async (original) => ({
  ...await original<typeof import("react-dom")>(),
  createPortal: (children: unknown) => children,
}));
vi.mock("@/features/accounts/hooks", () => ({ useMyAccounts: () => ({ data: [] }) }));
vi.mock("@/features/categories/useCategoriesQuery", () => ({ useCategories: () => ({ data: [] }) }));
vi.mock("@/features/trips/hooks", () => ({ useTaggableTrips: () => ({ data: [] }) }));
vi.mock("@/features/transactions/useDashboardTransactions", () => ({
  useUpdateTransaction: () => ({ isPending: false }),
  useDeleteTransaction: () => ({ isPending: false }),
  useSetTransactionSplit: () => ({ isPending: false }),
}));
vi.mock("@/hooks/useThemeClasses", () => ({ useThemeClasses: () => ({ text: "text-white", textMuted: "text-white/50" }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/ui/calendar", () => ({ Calendar: () => null }));
vi.mock("@/components/ui/BlurredAmount", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

beforeEach(() => vi.stubGlobal("document", { body: {} }));

function render(overrides: Record<string, unknown>) {
  return renderToStaticMarkup(createElement(TransactionDetailModal, {
    transaction: { id: "tx", date: "2026-10-31", category: null, subcategory: null, amount: 30,
      description: "Dinner", account_id: "wallet", inserted_at: "2026-10-31T10:00:00Z", is_owner: true, ...overrides },
    onClose: () => {}, onSave: () => {}, onDelete: () => {},
  }));
}

describe("transaction details Split control", () => {
  it("shows an enabled checked control for the owner's pending split", () => {
    expect(render({ split_requested: true })).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(render({ split_requested: true })).not.toMatch(/type="checkbox"[^>]* disabled=""/);
  });
  it("lets an owner add a split to a plain transaction", () => {
    const html = render({ split_requested: false });
    expect(html).toContain(">Split</span>");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toMatch(/type="checkbox"[^>]* (checked|disabled)=""/);
  });
  it("locks completed and partner splits, and hides the control on a partner's plain transaction", () => {
    expect(render({ split_requested: true, split_completed_at: "2026-10-31T10:00:00Z" })).toMatch(/type="checkbox"[^>]* disabled=""/);
    expect(render({ split_requested: true, is_owner: false })).toMatch(/type="checkbox"[^>]* disabled=""/);
    expect(render({ split_requested: false, is_owner: false })).not.toContain('type="checkbox"');
  });
});
