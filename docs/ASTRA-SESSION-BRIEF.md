> Historical research commission. The [current PM conventions](<../ERA Notes/10 - Project Management/_Conventions.md>) and [PM index](<../ERA Notes/10 - Project Management/_index.md>) supersede its folder-generation, backlog and session-governance instructions. Keep this as source evidence, not a template for another study tree.

# ASTRA Session Brief — ERA Project Enhancement Study

**For:** GPT-6 Codex (Astra) · **Repo:** `budget-app` (ERA) · **Written:** 2026-09-05 · **Owner:** Elio (solo owner-operator, single-household app)
**Read this file end to end before your first tool call. It is the contract for the entire session.**

---

## 0 · Mission, in one paragraph

You are performing a **deep, evidence-based enhancement study** of the ERA project across three fronts: (A) every product module, (B) the ERA Top Layer assistant, (C) the Delivery / PM Command Center. Your output is **Markdown documents and checklist items only — no application code.** Every claim you make must be traceable to a file, a line, a command's output, or a named document; every enhancement you propose must be executable by a *weaker* model without you present. The owner has a working, mature system with strong existing doctrine — your job is to make it sharper and finishable, **not** to redesign it or re-litigate decisions already locked.

**Success test:** the owner opens your output six weeks from now, hands one packet to a mid-tier agent, and that agent ships it correctly without asking a question.

---

## 1 · Hard constraints (violating any one invalidates the session)

| # | Constraint | Why |
|---|---|---|
| C1 | **Do not edit `src/`, `migrations/`, `scripts/`, or any application code.** Documents only. | This is a study session. Code changes go through the Delivery pipeline. |
| C2 | **Never write to the live Supabase project by any route** — no `execute_sql` (even SELECT), no `apply_migration`, no service-role script, no `psql`, no curl against PostgREST. See CLAUDE.md Hard Rule 26. | The DB holds the owner's real money and schedule data. Not waivable in-session. |
| C3 | **Never assert anything about RLS, policies, triggers or DB functions from repo files.** `migrations/schema.sql` is tables/columns only and has been *actively wrong* before. The only permitted evidence is `migrations/db-state.json` (currently dated **2026-08-04 — stale**) or output the owner pastes. If you need RLS truth, say so and hand the owner CLAUDE.md Hard Rule 27's two queries. | A doc claim about RLS cost five turns and a false root cause on 2026-08-04. |
| C4 | **Do not modify any existing `4 - Checklist.md` lane structure.** See §4.3 — the exact, non-negotiable grammar for adding ASTRA items. | `pnpm pm:lint` and the dashboard parser will break. |
| C5 | **Do not propose UI copy.** CLAUDE.md Hard Rule 28: this is a single-household app whose only users built it. Buttons are 1–2 word verbs; no explanatory prose, no reassurance text, no rationale on screen. | The owner explicitly called this out as frustrating. |
| C6 | **Do not propose restructuring existing `/era` UI.** Additive only — new chip, new tab, new card. Layout/animation rewrites were reverted once already after strong pushback. | Standing owner decision (2026-08-27). |
| C7 | **Do not re-litigate the decision registers.** The Top Layer plan §3 (D1–D18), the Delivery book's owner non-negotiables, and each Master Book's "Locked decisions" are settled. You may *challenge* one explicitly in a Contradiction Register (§8) with evidence — you may not silently plan against it. | Re-deciding settled questions is the documented failure mode of past sessions. |
| C8 | **Wake word is out of scope, entirely.** No analysis, no proposals, no deletions under the wake topic (`azureWake.ts`, `sttCapture.ts`, `vadGate.ts`, wake regexes). | Top Layer plan D2, owner decision 2026-09-02. |
| C9 | **No new standalone product modules.** Enhance what exists. | Top Layer plan §8 anti-plan. |
| C10 | **Every proposal maps to an existing plan ID or is explicitly marked `NEW`.** See §8. | The ERA Top Layer Master Plan (2026-09-02) is the *active execution contract* through Dec 31 2026. Your study must dock into it, not replace it. |

**One sanctioned override:** the Top Layer plan §8 says *"no new plan or audit document until G1 is scored."* The owner is knowingly commissioning this study anyway. Therefore your output must be **subordinate to that plan** — an enhancement layer that references its packet IDs — never a competing roadmap. State this explicitly in every document header.

---

## 2 · Boot sequence — read in this exact order, then stop and think

