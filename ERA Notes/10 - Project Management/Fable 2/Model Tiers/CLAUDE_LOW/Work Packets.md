---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Packets are proposals; the checklists own priority."
---

# CLAUDE_LOW — work packets

[Routing rules](<../_Routing.md>) · [Fable 2 index](<../../_index.md>)

Use this tier when the change is one file or the same edit repeated, and a grep or a single test proves it.

## Filed items

| Packet | Item | The whole change | Proof |
|---|---|---|---|
| L1 | R84 | Add the `mcp__Supabase__*` write tools to the deny list beside the existing `mcp__claude_ai_Supabase__*` entries in `.claude/settings.json`; update `Database RLS Posture.md` §Agent access | Both name sets appear in the deny list |
| L2 | BUD-95 | Replace the `Cache-Control` value in `src/app/api/transactions/route.ts` with `private, no-store`, add `Vary: Cookie`, add a route test | The test passes; `grep -rn "s-maxage" src/app/api` returns nothing |
| L3 | NOTIF-22 | One `isCronAuthorized(req)` in `src/lib/`, used by all six cron routes | Test: secret unset and `Bearer undefined` gives 401 on each |
| L4 | KIT-28 | Use `toIlikeTerm` (`src/lib/catalogue/itemPatch.ts`) in `src/app/api/recipes/route.ts` | Search for `a, b (c)` returns results or an empty list, not an error |
| L5 | R91 | Set `NODE_OPTIONS=--max-old-space-size` in the `typecheck` script | `pnpm typecheck` exits 0 in a 15 GB container |
| L6 | R88 | Fix or reword the 17 broken evidence links; add `pnpm pm:check-docs` to `.github/workflows/ci.yml` | `pnpm pm:check-docs` exits 0 |

BUD-95 and NOTIF-22 are in risk domains; the change is trivial but the owner still reviews the diff.

## Proposed, not filed

Small mechanical passes with no item of their own. They could ride with existing R47 (client console rule) as one session:

- Replace the 3 `type="number"` inputs outside `src/components/ui` (Hard Rule 19).
- Replace the 7 `navigator.onLine` references outside `connectivityManager` with `isReallyOnline()` (Hard Rule 7).
- Delete the three deprecated forwarding routes under `src/app/api/notifications/` (`daily-reminder`, `send-transaction-reminders`, `send-due`) once the owner confirms no scheduler still calls them.

## Rules for this tier

- One packet per session. No refactoring beyond the stated change.
- If the proof fails twice, stop and hand the item up a tier with what was tried.
- Never edit a file over 1,500 lines at this tier ([list](<../../04 - UI & Design/Mega-Components.md>)).
