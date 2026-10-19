import { fileURLToPath } from "node:url";
import { inspectReadiness } from "./inspect-readiness.mjs";
import { canonicalJson } from "./contracts.mjs";
import { evaluateReadiness, READINESS_SCHEMA } from "./readiness.mjs";
import { normalizeWorkId } from "../pm/shared/work-id.mjs";

// Use the existing passive public GET, never pairing, credential export or the
// authenticated refresh action. The service retains observation/store authority.
async function serviceReadiness(options, fetcher, now) {
  let origin;
  try { origin = new URL(options.service); } catch { throw new Error("service-origin-invalid"); }
  if (!["http:", "https:"].includes(origin.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
      origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("service-origin-invalid");
  const selection = { file: options.file || "", id: normalizeWorkId(options.id || "") || options.id || "", executor: options.executor || "",
    model: options.model || null, effort: options.effort || null, workProfile: options.workProfile || "focused" };
  const url = new URL("/api/delivery/v2/readiness", origin);
  for (const [key, value] of Object.entries(selection)) if (value !== null) url.searchParams.set(key, value);
  let response;
  try {
    response = await fetcher(url, { method: "GET", headers: { Accept: "application/json" }, credentials: "omit", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000) });
  } catch { throw new Error("service-readiness-unavailable"); }
  if (!response.ok) throw new Error("service-readiness-http-" + response.status);
  let result;
  try { result = await response.json(); } catch { throw new Error("service-readiness-invalid"); }
  if (!result || result.schema !== READINESS_SCHEMA || result.phase !== "launch" || result.authority !== "inspection-only" ||
      !result.facts || !Array.isArray(result.blockers) || !/^sha256:[a-f0-9]{64}$/u.test(result.contextFingerprint || "")) throw new Error("service-readiness-invalid");
  if (canonicalJson(result.selection) !== canonicalJson(selection)) throw new Error("service-selection-mismatch");
  const projected = evaluateReadiness({ selection, facts: result.facts });
  if (["ready", "status", "blockers", "nextActions", "fingerprint"].some(key => canonicalJson(result[key]) !== canonicalJson(projected[key]))) throw new Error("service-readiness-invalid");
  // inspectReadiness issues positive projections for at most 30 seconds.
  const remaining = Date.parse(result.expiresAt || "") - now();
  if (result.ready && !(remaining > 0 && remaining <= 30_000)) throw new Error("service-readiness-stale");
  return result;
}

/** @param {string[]} args @param {{root?:string,write?:(text:string)=>void,fetcher?:typeof fetch,now?:()=>number}} options */
export async function runReadyCli(args, { root = process.cwd(), write = text => process.stdout.write(text), fetcher = fetch, now = Date.now } = {}) {
  const names = { "--file": "file", "--id": "id", "--executor": "executor", "--model": "model", "--effort": "effort", "--profile": "workProfile", "--service": "service" };
  const options = { root };
  for (let at = 0; at < args.length; at += 2) {
    if (!names[args[at]] || !args[at + 1] || args[at + 1].startsWith("--")) {
      write(JSON.stringify({ error: "usage", detail: "pm:ready --file <campaign/4 - Checklist.md> --id <ID> --executor <codex|claude> --model <id> --effort <level> [--profile focused|investigate] [--service <loopback-origin>]" }) + "\n");
      return 2;
    }
    options[names[args[at]]] = args[at + 1];
  }
  let result;
  try { result = options.service ? await serviceReadiness(options, fetcher, now) : await inspectReadiness(options); }
  catch (error) {
    write(JSON.stringify({ error: "inspection-unavailable", detail: error.message }) + "\n");
    return 2;
  }
  write(JSON.stringify(result, null, 2) + "\n");
  return result.ready ? 0 : 1;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await runReadyCli(process.argv.slice(2)); }
  catch (error) { process.stderr.write(JSON.stringify({ error: "inspection-unavailable", detail: error.message }) + "\n"); process.exitCode = 2; }
}
