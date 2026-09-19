// scripts/delivery-v2/local-auth.mjs
// Command Center Phase 3 — trusted-local command authentication (DLV-97, V2-I10).
//
// Before this, a V2 command was accepted after Origin/Sec-Fetch-Site checks with
// whatever actor name the body or an `x-era-actor` header supplied. That names a
// claimed actor; it does not authenticate one, and with `pnpm pm --lan` any host
// on the network could supply it.
//
// Now a consequential V2 request must carry one of two credentials, and the actor
// is derived from the credential, never read from the request:
//
//   browser  An HttpOnly SameSite=Strict session cookie issued only after the
//            owner types a one-time pairing code printed by the local server,
//            plus a CSRF token derived from that session (double submit). A
//            cross-site page can neither read the token nor send the cookie.
//   bridge   A bearer token issued the same way for the trusted phone bridge.
//            Only this credential may name a remote actor, which the bridge
//            derives from the identity it authenticated.
//
// Origin and Sec-Fetch-Site are still checked first. The server's Host guard
// (scripts/pm/net.mjs) stays the DNS-rebinding defence.
//
// Stored at `.delivery/v2/local-auth.json` (gitignored). Tokens and pairing codes
// are kept only as SHA-256 hashes.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { deepFreeze } from "./contracts.mjs";

export const LOCAL_AUTH_REL = ".delivery/v2/local-auth.json";
export const LOCAL_AUTH_SCHEMA = "delivery-v2/local-auth@1";
export const SESSION_COOKIE = "era_v2_session";
export const CSRF_HEADER = "x-era-csrf";
export const REMOTE_ACTOR_HEADER = "x-era-remote-actor";
export const SESSION_KINDS = Object.freeze(["browser", "bridge"]);

const PAIRING_TTL_MS = 10 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REMOTE_ACTOR_PATTERN = /^[a-z][a-z0-9-]{0,31}:[A-Za-z0-9._@-]{1,128}$/u;

export const AUTH_REFUSALS = Object.freeze({
  CROSS_ORIGIN: "cross-origin-request-refused",
  UNPAIRED: "local-session-required",
  CSRF: "csrf-token-invalid",
  PAIRING: "pairing-code-invalid",
  REMOTE_ACTOR: "remote-actor-required",
});

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const sha256 = (text) => createHash("sha256").update(String(text), "utf8").digest("hex");

function statePath(root) {
  return join(root, ...LOCAL_AUTH_REL.split("/"));
}

function readState(root) {
  const path = statePath(root);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && parsed.schema === LOCAL_AUTH_SCHEMA && isNonEmptyString(parsed.secret) ? parsed : null;
  } catch {
    return null;
  }
}

