import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { safeFetch } from "@/lib/safeFetch";
import { useEraBudgetSubmit } from "./useEraBudgetSubmit";
import type { ExpenseCapture } from "./capture";

const fixture = vi.hoisted(() => ({
  qc: null as unknown,
  accounts: [
    {
      id: "wallet",
      name: "Wallet",
      type: "expense",
      is_default: true,
      currency: "USD",
    },
    { id: "lira", name: "Lira", type: "expense", currency: "LBP" },
    { id: "income", name: "Income", type: "income", currency: "USD" },
  ],
  categories: [
    { id: "food", name: "Food", parent_id: null },
    { id: "coffee", name: "Coffee", parent_id: "food" },
  ],
}));
vi.mock("@/features/accounts/hooks", () => ({
  useMyAccounts: () => ({ data: fixture.accounts }),
}));
vi.mock("@/features/categories/useCategoriesQuery", () => ({
  useCategories: () => ({ data: fixture.categories }),
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => fixture.qc,
}));
vi.mock("@/lib/safeFetch", async (original) => ({
  ...(await original<typeof import("@/lib/safeFetch")>()),
  safeFetch: vi.fn(),
}));
let hook: ReturnType<typeof useEraBudgetSubmit>;
let qc: QueryClient;
function Capture() {
  hook = useEraBudgetSubmit();
  return null;
}
const capture: ExpenseCapture = {
  kind: "expense",
  accountId: "wallet",
  amount: 12.5,
  categoryId: "food",
  subcategoryId: "coffee",
  description: "Morning coffee",
  date: "2026-10-12",
};
beforeEach(() => {
  qc = new QueryClient();
  fixture.qc = qc;
  vi.mocked(safeFetch).mockReset();
  vi.mocked(safeFetch).mockImplementation(async (url) =>
    Response.json(
      String(url).startsWith("/api/categories?")
        ? fixture.categories
        : { draft: { id: "draft" } },
    ),
  );
  renderToString(createElement(Capture));
});
describe("native expense helper keeps the source draft path", () => {
  it("honors every edited value instead of reparsing the original text", async () => {
    const result = await hook.submit("I paid for event 5$", capture);
    expect(result).toMatchObject({
      ok: true,
      accountId: "wallet",
      parsed: {
        amount: 12.5,
        categoryName: "Food",
        subcategoryName: "Coffee",
        date: "2026-10-12",
      },
    });
    expect(safeFetch).toHaveBeenLastCalledWith(
      "/api/drafts",
      expect.objectContaining({ method: "POST", body: expect.any(String) }),
    );
    const writes = vi
      .mocked(safeFetch)
      .mock.calls.filter(([, init]) => init?.method === "POST");
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0][1]?.body))).toMatchObject({
      account_id: "wallet",
      amount: 12.5,
      category_id: "food",
      subcategory_id: "coffee",
      description: "Morning coffee",
      date: "2026-10-12",
    });
    // No transaction confirm or balance endpoint is dispatched by this capture.
    expect(writes[0][0]).toBe("/api/drafts");
  });
  it("retains LBP native units without currency conversion", async () => {
    expect(
      await hook.submit("I paid 500k lbp for food", {
        ...capture,
        accountId: "lira",
        amount: 500000,
      }),
    ).toMatchObject({ ok: true, currency: "LBP", parsed: { amount: 500000 } });
  });
  it.each(["partner-wallet", "income"])(
    "refuses the unavailable expense account %s",
    async (accountId) => {
      expect(
        await hook.submit("I paid", { ...capture, accountId }),
      ).toMatchObject({ ok: false });
      expect(safeFetch).not.toHaveBeenCalled();
    },
  );
  it("refuses a stale category and a subcategory belonging elsewhere", async () => {
    expect(
      await hook.submit("I paid", { ...capture, categoryId: "deleted" }),
    ).toMatchObject({ ok: false });
    expect(
      await hook.submit("I paid", { ...capture, subcategoryId: "foreign" }),
    ).toMatchObject({ ok: false });
    expect(
      vi.mocked(safeFetch).mock.calls.every(([, init]) => !init?.method),
    ).toBe(true);
  });
  it("preserves the existing natural-language route when no helper is active", async () => {
    expect(await hook.submit("I paid $5 for coffee")).toMatchObject({
      ok: true,
      parsed: { amount: 5 },
    });
  });
});
