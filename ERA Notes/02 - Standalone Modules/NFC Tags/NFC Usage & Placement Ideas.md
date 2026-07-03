---
type: reference
module: nfc-tags
tags:
  - type/reference
  - module/nfc-tags
  - status/active
---

# NFC Tags — Usage & Placement Ideas

> **Type:** Standalone Module reference (idea catalog)
> **Companion to:** [[Overview]] (architecture) · [[Prerequisites Overview]] (the trigger engine)
> **Purpose:** A practical, grounded catalog of *where* to physically place NFC tags around the
> house, outside, on-the-go, and while travelling — and *what each tap should do* — using ERA's
> real capabilities. Every idea is labelled by how much work it needs today.

---

## Read this first — what an ERA NFC tap actually does

ERA tags are **state machines**, not URL launchers. A physical tag is a generic reusable slug
(`/nfc/{slug}`) and **all behaviour lives server-side**. A tap does not "open a screen" — it
**advances a state** and lets the rest of the app react. Knowing this is the difference between an
idea that works tonight and one that needs a build.

### What works today (✅)

1. **State flip on tap** — each tag has an ordered list of `states` (e.g. `["leaving", "arriving"]`).
   Every tap advances to the next state in the cycle, with a 3-second confirm + manual override.
2. **Trigger dormant items → pending** — a tap fires the prerequisite engine. Any task with a
   `nfc_state_change` prerequisite matching `{tag, target_state}` wakes up from **dormant** and
   becomes a live, actionable item. This is the core power feature.
3. **Per-state checklists** — each state can show its own checklist (`nfc_checklist_items`), with
   **cross-tag auto-complete**: a checklist line can auto-tick when *another* tag reaches a given
   state (e.g. the kitchen "clean" list auto-ticks "dishwasher emptied" when the dishwasher tag
   reads `empty`).
4. **Append-only audit log** — every tap records who tapped, when, and the state change
   (`nfc_state_log`). This doubles as a free **adherence / history record** (meds taken, gym visits,
   bins taken out).
5. **Household sharing** — either partner can tap any household tag, and a tap activates dormant
   items for **both** people. Coordination is built in.
6. **Completion cascades** — completing a triggered item can itself satisfy an `item_completed`
   prerequisite on *another* dormant item, so one tap can start a chain.
7. **Arrival welcome** — an "arriving"-style state shows a welcome and routes to the dashboard out
   of the box.

### Not wired yet

- 🔶 **Tap → open a prefilled deep link** (e.g. fridge → grocery-expense form, wallet → cash spend,
  bills drawer → confirm a recurring payment). The *destinations* already exist
  (`/expense?account=…&category=…&amount=…`, the transfer modal, the shopping list), but `nfc_tags`
  has **no action/URL field** — so the NFC→link bridge needs to be built. These are the highest-value
  "obvious" ideas, which is why they're called out explicitly below.
- 🔲 **Weather / time-of-day / schedule triggers** — the `weather`, `time_window`, `schedule`, and
  `custom_formula` prerequisite evaluators are **stubs** today (they always return "not met"). Until
  enabled, a tag can't behave differently for "morning vs night" automatically — you'd use two states
  and the manual override instead.

### Feasibility legend

