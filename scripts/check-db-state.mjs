#!/usr/bin/env node
// Validates migrations/db-state.json — the committed snapshot of live DB state
// that migrations/schema.sql structurally cannot express (RLS, policy bodies,
// cascade rules, SECURITY DEFINER functions).
//
// Exists because CLAUDE.md Hard Rule #27 needs a source of truth that can be
// *wrong out loud*. A rule depends on being read; this fails.
//
//   pnpm db:verify-rls            warn only, always exit 0
//   pnpm db:verify-rls --strict   exit 1 on findings (for pre-commit / CI)
//
// Regenerate the snapshot with migrations/db-state.sql (owner runs it; per
// Hard Rule #26 no agent ever touches the live DB).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = join(root, "migrations", "db-state.json");
const STALE_WARN_DAYS = 30;
const STALE_FAIL_DAYS = 90;

const strict = process.argv.includes("--strict");
const problems = [];
const warnings = [];
const notes = [];

if (!existsSync(snapshotPath)) {
  console.log(
    [
      "No migrations/db-state.json yet.",
      "",
      "  1. Open Supabase SQL Editor",
      "  2. Paste migrations/db-state.sql and Run",
      "  3. Save the JSON result over migrations/db-state.json",
      "",
      "Until then, nothing in this repo can answer a question about RLS,",
      "cascade rules, or SECURITY DEFINER behaviour (Hard Rule #27).",
    ].join("\n"),
  );
  process.exit(strict ? 1 : 0);
}

