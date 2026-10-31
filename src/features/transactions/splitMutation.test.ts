import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "./useDashboardTransactions";
// useMutation/useQueryClient below are factories, so this harness needs no renderer.
import { useSetTransactionSplit as buildSplitMutation } from "./useDashboardTransactions";

const mocks = vi.hoisted(() => ({
  request: vi.fn(), success: vi.fn(), error: vi.fn(),
  invalidateQueries: vi.fn(async (_filter: { queryKey: readonly unknown[] }) => {}),
  setQueriesData: vi.fn(), getQueriesData: vi.fn(() => []),
}));
vi.mock("@/lib/safeFetch", () => ({ safeFetch: mocks.request, isOfflineError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@tanstack/react-query", async (original) => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useQueryClient: () => mocks,
  useMutation: (options: unknown) => options,
}));

type Change = { id: string; split_requested: boolean; collaborator_id?: string };
type Options = {
  mutationFn: (change: Change) => Promise<Transaction>;
  onSuccess: (transaction: Transaction, change: Change) => void;
  onSettled: () => Promise<void>;
};
function options() { return buildSplitMutation() as unknown as Options; }

beforeEach(() => { vi.clearAllMocks(); });

describe("split mutation", () => {
  it("uses safeFetch and Undo restores the same collaborator without money fields", async () => {
    mocks.request.mockResolvedValue(new Response(JSON.stringify({ id: "tx", split_requested: false })));
    const hook = options();
    const change = { id: "tx", split_requested: false, collaborator_id: "partner" };
    const saved = await hook.mutationFn(change);
    hook.onSuccess(saved, change);
    const toastOptions = mocks.success.mock.calls[0][1];
    expect(toastOptions.duration).toBe(4000);
    expect(toastOptions.action.label).toBe("Undo");
    mocks.request.mockResolvedValue(new Response(JSON.stringify({ id: "tx", split_requested: true, collaborator_id: "partner" })));
    await toastOptions.action.onClick();
    expect(JSON.parse(mocks.request.mock.calls[1][1].body)).toEqual({ split_requested: true, collaborator_id: "partner" });
    expect(mocks.invalidateQueries.mock.calls.map(([filter]) => filter.queryKey)).toEqual([
      ["transactions"], ["transactions-today"], ["pending-splits"], ["notifications"],
    ]);
  });

  it("Undo of adding a split removes it, and failed writes do not update cached transactions", async () => {
    const hook = options();
    hook.onSuccess({ id: "tx", collaborator_id: "partner" } as Transaction, { id: "tx", split_requested: true });
    mocks.request.mockResolvedValue(new Response(JSON.stringify({ error: "Split cannot be changed" }), { status: 409 }));
    await mocks.success.mock.calls[0][1].action.onClick();
    expect(JSON.parse(mocks.request.mock.calls[0][1].body)).toEqual({ split_requested: false });
    expect(mocks.setQueriesData).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith("Split cannot be changed", expect.any(Object));
  });
});
