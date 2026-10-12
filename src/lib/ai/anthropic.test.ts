// Retry policy of generateClaudeJson: free HTTP rejections retry once; a
// timeout (possibly billed) never retries. The SDK call is mocked — no network.
import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic extends actual.default {
    constructor(opts: ConstructorParameters<typeof actual.default>[0]) {
      super({ ...opts, apiKey: "test-key" });
      this.beta.messages.create = create as never;
    }
  }
  return { ...actual, default: FakeAnthropic };
});

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { generateClaudeJson, mayHaveBeenBilled } = await import("./anthropic");

const ok = {
  content: [{ type: "text", text: "{}" }],
  model: "claude-haiku-5-5",
  stop_reason: "end_turn",
  usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0 },
};
const call = () =>
  generateClaudeJson({
    system: { stable: "rules", dynamic: "today" },
    messages: [{ role: "user", content: "hi" }],
    schema: { type: "object" },
  });

describe("generateClaudeJson", () => {
  afterEach(() => {
    create.mockReset();
    vi.unstubAllEnvs();
  });

  it("caches the stable system block and reports the cache split", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    create.mockResolvedValue(ok);
    const res = await call();
    expect(create.mock.calls[0][0].system).toEqual([
      { type: "text", text: "rules", cache_control: { type: "ephemeral" } },
      { type: "text", text: "today" },
    ]);
    expect(res.usage).toEqual({ inputTokens: 5100, outputTokens: 10, cacheReadTokens: 5000, cacheWriteTokens: 0 });
  });

  it("retries a 429 once", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    create
      .mockRejectedValueOnce(new Anthropic.RateLimitError(429, undefined, "slow down", new Headers()))
      .mockResolvedValueOnce(ok);
    await call();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("never retries a timeout, which may already be billed", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const timeout = new Anthropic.APIConnectionTimeoutError();
    create.mockRejectedValue(timeout);
    await expect(call()).rejects.toBe(timeout);
    expect(create).toHaveBeenCalledTimes(1);
    expect(mayHaveBeenBilled(timeout)).toBe(true);
  });
});
