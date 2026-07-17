---
created: 2026-07-17
type: design-study
status: proposed
owner: Elio
author: Claude Fable 5
tags:
  - pm/design-study
  - module/hub-era
  - ai/proactive
---

# ERA Top View — Design Study

> **What this is:** the design for the ERA Hub's **top view** — the surface you see the moment you open ERA, acting as the *fastest assistant companion*: full household picture, near-zero commands, lightning paint. Requested by Elio 2026-07-17 as generational-handoff material: written so **any lower-tier model can execute it packet by packet** without re-deriving the reasoning.
>
> **Position:** this is a *companion study* to the [ERA Awakening Master Plan](<ERA Awakening — Master Execution Plan (2026-07-06).md>) — it consumes that plan's signal engine; it does not fork it. Honesty first: the Awakening anti-plan (§11) says *"no new plan or audit documents until G1 is scored,"* and as of today **no Awakening packet is ticked** (`git log --since=2026-07-06` shows PM-center/agentic/trips work; the WP queue is untouched). This study exists on owner request and is deliberately structured so its packets slot into the Awakening queue *behind* the heartbeat — it must never become the reason the heartbeat slips. If a session must choose between WP-04 (first briefing) and anything here, WP-04 wins, every time.

---

## 1 · Product definition — what "fastest assistant companion" means

The Doctrine's promise (§1): capture costs near-zero attention, and the system gives attention back as foresight. The Awakening plan builds the *push* half (ERA speaks at 07:15). The Top View is the *pull* half: **when Elio opens ERA, the full household picture is already on screen — zero commands, zero taps, sub-second.**

The user's own framing, which is the spec: *"if I have time I would use the application modules themselves; if I want quick support, ERA would use them for me."* So the Top View is a **renderer and a router, never an owner**: it reads through the modules' existing structured layers (bundle RPCs, summary hooks, drafts, message actions), and every element on it is a door into the precision tool that owns the data.

### The interaction ladder (each level costs one step more)

| Level | Interaction | What the user gets | Cost |
|---|---|---|---|
| L-0 | **Glance** | Full picture: vitals of all four faces + ranked signal cards | 0 taps, 0 words |
| L-1 | **One tap** | A signal card's attached action → **draft/proposal**, confirm, Undo | 1 tap |
| L-2 | **One door** | Any tile deep-links into the owning module page (precision tool) | 1 tap + navigation |
| L-3 | **One sentence** | CommandBar / voice — the existing intent router | speak/type |

The Top View's job is to make L-0 so good that most sessions *end* at L-0 ("nothing needs me — close the app" is a successful visit), and to make L-1/L-2 so direct that when something does need attention, the path is one motion. This is Doctrine §5 priority 3 (capture speed) applied to *reading* instead of writing.

### The 5-second contract (acceptance shape)

Opening ERA must answer, within 5 seconds and without any input:
1. **Is anything wrong or due?** (ranked signal cards — same severity classes as the briefing)
2. **Where does the household stand?** (four-face vitals: money, time, kitchen, memory)
3. **What would ERA do about it?** (each card carries one proposed action, drafts-pattern)

If all three are visible on a **mobile** viewport from cache while offline, the contract holds.

---

## 2 · Verified starting position (2026-07-17)

Everything verified against the working tree today. This is the "enhance, not reproduce" ledger — what exists, and precisely where it falls short of the contract.

