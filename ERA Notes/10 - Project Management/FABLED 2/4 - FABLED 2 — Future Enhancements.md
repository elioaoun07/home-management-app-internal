---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/meta
---

# Project Management · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**
>
> The theme: turn the PM layer from *documents about the project* into *an instrument attached to it*.

---

## E1 — PM-as-data ⭐ (the live server's real destiny)

**Impact: High · Effort: M (the hard part is already in flight)**

The uncommitted `pm-server.mjs` + mutations stack already treats markdown as a mutable store. Take the next step: standardize frontmatter (`status`, `verified`, `severity`, `module`) so the dashboard can *query* instead of parse-by-shape — "all 🔴s across campaigns," "items unverified for 30+ days," "checklist items with no campaign owner." The markdown stays human-first (Obsidian remains the editor); the frontmatter makes it machine-second. **Kill criterion:** if a frontmatter field isn't queried by any dashboard view within a month, drop the field — schema without consumers is ceremony.

## E2 — The reconciliation report (closes [G7](<2 - FABLED 2 — Gaps & Missing.md>))

**Impact: High (kills the staleness class) · Effort: M**

One script, run by `pnpm pm:dashboard`: compare *claims* against *reality* — test count claimed vs `vitest` output, "no vault doc" claims vs directory listing, LOC claims vs `wc -l`, "route exists" vs filesystem. Output a drift section on the dashboard: "Feature State says X, repo says Y (checked today)." The FABLED 2 recon that produced this folder did exactly this by hand; E2 makes it a button.

## E3 — Auto-delta from git (the changelog nobody has to write)

**Impact: Med–High · Effort: S–M**

`git log --since` + the touched-paths → module mapping that already exists in the Feature Map → a generated weekly "what actually changed, per module" digest, dropped into the weekly plan draft each Monday. Cuts the Monday re-planning cost and makes the unplanned-sprint pattern (June's Budget detour) visible the week it happens, not the month after.

## E4 — The decision log

**Impact: Med (compounds) · Effort: S**

Decisions are currently sentences inside campaign prose ("recurring_payments deliberately NOT paused," "legacy queue is sanctioned," "private totals derivable — accepted"). One flat `Decisions.md` (date · decision · why · where enforced · revisit-when), linked from campaign files instead of restated. The Trips near-misses ("a well-meaning pause-everything change would break a deliberate decision") show why: decisions that live only in prose get re-litigated by every future reader — including AI agents.

## E5 — PM signals into ERA (the app manages its own project)

**Impact: Novel · Effort: S once the briefing composer exists**

The household app already has a briefing pipeline aimed at life admin; the project *is* life admin for this household. A `getPmBriefingSignals()` over the frontmatter layer (E1): "the hygiene sweep is due — 6 items queued," "Trips has been frozen 3 weeks; its revisit trigger fired," "one authority file is 30 days stale." Delivered through the same policy engine as everything else ([Notifications FABLED 2.4 · E1](<../Notifications & Alerts/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)). The app reminding you to maintain the app is the proactive thesis eating its own dogfood.
**Kill criterion:** if these signals get dismissed like noise for two weeks, the PM layer isn't ready for push — keep them dashboard-only.

---

## Recommended order

```
E1 (frontmatter + committed server) → E2 (reconciliation) → E3 (git delta)
  → E4 (decision log, one sitting) → E5 (after the composer + policy engine exist)
```
