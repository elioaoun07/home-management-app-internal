---
created: 2026-06-10
type: audit
status: living
owner: Elio
tags:
  - pm/audit
  - scope/cross-cutting
  - ai/setup
---

# 6 · Optimized Claude Setup Structure

> **Command Center:** [1 · Setup Audit](<1 - Codebase & AI Setup Audit.md>) · [2 · Feature State](<2 - Feature State — Current Reality.md>) · [3 · Future Vision](<3 - Future Vision & Roadmap.md>) · [4 · This Week](<4 - This Week (Action Plan).md>) · **6 · This file**
>
> **What this file is:** the blueprint for the *most optimized Claude Code setup* for this repo — the six layers that steer an AI session, what "optimal" looks like for each, where the current setup stands, and the ranked gap list. File 1 is the point-in-time audit (May 29); this file is the **target architecture** it should converge to. Audited fresh on **2026-06-10**.

---

## 0 · The mental model — six layers

An AI-assisted repo is steered by six layers. Each has one job, one source of truth, and one failure mode. Optimization = every fact lives in exactly **one** layer, and every layer is **mechanically enforced** (not aspirational).

| # | Layer | Job | Source of truth | Failure mode |
|---|---|---|---|---|
| 1 | **Instructions** | Rules loaded into *every* session | `CLAUDE.md` (hand-edited) → auto-mirrors | Token bloat; silent mirror drift |
| 2 | **Knowledge** | Deep context loaded *on demand* | `ERA Notes/` (Feature Map → vault docs → PM) | Docs lag code |
| 3 | **Enforcement** | Hooks that block/nudge/automate | `.claude/settings.json` + `.claude/hooks/` | Hooks fail **silently** |
| 4 | **Skills** | Reusable procedures triggered by task type | `.claude/skills/` | Skill exists but never triggers |
| 5 | **Memory** | Cross-session facts the repo can't hold | `~/.claude/projects/.../memory/` | Stale facts asserted as current |
| 6 | **Permissions** | What runs without prompting | `.claude/settings.local.json` | Over-broad allows (destructive ops) |

**The one-sentence principle:** CLAUDE.md is a *tight rulebook* (token economy), ERA Notes is the *library* (loaded on demand), hooks make the rules *mechanical*, and memory holds only what neither git nor the vault can.

---

## 1 · Layer-by-layer: target vs current

### Layer 1 — Instructions (`CLAUDE.md` + mirrors)

**Target:**
- One hand-edited file (`CLAUDE.md`), three auto-generated mirrors (`AGENTS.md`, `CODEX.md`, `.github/copilot-instructions.md`). Never hand-edit a mirror.
- Size budget: **≤ 30 KB (~7.5K tokens)**. Every line must either (a) prevent a known bug class or (b) route to the right file. Anything explanatory belongs in ERA Notes.
- Tables that exist elsewhere (Feature Map) appear here only as *routing stubs*, not duplicated content.
- Mirror sync is **loud on failure**.

**Current state: B+ (was failing silently — fixed 2026-06-10).**
- ✅ Single-source + 3 mirrors architecture is right and now back in sync.
- 🔴 **Found this pass:** mirrors had drifted since **May 30** — a June 6–8 edit accidentally deleted the **Focus** row from the Feature Index, `docs:check` started failing, and the PostToolUse sync hook died silently on every save for 10 days. **Fixed:** Focus row restored, mirrors regenerated.
- 🟠 At 30 KB, CLAUDE.md is at its budget ceiling. The **Module Model tables and the Feature Index largely duplicate each other** (both map module → feature dir). Merging them into one table (the Feature Index already has a Type column) would save ~1.5K tokens *per session* without losing any routing power. Recommended, not urgent.
- ✅ The 25 Hard Rules earn their tokens — each encodes a real bug class. Rules #17/#18 (pointing to skills instead of inlining content) are the model: when a rule needs >5 lines of explanation, move the explanation to a skill or vault doc and keep the pointer.