| Asset | State | Evidence | Gap vs the contract |
|---|---|---|---|
| `EraHubView.tsx` | ✅ visual brain: greeting + orbital ERAMark + face label | `src/components/era/EraHubView.tsx` (74 LOC) | Pure decoration when idle — zero information at L-0 |
| `HubScatterWidgets.tsx` | ✅ 4 stat cards around the mark | `src/components/era/HubScatterWidgets.tsx` (540 LOC) | **Desktop-only** (`hidden md:block`) and **only when awake** — the fastest-companion gap is worst on the phone, where it matters most |
| Widget summary hooks | ✅ 4 hooks with real aggregation | `src/features/era/widgets/use{Budget,Schedule,Chef,Brain}Summary.ts` | ~5–6 independent round trips (budget = 2 tx fetches; schedule = direct client Supabase query, limit 300; chef/brain = 1 REST each) ≈ **1–1.2 s latency floor** — Hard Rule 21 territory. Schedule hook **re-implements** aggregation that `get_schedule_bundle` already owns server-side — quiet second-engine drift |
| Face dashboards & widgets | ✅ per-face detail views | `src/components/era/dashboards/`, `face-widgets/` | Right layer for L-2 depth; not glanceable |
| `WebTabletMissionControl.tsx` | ✅ tablet "full picture" precedent | `src/components/web/WebTabletMissionControl.tsx` (2,564 LOC) | A precedent for density, and a warning: monolith, web/tablet-scoped, not signal-ranked. **Do not extend it; do not copy its structure** |
| Signal substrates | ✅ server-side | `get_schedule_bundle` RPC, `lib/recurring` dues, Budget forecast substrate (Budget FABLED 2 E1) | Exactly what the Top View should read — currently unread by ERA's hub surface |
| Signals registry / composer | ❌ not built | Awakening WP-03/04 (`src/lib/briefing/signals.ts` planned) | **The Top View's brain. Hard dependency** |
| Reviewed-proposal card UX | ✅ shipped reactively | `BulkConvertReviewSheet` + draft reminders (06-16) | The L-1 pattern to reuse verbatim |
| Offline/cache discipline | ✅ app-wide | React Query + `CACHE_TIMES`, `safeFetch`, offline queue | Top View must paint from hydrated cache with a staleness stamp |

**The one-sentence diagnosis:** ERA's hub view is a beautiful face with no eyes on mobile — the data layer it needs mostly exists (bundles, dues, forecasts, proposal UX), but nothing composes it into a single glanceable, ranked, actionable surface, and the current widget hooks got there by quietly re-implementing aggregation client-side instead of reading the bundles.

---

## 3 · Design thesis — one brain, two mouths

**The briefing and the Top View are the same product at two delivery times.** The 07:15 briefing is the household picture *pushed*; the Top View is the household picture *pulled*. Building them on separate data paths would recreate the app's historical failure mode (second engines). Therefore:

> **Standing decision (this study's core):** the Top View renders **the same typed signals** the briefing composer ranks (`getBriefingSignals()` per module → ranker → severity classes), plus a four-face vitals layer served by **one** `get_era_topview_bundle()` SECURITY DEFINER RPC. No signal logic may exist only in the Top View; anything the Top View knows, the briefing can say, and vice versa.

Consequences, each pre-decided so no session deliberates:

1. **Deterministic-first, same as D3.** The Top View contains zero LLM calls in v1. Templates over verified signals. A wrong number at a glance costs more trust than an empty slot (Doctrine Corollary A).
2. **One RPC to paint** (Hard Rule 21). The four vitals + signal inputs collapse into `get_era_topview_bundle()` returning JSON aggregates — replacing today's ~5–6 round trips with one. The existing four widget hooks become thin selectors over the bundle query (they keep their interfaces; `HubScatterWidgets` and the face dashboards keep working — same enhancement path Budget's bundle took).
3. **Read-only surface, drafts-only actions.** The Top View never mutates directly. Every card action creates a draft/proposal (the `BulkConvertReviewSheet` semantics) → confirm → Undo. This is the Trust Question answered by construction.
4. **Renderer, not owner.** Every tile deep-links to the owning module route (faceRegistry already carries `route` per face). The Top View being good makes the modules *more* used, not less — it's the front door, not a replacement lobby.
5. **Offline = cached picture + honest stamp.** On open with no network: last bundle from React Query hydration + "as of 07:42" staleness line. Never a spinner as the whole surface, never silently-stale money (O5: money values older than `CACHE_TIMES.TRANSACTIONS` render with the stamp, not as fresh truth).