// Accept every shape the Supabase SQL Editor produces, so the owner can save the
// downloaded result verbatim and never hand-edit a 400KB file:
//   {...}                         — the object itself (copied from the cell)
//   [{ "db_state": "{...}" }]     — "Download JSON" (jsonb comes back as a STRING)
//   [{ "db_state": {...} }]       — some clients unwrap it for you
function unwrap(parsed) {
  let v = parsed;
  if (Array.isArray(v)) {
    if (!v.length) return null;
    v = v[0];
  }
  if (v && typeof v === "object" && !Array.isArray(v) && !v.tables) {
    const keys = Object.keys(v);
    if (keys.length === 1) v = v[keys[0]];
  }
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

let snap;
try {
  snap = unwrap(JSON.parse(readFileSync(snapshotPath, "utf8")));
} catch (err) {
  console.error(`migrations/db-state.json is not valid JSON: ${err.message}`);
  console.error("Re-run migrations/db-state.sql and save the full result.");
  process.exit(1);
}

if (!snap || !Array.isArray(snap.tables)) {
  console.error(
    "migrations/db-state.json parsed, but has no `tables` array — it does not look like db-state.sql output.\n" +
      "Re-run migrations/db-state.sql and save the whole result (the wrapper array is fine).",
  );
  process.exit(1);
}

const tables = snap.tables ?? [];
const policies = snap.policies ?? [];
const functions = snap.functions ?? [];
const foreignKeys = snap.foreign_keys ?? [];

// ── Freshness ──────────────────────────────────────────────────────────────
const generatedAt = snap.generated_at ? new Date(snap.generated_at) : null;
let ageDays = null;
if (generatedAt && !Number.isNaN(generatedAt.valueOf())) {
  ageDays = Math.floor((Date.now() - generatedAt.valueOf()) / 86_400_000);
  if (ageDays >= STALE_FAIL_DAYS) {
    problems.push(
      `Snapshot is ${ageDays} days old (>= ${STALE_FAIL_DAYS}). Treat it as historical, not current — re-run migrations/db-state.sql before reasoning about RLS.`,
    );
  } else if (ageDays >= STALE_WARN_DAYS) {
    warnings.push(`Snapshot is ${ageDays} days old. Consider re-running migrations/db-state.sql.`);
  }
} else {
  warnings.push("Snapshot has no usable generated_at — cannot assess freshness.");
}

// ── Check 1: RLS on with zero policies = the table is invisible to everyone ──
const policiesByTable = new Map();
for (const p of policies) {
  if (!policiesByTable.has(p.table)) policiesByTable.set(p.table, []);
  policiesByTable.get(p.table).push(p);
}

// "RLS on + no policies" = deny-all to clients; only the service role can read.
// That is usually DELIBERATE hardening (the guest_* tables are exactly this —
// reached only via supabaseAdmin), so it is a note, not a failure. It is only a
// bug if app code reaches the table with a user session, which this script
// cannot see. Ranking it FAIL trains you to ignore the tool.
const lockedDown = tables
  .filter((t) => t.rls_enabled && !policiesByTable.has(t.table))
  .map((t) => t.table);
if (lockedDown.length) {
  notes.push(
    `Service-role-only (RLS on, no policies) — correct IF every access uses supabaseAdmin(); a silent empty result if any route uses a user session:\n    ${lockedDown.join(", ")}`,
  );
}

// ── Check 2: RLS disabled = open to ANY authenticated user via PostgREST ────
// This is the genuinely dangerous state: route-level checks are bypassable by
// querying PostgREST directly with the anon key and any logged-in session.
const rlsOff = tables.filter((t) => !t.rls_enabled).map((t) => t.table);
if (rlsOff.length) {
  problems.push(
    `RLS DISABLED on ${rlsOff.length} table(s) — readable AND writable by any authenticated user through PostgREST, regardless of what your API routes check:\n    ${rlsOff.join(", ")}`,
  );
}

// ── Check 3: rls_forced breaks the SECURITY DEFINER bypass this app relies on ─
const forced = tables.filter((t) => t.rls_forced).map((t) => t.table);
if (forced.length && functions.some((f) => f.security_definer)) {
  warnings.push(
    `FORCE ROW LEVEL SECURITY is on for: ${forced.join(", ")}. SECURITY DEFINER functions do NOT bypass RLS on these tables — verify any *_bundle/RPC that reads them.`,
  );
}

// ── Check 4: RESTRICTIVE policies can veto permissive ones ──────────────────
const restrictive = policies.filter((p) => String(p.permissive).toUpperCase() === "RESTRICTIVE");
if (restrictive.length) {
  warnings.push(
    `${restrictive.length} RESTRICTIVE policy(ies) present — these are AND'd and can veto permissive policies. Adding a permissive policy will NOT grant access past them:\n    ${restrictive.map((p) => `${p.table}.${p.policy}`).join(", ")}`,
  );
}

// ── Check 5: drift between the snapshot and schema.sql ─────────────────────
const schemaPath = join(root, "migrations", "schema.sql");
if (existsSync(schemaPath)) {
  const schemaSql = readFileSync(schemaPath, "utf8");
  const inSchema = new Set(
    [...schemaSql.matchAll(/CREATE TABLE public\.(\w+)/g)].map((m) => m[1]),
  );
  const missing = tables.map((t) => t.table).filter((t) => !inSchema.has(t));
  if (missing.length) {
    warnings.push(
      `In the live DB but absent from schema.sql — schema.sql is stale:\n    ${missing.join(", ")}`,
    );
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
const secDef = functions.filter((f) => f.security_definer);
const cascades = foreignKeys.filter((f) => f.on_delete === "CASCADE");

console.log("DB state snapshot" + (ageDays === null ? "" : ` (${ageDays}d old)`));
console.log(
  `  ${tables.length} tables · ${tables.filter((t) => t.rls_enabled).length} with RLS · ` +
    `${policies.length} policies · ${secDef.length} SECURITY DEFINER fn · ${cascades.length} ON DELETE CASCADE FKs`,
);

for (const n of notes) console.log(`\n  NOTE  ${n}`);
for (const w of warnings) console.log(`\n  WARN  ${w}`);
for (const p of problems) console.log(`\n  FAIL  ${p}`);

if (!notes.length && !warnings.length && !problems.length) console.log("\n  No findings.");

process.exit(problems.length && strict ? 1 : 0);
