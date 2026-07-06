---
created: 2026-07-06
type: reference + ideas
status: living
tags:
  - scope/vault
  - pm/backlog
---

# ERA — Module Map & New Module Ideas

> **One page, two jobs.** Part 1 is the complete map of what exists today — every Standalone module and every Junction, with repeats where a module lives in several junctions. Part 2 is the candidate list of **new modules** that fit the target: **ERA — Household AI Proactive Assistant**.
>
> Sources: [Feature Map](<../01 - Architecture/Feature Map/_index.md>) (validated by `pnpm docs:check`), CLAUDE.md Module Model, [FABLED 2 Master Index](<../00 - Home/FABLED 2 Master Index.md>) (2026-07-06). Long-range poetic versions of many Part 2 ideas live in the **Future Vision Vols. 1–5** in this folder — this doc distills them into *module-shaped* proposals (type, connections, proactive move) and adds new ones.

---

## Part 1 — What exists today

### Universal junctions (touch every module — not repeated per row)

Three junctions connect to **ALL** standalones by design. Assume them everywhere; the tables below list only *specific* junction memberships.

| Universal junction | What it does for every module |
|---|---|
| **AI Assistant** | Context injection into ERA chat, proactive briefing, voice mode, faces |
| **Household Sharing** | Partner data via `household_links` + `profiles` |
| **Sync & Offline** | IndexedDB mutation queue + `OfflineSyncEngine` |

### Standalone modules (26)

**💰 Money cluster**

| Module | What it is | Specific junctions |
|---|---|---|
| Transactions | Expense form, category grid, voice entry, draft transactions | Hub Chat, Message Actions, Notifications, Trips |
| Accounts & Balance | Account list, balance card, balance history | Trips (auto trip account), Notifications |
| Transfers | Between-account transfers | — |
| Recurring Payments | Recurring commitments, auto-posting, forecast | Notifications (payment reminders) |
| Categories | Categories + subcategories, colors/icons | — |
| Budget Allocation | Envelope-style allocations across categories | Notifications (spend alerts) |
| Debts | Owed-to / owed-by, settlement | — |
| Future Purchases | Wishlist of things to buy later | — |
| Statement Import | CSV/PDF statement upload, merchant mapping | — |
| Drafts | Pending transactions drawer — the AI-proposes/human-confirms gate | AI Assistant (all AI money writes land here) |
| Analytics | Net worth, charts, world map of spend | — |

**📅 Time & Tasks cluster**

| Module | What it is | Specific junctions |
|---|---|---|
| Items & Reminders | Schedule, calendar, reminders, recurrence, alerts | Plan My Day, Hub Chat, Message Actions, Notifications, Prerequisites, Trips |
| Chores | Household chores, postpone, "up next" hero | Trips (pause during trip) |
| Focus | Flexible routines / focus page | Plan My Day, AI Assistant (Focus briefing) |
| Dashboard | Main landing — KPI cards, recent activity | AI Assistant (briefing surface) |

**🍳 Kitchen cluster**

| Module | What it is | Specific junctions |
|---|---|---|
| Recipes | Recipe book, cooking mode, versions | Shopping List (ingredients → list), Trips |
| Meal Planning | Weekly planner, recipe → day mapping | Shopping List, Trips |
| Inventory | Pantry stock, restock dialog | Shopping List |

**🗂️ Library & Templates**

| Module | What it is | Specific junctions |
|---|---|---|
| Catalogue | Saved templates for items, recipes, tasks | Trips (packing lists) |
| Recycle Bin | Soft-deleted rows with restore (cross-module utility) | — |

**📱 Surfaces & Access**

| Module | What it is | Specific junctions |
|---|---|---|
| Watch UI | Wear OS surface — voice entry, simple face | — |
| Guest Portal | Public `/g/[tag]` views for visitors | — |
| NFC Tags | Tap-to-log slug routes, admin page | Prerequisites |
| Preferences | LBP rate, theme, month start, onboarding | — |

**🔧 System & Meta**

| Module | What it is | Specific junctions |
|---|---|---|
| Error Logs | Persistent structured error viewer | — |
| AI Usage | Token usage tracking (excluded from Feature Index — tooling, not product) | — |

