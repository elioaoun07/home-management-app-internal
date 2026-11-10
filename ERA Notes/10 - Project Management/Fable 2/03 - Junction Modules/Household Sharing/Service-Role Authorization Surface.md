---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. `grep -l supabaseAdmin` over `src/app/api`, with eight routes inspected by their authentication and ownership lines, not read in full. The other 35 were listed, not audited."
---

# Household Sharing — the service-role authorization surface

[Fable 2 index](<../../_index.md>) · item: [R90](<../../../PM Tooling/PM Tooling — Master Book.md#r90>) · [Environments and data safety](<../../01 - Architecture/Environments and Data Safety.md>)

## Finding

43 API routes outside `cron/` create a service-role Supabase client. That client ignores row level security, so in each of those routes the only thing deciding who may read or change a row is the route's own code. The reason is legitimate and documented in the routes themselves: a user's token cannot read the partner's `household_links` row or the partner's data, so household features need the wider client. The cost is that authorization is written 43 times.

| Area | Service-role routes |
|---|---|
| guest-portal | 7 (all public) |
| trips | 6 |
| accounts (balance set, history, archives, daily) | 4 |
| items (single, actions, complete, bulk complete) | 4 |
| outfits | 3 |
| recycle-bin | 3 |
| notifications | 3 |
| transactions | 2 |
| hub | 2 |
| catalogue | 2 |
| receipts | 2 |
| categories, merchant-mappings, household, gcal callback, pm notify | 1 each |

Also `src/lib/balance.ts` uses the service role for every balance write, whichever route calls it.

## What was inspected

Eight routes were inspected by their authentication and ownership lines: `transactions/[id]`, `items/[id]`, `accounts/[id]/balance`, `household`, `categories`, `merchant-mappings`, `items/bulk/complete`, `recycle-bin/empty`. Each authenticates first and then narrows by an explicit helper (`getAccessibleAccount`, `canMutateItem`, `resolveScope`, `getActiveHouseholdPartnerId`) or by `eq("user_id", …)`. Nothing wrong showed in those lines. That is a shallow sample, not a clearance: the sweep's M3 (BUD-91) found four money routes that pass a client-supplied `account_id` to the service-role balance writer, and S1 (HUB-118) found two guest routes with no check at all.

## Why it is fragile

- **Five different helpers and several inline lookups** decide household access. The sweep's H1 (HUB-121) shows they disagree when a user has two active link rows.
- **Helper coverage is uneven.** `src/lib/accountAccess.ts` has a dedicated test; `src/lib/tripAccess.ts` has none.
- **Nothing lists the routes.** A new route that imports `supabaseAdmin` joins the surface without anyone deciding it should.
- **The database cannot catch a mistake**, because the client that makes it bypasses the database's rules.

## Proposal (R90)

One table-driven contract test, in the style of `src/features/era/artifacts.contract.test.ts`:

1. The test enumerates every route file importing `supabaseAdmin` and fails if one is missing from the table. Adding a service-role route then forces a row.
2. Each row declares the route's access rule: public, owner only, owner or partner, host of tag.
3. For each row the test calls the handler as anonymous, as an unrelated user and as the partner, with the database mocked, and asserts 401, 403 or 404, or the allowed result, before any write helper is called.

This does not replace HUB-121 (one link resolver) or BUD-91; it makes both verifiable and keeps the surface from growing unnoticed.

## Tier

High tier to design the table and the mocking seam; mid tier to fill rows once the first five pass. See [Model Tiers](<../../Model Tiers/_Routing.md>).
