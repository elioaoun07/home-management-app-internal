---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/setup
---

# Setup & Onboarding · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> The organizing test: **"your laptop dies on a Tuesday — how long until the app runs and the agent steers again?"** Every gap below is a place that answer is "unknown."

---

## 🔴 G1 — No new-machine bootstrap

Clone → pnpm install → …then what? Which env vars (ENV.md's list current?), which Supabase project config, VAPID keys, Azure region, cron secrets, hook execution on Windows (sh scripts via Git Bash?), Obsidian vault opening. None written. The knowledge exists in exactly one head and one working machine — the definition of bus factor 1.

## 🔴 G2 — Voice/Azure setup lives in an AI memory file, not the vault

The most fragile subsystem (6 moving parts: keys, region, token route, worklet file, AudioContext unlock, wake-model flag) has its accurate documentation in *Claude's memory* while the vault doc lags the May overhaul. An env rotation breaks voice with no human-readable recovery path. ([Hub & ERA FABLED 2.2 · G5](<../../10 - Project Management/Hub & ERA/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>) — flagged there for weeks.)

## 🟠 G3 — No CI

Husky covers commits from the one configured machine; nothing verifies the repo *itself* builds/tests green independent of local state. Plans keep writing "green in CI" ([FAR Checklist FABLED 2.2 · G5](<../../10 - Project Management/FAR Execution Checklist/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)); the workflow file doesn't exist. One 20-line GitHub Action closes it.

## 🟠 G4 — Backup/restore is unverified faith

Supabase backups presumably exist on the platform; nobody has ever *restored* one, and the repo-fidelity gap (Trips RPCs live-only) means a restore-from-schema.sql wouldn't reproduce the DB anyway. The RPC snapshot ([Trips FABLED 2.3 · O1](<../../10 - Project Management/Trips/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)) is half the fix; a documented restore drill is the other half.

## 🟡 G5 — Six credentialed services, zero rotation runbooks

What breaks when the Gemini key rotates? (AI features degrade — where's the fallback verified?) Azure key? (voice dies — G2.) VAPID? (all push subscriptions invalidate — does the app re-subscribe?). Each deserves three lines: what breaks, how to rotate, how to verify.

## 🟡 G6 — The AI setup has no smoke test

After a hook edit or a Claude settings change, nothing verifies the stack still fires (do hooks execute? does docs:check run? do mirrors sync?). The blueprint doc (PM file 6) audits the *design*; nothing audits the *runtime*.

## ⚪ G7 — ENV.md freshness unknown

June added surfaces touching env (`analysis_report` flows, wake-model flag, PM server port?). Whether ENV.md tracks them is unverified — one diff pass against `process.env` usage closes it.
