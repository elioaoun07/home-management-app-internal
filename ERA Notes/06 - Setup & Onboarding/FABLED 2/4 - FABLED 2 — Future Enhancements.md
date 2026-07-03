---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/setup
---

# Setup & Onboarding · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**

---

## E1 — `pnpm doctor` (the setup that checks itself)

One script unifying the verification story: env vars present + shaped · Supabase reachable (`/api/health` logic reused) · hooks executable · mirrors in sync · suite green · migrations dir consistent with schema.sql mtime. First thing run on any new machine and after any config change. Absorbs [O4](<3 - FABLED 2 — Optimization Plan.md>).

## E2 — Seeded demo environment

**Impact: Med–High · Effort: M** — a `seed.mjs` producing a fictional household (accounts, transactions across months, recurring, items with recurrence, meal plans, inventory) against a scratch Supabase project. Unlocks: safe end-to-end testing (the Trips verification could run here first), screenshot/visual-regression fixtures ([UI FABLED 2.4 · E1](<../../04 - UI & Design/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)), and a demo mode that doesn't expose real finances.
**Kill criterion:** if maintaining seed realism costs more than the scratch-testing it enables, freeze the seed at "good enough for smoke tests."

## E3 — Onboarding as a product surface (the second-household test)

The app assumes its household. The day anyone else tries it (C3's personal-first stance can change), onboarding *is* the product: empty states, first-account wizard, partner linking flow, LBP-vs-USD choice. Not now — but this directory owns the audit of "what breaks with zero data," which is cheap to run once with E2's scratch project and worth recording.
**Kill criterion:** while C3 = personal-first stands (FAR decision), keep this as an audit note, not a build.

## E4 — Config-as-code for the Vercel/Supabase surface

Cron schedules, env var names (not values), Supabase settings that matter (auth providers, RLS-on defaults) recorded declaratively in the repo — so the platform config is diffable and the restore drill (O6) has a target list. Lightweight: a `docs/PLATFORM.md` table beats nothing; IaC only if a second environment ever exists.

---

## Recommended order

```
E1 (absorbs the smoke script) → E2 (unlocks safe verification) → E4 (one doc) → E3 (audit-only, gated on C3)
```
