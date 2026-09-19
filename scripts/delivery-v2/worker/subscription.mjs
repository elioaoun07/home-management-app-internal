// Subscription authentication is deliberately separate from SDK invocation.
// Unknown billing, paid credits and API credentials fail before any prompt.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";

const forbiddenEnv = /^(ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN|ANTHROPIC_BASE_URL|OPENAI_API_KEY|OPENAI_BASE_URL|CODEX_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|CLAUDE_CODE_USE_.*|AWS_.*|AZURE_.*|GOOGLE_APPLICATION_CREDENTIALS)$/u;
export function assertSubscriptionEnvironment(env) {
  if (Object.entries(env).some(([key, value]) => forbiddenEnv.test(key) && value)) throw new Error("subscription-only: API or alternate-provider credentials refused");
}

export function subscriptionCredential(backend, raw) {
  if (backend === "claude-agent-sdk") {
    const auth = raw?.claudeAiOauth;
    if (!auth?.accessToken || !["pro", "max", "team", "enterprise"].includes(auth.subscriptionType) || !auth.scopes?.includes("user:inference") || raw.apiKey) throw new Error("subscription-only: Claude subscription login required");
    return { claudeAiOauth: auth };
  }
  if (backend === "codex-exec-sdk") {
    if (raw?.auth_mode !== "chatgpt" || raw.OPENAI_API_KEY || !raw.tokens?.access_token || !raw.tokens?.account_id) throw new Error("subscription-only: Codex ChatGPT login required");
    return { auth_mode: "chatgpt", OPENAI_API_KEY: null, tokens: raw.tokens, last_refresh: raw.last_refresh };
  }
  throw new Error("subscription-only: unknown executor");
}

export function includedUsage(backend, usage) {
  if (backend === "claude-agent-sdk") {
    if (usage?.extra_usage?.is_enabled !== false || usage?.spend?.enabled === true) throw new Error("subscription-only: disable Claude usage credits before launch");
    const windows = [usage.five_hour, usage.seven_day, usage.seven_day_oauth_apps].filter(Boolean);
    if (!windows.length || windows.some(w => !Number.isFinite(w.utilization) || w.utilization >= 100)) throw new Error("subscription-only: Claude included usage unavailable or exhausted");
    return { method: "claude.ai", additionalSpendAllowed: false, includedUsageAvailable: true };
  }
  const credits = usage?.credits;
  if (!credits || credits.has_credits !== false || credits.unlimited !== false || Number(credits.balance) !== 0) throw new Error("subscription-only: Codex paid credits or unknown credit status refused");
  const limit = usage.rate_limit;
  const windows = [limit?.primary_window, limit?.secondary_window].filter(Boolean);
  if (limit?.allowed !== true || limit.limit_reached !== false || !windows.length || windows.some(w => !Number.isFinite(w.used_percent) || w.used_percent >= 100)) throw new Error("subscription-only: Codex included usage unavailable or exhausted");
  return { method: "chatgpt", additionalSpendAllowed: false, includedUsageAvailable: true };
}

/** Native HTTPS through the same CONNECT proxy as the SDK; no direct fallback. */
export function usageJSON(url, headers, proxy = process.env.HTTPS_PROXY) {
  const agent = new https.Agent();
  if (proxy) {
    const endpoint = new URL(proxy);
    agent.createConnection = (options, callback) => {
      const request = http.request({ hostname: endpoint.hostname, port: endpoint.port, method: "CONNECT", path: options.host + ":443", timeout: 15000 });
      request.once("connect", (response, socket) => {
        if (response.statusCode !== 200) { socket.destroy(); callback(new Error("subscription status proxy refused")); return; }
        const secure = tls.connect({ socket, servername: options.host });
        secure.once("secureConnect", () => callback(null, secure));
        secure.once("error", error => callback(error));
      });
      request.once("timeout", () => request.destroy(new Error("subscription status proxy timed out")));
      request.once("error", error => callback(error));
      request.end();
    };
  }
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers, agent, timeout: 20000 }, response => {
      let body = "";
      response.on("data", chunk => { body += chunk; if (body.length > 1000000) request.destroy(new Error("subscription status too large")); });
      response.on("end", () => {
        agent.destroy();
        if (response.statusCode !== 200) return reject(new Error("subscription status unavailable (HTTP " + response.statusCode + ")"));
        try { resolve(JSON.parse(body)); } catch { reject(new Error("subscription status invalid")); }
      });
    });
    request.once("timeout", () => request.destroy(new Error("subscription status timed out")));
    request.once("error", error => { agent.destroy(); reject(error); });
  });
}

export async function prepareSubscription(backend, { credentialRoot = "/run/era-credentials", home = process.env.HOME, env = process.env, readUsage = usageJSON } = {}) {
  assertSubscriptionEnvironment(env);
  const credential = subscriptionCredential(backend, JSON.parse(readFileSync(join(credentialRoot, backend + ".json"), "utf8")));
  const claude = backend === "claude-agent-sdk";
  const auth = claude ? credential.claudeAiOauth : credential.tokens;
  const headers = claude
    ? { Authorization: "Bearer " + auth.accessToken, "anthropic-beta": "oauth-2025-04-20" }
    : { Authorization: "Bearer " + auth.access_token, "ChatGPT-Account-Id": auth.account_id };
  const usage = await readUsage(claude ? "https://api.anthropic.com/api/oauth/usage" : "https://chatgpt.com/backend-api/wham/usage", headers);
  const provenance = includedUsage(backend, usage);
  const dir = join(home, claude ? ".claude" : ".codex");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(join(dir, claude ? ".credentials.json" : "auth.json"), JSON.stringify(credential), { mode: 0o600 });
  if (claude) {
    env.CLAUDE_CONFIG_DIR = dir;
    env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
  } else {
    env.CODEX_HOME = dir;
    writeFileSync(join(dir, "config.toml"), 'forced_login_method = "chatgpt"\ncli_auth_credentials_store = "file"\n');
  }
  return { ...provenance, checkedAt: new Date().toISOString() };
}
