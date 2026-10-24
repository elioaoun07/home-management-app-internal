// Explicit owner renewal, separate from immutable settings and run receipts.
// Only the authenticated Check readiness command writes this journal. Polling,
// Start's internal observations and loading the policy are read-only.
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { canonicalJson, fingerprint } from "./contracts.mjs";

export const AUTHORIZATION_REL = ".delivery/v2/authorization.json";
export const AUTHORIZATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const SCHEMA = "delivery-v2/authorization@1";
const receiptSchema = z.object({
  command_id: z.string().uuid(), actor: z.string().min(1), policy_key: z.string().min(1),
  renewed_at: z.string().datetime(), expires_at: z.string().datetime().nullable(),
}).strict();
const journalSchema = z.object({ schema: z.literal(SCHEMA), receipts: z.array(receiptSchema) }).strict();

function readJournal(root) {
  const path = join(root, AUTHORIZATION_REL);
  if (!existsSync(path)) return { schema: SCHEMA, receipts: [] };
  return journalSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

/** A renewal applies only to these exact validated owner settings. */
export function authorizedPolicy({ root, policy }) {
  const key = fingerprint(canonicalJson(policy));
  const receipts = readJournal(root).receipts.filter(receipt => receipt.policy_key === key);
  const latest = receipts.at(-1);
  const expiresAt = policy.grant.expires_at == null ? null
    : receipts.reduce((expiry, receipt) => receipt.expires_at && receipt.expires_at > expiry ? receipt.expires_at : expiry, policy.grant.expires_at);
  return { ...policy, grant: { ...policy.grant, expires_at: expiresAt },
    authorization: { key, expiresAt, renewedAt: latest?.renewed_at || null } };
}

/** Synchronous and atomic under the single local supervisor; replay never adds time. */
export function renewAuthorization({ root, policy, actor, command_id, now = new Date().toISOString() }) {
  const journal = readJournal(root);
  const prior = journal.receipts.find(receipt => receipt.command_id === command_id);
  if (prior) {
    if (prior.actor !== actor || prior.policy_key !== policy.authorization.key) throw new Error("Authorization request belongs to a different actor or policy");
    return { ...prior, repeated: true };
  }
  const until = new Date(Date.parse(now) + AUTHORIZATION_WINDOW_MS).toISOString();
  const current = policy.grant.expires_at;
  const receipt = receiptSchema.parse({ command_id, actor, policy_key: policy.authorization.key,
    renewed_at: now, expires_at: current == null ? null : current > until ? current : until });
  const path = join(root, AUTHORIZATION_REL), temp = path + "." + process.pid + ".tmp";
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(temp, JSON.stringify({ schema: SCHEMA, receipts: [...journal.receipts, receipt] }, null, 2) + "\n", { mode: 0o600 });
  renameSync(temp, path);
  return { ...receipt, repeated: false };
}

/** Extend time only for runs bound to the same settings; leave stored grants intact. */
export function renewedGrant(grant, policy) {
  if (!grant?.authorization_key || grant.authorization_key !== policy?.authorization?.key || grant.policy_revision !== policy.policy_revision) return grant;
  const expiry = policy.grant.expires_at;
  if (grant.expires_at == null || expiry == null || expiry <= grant.expires_at) return grant;
  return { ...grant, expires_at: expiry };
}
