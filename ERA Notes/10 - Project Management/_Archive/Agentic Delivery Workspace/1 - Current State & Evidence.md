# 1 — Current State & Evidence

**Stamped:** 2026-07-11 · Covers plan sections: current-state findings with exact file references, confirmed-vs-proposal split

> **Frozen pre-implementation baseline — not the current state.** This doc is a point-in-time snapshot of the repo at `main` @ `b03b2bb` on 2026-07-11, taken **before any delivery code existed**, to justify the plan's design choices against what was actually there. S1 (pure core) and S2 (server + runner + fake-driver dashboard) shipped **2026-07-12** — see `_index.md`'s status line and doc 6 §1 for what exists now (`scripts/delivery/*.mjs`, `server-routes.mjs`, `run-session.mjs`, the full dashboard delivery UI). Every "no … exists" claim below is scoped to the 2026-07-11 stamp, not today. Do not use this file to answer "what's implemented" — use doc 6 §1 (roadmap, marked ✅/IMPLEMENTED with dates) or the Freshness protocol (`git log --since=2026-07-11`) instead.

Verified against the working tree on 2026-07-11 (`main` @ `b03b2bb`). Line numbers are exact as of the stamp; re-verify with the Freshness protocol in `_index.md` before implementing.

## 1 · The host: pm-server

- `scripts/pm-server.mjs` (400 lines) — **zero-dependency** raw `node:http` server, port 4317 (`PM_PORT` / `--port`, lines 46–52), bound to `127.0.0.1` (line 391) with a DNS-rebinding Host-header allowlist (lines 305–308) and a 5 MB body cap (line 290). Started by `pnpm pm` (`package.json:22`).
- Endpoints:
  - `GET /` → dashboard HTML via `buildHtml({mode:"server"})` (312–319)
  - `GET /api/data` → `buildData()` (81–99): `{generatedAt, repoRootPath, pmDirRepoRel, sourceKeys, files:[{relPath, raw, mtimeMs, repoDir}]}`
  - `GET /api/source?path=` → lazy source-file preview (325–330)
  - `GET /api/events` → **SSE** stream (332–342)
  - `POST /api/<op>` → `MUTATIONS` map lookup (344–358; map at 242–250: `toggle/move/rename/reorder/create/delete/append`); errors thrown as `fail(status,msg)` (102–106) → `{error}` JSON (366–369)
- Live reload: `fs.watch(PM_DIR, {recursive:true})` → 250 ms debounce → `broadcast()` writes `data: reload` to every SSE client (252–273); `suppressUntil` (254, set at 355) mutes the echo of the server's own writes for 700 ms.
- Data = markdown only, under `PM_DIR = ERA Notes/10 - Project Management/` (42–43). **No JSON state store exists anywhere in the tooling.** Soft-delete goes to `PM_DIR/.trash/` (220–224). The only `child_process` use is `exec` to open the browser (11, 372–380). **No git, no agent, no session code exists in the tooling today.**
- Helpers:
  - `scripts/pm/mutations.mjs` — canonical `scanCheckboxes` parser (15–39; frontmatter- and code-fence-aware, absolute checkbox ordinals) — injected verbatim into the browser (`ui.mjs:30`) so client and server ordinals can never drift; `toggleCheckbox` with optimistic `expectState` drift-check (40–66); `appendUnderHeading`; `resolveInside` path-traversal guard; `fileStub`.
  - `scripts/pm/scan.mjs` — `walk()` (recursive `.md` collector, **skips dot-dirs** incl. `.trash`), source-ref resolver with extension allowlist + 140 KB cap, `readSourceFile`.
  - `scripts/pm/ui.mjs` — `buildHtml()` inlines `styles.css` + `body.html` + `client.js`; same builder serves the live server and the static `_dashboard.html` twin (`scripts/build-pm-dashboard.mjs`, mode `"static"`).

## 2 · The frontend and its extension points

`scripts/pm/client.js` (3444 lines, vanilla JS IIFE, no framework, hand-rolled md renderer; note: contains a literal NUL byte — use `grep -a`):

| Extension point | Location |
|---|---|
| Route state `currentRoute={type}`; types `home/module/file/checklist/bugs` | line 1437 |
| View dispatch `renderCurrent()` | 3384–3401 |
| Nav setters `goHome`/`goModule`/`goFile`/`goChecklist`/`goBugs` + `persistRoute` | 1439–1479 |
| Sidebar quicklinks `buildTreeHTML()` (`<a data-route=…>`) | 1087–1116 |
| Click wiring `wireTreeEvents()` | 1280–1373 |
| Render targets: `renderChecklistRollup` 2628, `renderBugsRollup` 2713 → `els.view`; DOM handle map `els` | 727–744 |
| Icon registry `ICON_PATHS` | 21–56 |
| Data layer `apiGet` 3340 / `apiPost` 3356 / `loadData` 3373 / `reload` 3402 / `subscribeSSE` 3411; `MODE=window.PM_MODE`, `CAN_EDIT=MODE==="server"` | 3340–3443 |

