---
created: 2026-05-29
type: weekly-plan
status: active
owner: Elio
week_of: 2026-06-01
tags:
  - pm/weekly
  - scope/cross-cutting
---

# 4 · This Week — Action Plan

> **Command Center:** [1 · Setup Audit](<1 - Codebase & AI Setup Audit.md>) · [2 · Feature State](<2 - Feature State — Current Reality.md>) · [3 · Future Vision](<3 - Future Vision & Roadmap.md>) · [4 · This Week](<4 - This Week (Action Plan).md>)
>
> **Week of Mon 1 Jun → Sun 7 Jun 2026** (drafted Fri 29 May). This is the synthesis of files 1–3 into "what I actually do next." Re-draft this file each week.

---

## 📌 The call

**Theme: "Stabilize, then Connect."**

You are not short of features — you're short of a *safety net* and *documentation that matches your code* (file 1). Shipping module #41 onto zero tests + drifted AI rules is the real risk. So this week is **80% hardening, 20% reward**: pay down the top risks, *then* land one high-ROI bridge so the week still ships something users feel.

This is the honest recommendation, not the exciting one — but it's the difference between a project you can keep accelerating and one that starts fighting you. If you'd rather spend the week on a new module instead, say so and I'll re-plan; just know you'd be doing it blind to regressions.

**Non-negotiable this week:** commit Trips (it's uncommitted — you could lose it), and stand up a thin test suite around money math.

---

## 🟢 This weekend (29–31 May) — 30-min pre-flight (optional)

- [ ] **Commit the Trips module.** It currently lives only in your working tree (`src/app/trips/`, `src/features/trips/`, `src/components/trips/`, schema changes). One bad `git` command and it's gone. Commit before anything else.
- [ ] Skim files 1–3 so the week's plan makes sense.

---

## 🗓️ Day by day

### Mon — Lock down what's already built
- [ ] **Verify Trips end-to-end** (manual): create → activate (auto-account + schedule side-effects fire) → complete (RPC). Confirm the activation/completion cascades actually run. *Trips is a Junction touching Budget + Items + Chores — untested cascades are the scariest kind.* → `/verify`
- [ ] **Clean structural debt** (15 min): delete `src/features/blink/`, `src/features/today/`, `src/app/temp/page.tsx`; move `navigation/prefetchTabs.ts` + `dashboard/prefetchDashboard.ts` → `src/lib/prefetch/`. *(file 1 §3)*
- **DoD:** Trips works through its full lifecycle; orphan dirs gone; build green.

### Tue–Wed — The safety net (P0)
- [x] `pnpm add -D vitest @vitest/ui` + a `"test": "vitest run"` script.
- [x] Write **~15–20 unit tests** on the money/date core (no UI, fast):
  - `src/lib/balance-utils.ts` — balance direction per account type (expense/income/saving), running balance.
  - `src/lib/utils/date.ts` — `startOfCustomMonth`, timezone/DST edges.
  - Recurring **next-due** calculation (the auto-post brain).
  - Split-bill math.
- [x] Make tests run in `pre-commit` (after tsc, before/with ESLint).
- **DoD:** `pnpm test` green; a deliberately broken balance calc turns a test red. *This is the highest-leverage thing you do all month.*

### Thu — Enforce your own rules + close the doc gap
- [ ] **Console sweep, phase 1:** remove `console.*` from the worst offenders (`src/app/api`, `components/web`, `components/expense`). Route anything worth keeping through Error Logs. *(Don't enable the `no-console` lint rule yet — finish the sweep first or it blocks every commit.)*
- [ ] **Write the 5 missing Overview docs** (short — use the template): **Dashboard, Chores, Focus, AI Usage, Recycle Bin**. Add each to the CLAUDE.md Feature Index + Atlas. *(file 2 — these modules ship but have no map.)*
- **DoD:** API/web/expense dirs are console-free; 5 docs exist and are linked.

### Fri — One reward bridge + wrap
- [ ] **Ship Track A bridge #1: Inventory → Shopping List.** When an item hits its low-stock threshold, auto-draft (or prompt to add) a shopping-list entry. Reuses existing data; ~half a day. *(file 3 / backlog 2a)* → remember Hard Rule 1 (Undo toast) + `safeFetch`.
- [ ] **Write a session note** in `ERA Notes/08 - Sessions/Features/` — the folder you flagged as empty. Make filling it a habit; this is the first one.
- [ ] Re-draft this file for next week (carry-over below).
- **DoD:** low-stock auto-suggests a shopping item with an Undo toast; first session note written.

---

## ✅ Definition of done — the week

- [ ] Trips committed **and** verified through activate/complete.
- [ ] `pnpm test` exists and is green; money/date core covered.
- [ ] AI mirrors in sync (done this pass) — confirm `AGENTS.md` == `CLAUDE.md`.
- [ ] 5 missing module docs written + indexed.
- [ ] Console count materially down in the 3 worst dirs.
- [ ] One Track-A bridge shipped.
- [ ] First session note written.

---

## 🚫 Explicitly NOT this week

- ❌ No new module (Cashflow Forecast, Subscriptions, etc.) — that's *after* the net exists. *(file 3)*
- ❌ Don't enable `no-console` as an ESLint **error** yet (sweep isn't finished → would block commits).
- ❌ Don't refactor `HubPage.tsx` / `MobileExpenseForm` "just because" — only when you next touch them.
- ❌ Don't chase the 522 `any`s — add a *warning* later and chip away passively.

---

## ⏭️ Carry-over / next week preview

- Track A bridges #2–#4: Recipe↔Inventory, Recurring→Budget, Debt→Reminder. *(file 3 Track A)*
- Console sweep phase 2 → then flip on `no-console` ESLint rule.
- Stand up the `/session-log` and `/new-module` skills (file 1 §5) so docs/notes stop lagging code.
- Begin Track B: enrich the Focus/ERA briefing with cross-module data. *(file 3)*

---

## One-glance checklist

```
WEEKEND  [ ] commit Trips
MON      [ ] verify Trips lifecycle   [ ] delete orphans/temp
TUE/WED  [x] vitest + money/date tests  [x] test in pre-commit
THU      [ ] console sweep (api/web/expense)  [ ] 5 module docs
FRI      [ ] Inventory→Shopping bridge  [ ] first session note  [ ] re-plan
```
