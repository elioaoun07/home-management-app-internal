import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: mock.getUser },
    rpc: mock.rpc,
  })),
}));

function request(query = "") {
  return new NextRequest(`http://localhost/api/activity-log${query}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  mock.getUser.mockResolvedValue({ data: { user: { id: "viewer" } } });
  mock.rpc.mockResolvedValue({
    data: { events: [], viewer_id: "viewer", next_cursor: null, sources: [] },
    error: null,
  });
});

describe("activity API boundary", () => {
  it("requires authentication before validating filters or calling the database", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET(request("?limit=invalid"));
    expect(response.status).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it.each([
    "?module=unknown",
    "?actor=someone",
    "?before=garbage",
    "?before=-1",
    "?before=9223372036854775808",
    "?limit=0",
    "?limit=101",
    "?from=2026-09-26",
    "?from=2026-09-27T00:00:00Z&until=2026-09-26T00:00:00Z",
  ])("rejects malformed filters without querying: %s", async (query) => {
    expect((await GET(request(query))).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("preserves a bigint cursor and explicit timezone offsets without accepting a caller-supplied viewer", async () => {
    const response = await GET(
      request(
        "?module=budget&feature=transactions&actor=partner&before=9007199254740993&from=2026-09-26T00:00:00%2B03:00&limit=25&viewer_id=someone-else",
      ),
    );
    expect(response.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("get_household_activity", {
      p_module: "budget",
      p_feature: "transactions",
      p_actor: "partner",
      p_before: "9007199254740993",
      p_from: "2026-09-26T00:00:00+03:00",
      p_until: null,
      p_limit: 25,
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
  });

  it("distinguishes pending database setup from an empty log", async () => {
    mock.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "internal detail" },
    });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Activity log is not enabled yet",
      code: "ACTIVITY_SETUP_REQUIRED",
    });
  });

  it("does not leak internal database errors or report a failure as an empty log", async () => {
    mock.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "SECRET_DB_DETAIL" },
    });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("SECRET_DB_DETAIL");
    mock.rpc.mockRejectedValue(new Error("network failed"));
    expect((await GET(request())).status).toBe(500);
  });
});
