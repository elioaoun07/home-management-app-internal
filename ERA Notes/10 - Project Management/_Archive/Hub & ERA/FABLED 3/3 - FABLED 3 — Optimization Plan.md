---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/3 - FABLED 2 — Optimization Plan.md
tags:
  - pm/fabled3
  - module/hub-era
---

# Hub & ERA · FABLED 3.3 — Optimization Plan

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

**Verified 2026-07-18.** Ordered.

1. **O1 — Intent fixtures (M).** Table-driven: utterance → expected intent + slots, ≥30 cases covering money/item/shopping/ambiguous/hostile inputs. Pure-function test, no mocks. Carried three generations; do it before ANY new intent ships.
2. **O2 — The policy-extraction ritual (ongoing S per session).** `chatNotificationPolicy.ts` is the template: each Hub session extracts ONE pure concern from `HubPage.tsx` (+test). Sustained, this reverses the growth curve without a risky big-bang. Track in the campaign checklist per extraction.
3. **O3 — Delete `sttCapture.ts` + `vadGate.ts` (S).** `git rm`, typecheck, done. Third flag ends.
4. **O4 — Unify nudge-truth (S–M).** Make the receipts/badge path consult `chatNotificationPolicy` (or a shared predicate) so delivery and display can't diverge; add one fixture asserting parity for the private-thread case (Gap #6).
5. **O5 — Execute WP-04 (briefing v0.5) before further studies (per Awakening contract).** The Top View study is the last allowed spec artifact until something renders. This is a decision recorded here, enforced by the meta-work budget rule (PM system O2).