1. `CLAUDE.md` (repo root) — the 28 Hard Rules, module model, Feature Index. **This overrides your defaults.**
2. `ERA Notes/01 - Architecture/Design Doctrine.md` — the Ten Questions, silent-failure taxonomy, standing decisions, tradeoff priority order. This is *how the owner decides*. Mirror its priority order in every ranking you produce.
3. `ERA Notes/10 - Project Management/_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md` — 386 lines, the active contract. Read §1 (verified state), §2 (north star), §3 (decision register), §5.0 (packet template), §6 (gate table), §8 (anti-plan).
4. `ERA Notes/10 - Project Management/_Conventions.md` — the item grammar you must obey.
5. `ERA Notes/10 - Project Management/_index.md` — campaign map.
6. `ERA Notes/10 - Project Management/_Archive/FABLE — Testament (2026-07-18).md` — the operating doctrine for AI sessions here.
7. `ERA Notes/01 - Architecture/Feature Map/_index.md` — intent → exact source files. **Use this as your router instead of blind Glob/Grep.**
8. Per campaign, when you reach it: `<Campaign>/<Campaign> — Master Book.md` then `<Campaign>/4 - Checklist.md`.

**Then delta the books against reality:** each Master Book is trustworthy only as of its `updated:` frontmatter stamp. Run `git log --since=<stamp> --format="%h %ad %s" --date=short -- <its source paths>` before treating any book claim as current. Books have been stale before (§3 lists three known cases).

---

## 3 · Ground truth snapshot (verified 2026-09-05 — re-verify, don't trust blindly)

| Fact | Value | How it was checked |
|---|---|---|
| HEAD | `3106164` 2026-09-02 "ERA Top Layer plan and Codex Quick Top Layer" | `git log -1` |
| `HubPage.tsx` | **6,275 LOC** — must strictly decrease, never grow | `wc -l src/components/hub/HubPage.tsx` |
| `EraShell.tsx` | 550 LOC, 3 views, no sleep transition | `wc -l` |
| Test files in `src/` | 43 | `find src -name "*.test.ts*" \| wc -l` |
| CI | **only `check-docs-sync.yml`** — no test/typecheck/lint workflow exists | `ls .github/workflows` |
| `vercel.json` | **does not exist** — no cron is scheduled by Vercel | `ls vercel.json` |
| Migrations on disk | 25 `.sql` files; **no applied/unapplied ledger** | `ls migrations/*.sql \| wc -l` |
| `migrations/db-state.json` | dated **2026-08-04** — stale; predates `era_actions`, `era_templates` | file mtime |
| Campaigns | 11: Budget, Schedule, Kitchen, Trips, Hub & ERA, Notifications & Alerts, Healthcare, Outfits, PM Tooling, Delivery, Native App | `_index.md` |
| Maturity (as booked) | Budget 5.8 · Schedule 5.5 · Kitchen 3.0 · Trips 2.8 · Healthcare 4.8 · Notifications 5.8 · PM Tooling 6.6 · Native 0% · Hub & ERA / Outfits / Delivery unscored or partial | Master Books |
| PM tooling size | `scripts/pm/` SPA (Preact, 13 feature dirs) + `pm-server.mjs` 611 · `bridge.mjs` 1,214 · `archive.mjs` 435 · ~7,150 LOC untyped bespoke JS | `wc -l` |
| Delivery engine | `scripts/delivery/` — 30 modules (state machine, packet, lanes, budgets, context assembly, drivers, instant, locate, memory, transcript) | `ls scripts/delivery` |

**Known-stale book claims to check first** (each was wrong once): Notifications' 🔴 top pain is already fixed in code; the Native book's manifest count (14, not 9); any `schema.sql` claim about policies or functions.

---

## 4 · Workstream A — per-module ASTRA studies

### 4.1 Deliverable layout

For **each of the 11 campaigns**, create:

```
ERA Notes/10 - Project Management/<Campaign>/ASTRA/
  <Campaign> — ASTRA Book.md      ← the study: verified state, findings, ranked enhancements
  <Campaign> — ASTRA Packets.md   ← execution-ready packets, Top Layer §5.0 format
```

This mirrors the existing two-file discipline one level down. **Because `_Conventions.md` currently states "every campaign folder holds exactly two files," you must also write the amendment** — a new §8 in `_Conventions.md` registering `ASTRA/` as a sanctioned sub-folder, plus a row in `_index.md`'s campaign table linking each ASTRA Book. Set ASTRA doc frontmatter to `type: astra-study`, `status: active`, `owner: Elio`, with `created:`/`updated:` stamps, so the dashboard surfaces them rather than hiding them.

### 4.2 `<Campaign> — ASTRA Book.md` required sections

Mirror the Master Book's shape so the owner reads them the same way, but **do not duplicate the Master Book** — delta it.

