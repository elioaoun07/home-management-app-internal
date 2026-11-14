---
created: 2026-11-10
updated: 2026-11-14
type: study
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. Proposed design. Baseline numbers used as examples are this pass's measurements."
---

# Agentic OS — visual, motion and game layer

**A7 initial partial implementation (2026-11-14; motion superseded by R102 below):** the owner requested the Game layer
switch in Settings and a futuristic transition. The per-browser switch starts
off; enabling/disabling plays one 360 ms scan, never blocks input, and respects
reduced motion. Score shows the same expandable evidence with game labels or
plain labels. Streaks require known checks, full rule coverage and known order;
debt stays a recorded baseline, missing evidence stays unknown, and exercises
earn nothing. The frozen KIT-11 Arena case and comparison shell exist, but native
dispatch stops before usage because Local cannot hide the oracle. R99 stays
open. [Acceptance/evidence](<../../../../docs/Skills-and-Agents.md#arena-and-game-layer-a7--r99-partial>).

[Agentic OS index](<_index.md>) · [PM.2 product design](<09 - PM.2 Product Design.md>) · next: [Architecture](<11 - Architecture.md>) · items: [R97](<../../_Archive/Shipped/PM Tooling.md#r97>), [R99](<../../PM Tooling/PM Tooling — Master Book.md#r99>)

The current Command Center already has a coherent dark theme, good type and a clean phone bar ([visual review](<../10 - Project Management/Command Center/1 - Usability and Visual Review.md>)). PM.2 keeps that language and adds a small set of visuals that each show one true thing.

## Signature visuals

**R101 usability amendment (2026-11-14):** signature visuals support reading rather than occupying the default screen. Setup's graph is disclosed after the searchable browser; rule ticks become numbered, touch-sized targets under a Rules disclosure; the flight path opens readable facts with raw export secondary. Calm/game totals use the same large-number layout. Primary navigation no longer raises Sessions above the other four destinations. All five destinations, expanded graph, rule finding and comparison are checked at desktop and 390 px in both themes.

| Visual | Shows | Built from |
|---|---|---|
| **Setup map** | Six columns of nodes with lines for "enforces" and "mirrors". A rule with no line is visibly alone | [Registry](<03 - Setup Registry.md>) |
| **Rule shield** | Five fill states: outline (written), half (reminded), three quarters (checked), full (blocked), eye (judgment). One per rule, 29 in a grid | [Rule matrix](<04 - Rule Enforcement Matrix.md>) |
| **Verdict strip** | 29 small ticks per session: green pass, red fail, blue improved, grey n/a. Sessions stack into a heat map where a column of red is a rule that keeps failing | Detectors |
| **Flight path** | A session as a horizontal line with stations: prompt, skills, reading, edits, hooks, checks, verdicts, UAT, ship | [Flight recorder](<06 - Flight Recorder.md>) |
| **Debt bar** | A bar per rule with existing violations, shrinking as sessions remove them: rule 22 starts at 184, rule 6 at 96 | Detector counts on `main` |
| **Fingerprint glyph** | A small symmetric pattern derived from the setup hash. Same rules, same glyph | Setup fingerprint |
| **Parity meter** | Two arcs, Claude and Codex, filled by how much of the setup each really has | Registry `applies-to` |
| **Tier card** | One per model tier: sessions, clean rate, tokens per shipped item, escapes, with n printed | Scorecards |
| **Runway** | Weeks until Now is empty at the current shipping rate | Checklists, shipped log |

## Motion

Ordinary motion tells the owner something happened. Game mode also permits the owner's requested animated ERA core and cosmetic throttle interaction below.

| Moment | Motion | Meaning |
|---|---|---|
| A hook fires during a live session | A pulse travels the line from the hook node to its rule | The guard just ran |
| A hook blocks | The pulse stops at the hook and the node flashes once | Something was prevented |
| A detector verdict arrives | The tick drops into its slot in the strip, one after another | The evaluation is running, in order |
| A rule gains a detector | Its shield fills to the next level | Coverage improved |
| A session ends clean | The streak counter increments with a short spark | One more clean run |
| A debt bar loses violations | The bar shortens and the removed amount floats off as a number | Debt was paid, by how much |
| The setup changes | The fingerprint glyph morphs to the new pattern | Rules are no longer the same as before |
| A conflict is resolved | Its row folds away and the conflict count ticks down | One less contradiction |

Rules for ordinary calm-mode motion: under 400 ms, never looping, never blocking input, and all of it off under the system's reduced-motion setting (the existing app already reads it). No sound. The owner explicitly exempted Game-mode core animation from the duration and no-loop limits on 2026-11-14.

**Owner-approved Bridge exception — 2026-11-14 (R102):** switching between calm and Game views is an infrequent mode change, so the owner explicitly permits a longer cinematic sequence. Enter takes 1.8 s; exit takes 1.0 s. The accent sweep, assembling ERA core, drawing chart lines and settling cards communicate that change. The sequence plays only on an explicit toggle, not on reload; it never locks input or loops. Rapid toggles must resolve to the last selected state. Reduced motion disables the choreography. The later R104 amendment below also permits sustained motion inside the Game-mode core.

**Owner-approved Game-core amendment — 2026-11-14 (R104):** while Game layer is on, ERA may continuously rotate rather than settle into a static mark. This is an explicit playful exception, not evidence of a running job. Session intensity/color remains deterministic:

| Observed state | Core treatment |
|---|---|
| Idle | Theme-colored rotation, 16 s main ring with a counter-rotating ring |
| Running session | Red/orange wheel friction, rapid rotation with sustained smoke, flame/ember spray and localized vibration; refined by R105 below |
| Awaiting delivery approval/action | Yellow, 32 s rotation and lower intensity; this means waiting, not a stale transport |
| Explicit successful completion | Green, 12 s rotation |
| Explicit failed completion | Static grey broken, offset split ring |
| Unknown, stale, cancelled or partial | No inferred success; retain an honest non-success state |

The core is a session indicator. Standing backlog decisions stay in the Needs you queue and cannot mask a completed session's state. Observed running work takes precedence over delivery approvals/actions. Terminal colors require explicit outcomes and trustworthy ordering; an unknown or ambiguous latest result cannot become green. Labels distinguish Candidate verified, Applied and Shipped; successful candidate verification is not owner acceptance or deployment. Clicking or keyboard-activating the core triggers a cosmetic throttle/clutch-kick burst without any provider/session command or change to the observed state. Open sessions is a separate navigation action. Animation pauses while hidden/offscreen, reduced motion disables movement and particles, and calm mode stays still. The intensity carries no score, reward or claim of real work.

**Owner-approved overload refinement — 2026-11-14 (R105):** the simulated wheel accelerates into an intense red/orange friction effect, with outward sparks and flame trails, layered smoke and vibration confined to the wheel. Running sessions sustain the same visual language. A single motion clock preserves angular phase through acceleration, repeat activation and release; restarting the throttle extends the drive without remounting the wheel or stacking timers. When drive ends, angular speed, heat, emissions and vibration decay gradually back to the observed state's baseline. Existing particles finish their trajectories. The caption remains the real session state even during a simulated red throttle. The effect stays bounded within the core card and does not shake the page or obstruct its links. The original R104 1.7 s hard-ended burst is superseded by this lifecycle.

Bridge's Game view uses an observed-state ERA core, eight weeks of recorded shipped outcomes and non-Arena clean/failed/unknown session evidence. Charts keep source access, date-coverage limits and empty states. The calm view retains the same three action queues and SDK footer. Setup owns guards/conflicts and a numberless actionable-attention dot; Score owns clean streak. The [Bridge contract](<09 - PM.2 Product Design.md#bridge>) supersedes the original first-screen sketch below.

**ERA identity refinement — 2026-11-14 (R106):** the owner retained the motion but rejected the literal tire silhouette. The core now uses the ERA mark with thin, open orbital arcs and an elliptical counter-orbit. Spokes, tread ticks, the solid track and bottom contact patch are removed. Heat is a narrow orbital trace; sparks are fewer and shorter, smoke is lighter, and vibration/glow are about a quarter softer. R105 acceleration, sustained running and gradual cooldown remain the motion contract. This supersedes R105's literal wheel appearance and intensity.

## The game layer

A game is only worth adding if winning it is the same as doing the right work. Each mechanic below is a real measurement with a goal.

| Mechanic | What it measures | How it advances | Why it is honest |
|---|---|---|---|
| **Clean streak** | Consecutive sessions with no new rule violation and green checks | +1 per clean session; resets on a fail | Cannot be raised by volume, only by clean work |
| **Shield wall** | Rules guarded, out of 29 (today 7) | A rule levels up when a detector or blocking hook lands | Each level is a commit that exists |
| **Debt bosses** | Each rule with baseline violations is a boss whose health is the count | Health drops when a session removes violations; a boss is defeated at zero and the rule can then be promoted to Blocked | The number is a grep anyone can rerun |
| **Parity quest** | Codex and Copilot coverage against Claude | Completes when the parity meter is full | Ends when a query returns no rows |
| **Zero conflicts** | `os:check` errors and warnings | A badge held only while the count is zero | Lost the moment drift returns |
| **Weekly five** | The global Now of five from [backlog health](<../10 - Project Management/Portfolio/Backlog Health.md>) | A ring with five segments, filled by items shipped after UAT | Shipped means the owner signed off |
| **Net burn** | Shipped minus added, per week | A week is "won" when it is positive | Punishes filing without delivering, including by analysis sessions like this one |
| **First flights** | One-time badges: first Local-lane ship, first Arena case, first rule promoted to Blocked, first week with zero escapes | Awarded once | Marks milestones in the [roadmap](<12 - Roadmap.md>) |
| **Tier cards** | The models as collectible cards with real statistics | Stats update with every evaluated session | Makes the routing decision visible and a little fun |

### What the game must never do

- **No points for activity.** Sessions run, tokens used, lines written and items filed earn nothing.
- **No hidden numbers.** Every counter opens the list of sessions, files or rows behind it.
- **No shame mechanics.** A broken streak shows what failed and where, once. It does not nag.
- **No rewards for the tool itself.** Building PM.2 earns no badge. Only product items count toward the weekly five.
- **A calm switch.** One setting turns the game layer off and leaves the same facts as plain numbers.

## Original first-screen sketch (superseded by R102)

```text
 era · PM.2                                   ◈ setup 91ab   ✦ streak 3   ◐ 7/29

 NEEDS YOU 3        RUNNING 1                 NEXT UP
 UAT BUD-95         HUB-118 ▓▓▓▓░ checks      BUD-89 ▸   BUD-90 ▸   HUB-119 ▸

 WEEKLY FIVE  ◔ 1/5        NET BURN  −38 this week        RUNWAY  — (no shipping rate yet)

 BOSSES   console ████████████████ 184    raw fetch █████████ 96    cron secret ▌ 2
 PARITY   Claude ●●●●●●●●●●   Codex ●●○○○○○○○○
```

The numbers in the sketch are the real baseline where one exists (184, 96, 2, 7 of 29, and this filing's effect on net burn); the rest are placeholders.
