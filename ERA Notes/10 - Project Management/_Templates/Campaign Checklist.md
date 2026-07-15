---
created: 2026-07-15
updated: 2026-07-15
type: template
status: template
owner: Elio
tags:
  - pm/template
---

# <Campaign> · 4 — Checklist

> **Template.** Copy to `<Campaign>/4 - Checklist.md`, set frontmatter `type: checklist`, `status: active`, `updated:`, and swap `<PREFIX>` for the campaign prefix (see [_Conventions §5](<../_Conventions.md>)). Grammar: [_Conventions](<../_Conventions.md>). Validate with `pnpm pm:lint`.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.

---

## Now

- [ ] **<PREFIX>-1** Clear, verifiable outcome → `src/path/if/any.ts` _(blocker - M)_

## Next

- [ ] **<PREFIX>-2** The next queued outcome _(friction - S)_

## Later

- [ ] **<PREFIX>-3** A real but deferred item _(parked - M)_

## Definition of Done

- [ ] **D1** The concrete, testable condition that means this cycle is done.