1. **Header block** — one line stating: subordinate to `ERA Top Layer — Master Plan (2026-09-02)`; evidence cutoff commit; Master Book `updated:` stamp this deltas from.
2. **Book delta** — every Master Book claim you found stale, wrong, or now-fixed, with `file:line` evidence. If none, say "no drift found" and name the commands you ran.
3. **Re-scored maturity** — the same dimension table the Master Book uses, your score, and *what specifically moves it +1*. Scores must be defensible from evidence, not vibes.
4. **Findings** — numbered, most-consequential first. Each: the finding, the evidence (`file:line` or command output), the consequence for the owner's daily use, and which Design Doctrine priority it violates.
5. **Enhancement catalog** — ranked, each with an `ASTRA-<PREFIX>-n` id, a one-sentence user-visible outcome, size (S/M — **L is forbidden, split it**), severity, and its dependency chain.
6. **What ERA needs from this module** — this is the section most likely to be skipped and most valuable. Every module is an input to the assistant layer: which *signals* could this module emit into `src/lib/briefing/signals.ts` (Top Layer E-04), which capabilities belong in the ERA registry, and what data is missing to make either possible. Kitchen (3.0) and Trips (2.8) are the acute cases: ERA is smarter than the graphs it reads.
7. **Do not do** — enhancements you considered and rejected, with reasons, so they aren't re-proposed.
8. **Coverage note** — which Feature Index modules this campaign actually owns.
9. **`## ASTRA 10× Findings`** — mandatory, exactly as specified in §7.2. This is the section the owner reads first.

### 4.3 Checklist injection — the exact grammar (read twice)

The owner asked for "an ASTRA section in `4 - Checklist.md`." **A new `##` heading is impossible** — `_Conventions.md` §2 fixes the lanes at exactly `## Now` / `## Next` / `## Later` / `## Definition of Done`, and *any* heading resets the board parser's section. Adding one breaks `pnpm pm:lint`, the Task board, the burndown and the delivery packet reader.

**Do this instead** — a bold paragraph marker inside an existing lane, which `_Conventions.md` §2 explicitly sanctions:

```markdown
## Later

**ASTRA wave 1 (2026-09-xx)** *(study: [ASTRA Book](<ASTRA/Budget — ASTRA Book.md>))*

- [ ] **BUD-57** (ASTRA-BUD-1) Statement-import duplicate guard refuses on fingerprint collision → `src/features/statement-import/dedupe.ts` _(friction - M)_
- [ ] **BUD-58** (ASTRA-BUD-2) Emit a `spendVsPlan` signal for the ERA briefing → `src/lib/briefing/signals.ts` _(annoyance - S)_
```

Rules for every injected line, no exceptions:
- **Continue the campaign's own numbering** — read the checklist *and* the Master Book Shipped Log to find the highest used integer for that prefix. **IDs are never reused.**
- Prefixes: `BUD` `SCH` `KIT` `TRIP` `HUB` `NOTIF` `HLTH` `OUT` `R` `DLV` `NAT`.
- ASTRA provenance goes in parentheses at the **start of the body**, never in the meta suffix.
- Meta suffix is required and exact: `_(severity - effort)_`, one space–hyphen–space. Severity ∈ `blocker|friction|annoyance|parked` (lowercase words, never emoji). Effort ∈ `S|M|L` (no ranges, no `H`). **The repo's grammar permits `L`; ASTRA-generated items must not use it — only `S` or `M`. Split anything larger before injection, exactly as the packet rule requires.**
- `→ target` is a backticked repo-relative path or an angle-bracket relative markdown link. **Every link must resolve** — the linter checks.
- No nested checkboxes. Sub-points are plain `-` bullets.
- Default lane is **`## Later`** unless the item is a genuine blocker for a Top Layer packet, in which case `## Next` and say which packet.
- **Run `pnpm pm:lint` after every checklist edit and paste the output.** A red linter is a failed deliverable.

Also add a Master Book **Pain Inventory** bullet (emoji-lead: `🔴 🟠 🟡 ⚪` at line start) for every *defect* you find — not for every enhancement. That's what feeds the Bugs view.

### 4.4 Campaign coverage and orphans

Map every module in CLAUDE.md's Feature Index to a campaign. Several have no campaign — Focus, Plan My Day, NFC Tags, Guest Portal, Prerequisites, Analytics, Dashboard, Recycle Bin, Error Logs, Watch UI, Household Sharing, Sync & Offline, Catalogue, Future Purchases, Preferences, Chores, Debts, Statement Import, Transfers. For each: fold it into an existing campaign's ASTRA Book (say which and why) or list it in a final `ASTRA — Coverage & Orphans.md` with a one-line recommendation. **Do not create new campaigns** — that needs a prefix registration in two places and is an owner decision.

---

## 5 · Workstream B — ERA Top Layer

### 5.1 What "Top Layer" means here

ERA Hub Chat is the **top-layer primary interface**: high-frequency, low-friction, conversational actions (log a spend, set a reminder, add to the list). Standalone module pages are **precision tools** for structured input. The Top Layer is reactive (parses messages) *and* proactive (speaks first with briefings and alerts). Today the reactive half is a genuinely good architecture and the proactive half is **at zero** — ERA has never spoken first.

### 5.2 Deliverable layout

```
ERA Notes/10 - Project Management/Top Layer/
  Top Layer — ASTRA Architecture.md   ← goal (a): structure & confidence
  Top Layer — ASTRA Experience.md     ← goal (b): design & UX
  Top Layer — ASTRA Completion.md     ← goal (c): what "complete and working" means, and the proof
  Top Layer — ASTRA Packets.md        ← the executable work
```

