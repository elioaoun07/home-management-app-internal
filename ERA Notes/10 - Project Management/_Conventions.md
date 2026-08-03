---
created: 2026-07-15
updated: 2026-08-01
type: reference
status: living
owner: Elio
tags:
  - pm/reference
  - pm/conventions
---

# PM Command Center — Item Conventions

> **What this file is:** the single grammar every campaign checklist item and done-stamp follows, so the `pnpm pm` Task board can show all campaigns in one consolidated view and you can jump item → item. **Enforced by `pnpm pm:lint`.** The parser homes are `scripts/pm/shared/tasks.mjs` (dashboard) and `scripts/delivery/packet.mjs` (delivery) — change both in lockstep if the grammar ever moves.
>
> **Campaign layout (2026-07-30):** every campaign folder holds exactly two files — `<Campaign> — Master Book.md` (state, shipped log, pains, vision, acceptance criteria, successor briefing) and `4 - Checklist.md` (the working queue). Everything superseded lives in `_Archive/`, which no PM tool scans.

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
- **No `## Done` lane.** Sweep instead: tick `[x]`; the record moves to the campaign's **Master Book › Shipped Log** with a dated stamp (§3) and the checklist line is deleted. Git history + the Shipped Log are the archive. **The sweep is automated — see §2.1.**

### 2.1 Sweep & discard (automated)

Two ways an item leaves a checklist. Both are reversible.

| Action | Where the item goes | How to trigger |
|---|---|---|
| **Ship** (item is `[x]`) | Master Book › **Shipped Log**, `- ✅ YYYY-MM-DD — **ID** text` (§3) | 🗄 icon on the checklist row / **Ship** on the task card · `pnpm pm:archive` · the monthly auto-sweep |
| **Discard** (any state) | `_Archive/Cancelled Log.md`, under a `## <Campaign>` heading, `- ❌ YYYY-MM-DD — **ID** text _(cancelled: reason)_` | 🚫 icon on the checklist row / **Discard** on the task card |

