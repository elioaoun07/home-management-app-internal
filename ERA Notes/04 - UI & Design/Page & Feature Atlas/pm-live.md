---
slug: pm-live
title: PM Live (phone Command Center over the relay)
category: utility
route: /pm/live
type: page
parent: null
children: []
status: active
tags:
  - tooling/pm-dashboard
  - tooling/delivery
  - pwa
---

# PM Live (phone Command Center over the relay)

> **Command Center Phase 4 (2026-09-12, PM Tooling R63 / Delivery DLV-104, DLV-105).** `/pm/live` mounts the **same React views as `pnpm pm`** (Home, Work, Delivery, Run, Apply) through a transport seam: locally they talk to the Node server, here to the authenticated Supabase relay the laptop bridge publishes and drains. No third UI. The earlier phone app stays reachable at `/pm/live?ui=legacy` as the rollback (and still opens V1 session links from older notifications) until real phone acceptance. Code, fixtures and a synthetic render check exist; the owner's relay migration and phone acceptance are outstanding — see [PM Relay Setup](<../../06 - Setup & Onboarding/PM Relay Setup.md>).

## Files

**Work lifecycle (2026-09-15, R65):** the shared Work page has To do / Done navigation and searchable completed outcomes; exact history links retain scope, completion evidence and available session history. UAT-pending metadata stays separate from implementation Done. Owner-only UAT rows cannot be selected for Delivery; the server rechecks eligibility on commands. Reads continue from the same-owner cached snapshot; new commands still require connectivity. Local build/browser fixtures do not certify a deployed physical phone.

- **Page**: `src/app/pm/live/page.tsx` — server wrapper; `?ui=legacy` or `?session=` → legacy `PmLiveApp`, otherwise `CommandCenterEntry`.
- **Shared app mount**: `src/app/pm/live/CommandCenterEntry.tsx` (client, `next/dynamic` with `ssr:false`) → `CommandCenterLive.tsx` (sets the relay transport, maps old `?view=` shortcuts to hash routes, imports the PM app CSS so it only loads with this chunk).
- **Shared views**: `scripts/pm/app/` — `Dashboard.tsx` (`#/dashboard`, same metrics as the laptop from the relay corpus and run rows; Command Center Phase 6), `CommandCenter.tsx`, `transport.ts` (interface, capabilities, `PendingCommand`), `DeliveryV2.tsx` (plan/questions/controls, receipts, Apply panel), `App.tsx` (connection strip on the relay).
- **Relay transport (phone)**: `src/features/pm-live/relay/transport.ts`, `commands.ts` (durable intents + receipt recovery), `cache.ts` (owner/installation/schema-bound IndexedDB copy).
- **Relay contract (both ends)**: `scripts/pm/relay-shared.mjs`; laptop cores `scripts/pm/relay.mjs`; wiring `scripts/pm/bridge.mjs`.
- **Layout / tokens**: `src/app/pm/live/layout.tsx`, `pm-live.css` (legacy view tokens, `[data-pm-live]`-scoped).
- **Legacy view (rollback)**: `src/components/pm-live/`, `src/features/pm-live/` (now owner-bound cache, full-read replace, command id before send).
- **PWA manifest**: `public/manifests/pm-live.webmanifest` — shortcuts `/pm/live#/explore?view=board` and `/pm/live#/delivery`.
- **Push endpoint**: `src/app/api/pm/notify/route.ts` (unchanged; V2 attention pushes use tag `pm-<attention key>` and open `/pm/live#/delivery/run/<id>`).
- **DB migration**: `migrations/2026-09-12_pm-v2-relay.sql` (owner-run; mirrored into `migrations/schema.sql`).
- **Tests**: `tests/pm-live-relay.test.ts`, `tests/pm-relay.test.ts`, `tests/delivery-v2/apply.test.ts`, plus the earlier `tests/pm-bridge.test.ts`, `pm-live-query.test.ts`, `pm-live-derive.test.ts`.

## Hooks

- _(none of the repo's Claude Code hooks touch this route specifically.)_

## API routes

- None called by the page. The phone reads `pm_live` and inserts `pm_commands` directly (RLS); the bridge calls `POST /api/pm/notify` and, in-process on the laptop, the local `/api/delivery/v2/*` routes with its paired bridge credential.

## DB tables

- `pm_live` — bridge-published rows. Relay v2 rows: `cc:<installation>:heartbeat | manifest | doc:<relPath> | capabilities | v1runs | v2runs | v2run:<run_id> | attention`. Legacy rows (`tasks`, `rollups`, `history`, `fleet`, `bridge`, `session:<id>`) are still published for `?ui=legacy`. After the migration: phone SELECT only.
- `pm_commands` — phone command queue. V2 types `v2-deliver | v2-decision | v2-answer | v2-message | v2-control | v2-apply` with payload `{schema, installation_id, body}`; status `pending → claimed → done | failed | unknown`. The row id is the phone-generated command id and the V2 `command_id`. After the migration: phone INSERT (pending, receipt-free) and SELECT only.

## What the phone shows

The shared V2 run uses Plan / Verification / Activity / Changes (`?tab=` in the hash), with Changes and Apply last. Plan artifacts stack below the visible plan sections on phone. Verification history, application history, usage comparison and run facts do not require disclosures. Rollback opens a Cancel-focused dialog and returns focus on dismissal. The relay carries the same optional `candidate.changed[].review` projection; a saved older payload shows an unavailable diff. No relay schema/migration changed. Physical phone and transport acceptance remain in `docs/Delivery-UAT.md`.

| Element | Source |
|---|---|
| Laptop · Ns / Offline | bridge heartbeat row, stale after 30 s |
| Ack · time · state | the last command receipt this device observed |
| Workers · Ready / Not qualified / Not configured / Unavailable / Unknown | availability the bridge last reported — `Unknown` whenever the heartbeat is stale |
| Not acknowledged / Acknowledged / Outcome unknown + Check | a command without a final receipt; Check re-reads the same id, never sends a second command |
| Apply panel | run projection: Apply (exact candidate + result version), Resume / Roll back / Recheck on an application |

Checklist writes (complete, move, ship, discard), V1 launch and V1 session detail stay at the desk; Inbox capture is relayed.

## How to get here

- `/pm/live` on the deployed app, signed in (middleware gate). Install from the phone browser; separate identity from `/pm`.
- Requires `pnpm pm --bridge` on the laptop and the owner-run relay migration for V2 commands.

## Related vault doc

- `ERA Notes/10 - Project Management/Plans/Command Center.md` (Phase 4)
- `ERA Notes/06 - Setup & Onboarding/PM Relay Setup.md`
- PM Tooling R63; Delivery DLV-104, DLV-105

## Notes

- **Outbound-only.** The bridge never listens; `pm-server` stays on `127.0.0.1`.
- **Exactly once.** The bridge journals claim → started → effected → reported in `.delivery/pm-relay/commands.ndjson`; after a crash it reports a recorded outcome or looks the command up in the supervisor store by id; if neither establishes the effect it reports `unknown`. A reset or re-sent row with an effected journal entry is reported, not run.
- **Owner- and installation-bound.** V2 commands name their installation; another laptop's stay pending. The phone cache is keyed by owner, installation and relay schema and purged on account switch.
- **No secrets in payloads.** Every published row and receipt passes a secret guard (service-role key, CRON secret, provider keys, bridge token, service-role JWTs, private keys); a document containing one is withheld and listed in the manifest.
