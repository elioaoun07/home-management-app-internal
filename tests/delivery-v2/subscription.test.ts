import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSubscriptionEnvironment, includedUsage, prepareSubscription, subscriptionCredential } from "../../scripts/delivery-v2/worker/subscription.mjs";
import { connectTarget, publicAddress } from "../../scripts/delivery-v2/worker/egress.mjs";
import { normalizeClaudeUsage, mergeUsageReadings } from "../../scripts/delivery-v2/adapters/claude.mjs";

const claude = { claudeAiOauth: { accessToken: "fixture", subscriptionType: "pro", scopes: ["user:inference"] } };
const codex = { auth_mode: "chatgpt", tokens: { access_token: "fixture", account_id: "fixture" } };
const claudeUsage = { extra_usage: { is_enabled: false }, five_hour: { utilization: 42 } };
const codexUsage = { credits: { has_credits: false, unlimited: false, balance: "0" }, rate_limit: { allowed: true, limit_reached: false, primary_window: { used_percent: 42 } } };
describe("subscription-only worker admission", () => {
  it("keeps SDK dollar estimates separate from subscription usage", () => {
    const usage = normalizeClaudeUsage({ type: "result", era_billing_basis: "included-subscription", total_cost_usd: 0.4, usage: { input_tokens: 100, output_tokens: 20 } });
    expect(usage).toMatchObject({ unit: "tokens", costUsd: null, apiEquivalentUsd: 0.4, input: 100, output: 20 });
    expect(mergeUsageReadings([{ turn: 1, usage }])).toMatchObject({ unit: "tokens", costUsd: null, input: 100 });
  });
  it("accepts native subscription credentials and strips unrelated configuration", () => {
    expect(subscriptionCredential("claude-agent-sdk", { ...claude, settings: "untrusted" })).toEqual(claude);
    expect(subscriptionCredential("codex-exec-sdk", codex).auth_mode).toBe("chatgpt");
  });
  it("rejects API credentials and alternate providers before a request", () => {
    for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY", "CODEX_API_KEY", "CLAUDE_CODE_USE_BEDROCK", "OPENAI_BASE_URL"]) expect(() => assertSubscriptionEnvironment({ [key]: "fixture" })).toThrow();
    expect(() => subscriptionCredential("codex-exec-sdk", { ...codex, OPENAI_API_KEY: "fixture" })).toThrow();
    expect(() => subscriptionCredential("claude-agent-sdk", { ANTHROPIC_API_KEY: "fixture" })).toThrow();
  });
  it("refuses paid, unknown and exhausted usage without treating an estimate as a bill", () => {
    expect(includedUsage("claude-agent-sdk", claudeUsage).additionalSpendAllowed).toBe(false);
    expect(includedUsage("codex-exec-sdk", codexUsage).additionalSpendAllowed).toBe(false);
    for (const usage of [null, {}, { ...claudeUsage, extra_usage: { is_enabled: true } }, { ...claudeUsage, five_hour: { utilization: 100 } }]) expect(() => includedUsage("claude-agent-sdk", usage)).toThrow();
    for (const usage of [null, {}, { ...codexUsage, credits: { has_credits: true, unlimited: false, balance: "10" } }, { ...codexUsage, rate_limit: { allowed: false } }]) expect(() => includedUsage("codex-exec-sdk", usage)).toThrow();
  });
  it("does not install credentials for the SDK until the live usage check succeeds", async () => {
    const root = mkdtempSync(join(tmpdir(), "era-subscription-test-"));
    const credentials = join(root, "credentials");
    mkdirSync(credentials);
    writeFileSync(join(credentials, "claude-agent-sdk.json"), JSON.stringify(claude));
    try {
      const input = { credentialRoot: credentials, home: join(root, "home"), env: { NODE_ENV: "test" as const }, readUsage: async () => ({ ...claudeUsage, extra_usage: { is_enabled: true } }) };
      await expect(prepareSubscription("claude-agent-sdk", input)).rejects.toThrow();
      expect(existsSync(join(input.home, ".claude/.credentials.json"))).toBe(false);
      await expect(prepareSubscription("claude-agent-sdk", { ...input, readUsage: async () => claudeUsage })).resolves.toMatchObject({ additionalSpendAllowed: false });
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
describe("provider egress", () => {
  it("allows only exact provider DNS names on TLS port 443", () => {
    const hosts = ["api.anthropic.com"];
    expect(connectTarget("api.anthropic.com:443", hosts)).toBe("api.anthropic.com");
    for (const target of ["api.anthropic.com.evil.test:443", "api.anthropic.com:80", "127.0.0.1:443", "user@api.anthropic.com:443"]) expect(connectTarget(target, hosts)).toBeNull();
    for (const ip of ["127.0.0.1", "10.0.0.1", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "203.0.113.1"]) expect(publicAddress(ip)).toBe(false);
    expect(publicAddress("1.1.1.1")).toBe(true);
  });
});
