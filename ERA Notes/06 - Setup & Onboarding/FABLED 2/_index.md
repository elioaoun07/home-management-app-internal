---
created: 2026-07-02
type: index
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/setup
---

# Setup & Onboarding · FABLED 2 — Index

> The deep-dive audit of **everything that makes the project runnable and steerable**: environment, tooling, the AI-agent setup (hooks/skills/memory/instructions), and the recovery paths when a machine or a credential dies. Verified **2026-07-02**.

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You want the setup inventory — including the AI steering stack, which is this repo's real differentiator. |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want the recovery-path holes (the "new laptop on a Tuesday" test). |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You want the runbook and bootstrap moves. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You want the setup-layer bets (doctor script, CI floor, seeded env). |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **AI steering stack** | 8 | CLAUDE.md + Feature Map routing + 6 hooks + 3 skills + auto-synced mirrors + persistent memory — among the most complete agent setups anywhere. |
| **Env documentation** | 6 | `docs/ENV.md` exists; voice/Azure setup lives in a memory file instead of the vault. |
| **Recovery paths** | 3 | No new-machine bootstrap doc, no key-rotation runbook, wake-word/voice setup undocumented, backups unverified. |
| **Verification floor** | 4 | Husky pre-commit (docs:check, mirrors) real; **no CI** — "green in CI" appears in plans but no workflow exists. |
| **Overall** | **5.3** | Excellent daily steering; fragile disaster story. |

## The next 3 moves

1. **The voice/Azure runbook** — the known-worst doc gap ([Hub & ERA FABLED 2.3 · O4.3](<../../10 - Project Management/Hub & ERA/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).
2. **Minimal CI** — one workflow: `pnpm test` + `docs:check` ([FAR Checklist FABLED 2.3 · O3](<../../10 - Project Management/FAR Execution Checklist/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).
3. **The bootstrap checklist** — clone → running app, written while the memory is fresh ([file 3 · O2](<3 - FABLED 2 — Optimization Plan.md>)).
