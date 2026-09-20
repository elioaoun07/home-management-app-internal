---
created: 2026-09-20
updated: 2026-09-20
type: research
status: active
owner: Elio
---

# AI Reading Guides — coverage record

Record for the `- **Reading guide:**` bullets added to every campaign Master Book's Acceptance Criteria Index on 2026-09-20. Documentation only; no runtime behaviour changed, no item implemented.

*(Started as the Delivery-only record; extended to all eleven campaigns in the same session. Filename kept so existing links do not break.)*

## Where the guides live

One bullet per open item, inside that item's `### <ID>` section in its campaign Master Book, beside the existing acceptance/evidence/provenance. Checklists keep their one-line-per-outcome grammar; each campaign's intro line now says the ID link also carries the reading guide. `pnpm pm:lint` passes (0 errors, 0 warnings).

Each guide names stable code symbols (functions, exported constants, components) rather than line numbers, points at relevant tests and skills, and states which existing behaviour must be preserved. Where the direction is genuinely undecided — items held for a DEC, or parked — the guide gives an investigation starting point and says so instead of inventing a design.

## Coverage — 237 of 237 open items

| Campaign | Open | Guides |
| --- | ---: | ---: |
| Budget | 33 | 33 |
| Schedule | 31 | 31 |
| Kitchen | 21 | 21 |
| Trips | 19 | 19 |
| Hub & ERA | 41 | 41 |
| Notifications & Alerts | 12 | 12 |
| PM Tooling | 17 | 17 |
| Outfits | 12 | 12 |
| Healthcare | 17 | 17 |
| Native App | 8 | 8 |
| Delivery | 26 | 26 |
| **Total** | **237** | **237** |

Counts verified by comparing `grep -c "^- \[ \] \*\*"` on each `4 - Checklist.md` against `grep -c "Reading guide:"` on its Master Book. Completed, cancelled and superseded work was not touched; `_Archive/` was never read or modified. There are no unfinished sub-items — `_Conventions.md` §1 permits top-level checkboxes only, and the detail sections carry none.

One new section was created: `### DLV-134`, which was checklist-only. Its outcome, kind and `Touches` are taken from the checklist line; **its acceptance wording is inferred** from DLV-119's constraints and should be confirmed or replaced by the owner.

## Findings surfaced while verifying

Each was confirmed in code and folded into the relevant guide rather than filed separately. Several are live defects whose exact location was previously only described in prose.

