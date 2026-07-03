---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/setup
---

# Setup & Onboarding · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## O1 — Write the voice runbook (fixes G2; 30 minutes, from the memory file)

Transcribe the accurate memory (`project_voice_conversation`) into `Hub Chat/Voice Conversation.md`: env vars, token route + 9-min cache, worklet file location, AudioContext unlock, lazy SDK rule, wake-model upgrade path. The single worst doc gap in the repo, fixable today.

## O2 — The bootstrap checklist (fixes G1; write it *without* a dead laptop first)

One `Setup — New Machine.md` in this directory: prerequisites (node/pnpm versions, Git Bash for hooks) → clone → env vars table (from O5's refreshed ENV.md) → Supabase project pointers → first `pnpm dev` → hook verification (O4's smoke test) → vault opening. Dry-run it in a fresh directory to catch the steps memory skips.

## O3 — Minimal CI (fixes G3; 20 minutes)

One GitHub Action: install, `pnpm test`, `pnpm docs:check`, `pnpm typecheck` on push. Prerequisite: un-red the suite ([Schedule FABLED 2.3 · O1](<../../10 - Project Management/Schedule/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)) or the first run cries wolf. This unlocks every "green in CI" gate and hosts the future ratchets.

## O4 — The AI-stack smoke test (fixes G6; a script)

`scripts/check-ai-setup.mjs`: hooks present + executable, skills dirs resolve, CLAUDE.md mirrors in sync (`sync:ai --check` mode), memory dir reachable. Run after any `.claude/` edit and in the bootstrap checklist.

## O5 — ENV.md diff pass + rotation stubs (fixes G7 + G5; one sitting)

Grep `process.env` usage → reconcile ENV.md → append per-service rotation notes (three lines each: breaks / rotate / verify). The VAPID answer likely needs a 15-minute code read (re-subscription behavior) — write down whatever is found, even "unknown, TODO."

## O6 — One restore drill (fixes G4; do once, document once)

Restore the latest Supabase backup to a scratch project; run the app against it; note what's missing (the Trips RPCs will be, until their snapshot lands). An untested backup is a hope, not a plan.

---

### Sequencing

```
O1 (today) → O3 (CI, after suite un-reds) → O5 (env truth) → O2 (bootstrap, dry-run)
  → O4 (smoke script) → O6 (one drill, calendar it)
```
