// Explicit operational diagnostic, never a passive readiness producer or job.
// Protocol reviewed against 0.144.1 schemas and exercised against 0.156.1 native
// initialize/account/read/model/list under the unchanged subscription boundary.
// https://learn.chatgpt.com/docs/app-server#list-models-modellist
// model/list can be remote, cached or bundled: it does not prove entitlement.
// To use without rebuilding the image, feed this module over stdin to node
// under authProbeArgs' existing envelope and inject the image's
// prepareSubscription export. No host mount or credential reader is added.
import { spawn } from "node:child_process";

export const CODEX_MODEL_PROBE_LIMITS = Object.freeze({ timeoutMs: 30_000, maxBytes: 1_000_000, maxPages: 5, cleanupMs: 1_000 });
const ALLOWED = new Set(["initialize", "initialized", "account/read", "model/list"]);
const BACKEND = "codex-exec-sdk";
const CODEX = "/opt/era/node_modules/.bin/codex";
const PROTOCOL_DOC = "https://learn.chatgpt.com/docs/app-server#list-models-modellist";
const validName = value => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,100}$/u.test(value);

/** @typedef {Pick<import("node:child_process").ChildProcessWithoutNullStreams, "pid" | "stdin" | "stdout" | "stderr"> & {kill:(signal?:"SIGTERM"|"SIGKILL")=>boolean,on:(event:string,listener:(...args:unknown[])=>void)=>unknown}} ProbeChild */

// Never retain stderr, account identifiers, model descriptions or server error
// text. Those inputs may contain sensitive data; only fixed refusal codes leave.
function childSession({ spawnFn, args, timeoutMs, maxBytes, cleanupMs, onLine, onStart }) {
  return new Promise(resolve => {
    const started = Date.now(), stderrSignals = new Set();
    let child, timer, killTimer, closeTimer, pending = "", bytes = 0, done = false, closed = false, verdict = null;
    let sigtermRequested = false, sigkillRequested = false;
    const finish = confirmed => {
      if (done) return;
      done = true;
      clearTimeout(timer); clearTimeout(killTimer); clearTimeout(closeTimer);
      resolve({ ...(verdict || { ok: false, code: "native-process-exited" }), cleanupConfirmed: confirmed, bytes,
        diagnostics: { elapsedMs: Math.max(0, Date.now() - started), stderrSignals: [...stderrSignals].sort(),
          stopCode: verdict?.code || "native-process-exited", sigtermRequested, sigkillRequested, closeObserved: confirmed } });
    };
    const stop = value => {
      if (verdict || done) return;
      verdict = value;
      clearTimeout(timer);
      if (closed) return finish(true);
      try { child.stdin.end(); sigtermRequested = true; child.kill("SIGTERM"); } catch { /* close remains authoritative */ }
      if (done) return;
      killTimer = setTimeout(() => {
        try { sigkillRequested = true; child.kill("SIGKILL"); } catch { /* absence of close remains unknown */ }
        if (!done) closeTimer = setTimeout(() => finish(false), cleanupMs);
      }, cleanupMs);
    };
    try { child = spawnFn(CODEX, args, { cwd: "/tmp", env: process.env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }); }
    catch { resolve({ ok: false, code: "native-spawn-failed", cleanupConfirmed: true, bytes: 0 }); return; }
    const send = message => {
      if (!ALLOWED.has(message.method)) return stop({ ok: false, code: "rpc-method-refused" });
      if (!verdict && !done) child.stdin.write(JSON.stringify(message) + "\n");
    };
    child.stdin.on("error", () => stop({ ok: false, code: "native-input-failed" }));
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    const count = chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxBytes) stop({ ok: false, code: "native-output-limit" });
      return !verdict && !done;
    };
    child.stderr.on("data", chunk => {
      // Fixed signal names only: stderr itself is never retained or returned.
      const patterns = { unauthorized: /\b401\b/u, forbidden: /\b403\b/u, rateLimited: /\b429\b/u,
        tls: /certificate|\btls\b|\bssl\b/iu, proxy: /proxy/iu, dns: /dns|name resolution/iu,
        timeout: /timed? ?out|timeout/iu, connection: /connection (?:refused|reset)|connect error/iu,
        modelRefresh: /failed to.*(?:model|refresh)|error.*(?:model|refresh)/iu };
      for (const [name, pattern] of Object.entries(patterns)) if (pattern.test(chunk)) stderrSignals.add(name);
      count(chunk);
    });
    child.stdout.on("data", chunk => {
      if (!count(chunk)) return;
      pending += chunk;
      let end;
      while (!verdict && (end = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, end).trim(); pending = pending.slice(end + 1);
        if (line) {
          try { onLine(line, send, stop); }
          catch { stop({ ok: false, code: "native-protocol-invalid" }); }
        }
      }
    });
    child.on("error", () => {
      if (child.pid === undefined) { closed = true; verdict = { ok: false, code: "native-spawn-failed" }; finish(true); }
      else stop({ ok: false, code: "native-process-error" });
    });
    child.on("close", () => { closed = true; finish(true); });
    timer = setTimeout(() => stop({ ok: false, code: "native-probe-timeout" }), timeoutMs);
    try { onStart?.(send, stop); } catch { stop({ ok: false, code: "native-protocol-invalid" }); }
  });
}