function writeState(root, state) {
  const path = statePath(root);
  mkdirSync(dirname(path), { recursive: true });
  const temp = path + ".tmp";
  writeFileSync(temp, JSON.stringify(state, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  renameSync(temp, path);
}

/** Create the installation secret on first use. An unreadable file is replaced, invalidating every session. */
export function ensureAuthState({ root, random = randomBytes }) {
  const existing = readState(root);
  if (existing) return existing;
  const state = { schema: LOCAL_AUTH_SCHEMA, secret: random(32).toString("hex"), pairing: null, sessions: [] };
  writeState(root, state);
  return state;
}

/**
 * Issue a one-time pairing code, replacing any earlier one.
 *
 * @param {{root:string, now?:number, random?:(size:number)=>Buffer}} input
 */
export function issuePairingCode({ root, now = Date.now(), random = randomBytes }) {
  const state = ensureAuthState({ root, random });
  const bytes = random(8);
  const code = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
  const expires_at = new Date(now + PAIRING_TTL_MS).toISOString();
  writeState(root, { ...state, pairing: { code_hash: sha256(code), expires_at } });
  return deepFreeze({ code, expires_at });
}

function sameHash(a, b) {
  const left = Buffer.from(String(a), "utf8");
  const right = Buffer.from(String(b), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Exchange a pairing code for a session token. The code is single-use.
 *
 * @param {{root:string, code:string, kind?:string, now?:number, random?:(size:number)=>Buffer}} input
 */
export function pairSession({ root, code, kind = "browser", now = Date.now(), random = randomBytes }) {
  const state = readState(root);
  const refuse = () => deepFreeze({ ok: false, token: null, session_id: null, refusal: { code: AUTH_REFUSALS.PAIRING, detail: "the pairing code is missing, used or expired" } });
  if (!state || !state.pairing || !isNonEmptyString(code) || !SESSION_KINDS.includes(kind)) return refuse();
  if (String(state.pairing.expires_at) <= new Date(now).toISOString()) return refuse();
  if (!sameHash(sha256(String(code).trim().toUpperCase()), state.pairing.code_hash)) return refuse();
  const token = random(32).toString("base64url");
  const session_hash = sha256(token);
  writeState(root, {
    ...state,
    pairing: null,
    sessions: [...(state.sessions || []), { session_hash, kind, actor: kind === "bridge" ? "bridge" : "owner", created_at: new Date(now).toISOString() }],
  });
  return deepFreeze({ ok: true, token, session_id: session_hash.slice(0, 12), kind, refusal: null });
}

/**
 * Issue the in-process credential for the trusted phone bridge.
 *
 * The bridge runs inside pm-server, so it pairs itself without printing a code:
 * the token lives only in that process's memory and every earlier bridge session
 * is removed, so a credential from a previous process cannot be reused.
 *
 * @param {{root:string, now?:number, random?:(size:number)=>Buffer}} input
 */
export function pairBridgeSession({ root, now = Date.now(), random = randomBytes }) {
  const state = ensureAuthState({ root, random });
  writeState(root, { ...state, sessions: (state.sessions || []).filter((session) => session.kind !== "bridge") });
  const { code } = issuePairingCode({ root, now, random });
  return pairSession({ root, code, kind: "bridge", now, random });
}

/** Remove one session by its token. */
export function revokeSession({ root, token }) {
  const state = readState(root);
  if (!state || !isNonEmptyString(token)) return false;
  const hash = sha256(token);
  const sessions = (state.sessions || []).filter((session) => session.session_hash !== hash);
  if (sessions.length === (state.sessions || []).length) return false;
  writeState(root, { ...state, sessions });
  return true;
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (key) out[key] = part.slice(index + 1).trim();
  }
  return out;
}

/** CSRF token for one session: the page must present it; a cross-site page cannot read it. */
export function csrfToken({ secret, session_hash }) {
  return createHmac("sha256", String(secret)).update("csrf:" + session_hash).digest("base64url");
}

/** Cookie attributes for a browser session. Scoped to the V2 routes only. */
export function sessionCookie(token, { maxAgeSeconds = 60 * 60 * 24 * 365 } = {}) {
  return SESSION_COOKIE + "=" + token + "; HttpOnly; SameSite=Strict; Path=/api/delivery/v2; Max-Age=" + maxAgeSeconds;
}

export function clearedSessionCookie() {
  return SESSION_COOKIE + "=; HttpOnly; SameSite=Strict; Path=/api/delivery/v2; Max-Age=0";
}

/** Is this origin a loopback address? Parsed, not prefix-matched. */
export function isLoopbackOrigin(origin) {
  if (!isNonEmptyString(origin)) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
}

function lowerHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers || {})) out[String(key).toLowerCase()] = Array.isArray(value) ? value[0] : value;
  return out;
}

/**
 * The cross-origin half: a browser-attached Origin must be one this server
 * serves, and Sec-Fetch-Site must not say cross-site.
 */
export function checkOrigin({ headers = {}, allowedOrigins = [], allowLoopbackOrigins = true }) {
  const lower = lowerHeaders(headers);
  const origin = lower.origin;
  if (isNonEmptyString(origin) && !(allowedOrigins.includes(origin) || (allowLoopbackOrigins && isLoopbackOrigin(origin)))) {
    return deepFreeze({ ok: false, refusal: { code: AUTH_REFUSALS.CROSS_ORIGIN, detail: origin } });
  }
  const site = lower["sec-fetch-site"];
  if (isNonEmptyString(site) && site !== "same-origin" && site !== "none") {
    return deepFreeze({ ok: false, refusal: { code: AUTH_REFUSALS.CROSS_ORIGIN, detail: "sec-fetch-site: " + site } });
  }
  return deepFreeze({ ok: true, refusal: null });
}

