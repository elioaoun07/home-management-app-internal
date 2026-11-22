import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  getTransactions: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({ auth: { getUser: mock.getUser } }),
}));
vi.mock("@/services/transaction.service", () => ({
  SupabaseTransactionService: class {
    getTransactions = mock.getTransactions;
  },
}));

function request(query = "") {
  return new NextRequest(`http://localhost/api/transactions${query}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  mock.getUser.mockResolvedValue({ data: { user: { id: "viewer" } } });
  mock.getTransactions.mockResolvedValue([{ id: "tx" }]);
});

function expectPrivateUncacheable(response: Response) {
  const cacheControl = response.headers.get("Cache-Control");
  expect(cacheControl).toBe("private, no-store");
  expect(cacheControl).not.toMatch(/public|maxage/);
  expect(response.headers.get("Vary")).toBe("Cookie");
}

describe("GET /api/transactions cache headers", () => {
  it("marks the list response private and uncacheable by shared caches", async () => {
    const response = await GET(request("?start=2026-11-01&end=2026-11-30&limit=50"));
    expect(response.status).toBe(200);
    expect(mock.getTransactions).toHaveBeenCalledWith("viewer", {
      start: "2026-11-01",
      end: "2026-11-30",
      limit: 50,
    });
    expect(await response.json()).toEqual([{ id: "tx" }]);
    expectPrivateUncacheable(response);
  });

  it("keeps the private headers on unauthorized responses", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mock.getTransactions).not.toHaveBeenCalled();
    expectPrivateUncacheable(response);
  });

  it("keeps the private headers on server failures without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.getTransactions.mockRejectedValue(new Error("SECRET_DB_DETAIL"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("SECRET_DB_DETAIL");
    expectPrivateUncacheable(response);
  });
});