---

## 4 · Surface specification

Mobile-first (Hard Rule 5); desktop is the same stack with the orbital mark as centerpiece. Four zones, top to bottom:

### Zone 1 — Status line (replaces the static greeting subtitle)
`Good morning, Elio.` stays. The subtitle `"4 threads on deck…"` becomes a **computed household status sentence** from the ranked signals — the briefing's headline, standing still: *"Quiet day — 2 reminders, groceries due, spending on plan."* One sentence, deterministic template, severity-colored dot. This is the cheapest possible win and ships first (WP-T2).

### Zone 2 — Signal stack (the heart)
Max **3 cards** visible (overflow behind "+N more"), ranked by the composer's ranker, severity classes `urgent / info / digest` matching D5. Each card:
- **claim** (one line, deterministic, with provenance: "Netflix due tomorrow — recurring #42")
- **one action** (optional): `Log it` / `Postpone` / `Review` → draft/proposal, never a direct write
- **one door**: tap body → owning module deep-link
Attention economy rule: an empty signal stack is a *feature* ("Nothing needs you") — never pad it. The same regret metric as notifications (§8 Awakening) applies: cards dismissed <5 s count against the ranker.

### Zone 3 — Four-face vitals strip
One compact row/grid (2×2 mobile) — per face: one number, one delta, one micro-trend, face hue:
- **Budget**: period spend vs plan + `deltaPct` + 7-day sparkline (exists in `BudgetSummary`)
- **Schedule**: today count + overdue count (exists in `ScheduleSummary`)
- **Chef**: tonight's planned meal / low-stock count
- **Brain**: catalogue/inventory pulse
Tap → face dashboard (L-2). Person-absolute colors for any household attribution (Hard Rule 14). This zone is `HubScatterWidgets`' content, **promoted to mobile and demoted in chrome** — data over theatre.

### Zone 4 — CommandBar (unchanged)
The existing bar stays the L-3 escape hatch. No new input surfaces. Voice unchanged.

### States
- **Ambient (default, replaces "asleep = grayscale nothing"):** Zones 1–3 fully rendered from cache. The mark shrinks; information leads. The current awake/asleep theatre inverts: *data is always awake; only the conversational layer sleeps.*
- **Awake/listening:** current behavior (mark grows, transcript overlays) — Top View dims behind it.
- **Offline:** identical layout + staleness stamp; card actions queue through the existing offline path or disable with reason.

---

## 5 · Data architecture

```
                    ┌──────────────────────────────┐
   Supabase ──────► │ get_era_topview_bundle() RPC │  (SECURITY DEFINER, 1 round trip)
   (items bundle,   │  → { budget, schedule, chef, │
    recurring dues, │      brain, signalInputs }   │
    tx aggregates)  └──────────────┬───────────────┘
                                   │ React Query: eraKeys.topview()
                    ┌──────────────▼───────────────┐
                    │ src/lib/briefing/signals.ts  │  (WP-03 — shared brain)
                    │  getBriefingSignals() + rank │
                    └───────┬──────────────┬───────┘
                       pull │              │ push
                ┌───────────▼───┐   ┌──────▼──────────┐
                │ ERA Top View  │   │ 07:15 briefing  │
                │ (this study)  │   │ (WP-04, card    │
                │               │   │  WP-11)         │
                └───────────────┘   └─────────────────┘
```

- **RPC contract:** follows `get_schedule_bundle` precedent (db-migration skill; RLS via SECURITY DEFINER owning the WHERE clause — Hard Rule 20/21). Household scope honored inside the function (partner data per `household_links`, Ten Questions Q1).
- **Caching:** `staleTime` = shortest constituent (`CACHE_TIMES.TRANSACTIONS`); invalidation set = the union of the four widgets' current keys → document in the cache-invalidation matrix. Theme change already nukes all queries (Hard Rule 10) — acceptable.
- **Latency budget (the point of the whole study):** cached paint **<100 ms** (hydration, no network) · fresh bundle ≤ 1 RPC ≈ 200 ms network + query · signals ranking is pure client compute over bundle data — **0 extra round trips**. Compare today: ~5–6 round trips ≈ 1–1.2 s before query cost.
- **Client-side aggregation moves server-side or into shared pure functions** — the schedule widget's client re-aggregation (300-row fetch + loop) is retired in favor of bundle output; budget's two-fetch delta math moves into the RPC. The hooks' *shapes* (`BudgetSummary`, `ScheduleSummary`, …) are kept as the RPC's output contract so every existing consumer survives.

