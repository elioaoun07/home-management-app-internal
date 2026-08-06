---
created: 2026-05-30
updated: 2026-07-30
type: master-book
status: active
owner: Elio
consolidates: "_index, 1 - Feature State, 2 - Vision & Roadmap, 3 - Action Plan, FABLED, FABLED 2, FABLED 3, ERAHUB.MD (originals in ../_Archive/Hub & ERA/)"
tags:
  - pm/master-book
  - scope/module
  - module/hub
---

# Hub & ERA — Master Book

> **Campaign:** Hub & ERA · prefix `HUB` · working queue → [4 · Checklist](<4 - Checklist.md>)

## Identity & North Star

"Hub & ERA" groups the conversational flagship — **Hub Chat** (the top-layer primary interface per CLAUDE.md), **Message Actions**, the **ERA AI Assistant**, and **Voice Conversation**. It is the app's **brain and front door**, and it spans 🟢 Core (Hub Chat) down to 🟡 New/Thin (ERA, Voice): the most differentiated work in the app, and the least protected.

Today the Hub is an excellent *reactive* surface — you talk, it parses, it acts. **ERA is only as smart as the graphs it reads**, and it barely reads Schedule (time) and Budget (money) proactively. The moat isn't a better chat box; it's an assistant that knows the household and speaks first, correctly, at the right moment.

**Vision in one line:** *turn ERA from a chat box that answers into a household brain that anticipates — reading the full time + money graph and speaking first, at the right moment, with the right context.*

**Source:** `src/features/{hub,era,voice-conversation}/`, `src/components/hub/`, `src/app/{chat,alerts}/`, `src/app/api/{hub,ai-chat}/`, `src/lib/ai/gemini.ts`. Vault: [Hub Chat](<../../03 - Junction Modules/Hub Chat/Overview.md>) · [AI Assistant](<../../03 - Junction Modules/AI Assistant/Overview.md>) · [Message Actions](<../../03 - Junction Modules/Message Actions/Overview.md>).

**Standing contracts (owner-approved, execute — do not redesign):** [ERA Awakening — Master Execution Plan](<../ERA Awakening — Master Execution Plan (2026-07-06).md>) is the execution contract; [ERA Top View — Design Study (2026-07-17)](<../ERA Top View — Design Study (2026-07-17).md>) specifies the Hub L-0 glance as the *pull* mouth of the briefing brain (shared signal registry, a single `get_era_topview_bundle()` RPC, drafts-only actions). Top View packets sequence **behind** Awakening WP-03/04/11; WP-04 always wins.

## Current State (verified)

**Maturity 4.2 / 10 as of 2026-07-18 (FABLED 3), +0.2 vs 2026-07-02.** The flagship's paradox in sharper form: notification delivery got a genuinely well-engineered visibility policy with the cluster's first test, while `HubPage.tsx` crossed 5,978 LOC and ERA — the app's namesake — still has never spoken first.

| Dimension | Score | Evidence |
|---|---|---|
| Reactive chat (Hub) | 7 | private threads + per-user receipts shipped (`0f33396`) |
| Intent architecture | 7 | unchanged; still **zero fixtures** |
| Test protection | 2 (+1) | **first test in the cluster**: `chatNotificationPolicy.test.ts` (2 green). Intent routing still untested |
| Proactive reach | 2 | Top View study specifies the pull mouth; nothing renders yet |
| Voice resilience | 4 | no window changes; dead `sttCapture.ts` / `vadGate.ts` still on disk |
| Code health | 3 | `HubPage.tsx` **5,978 LOC** (+180 since v2) — ~2.4% of the codebase in one file, growing ~+90/month |
| Handoff readiness | 3 | the untested intent router + 6k-line page make this the riskiest junction for lower-tier edits; message actions cascade into money and items |

