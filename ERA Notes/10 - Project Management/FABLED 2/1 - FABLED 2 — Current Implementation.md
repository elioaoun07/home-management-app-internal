---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/meta
---

# Project Management · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> The PM machine, layer by layer, verified 2026-07-02.

---

## 1 · The five layers

| Layer | Contents | State |
|---|---|---|
| **Command center** | `_index` + files 1–6 (setup audit, feature state, vision, this-week, P0 tests notes, Claude setup) | Living; file 4 is the daily driver; files 1–2 carry stale patches ([G1](<2 - FABLED 2 — Gaps & Missing.md>)) |
| **Campaign folders** | 6 modules × uniform `1 - Feature State / 2 - Vision & Roadmap / 3 - Action Plan / 4 - Checklist` | The system's best invention — pain inventories with evidence, implemented-notes logs, severity scales |
| **Deep-dive (FABLED)** | v1 (2026-06-10, 5 campaigns) + **FABLED 2** (2026-07-02, 6 campaigns + this meta-folder + review deltas + 10 domain folders under the other ERA Notes directories) | v1 frozen as baseline; FABLED 2 is the living generation |
| **Cross-cutting reviews** | Functional Architecture Review (06-12) · FAR Execution Checklist (06-12) · Codebase Audit (07-01) | Point-in-time; each now carries a FABLED 2 delta file |
| **Tooling & enforcement** | `_dashboard.html` (`pnpm pm:dashboard`) · **new:** `scripts/pm-server.mjs` + `scripts/pm/` (live server: scan/mutations/UI) + `tests/pm-mutations.test.ts` · hooks: `check-pm-update.sh` (Stop), `check-migration.sh`, `block-ui-dir.sh`, `update-atlas.sh`, `sync-copilot.sh`, pre-commit `docs:check` | Hooks battle-tested; the server stack is **uncommitted work-in-progress** (git status, 07-02) |

## 2 · What demonstrably works (keep, and say why out loud)

- **Hard Rule #25 + the Stop hook** — fixes get PM traces *in the same session*; the Budget campaign's Implemented Notes (June has ~20 dated, root-caused entries) are the receipt. This is rare discipline and it's mechanical, not aspirational.
- **The pain-inventory format** (`Pain → Why → Root cause → Evidence → Severity`) — the Notifications and Schedule campaigns prove it: the 🔴 routing bug and the Skip-duplicates bug were both *found by writing the inventory* and fixed within days.
- **Corrections stay on the record** — the Schedule RLS myth-bust preserves the wrong claim struck-through with the verification that killed it. That's how a knowledge base earns trust.
- **The uniform layout** — six campaigns, one mental model. The June reorganization cost (link rot) was worth it; the shape is right.
- **Verification culture** — `_verify_schedule_rls.md`, verify-then-claim dates, "⚠️ confirm in Supabase" markers. FABLED 2 extends this into a convention (every claim carries its check).

## 3 · The dashboard tooling (new since v1 — becoming real software)

`build-pm-dashboard.mjs` renders `_dashboard.html`; the in-flight `pm-server.mjs` + `scripts/pm/{scan,mutations,ui}.mjs` + `client.js` add a live-served dashboard with **mutations** (checkbox toggles writing back to markdown, per the test file's name) and a zero-dependency scanner. With `tests/pm-mutations.test.ts` this is the first *tested* PM code. Once committed, the PM layer stops being static markdown and starts being an app over markdown — the significance is in [file 4 · E1](<4 - FABLED 2 — Future Enhancements.md>).

## 4 · The numbers (how big is the machine)

~80 markdown files under `10 - Project Management/` before FABLED 2; ~135 after. Six campaign folders, three reviews, six command-center files, two generations of deep-dive. Maintenance load is the design's known cost — [file 2](<2 - FABLED 2 — Gaps & Missing.md>) is honest about where it already shows.
