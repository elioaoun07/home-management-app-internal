// DLV-111 desktop renewal: the host sign-in is the single refresher; the worker
// volume receives a copy only when it changed and has time left to run a job.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { MIN_REMAINING_MS, createCredentialSync, readHostCredential } from "../../scripts/delivery-v2/credential-sync.mjs";

type Loose = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const NOW = Date.parse("2026-09-19T13:00:00.000Z");
const jwt = (exp: number) => "h." + Buffer.from(JSON.stringify({ exp: Math.floor(exp / 1000) })).toString("base64url") + ".s";

let homes: string[] = [];
afterEach(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true });
  homes = [];
});

function homeWith({ claudeExpires, codexExpires }: { claudeExpires?: number; codexExpires?: number }) {
  const home = mkdtempSync(join(tmpdir(), "era-cred-"));
  homes.push(home);
  if (claudeExpires != null) {
    mkdirSync(join(home, ".claude"), { recursive: true });
    writeFileSync(
      join(home, ".claude", ".credentials.json"),
      JSON.stringify({ claudeAiOauth: { accessToken: "a", refreshToken: "r", expiresAt: claudeExpires, subscriptionType: "pro", scopes: ["user:inference"] } }),
    );
  }
  if (codexExpires != null) {
    mkdirSync(join(home, ".codex"), { recursive: true });
    writeFileSync(join(home, ".codex", "auth.json"), JSON.stringify({ auth_mode: "chatgpt", tokens: { access_token: jwt(codexExpires), refresh_token: "r", account_id: "acct" } }));
  }
  return home;
}

const boundary = { image: "sha256:img", credentials: { "claude-agent-sdk": { volume: "vol-claude" }, "codex-exec-sdk": { volume: "vol-codex" } } };
const fakeDocker = () => {
  const calls: Loose[] = [];
  return { calls, run: (args: string[], options: Loose) => (calls.push({ args, input: options?.input }), { status: 0, stdout: "", stderr: "" }) };
};

describe("credential sync", () => {
  it("copies a valid host sign-in once, and again only after it changes", () => {
    const home = homeWith({ codexExpires: NOW + 10 * 86_400_000 });
    const docker = fakeDocker();
    const sync = createCredentialSync({ boundary, docker, home, now: () => NOW });
    expect(sync.sync("codex-exec-sdk")).toMatchObject({ ok: true, copied: true });
    expect(sync.sync("codex-exec-sdk")).toMatchObject({ ok: true, copied: false });
    expect(docker.calls).toHaveLength(1);
    expect(docker.calls[0].args).toContain("type=volume,source=vol-codex,target=/dst");
    expect(docker.calls[0].args).toContain("none");
    writeFileSync(join(home, ".codex", "auth.json"), JSON.stringify({ auth_mode: "chatgpt", tokens: { access_token: jwt(NOW + 9 * 86_400_000), refresh_token: "r2", account_id: "acct" } }));
    expect(sync.sync("codex-exec-sdk")).toMatchObject({ ok: true, copied: true });
    expect(docker.calls).toHaveLength(2);
  });

  it("refuses a sign-in about to expire, so a job never needs to refresh it", () => {
    const home = homeWith({ claudeExpires: NOW + MIN_REMAINING_MS - 1 });
    const docker = fakeDocker();
    const result: Loose = createCredentialSync({ boundary, docker, home, now: () => NOW }).sync("claude-agent-sdk");
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toMatch(/open Claude Code once/u);
    expect(docker.calls).toHaveLength(0);
  });

  it("refuses API-key or missing sign-ins without touching the volume", () => {
    const home = homeWith({});
    mkdirSync(join(home, ".codex"), { recursive: true });
    writeFileSync(join(home, ".codex", "auth.json"), JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: "sk-x" }));
    expect(readHostCredential("codex-exec-sdk", { home, now: NOW }).ok).toBe(false);
    expect(readHostCredential("claude-agent-sdk", { home, now: NOW })).toMatchObject({ ok: false });
  });
});