- **NOTIF-19** — `quiet_start`/`quiet_end` exist in `src/app/api/notifications/preferences/route.ts`'s Zod schema and are read **nowhere else in `src/`**. The preference is stored and ignored. Eight real producers call `sendPushToUser`.
- **KIT-11** — `src/app/api/recipes/[id]/cooking-log/route.ts` issues a `{ count: "exact", head: true }` query (body is null by design) and then reads `(countData as any)?.length ?? 1`. That is the wrong-count bug, exactly.
- **KIT-10** — the "four documented writers" undercounts: ten routes touch ingredients and **none imports zod** (Hard Rule #12).
- **KIT-14** — `useUpdateStock()` has no caller anywhere in `src/`. The documented wrong-ID bug is unreachable, which is the evidence the acceptance asks for.
- **KIT-18** — `src/app/api/catalogue/document-image/signed-url/route.ts` authorizes by splitting a caller-supplied `?path=` string, not via the owning record.
- **KIT-20** — `src/app/api/catalogue/items/[id]/route.ts` PATCH assigns `metadata_json` wholesale, with no Zod and no revision precondition.
- **BUD-68** — `src/app/api/debts/route.ts` **GET** performs an `.update({ status: "archived", ... })` before its select. Write-on-read, confirmed.
- **BUD-69** — the unsupported assumption is a literal `const frontLoadPercentage = 0.55;` in `src/app/api/future-purchases/[id]/analysis/route.ts`.
- **SCH-4.3b** — **three** expansion paths coexist: `expandOccurrencesForRange` (`src/lib/schedule/`), `expandOccurrencesInRange`/`getOccurrencesForDay` (`src/lib/utils/dayOccurrences.ts`), and an inline RRule loop in `WebCalendar.tsx`. `WebTodayView` and `WebDayPlanner` import two of them at once.
- **SCH-5.3** — `MobileItemForm.tsx` has no importer anywhere in `src/`. Strong evidence for "retire", but the acceptance wants the decision recorded, not inferred.
- **SCH-5.5** — `missingFieldType` no longer exists in the file; that sub-item is already done. Undo is genuinely absent (zero occurrences of "Undo" in the form).
- **SCH-9** — the asymmetry has a home: `src/app/api/items/route.ts` auto-creates a default push alert in its `else if (body.due_at)` branch, which replay hits and an explicit-empty-`alerts` online body skips.
- **HUB-37** — `.github/workflows/` contains only `check-docs-sync.yml`. There is no typecheck/test/lint CI; that half is net-new.
- **HUB-38** — no cron ledger exists (`cron_runs`/`last_run` appear nowhere under `src/app/api/cron/`).
- **HUB-48** — `ERA_CAPABILITIES` holds 13 entries and no `analysis.report`.
- **HUB-16 / HUB-5** — `HubPage.tsx` is 6,275 lines (the line-count-must-go-down rule is measurable against that).
- **TRIP-35** — TRIP-34 shipped `trip_id` on the *edit* route only; `src/app/api/transactions/route.ts` never mentions it, so the create path needs widening.
- **TRIP-1/2/3/30** — `trip_side_effects` appears nowhere in `src/`: every cascade is written inside the `activate_trip` / `complete_trip` RPCs, whose bodies exist only in `migrations/db-state.json`.
- **DLV-118** — `journey.mjs instructionFor()` passes `profile` to `implementationInstruction` but not to `investigationInstruction`, so every run investigates as `investigate`.
- **DLV-111** — `scripts/delivery-v2/credential-sync.mjs` (untracked, dated 2026-09-19) already implements the desktop half.
- **DLV-123 (1) / PM-wide** — `cleanInlineText()` in `scripts/pm/shared/text.mjs` strips underscores for *every* PM title reader, not just Delivery run titles.
- **OUT-16** — `src/lib/prerequisites/evaluators/weather.ts` exists but is a stub returning `met: false`; so is `time-window.ts` (SCH-4.4).
- **R36** — `scripts/pm/shared/` now holds twelve files, not the five the acceptance names, and **no file in `scripts/pm/` carries `@ts-check`**, including the `lint.mjs` called the template.
- **R61** — `_Planning.json` does not exist and nothing references it, but `metrics.mjs` already exports `sprintProgress(planning)` expecting one.
- **R6** — the legacy rollback files (`client.js`, `styles.css`, `body.html`) and the `?ui=old` hatch in `ui.mjs` are all still present.
- **SCH-4.5** — `useItems.ts` is 2,670 lines and lives at `src/features/items/`, not the quoted ~2,621 in `src/hooks/`.

## Does Delivery supply this guidance to the worker at launch?

**Partly, and by accident of an existing mechanism rather than by design.**

- `journey.mjs instructionFor()` → `interaction.mjs investigationInstruction({contract, alias, acceptance, …})` builds the first worker prompt from the contract outcome plus `acceptance`.
- `acceptance` comes from `journey.mjs acceptanceNow(ctx)` → `work-ref.mjs acceptanceText({bookRaw, alias})`, which returns **the entire body of the Master Book `### <ID>` section**, not just the `- **Acceptance:**` bullet.
- So a reading guide written into that section *is* delivered to the worker on the investigation turn, verbatim. No new integration is required for that turn.

Gaps, reported not fixed:

1. **Implementation and repair turns do not get it.** `implementationInstruction()` and `repairInstruction()` take `plan` and `contract` but never `acceptance`, so the guide reaches the planner and not the builder. Whether that is wanted is a design question.
2. **It is undifferentiated prose.** The guide arrives inside one acceptance blob; nothing labels it as orientation rather than a pass condition, and nothing bounds its length against the token work in DLV-118.
3. **It moves the acceptance fingerprint.** `work-ref.mjs acceptanceRevision()` fingerprints the same section body and `recheckContractSource()` compares it against a frozen contract. Editing any `### <ID>` section therefore registers as acceptance drift on a run already frozen against it. At the time of writing the only waiting run is DLV-90's `r-8e7f635c1466`; a drift report on it is caused by this documentation change, not by a source change.
4. **Nothing validates the guides.** No lint checks that a cited symbol still exists; `pnpm pm:lint` only checks checklist grammar. A guide can rot silently.

## Unresolved or unverifiable references

- **Anchor collisions in generated links (pre-existing, not introduced here).** `NOTIF-2.1` and `NOTIF-21` both render as `#notif-21`; `SCH-1.9` and `SCH-19` both render as `#sch-19`. The guides were inserted by exact heading match so they landed correctly, but the checklist's `[criteria]` links for those four items are ambiguous.
- **`.tmp/delivery-review-*.mjs|log`** (cited as DLV-108/109 probe receipts) were not checked; `.tmp/` is not committed.
- **DLV-52 / DLV-84 counts** were **not** re-measured — `pnpm lint` and `pnpm typecheck` were not run in this session. Both guides say to re-measure first. The same applies to the historical counts in R47 (202 sites), R46 (113/170) and R48 (98/13/8).
- **Deployment and DB state** are outside the repo throughout. Every guide that touches RLS, policies, triggers or applied migrations routes to `migrations/db-state.json` per Hard Rule #27 and to the owner per #26; none was verified against the live database.
- **Owner-executed items** (NAT-1, NAT-5, HUB-21, HUB-66, TRIP-1/2/3/18/32, OUT-19, HLTH-7/12, BUD-36/39/67, NOTIF-6.6) have no code deliverable; their guides say what to read to interpret a result, not what to change.
- **Held-for-decision items** (DEC-01…DEC-23 across NOTIF-5.4/20, OUT-21/22, KIT-1/2, BUD-72/73/75/76, HUB-65/68, R45, DLV-89, TRIP-30) resolve to `_Decisions.md` entries, not edits. Their guides say so.
- **Master Book sections with no open checklist item** — e.g. Delivery's DLV-96/97/98/99/92, PM Tooling's R54/R60 — were deliberately left alone.

## Remaining work

- Owner to confirm or replace the inferred DLV-134 acceptance wording.
- Decide whether the guide should also reach implementation/repair turns (feeds DLV-118).
- Expect one acceptance-drift report on Delivery run `r-8e7f635c1466` from this edit.
- The four ambiguous `#notif-21` / `#sch-19` anchors are worth disambiguating in a later pass.