| Tag | Meaning |
| --- | --- |
| ✅ | **Works today** — pure state flip + prerequisite triggers + checklists, no code needed |
| 🔶 | **Needs a small build** — the NFC→deep-link "launch action" bridge (see [Build backlog](#build-backlog--what-unlocks-the--ideas)) |
| 🔲 | **Needs a stub evaluator enabled** — `time_window` / `weather` prerequisites |

> **Hard Rule (from [[Overview]]):** tag slugs stay **generic** (`main-door`, `kitchen-1`) — never
> hardcode purpose into the URL. All behaviour is configured server-side.

---

## How to read a tag recipe

```
Slug          the generic URL slug you program onto the chip → /nfc/{slug}
States        the ordered cycle; each tap advances to the next
A tap does    the concrete outcome (flip + triggered items + checklist)
Leverages     which ERA module makes it useful
You feel      the everyday payoff
Feasibility   ✅ / 🔶 / 🔲
```

---

## Master placement table (all ideas)

### Inside the house

| Zone | Placement | Slug | States | What a tap does | Leverages | Feasibility |
| --- | --- | --- | --- | --- | --- | --- |
| Entry | Front door / key bowl | `main-door` | leaving · arriving | Wakes the "leave-the-house" checklist; on return shows welcome + unpack chain | Prerequisites, Items | ✅ |
| Kitchen | Fridge door | `fridge` | check · stocked | Shows low-stock checklist; **(headline)** tap → prefilled grocery expense | Inventory · Transactions | ✅ checklist / 🔶 expense |
| Kitchen | Pantry / cabinet | `pantry` | low · stocked | Staples checklist; triggers "add to shopping list" items | Inventory · Shopping List | ✅ |
| Kitchen | Dishwasher | `dishwasher` | running · clean · empty | 3-state cycle; auto-completes the kitchen "unload" line cross-tag | Checklists | ✅ |
| Kitchen | Under-sink / bin | `bins` | out · in | Wakes the shared "take out trash" chore; logs who did it | Chores · Audit log | ✅ |
| Kitchen | Coffee / breakfast station | `coffee` | on · off | Morning prep checklist (novelty/comfort) | Checklists | ✅ |
| Bedroom | Nightstand | `bedtime` | night · morning | Night → evening routine; morning → today's chores | Prerequisites, Plan My Day | ✅ / 🔶 deep-link |
| Bathroom | Toiletry shelf | `bathroom` | low · stocked | Restock checklist; triggers shopping items | Inventory · Shopping List | ✅ |
| Bathroom | Medicine cabinet | `meds` | taken-am · taken-pm | Logs adherence to the state log; wakes refill reminder | Audit log · Items | ✅ |
| Office | Desk / monitor | `work` | focus · off | Focus → work-context tasks; off → personal/evening | Items (location context) | ✅ / 🔶 briefing |
| Laundry | Machine | `laundry` | washing · done · folded | 3-state cycle + checklist; either partner advances | Chores · Audit log | ✅ |
| Admin | Bills / documents drawer | `bills` | to-pay · paid | Wakes "pay rent/utilities" reminder; **(headline)** tap → confirm a recurring payment | Recurring Payments | ✅ reminder / 🔶 confirm |
| Living room | TV / console | `movie-night` | on · off | Wind-down checklist (lower lights, lock up) | Checklists | ✅ |

### Perimeter & outside

| Zone | Placement | Slug | States | What a tap does | Leverages | Feasibility |
| --- | --- | --- | --- | --- | --- | --- |
| Garage | Car dashboard | `car` | out · parked | Out → errands/outside list; parked → unpack | Items (location context) | ✅ / 🔶 fuel expense |
| Entry | Mailbox | `mailbox` | checked | Wakes "process the mail" item | Items | ✅ |
| Curb | Bins on collection day | `bins-curb` | out · in | Confirms the weekly bin chore; logs it | Chores · Audit log | ✅ |
| Door | Plant / pet station | `pet` | fed · walked | Logs feeding/walk; shared so nobody double-feeds | Audit log · Chores | ✅ |

### On the go

| Zone | Placement | Slug | States | What a tap does | Leverages | Feasibility |
| --- | --- | --- | --- | --- | --- | --- |
| Wallet | Card slot / keychain | `wallet` | — | **(headline)** tap → log a cash expense, prefilled | Transactions | 🔶 |
| Gym bag | Inside flap | `gym` | going · done | Going → kit checklist; done → marks the recurring gym item + logs the visit | Items · Audit log | ✅ |
| Work | Office desk (away) | `work-desk` | focus · off | Splits work vs personal task context away from home | Items (location context) | ✅ |
| Errands | Fuel cap / store loyalty card | `fuel` | — | tap → prefilled fuel/grocery expense | Transactions | 🔶 |

### Travel

| Zone | Placement | Slug | States | What a tap does | Leverages | Feasibility |
| --- | --- | --- | --- | --- | --- | --- |
| Luggage | Suitcase handle | `luggage` | packed · unpacked | Packed → trip packing checklist; unpacked → post-trip chores | Trips · Catalogue · Chores | ✅ |
| Travel docs | Passport pouch | `travel-docs` | ready · home | Document checklist (passport, visa, tickets) from the catalogue | Catalogue (documents) | ✅ |
| Trip mode | By the door / car | `trip` | active · home | Wakes a "start trip" item that kicks off trip prep | Trips · Prerequisites | ✅ / 🔶 auto-activate |

### Guest-facing

| Zone | Placement | Slug | States | What a tap does | Leverages | Feasibility |
| --- | --- | --- | --- | --- | --- | --- |
| Entry | Guest tablet / coaster | `guest` | arriving · leaving | Assigns "on guest duty"; surfaces house info | Guest Portal (minimal today) | 🔶 / future |

---

## Top 10 detailed recipes (the 10× set)

The first eight work **today** with zero code. The last two are the highest-value "obvious" ideas
and need the small launch-action build.

### 1. Front door — `main-door` ✅

The anchor tag. One by the door, programmed once, used every single day.

- **States:** `leaving · arriving`
- **A tap does:**
  - *Leaving* → wakes every task with a `nfc_state_change` prerequisite on `main-door / leaving`
    and shows the "before you go" checklist.
  - *Arriving* → welcome screen + dashboard, and wakes the "just got home" chain.
- **Dormant items to create** (status `dormant`, prerequisite `nfc_state_change → main-door / leaving`):
  - Turn off the oven · Lock the balcony door · AC/lights off · Grab keys, wallet, water bottle.
- **Arriving chain** (prerequisite `main-door / arriving`): Unpack groceries · Put keys in the bowl ·
  Glance at today's remaining tasks. After a trip, this is where household routines resume.
- **Checklist (leaving):** quick visual list mirroring the dormant items for anyone who prefers a
  tick-list over full tasks.
- **You feel:** you never again drive off wondering if the oven is on; your partner sees the same
  checklist whether they tap or you do.

### 2. Trip luggage — `luggage` ✅

Bridges the [[Trips Overview]] lifecycle to a physical object.

- **States:** `packed · unpacked`
- **A tap does:**
  - *Packed* → shows the trip packing checklist; lines for passport/visa/charger auto-tick when the
    matching catalogue document tags are "ready" (cross-tag auto-complete).
  - *Unpacked* (on return) → wakes post-trip chores.
- **Dormant items (unpacked):** Start a laundry load · Restock toiletries · Reset the meal plan.
- **You feel:** packing becomes a 30-second tap-and-tick; the day you get back, the "catch-up"
  list appears without you thinking about it.

### 3. Dishwasher — `dishwasher` ✅

The best demonstration of multi-state + cross-tag auto-complete.

- **States:** `running · clean · empty`
- **A tap does:** advances the machine's state. The kitchen `main-door`/`pantry` "tidy kitchen"
  checklist carries a line **"Dishwasher emptied"** with `source_tag = dishwasher`,
  `source_state = empty` — so it ticks itself the moment anyone sets the dishwasher to `empty`.
- **You feel:** no more "is it clean or dirty?" arguments; whoever empties it just taps, and the
  rest of the household's checklists update.

### 4. Bedtime — `bedtime` ✅

- **States:** `night · morning`
- **A tap does:**
  - *Night* → wakes the evening routine.
  - *Morning* → wakes today's chores and (🔶 with launch-action) could open Plan My Day directly.
- **Dormant items (night):** Take evening meds · Set the alarm · Put devices on charge · Skim
  tomorrow's plan. **(morning):** today's flexible routines, ready to place.
- **You feel:** a single tap closes the day and another opens it — no app-hunting at 11pm or 7am.

### 5. Pantry / fridge restock — `pantry` ✅

- **States:** `low · stocked`
- **A tap does:** *low* surfaces the low-stock checklist (driven by your [[Inventory Overview]]
  items) and wakes "add to shopping list" tasks; *stocked* clears it after a shop.
- **You feel:** the moment you notice you're out of something, one tap queues it for the next run —
  no opening the app, no forgetting by the time you're at the store.

### 6. Trash / bins — `bins` ✅

- **States:** `out · in`
- **A tap does:** wakes the shared "take out the trash / bins" chore and logs **who** did it and
  **when** to the audit trail.
- **You feel:** the recurring chore is settled in a tap, and the history ends the "I did it last
  time" debate.

### 7. Gym bag — `gym` ✅

- **States:** `going · done`
- **A tap does:** *going* shows the kit checklist (shoes, towel, shaker); *done* marks your
  recurring gym item complete and stamps the visit into the state log.
- **You feel:** your attendance becomes a real, reviewable record without any manual tracking.

### 8. Medicine cabinet — `meds` ✅

- **States:** `taken-am · taken-pm`
- **A tap does:** records each dose to `nfc_state_log` (your adherence record) and can wake a
  "refill prescription" reminder when stock runs low.
- **You feel:** "did I take it today?" is answered by the last tap; the log is a ready-made
  adherence history.

### 9. Fridge → grocery expense — `fridge` 🔶 *(headline)*

The single most-requested "obvious" NFC idea.

- **States:** `check · stocked`
- **Works today:** the low-stock checklist (as in recipe 5).
- **Needs the build:** a tap that opens the expense form prefilled to your groceries category and
  everyday account — i.e. `/expense?category=groceries&account=wallet`. The destination URL already
  works (it's how the QR scanner pre-fills expenses); only the **NFC→link launch action** is missing.
  See [Build backlog](#build-backlog--what-unlocks-the--ideas).
- **You feel:** unpacking the shop → one tap → amount → done, instead of opening the app and
  picking category + account every time.

### 10. Bills / admin drawer — `bills` 🔶 *(headline)*

- **States:** `to-pay · paid`
- **Works today:** wakes a "pay rent / utilities" dormant reminder with a checklist.
- **Needs the build:** a tap that **confirms a recurring payment** (the `POST /api/recurring-payments/[id]`
  action that turns a due bill into a real transaction and advances the next due date).
- **You feel:** the physical act of paying a bill and recording it in ERA become the same tap.

---

## Zone-by-zone catalog (quick ideas)

**Entry / hallway** — `main-door` (anchor, recipe 1) · `mailbox` to wake "process the mail" ·
a `keys` hook tag that wakes "grab umbrella" (🔲 nicer once the weather evaluator is enabled).

**Kitchen** — `fridge` (recipe 9) · `pantry` (recipe 5) · `dishwasher` (recipe 3) · `bins`
(recipe 6) · `coffee` for a morning-prep checklist.

**Bedroom** — `bedtime` (recipe 4) · a `wardrobe` tag whose checklist auto-ticks "laundry folded"
cross-tag from the `laundry` machine.

**Bathroom** — `bathroom` toiletry restock · `meds` adherence (recipe 8).

**Home office** — `work` to split work vs personal task context; pairs well with location-based
items. (🔶 to deep-link straight to the Focus briefing.)

**Laundry / utility** — `laundry` 3-state cycle; shared so either partner advances it.

**Admin** — `bills` (recipe 10); a `documents` tag whose checklist mirrors catalogue document
items (passport, visa, residence proof) for renewals.

**Living room** — `movie-night` wind-down checklist (lights, doors, charge remotes).

**Garage / car** — `car` out/parked for errand context (🔶 to log a fuel expense on tap).

**Perimeter** — `bins-curb` for collection day · `pet` feeding/walk log so nobody double-feeds.

**On the go** — `wallet` cash-expense launch (🔶, recipe-style) · `gym` (recipe 7) · `work-desk`
away-from-home context · `fuel` station launch (🔶).

**Travel** — `luggage` (recipe 2) · `travel-docs` checklist from the catalogue · `trip` to kick off
trip prep (🔶 to auto-activate the Trips lifecycle itself).

**Guest-facing** — `guest` arriving/leaving to assign "guest duty" and surface house info. Ties to
the [[Guest Portal Overview]], which is minimal today — treat as a future idea.

---

## Deploy-this-weekend quick start

Five tags, **zero code**, biggest everyday return:

1. `main-door` — leaving / arriving (recipe 1)
2. `bedtime` — night / morning (recipe 4)
3. `bins` — out / in (recipe 6)
4. `gym` — going / done (recipe 7)
5. `luggage` — packed / unpacked (recipe 2)

Each is pure state-flip + prerequisite + checklist, so they work the moment you create the tag and
attach the dormant items.

---

## Build backlog — what unlocks the 🔶 ideas

Short, prioritised pointers. None of these are required for the ✅ ideas above.

1. **"Launch action" tag type** *(unlocks `fridge`, `wallet`, `bills`, `car`, `fuel`)* — add an
   optional action/URL config to `nfc_tags` (today it has none — see
   [[Overview]] schema) so a tap can open a prefilled deep link. The destinations already exist:
   - Expense: `/expense?account=…&category=…&amount=…&description=…` (same params the QR scanner uses).
   - Transfer modal: `?from=…&to=…&amount=…`.
   - Recurring payment confirm: `POST /api/recurring-payments/[id]`.
   This is the single highest-leverage enhancement — it converts the four 🔶 headline ideas into
   one-tap actions.
2. **Enable the `time_window` evaluator** *(unlocks automatic morning/night context)* — currently a
   stub in `src/lib/prerequisites/evaluators/time-window.ts`. Lets one tag behave differently by time
   of day without a manual override.
3. **Enable the `weather` evaluator** *(unlocks conditional tags like the umbrella hook)* — stub in
   the same evaluators folder.

> See [[Prerequisites Overview]] for how these evaluators plug into the engine.

---

## Setup cheat-sheet

For each tag (full reference in [[Overview]] → *Setup: Adding a New NFC Tag*):

1. **Program the chip** with the generic URL: `https://your-app.com/nfc/{slug}`.
2. **Create the tag record** via the admin UI (`/nfc`) or SQL:
   ```sql
   INSERT INTO nfc_tags (user_id, tag_slug, label, location_name, states)
   VALUES ('your-user-id', 'main-door', 'Main Door', 'Home Entrance', '["leaving","arriving"]');
   ```
3. **Attach dormant items** — create the tasks with status `dormant` and a prerequisite of type
   `nfc_state_change`, config `{ "tag_id": "…", "target_state": "leaving" }` (see [[Prerequisites Overview]]).
4. **Add per-state checklists** — `nfc_checklist_items` rows for each state; set `source_tag_id` +
   `source_state` for cross-tag auto-complete.
5. **Test the cycle** — tap, confirm the state flips, the dormant items wake, and the checklist shows.

---

## Related

- [[Overview]] — NFC architecture, tap flow, schema, hooks, gotchas
- [[Prerequisites Overview]] — the dormant → pending trigger engine
- [[Items & Reminders Overview]] — the tasks that tags wake up
- [[Trips Overview]] — packing lists & lifecycle the `luggage`/`trip` tags hook into
- [[Inventory Overview]] — the low-stock data behind `fridge`/`pantry`
- [[Recurring Payments Overview]] — the `bills` tag's confirm action