---

## 6 · The Ten Questions, answered (Doctrine §2 — mandatory)

1. **Partner:** the bundle RPC scopes household data exactly as module APIs do; partner sees her own Top View with her signals; shared facts (chores, meals, joint spend) attributed person-absolutely. Her first Top View follows D6 sequencing (tuned on Elio first).
2. **Capture cost:** zero added — this surface only *reduces* reads-cost. Card actions are 1 tap + confirm (draft pattern already priced).
3. **Offline:** cached paint + stamp; actions queue or disable with reason. Written down here, not discovered.
4. **Undo:** card actions are drafts → confirm → Undo toast (Hard Rule 1). The inverse of every action is the draft's deletion.
5. **Exactly-once:** the Top View writes nothing on render (read paths never mutate — standing decision). Card actions dedupe as their underlying draft flows already do.
6. **Invalidation:** one query key (`eraKeys.topview()`) invalidated by the union of the four widget key triggers; enumerated in WP-T1's gate.
7. **Latency floor:** 1 RPC. That *is* the study.
8. **Person-absolute:** vitals and signals carrying attribution use `useTheme()`-derived person colors.
9. **Proactive:** this surface is the pull mouth of the proactive brain — signals shared with the briefing by construction.
10. **Trust:** deterministic templates, provenance on every claim, drafts-only actions, staleness stamps on money.

Silent-failure pre-mortem (§3): the new instance this feature risks is **stale truth** (a glanceable number believed fresh). Mitigation is structural: single bundle timestamp rendered as the stamp; money older than its cache class never renders unstamped.

---

## 7 · Anti-scope (what this is NOT)

- **Not a second aggregation engine.** No signal logic exclusive to the Top View. If a card needs data the signals registry doesn't have, extend the registry (both mouths benefit).
- **Not a new module.** No `src/features/topview/`. It lives in the ERA junction (`src/components/era/`, `src/features/era/`) and reads through existing layers.
- **Not a WebTabletMissionControl v2.** Density without ranking is noise; that component is a precedent to *retire toward* this design eventually, not extend.
- **Not an LLM surface.** v1 has zero AI calls. LLM phrasing of the status line is earliest Phase 4, behind WP-22's quota gauge, same as the composer.
- **Not before the heartbeat.** No Top View packet ships before WP-03/WP-04 are ✅ (see §8 sequencing). The pull mouth without the push heart repeats the app's "knows more than it does" failure.

---

## 8 · Execution packets (Awakening-format: ID · size · prereq → skills → gate)

These extend the Awakening WP queue; tick them there and PM-trace in Hub & ERA files 1+4 per Hard Rule 25. Sequenced so each rides an Awakening packet rather than competing with it.

