---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Source read only. The deployed response headers and the hosting CDN's behaviour were not observed."
---

# Transactions — the authenticated read is marked publicly cacheable

[Fable 2 index](<../../_index.md>) · item: [BUD-95](<../../../Budget/Budget — Master Book.md#bud-95>) · [Module matrix](<../_Module Evidence Matrix.md>)

## Finding

`GET /api/transactions` authenticates the caller with the session cookie, returns that user's (and, by household rules, the partner's) transactions, and sends:

```text
Cache-Control: public, s-maxage=60, stale-while-revalidate=300
```

Source: `src/app/api/transactions/route.ts:32-35`. It is the only API route in the repository that sets a shared-cache directive; 133 other lines under `src/app/api` set `private` or `no-store`, and the two newest routes also send `Vary: Cookie` (`src/app/api/era/ask/route.ts:295`, `src/app/api/activity-log/route.ts:11`).

`public` with `s-maxage` tells any shared cache between the browser and the server that it may store the body and replay it for the same URL. The URL carries only `start`, `end` and `limit`; identity is in the cookie, which a shared cache does not key on unless told to. The response has no `Vary` header.

## Why it matters

| Risk | When it bites |
|---|---|
| **One user's transactions served to another.** Both household members request the same dashboard range, so their URLs are identical. A cache hit returns whichever body was stored first, bypassing `ownOnly`, private accounts and split visibility | If the hosting edge honours `s-maxage` on this response. Not observed; depends on the platform's rules for function responses |
| **Stale money for up to five minutes after a write.** A cached body ignores every client-side invalidation the mutation hooks perform | Same condition |
| **Latent either way.** A hosting change, a proxy or a future `fetch` cache layer makes it real without any code change here | Always |

The Performance notes record this header as an optimisation (`ERA Notes/05 - Performance/Performance Optimizations.md`, "GET with date range, household links, `s-maxage=60`"). The client already caches this query with TanStack Query and persists it, so the header buys nothing a private cache does not.

## Fix

Replace the header with `private, no-store` and `Vary: Cookie`, matching `era/ask` and `activity-log`. One line. No behaviour change in the browser: freshness is already governed by `src/lib/queryConfig.ts`.

Also worth a look in the same file: the default `limit` is 10,000 rows (`route.ts:23`), with no upper bound on a caller-supplied value.

## Test

Route test: an authenticated `GET` returns `Cache-Control` containing `private` and not `public` or `s-maxage`, and `Vary` contains `Cookie`. Pattern: `src/app/api/activity-log/route.test.ts:68`.

## UAT

1. Deploy, open the dashboard as user A, then in DevTools → Network select the `/api/transactions` request and read the response headers. Expect `cache-control: private, no-store`.
2. Add an expense as A, reload. Expect it to appear at once.
3. Open the same range as user B. Expect only what B is allowed to see.

## Risk domain

Money read path: a review-list item under the [Local lane](<../../10 - Project Management/Delivery/2 - Local Lane Design.md>) rules, although the change is one line.
