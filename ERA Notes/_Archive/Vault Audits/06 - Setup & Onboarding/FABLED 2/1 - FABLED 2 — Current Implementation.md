---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/setup
---

# Setup & Onboarding · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 1 · The AI steering stack (the repo's quiet superpower — inventory verified today)

| Layer | Contents | Note |
|---|---|---|
| **Instructions** | CLAUDE.md (25 hard rules, module model, feature index) auto-synced to AGENTS.md / CODEX.md / copilot-instructions via PostToolUse hook | one source, four consumers |
| **Routing** | Feature Map (intent → files) validated by `docs:check` | the mandatory-checklist front door |
| **Hooks (6)** | `block-ui-dir` (PreToolUse) · `check-migration` · `check-pm-update` (Stop) · `pre-commit` · `sync-copilot` · `update-atlas` | every one enforces a hard rule mechanically |
| **Skills (3)** | cache-invalidation · new-module · timezone-handling | auto-invoking on file-pattern triggers |
| **Memory** | persistent project memory (color coding, RLS truth, dead-form trap, PM command center…) | cross-session context that has demonstrably prevented repeat mistakes |
| **Blueprint** | PM file 6 (`Optimized Claude Setup Structure`, audited 06-10) | the target-state doc for this stack |

This stack is why the codebase's conventions survive agent sessions: the [Architecture FABLED 2.1 §2](<../../01 - Architecture/FABLED 2/1 - FABLED 2 — Current Implementation.md>) fastener table shows hook-backed rules holding at 100%.

## 2 · Project tooling

`pnpm dev/build/test/typecheck/lint` on Next 15 + turbopack + vitest · husky pre-commit (docs:check + AI-mirror sync) · script culture: atlas build/seed, icon gen, module scaffolder, PM dashboard (+ the new live server, uncommitted), bench-journal, supabase monitor (PS), vapid keygen. `docs/ENV.md` documents env vars; `.env` reality unverified against it recently.

## 3 · This directory's docs

`Vault Setup.md` (Obsidian structure) · `Authentication Troubleshooting.md` (Supabase auth recovery — the one true runbook in the repo) · `Setup Complete.md` (historical). The *vault* is well-documented; the *machine* is not ([file 2 · G1](<2 - FABLED 2 — Gaps & Missing.md>)).

## 4 · External dependencies the setup must survive

Supabase (DB/auth/realtime) · Vercel (hosting/cron, `CRON_SECRET`) · Google Gemini (`lib/ai/gemini.ts`) · Azure Speech (STT/TTS keys + region + token route) · Web Push (VAPID keypair) · NFC physical tags (slug URLs). Six credentialed services, one documented recovery path (auth), zero rotation runbooks.
