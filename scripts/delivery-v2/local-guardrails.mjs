// DLV-152. Accident prevention on the host, not a security boundary.
import { readFileSync, existsSync, lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { subscriptionCredential, assertSubscriptionEnvironment } from "./worker/subscription.mjs";

export const LOCAL_RISK_VERSION = "local-risk@1";
const MONEY = "balance|accounts|transfers|transactions|recurring|debts|budget|drafts|statement-import|future-purchases|analytics";
export function classifyLocalDiff(files) {
  const flagged = [];
  for (const { path: raw, before = "", after = "" } of files) {
    const path = raw.replace(/\\/gu, "/");
    const domains = [];
    if (new RegExp(`^src/features/(${MONEY})(/|$)`).test(path)
      || /^src\/lib\/balance(?:-utils)?\.ts$/u.test(path)
      || path === "src/services/transaction.service.ts"
      || /^src\/app\/api\/(transactions|transfers|accounts|debts|drafts|recurring-payments|future-payments|future-purchases|budget-allocations|statement-import|recycle-bin)(\/|$)/u.test(path)) domains.push("money");
    if (/^src\/lib\/(recurring\.ts|schedule\/)/u.test(path) || /^src\/app\/api\/cron\//u.test(path)
      || /(?:from\s*|import\s*\(|require\s*\()\s*["']rrule(?:["'/])/u.test(before + "\n" + after)) domains.push("recurrence");
    if (/^src\/lib\/(supabase\/|(?:accountAccess|tripAccess)\.ts$)/u.test(path)
      || /^src\/app\/api\/(auth|household|guest-portal)(\/|$)/u.test(path)
      || ["proxy.ts", "src/proxy.ts", "src/middleware.ts"].includes(path)
      || (/^src\/app\/api\/.*route\.[jt]s$/u.test(path) && /\bsupabaseAdmin\b/u.test(before + "\n" + after))) domains.push("auth-household");
    if (path.startsWith("migrations/")) domains.push("schema");
    if (/^(?:CLAUDE|AGENTS|CODEX)\.md$/u.test(path) || /^(?:\.claude|\.agents|\.codex|\.husky|\.github\/workflows|scripts\/delivery-v2)\//u.test(path)
      || ["tests/setup/blockPaidApis.ts", "scripts/sync-ai-mirrors.mjs", "scripts/run-agent-hook.mjs", "scripts/agent-tool-paths.mjs", "scripts/pm-server.mjs"].includes(path)) domains.push("rules");
    if (domains.length) flagged.push({ path, domains });
  }
  return { version: LOCAL_RISK_VERSION, flagged, required: flagged.length > 0 };
}

const ENV = /^(?:PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|LANG|LC_ALL|TERM|SHELL|PNPM_HOME|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS)$/iu;
/** @param {Record<string, string|undefined>} source */
export function localEnvironment(source = process.env) {
  return Object.fromEntries(Object.entries(source).filter(([key, value]) => ENV.test(key) && typeof value === "string"));
}

/** No credential values leave this function. Unknown/key sign-ins refuse. */
/** @param {string} executor @param {{env?:Record<string,string|undefined>,home?:string}} options */
export function localSubscription(executor, { env = process.env, home = homedir() } = {}) {
  assertSubscriptionEnvironment(env);
  const claude = executor === "claude";
  const dir = claude ? env.CLAUDE_CONFIG_DIR || join(home, ".claude") : env.CODEX_HOME || join(home, ".codex");
  subscriptionCredential(claude ? "claude-agent-sdk" : "codex-exec-sdk",
    JSON.parse(readFileSync(join(dir, claude ? ".credentials.json" : "auth.json"), "utf8")));
  return { ok: true, method: claude ? "claude.ai" : "chatgpt", directory: dir };
}

/** Check ignored and nested env files as well; linked trees may hide secrets. */
export function assertNoLocalSecrets(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if ([".git", "node_modules", ".next"].includes(entry.name)) continue;
    const path = join(root, entry.name);
    if (/^\.env(?:\.|$)/iu.test(entry.name)) throw new Error("worktree contains an .env file");
    if (lstatSync(path).isSymbolicLink()) throw new Error("worktree contains a symbolic link: " + entry.name);
    if (entry.isDirectory()) assertNoLocalSecrets(path);
  }
  if (existsSync(join(root, ".env"))) throw new Error("worktree contains .env");
}
