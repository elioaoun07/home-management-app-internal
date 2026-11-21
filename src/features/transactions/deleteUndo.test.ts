import { getBalanceDelta } from "@/lib/balance-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteTransaction as buildDeleteMutation } from "./useDashboardTransactions";

// BUD-89. useMutation/useQueryClient are factories, so no renderer is needed.
// safeFetch is replaced by a small in-memory server that applies the same
// balance deltas as the real routes (getBalanceDelta is the real function).
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  invalidateAccountData: vi.fn(),
  invalidateQueries: vi.fn(async (_filter: { queryKey: readonly unknown[] }) => {}),
  cache: { transactions: [] as unknown[] },
}));
vi.mock("@/lib/safeFetch", () => ({
  safeFetch: mocks.request,
  isOfflineError: vi.fn(() => false),
}));
vi.mock("@/lib/connectivityManager", () => ({
  isReallyOnline: () => true,
  markOffline: vi.fn(),
}));
vi.mock("@/lib/offlineQueue", () => ({ addToQueue: vi.fn() }));
vi.mock("@/lib/queryInvalidation", () => ({
  invalidateAccountData: mocks.invalidateAccountData,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({
    cancelQueries: vi.fn(async () => {}),
    getQueriesData: vi.fn(({ queryKey }: { queryKey: unknown[] }) =>
      queryKey[0] === "transactions"
        ? [[["transactions", "dashboard", "s", "e"], mocks.cache.transactions]]
        : queryKey[0] === "accounts"
          ? [[["accounts"], [{ id: "wallet", type: "expense" }]]]
          : [],
    ),
    getQueryData: vi.fn(() => ({ balance: 87.5 })),
    setQueryData: vi.fn(),
    setQueriesData: vi.fn(),
    invalidateQueries: mocks.invalidateQueries,
  }),
  useMutation: (options: unknown) => options,
}));

type Row = { id: string; amount: number; account_id: string };
type Context = { accountId?: string; deletedTransaction?: Row };
type Options = {
  mutationFn: (input: string) => Promise<string>;
  onMutate: (input: string) => Promise<Context>;
  onSuccess: (data: unknown, input: string, context?: Context) => void;
};
const options = () => buildDeleteMutation() as unknown as Options;

// Wallet is an expense account holding 100, then a $12.50 expense (t1) is added.
function startServer() {
  const server = {
    balance: 87.5,
    rows: new Map<string, Row>([
      ["t1", { id: "t1", amount: 12.5, account_id: "wallet" }],
    ]),
    bin: new Map<string, Row>(),
    log: [] as string[],
  };
  mocks.cache.transactions = [...server.rows.values()];
  mocks.request.mockImplementation(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    server.log.push(`${method} ${url}`);
    const reply = (status: number, body: unknown = {}) =>
      new Response(JSON.stringify(body), { status });
    if (method === "DELETE" && url.startsWith("/api/transactions/")) {
      const row = server.rows.get(url.split("/").pop()!);
      if (!row) return reply(404);
      server.rows.delete(row.id);
      server.bin.set(row.id, row);
      server.balance += getBalanceDelta(row.amount, "expense", false, "delete");
      return reply(200);
    }
    if (method === "POST" && url === "/api/recycle-bin/restore") {
      const { module, id } = JSON.parse(String(init.body));
      const row = module === "transactions" ? server.bin.get(id) : undefined;
      if (!row) return reply(404);
      server.bin.delete(id);
      server.rows.set(id, row);
      server.balance += getBalanceDelta(row.amount, "expense", false, "create");
      return reply(200, { ok: true, id });
    }
    if (method === "POST" && url === "/api/transactions") {
      const copy = { ...JSON.parse(String(init.body)), id: "t2" } as Row;
      server.rows.set("t2", copy);
      server.balance += getBalanceDelta(copy.amount, "expense", false, "create");
      return reply(201, copy);
    }
    return reply(404);
  });
  return server;
}

async function deleteThenGetUndo(id = "t1") {
  const hook = options();
  const context = await hook.onMutate(id);
  await hook.mutationFn(id);
  hook.onSuccess(undefined, id, context);
  const toastOptions = mocks.success.mock.calls[0][1];
  expect(toastOptions.action.label).toBe("Undo");
  return toastOptions.action.onClick as () => Promise<void>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transaction delete → Undo (BUD-89)", () => {
  it("restores the original row: same id, balance back to its pre-delete value, nothing left in the bin", async () => {
    const server = startServer();
    const undo = await deleteThenGetUndo();
    // Worked example: 87.50 → delete reverses the expense → 100.
    expect(server.balance).toBe(100);
    expect(server.bin.has("t1")).toBe(true);

    await undo();

    expect([...server.rows.keys()]).toEqual(["t1"]);
    expect(server.bin.size).toBe(0);
    expect(server.balance).toBe(87.5);
    expect(server.log).toEqual([
      "DELETE /api/transactions/t1",
      "POST /api/recycle-bin/restore",
    ]);
    expect(
      mocks.request.mock.calls.some(
        ([url, init]) => url === "/api/transactions" && init?.method === "POST",
      ),
    ).toBe(false);
  });

  it("cannot double-count: restoring the same row again finds nothing and the balance holds", async () => {
    const server = startServer();
    await (await deleteThenGetUndo())();
    const again = await mocks.request("/api/recycle-bin/restore", {
      method: "POST",
      body: JSON.stringify({ module: "transactions", id: "t1" }),
    });
    expect(again.status).toBe(404);
    expect(server.balance).toBe(87.5);
    expect(server.rows.size).toBe(1);
  });

  it("refreshes balances, lists and the bin after a successful Undo", async () => {
    startServer();
    const undo = await deleteThenGetUndo();
    await undo();
    expect(mocks.invalidateAccountData).toHaveBeenCalledWith(
      expect.anything(),
      "wallet",
    );
    expect(
      mocks.invalidateQueries.mock.calls.map(([filter]) => filter.queryKey),
    ).toEqual([
      ["transactions"],
      ["transactions-today"],
      ["account-balance"],
      ["recycle-bin"],
    ]);
    expect(mocks.success).toHaveBeenLastCalledWith("Deletion undone");
  });

  it("works when the row was not in any cached list (the old Undo silently did nothing)", async () => {
    const server = startServer();
    mocks.cache.transactions = [];
    const undo = await deleteThenGetUndo();
    await undo();
    expect(server.rows.has("t1")).toBe(true);
    expect(server.balance).toBe(87.5);
  });

  it("a double tap sends one restore", async () => {
    const server = startServer();
    const undo = await deleteThenGetUndo();
    await Promise.all([undo(), undo()]);
    expect(
      server.log.filter((entry) => entry === "POST /api/recycle-bin/restore"),
    ).toHaveLength(1);
    expect(server.balance).toBe(87.5);
  });

  it("reports a failed restore without refreshing as if it worked", async () => {
    startServer();
    const undo = await deleteThenGetUndo();
    mocks.request.mockResolvedValue(new Response("{}", { status: 404 }));
    mocks.invalidateQueries.mockClear();
    mocks.invalidateAccountData.mockClear();
    await undo();
    expect(mocks.error).toHaveBeenCalledWith("Failed to undo", expect.any(Object));
    expect(mocks.success).toHaveBeenCalledTimes(1); // only "Transaction deleted"
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    expect(mocks.invalidateAccountData).not.toHaveBeenCalled();
  });
});
