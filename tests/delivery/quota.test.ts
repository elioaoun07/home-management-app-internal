import { describe, expect, it } from "vitest";
import { classifyTurnError } from "../../scripts/delivery/quota.mjs";

describe("classifyTurnError", () => {
  it("classifies a Claude Code session-limit message as quota/non-retryable and extracts the reset time", () => {
    const err = new Error(
      "claude driver: query failed — Claude Code returned an error result: You've hit your session limit · resets 12:30am (Asia/Beirut)",
    );
    const verdict = classifyTurnError(err);
    expect(verdict.kind).toBe("quota");
    expect(verdict.retryable).toBe(false);
    expect(verdict.resetsAt).toBe("12:30am (Asia/Beirut)");
  });

  it("classifies a bare HTTP 429 as quota", () => {
    expect(classifyTurnError(new Error("codex driver: stream failed — 429 Too Many Requests")).kind).toBe("quota");
  });

  it("classifies insufficient_quota / rate_limit wording as quota", () => {
    expect(classifyTurnError(new Error("insufficient_quota: exceeded your current quota")).kind).toBe("quota");
    expect(classifyTurnError(new Error("rate_limit_exceeded")).kind).toBe("quota");
  });

  it("treats an unrelated failure as transient/retryable", () => {
    const verdict = classifyTurnError(new Error("claude driver: query failed — network exploded"));
    expect(verdict.kind).toBe("transient");
    expect(verdict.retryable).toBe(true);
    expect(verdict.resetsAt).toBeNull();
  });

  it("handles a bare string and a null/undefined error without throwing", () => {
    expect(classifyTurnError("quota exceeded").kind).toBe("quota");
    expect(classifyTurnError(null).kind).toBe("transient");
    expect(classifyTurnError(undefined).kind).toBe("transient");
  });
});
