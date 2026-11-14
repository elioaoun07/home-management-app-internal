---
created: 2026-07-15
updated: 2026-11-11
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

# <Campaign> — Checklist

[Master Book](<<Campaign> — Master Book.md>) · [All campaigns](<../_index.md>) · [Grammar](<../_Conventions.md>)

**Now** is this week's sprint. **Next** is the ordered queue. **Later** is parked or conditional. Each ID links to its acceptance. Finish one with `pnpm pm:ship <ID>`.

## Now

## Next

**Needs you**

- [ ] **PREFIX-1** Run the migration and witness the result on both phones — [criteria](<<Campaign> — Master Book.md#prefix-1>) _(blocker - S)_

**<Theme>**

- [ ] **PREFIX-2** Verifiable next outcome — [criteria](<<Campaign> — Master Book.md#prefix-2>) _(friction - S)_

## Later

**Parked**

- [ ] **PREFIX-3** HELD — DEC-00 — Decide the unresolved scope — [criteria](<<Campaign> — Master Book.md#prefix-3>) _(parked - S)_
```

Now stays empty until an item joins the current sprint. Group rows under a bold label on its own line; `**Needs you**` is reserved for rows only the owner can close. Keep notes out of the lanes: progress and evidence go in the item's Master Book section. Do not copy research sheets, completed tasks or another campaign's outcome into this queue. Run `pnpm pm:lint`, `pnpm pm:check-docs` and `pnpm pm:index` after filling it.