### Layer 2 — Knowledge (`ERA Notes/`)

**Target:**
- **Two-tier routing:** Feature Map (`01 - Architecture/Feature Map/_index.md`) answers *"user said X → edit these files"* in one small read; vault docs (`02/03 - Modules/`) answer *"why is it built this way."* PM (`10 -`) answers *"what hurts and what's next."* FABLED folders (new, 2026-06-10) answer *"deep current-state + where this module should go."*
- Every shipping module has: Feature Map file + vault Overview + Feature Index row + Atlas entry. The `new-module` skill keeps all six surfaces in sync for new modules.
- `pnpm docs:check` mechanically validates Feature Index ↔ Feature Map.

**Current state: A− (best layer; known doc gaps).**
- ✅ The Feature Map router is the single highest-value asset in the whole setup — cheaper and more accurate than grep for ~90% of tasks.
- 🟠 Per file 2: Dashboard, Chores, Focus, AI Usage, Recycle Bin still have **no vault Overview doc** (Feature Map only).
- 🔴 **Footgun corrected this pass:** CLAUDE.md called `migrations/schema.sql` "the single source of truth," but the export captures **tables only** — no RLS policies, no function bodies (verified live 2026-05-31, `migrations/_verify_schedule_rls.md`). A caveat is now in CLAUDE.md's Database section so future sessions don't re-derive (or contradict) live RLS.
- 🔴 **Found this pass: executed migration files are not retained.** `migrations/` holds only `schema.sql` + README + the RLS verification doc — zero dated `YYYY-MM-DD_*.sql` files, even though Hard Rule #24 mandates creating them and CLAUDE.md itself cites `migrations/2026-05-11_schedule_bundle_rpc.sql` (a file that no longer exists). Consequence: **every RPC body (`get_schedule_bundle`, `activate_trip`, `complete_trip`) exists only in the live DB** with no diff trail. Recovery plan: Trips FABLED O1 / Schedule FABLED O4 (snapshot the function bodies into a dated migration file, then keep all future migration files).
- 🟠 **Three Feature Index paths were fictional** (fixed 2026-06-10): Hub Chat pointed at `src/app/hub/` (real: `src/app/chat/` + `/alerts`), Items/Reminders at `src/app/items/` (real: `src/app/reminders/`), Inventory at `src/app/inventory/` (real: `src/components/inventory/` mounted inside Catalogue). An agent trusting those rows would have grepped into nothing. Lesson: when the Feature Map and the Feature Index disagree, verify mounts — `docs:check` validates *names*, not *paths*.

### Layer 3 — Enforcement (hooks)

**Target:** every Hard Rule that *can* be mechanical *is* mechanical, and **every hook failure is visible**. A guidance system that fails silently is worse than none — it manufactures false confidence.

**Current inventory:**

| Hook | Event | Status |
|---|---|---|
| graphify nudge | UserPromptSubmit | ✅ Good |
| Feature Map nudge | UserPromptSubmit | ✅ Good |
| `block-ui-dir.sh` | PreToolUse (Edit/Write) | ✅ Good |
| `sync-ai-mirrors.mjs --hook` | PostToolUse (Edit/Write) | 🟠 Works, but **fails silently** (proven May 30 → Jun 10) |
| `update-atlas.sh` | PostToolUse | ✅ Good |
| `check-migration.sh` | PostToolUse | ✅ Good — and it's the model: it *prints a loud reminder* instead of dying quietly |
| `pre-commit.sh` (husky) | git pre-commit | 🔴 **Not actually gating** — see below |