The static `_dashboard.html` build runs the same client in `"static"` mode with `CAN_EDIT=false` — every delivery entry point must gate on `CAN_EDIT` so the static twin stays read-only and unchanged.

## 3 · Work-item & topic model (already parsed today)

- **Topics = campaign folders** (`Budget/`, `Schedule/`, `Kitchen/`, `Trips/`, `Hub & ERA/`, `Notifications & Alerts/`), each in the uniform layout `_index` + `1 - Feature State` + `2 - Vision & Roadmap` + `3 - Action Plan` + `4 - Checklist` (+ `FABLED/`, `FABLED 2/`).
- **Work items = checklist lines.** The client already extracts a full task model: `fileTasks` (1596–1644) walks checkboxes with heading context; `parseTaskMeta` (1566–1586) pulls `**N4**`-style IDs and `_(🟠 · M)_` severity/effort; `sectionRank` (1587–1593) orders Now→Next→Later. Emits `{file, cbidx, state, indent, heading, rank, id, sev, effort, text, key, postponed, docIdx}` — the delivery packet (doc 3) reuses this identity verbatim, so sessions join back to task rows for "in delivery" badges.

## 4 · Agent infrastructure present

- **Codex:** `codex-cli 0.128.0` installed globally; `~/.codex/` is a heavily-used install (auth, sessions, config). Repo has `.codex/hooks/` replicating Claude's enforcement (block-ui-dir, mirror sync, atlas regen).
- **Claude Code:** installed and in daily use on this machine (this plan was authored in it).
- **Instruction inheritance:** `AGENTS.md`, `CODEX.md`, `.github/copilot-instructions.md` are byte-identical auto-generated mirrors of `CLAUDE.md` (PostToolUse hook + `scripts/sync-ai-mirrors.mjs`; CI `check-docs-sync.yml` blocks drift). Modern Codex reads `AGENTS.md` (`1 - Codebase & AI Setup Audit.md:68`); Claude reads `CLAUDE.md`. **Any agent session in this repo inherits Hard Rules 1–25 for free.**
- **Skills as capability prompts:** `.claude/skills/` holds 14 playbooks mapping 1:1 onto delivery capabilities — `start-task` (router), `fix-bug`, `add-feature`, `api-route`, `db-migration`, `money-rules`, `recurrence-safety`, `data-repair`, `ui-guardrails`, `cache-invalidation`, `timezone-handling`, `finish-task` (DoD gate), `new-module`, `skill-factory`.
- **Precedent brief:** `docs/WEAR_OS_NATIVE_APP_IMPLEMENTATION.md` is an existing "implementation brief for Codex".

## 5 · Verification & enforcement chain relevant to delivered work

- `pnpm test` = vitest 4.1.7 (`vitest.config.ts` includes `src/**/*.test.ts` + `tests/**/*.test.ts` — new `tests/delivery/` suites need **zero config change**); `pnpm typecheck` = `tsc --noEmit -p .`; `pnpm lint` = eslint; `pnpm docs:check`. Husky pre-commit chains docs:check + tsc + test + eslint.
- Hard Rule 24 (migration pairing) and Hard Rule 25 (PM trace) are enforced for Claude by hooks (`check-migration.sh`, `check-pm-update.sh` Stop hook); `CLAUDE.md` line: "Codex and other agents without a hook engine must still treat this rule as mandatory" — the delivery workflow re-checks both in review (doc 3) and satisfies HR25 via the Accept checkbox tick.
- `tsconfig.json` includes `**/*.ts`/`**/*.tsx` with only `node_modules` excluded — relevant to any future S6 non-Git isolated copy placed inside the repo (a nested non-dot directory copy would be swept into main-repo typechecking; any such copy must be a dot-dir or live outside the repo entirely — Git worktrees are banned outright, doc 4 §3).

## 6 · Gaps as of the 2026-07-11 baseline (all since addressed by S1/S2 — see doc 6 §1)

1. No session/agent/orchestration code of any kind in the tooling.
2. No programmatic agent driver — no `openai`, `@openai/*`, or `@anthropic-ai/*` dependency anywhere (`package.json` verified).
3. No local-state directory convention and **no `.gitignore` entry** for one (`.gitignore` verified — `/.delivery/` must be added).
4. No delivery UI, no bidirectional channel (SSE is one-way today; decisions/messages arrive as POSTs + files).
5. No git tooling at all in `scripts/` (a fresh read-only wrapper is required precisely to keep it that way).

## 7 · Confirmed vs proposal

| Confirmed by repository evidence | Pure proposal (no repo precedent) |
|---|---|
| Server/SSE/mutation patterns to extend; client.js extension points (§2); checkbox/task identity model (§3); skills as capability prompts; AGENTS.md/CLAUDE.md rule inheritance; vitest harness + `tests/` precedent; house plan format + ★ index registration; localhost security posture | Session store layout, state machine, deterministic classifier, **central agent registry + Agent Catalog**, detached runner process, provider-neutral driver + both SDK integrations, message composer & boundary semantics, agent-output cards, **New Delivery Session flow**, UAT package format, git-read-only wrapper |