- **Monthly auto-sweep.** The first `pnpm pm` boot of each calendar month ships every ticked item in every `4 - Checklist.md`, then stamps `.pm/archive-stamp.json` (gitignored) so it runs once per month. The console prints what moved.
- **Dates are git-derived, not "today".** Each swept line is binary-searched through the checklist's recent history for the commit where it first appears as `[x]`, so a monthly sweep doesn't flatten four weeks of work onto the 1st. Uncommitted ticks (and anything git can't answer) fall back to today.
- **Definition of Done items are never swept.** `**D1**, **D2**, …` are acceptance criteria: ticking one records a fact about the campaign, so the sweep skips that lane entirely.
- **Undo.** The dashboard shows an Undo toast that restores every touched file byte-for-byte (including deleting a Cancelled Log the first Discard created). For the CLI/auto sweep: `pnpm pm:archive --undo`. Preview first with `pnpm pm:archive --dry-run`.
- **Cancelled work is invisible to tooling, not lost.** `_Archive/` is skipped by `scan.mjs`, so a discarded item leaves the board, the burndown and the linter — but stays readable, greppable, and one Undo (or one `git revert`) from coming back.
- Engine: `scripts/pm/archive.mjs` (pure helpers + fs ops + CLI), server ops `ship` / `discard` / `restore` in `scripts/pm-server.mjs`, tests in `tests/pm-ui/archive.test.ts`.

---

## 3. Shipped Log stamp (in `<Campaign> — Master Book.md`)

```
✅ YYYY-MM-DD
✅ YYYY-MM-DD (`src/lib/balance.test.ts`)     ← with evidence
```

One space after `✅`, ISO date, optional backticked evidence path in parentheses. Shipped Log lines carry the ID chip too — `- ✅ 2026-07-18 — **BUD-12** deleted the debug routes` — so the burndown can attribute them.

Three formats in a Master Book are **parser-load-bearing**, so keep them exactly:

| Section | Format | Read by |
|---|---|---|
| `## Shipped Log` | `- ✅ YYYY-MM-DD — **ID** text` | the completion-history snapshot (velocity / burndown) |
| `## Pain Inventory` | bullets with an **emoji** severity lead (`🔴 🟠 🟡 ⚪`) at line start | the Bugs view + per-campaign rollups |
| `## Acceptance Criteria Index` | `### <ID>` followed by `- **Acceptance:** …` bullets | the delivery flight check's pre-launch criteria |

In the Master Book's **Vision & Decisions** section, a realized decision is marked `*(IMPLEMENTED YYYY-MM-DD)*` (Hard Rule 25).

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
| `Healthcare/` | `HLTH` |
| `PM Tooling/` | `R` (grandfathered) |
| `Delivery/` | `DLV` |
| `Outfits/` | `OUT` |

`Native App/` is a plan pack with no checklist and no prefix yet — register `NAT` here, add it to `CAMPAIGNS` in `scripts/pm/lint.mjs`, and create the checklist from `_Templates/` when work starts.

**Retired prefixes (never reused):** `DW` (Delivery Workspace — merged into `Delivery`, 2026-07-30).

The prefix table and `CAMPAIGNS` in `scripts/pm/lint.mjs` must agree. Renaming a campaign folder means editing both **and** every relative link that points into it, in the same pass.

---

## 6. Enforcement & tooling

- **`pnpm pm:lint`** — validates the ten checklists above: grammar, lanes, ID prefix + uniqueness, and that every `→` link resolves. Run it after editing any `4 - Checklist.md` (finish-task Gate E).
- **`pnpm pm`** — the consolidated Task board / table. Every parseable item shows with ID / severity / effort chips, filterable (`m:Budget s:blocker is:open`), click-through to the exact doc line.
- **`pnpm pm:archive`** — sweeps every ticked checklist item into its Master Book's Shipped Log (§2.1). `--dry-run` to preview, `--undo` to revert the last sweep. Runs automatically on the first `pnpm pm` boot of each month.
- **`_Archive/` is never scanned by any PM tool.** The skip lives in `scripts/pm/scan.mjs`, so the server, the static build, the bridge and the linter all inherit it. Archived docs stay in git for history and `rg`, and are reachable by opening the file directly — they are simply not part of the corpus the tools see. Move a doc there when it is superseded rather than deleting it.
- **Hidden layers** — any doc with frontmatter `status: superseded | baseline-frozen | template` is hidden from the board's default view (toggle "archived docs" to reveal). They are reference layers, not execution queues.

---

## 7. Idea Inbox (`0 - Inbox.md`)

The capture surface for raw, not-yet-canonical thoughts — ideas, bugs, checklist candidates in the owner's own words. **Exempt from `pnpm pm:lint`** (it is not a `4 - Checklist.md`); its grammar is deliberately loose:

```
## New
- [ ] YYYY-MM-DD — raw text in the owner's own words

## Processed
- YYYY-MM-DD — original text → **BUD-15** in [Budget/4](<Budget/4 - Checklist.md>) (+ Feature State 🟠) (triaged YYYY-MM-DD)
```

- **New** entries are checkboxes so they surface chip-less in the `pnpm pm` Task table — the visible untriaged queue. They never appear on the Task board (board = `4 - Checklist.md` files only).
- Capture paths: write the line by hand, or the 💡 button in the dashboard topbar (server mode).
- **Triage** is done by the `/triage-inbox` Claude Code skill (`.claude/skills/triage-inbox/SKILL.md`): it elaborates each entry (clarifying questions for bugs), files a canonical §1 item in the right campaign, adds a Feature State pain bullet for bugs, and moves the entry to **Processed** as a **plain bullet** (no checkbox — drops out of task views) keeping the original wording plus a `→` pointer to where it landed.
- Processed is swept (deleted) past ~20 bullets, **only with owner approval** — git is the archive.