**Two findings this pass:**
1. 🔴 **Pre-commit is being bypassed or not firing.** Commits `68b5711` (Jun 6) and `5bc4812` (Jun 8) modified CLAUDE.md while `docs:check` was failing — pre-commit should have blocked both, yet both landed. Husky *is* wired (`core.hooksPath=.husky`). Either commits are made with `--no-verify`, or from a GUI client that skips hooks. **Action: make one test commit from your normal workflow and confirm you see the "Checking AI guidance docs..." output.** Until then, every gate in pre-commit (tsc, tests, ESLint, docs:check) is decorative.
2. 🟠 **Make sync failure loud.** In `--hook` mode, `sync-ai-mirrors.mjs` should never exit silently on drift — it should print `MIRROR DRIFT: CLAUDE.md Feature Index out of sync with Feature Map (module: X). Mirrors NOT updated.` so the message lands in the session transcript, the way `check-migration.sh` does. One small edit; prevents a repeat of the 10-day silent drift.

**Still-open additions (from file 1 §5):** `no-console` ESLint rule (after the sweep — 649 violations), schema-drift hook (warn when a migration touches a table missing from `schema.sql`).

### Layer 4 — Skills

**Target:** one skill per *recurring procedure with footguns*: things you do monthly+ that have a checklist someone forgets.

**Current state: A−.** `cache-invalidation`, `timezone-handling` (the two trickiest cross-cutting concerns — exactly right), `new-module` (keeps the six index surfaces in sync), plus global `graphify`. Built-ins (`code-review`, `verify`, `simplify`, `security-review`) cover the rest.
- The only candidate gap: a **`pm-update`** skill encoding Hard Rule #25's checklist (mark file 1 ✅ → check file 3 `[x]` → note in file 2). Low priority — the rule text already carries it; add the skill only if PM drift recurs.

### Layer 5 — Memory (`~/.claude/projects/.../memory/`)

**Target:**
- Memories hold **only** what git + vault can't: user preferences, feedback patterns, decisions-with-rationale, live-DB truths, pointers to external apps.
- *Implementation records* ("we fixed X in March") do **not** belong here once captured by git/PM — they age into misinformation.
- Every memory survives the test: *"will this still be true and useful in 3 months?"*
- One frontmatter format (`metadata.type`), index line in `MEMORY.md` for each.

**Current state: B+ (11 memories, mostly high-quality).**

