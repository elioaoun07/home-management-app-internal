Yes — these are **good skills**. They are much better than generic “write code / fix bug / add feature” instructions because they force the AI to follow your app’s actual rules.

But they are currently **too engineering-process focused** and not enough **budget-app/domain focused**.

Your current skills answer:

> “How should the AI safely change code?”

But your budget app also needs skills that answer:

> “How should the AI avoid breaking money, balances, recurring commitments, mobile speed, offline behavior, and household visibility?”

That second part is missing.

## My verdict on your current skills

| Skill           | Keep? | Comment                                                                                                                                                                          |
| --------------- | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start-task`    |   Yes | Very good entry point. But “verify every assumption with a tool call” may be too strict. Better: verify every **file, schema, API, cache, and existing pattern** before editing. |
| `fix-bug`       |   Yes | Excellent. Evidence-first debugging is exactly what coding agents need.                                                                                                          |
| `add-feature`   |   Yes | Very good. The strict slice order is useful.                                                                                                                                     |
| `api-route`     |   Yes | Keep it. API routes are a common source of auth/status/RLS mistakes.                                                                                                             |
| `db-migration`  |   Yes | Very important for Supabase/RLS.                                                                                                                                                 |
| `ui-guardrails` |   Yes | Keep. Your app is mobile-first and visual consistency matters.                                                                                                                   |
| `finish-task`   |   Yes | Essential. This prevents “looks done but broke something else.”                                                                                                                  |

So: **do not remove these.**
But I would add more.

---

# The biggest missing skills

## 1. `money-logic`

This is the most important missing one.

Your app is a **budget app**, so money correctness needs its own skill.

Covers:

| Area                    | Why it matters                                     |
| ----------------------- | -------------------------------------------------- |
| Wallet balance          | Must never become inconsistent.                    |
| Account balance         | Must match transactions, transfers, commitments.   |
| Category envelopes      | Must not double-count or disappear.                |
| Salary → Wallet funding | Core flow you recently mentioned.                  |
| Recurring commitments   | Must affect “available” money correctly.           |
| Transfers               | Must not look like income/expense unless intended. |
| Rounding/decimals       | Money bugs are silent and dangerous.               |

Invoke:

```text
/money-logic
```

Description:

```text
Budget-domain correctness skill: before editing any expense, income, wallet, account, transfer, recurring commitment, category envelope, or allocation logic, trace the full money movement. Prove expected before/after balances with examples, check rounding/decimal handling, confirm no double-counting, and add/update tests for the affected financial calculation.
```

This should be mandatory for anything touching:

```text
expenses
income
wallet
accounts
transfers
recurring payments
salary
categories
envelopes
available balance
forecast balance
```

---

## 2. `cache-state`

You already had issues like stale “matched transaction” caching. This deserves its own skill.

Covers:

| Area                         | Why it matters                                    |
| ---------------------------- | ------------------------------------------------- |
| React Query / TanStack cache | Stale UI bugs.                                    |
| Local storage                | Old matched transaction / form state can survive. |
| Offline cache                | False stale data.                                 |
| Service worker cache         | PWA can show old JS/API responses.                |
| Optimistic updates           | Can desync UI from DB.                            |
| Query invalidation           | Must be exact after mutations.                    |

Invoke:

```text
/cache-state
```

Description:

```text
State and caching skill: diagnose stale UI, cached transaction matches, offline/online inconsistencies, React Query invalidation, localStorage/sessionStorage/IndexedDB/service-worker cache, optimistic updates, and mutation refresh rules. No code edits until the exact cache owner and invalidation path are identified.
```

This is very important for your app because you care about **speed**, but speed usually creates caching bugs.

---

## 3. `offline-pwa`

Your app is mobile/PWA-first, so offline behavior needs its own skill.

Covers:

| Area                                 | Why it matters                                  |
| ------------------------------------ | ----------------------------------------------- |
| `navigator.onLine` false assumptions | You already know not to trust it.               |
| Real connectivity checks             | Prevents false offline state.                   |
| PWA install behavior                 | Android/iOS differ.                             |
| Service worker updates               | Manifest/service worker cache issues.           |
| Background reminders                 | PWA limitations.                                |
| Sync queues                          | Needed for fast capture when connection is bad. |

Invoke:

```text
/offline-pwa
```

Description:

```text
Mobile/PWA/offline skill: verify install behavior, service worker cache, manifest changes, offline queue behavior, real connectivity detection, mobile browser differences, shortcut/deep-link behavior, and whether the requested behavior is possible in a PWA before implementing.
```

This would have helped with things like NFC links, PWA opening behavior, reminder limitations, and cache issues.

---

## 4. `rls-auth`

You already have `db-migration`, but RLS/auth bugs are important enough to separate.

Covers:

| Area                      | Why it matters                         |
| ------------------------- | -------------------------------------- |
| User ownership            | Prevents cross-user data leaks.        |
| Household visibility      | Your app uses household sharing.       |
| `auth.uid()` policies     | Common Supabase bug source.            |
| Service role usage        | Must be limited to server routes/cron. |
| 401 vs 403 vs 404         | Important API contract.                |
| Hot-table RLS performance | Avoid slow `EXISTS` subqueries.        |

Invoke:

```text
/rls-auth
```

Description:

```text
Supabase auth and RLS skill: before changing protected data access, prove user ownership, household visibility, API auth gates, service-role usage, and RLS policy behavior. Check that the route returns correct 401/403/404/409 statuses and avoids slow RLS patterns on hot child tables.
```

This should be used whenever touching:

```text
accounts
expenses
items
household_links
reminders
shared data
API auth
cron jobs
```

---

## 5. `recurring-engine`

Recurring payments, commitments, future drafts, unpaid/covered status, monthly projections — these are risky.

Covers:

| Area                 | Why it matters                      |
| -------------------- | ----------------------------------- |
| Monthly commitments  | Affect available wallet balance.    |
| Future schedules     | Date/time bugs.                     |
| DST/timezone         | Asia/Beirut matters.                |
| Covered/unpaid logic | Business-critical.                  |
| Auto-posting         | Can duplicate transactions.         |
| Draft generation     | Can create hidden financial errors. |

Invoke:

```text
/recurring-engine
```

Description:

```text
Recurring commitments skill: verify recurrence rules, due dates, timezone behavior, monthly projections, covered/unpaid state, generated drafts, auto-posting, duplicate prevention, and wallet/category impact before editing recurring-payment logic.
```

This is especially important because recurring commitments are central to your “intentional money flow.”

---

## 6. `fast-entry`

Your app’s success depends on whether entering an expense is almost effortless.

Covers:

| Area                     | Why it matters                               |
| ------------------------ | -------------------------------------------- |
| Manual expense entry     | Must be extremely fast.                      |
| Merchant-map             | Useful but secondary.                        |
| Defaults                 | Account/category/payment method suggestions. |
| Mobile keyboard behavior | Huge UX impact.                              |
| Decimal input            | Common mobile bug.                           |
| Undo toast               | Safer than confirmation modals.              |
| One-handed use           | Important for real adoption.                 |

Invoke:

```text
/fast-entry
```

Description:

```text
Fast capture skill: optimize expense/income entry for minimum taps, mobile-first input, keyboard behavior, decimal safety, useful defaults, merchant/category/account suggestions, undo instead of blocking confirmations, and zero-lag perception.
```

This is not just UI. This is the heart of your product.

---

## 7. `tests-finance`

You have `finish-task`, but finance tests should be stricter.

Covers:

| Area               | Why it matters               |
| ------------------ | ---------------------------- |
| Balance tests      | Prevent silent money bugs.   |
| Transfer tests     | Avoid false income/expense.  |
| Recurring tests    | Avoid duplicate generation.  |
| Date tests         | Prevent monthly cutoff bugs. |
| RLS tests          | Prevent household leaks.     |
| API contract tests | Prevent wrong status codes.  |

Invoke:

```text
/tests-finance
```

Description:

```text
Financial test skill: add or update focused tests for every changed money rule, including balance before/after, decimal precision, transfers, recurring commitments, duplicate prevention, timezone/date boundaries, API errors, and household visibility.
```

This should be invoked automatically by `money-logic`, `recurring-engine`, `api-route`, and `db-migration`.

---

## 8. `data-repair`

This is for console scripts, cleanup scripts, migrations, and fixing corrupted/cached/stale records.

Covers:

| Area                  | Why it matters               |
| --------------------- | ---------------------------- |
| Remove cached matches | Your recent issue.           |
| Fix bad records       | Production data cleanup.     |
| Backfill fields       | Common after schema changes. |
| Safe console scripts  | Avoid destructive mistakes.  |
| Dry-run first         | Must-have.                   |
| Rollback plan         | Very important.              |

Invoke:

```text
/data-repair
```

Description:

```text
Data repair skill: for console scripts, cleanup jobs, backfills, cache resets, and production data fixes. Always identify affected rows first, provide a dry-run query, make the script idempotent where possible, avoid destructive changes unless explicitly requested, and include verification queries after execution.
```

This is very useful for your current style of work because you often ask: “give me a console script to fix this.”

---

# Recommended final skill set

I would organize your skills like this:

## Core workflow skills

| Skill         | Purpose                           |
| ------------- | --------------------------------- |
| `start-task`  | Entry point and classification    |
| `fix-bug`     | Evidence-first debugging          |
| `add-feature` | Controlled feature implementation |
| `finish-task` | Definition of done                |

## Technical architecture skills

| Skill          | Purpose                                |
| -------------- | -------------------------------------- |
| `api-route`    | API route safety                       |
| `db-migration` | Schema/migration/RLS impact            |
| `rls-auth`     | User, household, service-role security |
| `cache-state`  | React Query/local/PWA cache behavior   |
| `offline-pwa`  | Mobile/PWA/offline behavior            |

## Budget-domain skills

| Skill              | Purpose                               |
| ------------------ | ------------------------------------- |
| `money-logic`      | Financial correctness                 |
| `recurring-engine` | Commitments, schedules, future drafts |
| `fast-entry`       | Expense input speed and mobile UX     |
| `tests-finance`    | Money/date/API/RLS tests              |
| `data-repair`      | Console scripts, cleanup, backfills   |

That gives you **14 skills total**.

That is a good number. Not too small, not too bloated.

---

# What I would not add yet

I would **not** add too many tiny skills like:

```text
/category-skill
/account-skill
/wallet-skill
/merchant-map-skill
/dashboard-skill
/theme-skill
```

That becomes noisy.

Instead:

| Small topic       | Covered by                     |
| ----------------- | ------------------------------ |
| Categories        | `money-logic`, `fast-entry`    |
| Wallet            | `money-logic`                  |
| Merchant map      | `fast-entry`, `cache-state`    |
| Dashboard         | `money-logic`, `ui-guardrails` |
| Themes            | `ui-guardrails`                |
| Account caching   | `cache-state`                  |
| Salary allocation | `money-logic`                  |
| Recurring bills   | `recurring-engine`             |

Skills should be **execution modes**, not every app feature.

---

# The most important change I would make

Your current list says:

> DB → API → types → hooks → UI → wiring

That is good for implementation.

But for a budget app, I would add this rule before that:

```text
Before coding, classify whether this change affects money correctness, cached state, household visibility, recurring commitments, or mobile fast-entry. If yes, invoke the corresponding domain skill before editing.
```

Because the dangerous bugs in your app will not be only TypeScript errors.

They will be things like:

```text
Wallet available balance looks correct but ignores recurring commitments.
A transaction is deleted but category envelope still includes it.
A transfer is counted as spending.
A matched transaction stays cached after manual override.
A household member sees data they should not see.
A recurring payment posts twice after timezone/date edge case.
The UI feels fast but shows stale money.
```

That is exactly why you need domain skills.

---

# My recommended answer

Your current skills are a strong base. I would keep all 7, but add these 7:

```text
/money-logic
/cache-state
/offline-pwa
/rls-auth
/recurring-engine
/fast-entry
/data-repair
```

And optionally:

```text
/tests-finance
```

Although honestly, I would include `tests-finance` too.

So the best final setup is:

```text
/start-task
/fix-bug
/add-feature
/api-route
/db-migration
/rls-auth
/cache-state
/offline-pwa
/ui-guardrails
/money-logic
/recurring-engine
/fast-entry
/tests-finance
/data-repair
/finish-task
```

That would make your AI agent much safer for a real budget application.
