---
created: 2026-05-29
type: audit
status: living
owner: Elio
tags:
  - pm/audit
  - scope/cross-cutting
---

# 1 · Codebase & AI Setup Audit

> **Command Center:** [1 · Setup Audit](<1 - Codebase & AI Setup Audit.md>) · [2 · Feature State](<2 - Feature State — Current Reality.md>) · [3 · Future Vision](<3 - Future Vision & Roadmap.md>) · [4 · This Week](<4 - This Week (Action Plan).md>)
>
> **What this file is:** an honest engineering-director review of _how the project is built and steered_ — repo structure, AI guidance (CLAUDE.md / AGENTS.md / Copilot), hooks, skills, and code-health. Not a feature list (that's file 2). Audited **2026-05-29** against `main`.

---

## 0 · Verdict (read this first)

You have **a genuinely impressive solo build** — ~767 TS/TSX files, ~40 modules, a disciplined architecture doc set (ERA Notes), a Feature Map router, an auto-generated Atlas, and real hard-rules culture. The _design_ maturity is well above the typical solo PWA.

**But the engineering safety net has not kept pace with the feature velocity.** You are shipping money-handling features (balances, recurring auto-posts, transfers, split bills) onto a foundation that now has only a **thin initial automated test baseline**, **649 stray `console.*` calls** (your own Hard Rule 22), and **AI guidance files that had silently drifted out of sync**. None of this is visible day-to-day — which is exactly why it's dangerous. The first money/date tests reduce the headline risk, but recurring cron, transfers, and API flows still need coverage.

**The one-sentence recommendation:** _spend one week hardening the foundation before adding module #41._ The detailed plan is in [4 · This Week](<4 - This Week (Action Plan).md>).

---

## 1 · Scorecard

| Area                                                        | Grade  | One-line                                                                          |
| ----------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| Architecture & docs (ERA Notes, Feature Map)                | **A**  | Best-in-class for a solo project. Keep it.                                        |
| Hard-rules discipline (RLS, RPC bundles, safeFetch, themes) | **A−** | Excellent _intent_; enforcement is manual, so drift creeps in.                    |
| AI guidance (CLAUDE.md)                                     | **B+** | Strong & well-scoped; Feature Index table is stale.                               |
| AI mirror sync (AGENTS / CODEX / Copilot)                   | **D**  | Three files, three dates, three sizes. Drifted. Fixed this pass.                  |
| Test coverage                                               | **D+** | 26 unit tests: balance-utils, date, recurring, split-bill. API/cron/UI still uncovered. |
| Code hygiene (console/any/dead code)                        | **C−** | Rules exist but nothing mechanically enforces them.                               |
| Continuity (session log, backlog)                           | **C**  | Templates exist; almost nothing is written into them.                             |
| Skills & hooks tooling                                      | **B**  | Good foundation; 3 high-value additions recommended.                              |

---

## 2 · What's working — do not break these

- **ERA Notes vault** — the `01 – Architecture` rules, per-module Overviews, and the **Feature Map** (`01 - Architecture/Feature Map/_index.md`) are a real competitive advantage. The intent→files routing is faster and cheaper than grep. This is the system that lets an AI agent (or future-you) onboard in minutes.
- **Atlas auto-generation** — `update-atlas.sh` regenerates `public/atlas/atlas.json` on every `src/app|features|components` edit. Self-maintaining. Excellent.
- **Guardrail hooks** — `block-ui-dir.sh` (blocks edits to `src/components/ui/`) and the husky `pre-commit.sh` (tsc + ESLint, `--max-warnings=0`) are exactly right.
- **Prompt-routing hooks** — your two `UserPromptSubmit` nudges (graphify for exploration, Feature Map for edits) are a sophisticated touch most teams never build.
- **Hard Rules** — the 23 rules in CLAUDE.md encode real, hard-won lessons (RLS on hot child tables, RPC bundles, `safeFetch` timeouts). This is institutional memory done well.

---

## 3 · What's wrong — ranked by risk

### 🔴 P0 — Thin automated tests `[DONE]` _(initial baseline added)_

- **Finding:** Vitest now exists with 26 unit tests across 4 test files. The suite covers `balance-utils.ts`, `utils/date.ts`, `lib/recurring.ts`, and `utils/splitBill.ts`.
- **Why it still matters:** this is a _financial_ app. The first safety net catches money/date regressions, but API routes, Supabase integration, transfers, recurring auto-post flows, and UI workflows still need coverage.
- **Fix status:** initial P0 baseline implemented. See [5 · P0 Automated Tests Implementation Notes](<5 - P0 Automated Tests Implementation Notes.md>) for approach, verification, and follow-up work.

### 🔴 P1 — AI mirrors drifted `[DONE]` _(fixed this pass — see §6)_

- **Finding:** `CLAUDE.md` (27 KB, current) is mirrored to three files that are all different:
  - `CODEX.md` — 24 KB, **May 4** (auto-mirror, stale)
  - `AGENTS.md` — 19 KB, **May 9** (a _hand-written, different-format_ file — **never synced**)
  - `.github/copilot-instructions.md` — 25 KB, **May 10** (auto-mirror, stale)
- **Root cause:** the active hook `sync-copilot.sh` only writes **CODEX.md + Copilot**, not **AGENTS.md** — and modern Codex CLI reads **AGENTS.md**, not CODEX.md. So your most-current instructions never reached Codex, and Codex/Copilot have been running on weeks-old rules.
- **Fix applied this pass:** the hook and `scripts/sync-ai-mirrors.sh` now regenerate **all three** (CODEX, AGENTS, Copilot) from CLAUDE.md on every save. AGENTS.md is now an auto-mirror — **stop hand-editing it**; edit `CLAUDE.md` only.

### 🟠 P1 — Hard Rule 22 is violated 649× and not enforced

- **Finding:** **649 `console.log/warn/error/debug`** calls in `src/` — your CLAUDE.md says "No `console.*` in committed code." Hotspots: `src/app/api` (109 files), `components/web` (11), `components/expense` (9), `components/hub` (5).
- **Why it matters:** a rule that lives only in a doc is a suggestion. Your `pre-commit` runs ESLint but there's **no `no-console` rule**, so nothing stops new ones.
- **Fix (phased — do NOT just turn the rule on):** turning on `no-console` today would throw 649 errors and **block every commit** (your hook is `--max-warnings=0`). Instead: (1) sweep the worst offenders out, (2) then add `"no-console": ["error", { allow: ["warn", "error"] }]` or route through a `logger.ts`. Sequence in file 4.

### 🟠 P1 — CLAUDE.md Feature Index is stale (two indexes have drifted) `[DONE]`

- **Finding:** the **Feature Index table** in CLAUDE.md is missing modules that exist and ship: **Chores, Focus, Trips, Dashboard, Recycle Bin, AI Usage**. The **Feature Map** (`_index.md`) _does_ list them. You now maintain two module indexes and they've diverged.
- **Why it matters:** an agent trusting the CLAUDE.md table will miss those modules entirely.
- **Fix:** added the missing rows except **AI Usage** (intentionally excluded because it is not part of the application), regenerated AGENTS/CODEX/Copilot from CLAUDE.md, and added `pnpm docs:check` so CLAUDE.md's Feature Index is validated against the Feature Map during mirror sync and pre-commit.

### 🟡 P2 — Continuity gaps: session log & backlog are empty `[CANCELLED]`

- **Finding:** `ERA Notes/08 - Sessions/` has **0 files** despite four templates. `07 - Backlog & Ideas/Ideas.md`, `Feature Optimizations.md` headers, and `Dashboard V2` are mostly empty stubs (only `Feature Optimizations.md` has real content). **Nothing writes session notes**, so the expectation silently fails — exactly what you noticed.
- **Why it matters:** no continuity between sessions → every session re-derives context → wasted tokens and lost decisions.
- **Decision (2026-05-30): cancelled.** The session-note habit and the `/session-log` skill idea are **dropped** — not deferred. Continuity comes from git history + this PM set. Don't reintroduce the `08 - Sessions/` expectation.

### 🟡 P2 — Type-safety erosion: 522 `any` / `as any` / `@ts-ignore`

- **Finding:** ~0.7 escape hatches per file, in a codebase that mandates Zod + `z.infer`. Each one is a place the compiler has stopped helping you.
- **Fix:** not urgent, but add an ESLint `no-explicit-any` _warning_ (not error) to stop the bleeding, and chip away during normal edits. Don't make this a sprint.

### 🟡 P2 — `safeFetch` compliance needs an audit

- **Finding:** **245 raw `fetch(` call-sites vs 201 `safeFetch(`**. Many raw ones are legitimate (server-side API routes, the service worker, `safeFetch.ts` internals, `/api/health` probes — `safeFetch` is a _client mutation_ helper). But the ratio means some client mutation paths likely bypass Hard Rule 6 and won't trip the offline indicator correctly.
- **Fix:** grep client components/hooks for `fetch(` in mutation paths; convert the real violations. Not a sprint — a checklist item.

### ⚪ P3 — Structural dead code & scratch routes

- **Finding:** `src/features/blink/` (0 files — the _old_ AI chat, replaced by `era/`) and `src/features/today/` (0 files) are **empty orphan dirs**. `src/app/temp/page.tsx` is a **scratch route shipped to the app**. `src/features/navigation/` and `src/features/dashboard/` each hold a single prefetch util (misfiled as "features").
- **Fix:** delete `blink/`, `today/`, `app/temp/`; move the prefetch utils to `src/lib/prefetch/`. 15-minute cleanup, removes confusion from the module model.

### ⚪ P3 — A few very large files

- **Finding:** `HubPage.tsx` **5,506 LOC**, `ShoppingListView.tsx` 3,181, `MobileExpenseForm.tsx` 2,890, `recurring/page.tsx` 2,772, `useItems.ts` 2,621. These are change-risk hotspots (hard to review, easy to regress).
- **Fix:** not now — but when you next touch Hub or Shopping List, split out sub-components. Don't refactor for its own sake.

---

## 4 · AI guidance setup — inventory

**Hooks** (`.claude/settings.json` + `.claude/hooks/`):

| Hook              | Event                    | Does                                        | Status                                              |
| ----------------- | ------------------------ | ------------------------------------------- | --------------------------------------------------- |
| graphify nudge    | UserPromptSubmit         | Suggests `/graphify` on exploration prompts | ✅ Good                                             |
| Feature Map nudge | UserPromptSubmit         | Suggests Feature Map on edit/bug prompts    | ✅ Good                                             |
| `block-ui-dir.sh` | PreToolUse (Edit/Write)  | Blocks edits to `src/components/ui/`        | ✅ Good                                             |
| `sync-copilot.sh` | PostToolUse (Edit/Write) | Mirrors CLAUDE.md → CODEX/AGENTS/Copilot    | ✅ **Fixed this pass** `[DONE]` (now covers AGENTS) |
| `update-atlas.sh` | PostToolUse (Edit/Write) | Rebuilds `atlas.json`                       | ✅ Good                                             |
| `pre-commit.sh`   | husky                    | tsc + ESLint (`--max-warnings=0`)           | ✅ Good                                             |

**Skills available:** `graphify` (global), `cache-invalidation`, `timezone-handling` + the Claude Code built-ins (`code-review`, `verify`, `security-review`, `simplify`, `run`). Good coverage for _this_ codebase's footguns (cache + timezones are your two trickiest cross-cutting concerns).

**The 3 AI instruction files** (all should be identical now):

- `CLAUDE.md` — **the only one you edit by hand** (source of truth).
- `AGENTS.md` — OpenAI Codex (auto-mirror).
- `.github/copilot-instructions.md` — GitHub Copilot (auto-mirror).
- `CODEX.md` — legacy Codex name (auto-mirror; kept for safety, harmless).

---

## 5 · Recommended additions (skills & hooks)

Ranked by value-for-effort for _your_ workflow (solo, high-velocity, AI-assisted, financial domain):

| #   | Add                                            | Type          | Why it pays off                                                                                                              | Effort |
| --- | ---------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | **`no-console` ESLint rule** (after the sweep) | ESLint config | Mechanically enforces Hard Rule 22 forever; pre-commit already runs ESLint                                                   | S      |
| 2   | ~~**`/session-log` skill**~~ `[CANCELLED]`     | Skill         | **Rejected** — session-note habit dropped (2026-05-30); rely on git + this PM set, not an `08 - Sessions/` folder.        | —      |
| 3   | **`/new-module` scaffold skill** `[DONE]`      | Skill         | You add ~1 module/2 weeks; auto-create `features/[x]/`, Overview doc, Atlas entry, Feature Map row — so docs never lag code  | M      |
| 4   | **Vitest + thin money/date suite** `[DONE]`    | Tooling       | The P0 fix; unblocks confident refactoring                                                                                   | M      |
| 5   | **`schema-drift` check**                       | Hook/script   | Warn when a migration touches a table not reflected in `schema.sql`                                                          | S      |

> Keep CLAUDE.md lean — these go in _skills/hooks_, not in the instructions file. The instructions file should stay a tight rulebook (token economy), which it currently is.

---

## 6 · Changelog — what I changed in this pass

- **Implemented the P0 test baseline**: Vitest + 26 unit tests for money/date core, recurring next-due math, and split-bill display logic. Added the implementation note in file 5.
- **Fixed the mirror sync** so `CLAUDE.md` now propagates to **AGENTS.md + CODEX.md + Copilot** (previously AGENTS.md was orphaned). Regenerated all three from current CLAUDE.md.
- **Fixed the CLAUDE.md Feature Index**: added Chores / Focus / Trips / Dashboard / Recycle Bin, intentionally excluded AI Usage, regenerated all AI mirrors, and added a docs check to prevent future Feature Map drift. `[DONE]`
- Created this Project-Management set (files 1–4) under `ERA Notes/10 - Project Management/`.

> I did **not** delete `blink/`, `today/`, or `app/temp/`, and did **not** start the console sweep — those touch app code and should be your call. They're queued in [4 · This Week](<4 - This Week (Action Plan).md>).

---

## 7 · Where to go next

→ Read [2 · Feature State](<2 - Feature State — Current Reality.md>) for the honest module-by-module status, then [4 · This Week](<4 - This Week (Action Plan).md>) for the concrete plan.