/**
 * Existing subscription preparation is the only credential/usage seam.
 * @param {{prepareSubscription:(backend:string)=>Promise<unknown>, model:string, effort:string, expectedNativeVersion:string,
 *   spawnFn?:(command:string,args:string[],options:import("node:child_process").SpawnOptionsWithoutStdio)=>ProbeChild,
 *   limits?:Partial<typeof CODEX_MODEL_PROBE_LIMITS>, onProgress?:(event:object)=>void}} options
 */
export async function probeCodexModels({ prepareSubscription, model, effort, expectedNativeVersion, spawnFn = spawn, limits = {}, onProgress = null }) {
  const bounds = { ...CODEX_MODEL_PROBE_LIMITS, ...limits };
  const base = { schema: "delivery-v2/codex-model-probe@1", backend_id: BACKEND, model, effort,
    metadataSource: { method: "native-app-server/model/list", documentation: PROTOCOL_DOC, catalogOrigin: "unresolved: remote, cached or bundled" },
    entitlement: "unverified", providerTurns: 0 };
  const failure = (code, extra = {}) => ({ ...base, ok: false, code, ...extra });
  if (!validName(model) || !validName(effort) || !validName(expectedNativeVersion) || typeof prepareSubscription !== "function") return failure("probe-input-invalid");
  if (Object.keys(bounds).some(key => !Object.hasOwn(CODEX_MODEL_PROBE_LIMITS, key) || !Number.isInteger(bounds[key]) || bounds[key] < 1 || bounds[key] > CODEX_MODEL_PROBE_LIMITS[key])) return failure("probe-limit-invalid");
  // Fixed metadata only. Emit before each await so an outer process timeout
  // retains the last reached stage without depending on a final JSON record.
  const progress = (stage, event, details = {}) => {
    try { onProgress?.({ stage, event, at: new Date().toISOString(), ...details }); } catch { /* diagnosis cannot change admission */ }
  };
  progress("version", "started");
  const version = await childSession({ spawnFn, args: ["--version"], ...bounds,
    onLine(line, _send, stop) {
      const found = /^codex-cli ([0-9]+\.[0-9]+\.[0-9]+(?:[-+][a-zA-Z0-9.-]+)?)$/u.exec(line);
      stop(found ? { ok: true, nativeVersion: found[1] } : { ok: false, code: "native-version-invalid" });
    },
  });
  progress("version", "completed", { code: version.ok ? "native-version-observed" : version.code, nativeVersion: version.nativeVersion, cleanupConfirmed: version.cleanupConfirmed });
  if (!version.cleanupConfirmed) return failure("native-cleanup-unconfirmed");
  if (!version.ok) return failure(version.code);
  if (version.nativeVersion !== expectedNativeVersion) return failure("native-version-mismatch", { nativeVersion: version.nativeVersion });
  let subscription;
  progress("subscription", "started");
  try { subscription = await prepareSubscription(BACKEND); }
  catch { progress("subscription", "completed", { code: "subscription-unavailable" }); return failure("subscription-unavailable", { nativeVersion: version.nativeVersion }); }
  progress("subscription", "completed", { code: subscription?.method === "chatgpt" && subscription.additionalSpendAllowed === false && subscription.includedUsageAvailable === true ? "subscription-observed" : "subscription-not-proven" });
  if (subscription?.method !== "chatgpt" || subscription.additionalSpendAllowed !== false || subscription.includedUsageAvailable !== true) return failure("subscription-not-proven", { nativeVersion: version.nativeVersion });
  let expected = "initialize", page = 0, account = null;
  /** @type {{method:string,startedAt:string,completedAt:string|null}[]} */
  const rpcStages = [];
  const sendRequest = (send, message) => {
    rpcStages.push({ method: message.method, startedAt: new Date().toISOString(), completedAt: null });
    progress(message.method, "started");
    send(message);
  };
  const cursors = new Set();
  progress("app-server", "started");
  const result = await childSession({ spawnFn, args: ["app-server", "--listen", "stdio://"], ...bounds,
    onStart(send) {
      sendRequest(send, { method: "initialize", id: expected, params: { clientInfo: { name: "era_delivery_readiness", title: "ERA Delivery readiness", version: "1.0.0" }, capabilities: { experimentalApi: false } } });
    },
    onLine(line, send, stop) {
      const message = JSON.parse(line);
      if (message.method) {
        if (message.id !== undefined || /^(thread|turn|item|command|process)\//u.test(message.method)) stop({ ok: false, code: "unexpected-native-activity" });
        return;
      }
      if (message.id !== expected || message.error || !message.result || typeof message.result !== "object") return stop({ ok: false, code: "native-rpc-refused" });
      rpcStages.at(-1).completedAt = new Date().toISOString();
      progress(rpcStages.at(-1).method, "completed");
      if (expected === "initialize") {
        if (message.result.platformOs !== "linux") return stop({ ok: false, code: "native-platform-mismatch" });
        send({ method: "initialized", params: {} });
        expected = "account";
        sendRequest(send, { method: "account/read", id: expected, params: { refreshToken: false } });
        return;
      }
      if (expected === "account") {
        if (message.result.account?.type !== "chatgpt" || message.result.requiresOpenaiAuth !== true) return stop({ ok: false, code: "native-subscription-mismatch" });
        const type = message.result.account.planType;
        account = { type: "chatgpt", planType: ["free", "go", "plus", "pro", "prolite", "team", "self_serve_business_usage_based", "business", "enterprise_cbp_usage_based", "enterprise", "edu"].includes(type) ? type : "unknown" };
      } else {
        const data = message.result.data;
        if (!Array.isArray(data)) return stop({ ok: false, code: "native-catalog-invalid" });
        const selected = data.filter(row => row?.model === model);
        if (selected.length > 1) return stop({ ok: false, code: "native-catalog-ambiguous" });
        if (selected.length === 1) {
          const supported = selected[0].supportedReasoningEfforts;
          if (!Array.isArray(supported) || !supported.every(row => typeof row?.reasoningEffort === "string")) return stop({ ok: false, code: "native-efforts-unknown" });
          return stop({ ok: supported.some(row => row.reasoningEffort === effort), code: supported.some(row => row.reasoningEffort === effort) ? "native-selection-advertised" : "native-effort-not-advertised", modelAdvertised: true, effortAdvertised: supported.some(row => row.reasoningEffort === effort) });
        }
        if (message.result.nextCursor == null) return stop({ ok: false, code: "native-model-not-advertised", modelAdvertised: false, effortAdvertised: false });
        if (typeof message.result.nextCursor !== "string" || !message.result.nextCursor || cursors.has(message.result.nextCursor)) return stop({ ok: false, code: "native-cursor-invalid" });
        cursors.add(message.result.nextCursor);
      }
      if (page >= bounds.maxPages) return stop({ ok: false, code: "native-catalog-page-limit" });
      expected = "models-" + (++page);
      sendRequest(send, { method: "model/list", id: expected, params: { limit: 100, includeHidden: true, cursor: message.result.nextCursor ?? null } });
    },
  });
  progress("app-server", "completed", { code: result.code, cleanupConfirmed: result.cleanupConfirmed });
  return { ...base, ...result, ...(result.cleanupConfirmed ? {} : { ok: false, code: "native-cleanup-unconfirmed" }),
    nativeVersion: version.nativeVersion, account, subscription: { method: "chatgpt", additionalSpendAllowed: false, includedUsageAvailable: true },
    pages: page, observedAt: new Date().toISOString(), diagnostics: { ...result.diagnostics, rpcStages } };
}