| Memory | Verdict |
|---|---|
| `feedback_challenge_proposals` | ✅ Keep — the single most valuable memory (how to work with you) |
| `user_color_coding` | ✅ Keep — fixed this pass (cited "Hard Rule #17," now correctly #14) |
| `project_schedule_rls_truth` | ✅ Keep — live-DB truth the repo can't show (now also caveated in CLAUDE.md) |
| `project_schedule_mobile_form` | ✅ Keep — dead-code trap (MobileItemForm) + active direction |
| `project_pm_command_center` | ✅ Keep — updated this pass (was "4-file," now reflects 6 files + 5 module folders + FABLED) |
| `project_trips_module`, `project_voice_conversation`, `project_capacitor_shell`, `project_songbook_app` | ✅ Keep — architecture decisions / external pointers |
| `project_expense_form_audit` (Mar) | 🟡 **Archive candidate** — historical fix record; git + PM already hold it |
| `project_design_system_implementation` (Apr) | 🟡 **Merge into one "expense form patterns" memory** with the audit file, keeping only the two *forward-looking* patterns (circular icon backgrounds, quick-amount chips placement) |

- 🟡 Cosmetic: five older memories use top-level `type:` instead of `metadata.type:`. Normalize on next touch; not worth a dedicated pass.

### Layer 6 — Permissions (`.claude/settings.local.json`)

**Target:** allowlist = frequent + **read-only** operations. Anything destructive or stateful prompts.

**Current state: C — needs a 10-minute cleanup.**
- 🔴 **`Bash(Remove-Item *)` is allowlisted** — that auto-approves arbitrary recursive deletes. Remove it; deletion should always prompt.
- 🟡 Junk entries that never match or are misplaced shells: `Bash(Get-ChildItem *)`, `Bash(Select-Object Name)`, `Bash(Select-Object FullName)`, `Bash(cat)`, `Bash(winget upgrade *)` (PowerShell cmdlets registered under Bash), several one-off `node -e`/`python3 -c` literals that will never be reused. Purge, then run `/fewer-permission-prompts` to rebuild from actual usage.

---

## 2 · Ranked remaining actions

| # | Action | Layer | Effort | Why |
|---|---|---|---|---|
| 1 | **Verify pre-commit actually fires** in your real commit workflow (test commit; look for "Checking AI guidance docs...") | Enforcement | 5 min | Every quality gate hangs on this. The Jun 6–8 commits prove it's not gating today. |
| 2 | Make `sync-ai-mirrors.mjs --hook` **print a loud drift warning** instead of failing silently | Enforcement | 15 min | Prevents a repeat of the 10-day silent mirror drift. |
| 3 | Remove `Bash(Remove-Item *)` + junk entries from `settings.local.json`; re-run `/fewer-permission-prompts` | Permissions | 10 min | Destructive auto-approve is the one genuinely dangerous setting in the setup. |
| 4 | Console sweep → then `no-console` ESLint rule | Enforcement | M | Hard Rule #22 is still violated ~649× and unenforced (file 1 P1). |
| 5 | Merge CLAUDE.md Module Model tables into the Feature Index (one table, Type column) | Instructions | 30 min | ~1.5K tokens saved every session; removes a drift surface (3 module lists → 2). |
| 6 | Write the 5 missing vault Overviews (Dashboard, Chores, Focus, AI Usage, Recycle Bin) | Knowledge | M | Last modules where code is ahead of its map. FABLED docs (§3) now cover the PM-tracked five. |
| 7 | Merge/archive the two expense-form history memories | Memory | 10 min | Stops point-in-time records aging into misinformation. |
| 8 | schema-drift hook (migration touches table absent from schema.sql) | Enforcement | S | Closes the last open recommendation from file 1 §5. |
| 9 | **Stop deleting executed migration files** + snapshot the 3 live RPC bodies into a dated migration | Knowledge | 30 min | The app's most critical logic (trip cascades, schedule bundle) currently has no copy in version control. |

---

## 3 · The FABLED layer (added 2026-06-10)

Each PM module folder now carries a `FABLED/` sub-folder — the 10× deep-dive that the lighter `1/2/3/4` PM files route into:

```
10 - Project Management/
├── 6 - Optimized Claude Setup Structure.md   ← this file
└── <Module>/                                  (Budget · Schedule · Kitchen · Trips · Hub & ERA · Notifications & Alerts)
    ├── 1 - Feature State.md                    (status + pain inventory)
    ├── 2 - Vision & Roadmap.md                 (vision, design & decisions)
    ├── 3 - Action Plan.md                      (the call + sequenced narrative)
    ├── 4 - Checklist.md                        (flat, phased, checkable — daily driver)
    └── FABLED/
        ├── _index.md
        ├── 1 - FABLED — Current Implementation.md   (how it actually works: files, data flow, DB, API)
        ├── 2 - FABLED — Gaps & Missing.md           (what's absent or half-built, ranked)
        ├── 3 - FABLED — Optimization Plan.md        (perf, code health, architecture debt — concrete)
        └── 4 - FABLED — Future Enhancements.md      (10× ideas with effort/impact)
```

**Division of labor:** files 1–3 stay short and current (Hard Rule #25); FABLED files are the *depth* — re-audited per campaign, not per session. When a FABLED claim and the code disagree, the code wins and FABLED gets the correction.

---

## 4 · Maintenance rituals

| Cadence | Ritual |
|---|---|
| **Every session** | Hard Rule #25 (PM trace for every fix). Hooks handle mirrors/Atlas/migration reminders. |
| **Weekly (Mon)** | Re-draft file 4. Glance at `git status` for unexpected mirror diffs. |
| **Monthly** | 10-min sweep: memory staleness (anything >3 months → still true?), permissions list, `pnpm docs:check`, mirror mtimes vs CLAUDE.md mtime. |
| **Per campaign** | Re-audit the module's FABLED folder before planning the next campaign on it. |