/**
 * Authenticate one consequential V2 request.
 *
 * @param {{root:string, headers?:Record<string, any>, allowedOrigins?:string[]}} input
 * @returns {{ok:boolean, status:number, refusal:({code:string, detail:unknown}|null),
 *   actor:(string|null), kind:(string|null), session_id:(string|null)}}
 */
export function authenticateLocal({ root, headers = {}, allowedOrigins = [] }) {
  const deny = (status, code, detail) => deepFreeze({ ok: false, status, refusal: { code, detail }, actor: null, kind: null, session_id: null });
  const origin = checkOrigin({ headers, allowedOrigins });
  if (!origin.ok) return deny(403, origin.refusal.code, origin.refusal.detail);

  const lower = lowerHeaders(headers);
  const state = readState(root);
  if (!state) return deny(401, AUTH_REFUSALS.UNPAIRED, "no local session has been paired");
  const sessions = state.sessions || [];

  const bearer = isNonEmptyString(lower.authorization) ? String(lower.authorization).match(/^Bearer\s+(\S+)$/u) : null;
  if (bearer) {
    const hash = sha256(bearer[1]);
    const session = sessions.find((entry) => entry.kind === "bridge" && sameHash(entry.session_hash, hash));
    if (!session) return deny(401, AUTH_REFUSALS.UNPAIRED, "unknown bridge credential");
    const remote = String(lower[REMOTE_ACTOR_HEADER] || "").trim();
    if (!REMOTE_ACTOR_PATTERN.test(remote)) {
      return deny(401, AUTH_REFUSALS.REMOTE_ACTOR, "the bridge must state the authenticated remote identity");
    }
    return deepFreeze({ ok: true, status: 200, refusal: null, actor: "remote:" + remote, kind: "bridge", session_id: hash.slice(0, 12) });
  }

  const token = parseCookies(lower.cookie)[SESSION_COOKIE];
  if (!isNonEmptyString(token)) return deny(401, AUTH_REFUSALS.UNPAIRED, "pair this browser first");
  const hash = sha256(token);
  const session = sessions.find((entry) => entry.kind === "browser" && sameHash(entry.session_hash, hash));
  if (!session) return deny(401, AUTH_REFUSALS.UNPAIRED, "this browser's session is not recognised");
  const presented = String(lower[CSRF_HEADER] || "");
  if (!presented || !sameHash(presented, csrfToken({ secret: state.secret, session_hash: hash }))) {
    return deny(403, AUTH_REFUSALS.CSRF, "missing or invalid " + CSRF_HEADER);
  }
  return deepFreeze({ ok: true, status: 200, refusal: null, actor: String(session.actor), kind: "browser", session_id: hash.slice(0, 12) });
}

/**
 * What the page may know about its own session. Readable only same-origin, so
 * returning the CSRF token here does not hand it to another site.
 */
export function sessionView({ root, headers = {} }) {
  const lower = lowerHeaders(headers);
  const state = readState(root);
  const token = parseCookies(lower.cookie)[SESSION_COOKIE];
  if (!state || !isNonEmptyString(token)) return deepFreeze({ paired: false, actor: null, csrf: null });
  const hash = sha256(token);
  const session = (state.sessions || []).find((entry) => entry.kind === "browser" && sameHash(entry.session_hash, hash));
  if (!session) return deepFreeze({ paired: false, actor: null, csrf: null });
  return deepFreeze({ paired: true, actor: String(session.actor), csrf: csrfToken({ secret: state.secret, session_hash: hash }) });
}

/** CLI: `node scripts/delivery-v2/local-auth.mjs pair` prints a fresh pairing code. */
if (process.argv[1] && process.argv[1].replace(/\\/gu, "/").endsWith("delivery-v2/local-auth.mjs") && process.argv[2] === "pair") {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const { code, expires_at } = issuePairingCode({ root });
  process.stdout.write("Delivery pairing code: " + code + " (expires " + expires_at + ")\n");
}
