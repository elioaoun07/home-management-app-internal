---
name: era-wire
description: "Cheap, deterministic lane for ERA reports (HUB-n items under **ERA reports** in Hub & ERA): wire an ALREADY-SHIPPED manual feature (existing API route) into the ERA command bar — one grammar, one routeWrite adapter, one Artifact, one Gym case, one contract row. Use for '/era-wire HUB-89', 'ERA can't add a contact/location/chore'. NOT for features with no manual API, DB changes, money movement or recurrence edits — those STOP and go to a CLI session at high effort."
---

# /era-wire — Wire a shipped manual feature into ERA

> **Contract:** every wiring is the same thing — *ERA using the app's functionality*. ERA learns a sentence by **reusing the route the manual form already calls**, never new business logic, and **every write leaves an Artifact** (shown in /era → Artifacts, opening the exact item; the Activity Log's ERA row opens it too). The fix is proven by an ERA Gym case built from the report's own sentence (red before, green after, full Gym still green) **and** a row in the artifact contract test. No Gym green, no contract row, no done. If any STOP condition is hit, edit nothing and report `ESCALATE: <reason>`.
>
> **Budget:** Sonnet 5.5, medium effort, one session per report (or per batch of reports on the same module). This skill replaces `start-task` routing and `finish-task` for this lane: steps 6–7 are the definition of done. Read files by **grep anchor + line range**, never whole (`gym.ts` is 1.3k lines, `index.ts` 340).

## The verified model (canonical example: contact-add, HUB-89)

`rg -n "addContact" src tests` lists **every** touch point. A new wiring mirrors each hit — only the *spec* differs per feature; the plumbing (adapter, artifact logging, deep links, Undo toast) is shared:

| # | File | What `addContact` does there |
|---|---|---|
| 1 | `src/features/era/types.ts` | `Intent` union variant `{ kind: "addContact"; face; …slots; rawText }` |
| 2 | `src/features/era/intents/brain.ts` | grammar: anchored regex → returns the intent |
| 3 | `src/features/era/intents/index.ts` | listed in `OTHER_WRITES` → speech-act gate blocks "don't add …" |
| 4 | `src/features/era/engine.ts` | `INTENT_CAPABILITY` → `"contact.create"` (outcome/tier) |
| 5 | `src/features/era/intents/resolvers/contacts.ts` | adapter: **`routeWrite({ call, pickId, artifact, inverse, reply, idKey })`** over the existing `/api/catalogue/items` route |
| 6 | `src/features/era/intents/resolveIntent.ts` | `case "addContact": return resolveAddContact(…)` |
| 7 | `src/features/era/replyFormatter.ts` | fallback line (`"Adding that."`) |
| 8 | `tests/era-gym/gym.ts` | `runCase` case → `effect: { cap, …fields }`; `gymFetch` fakes the route |
| 9 | `src/features/era/reach.ts` | module row: capability id in `inline`, `verified: true` |
| 10 | `src/lib/era/artifacts.ts` | `ERA_ARTIFACT_ENTITIES.contact` → label + deep link (`/catalogue?item=<id>`). Add a row only for a **new entity** — no migration needed (the DB checks the slug shape only) |
| 11 | `src/features/era/artifacts.contract.test.ts` | one `WRITES` row: the adapter returns ≥1 artifact of that entity/action and its link resolves |

**Shared, never per feature:** `src/lib/era/artifacts.ts` (entities, `eraArtifact()`, links), `src/features/era/recordArtifacts.ts` (the one logger, called by `useEraTurn` / `useEraAskAI` for whatever `artifacts` the result carries), `resolvers/routeWrite.ts` (the adapter template: route → id → artifact → Undo → reply). If you find yourself writing a `switch` on intent kind to log or link something, stop — return `artifacts` from the adapter instead.

Router order (`intents/index.ts` `routeIntent`): explicit nav → follow-ups → active face → other faces (one **strong** hit wins) → taught phrases → **implicit doors** (`reach.ts` `IMPLICIT`) → unknown. A grammar returning a real intent therefore always beats an implicit door.

