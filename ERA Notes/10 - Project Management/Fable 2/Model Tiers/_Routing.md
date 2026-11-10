---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Tier aliases are those in the Model Registry as read on this date; no model was run to calibrate these assignments."
---

# Model tiers — routing rules

[Fable 2 index](<../_index.md>) · [Model Registry](<../../../Model-Registry.md>) · packets: [CLAUDE_HIGH](<CLAUDE_HIGH/Work Packets.md>) · [CLAUDE_MID](<CLAUDE_MID/Work Packets.md>) · [CLAUDE_LOW](<CLAUDE_LOW/Work Packets.md>) · [CODEX](<CODEX/Work Packets.md>)

Aliases only, as the registry requires. Effort is stated separately. These are judgments from reading the code, not measurements; revise a row the first time a tier fails or over-delivers on it.

## The rule

Send an item **up** a tier for each of these that is true; start from LOW.

| Signal | Why it needs more model |
|---|---|
| It changes or relies on an invariant: money amounts or balances, exactly-once, an authorization boundary, RLS, a migration, recurrence | A plausible wrong answer passes typecheck and tests that do not exist yet |
| It spans two or more modules, or a junction | The cascade has to be traced before the first edit |
| It edits a file over about 1,500 lines ([list](<../04 - UI & Design/Mega-Components.md>)) | Most of the context goes to one file |
| No working example of the pattern exists in the repo | It must be designed, not copied |
| The acceptance is a judgment ("disposition", "decide", "design") | There is no test to converge on |

Two signals or more: **CLAUDE_HIGH**. One: **CLAUDE_MID**. None: **CLAUDE_LOW**. Under the [Local lane](<../10 - Project Management/Delivery/2 - Local Lane Design.md>) the owner's review of risk-domain diffs applies at every tier; a lower tier with review is acceptable when the pattern to copy is named.

## Tier for every item filed on 2026-11-10

| Item | Tier | Effort | Deciding signal |
|---|---|---|---|
| HUB-118 Guest bulk reads need host auth | CLAUDE_MID | high | Auth boundary; pattern exists (authenticated route plus owner check) |
| HUB-119 Never drop a queued write silently | CLAUDE_HIGH | default | Offline semantics across queue, engine and drawer |
| HUB-120 Idempotent transaction create under replay | CLAUDE_HIGH | default | Exactly-once across client, queue and route |
| HUB-121 One household-link resolver | CLAUDE_HIGH | default | Every module; needs a migration |
| HUB-122 Guest routes require an active tag | CLAUDE_MID | default | One module, clear rule |
| BUD-89 Undo restores the original transaction | CLAUDE_MID | high | Money inverse; ERA already does it correctly, copy that |
| BUD-90 Confirm and settle exactly once | CLAUDE_HIGH | high | Four flows, concurrency |
| BUD-91 Balance writes only to writable accounts | CLAUDE_MID | high | Money authorization; helper exists |
| BUD-92 Split restore re-applies both legs | CLAUDE_HIGH | default | Money inverse with two accounts |
| BUD-93 No money date from server UTC | CLAUDE_MID | default | Time zones; `era/ask` shows the pattern |
| BUD-94 Validate money amounts | CLAUDE_MID | default | Zod on known routes |
| BUD-95 Private cache header on the transactions read | CLAUDE_LOW | default | One header, one test; owner review because it is a money path |
| NOTIF-22 Cron routes refuse without a secret | CLAUDE_LOW | default | Two files, one shared helper |
| NOTIF-23 Claim an alert before sending | CLAUDE_MID | default | Exactly-once, one route |
| KIT-28 Sanitize recipe search | CLAUDE_LOW | default | Reuse `toIlikeTerm` |
| R83 One proxy file or none | CLAUDE_MID | default | Auth path; needs an owner decision first |
| R84 Deny Supabase writes in every tool namespace | CLAUDE_LOW | default | Configuration |
| R85 Disposition the era-research packs | CLAUDE_HIGH | high | Judgment over 70 files |
| R86 Home shows what to do next | CLAUDE_MID | default | UI in one app |
| R87 Sprints roll forward | CLAUDE_MID | default | Planning logic with tests |
| R88 Verifiable evidence links, docs check in CI | CLAUDE_LOW | default | Mechanical |
| R89 Master Book size budget | CLAUDE_MID | default | Parser contracts must survive |
| R90 Service-role authorization contract | CLAUDE_HIGH to design, CLAUDE_MID to fill | default | New mechanism, then repetition |
| R91 Typecheck heap | CLAUDE_LOW | default | One script line |
| DLV-150 Local lane end to end | CLAUDE_HIGH | high | New mechanism |
| DLV-151 Three-check Start | CLAUDE_MID | default | Simplification of existing code |
| DLV-152 Guardrails as code | CLAUDE_HIGH | high | It is the safety boundary |
| DLV-153 Ship and Undo by merge | CLAUDE_HIGH | default | Git effects plus PM trace |
| DLV-154 Development database | CLAUDE_HIGH | default | Design; several owner steps |
| DLV-155 Retire the confined stack | CLAUDE_MID | default | Deletion with the suite as the oracle |
| R92 Same setup for every agent | CLAUDE_MID | default | Configuration across three agents |
| R93 Setup registry and conflict check | CLAUDE_MID | default | Parsing existing files; the hand inventory is the test |
| R94 Rule detectors | CLAUDE_MID, then CLAUDE_LOW | default | Small pure functions with fixtures |
| R95 Flight recorder | CLAUDE_HIGH for the hook runner, then CLAUDE_MID | default | It wraps every hook; it must not change one |
| R96 Scorecards | CLAUDE_MID | default | Aggregation over recorded facts |
| R97 PM.2 cockpit | CLAUDE_MID; CLAUDE_HIGH for the setup map | default | UI in one app; one new visual to design |
| R98 Skill launchpad | CLAUDE_MID | default | Schema plus forms |
| R99 Arena and game layer | CLAUDE_HIGH for the Arena | default | New mechanism |

## The tier above HIGH

The registry notes that a Fable-class model is installed but disabled and has no alias, to be added "only on an owner request". The six studies in [CLAUDE_HIGH work packets](<CLAUDE_HIGH/Work Packets.md>) are the work that would justify one. Until an alias exists they are listed under CLAUDE_HIGH at the highest effort the registry offers.

## Making this visible in the Command Center

Proposed in the [functional roadmap](<../10 - Project Management/Command Center/2 - Functional Roadmap.md>), change 5: a declared `**Tier:**` line in each Master Book section, shown as a chip. The sections filed on 2026-11-10 already carry that line as plain text.