| Sub-feature | Tier | Reality |
|---|---|---|
| Hub Chat | 🟢 | threads with purposes, realtime, voice messages, message actions, shopping mode, full-screen in-thread, edge-swipe-back, bulk convert (`BulkConvertReviewSheet`) with unconfirmed rows saved as **draft items** (`items.status='draft'`, reviewed via `DraftRemindersDrawer`) |
| Message Actions | 🔵 | Hub message → transaction / reminder / item — the bridge that makes chat *do* things |
| AI Assistant (ERA) | 🟡 | the flagship: intent router, faces, widgets, wake listener, budget submit, household context; `src/features/era/` is the largest feature dir (28 files). **No intent tests.** |
| Voice Conversation | 🟡 | Azure STT/TTS/wake, conversation engine, intent classifier, greeting cache (shipped May 2026). External-dependency heavy → fragile; wake-word needs external setup (only openWakeWord viable — vendor decision closed) |
| Faces / widgets | 🟡 | ERA's visual responses and inline widgets surface module data in chat |
| Proactive briefings | 🟡 | reads Schedule + Budget context; reactive parsing solid, proactive reach shallow |
| Notification visibility policy | 🔵 | `chatNotificationPolicy.ts` (33 lines, pure, tested): private threads excluded from immediate push **and** cron fallback; every public purpose eligible |

## Pain Inventory

- 🔴 **Intent routing is untested — third generation asking.** `resolveIntent` has zero fixtures while routing money and item mutations. A misrouted money intent acts confidently. The notification policy proved the cure (pure function + table test, 33 lines); applying the same treatment to intent routing is the single highest catastrophic-risk reduction available in the app.
- 🟠 **`HubPage.tsx` is 5,978 LOC and growing ~+90/month** — the app's largest file, ~2.4% of the codebase. Every Hub feature pays a comprehension tax; lower-tier models effectively cannot edit it safely.
- 🟠 **ERA still never speaks first** — the identity gap, unchanged through two audits and one design study. Studies are leading shipments 2:0 in this cluster. The Top View study de-risked the *what*; the *ship* is still absent.
- 🟠 **Voice is external-dependency fragile** — Azure STT/TTS/wake plus external wake-word setup means failures are often environmental, not code. Graceful degradation and setup docs matter more than features here.
- 🟡 **Policy asymmetry: two sources of nudge-truth.** `chatNotificationPolicy` governs push/cron delivery, but in-app badge/dot logic lives separately in the receipts path. They agree today; nothing enforces that they keep agreeing.
- 🟡 Dead voice files on their **third** flag — `src/features/voice-conversation/sttCapture.ts`, `vadGate.ts`. Same class as Schedule's `MobileItemForm`.
- 🟡 Conversation-store consolidation — three stores since June, unchanged.

## Shipped Log

