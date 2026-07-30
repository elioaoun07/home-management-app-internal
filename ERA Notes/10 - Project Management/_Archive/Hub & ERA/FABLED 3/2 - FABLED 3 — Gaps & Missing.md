---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/2 - FABLED 2 — Gaps & Missing.md
tags:
  - pm/fabled3
  - module/hub-era
---

# Hub & ERA · FABLED 3.2 — Gaps & Missing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** v2's list stands; delta and re-ranking only.

1. **Intent routing untested — third generation.** `resolveIntent` still has zero fixtures while routing money and item mutations. The notification policy proved the cure pattern (pure function + table test, 33 lines); the same treatment applied to intent routing is the single highest catastrophic-risk reduction available in the app.
2. **`HubPage.tsx` 5,978 LOC and growing +~90/month.** Now ~2.4% of the entire codebase in one file. Every Hub feature pays a comprehension tax; lower-tier models effectively cannot edit it safely (it exceeds what fits in careful working attention alongside its call graph).
3. **ERA still never speaks first** — the identity gap (Consultation §3.1), unchanged through two audits and one design study. The Top View study de-risked the *what*; the *ship* is still absent. Studies are now leading shipments 2:0 in this cluster.
4. **Dead voice files, third flag**: `src/features/voice-conversation/sttCapture.ts`, `vadGate.ts`. Same class as Schedule's MobileItemForm — monuments to deferred deletion.
5. **Conversation-store consolidation** (carried): three stores since June; unchanged.
6. **NEW — policy asymmetry risk**: `chatNotificationPolicy` governs push/cron delivery, but in-app badge/dot logic lives separately in the receipts path. Two sources of "should the user be nudged" truth — they agree today; nothing enforces that they keep agreeing (no shared fixture).
