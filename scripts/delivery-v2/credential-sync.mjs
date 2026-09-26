// Subscription sign-in renewal for the local worker (DLV-111, desktop part, 2026-09-19).
//
// The worker's credential volumes hold a copy of the owner's host sign-ins. Access
// tokens expire (Claude after hours, Codex after days) and nothing refreshed the
// copy, so both executors went "Unavailable" with HTTP 401/429.
//
// The host CLI stays the single refresher: before an auth probe or a job, the
// current host credential is copied into the volume when it differs from the last
// copy. The worker never writes back, and a copy is refused when its access token
// is too close to expiry, so an SDK inside a job has no reason to refresh (and
// rotate) the owner's refresh token. Tokens are never printed or logged.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { subscriptionCredential } from "./worker/subscription.mjs";

export const HOST_CREDENTIAL = Object.freeze({
  "claude-agent-sdk": { rel: ".claude/.credentials.json", renew: "open Claude Code once" },
  "codex-exec-sdk": { rel: ".codex/auth.json", renew: "run codex once" },
});

/** A job must be able to finish on the copied access token. */
export const MIN_REMAINING_MS = 45 * 60 * 1000;

const jwtExpiry = (token) => {
  try {
    const exp = JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString("utf8")).exp;
    return Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
};

/** Access-token expiry (ms) of a validated subscription credential, or null when unknown. */
export function credentialExpiry(backend, credential) {
  if (backend === "claude-agent-sdk") {
    const at = Number(credential.claudeAiOauth.expiresAt);
    return Number.isFinite(at) ? at : null;
  }
  return jwtExpiry(credential.tokens.access_token);
}

// A refusal always names the reconnect action; it never suggests an API key or a paid route.
const refuse = (code, reason, entry, expiresAt) => ({
  ok: false,
  code,
  reason: reason + " (" + entry.renew + ")",
  reconnect: entry.renew,
  ...(expiresAt == null ? {} : { expiresAt }),
});

/** Sign-in rejected by the provider (HTTP 401/403): revoked or expired server-side. */
export const revokedRefusal = (backend) => refuse("revoked", "sign-in was rejected by the provider", HOST_CREDENTIAL[backend]);

/** Read and validate the host sign-in. `{ok, credential, expiresAt, fingerprint}` or `{ok:false, reason}`. */
export function readHostCredential(backend, { home = homedir(), now = Date.now() } = {}) {
  const entry = HOST_CREDENTIAL[backend];
  if (!entry) return { ok: false, reason: "unknown executor" };
  const path = join(home, entry.rel);
  if (!existsSync(path)) return refuse("not-signed-in", "not signed in on this laptop", entry);
  let credential;
  try {
    credential = subscriptionCredential(backend, JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    return refuse("unreadable", String((error && error.message) || error), entry);
  }
  const expiresAt = credentialExpiry(backend, credential);
  if (expiresAt == null) return refuse("unreadable", "sign-in expiry unreadable", entry);
  if (expiresAt <= now) return refuse("expired", "sign-in expired", entry, expiresAt);
  if (expiresAt - now < MIN_REMAINING_MS) return refuse("expiring", "sign-in expires soon", entry, expiresAt);
  const body = JSON.stringify(credential);
  return { ok: true, credential, body, expiresAt, fingerprint: createHash("sha256").update(body).digest("hex") };
}

/** Container script: write stdin as the backend's credential file, owned by the worker user. */
export const writeCredentialScript = (backend) =>
  "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const fs=require('fs');JSON.parse(s);fs.chownSync('/dst',0,0);const p='/dst/" +
  backend +
  ".json';if(fs.existsSync(p))fs.chownSync(p,0,0);fs.writeFileSync(p,s,{mode:0o600});fs.chownSync(p,10001,10001);fs.chmodSync('/dst',0o700);fs.chownSync('/dst',10001,10001);});";

/**
 * A syncer bound to one boundary. `sync(backend)` resolves once the host sign-in
 * is in the backend's volume, copying only when it changed since the last copy
 * made by this process.
 */
export function createCredentialSync({ boundary, docker, home = homedir(), now = () => Date.now() }) {
  const synced = new Map();
  // One copy per backend at a time: two writers into one credential file could
  // hand a starting job a half-written sign-in.
  const copying = new Map();
  async function copy(backend) {
    const volume = boundary.credentials && boundary.credentials[backend] && boundary.credentials[backend].volume;
    if (!volume) return { ok: false, code: "not-connected", reason: "subscription login has not been connected to this worker", reconnect: HOST_CREDENTIAL[backend]?.renew };
    const host = readHostCredential(backend, { home, now: now() });
    if (!host.ok) return host;
    if (synced.get(backend) === host.fingerprint) return { ok: true, copied: false, expiresAt: host.expiresAt };
    const args = [
      "run", "--rm", "-i", "--network", "none", "--user", "0:0", "--read-only", "--cap-drop", "ALL",
      "--cap-add", "CHOWN", "--cap-add", "FOWNER",
      "--mount", "type=volume,source=" + volume + ",target=/dst",
      boundary.image, "node", "-e", writeCredentialScript(backend),
    ];
    const result = await docker.run(args, { input: host.body, timeout: 60000 });
    if (result.status !== 0) return { ok: false, code: "sync-failed", reason: "could not refresh the worker sign-in", reconnect: HOST_CREDENTIAL[backend].renew };
    synced.set(backend, host.fingerprint);
    return { ok: true, copied: true, expiresAt: host.expiresAt };
  }
  return {
    sync(backend) {
      const inFlight = copying.get(backend);
      if (inFlight) return inFlight;
      const pending = copy(backend).finally(() => copying.delete(backend));
      copying.set(backend, pending);
      return pending;
    },
  };
}