Each of those four docs ends with its own `## ASTRA 10× Findings` (§7.2); the Top Layer is where a frontier proposal is most likely to be worth the owner's attention.

**`Top Layer/` is a study folder, not a campaign.** It gets **no `4 - Checklist.md` and no new ID prefix** — its work items land in `Hub & ERA/4 - Checklist.md` under `HUB-*` (or the owning module's campaign when the work is module-side). Fragmenting the queue across a 12th prefix would cost more than it buys. If you believe otherwise, argue it once in the Contradiction Register; don't act on it.

### 5.3 Goal (a) — stronger, more confident structure

Evaluate and propose against what exists: the deterministic 4-face router (20 intents), the 13-entry capability registry with Zod slot schemas, server-validated Ask-AI proposals that never write without a tap, taught templates, focus memory, capped auto-escalation. Specifically address:

- **The confidence question**: what makes the owner *trust* ERA with money and schedule writes. Today: proposals + confirm tap. What's missing — provenance display, reversibility, a visible "what I did" ledger (`era_actions` exists but only logs `reminder.*`), an honest failure vocabulary.
- **Known correctness defects** (verify each still holds, then packet them): `era_conversations.updated_at` never bumped so the 6h session roll measures from creation; `capabilityAction` drops `result.ok` so failing templates climb the ranking; `logEraCapabilityAction` only logs `reminder.*`; `logEraAction` writes a `?face=` param nothing handles; `era_messages.intent_face` has no CHECK.
- **Dead code** to remove: `src/components/era/face-widgets/` (0 importers), `recipeOfferGenerate`, `stubIntentRouter`, `useEraHousehold`, 5 unreachable `MODULE_COLORS`, `Face.route`; `EraFaceNav` duplicates label/hue tables that disagree with `faceRegistry`.
- **The offline hole — treat as priority-1, not polish**: ERA never calls `addToQueue`. Offline, a spend spoken to ERA is *silently lost*, while the same spend typed into the form is queued and replayed. `useEraConversation.ts:10-11` documents queue behaviour that does not exist; two raw `fetch()` reads at `:49,92` bypass `safeFetch`. Design the single choke point (`enqueueCapabilityAction()`) riding the **existing** `offlineQueue` feature types — no new queue key (plan D11).
- **The two-brain problem**: `/era` ERA vs `/chat` HubPage AI thread vs the floating `AIChatAssistant` — three doors, two stores, two voice paths, no written treaty. The treaty is decided (plan §2): ERA is *the* assistant; Hub Chat is the household's conversation with each other; the floating assistant is deleted once analysis reports are reachable from ERA. Your job is the *migration design*, not the decision.
- **Test coverage of the top layer**: `useEraTurn`, `useEraAskAI`, `useEraConversation`, every `/api/era/*` route and every component are untested; `vitest` include omits `*.test.tsx`; **no CI runs any test at all**.
- **Reactive gaps users hit daily**: no balance query · no income write path ("I got paid $2000" is vetoed, not recorded) · no event creation · no meal-plan read · Chef and Brain faces get zero domain context in Ask AI · focus memory knows only `reminder` entities.

### 5.4 Goal (b) — design and UX

Constraints first: **additive only** (C6), **minimum text** (C5), mobile-first, person-absolute color identity (Hard Rule 14 — colors follow the person, not the viewer), floating panels opaque (Hard Rule 15), fixed headers offset (Hard Rule 16), `type="text" inputMode="decimal"` for numbers (Hard Rule 19), Undo on mutation-confirming toasts (Hard Rule 1).

Work the **interaction ladder** the plan already defines — L-0 glance · L-1 one-tap draft action · L-2 door into the owning module · L-3 sentence — and the **proactive ladder** L0→L4. For each ERA surface (orbital mark, hub view, dashboard view, activity view, `CommandBar`, `EraChatDrawer`, the briefing push and its landing) specify: what the owner sees in one second, what one tap does, where the door leads, and what the degraded/offline/quota-exhausted state looks like. **Failure states are the deliverable most often missing** — an assistant that fails opaquely is worse than one that refuses clearly.

### 5.5 Goal (c) — a complete and working solution

Define **done** as a binary, checkable contract, in the shape of the plan's §6 gate table: one command or one screenshot per row, pass/fail, no prose. Cover at minimum: a briefing actually delivered on both phones at the right local hour; exactly-once dedupe on a second fire; a cron liveness signal that can be read without opening Supabase; an offline ERA write that survives reconnection as exactly one transaction; a failing template that does *not* climb the ranking; the quota gauge moving after one Ask AI. Then list, explicitly, **what is not in scope for "complete"** so the definition can't drift.

---

## 6 · Workstream C — Delivery / PM Command Center

### 6.1 Deliverable layout

```
ERA Notes/10 - Project Management/Command Center/
  Command Center — ASTRA Architecture.md   ← the joint system: PM corpus + dashboard + delivery engine + phone
  Command Center — ASTRA Experience.md     ← mobile + desktop UX as one product
  Command Center — ASTRA Orchestration.md  ← agents, context, caching, lanes, confidence
  Command Center — ASTRA Packets.md
```

Per-campaign detail still goes in `Delivery/ASTRA/` and `PM Tooling/ASTRA/` per §4 — these four are the cross-cutting layer. Items land as `DLV-*` and `R-*`. Each doc ends with its own `## ASTRA 10× Findings` (§7.2); §7.1's questions 1, 5 and 7 (over-complication, duplication, deletion) bite hardest here — ~7,150 LOC of untyped bespoke JS and a 30-module delivery engine are a lot of surface for one owner to maintain.

### 6.2 What exists (verify, then build on it)

**Four surfaces, one Preact bundle, one parsing core:** `pnpm pm` at `127.0.0.1:4317` (interactive, mutates the markdown, runs Delivery) · `_dashboard.html` (read-only static twin) · `/pm` in the deployed app (auth-gated, installable, offline) · `/pm/live` (the phone surface, fed by an outbound-only Supabase relay from `pnpm pm --bridge`).

**The delivery state machine:** `SELECTED → DISCOVERY → SPEC_READY → PLAN_READY → BUILDING → VALIDATING → REVIEWING → UAT_READY → ACCEPTED → SHIPPED` (+ `BLOCKED`/`NEEDS_DECISION`/`FAILED`/`CANCELLED`), parking additionally at `question`, `budget`, `blocked`. Artifact-first persistence under `.delivery/sessions/<id>/` is **the feature's greatest strength — preserve it in every change** (a whole postmortem was reconstructed from files alone).

**The four lanes** (policy bundles resolved at launch, snapshotted into `packet.json`; only INSTANT changes the pipeline's *shape*):

| Lane | Tier | Model turns | Discovery+Plan | Review / UAT | Budget |
|---|---|---|---|---|---|
| INSTANT | economy | 2 | always merged | deterministic, escalates on mismatch | $0.25 / 250K / 8 internal |
| FAST | economy | 4–5 | merged when the item names one file | model turns | $0.50 / 500K / 12 |
| STANDARD | standard | 5+ | separate | model turns | $2 / 2M / 20 |
| DEEP | premium | 5+ | separate | model turns | $5 / 5M / 40 |

### 6.3 Owner non-negotiables (locked 2026-07-11 — design within them)

- **No git writes, ever.** Worktrees banned permanently.
- **Never `bypassPermissions`.**
- **`agent-registry.mjs` is the single source of truth** for the Agent Catalog.
- **Always three human gates** — `SPEC_READY`, `PLAN_READY`, `UAT_READY` (typed `APPROVE` when risk flags include db-migration or security), plus owner-marked `SHIPPED`. **Lanes compress effort, context and validation — never oversight.** (INSTANT's amendment: three gate *decisions* still recorded, one owner action may produce the spec+plan pair.)
- **No writes to the live Supabase project by any route**, enforced in the agent's `canUseTool` Bash screen as well as by the MCP seal.

### 6.4 The three things the owner asked you to fix

**(i) Make it feel like a real standalone application, mobile *and* desktop.** The north star already written: *"the markdown stays the source of truth and the tooling stays a lens over it — but the lens should feel like a real application, not a rendered document."* Live pains to work from: ~7,150 LOC of untyped bespoke JS is load-bearing (one `lint.mjs` typecheck break cost five days); the service worker can serve a stale board that *looks* current, with no cache-version assertion; the legacy strangler UI (`client.js`/`styles.css`/`body.html`, reachable via `?ui=old`) still contains working-looking code that is not in the build and will mislead anyone who greps it; `SegmentedPanes` tap-to-select can silently fail to scroll on Chromium's `scroll-snap-mandatory` + smooth-scroll combination; session-history surfaces have no retention convention and will become the next stale-doc zombies. Treat `/pm/live`'s board toolbar as the **reference implementation** for filtering — it already solves on the small screen what the desktop board does not.

**(ii) A stronger Agent SDK, context, caching and multi-agent orchestration.** The single hardest number in the system: `PHASE_BASELINE_TOKENS` at `scripts/delivery/recommendation.mjs:55` assumes economy `{cacheCreation: 10_000, cachedRead: 350_000}` — a **35:1** read-to-write ratio against a **measured 1:1.5**. That term is 77–87% of a real session's bill, so *every* envelope the owner sets is a guess against a model known to be false, and the budget gate keeps firing on it. DLV-85 (one live streaming session shared across consecutive same-option turns) has since changed the true ratio again. **Re-derive these constants from measurement — never adjust by intuition.** Then: rotation doesn't seed a fresh session with a rendered context digest; transcript stub records and a stalled-session watchdog don't exist; the raw-SDK transcript pointer is in `state.json` but surfaced in no UI. For orchestration, respect the existing registry-as-source-of-truth rule and design *within* the artifact-first model — parallel agents that can't be reconstructed from `.delivery/sessions/<id>/` are a regression, not a feature.

**(iii) A trustworthy difference between fast, normal and deep — with confidence in the outcome.** The recorded verdict, and its revision, are both load-bearing history: on 2026-07-30 a FAST-lane run on a trivial item cancelled at the budget gate having spent **$0.5317 with zero lines changed**, and the conclusion was "the pipeline should refuse this item." On 2026-08-01 that was revised: *the ~5-phase floor is a property of the shape, not of governed delivery* — so INSTANT changed the shape, running the same item in **two** model turns with all three gate decisions intact, because PLAN, REVIEWING and UAT_PREP are derivable from turns that already happened. Your lane model must preserve that insight. Then close the holes that make lane confidence weaker than it reads:
- **The targeted-test rung can pass by finding nothing** — vitest exits 0 when a filter matches no files, so `test: ok, targeted: true` was recorded on the excerpt `No test files found`. "No test covers this file" is currently indistinguishable from "the tests pass," and INSTANT's safety argument leans on exactly that assertion.
- **REVIEWING hit the 8-turn internal ceiling and returned no verdict at all** — neither deterministic nor model. A review turn that cannot finish is a silent hole in the one path that makes skipping review safe.
- **The `any` debt is now invisible to the gate that surfaced it** — 588 violations were ledgered to `warn` per-file (48 genuinely fixed) so the build is green; within those 126 files a *new* `any` warns instead of erroring. The list is designed to only shrink; make the burn-down measurable and the ratchet enforceable.
- **Execution-slot failure survived three generations** — small flagged fixes only get executed when a session is *dedicated* to killing them; the only two flagged-fix executions in six weeks happened inside audit sessions. And in one audit window ~12 of 21 commits were PM/docs/tooling — *the PM machine improving itself faster than the product it manages.* Any Command Center enhancement you propose must state which product-code item it unblocks.

**The one finding to carry into everything:** *rules with mechanical enforcement are the rules that hold.* Hook- and permission-enforced rules (Hard Rules 11, 23, 24, 25, 26) are clean. Prose-only rules fail exactly where there's constant pull against them — Hard Rule 6 is breached at ~98 client `fetch()` sites, Hard Rule 12 (Zod) holds on ~57 of 170 mutating routes, Hard Rule 1 mandates the impossible (781 toasts, 417 of them `toast.error` with no meaningful inverse) and is therefore ignored. **Prefer a proposal that adds a check over one that adds a rule.**

---

## 7 · The ASTRA 10× challenge — use the model, not just the checklist

Everything above stays binding. But this session is being given to Astra **specifically because the owner wants findings a weaker model, an ordinary code review, or a mechanical audit would not produce.** The risk of §§1–6 is that you spend the session proving things the owner already knows. Do not just polish the roadmap.

For every workstream — each campaign, the Top Layer, the Command Center — deliberately search for **step-change opportunities** alongside the incremental fixes.

### 7.1 The 10× questions

1. **What is unnecessarily complicated?** Architecture, abstractions, workflows, agents, UI surfaces or documentation that could be deleted, merged, or made dramatically simpler.
2. **What capability is one architectural move away?** Existing data, infrastructure, signals, models or components that would unlock a disproportionately valuable feature with a small structural change.
3. **What would a much stronger AI-native design do differently?** Do **not** replace deterministic guarantees with AI where correctness matters — that is a locked principle here (AI proposes, the human confirms; never a model writing directly to money or schedule state). Instead find where modern reasoning, tool use, structured outputs, context management, agent orchestration, memory, retrieval or evaluation could remove large amounts of bespoke logic or owner effort.
4. **What is ERA collecting but not exploiting?** Information already produced by modules that could become signals, context, predictions, shortcuts, proactive assistance, cross-module intelligence, or better decisions elsewhere.
5. **Where is ERA solving the same problem twice?** Duplicated state, routing, context assembly, parallel UX surfaces, repeated validators, repeated business rules, overlapping agent responsibilities, duplicated documentation. (Known starting points: two assistants and three doors; two recurrence systems; three TTS entry points; a colour map duplicated between the bridge and the phone.)
6. **What is currently impossible to trust?** Anything whose success cannot be proven mechanically: silent failures, optimistic UI without reconciliation, agent claims without artifacts, tests that pass without testing anything, stale context, stale caches, stale docs, weak observability, missing provenance.
7. **What should disappear entirely?** Every workstream must surface at least one serious deletion or simplification candidate when the evidence supports one. More architecture is not automatically an enhancement.
8. **What would make the owner feel a 10× difference in daily use?** Optimize for removed actions, removed decisions, removed waiting, removed uncertainty, less maintenance, stronger correctness, and things ERA simply cannot do today.

### 7.2 Required `## ASTRA 10× Findings` section

Every ASTRA Book, and each of the Top Layer and Command Center doc sets, ends with a section titled exactly `## ASTRA 10× Findings`, containing **at most**:

- **3 high-confidence leverage moves** — evidence-backed, unusually high impact per unit of effort.
- **1 simplification / deletion move** — something ERA should stop doing, merge, or remove.
- **1 frontier opportunity** — a genuinely new possibility enabled by the current architecture or by newer AI capabilities.
- **1 uncomfortable finding** — something structurally wrong, wasteful, misleading or over-engineered that previous plans may have normalized.

**Do not manufacture findings to fill the quota.** Write `None found with sufficient evidence` and move on. An empty slot with a reason is a result; a padded slot is noise.

### 7.3 Frontier ideas are allowed — uncontrolled redesign is not

A frontier proposal may challenge the current architecture, the roadmap, the agent model, module boundaries or UX assumptions. But: do not implement it; do not silently plan around a locked decision; mark it `NEW` when it is compatible and `CONFLICTS → <decision id>` when it is not; put every genuine conflict in the Contradiction Register; and state **what measurable improvement would justify reopening the existing decision**. A surprising finding backed by evidence is worth more to the owner than agreement with this brief.

### 7.4 The portfolio — `ASTRA — 10x Portfolio.md`

After all workstreams are studied, write `ERA Notes/10 - Project Management/_Archive/Studies/ASTRA/ASTRA — 10x Portfolio.md`. **This is not another roadmap.** It is a one-page decision sheet holding only the **10 highest-leverage changes across the entire ERA ecosystem**, regardless of module.

| Rank | Change | User impact | Engineering leverage | Evidence confidence | Effort | Existing packet / NEW |
|---|---|---|---|---|---|---|

Then answer these five, in prose, one short paragraph each:

- **If only 3 things ship this quarter, which 3?**
- **What should ERA stop investing in?**
- **What single architectural change unlocks the most future capability?**
- **What single reliability problem most threatens trust in ERA?**
- **What would most noticeably change the owner's daily experience?**

The portfolio exists to force prioritization against a real capacity of ~2 packets per week. It must not restate the ASTRA Books.

### 7.5 Anti-busywork rule

Do not generate enhancements merely because a module has an ASTRA directory. A study succeeds when it **reduces uncertainty and produces fewer, stronger actions.**

Preference order, whenever the resulting user outcome is equal or better:

**delete > simplify > consolidate > mechanically enforce > reuse > extend > build new**

Ten excellent packets are worth more than fifty reasonable ones. If a campaign genuinely needs nothing, the correct ASTRA Book is short and says so.

---

## 8 · Cross-cutting output requirements

**Contradiction Register** (`ERA Notes/10 - Project Management/_Archive/Studies/ASTRA/ASTRA — Contradiction Register.md`): every place your findings disagree with a locked decision, a Master Book claim, a Hard Rule, or the Top Layer plan. Each entry: the claim, its source, your evidence, the consequence, and a recommended resolution. **This is the highest-value artifact you will produce** — it is where the owner learns something. Do not soften it, and do not act on it unilaterally.

**Plan reconciliation table** (in each Packets doc): every proposal is one of —
- `DOCKS → E-04` — refines an existing Top Layer packet (say how),
- `EXTENDS → HUB-12` — extends an existing checklist item,
- `NEW` — genuinely new, with a one-line justification for why the plan doesn't already cover it,
- `CONFLICTS → D9` — collides with a decision; must also appear in the Contradiction Register.

**Packet format** — every packet in every Packets doc uses the Top Layer §5.0 template verbatim: `ID · name · size (S/M only, L forbidden) · lane · phase`, then `Outcome` (one user-visible sentence, present tense), `Prereqs` (packet IDs + migrations that must be **applied**, not merely written), `Skills` (`start-task → domain skills → finish-task`), `Files` (an **allowlist**; forbidden always: `src/components/ui/**`, `HubPage.tsx` unless the packet is its sanctioned rider, `schema.sql` without a paired migration), `DB change?`, `AI call added?`, `Money/schedule math?` (requires a worked before/after example + a test), `Gate` (copy-pasteable command + expected output, or a screenshot spec), `PM` (the checklist line to tick + the Shipped Log sentence), and `NOT done` (migration written ≠ applied · test file ≠ test in CI include · "works locally" ≠ evidence pasted). Carry the STOP conditions S1–S12 forward.

**Evidence discipline.** Every factual claim carries `file:line`, a command with its output, or a named doc + section. Words banned without evidence: "likely", "should be", "probably", "seems to". If you could not verify something, write `UNVERIFIED:` and say exactly what would verify it. **An honest gap is worth more than a confident guess** — the last false confidence in this repo cost five turns and shipped a policy-free table.

**Ranking.** Rank by the Design Doctrine's tradeoff priority order, not by how interesting the work is. Silent data loss and money/schedule correctness outrank everything; the ERA offline hole is a priority-1 bug, not polish.

**Size discipline.** No `L` packets. If it won't finish in one 2–4h session, split it. The owner's real capacity is ~2 packets/week.

**Tone.** Written for a *weaker successor model* who has none of your context. Name the historical failure mode before describing the fix. Prefer a table over a paragraph, a command over a description, a file path over a feature name.

---

## 9 · Session protocol

**Phase 1 — Orient (no writing).** Boot sequence §2. Then post a single message containing: (a) a ≤300-word read of what this project actually is and where it actually stands, (b) anything in §3's snapshot that you found to be wrong, (c) **at most 3 clarifying questions, batched, each with your recommended default** — and only where the answer *materially changes the study*. Otherwise take the default and continue. The repository already carries enormous context; questions it can answer are a waste of the most valuable context window in this session. Then **wait** for the answer.

**Phase 2 — Workstream B (Top Layer) first.** It is the owner's flagship and the plan's critical path. Deliver the four `Top Layer/` docs, then stop for review.

**Phase 3 — Workstream C (Command Center).** The four `Command Center/` docs plus the `Delivery/ASTRA/` and `PM Tooling/ASTRA/` pairs. Stop for review.

**Phase 4 — Workstream A (per-module).** The remaining **9 campaigns**, in this order — **Hub & ERA** first, to reconcile the campaign-level findings with the Top Layer study without duplicating it (state which findings live in which doc, and cross-link rather than restate); then **Kitchen, Trips** (3.0 and 2.8, unchanged for three generations, and the acute constraint on what ERA can anticipate); then **Budget, Schedule** (biggest daily surface); then **Notifications & Alerts, Healthcare, Outfits, Native App**; then the `ASTRA — Coverage & Orphans.md` appendix.

**Phase 5 — Land it.** Checklist injections per §4.3 across all campaigns · Master Book Pain Inventory bullets for defects only · `_Conventions.md` §8 amendment · `_index.md` rows · the Contradiction Register · **`ASTRA — 10x Portfolio.md` (§7.4), written last, once you can see every workstream at once** · `pnpm pm:lint` green with the output pasted.

Between phases, report: what you produced, what you could not verify, and what changed in your understanding. **Never batch all five phases into one silent run.**

---

## 10 · Self-check before you declare done

- [ ] `pnpm pm:lint` exits clean; output pasted.
- [ ] Zero edits under `src/`, `migrations/`, `scripts/`.
- [ ] Zero database calls of any kind.
- [ ] No new `##` heading in any `4 - Checklist.md`; every injected item matches `- [ ] **PREFIX-n** … _(severity - effort)_`; no ID reused; every `→` link resolves.
- [ ] Every proposal is tagged `DOCKS` / `EXTENDS` / `NEW` / `CONFLICTS`.
- [ ] Every packet has an allowlist, a binary gate command, and a PM trace line.
- [ ] No `L`-sized packet anywhere.
- [ ] No RLS/policy/function claim sourced from a repo file.
- [ ] No proposed UI copy beyond 1–2 word verbs; no `/era` layout restructure.
- [ ] No wake-word content.
- [ ] Every ASTRA Book and doc set ends with `## ASTRA 10× Findings`; empty slots say `None found with sufficient evidence` rather than being padded.
- [ ] `ASTRA — 10x Portfolio.md` exists, holds exactly 10 ranked entries, answers all five questions, and repeats no ASTRA Book wholesale.
- [ ] At least one serious deletion/simplification candidate per workstream, or a stated reason none exists.
- [ ] Contradiction Register written, even if short.
- [ ] Every "UNVERIFIED:" line names the command or query that would settle it.

---

## 11 · Useful commands

```bash
# Ground truth
git log -1 --format="%h %ad %s" --date=short
git log --since=2026-08-01 --format="%h %ad %s" --date=short -- src/features/era src/components/era
wc -l src/components/hub/HubPage.tsx          # must be < 6275 after any HubPage work
find src -name "*.test.ts*" | wc -l

# PM corpus
pnpm pm:lint                                   # MUST be green after any checklist edit
pnpm pm                                        # the dashboard, to see how your items render
grep -rn "^- \[ \] \*\*BUD-" "ERA Notes/10 - Project Management/Budget/4 - Checklist.md"

# Rule-compliance measurements (re-derive, they are from 2026-08-01)
grep -rn "await fetch(\"/api" src/components src/features src/hooks src/contexts | wc -l
grep -rLn "zod" $(grep -rl "export async function POST" src/app/api --include=route.ts) | wc -l
grep -rc "console\." src/app/api/cron | paste -sd' '
```

---

**Final instruction.** The owner has a working system, strong doctrine, and limited hours. The most valuable thing you can produce is not more plan — it is **fewer, sharper, verified, executable steps that dock cleanly into the plan that already exists**, plus an honest register of everywhere the documents and the code disagree. If you find yourself writing a new roadmap, stop: read §1 C10 again.

And the other half of that: **discipline is the container, not the goal.** The owner is spending a premium reasoning session precisely to get what a mechanical audit cannot — the deletion nobody proposed, the capability one architectural move away, the thing everyone has normalized that is actually wrong. §7 is where that lives. Be rigorous everywhere, and *bold there*.