- ✅ 2026-06-16 — Hub bulk convert ("Multi-add" → `BulkConvertReviewSheet`) with unconfirmed rows saved as draft items (`items.status='draft'`, reviewed via `DraftRemindersDrawer`)
- ✅ 2026-06-16 — bulk-convert "complete transaction" rule tightened: a budget row auto-confirms only with Amount + Category + Subcategory (description = the chat message); any missing field forces a draft
- ✅ 2026-06-16 — full-screen in-thread view (global header hidden) + edge-swipe-back to the thread list
- ✅ 2026-07-10 — **notification visibility policy** (`0f33396`): `chatNotificationPolicy.ts` (33 lines, pure, **the cluster's first test file**) makes visibility the single choke point — private threads excluded from immediate push and cron fallback
- ✅ 2026-07-10 — per-user receipts extended to shopping child messages: `unread_reply_count` drives the item dot, opening the item thread marks replies read, realtime restores the dot only for a *newer* partner reply
- ✅ 2026-07-10 — net complexity went **down** with a feature for the first time in this cluster (`useHubPersistence.ts` −27, `chat-notifications` cron −17), and the vault docs were updated in the same commit
- ✅ 2026-07-17 — ERA Top View design study recorded as the standing spec for proactive
- ✅ 2026-08-06 — **HUB-11** per-message color tags + color filter (`hub_messages.color`, `src/features/hub/messageColors.ts`) — compose-bar palette picker (sticky per-thread), long-press-to-recolor, header filter button; Multi-add's "Select all" now scopes to the active color filter so a mixed budget thread can be swept color-by-color instead of in one undifferentiated pass (migration `2026-08-06_hub-message-color.sql`, pending manual run)

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Vision & Decisions

### Track A — internal enhancements

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| Harden intent routing | works, untested | table-driven fixtures + graceful fallback — a misrecognized intent clarifies instead of firing a wrong action | M |
| Decompose `HubPage.tsx` | 5,978 LOC single file | split into testable units so Hub changes stop being high-risk | M–L |
| Voice graceful degradation | Azure-dependent, fails environmentally | clear fallback when STT/TTS/wake is unavailable, setup docs, degradation tests | M |
| Richer faces / widgets | faces + inline widgets exist | more module widgets in-chat (balance, today, low-stock) with fresh cache | M |
| Expense-split from chat | message → transaction | split a bill conversationally in the Hub | M |
| Unify nudge-truth | two paths | make the receipts/badge path consult `chatNotificationPolicy` (or a shared predicate) + one parity fixture | S–M |

### Track B — bridges into ERA

ERA is *defined* by its reads into other modules; most of these are the receiving end of bridges the other campaigns propose.

- **ERA ← Schedule** — read the whole week's shape: recurring due, overdue routines, household-assigned items by person.
- **ERA ← Budget** — warn before a recurring payment overdraws; surface overspend.
- **ERA ← Kitchen** — "low on 3 staples, nothing planned Thursday".
- **ERA ← Trips** — re-entry briefing: "you're back tomorrow, N chores/routines resume".
- **Smart notification timing** — quiet hours + weekly digest instead of daily noise, driven from ERA's read of what actually matters.

### The bets, in order

1. **Harden the flagship** — intent-routing fixtures + voice graceful degradation. A wrong intent or an Azure outage with no fallback is the most damaging failure to the product's identity.
2. **Briefing enrichment ← Schedule + Budget** — the biggest felt upgrade and the moat. Coordinate so both ends ship together.
3. **Decompose `HubPage.tsx`** — one pure-concern extraction per session, using `chatNotificationPolicy.ts` + its test as the template. Sustained, this reverses the growth curve without a risky big-bang; best done *as* the substrate for in-chat briefings so the refactor buys a feature.

> Resist piling proactive features onto an untested intent router — a confidently-wrong assistant erodes trust faster than a quiet one. Harden, then anticipate.

### Not now

- ❌ Don't pile proactive features onto an untested intent router.
- ❌ Don't decompose `HubPage.tsx` "just because" — do it with the briefing work.
- ❌ Don't add new Voice features before graceful degradation exists.
- ❌ **No further design studies until something proactive renders.** The Top View study is the last allowed spec artifact; execute WP-04 (briefing v0.5) first. Recorded as a decision, enforced by the meta-work budget rule.
- ❌ Don't re-decide wake-word vendors — that decision is closed (only openWakeWord viable).

## Acceptance Criteria Index

### HUB-1
- **Acceptance:** a table-driven fixture covers ≥30 utterances across money/item/shopping/ambiguous/hostile inputs, asserting intent + slots; a misrecognized intent clarifies instead of mis-acting; `pnpm test` green.

### HUB-2
- **Acceptance:** with no Azure connection the voice path degrades with a visible, non-crashing state, the wake-word setup is documented, and a degradation test exists.

### HUB-3
- **Acceptance:** ERA's briefing reads at least one of Schedule/Budget proactively and renders it — visibly smarter than reactive-only.

### HUB-5
- **Acceptance:** each extraction moves one pure concern out of `HubPage.tsx` with its own test, and the file's line count goes down rather than up in that session.

## Successor Briefing

**Who should read this:** you are about to touch Hub Chat, ERA, message actions or voice. This is a **Junction** — changes cascade into Budget, Items and Shopping List. It contains the app's largest file and its least-tested critical path.

**First 10 minutes:**

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/hub src/features/era src/features/voice-conversation src/components/hub src/app/api/hub src/app/api/ai-chat
npx vitest run src/features/hub/chatNotificationPolicy.test.ts    # 2 green expected
wc -l src/components/hub/HubPage.tsx                              # if >6,100, the growth curve worsened — note it
```

Then read the vault docs for every connected standalone you'll touch (Junction rule) → `src/features/hub/messageActions.ts` (the cascade surface) → the Top View study if doing anything proactive.

**Task-tier map:**

| Task archetype | Tier | Route |
|---|---|---|
| Chat UI polish, thread list, badges | any-model | `ui-guardrails`; if the edit lands inside `HubPage.tsx`, extract first or keep the diff <30 lines |
| A pure-policy extraction from HubPage (+test) | any-model | copy `chatNotificationPolicy.ts` + its test — the sanctioned refactor ritual |
| New notification-delivery rules | mid-tier+ | change `chatNotificationPolicy.ts` **and** its test together; the policy is the only delivery truth |
| New/changed intents, resolvers, formatters | mid-tier+ | zero fixtures exist — you are editing an untested money-adjacent router; write the fixture for your intent as part of the change |
| Message actions (chat → transactions/items) | mid-tier+ | Junction cascade: read the Budget + Items vault docs first; all mutations through drafts/proposal |
| Voice pipeline, wake word, degradation states | human-first | vendor verdicts recorded; dead files pending deletion — don't "fix" them |
| Proactive/briefing architecture | human-first | the Awakening plan + Top View study are owner-approved contracts; execute WPs, don't redesign |

**Out-of-depth tells — stop if:** you're adding a conditional inside `HubPage.tsx` instead of extracting; an AI response path writes to money/items without a draft; you're about to add a fourth conversation store; you're re-deciding wake-word vendors.

**Trap registry:**

| Trap | Symptom | Guard |
|---|---|---|
| Private threads are delivery-excluded | "notification never arrived" on private chats | by design — check thread visibility before debugging cron |
| Receipts vs policy duality | dot shows but no push (or reverse) | two truth paths; check both before "fixing" either |
| `AnalysisReport` is a JSON contract | free-text AI answers break the dashboard | the contract + deterministic fallback are the spec; never let the model improvise the shape |
| Focus briefing cache (module hard rule) | stale briefing after a data change | invalidate on the listed mutations |
| `safeFetch` timeout on AI calls | app flags offline during long generations | `timeoutMs: 60_000` on every AI route call (Hard Rule 6) |
| Shopping list legacy queue | offline shopping edits use the OLD localStorage queue | hub shopping list only — don't migrate it, don't add to it |

**Verification manifest:**

| Claim | Command | Expected |
|---|---|---|
| Policy test green | `npx vitest run src/features/hub/chatNotificationPolicy.test.ts` | 2 pass |
| HubPage size | `wc -l src/components/hub/HubPage.tsx` | ≈5,978 (2026-07-18) |
| Dead voice files | `ls src/features/voice-conversation/sttCapture.ts src/features/voice-conversation/vadGate.ts 2>/dev/null` | present until deleted |
| Intent fixtures exist yet? | `find src -name "*resolveIntent*" -name "*.test.*"` | empty → first hit means HUB-1 landed, rescore Test protection |
| ERA speaks first yet? | `grep -rn "get_era_topview_bundle" src migrations/schema.sql` | no hits = still pull-only |

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- Contracts: [ERA Awakening — Master Execution Plan](<../ERA Awakening — Master Execution Plan (2026-07-06).md>) · [ERA Top View — Design Study](<../ERA Top View — Design Study (2026-07-17).md>)
- Vault: [Hub Chat](<../../03 - Junction Modules/Hub Chat/Overview.md>) · [AI Assistant](<../../03 - Junction Modules/AI Assistant/Overview.md>) · [Message Actions](<../../03 - Junction Modules/Message Actions/Overview.md>)
- Pre-consolidation originals (including the raw `ERAHUB.MD` planning transcript): `../_Archive/Hub & ERA/`
