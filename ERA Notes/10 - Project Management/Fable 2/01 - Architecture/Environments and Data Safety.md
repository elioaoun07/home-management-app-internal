---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Source and config read; `pnpm db:verify-rls` run against the committed snapshot. The live database was not queried (Hard Rule 26)."
---

# Architecture — environments and data safety

[Fable 2 index](<../_index.md>) · related: [Delivery Local lane](<../10 - Project Management/Delivery/2 - Local Lane Design.md>), [Service-role surface](<../03 - Junction Modules/Household Sharing/Service-Role Authorization Surface.md>)

## 1. There is one environment, and it is production

- No `supabase/` directory, no local stack, no seed data, no second project named anywhere in `docs/ENV.md`.
- `pnpm dev` on the owner's machine reads the same `.env` as the deployment, including `SUPABASE_SERVICE_ROLE_KEY` (`docs/ENV.md:13`).
- Migrations are SQL the owner pastes into the production SQL editor. They are never executed anywhere first.
- No end-to-end test exists; nothing in `package.json` references Playwright as a test runner, and no checklist line plans one.
- The Command Center server itself loads the service-role key at boot: started without one it prints `[era-issues] skipped: Supabase URL and service-role key are not set in .env`.

Consequences: every local UAT is a production session; every agent session that can read the repo directory can read the production master key; no migration, RLS policy or SECURITY DEFINER function is ever tried before it is live. This single fact is why Delivery grew a container boundary, and it is cheaper to fix at the source.

**Disposition:** [DLV-154](<../../Delivery/Delivery — Master Book.md#dlv-154>) (disposable development database). Existing HUB-60 (household export and verified restore) covers backup; it is in Later and should move up with it.

## 2. Hard Rule 26 is enforced by name, and the names differ per surface

`.claude/settings.json:8-19` denies twelve tools named `mcp__claude_ai_Supabase__*` plus `supabase`, `psql` shell prefixes. In a Claude Code cloud session the same connector's tools are named `mcp__Supabase__*` (observed in this session's tool list: `mcp__Supabase__execute_sql`, `mcp__Supabase__apply_migration`, `mcp__Supabase__deploy_edge_function`, the `*_branch` tools). None of those names is in the deny list, so in a cloud session the only thing between an agent and a production write is the text of the rule.

No Supabase tool was called in this session.

**Disposition:** [R84](<../../PM Tooling/PM Tooling — Master Book.md#r84>), blocker. Deny both namespaces, add `curl`/`node -e` patterns for the project host if practical, and record the list in `Database RLS Posture.md` §Agent access.

## 3. The RLS evidence the rules depend on is 97 days old

`pnpm db:verify-rls` on the committed `migrations/db-state.json`:

- **FAIL — snapshot is 97 days old.** Hard Rule 27 makes this file "the only repo artifact that counts as evidence about RLS".
- **FAIL — RLS disabled on 2 tables: `guest_drinks`, `item_prerequisites`** (as of the snapshot). Any authenticated user can read and write them through PostgREST whatever the routes check.
- **NOTE — service-role-only tables (RLS on, no policies):** `default_categories`, `guest_allergies`, `guest_chat_messages`, `guest_feedback`, `guest_sessions`.

Whether these are still true is unknown from the repo. Existing R43 (Now, blocker) owns hot-child RLS verification; the refresh itself is an owner step: run `migrations/db-state.sql` and commit the output. Every "X can't see Y" investigation until then starts from stale evidence.

## 4. Authorization lives in route code for 43 routes

43 non-cron API routes create a service-role client, which bypasses RLS; each one re-implements its own ownership check. The sweep's M3 (BUD-91) is four of them getting it wrong. Details and the proposed contract test: [Service-Role Authorization Surface](<../03 - Junction Modules/Household Sharing/Service-Role Authorization Surface.md>), item [R90](<../../PM Tooling/PM Tooling — Master Book.md#r90>).

## 5. One authenticated money read is marked publicly cacheable

`GET /api/transactions` returns `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Details: [Shared-Cache Header on the Transactions Read](<../02 - Standalone Modules/Transactions/Shared-Cache Header on the Transactions Read.md>), item [BUD-95](<../../Budget/Budget — Master Book.md#bud-95>).

## Order of work

R84 first (minutes, closes a live gap). BUD-95 second (one line plus a test). Then the snapshot refresh (owner), DLV-154, R90.
