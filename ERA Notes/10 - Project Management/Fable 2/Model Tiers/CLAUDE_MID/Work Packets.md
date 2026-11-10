---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Packets are proposals; the checklists own priority."
---

# CLAUDE_MID — work packets

[Routing rules](<../_Routing.md>) · [Fable 2 index](<../../_index.md>)

Use this tier when the pattern already exists in the repository and the item names it. Every packet below points at the file to copy from.

| Packet | Items | Copy the pattern from | Review before ship |
|---|---|---|---|
| M1 Guest Portal authentication | HUB-118, then HUB-122 | Any authenticated route: `src/app/api/accounts/route.ts`; tests like `src/app/api/activity-log/route.test.ts` | Yes: auth boundary |
| M2 Money undo and authorization | BUD-89, BUD-91 | ERA's restore call for undo; `getAccessibleAccount` in `src/lib/accountAccess.ts` | Yes: money |
| M3 Money input and dates | BUD-94, BUD-93 | Zod schemas in `src/app/api/transfers/route.ts`; `localDate` handling in `src/app/api/era/ask/route.ts` | Yes: money |
| M4 Alert claim | NOTIF-23 | Conditional update returning the row, as described in the sweep's N1 fix | Yes: cron |
| M5 Command Center Home and Sprints | R86, R87 | Existing views in `scripts/pm/app/` and `scripts/pm/shared/planning.mjs`; tests in `tests/pm-ui/` | No |
| M6 Three-check Start | DLV-151 | `scripts/pm/app/LaunchReadiness.tsx`, `scripts/delivery-v2/readiness-contract.mjs` | No, tooling |
| M7 Master Book budget | R89 | `_Conventions.md` §6 retention rule; `scripts/pm/archive.mjs` | No, but run `pm:lint` and `pm:check-docs` |
| M8 Proxy decision | R83 | The sweep's S3 fix text | Yes: auth path; owner decides merge or delete first |
| M9 Authorization contract rows | R90, after the high tier lands the first five | The first five rows | No |

## Rules for this tier

- Read the item's criteria section and the linked Fable 2 or sweep section. Nothing else from PM.
- Load the playbook the item's domain requires (`money-rules`, `api-route`, `ui-guardrails`, `timezone-handling`).
- If the named pattern file does not do what the packet says, stop and report; do not design a replacement.
- A packet marked "Review before ship" is not shipped on green checks alone.