- [ ] **WP-T1 · `get_era_topview_bundle()` RPC + hook migration · 1.5** — prereq: none technically, but *scheduled after WP-04 ships* (heartbeat first). Migration per `get_schedule_bundle` precedent; four widget hooks become selectors over `eraKeys.topview()`; keep output shapes = current `*Summary` interfaces. Skills: `db-migration`, `cache-invalidation`, `money-rules` (budget deltas are display money math — worked example + test). → *Gate:* network tab shows exactly 1 request where ~5–6 fired; all four existing widgets render unchanged; invalidation union enumerated in the doc; typecheck/tests green.
- [ ] **WP-T2 · Status line v1 · 0.5** — prereq: WP-03 (signals exist). Replace the static subtitle with the deterministic status sentence from ranked signals; severity dot. Skills: `ui-guardrails`. → *Gate:* sentence changes when a fixture signal changes; renders on mobile; zero new requests.
- [ ] **WP-T3 · Vitals strip on mobile (ambient state) · 1** — prereq: WP-T1. Promote scatter-widget content to a mobile-first 2×2 strip; invert awake/asleep so data always renders; keep desktop orbital theatre. Skills: `ui-guardrails`. → *Gate:* phone viewport shows all four vitals from cache <1 s; offline airplane-mode open still paints with stamp.
- [ ] **WP-T4 · Signal stack + card actions · 1.5** — prereq: WP-11 (briefing card substrate — the same card component renders in both mouths). Max-3 ranked cards, provenance line, one draft-action each, "+N more". Skills: `ui-guardrails`, `cache-invalidation`. → *Gate:* seeded urgent signal appears ranked first; its action produces a draft (never a direct write); dismissed-fast counts into the regret metric.
- [ ] **WP-T5 · Doors + polish · 0.5** — prereq: T2–T4. Deep-links from every tile (faceRegistry routes + card-type → module route map); staleness stamps; empty-state ("Nothing needs you"). Skills: `ui-guardrails`. → *Gate:* every visible element navigates somewhere真; Atlas entry updated (Hard Rule 23).

**Total ≈ 5 sessions.** Natural insertion: T1 can ride Phase 1's tail (it's pure performance debt repayment); T2 lands with WP-04's signals; T3 anytime after T1; T4 explicitly rides WP-11; T5 last. If the Awakening plan re-scopes (two missed gates ⇒ shrink), T4/T5 are this study's designated sacrifice — T1–T3 alone already deliver the glance contract.

---

## 9 · Handoff notes for lower-tier executors

You are implementing a *renderer over existing layers*. You should almost never write new business logic. Before each packet:

1. Run `start-task`; read this study §3–§5 + the packet row.
2. **Patterns to copy, not invent:** RPC shape → `migrations/2026-05-11_schedule_bundle_rpc.sql`; proposal card → `BulkConvertReviewSheet`; query keys → `src/features/era/queryKeys.ts`; toasts → Hard Rule 1; person colors → Hard Rule 14.
3. **STOP conditions (ask Elio):** a signal needs data no bundle/registry provides · a card action has no existing draft flow to ride · the RPC needs RLS decisions beyond the SECURITY DEFINER precedent · anything pushes you to write into `HubPage.tsx` (it only shrinks — Awakening O2 rule).
4. Money numbers: any new display math = `money-rules` worked example + test. No exceptions for "it's just a delta."
5. End with `finish-task`; tick the packet in the Awakening plan §7 area or here, ✅-stamp Hub & ERA files 1+4.

## 10 · Open questions for Elio (defaults binding if unanswered)

1. **Q-T1 — Landing surface:** should `/era` ambient Top View become the app's *default post-login landing* (replacing `/dashboard`) once T1–T3 ship, or stay a destination? *(Default: stay a destination; revisit after 2 weeks of SFR data — the capture-share metric will say where you actually open.)*
2. **Q-T2 — Dashboard convergence:** `EnhancedMobileDashboard` and the Top View will overlap. Converge later (dashboard keeps deep KPI role, Top View owns glance+act) or plan a merge? *(Default: converge later; no merge packet exists until both surfaces have usage data.)*
3. **Q-T3 — Partner's Top View content:** same Q-PARTNER answer as the briefing (her chosen flow leads her signal ranking). *(Default: identical ranker, her data scope.)*

## 11 · Delta ledger (append-only)

- **2026-07-17** — Study created on owner request (Fable handoff window). Verified: EraHubView/HubScatterWidgets/4 widget hooks round-trip count, mission-control precedent, Awakening WP queue untouched since 07-06. Core decision: Top View = pull mouth of the briefing brain; one bundle RPC; drafts-only actions; sequenced behind the heartbeat.
