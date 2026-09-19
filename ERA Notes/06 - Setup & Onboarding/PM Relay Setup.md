---
created: 2026-09-12
updated: 2026-09-12
type: runbook
status: active
owner: Elio
---

# PM Relay Setup — phone Command Center

Owner steps for Command Center Phase 4 ([Delivery DLV-104](<../10 - Project Management/Delivery/Delivery — Master Book.md#dlv-104>), [DLV-105](<../10 - Project Management/Delivery/Delivery — Master Book.md#dlv-105>), [PM Tooling R63](<../10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r63>)). The code is in the repository; nothing below has been run by an agent.

## 1. Database (manual, once)

1. Supabase SQL Editor → run **section 0** of `migrations/2026-09-12_pm-v2-relay.sql`. Keep the untruncated output.
2. Check the STOP conditions under section 0. If one applies, stop and bring the output back.
3. Run sections 1–5 (one transaction), then section 6 and compare with its expected result.
4. Record both outputs under DLV-77 and DLV-104.

Until this runs: V2 commands from the phone are refused by the old `pm_commands.type` CHECK, and an unknown outcome is stored as `claimed` with `result.outcome_unknown`.

## 2. Laptop

| Step | Command / file | Check |
|---|---|---|
| Env | `.env`: `PM_OWNER_USER_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL` | `pnpm pm --bridge` prints `[pm-bridge] started — installation inst-…` |
| One drainer | only one `pnpm pm --bridge` per checkout | a second one prints `disabled — another bridge (pid …)` |
| V2 mode | `.delivery/v2/dispatch-mode.json` → `v2` (existing switch) | Delivery launch offers Claude/Codex |
| Policy + runtime | `.delivery/v2/execution-policy.json` with a container `runtime`; optional `apply.protectedPaths` | phone status strip shows `Workers · Ready` only when an executor qualifies |
| Keep awake | the laptop must stay on and connected | a sleeping laptop shows `Laptop · Offline` and `Workers · Unknown` |

Relay state on the laptop (gitignored): `.delivery/pm-relay/installation.json`, `commands.ndjson` (claim → started → effected → reported), `attention.json`, `bridge.lock`. Apply journals and backups: `%LOCALAPPDATA%/era-delivery-v2/<hash>/applications/`.

## 3. Phone

1. Open `/pm/live` signed in as the owner. Add to Home Screen (manifest `pm-live.webmanifest`).
2. Allow notifications (existing push subscription).
3. Rollback view: `/pm/live?ui=legacy` (the earlier relay UI; V1 session links open there).

## 4. Acceptance to record (real phone, real laptop)

Record each under DLV-104 / DLV-105 / R63 with date and what was observed. Synthetic tests do not count here.

- [ ] Launch a chosen executor on a real item from a 390 px phone.
- [ ] Revise a plan, then approve the new revision; answer a blocking question.
- [ ] A waiting plan or result arrives as one notification per revision.
- [ ] Airplane mode on and off during a run: stale reading shown, receipts recovered, no duplicate command.
- [ ] Double-tap Approve: one decision in the run.
- [ ] Kill `pnpm pm` between a command's effect and its receipt; restart: the same command is reported, not re-run.
- [ ] Sleep the laptop: `Laptop · Offline`, `Workers · Unknown`.
- [ ] Sign in as another account on the phone: none of the owner's work appears.
- [ ] Edit an affected file from the CLI during a run, then Apply: conflict, nothing written, edit intact.
- [ ] Apply a verified candidate: files written, integrated checks in the checker, `Applied`; Roll back restores.
- [ ] Inspect a phone payload (browser devtools on `/pm/live`): no service-role key, CRON secret, provider key or bridge token.

## Not authorized by this setup

Apply writes files only. It does not reset, merge, commit, push, deploy or touch any database; a candidate's migration SQL is written as a file for the owner to run.