### Junction modules (10) — with their connected standalones

Modules repeat across junctions on purpose; that repetition *is* the map.

| Junction | Connects (standalones) | Role |
|---|---|---|
| **Hub Chat** | Transactions · Items & Reminders · Shopping List | Top-layer conversational interface; low-friction everyday actions |
| **Message Actions** | Hub Chat → Transactions · Items & Reminders | Turns a chat message into a real entry |
| **Shopping List** | Hub Chat · Recipes · Inventory | One list fed from chat, recipes, and pantry gaps |
| **Plan My Day** | Items & Reminders · Chores · Focus | Places one-time + recurring + flexible work into a day plan |
| **Trips** | Accounts & Balance · Transactions · Items & Reminders · Chores · Meal Planning · Catalogue | Lifecycle trips: auto account, schedule pause/skip, packing lists |
| **Prerequisites** | NFC Tags · Items & Reminders | Dormant items activate when physical/logical triggers fire |
| **Notifications** | Items & Reminders · Recurring Payments · Budget Allocation / Transactions | Push + alert spine; every proactive message exits through here |
| **AI Assistant** | ALL — esp. Transactions · Items & Reminders · Drafts · Focus · Dashboard | ERA's brain: context injection, briefing, voice, proposal drafts |
| **Household Sharing** | ALL | Shared-household data layer |
| **Sync & Offline** | ALL | Offline queue + reconciliation for every mutation |

> **Shape warning (FABLED 2, 2026-07-06):** the money core scores strongest (5.4) and the junction-heavy clusters weakest (Hub & ERA 4.0, Trips 2.8) — *inverted* from where a proactive assistant needs strength. Part 2 respects this: prefer new **standalones with a thin junction surface**, and route all proactivity through the existing Notifications + AI Assistant spine rather than inventing new cross-module engines.

---

## Part 2 — New module candidates for the ERA target

**The admission filter.** ERA's identity is *proactive household intelligence*. A new module earns a place only if it passes: **"Does its data let ERA notice, say, or do something useful before being asked?"** A module that only stores what you type is a filing cabinet, not an assistant limb. Each entry below states its **proactive move** — the sentence ERA gets to say unprompted because the module exists.

**Process gates (existing, respect them):** [Design Doctrine](<../01 - Architecture/Design Doctrine.md>) Ten Questions before designing · `new-module` skill for scaffolding · `skill-factory` for the domain skill (it already anticipates **Healthcare, Diet, Workout**) · every idea inherits FABLED 2's kill-criterion culture — a reason *not* to build is listed where it's real.

### Tier 1 — Natural next modules (high fit, buildable on today's foundations)