## Steps

**1 — Load the report.** In `ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md`, read only the `### HUB-n` section (grep the heading, read ~16 lines): the sentence, **Expected**, and the transcript's `_(intent · outcome)_` tags.

**2 — Classify** (one row must fit, else STOP):

| Transcript shows | Class | Do |
|---|---|---|
| `_(unknown · answered)_` | Missing wiring | Steps 3–7 |
| `_(navigate · handed_off)_` on an add/create sentence | Implicit door swallowed a write (HUB-87: "chores" matched `IMPLICIT`) | Steps 3–7 — the new grammar outranks the door; do **not** edit `IMPLICIT` |
| A wrong entity was written | Wrong grammar | Fix the grammar that fired; still add the Gym case |

**3 — Find the manual API.** Feature Map: `ERA Notes/01 - Architecture/Feature Map/_index.md` → the module file → the hook the manual form uses → its route. Read the route's Zod schema: required fields, response shape (the new id), and an inverse (`DELETE`, or a soft delete).

**Deep link:** the item must be openable by URL — check the module page for an `openId` / `item` search param (Schedule `/reminders?openId=`, Dashboard `?openId=`, Catalogue `?item=`). If the module has none, the entity's `href` points at the module home and you say so in the final reply (adding a deep link is a separate, small UI change to that module).

