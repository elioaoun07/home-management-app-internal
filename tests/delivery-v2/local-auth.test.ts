// Command Center Phase 3 — trusted-local command authentication (V2-I10).
//
// The refusals this suite exists for: a supplied actor name is not a credential,
// a cross-site page cannot ride a paired session, a pairing code works once, and
// only the bridge credential may name a remote actor.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AUTH_REFUSALS,
  CSRF_HEADER,
  REMOTE_ACTOR_HEADER,
  SESSION_COOKIE,
  authenticateLocal,
  issuePairingCode,
  pairSession,
  revokeSession,
  sessionView,
} from "../../scripts/delivery-v2/local-auth.mjs";
import { routeDeliveryV2 } from "../../scripts/delivery-v2/entry.mjs";

let ROOT: string;

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-auth-"));
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

function pairedBrowser() {
  const { code } = issuePairingCode({ root: ROOT });
  const paired = pairSession({ root: ROOT, code });
  expect(paired.ok).toBe(true);
  const cookie = SESSION_COOKIE + "=" + paired.token;
  const view = sessionView({ root: ROOT, headers: { cookie } });
  return { cookie, csrf: String(view.csrf), code };
}

describe("a supplied actor is not a credential", () => {
  it("refuses a command that only names its actor", () => {
    const auth = authenticateLocal({ root: ROOT, headers: { "sec-fetch-site": "same-origin", "x-era-actor": "owner" } });
    expect(auth.ok).toBe(false);
    expect(auth.refusal!.code).toBe(AUTH_REFUSALS.UNPAIRED);
  });

  it("derives the actor from the session, never from the request", () => {
    const { cookie, csrf } = pairedBrowser();
    const auth = authenticateLocal({ root: ROOT, headers: { cookie, [CSRF_HEADER]: csrf, "x-era-actor": "mallory", [REMOTE_ACTOR_HEADER]: "supabase:someone" } });
    expect(auth.ok).toBe(true);
    expect(auth.actor).toBe("owner");
    expect(auth.kind).toBe("browser");
  });

  it("returns 401 from a v2 command route without a session, whatever the body claims", async () => {
    const response = await routeDeliveryV2(
      { method: "POST", path: "/api/delivery/v2/mode", headers: { "sec-fetch-site": "same-origin" }, body: { mode: "v1", actor: "owner" } },
      { root: ROOT },
    );
    expect(response!.status).toBe(401);
    expect(response!.json.error).toBe(AUTH_REFUSALS.UNPAIRED);
  });
});

describe("pairing", () => {
  it("works once with the printed code and then requires the CSRF token", () => {
    const { cookie, csrf, code } = pairedBrowser();
    expect(authenticateLocal({ root: ROOT, headers: { cookie } }).refusal!.code).toBe(AUTH_REFUSALS.CSRF);
    expect(authenticateLocal({ root: ROOT, headers: { cookie, [CSRF_HEADER]: csrf + "x" } }).refusal!.code).toBe(AUTH_REFUSALS.CSRF);
    expect(authenticateLocal({ root: ROOT, headers: { cookie, [CSRF_HEADER]: csrf } }).ok).toBe(true);
    expect(pairSession({ root: ROOT, code }).ok).toBe(false);
  });

  it("refuses an expired code", () => {
    const { code } = issuePairingCode({ root: ROOT, now: Date.now() });
    expect(pairSession({ root: ROOT, code, now: Date.now() + 11 * 60 * 1000 }).ok).toBe(false);
  });

  it("sets an HttpOnly SameSite=Strict cookie scoped to the v2 routes", async () => {
    const { code } = issuePairingCode({ root: ROOT });
    const response = await routeDeliveryV2(
      { method: "POST", path: "/api/delivery/v2/session/pair", headers: { "sec-fetch-site": "same-origin" }, body: { code } },
      { root: ROOT },
    );
    expect(response!.status).toBe(200);
    const cookie = String(response!.headers!["Set-Cookie"]);
    expect(cookie).toMatch(/HttpOnly/u);
    expect(cookie).toMatch(/SameSite=Strict/u);
    expect(cookie).toMatch(/Path=\/api\/delivery\/v2/u);
    expect(response!.json.paired).toBe(true);
  });

  it("refuses a pairing attempt from another site", async () => {
    const { code } = issuePairingCode({ root: ROOT });
    const response = await routeDeliveryV2(
      { method: "POST", path: "/api/delivery/v2/session/pair", headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" }, body: { code } },
      { root: ROOT },
    );
    expect(response!.status).toBe(403);
  });
});

describe("cross-site requests and revocation", () => {
  it("refuses a cross-origin request even with a valid session and token", () => {
    const { cookie, csrf } = pairedBrowser();
    const auth = authenticateLocal({ root: ROOT, headers: { cookie, [CSRF_HEADER]: csrf, origin: "https://evil.example" } });
    expect(auth.ok).toBe(false);
    expect(auth.refusal!.code).toBe(AUTH_REFUSALS.CROSS_ORIGIN);
  });

  it("stops accepting a revoked session", () => {
    const { cookie, csrf } = pairedBrowser();
    const token = cookie.slice(SESSION_COOKIE.length + 1);
    expect(revokeSession({ root: ROOT, token })).toBe(true);
    expect(authenticateLocal({ root: ROOT, headers: { cookie, [CSRF_HEADER]: csrf } }).refusal!.code).toBe(AUTH_REFUSALS.UNPAIRED);
  });
});

describe("the bridge credential", () => {
  it("names a remote actor only from the bridge's authenticated identity", () => {
    const { code } = issuePairingCode({ root: ROOT });
    const bridge = pairSession({ root: ROOT, code, kind: "bridge" });
    expect(bridge.ok).toBe(true);
    const authorization = "Bearer " + bridge.token;
    expect(authenticateLocal({ root: ROOT, headers: { authorization } }).refusal!.code).toBe(AUTH_REFUSALS.REMOTE_ACTOR);
    const remote = authenticateLocal({ root: ROOT, headers: { authorization, [REMOTE_ACTOR_HEADER]: "supabase:user-1" } });
    expect(remote.ok).toBe(true);
    expect(remote.actor).toBe("remote:supabase:user-1");
  });

  it("does not accept a browser session as a bridge credential", () => {
    const { cookie } = pairedBrowser();
    const token = cookie.slice(SESSION_COOKIE.length + 1);
    const auth = authenticateLocal({ root: ROOT, headers: { authorization: "Bearer " + token, [REMOTE_ACTOR_HEADER]: "supabase:user-1" } });
    expect(auth.ok).toBe(false);
  });
});
