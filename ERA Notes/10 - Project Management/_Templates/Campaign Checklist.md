---
created: 2026-07-15
updated: 2026-09-10
type: template
status: template
owner: Elio
---

# Campaign Checklist template

Copy the fenced content to `<Campaign>/4 - Checklist.md`. Replace placeholders, allocate unused lifetime IDs, remove unused example rows, and keep all three lanes. See [Conventions](<../_Conventions.md>). PM Tooling IDs use `R52`, not `R-52`.

```md
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: checklist
status: active
owner: Elio
---

# <Campaign> — Backlog

> [Master Book](<<Campaign> — Master Book.md>) · [PM home](<../_index.md>)
> Order: <first prerequisite → next outcome>. Held work is labelled; acceptance lives in the book.

## Now

- [ ] **PREFIX-1** Verifiable next outcome → [Scope](<<Campaign> — Master Book.md#prefix-1>) _(friction - S)_

## Next

## Later

- [ ] **PREFIX-2** HELD — Decide the unresolved scope → [Scope](<<Campaign> — Master Book.md#prefix-2>) _(parked - S)_
```

Only executable implementation, investigation or automated verification belongs here. Move completed implementation into Done even when owner UAT is pending; retain manual test results in a UAT document. Do not copy owner acceptance checkboxes, research sheets, completed tasks or duplicate cross-campaign outcomes into this queue. Run `pnpm pm:lint` and `pnpm pm:check-docs` after filling it.
