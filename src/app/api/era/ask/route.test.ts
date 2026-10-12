import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  generate: vi.fn(),
  adaptive: vi.fn(),
  budget: vi.fn(),
  schedule: vi.fn(),
  rate: vi.fn(),
  record: vi.fn(),
  after: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  quotaResult: {
    data: [] as unknown[] | null,
    count: 0 as number | null,
    error: null as unknown,
  },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: mock.after,
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({
    auth: { getUser: mock.auth },
    from: mock.from,
  })),
}));
vi.mock("@/lib/ai/context", () => ({
  fetchBudgetContext: mock.budget,
  fetchScheduleContext: mock.schedule,
}));
vi.mock("@/lib/ai/eraAdaptiveContextSource", () => ({
  fetchAdaptiveContext: mock.adaptive,
}));
vi.mock("@/lib/ai/eraAskProposal", () => ({
  generateAskAIResponse: mock.generate,
}));
vi.mock("@/lib/ai/rateLimit", () => ({
  generateRequestHash: () => "hash",
  checkUserRateLimit: mock.rate,
  recordRequestHash: mock.record,
}));
const owner = "00000000-0000-4000-8000-000000000001";
const context = {
  version: 1 as const,
  coverage: { conversations: "sampled" as const },
  window: {
    from: "2026-09-10T00:00:00Z",
    until: "2026-10-10T00:00:00Z",
    messageLimit: 400,
  },
  settings: { monthStart: "mon-1" },
  choices: [],
  episodes: [
    {
      source: "previous-message",
      at: "2026-10-09T00:00:00Z",
      request: "PRIVATE PREFERENCE",
      evidence: "user_statement" as const,
      result: null,
      capabilities: [],
    },
  ],
  usage: [],
  gaps: [],
};
function request(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/era/ask", {
    method: "POST",
    body: JSON.stringify({
      message: "Same for tomorrow",
      face: "chef",
      ...body,
    }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({ data: { user: { id: owner } } });
  mock.rate.mockResolvedValue({ allowed: true });
  mock.quotaResult = { data: [], count: 0, error: null };
  mock.insert.mockResolvedValue({ error: null });
  mock.generate.mockResolvedValue({ kind: "prose", text: "Which meal?" });
  mock.adaptive.mockResolvedValue({
    context,
    history: [
      { role: "user", content: "Chicken Friday dinner" },
      { role: "assistant", content: "Planned" },
    ],
  });
  mock.from.mockImplementation(() => {
    const q = {
      select: () => q,
      eq: () => q,
      gte: () => q,
      order: () => q,
      range: () => q,
      insert: mock.insert,
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve(mock.quotaResult).then(resolve),
    };
    return q;
  });
});
describe("Ask AI adaptive wiring", () => {
  it.each([
    { data: null, count: null, error: { code: "unavailable" } },
    { data: [], count: null, error: null },
  ])("does not spend quota when usage cannot be checked: %j", async (quota) => {
    mock.quotaResult = quota;
    expect((await POST(request({ auto: true }))).status).toBe(503);
    expect(mock.generate).not.toHaveBeenCalled();
    expect(mock.adaptive).not.toHaveBeenCalled();
  });

  it("persists actual metering but never exposes it as model-controlled response data", async () => {
    mock.generate.mockImplementation(async (args) => {
      args.onUsage({
        inputTokens: 2700,
        outputTokens: 980,
        model: "actual-fallback",
        estimated: false,
      });
      return { kind: "prose", text: "Nothing changed." };
    });
    const response = await POST(request());
    await mock.after.mock.calls[0][0]();
    expect(mock.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        role: "user",
        input_tokens: 2700,
        output_tokens: 0,
        model_used: "actual-fallback",
      }),
      expect.objectContaining({
        role: "assistant",
        input_tokens: 0,
        output_tokens: 980,
        model_used: "actual-fallback",
      }),
    ]);
    expect(await response.json()).not.toHaveProperty("usage");
  });

  it("marks an unavailable provider receipt unknown instead of charging fallback prose", async () => {
    await POST(request());
    await mock.after.mock.calls[0][0]();
    expect(mock.insert.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        input_tokens: 0,
        output_tokens: 0,
        model_used: "unknown:no-response",
      }),
      expect.objectContaining({
        input_tokens: 0,
        output_tokens: 0,
        model_used: "unknown:no-response",
      }),
    ]);
  });
  it("requires authentication before context retrieval or model calls", async () => {
    mock.auth.mockResolvedValue({ data: { user: null } });
    expect((await POST(request())).status).toBe(401);
    expect(mock.adaptive).not.toHaveBeenCalled();
    expect(mock.generate).not.toHaveBeenCalled();
  });
  it.each([
    { conversationId: "invalid" },
    { historyOwnerId: "invalid" },
    {
      history: Array.from({ length: 25 }, () => ({
        role: "user",
        content: "hello",
      })),
    },
    { history: [{ role: "user", content: "x".repeat(4001) }] },
    { history: [{ role: "system", content: "instructions" }] },
  ])("rejects malformed and unbounded context: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mock.adaptive).not.toHaveBeenCalled();
  });
  it.each(["budget", "schedule", "chef", "brain"])(
    "provides private context across %s and emits only a source receipt",
    async (face) => {
      const response = await POST(request({ face, historyOwnerId: owner }));
      expect(response.status).toBe(200);
      expect(mock.adaptive).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          owner,
          message: "Same for tomorrow",
          historyOwnerId: owner,
        }),
      );
      expect(mock.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          face,
          adaptiveContext: context,
          history: [
            expect.objectContaining({ content: "Chicken Friday dinner" }),
            expect.objectContaining({ content: "Planned" }),
          ],
        }),
      );
      const result = await response.json();
      expect(result.contextReceipt.episodeSources).toEqual([
        "previous-message",
      ]);
      expect(JSON.stringify(result)).not.toContain("PRIVATE PREFERENCE");
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("Vary")).toBe("Cookie");
    },
  );
  it("blocks inference once the month's estimated spend reaches $1", async () => {
    // 2M Haiku input ($0.20, long-prompt tier $1.00) + 1M output ($2.50) — well over $1
    mock.quotaResult = {
      data: [
        { created_at: "2026-10-03T09:00:00Z", role: "user", session_id: "era-ask", input_tokens: 2_000_000, output_tokens: 0, model_used: "claude-haiku-5-5:cache=0/0" },
        { created_at: "2026-10-03T09:00:00Z", role: "assistant", session_id: "era-ask", input_tokens: 0, output_tokens: 1_000_000, model_used: "claude-haiku-5-5:cache=0/0" },
      ],
      count: 0,
      error: null,
    };
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(mock.adaptive).not.toHaveBeenCalled();
    expect(mock.generate).not.toHaveBeenCalled();
  });
  it("allows inference under the budget", async () => {
    mock.quotaResult = {
      data: [
        { created_at: "2026-10-03T09:00:00Z", role: "user", session_id: "era-ask", input_tokens: 5500, output_tokens: 0, model_used: "claude-haiku-5-5" },
        { created_at: "2026-10-03T09:00:00Z", role: "assistant", session_id: "era-ask", input_tokens: 0, output_tokens: 300, model_used: "claude-haiku-5-5" },
      ],
      count: 0,
      error: null,
    };
    expect((await POST(request())).status).toBe(200);
  });
  it("rate-limit rejection cannot start retrieval or inference", async () => {
    mock.rate.mockResolvedValue({ allowed: false, reason: "Wait" });
    expect((await POST(request())).status).toBe(429);
    expect(mock.adaptive).not.toHaveBeenCalled();
    expect(mock.generate).not.toHaveBeenCalled();
  });
});
