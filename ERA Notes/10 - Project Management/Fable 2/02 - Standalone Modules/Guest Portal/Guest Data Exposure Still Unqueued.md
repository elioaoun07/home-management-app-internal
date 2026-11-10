---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Route source read; RLS facts are from the committed 97-day-old snapshot, not the live database."
---

# Guest Portal — a known data exposure that was in no queue

[Fable 2 index](<../../_index.md>) · items: [HUB-118](<../../../Hub & ERA/Hub & ERA — Master Book.md#hub-118>), [HUB-122](<../../../Hub & ERA/Hub & ERA — Master Book.md#hub-122>) · source study: [Major Bug Sweep S1](<../../../Research/Major Bug Sweep.md#s1>), [G1](<../../../Research/Major Bug Sweep.md#g1>)

## What is already known

The 2026-11-04 sweep reported that `GET /api/guest-portal/allergies?tag_id=…&all=true` and the same branch in `drinks` return every guest's name, allergies and drink choices with no authentication, and that the tag id is handed to every guest by the session route. It assigned HUB-118 and wrote the fix, the test and the UAT.

## What this pass adds

1. **Re-verified.** `src/app/api/guest-portal/allergies/route.ts:14-18` reads `all`, creates `supabaseAdmin()` and never calls `getUser()`. The defect is present at 8da80ae.
2. **It had no owner.** HUB-118 existed only as bold text in the research file: no checklist line, no criteria section. It is filed now ([Research-to-Queue Leak](<../../10 - Project Management/Portfolio/Research-to-Queue Leak.md>)).
3. **The database layer does not help.** In the committed snapshot `guest_drinks` has row level security **disabled**, and `guest_allergies`, `guest_sessions`, `guest_chat_messages` and `guest_feedback` have it enabled with no policies, which is correct only while every access goes through the service role. So the routes are the only control, and all seven guest routes are public, service-role, without Zod and without a test ([module matrix](<../_Module Evidence Matrix.md>)).
4. **It is health data about people outside the household.** That makes it the most sensitive exposure found in the repository, ahead of anything in the money modules, where the two users already share most data.

## Recommendation

- Promote HUB-118 to Now. The fix is small: move the `all=true` branches behind an authenticated host route and drop the parameter from the public ones.
- Treat HUB-122 (active-tag check, forced sender, message length) as the same session's follow-up.
- Ask the owner to refresh `migrations/db-state.json` first, so the fix can state whether `guest_drinks` is still open at the database layer. If it is, the migration that enables RLS on it belongs in the same change (Hard Rule 24; the owner applies it).
- Route tests for the three roles (anonymous, other host, owning host) are the acceptance evidence. They also become the first rows of the service-role contract in [R90](<../../../PM Tooling/PM Tooling — Master Book.md#r90>).

## Tier

High tier or mid tier with review: authentication and a privacy boundary, in the [Local lane](<../../10 - Project Management/Delivery/2 - Local Lane Design.md>) risk list.