| # | Module | Type | What it does | Junctions with existing modules | Proactive move (what ERA says unprompted) |
|---|---|---|---|---|---|
| 1 | **Health & Medications** | Standalone | Family health profiles, medications + dosage schedules, med stock, doctor visits, vaccination records | Notifications (dose/refill reminders) · Items (appointments) · Hub Chat (log "took my pill") | "Amoxicillin course ends Thursday — the follow-up visit isn't booked yet." / "~4 days of Panadol left — added to shopping list?" *(Vision Vol. 4 §7; skill-factory anticipates Healthcare)* |
| 2 | **People & Occasions** | Standalone | Household CRM: birthdays, anniversaries, gift ideas, sizes, preferences, last-contacted | Items (event creation) · Future Purchases (gift ideas) · Transactions (gift budget) · Notifications | "Rita's birthday in 10 days. You saved a gift idea in March — budget has room this month." *(Vol. 2 Social Brain + Vol. 4 §10 Gift Operator)* |
| 3 | **Documents & Expiry Vault** | Standalone | Passports, IDs, residency papers, insurance policies, contracts — with expiry dates and photos | Notifications (expiry countdowns) · Trips (**passport-validity check on trip creation** — killer feature) · future Vehicle/Home modules | "Your passport expires 4 months after the August trip — some airlines require 6. Renew first." *(Vol. 4 §3)* |
| 4 | **Home Maintenance & Appliances** | Standalone | Appliance registry, warranties, filter/service schedules, provider contacts + service history | Chores (maintenance tasks) · Recurring (service costs) · Catalogue (checklists) · NFC (tag on the AC → log service) | "AC filter is 6 months old — last summer you waited and paid for a deep clean." *(Vol. 3 §6 + Vol. 4 §11)* |
| 5 | **Vehicle** | Standalone | Mécanique + registration dates, insurance, oil change by km, fuel log, repairs | Documents Vault · Recurring · Notifications · Transactions | "Mécanique due within 30 days — book it; fines double after the deadline." *(Vol. 3 §7)* |
| 6 | **Utilities & Energy** (Lebanon-aware) | Standalone | Generator (moteur) subscription + monthly bill, EDL schedule, water delivery, internet quota | Recurring · Notifications · Analytics | "Generator bill usually lands this week (avg $85, trending up 3 months straight)." |
| 7 | **Parcels & Deliveries** | Standalone (thin junctions) | Track orders from purchase → shipped → door | Future Purchases (wishlist → ordered → delivered) · Inventory (delivered → stocked) · Notifications · Hub Chat | "The Amazon order clears customs today — someone should be home after 2 pm." *(Vol. 4 §14; the `new-module` skill's own worked example is a parcels module)* |
| 8 | **Automations / Rules Engine** | Junction | User-defined cross-module triggers — generalizes Prerequisites: "when X, then Y" (balance below threshold → alert; trip activated → pause plant watering) | Potentially ALL | This *is* proactivity-as-platform: every rule is a standing promise ERA keeps. **Kill criterion:** highest-leverage and highest-risk item on this page — do not start before the ERA Awakening notification/briefing spine is trustworthy, or rules will fire into the void. |

### Tier 2 — Strong fit, needs new data sources or a new habit

| # | Module | Type | What it does | Junctions | Proactive move |
|---|---|---|---|---|---|
| 9 | **Diet & Nutrition** | Junction | Nutrition layer over the Kitchen cluster: targets, macros, per-recipe nutrition | Recipes · Meal Planning · Inventory | "This week's plan runs ~30% over your protein target on paper but light on veg — swap Thursday?" *(Vol. 3 §3; skill-factory anticipates Diet)* |
| 10 | **Fitness & Workouts** | Standalone | Routines, sessions, progression | Focus / Plan My Day (placement) · Analytics | "You train best Tue/Thu mornings — this week both are free; placed a session at 7:00?" *(skill-factory anticipates Workout)* |
| 11 | **Goals & Milestones** | Standalone | Long-horizon goals decomposed into scheduled steps and funding | Items (steps) · Budget Allocation (money goals) · Focus · Analytics | "The 'emergency fund' goal slipped 2 months — the gap is exactly your dining-out delta." *(Vol. 3 Meaning/Career adjacent)* |
| 12 | **Journal & Memories** | Standalone | Daily notes, photos, mood — ERA's long-term memory substrate | AI Assistant (weekly Mirror reflection — Vol. 2) · Dashboard | "A year ago today you two were in Batroun — want the photo in tonight's briefing?" |
| 13 | **Guests & Hosting** | Standalone (extends Guest Portal) | Guest preference profiles (drinks, allergies), hosting checklists, menus per gathering | Guest Portal · Recipes · Shopping List · Catalogue | "Guests Saturday: Joe doesn't drink, Maya is vegetarian — last time you were short on ice." |
| 14 | **Watchlist & Cultural Diet** | Standalone | Movies / series / books / games queue, with whom, where streaming | Items ("movie night" scheduling) · People & Occasions | "Season 2 of the show you both parked dropped Friday — schedule a movie night?" *(Vol. 3 §11)* |
| 15 | **Pet Care** | Standalone | Feeding schedule, vet visits, vaccines, food stock | Chores · Inventory · Notifications | "Rabies booster due this month; food lasts ~9 more days." **Kill criterion:** no pet, no module. |
| 16 | **Plants & Garden** | Standalone | Per-plant watering/fertilizing schedules, care notes | Chores · NFC (tag per pot — tap to log watering) | "Heat wave this week — the balcony plants need water daily, not every 3 days." |
| 17 | **Weather Layer** | Junction (tiny) | One external feed piped into existing modules — no UI of its own beyond settings | Plan My Day (outdoor chores) · Trips (packing) · Notifications | "Rain at 16:00 — laundry is on the balcony and the car windows are open." Smallest build on this page, pure proactive value. |

### Tier 3 — Horizon (hardware / integrations / consent; Vision-volume territory)

| # | Module | Type | What it does | Junctions | Notes |
|---|---|---|---|---|---|
| 18 | **Location & Presence Mesh** | Junction | Geofences + NFC + device presence as trigger sources | Automations · Shopping List ("near pharmacy, Panadol is on the list") · Notifications | *(Vol. 5 §XI–XII)* Needs Automations first; privacy design is the hard part |
| 19 | **Comms Operator / Receptionist** | Junction | Drafts messages, chases bookings, makes calls on your behalf | People & Occasions · Items · Health (booking appointments) | *(Vol. 4 §1–2, Vol. 5 §III)* Agentic-action tier — only after the proposal/draft pattern is proven beyond money |
| 20 | **Home Automation Bridge** | Junction | IoT: water heater, AC, lights tied to schedule + presence | Utilities & Energy · Automations · Plan My Day | *(Vol. 5 §V)* Revisit alongside the Capacitor-shell decision |
| 21 | **Biometrics & Sleep** | Standalone | Wearable data: sleep, HR, energy — energy-aware day planning | Plan My Day · Focus · Journal | *(Vol. 3 §1–2, Vol. 5 §II)* Needs wearable data ERA can legally/technically read |
| 22 | **What-If Sandbox** | Junction | Simulation over Budget + Schedule: "can we afford X in March?" plays out real data | Analytics · Budget Allocation · Recurring · Trips | *(Vol. 2)* Read-only by nature — safe AI playground, expensive to make honest |
| 23 | **Kids / Childcare** | Standalone | School schedule, homework, activities, allowance | Items · Chores · Budget (allowance) · Health | **Kill criterion:** build when life needs it, not before |
| 24 | **Elder Care** | Standalone | Parents' meds, appointments, check-ins — household-of-households | Health & Medications · Notifications · People | The first module whose "household" crosses the `household_links` boundary — data model needs thought |

### Not new modules — extensions in disguise (honest pushback)

These sound like modules but would fragment existing ones. Build them **inside** their host:

| "Module" idea | Actually belongs in | Why |
|---|---|---|
| Subscriptions manager | **Recurring Payments** | Add trial-end dates, price-change detection, usage-vs-cost notes — the payment engine already exists; a second one violates recurrence-safety |
| Savings goals | **Future Purchases + Budget Allocation** | Add target dates + funding progress to what's already there |
| Bill/receipt OCR | **Statement Import** | Same pipeline (upload → parse → map → confirm), new input format |
| Shared expenses / IOU tracker | **Debts** | That's literally the Debts module |
| Warranty tracker | **Home Maintenance** or **Documents Vault** | A field + an expiry alert, not a surface |
| Tax prep *(Vol. 4 §8)* | **Documents Vault** | In the Lebanese context this is document retention + a yearly checklist, not a continuous engine |
| Daily briefing / digest | **AI Assistant** (already the [ERA Awakening plan](<../10 - Project Management/ERA Awakening — Master Execution Plan (2026-07-06).md>)'s Program 1) | It's the engine that makes every module above worth building — not a module itself |

### How to sequence (recommendation, not a plan)

1. **Engine before limbs.** ERA Awakening Phases 0–2 (briefing, trust, brain) come first — every Tier 1 module multiplies in value once the proactive spine actually speaks.
2. **First new module: Documents & Expiry Vault or Health & Medications.** Both are pure standalones (thin junction surface — respects the FABLED 2 shape warning), both generate high-stakes proactive moments from day one, and Health exercises the anticipated `skill-factory` Healthcare path.
3. **Weather Layer as the cheap proof** that a junction-only module can ship small and still feel magical.
4. **Automations/Rules Engine is the endgame**, not the start — it needs the Notifications spine, the drafts pattern, and several data-rich modules to trigger on before it's more than a toy.

*Every entry here is a proposal, not a commitment. Run new candidates through the Design Doctrine Ten Questions and the `skill-factory` decision gate before any scaffolding.*
