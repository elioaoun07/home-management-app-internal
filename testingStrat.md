# Testing Strategy

Status: initial Vitest baseline added on 2026-05-29.

## Commands

```bash
pnpm test
pnpm test:watch
pnpm test:ui
pnpm typecheck
```

`pnpm test` runs `vitest run` and is wired into the Husky pre-commit path through `.claude/hooks/pre-commit.sh`.

## Current Baseline

- Unit test runner: Vitest.
- Test location: colocated `*.test.ts` files near the pure utilities they cover.
- First covered areas:
  - `src/lib/balance-utils.ts`
  - `src/lib/utils/date.ts`
  - `src/lib/recurring.ts`
  - `src/lib/utils/splitBill.ts`

## Rules

- Critical calculations get unit tests before broad UI tests.
- Prefer pure utility tests first; they are fast and low-maintenance.
- API routes should be tested with mocked Supabase clients.
- Money and date regressions are priority test targets.

## Implementation Notes

See `ERA Notes/10 - Project Management/5 - P0 Automated Tests Implementation Notes.md` for the detailed approach, what worked, what did not, and the verification log.
