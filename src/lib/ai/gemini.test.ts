// HUB-98 — a 5xx ("model overloaded") on the primary model used to rethrow
// at once, so Ask AI answered "I couldn't reach the AI" without ever trying
// the fallback model. Pins: 5xx → fallback; other errors → no fallback.
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

process.env.GEMINI_API_KEY = "test-key";
const { generateContentWithFallback, GeminiRateLimitError } = await import("./gemini");

const call = () =>
  generateContentWithFallback({
    contents: [{ role: "user", parts: [{ text: "hi" }] }],
    primaryModel: "primary",
    fallbackModel: "fallback",
  });

const apiError = (status: number, message: string) => Object.assign(new Error(message), { status });

describe("generateContentWithFallback", () => {
  beforeEach(() => {
    generateContent.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("moves to the fallback model when the primary is overloaded (503)", async () => {
    generateContent
      .mockRejectedValueOnce(apiError(503, '{"error":{"code":503,"message":"The model is overloaded.","status":"UNAVAILABLE"}}'))
      .mockResolvedValueOnce({ text: "ok" });
    await expect(call()).resolves.toEqual({ text: "ok" });
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1][0].model).toBe("fallback");
  });

  it("rethrows the 5xx when the fallback is down too — not a rate-limit error", async () => {
    generateContent.mockRejectedValue(apiError(500, "INTERNAL"));
    const err = await call().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(GeminiRateLimitError);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("never retries a request error (400) on the fallback", async () => {
    generateContent.mockRejectedValue(apiError(400, "INVALID_ARGUMENT"));
    await expect(call()).rejects.toThrow("INVALID_ARGUMENT");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