**STOP (`ESCALATE`) if:** no route exists · the route needs a DB change · it moves money (→ `money-rules`) · it touches recurrence (→ `recurrence-safety`) · there is no inverse for Undo (Hard Rule #1) · the fix needs a new focus/follow-up type.

**4 — Gym case first (red).** Append one line to `tests/era-gym/reports.jsonl` (create if absent; any `*.jsonl` there is loaded). Copy the context shape from `pilot.jsonl` (`pilot-014`):
```json
{"id": "report-hub-89", "slice": "report", "split": "dev", "source": "HUB-89", "turns": ["Add Laura as a contact person"], "context": {"page": "/era", "turnState": null, "focus": [], "lexicon": [], "clock": "2026-10-03T10:00:00+03:00", "timezone": "Asia/Beirut", "actor": "owner", "face": "brain"}, "expect": {"outcome": "done", "effect": {"cap": "contact.create", "name": "Laura"}, "tier": "act"}}
```
Use the report's sentence verbatim. Add 1–2 paraphrases (`report-hub-89-b` …) and one negated twin with `"slice": "speech-act"`, `"expect": {"outcome": "no_action"}`. Run the step-6 vitest command once. Your new ids must show as `B ✗`. Keep that run's `B ✗` lines as the **baseline**, since about 20 known misses already exist.

**5 — Wire it.** Mirror the 11 rows above:
- **Face file:** kitchen/list → `chef.ts`; schedule/chores → `schedule.ts`; everything else (catalogue, contacts, places, outfits …) → `brain.ts`. Money → STOP.
- **Grammar:** anchored (`^\s*(?:please\s+)?add\s+…`), explicit verb + entity noun ("as a contact", "as a location"). Reject digits/`$` in the name (copy `underOnly`'s guard in `chef.ts`) so money sentences never match.
- **Adapter:** new `resolvers/<module>.ts`, a thin call to `routeWrite` (copy `resolveAddContact`): `call` = the manual form's route, `pickId` = the new row's id from its response, `artifact` = `{ entity, action, title }`, `inverse` = the route's own undo (`DELETE` / soft delete), `reply` = `Added · <name>`. `routeWrite` returns `{ text, ok, metadata, artifacts, undo }` and swallows failures into `{ text: failReply, ok: false }`. Any lookup the call needs (e.g. the contacts module id) happens before it. `useEraTurn` then shows Undo, logs the artifacts and stores them on the assistant message — nothing to add there.
- **Artifact:** `artifact.entity` must be a key of `ERA_ARTIFACT_ENTITIES`; add a row (label + `href`) only for a new entity, building the link from the id (never from user text). Updates use `action: "updated"`, deletes `"deleted"` (→ Recycle Bin link). A write that touches several rows returns one artifact per row (see `shoppingArtifacts`).
- **Contract row:** add one `WRITES` row to `src/features/era/artifacts.contract.test.ts` and, if the adapter calls a route not yet faked there, one branch in its `route()` stub.
- **Missing required field:** ask one question by returning `pending` (copy the ask path of `resolveDraftReminder` in `resolvers/schedule.ts`). Optional fields get defaults, never questions.
- **Reply text:** `Added · Laura` style, nothing more (Hard Rule #28).
- **Gym:** a `runCase` case returning `effect: { cap, …fields }` (copy the `addShopping` case), plus a `gymFetch` branch faking the route's response.
- **Reach:** add the capability id to the module's `inline` in `reach.ts`, set `verified: true`, then regenerate the vault matrix: `ERA_REACH_WRITE=1 pnpm vitest run src/features/era/reach.test.ts` (Bash tool syntax).
- **Do not touch** `capabilities/registry.ts` (that is Ask AI's surface; the grammar is the deterministic layer), `IMPLICIT`, other faces' grammars, or any API route.

**6 — Verify.** All must pass, run once each after the last edit:
```
pnpm vitest run tests/era-gym src/features/era src/lib/era
pnpm typecheck
pnpm eslint <changed files>
```
The new ids are absent from the `B ✗` list; the contract test has your row and passes. The Gym release gates (zero wrong money effects, negation writes nothing) are hard. Diff the `B ✗` list against the step-4 baseline. Lines may disappear but none may appear. A new line is a regression, so narrow your grammar.

**7 — Close the PM item.** Hub & ERA `4 - Checklist.md`: `[ ]` → `[x]` on HUB-n. Run `pnpm pm:archive`, then `pnpm pm:lint`. Final reply, 4 lines max: class · route reused · files touched · Gym result. Add `Device check pending` because the owner confirms on the phone.

## Known failure modes

| Symptom | Cause | Confirm at |
|---|---|---|
| Add-sentence opens a module page | implicit door matched a noun; no grammar hit | `reach.ts` `IMPLICIT`, transcript `navigate · handed_off` |
| "Don't add Laura" writes | intent kind missing from `OTHER_WRITES` | `intents/index.ts` |
| Gym says `no_action` though the app works | no `runCase` case for the new kind (falls to `default`) | `gym.ts` `default:` branch |
| Gym says `honest_limit` | `gymFetch` has no branch for the route → `{}` → adapter fails | `gym.ts` `gymFetch` |
| New `B ✗` on an unrelated case | grammar too greedy (steals money/schedule sentences) | narrow the anchor/noun; re-run Gym |
| `ambiguous` clarify | two faces return strong hits | keep the grammar in exactly one face file |
| Works, but nothing in /era → Artifacts | adapter returned no `artifacts` (hand-rolled instead of `routeWrite`), or the entity isn't in `ERA_ARTIFACT_ENTITIES` (API 400) | contract test row; `POST /api/era/actions` response in the network tab |
| Artifact opens the module page, not the item | entity `href` has no item deep link, or the module page ignores the param | `src/lib/era/artifacts.ts`; the page's `useSearchParams` |
| Activity Log ERA row opens `/era` | the assistant message carries no `intent_payload.artifacts` (turn predates the contract, or the write bypassed `useEraTurn`/`useEraAskAI`) | `src/app/api/activity-log/route.ts` `withEraLinks` |

## Checklist before leaving
- [ ] Reused an existing route; no new API, DB or business logic
- [ ] Gym: report case red → green; negated twin `no_action`; release gates pass
- [ ] Undo wired through the existing inverse route
- [ ] Adapter is a `routeWrite` call returning an artifact; entity registered with an item deep link (or the gap stated)
- [ ] Contract row added in `artifacts.contract.test.ts` and green
- [ ] Typecheck + eslint clean on changed files
- [ ] `reach.ts` row updated (`inline` id, `verified: true`)
- [ ] HUB-n checked, archived, `pm:lint` clean
