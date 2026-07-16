---
created: 2026-07-15
updated: 2026-07-15
type: reference
status: living
owner: Elio
tags:
  - pm/reference
  - pm/conventions
---

# PM Command Center — Item Conventions

> **What this file is:** the single grammar every campaign checklist item and done-stamp follows, so the `pnpm pm` Task board can show all campaigns in one consolidated view and you can jump item → item. **Enforced by `pnpm pm:lint`.** The parser homes are `scripts/pm/shared/tasks.mjs` (dashboard) and `scripts/delivery/packet.mjs` (delivery) — change both in lockstep if the grammar ever moves.

---

## 1. Checklist item (in `<Campaign>/4 - Checklist.md` only)

```
- [ ] **PREFIX-n** Clear, verifiable outcome → target _(severity - effort)_
```

- **`- [ ]` / `- [x]`** — open / done. Indent 0, directly under a lane heading. Sub-points are plain `-` bullets, never nested checkboxes (a nested `- [ ]` becomes its own board task with no lane).
- **`**PREFIX-n**`** — the ID chip. `PREFIX` is the campaign's (table below); `n` is the next free integer for that prefix. Sub-items of a shipped parent use `.n` (`SCH-1c.1`); variants use a trailing lowercase letter (`SCH-4.3b`). IDs are **never reused**.
- **body** — the outcome, phrased so "done / not done" is unambiguous. Provenance goes in parentheses at the **start** of the body (`(Phase 4) Universal placement-rule guard test …`), never in the meta suffix.
- **`→ target`** (optional) — where the work lives:
  - a doc: `→ [Overview](<../../02 - Standalone Modules/Trips/Overview.md>)` (angle-bracket relative markdown link — resolves in-app + backlinks + lint-checkable)
  - code: `` → `src/app/api/cron/daily-items-reminder/route.ts` `` (backticked repo-relative path, optional `:line` — renders as a source-preview chip)
- **`_(severity - effort)_`** — required trailing meta. Exactly one space – hyphen – space between the two words.

### Vocabulary

| Severity | Meaning | Feature-State emoji |
|---|---|---|
| `blocker` | must fix; blocks the campaign | 🔴 |
| `friction` | real drag on daily use | 🟠 |
| `annoyance` | minor; would be nice | 🟡 |
| `parked` | deferred on purpose | ⚪ |

| Effort | Rough size |
|---|---|
| `S` | ≤ half a day |
| `M` | 1–2 days |
| `L` | 3+ days |

**No ranges** (`S-M` is invalid — round **up** to `M`). **No `H`** (the parser never understood it — use `L`). Severity is **always** a lowercase word, never an emoji, inside the meta tag.

### Valid / invalid

```
✅  - [ ] **NOTIF-1.2** Update the cron to the new type → `src/app/api/cron/daily-items-reminder/route.ts` _(blocker - S)_
✅  - [x] **BUD-1** Merchant-match voice drafts _(annoyance - S)_
✅  - [ ] **SCH-1c.1** (Phase 1c) Wire one-line → structured item via Gemini _(friction - M)_

❌  - [ ] **N1** … _(🔴 · M)_          emoji + middle-dot in meta
❌  - [ ] **1.2** …  _(S)_             no campaign prefix; severity missing
❌  - [ ] **BUD-3** … _(annoyance - S-M)_   effort range
❌    - [ ] nested under a lane item    nested checkbox
```

---

## 2. Lanes

Exactly one each, H2, this exact text, in this order:

```
## Now      — in flight / next up this cycle
## Next     — queued after Now clears
## Later    — real but deferred
## Definition of Done   (optional, after Later)
```

- **No headings inside a lane.** Any heading resets the board's section, so phase/round context is written as a **bold paragraph** (`**Phase 4 — foundational hardening** *(carried)*`) or a `> ⚠️ …` blockquote, never as `###`.
- **Definition of Done** items use `**D1**, **D2**, …` (prefix-exempt; they stay off the board by design).
- **No `## Done` lane.** Sweep instead: tick `[x]`; at the next touch, move the record to `1 - Feature State.md` with a dated stamp (§3) and delete the checklist line. Git history + `1 - Feature State.md` are the archive.

---

## 3. Feature State stamp (in `1 - Feature State.md`)

```
✅ YYYY-MM-DD
✅ YYYY-MM-DD (`src/lib/balance.test.ts`)     ← with evidence
```

One space after `✅`, ISO date, optional backticked evidence path in parentheses. Pain / gap bullets keep the **emoji** severity lead (`🔴 |🟠 |🟡 |⚪ ` at line start) — the dashboard Rollups reads those. In `2 - Vision & Roadmap.md`, a realized decision is marked `*(IMPLEMENTED YYYY-MM-DD)*` (Hard Rule 25).

---

## 4. Cross-campaign references

Link by name **and** cite the target ID in prose:

```
Coordinate with [Hub & ERA · 4 · Checklist](<../Hub & ERA/4 - Checklist.md>) (HUB-10).
```

IDs are per-campaign, so always name the campaign — `L1` alone is ambiguous across folders.

---

## 5. Campaign ID prefixes

| Campaign folder | Prefix |
|---|---|
| `Budget/` | `BUD` |
| `Schedule/` | `SCH` |
| `Kitchen/` | `KIT` |
| `Trips/` | `TRIP` |
| `Hub & ERA/` | `HUB` |
| `Notifications & Alerts/` | `NOTIF` |
| `PM Dashboard Refactor/` | `R` (grandfathered) |
| `Delivery Workspace/` | `DW` |

---

## 6. Enforcement & tooling

- **`pnpm pm:lint`** — validates the seven checklists above: grammar, lanes, ID prefix + uniqueness, and that every `→` link resolves. Run it after editing any `4 - Checklist.md` (finish-task Gate E).
- **`pnpm pm`** — the consolidated Task board / table. Every parseable item shows with ID / severity / effort chips, filterable (`m:Budget s:blocker is:open`), click-through to the exact doc line.
- **Hidden layers** — `FABLED/`, `FABLED 2/`, `FABLED+ Enhancement Study/`, and any doc with frontmatter `status: superseded | baseline-frozen | template` are hidden from the board's default view (toggle "FABLED / archived" to reveal). They are reference/audit layers, not execution queues.
