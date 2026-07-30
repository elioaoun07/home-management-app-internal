---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/
tags:
  - pm/fabled3
  - module/hub-era
---

# Hub & ERA · FABLED 3.5 — Successor Briefing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>)

## Who should read this

You are an AI model about to touch Hub Chat, ERA, message actions, or voice. This is a **Junction** — changes cascade into Budget, Items, and Shopping List. It contains the app's largest file and its least-tested critical path. Tread precisely.

## First 10 minutes in this cluster

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/hub src/features/era src/features/voice-conversation src/components/hub src/app/api/hub src/app/api/ai-chat
npx vitest run src/features/hub/chatNotificationPolicy.test.ts    # 2 green expected
wc -l src/components/hub/HubPage.tsx                              # if >6,100, the growth curve worsened — note it in the ledger
```

Then read: the vault docs for every connected standalone you'll touch (Junction rule) → `src/features/hub/messageActions.ts` (the cascade surface) → the Top View study if doing anything proactive.

## Task-tier map

| Task archetype | Tier | Route |
|---|---|---|
| Chat UI polish, thread list, badges | **any-model** | `ui-guardrails`; but if the edit lands inside `HubPage.tsx`, extract first or keep the diff <30 lines |
| A pure-policy extraction from HubPage (+test) | **any-model** | copy `chatNotificationPolicy.ts` + its test as the template — this is the cluster's sanctioned refactor ritual (O2) |
| New notification-delivery rules | **mid-tier+** | change `chatNotificationPolicy.ts` + its test TOGETHER; policy is the only delivery truth |
| New/changed intents, resolvers, formatters | **mid-tier+** | zero fixtures exist (until O1) — you are editing an untested money-adjacent router; write the fixture for your intent as part of the change |
| Message actions (chat → transactions/items) | **mid-tier+** | Junction cascade: read Budget + Items vault docs first; all mutations through drafts/proposal |
| Voice pipeline, wake word, degradation states | **human-first** | vendor verdicts recorded (only openWakeWord viable); dead files pending O3 — don't "fix" them |
| Proactive/briefing architecture | **human-first** | the Awakening plan + Top View study are owner-approved contracts; execute WPs, don't redesign |

**Out-of-depth tells — stop if:** you're adding a conditional inside `HubPage.tsx` instead of extracting; an AI response path writes to money/items without a draft; you're about to add a fourth conversation store; you're re-deciding wake-word vendors (that decision is closed).

## Trap registry

| Trap | Symptom | Guard |
|---|---|---|
| Private threads are delivery-excluded | "notification never arrived" bug reports on private chats | by design — `chatNotificationPolicy.ts`; check thread visibility before debugging cron |
| Receipts vs policy duality | dot shows but no push (or reverse) | two truth paths (Gap #6); check both before "fixing" either |
| AnalysisReport is a JSON contract | free-text AI answers break the dashboard | the contract + deterministic fallback are the spec; never let the model improvise the shape |
| Focus briefing cache (module hard rule) | stale briefing after data change | see AI Assistant module rules; invalidate on the listed mutations |
| safeFetch timeout on AI calls | app flags offline during long generations | `timeoutMs: 60_000` on every AI route call (Hard Rule 6) |
| Shopping list legacy queue | offline shopping edits use the OLD localStorage queue | hub shopping list only — don't migrate it casually, don't add to it (Architecture refs) |

## Verification manifest

| Claim | Command | Expected |
|---|---|---|
| Policy test green | `npx vitest run src/features/hub/chatNotificationPolicy.test.ts` | 2 pass |
| HubPage size claim | `wc -l src/components/hub/HubPage.tsx` | ≈5,978 (2026-07-18) |
| Dead voice files status | `ls src/features/voice-conversation/sttCapture.ts src/features/voice-conversation/vadGate.ts 2>/dev/null` | present until O3; GONE = O3 landed, update ledger |
| Intent fixtures exist yet? | `find src -name "*resolveIntent*" -name "*.test.*"` | empty until O1 — first hit means O1 landed, move Test protection to 3 |
| ERA speaks first yet? | `grep -rn "get_era_topview_bundle" src migrations/schema.sql` | no hits = still pull-only; hits = Top View shipped, rescore Proactive reach |

## What FABLED 2 got wrong here

Its 2026-07-10 delta entry was accurate and evidence-linked (the model behavior FABLED 2 was designed to produce — worth naming as a success). Its miss: it framed the notification policy as pure gain without noticing the receipts path became a *second* nudge-truth (Gap #6). Also, "HubPage 5,798" aged in the predicted direction (+180) — its growth-rate warning was right and remains unheeded.
