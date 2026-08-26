---
created: 2026-06-20
updated: 2026-08-26
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/hub-era
---

# Hub & ERA · 4 — Checklist

> **Campaign:** [Hub & ERA — Master Book](<Hub & ERA — Master Book.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Hub & ERA — every open actionable item under **Now / Next / Later**. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). The narrative *why* is [Hub & ERA — Master Book](<Hub & ERA — Master Book.md>). Completed items are swept into the Master Book's Shipped Log and the line deleted — git history is the rest of the archive.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.
> **ID migration (2026-07-15):** N1–N2→HUB-1–HUB-2, X1–X2→HUB-3–HUB-4, L1–L6→HUB-5–HUB-10.

---

## Now

- [ ] **HUB-2** Voice graceful degradation + setup docs — when Azure STT/TTS/wake is unavailable, degrade clearly; document the wake-word external setup (still required per memory); add degradation tests. _(blocker - M)_

## Next

- [ ] **HUB-3** Briefing enrichment ← Schedule — feed the whole week's shape into ERA's proactive briefing. Coordinate with [Schedule · 4 · Checklist](<../Schedule/4 - Checklist.md>). _(friction - M)_
- [ ] **HUB-4** Briefing enrichment ← Budget (cashflow) — warn before a recurring payment overdraws. Coordinate with [Hub & ERA — Master Book](<Hub & ERA — Master Book.md>). _(friction - M)_
- [ ] **HUB-16** `/chat` voice reminders lose the time and don't save — `intentClassifier.extractReminderTitle` regex-strips the date, and `HubPage.onSetReminder` opens a modal defaulted to today/next-hour while ERA says "Reminder set". Route voice through `resolveDraftReminder` + the shared phrasing pools so both surfaces agree. Surfaced by HUB-15. **Scope narrowed 2026-08-25 (HUB-17):** this is now specifically about `/chat`/`HubPage.tsx` — `/era`'s equivalent (and worse: zero working voice handlers at all) is fixed. The `runTurn` capability pattern HUB-17 added to `ConversationHandlers` is the proven template to reapply here; `HubPage.tsx`'s own five-callback block (`:1819-1880`) would need the same treatment, which HUB-17 deliberately left alone (Junction — Hub Chat's own message-action pattern, out of this session's scope). _(friction - M)_
- [ ] **HUB-13** ERA's two spend answers disagree — `showAnalytics` buckets by calendar month (`/api/analytics`) while `monthSpend` uses the user's custom month start (`getDefaultDateRange`). Pick one basis for both. Surfaced by HUB-12. _(friction - S)_
- [ ] **HUB-14** `resolveMonthSpend` partner scope is confidently wrong — it returns the household total but the formatter says "Your partner has spent $X". Either make the two-call split or fix the wording. Surfaced by HUB-12. _(friction - S)_

- [ ] **HUB-21** Live-verify Slices 2/3/4/5 against a running dev server — the server on port 3000 during this session was serving a stale build (its `.next/dev/build-manifest.json` predates the changes) and showed old phrasing after the edits landed. Restart that dev server (or start a fresh one) and re-run the scenarios in the Master Book's HUB-18/19/20 Shipped Log entries end-to-end. Two harmless test artifacts from this session's partial verification are still in the live DB: two undated reminders titled "Water the plants" and "Feed the cat" (no due_at, so no alert will ever fire) — delete via Reminders search when convenient. _(friction - S)_
- [ ] **HUB-22** Slice 2 stretch capabilities not built this session: debt *settlement* via ERA (no clean Undo inverse exists on the standalone-debt PATCH path — see HUB-18 note), expense-split from chat (already tracked as HUB-6), and recurring-payment add/skip via ERA. _(annoyance - M)_

- [ ] **HUB-24** Ask AI ships one proposal kind (`propose_nfc_reminder`). Widen the schema/UI only when a second concrete use case needs it (Design Doctrine: don't build for hypothetical requirements) — candidates already visible in the domain: propose a category for an uncategorized draft, propose a recipe substitution. _(annoyance - M)_

## Later

- [ ] **HUB-5** Decompose `HubPage.tsx` (5,506 LOC) — best done as the substrate for in-chat briefings, so the refactor buys a feature. _(friction - L)_
- [ ] **HUB-6** Expense-split from chat (gap 8a). _(annoyance - M)_
- [ ] **HUB-7** Richer in-chat faces / widgets (balance, today, low-stock) with fresh cache. _(annoyance - M)_
- [ ] **HUB-8** Smart notification timing + quiet hours + weekly digest. _(annoyance - M)_
- [ ] **HUB-9** Kitchen → ERA food nudges; Trips → ERA re-entry briefing (receiving ends of those folders' bridges). _(annoyance - M)_
- [ ] **HUB-10** Merchant-match in "Add as Transaction" — when a chat message is converted to a transaction (Message Actions), run its text through the shared merchant map (shipped 2026-07-11 for the expense form) to pre-select Category/Subcategory. Counterpart of [Budget · 4 · Checklist](<../Budget/4 - Checklist.md>) BUD-2. _(annoyance - M)_

## Definition of Done

- [x] **D1** Intent routing has test coverage; a misrecognized intent clarifies instead of mis-acting; `pnpm test` green.
- [ ] **D2** Voice degrades gracefully with no Azure connection, and the setup is documented.
- [ ] **D3** ERA's briefing reads at least one of Schedule/Budget proactively (visibly smarter than reactive-only).
- [x] **D4** [Hub & ERA — Master Book](<Hub & ERA — Master Book.md>) updated to drop the "no tests" / "fragile" notes this work closes. *(intent-routing notes dropped 2026-08-22; voice "fragile" note stays open for HUB-2)*
