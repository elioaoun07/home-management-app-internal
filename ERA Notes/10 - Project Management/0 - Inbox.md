---
created: 2026-07-22
updated: 2026-07-22
type: inbox
status: living
owner: Elio
tags:
  - pm/inbox
---

# 0 · Idea Inbox

> **Drop raw thoughts here** — ideas, bugs, checklist candidates, in your own words.
> One line each under **New**: `- [ ] YYYY-MM-DD — what's on your mind` (or use the 💡 capture button in the dashboard topbar).
> Then, from Claude Code, run **`/triage-inbox`**: each entry gets elaborated (clarifying questions if needed), filed as a canonical checklist item ([_Conventions](<_Conventions.md>) §7), documented if warranted, and moved to **Processed** with a pointer to where it landed.
> Entries under New show chip-less in the Task table — that's the untriaged queue, on purpose.

## New
- [ ] NFC Checklist - probably should be a standalone Campaign? not sure, you could challenge it.

Work on the NFC When leaving the house or going back to the house.
I want to enhance it and optimize it

The UI wasn't tested enough, and it might be too dull or too useful. But check areas of growing it
- [ ] Add approval for some transactions that requires both comments
- [ ] 2026-07-31 — Budget - in e-statement import, allow me to transfer to another account. Sometimes I transfer to my partner, so I need to be able to enter either a transaction (currently available) or a transfer (currently not available; this current checklist item)
- [ ] 2026-08-01 — Hub Chat - Adding transaction isn't setting thread.createddate as default date it is taking system.today instead
- [ ] 2026-08-03 — Trips - Budget: 1. Create a shared Account for the trip (user action) 2. A transfer from 1 account to another if different currency, should include a conversion rate input along with manual adjustment of converted rate in case a decimal or rounding is needed. (system additional feature) 3. Link the Account to the Trip; thus, this will link every transaction indirectly to the Trip (database additional feature) 4. Dashboard to display the transactions of a trip as normal transactions cumulative per period, but the User should be able to display a Trip cost (reporting additional feature)
## Processed
- 2026-07-22 — Create a skill for 'wizard' approach → clarified as a new `/wizard` Claude Code skill for interleaved AI/owner setup-debug sessions (step-by-step MD checklist, AI does its steps, owner runs verification commands and pastes output back for AI to validate before unlocking next steps). Owner decision: no PM checklist item (dev-tooling, not an app feature) — routed straight to `skill-factory` to author it now (triaged 2026-07-22)
- 2026-08-03 — Hub Chat: 1. User should be able to change the color of a message thread background 2. User should be able filter by colored messages → clarified to per-message color (fast pre-select before sending + hold-to-recolor existing), fixed preset palette, no fixed color meaning (user-assigned), new independent tag orthogonal to Message Actions' transaction detection, works in any thread — filed as **HUB-11** in [Hub & ERA/4](<Hub & ERA/4 - Checklist.md>) (triaged 2026-08-06)

<!-- Triaged entries land here as plain bullets:
- YYYY-MM-DD — original text → **BUD-14** in [Budget/4](<Budget/4 - Checklist.md>) (triaged YYYY-MM-DD)
/triage-inbox offers to sweep (delete) this section past ~20 bullets — git is the archive. -->
