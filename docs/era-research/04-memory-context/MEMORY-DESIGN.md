---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 22152c2 (2026-11-04 22:38 +0200). §1 and §5 restate CURRENT evidence from CURRENT-CONTEXT-MAP.md; §2–§4 and §7–§10 are PROPOSED DESIGN. No schema, migration, data or code was changed."
---

# ERA Memory Design

[README](README.md) · [Current Context Map](CURRENT-CONTEXT-MAP.md) · **Memory Design** · [Context Assembly](CONTEXT-ASSEMBLY.md) · [Correction & Expiry](CORRECTION-AND-EXPIRY-RULES.md)

A memory, context and personalisation design that fits ERA's existing decisions: memory is mostly a **view** over the modules that own the facts, plus one small, explicit, personal ledger for what no module owns. Gap IDs (G1–G11) refer to [CURRENT-CONTEXT-MAP §9](CURRENT-CONTEXT-MAP.md#9-gaps-the-design-addresses).

## 1. Constraints this design must respect (CURRENT decisions)

| Constraint | Source | Effect on the design |
|---|---|---|
| No fourth store; `era_*` is the assistant store | Top Layer D4 (`ERA Notes/10 - Project Management/Plans/ERA Top Layer.md`) | Anything ERA keeps lives in an `era_*` table |
| "Do not create a new memory engine"; fold the unused Brain stub unless the signals design needs it | Top Layer D17 | Extend an existing engine (the lexicon) or store nothing; never a new `memories` service |
| No model training, fine-tuning, vector or graph database | Top Layer §6 Non-goals | Embeddings are out unless the owner reverses §6 |
| One engine per concept; read paths never mutate; proposals over actions | Design Doctrine §4 | Retrieval never writes; saving a memory is an explicit user action; one assembler |
| Keep working context, episodes, explicit preferences and source facts distinct; request-time reuse over a second store | AI Assistant Overview, HUB-106 decisions | Episodes stay evidence; only explicit actions create preferences |
| Lexicon evidence rule: an example is not a default; a repeat earns one offer; a tap makes a rule; "forget that" revokes | `src/features/era/lexicon.ts:5-14` | The same rule governs every new kind of memory |
| Effect policy: memory save is Act + Undo; Confirm when the target belongs to the partner; model-interpreted writes Confirm | Top Layer §5 | Saving a stated preference is one tap with Undo; a model-proposed one is a Confirm card |
| No agent writes to production; DB changes are owner-run migrations | Hard Rules 24, 26 | Every schema step below is a deliverable SQL file, never applied by an agent |
| Minimum UI text; every toast has Undo | Hard Rules 1, 28 | "Kept · Until Sun [Undo]", nothing explanatory |
| No live paid-API tests by agents | Hard Rule 29 | Acceptance runs on replay/synthetic fixtures; live checks are owner-started |

## 2. Principles

1. **The owning module is the memory.** A fact that a module can hold (allergy, place, debt, trip, goal, reminder) is stored there and read fresh. ERA keeps a pointer, never a copy.
2. **ERA remembers only what the person deliberately gave it.** Conversation is evidence; a memory exists only after an explicit save or tap. Models and heuristics may *offer*, never write.
3. **Every remembered thing answers five questions:** who said it, when, how sure, for whom, until when.
4. **Forget means gone from every automatic path.** Not just "stop using"; content is removed or redacted where ERA copied it, and the person is told honestly about copies only they can remove.
5. **Retrieved text is data.** No record, title, note or past message can instruct ERA, create a memory or change consent.

## 3. The seven kinds of information

| Kind | Definition in ERA | Fictional example | Home (owner) | ERA keeps | May fill a slot without asking? |
|---|---|---|---|---|---|
| **Durable fact** | True until someone changes it in its module | "Lina is allergic to peanuts (severe)"; "Parents' house is in Kobeize" | Source module: Healthcare `health_allergies`, Catalogue Places | Nothing; reads fresh. May **offer** to add it to the module | Only from the module's own record |
| **Preference** | How the person wants ERA or a module to behave | "Morning reminders at 9, not 8"; "Short answers" | Settings tables if a setting exists; otherwise `era_lexicon` (`default`, `alias`, proposed `preference`) | The rule, its words, its conditions | Yes, explicit/confirmed rules only, and never lowers the effect tier (`lexicon.ts:13-14`) |
| **Goal** | A target with a measure and a date | "Save $1,200 for the AC by March" | Future Purchases, Budget Allocation, Fitness plans | Nothing; may **offer** to create it in its module | No |
| **Temporary circumstance** | A state that changes what is sensible, with an end | "My sister is staying with us until Sunday"; "I'm in Lisbon this week" | A module if it models it (Trips, medication course, fitness pause); otherwise proposed `circumstance` rule | The statement plus `valid_until` | No; it is context, never a default |
| **Commitment** | Something someone must do or pay | "Pay Sami back $40 on Friday" | Schedule items, Recurring Payments, Debts, Meal plans, Chores | Nothing; turning it into a record is a normal ERA write with Artifact | n/a |
| **Conversation history** | What was said and what ERA did | "Last Tuesday I asked for a recipe without dairy" | `era_messages` (episodes), focus memory (working) | Rows already stored; retrieval reads them | No; evidence only |
| **AI inference** | Anything a model or heuristic concluded | "You usually log coffee from Wallet"; Focus `pattern_observations` | Not a home of its own; computed per request, or persisted with an `ai_generated` style marker | Offers and persisted outputs carry generated-at and inputs | Never; an inference becomes a preference only by a tap |

A sentence often mixes kinds. "Remember Lina is coming Friday and she can't have peanuts" contains a commitment (event Friday), a durable fact (allergy, Healthcare) and nothing for ERA to keep. ERA's job is to route each part to its home and keep none of it itself.

## 4. The memory record (PROPOSED)

Only things with no module home (preferences that are not settings, temporary circumstances) need an ERA-owned record. Fields, whichever store holds them ([§8](#8-three-designs)):

| Field | Meaning | Rule |
|---|---|---|
| `kind` | `default` · `alias` · `example` (existing) · `preference` · `circumstance` (new) | Class decides confidence and expiry |
| `statement` | The person's own words, ≤280 chars | Required for `preference`/`circumstance`; never model prose |
| `value`, `capability`, `slot`, `conditions` | Machine-usable part (existing lexicon fields) | Optional for free preferences |
| `subject` | Who/what it is about: `self`, `household`, or a reference `{kind: profile/place/contact, id}` | References are re-validated at use; a dead reference makes the record inert (existing `depends_on` behaviour) |
| `basis` | `said_and_kept` (explicit save) · `tapped_offer` · `settings` | Never `inferred` |
| `source_message_id` | The `era_messages` row it came from (existing column) | Required unless `basis = settings` |
| `valid_from`, `valid_until` | Time relevance, `timestamptz` | `valid_until` required for `circumstance` |
| `superseded_by` | Newer record that replaced it | Correction never edits in place |
| `revoked_at`, `revoked_reason` | `forget` · `corrected` · `expired` · `source_gone` · `superseded` | Revoked records never reach a model |
| `user_id` | Owner; RLS `auth.uid() = user_id` (existing) | Personal by default ([§8 K5](#k5-household-scope)) |

**Confidence is a category, not a number.** No component of ERA is calibrated, so a score would look precise without being so.

| Level | Comes from | Can fill a slot | Shown to model as |
|---|---|---|---|
| `current` | The present request | Yes | The request |
| `source` | A module record read now | Yes, as that module allows | Fact with `as_of` |
| `explicit` | A setting, an "Always" tap, "X means Y" | Yes | Rule |
| `confirmed` | A kept statement or tapped offer | No (context only), except slot defaults created by "Always" | Preference/circumstance with date |
| `stated` | Said in conversation, not kept | No | `user_statement` episode (today's behaviour) |
| `observed` | Repeated acknowledged outcomes | No | Tentative choice (today's behaviour) |
| `inferred` | Model or heuristic output | No | Not sent back as fact |

## 5. What belongs where (placement)

ERA retrieves from these homes through registered reads or face context. It never keeps a parallel copy.

| Information | Owning module and table | How ERA should retrieve it | Never in ERA memory because |
|---|---|---|---|
| Allergies, conditions, medications | Healthcare `health_*`; cooking feed `get_household_allergens()` | The existing minimal allergens RPC for food tasks; nothing clinical otherwise | Clinical privacy; Healthcare's `shared_with_household` rules (`src/app/api/healthcare/allergens/route.ts:7-10`) |
| Places, contacts, documents, assets | Catalogue `catalogue_items` (Places via `settings_json.era_role`) | Name/tag lookup today; HUB-69 authorized search | A copy would drift from Catalogue revisions (HUB-71) |
| Balances, spending, budgets | Accounts, Transactions, Budget Allocation | Registered `spend.month`; canonical balance via `balance-utils` (HUB-45) | Money facts must be computed from source (Doctrine §5 priority 1) |
| Recurring bills, debts | Recurring Payments, Debts | Registered reads (to be added) | Commitments have engines; a copy cannot be paid or skipped |
| Reminders, events, chores, meal plans | Schedule items, Chores, Meal Planning | `schedule.forDay`, `reminder.find`, meal reads | Recurrence and occurrences belong to Schedule (`recurrence-safety`) |
| Trips (travel circumstances) | Trips (`status`, dates, destination) | Proposed read: active/upcoming trip in window | Trips owns dates and household scope |
| Goals | Future Purchases, Budget Allocation, Fitness plans | Proposed reads | Progress is computed by the module |
| Settings (month start, LBP rate, theme, quiet hours) | `user_preferences`, `notification_preferences` | Already partly read (`date_start`) | Authored settings win over any ERA preference |
| Household lists | Hub shopping threads | Existing capture memory (suggestions only) | Shared, partner-authored content |
| Vocabulary, defaults, stated preferences, temporary circumstances | **ERA**: `era_lexicon` (extended) | Live, unexpired, unrevoked rows each request | — this is ERA's own |
| What was said | **ERA**: `era_messages` | Lexical episode retrieval (current) | — evidence, not memory |
| Short household notes (Wi-Fi password, gate code) | Brain notes, fate under D17 | `memory.recall` only, never auto-injected | Household audience; D17 unresolved |

## 6. External research

Verified on **2026-11-04** through the session's web search index. Direct page fetches of `www.postgresql.org`, `supabase.com` and `genai.owasp.org` failed (`ENOTFOUND`: outside the session's allowed network domains), so these points come from search-result summaries of the cited pages, not from reading the pages. Re-read them before implementing.

| Topic | Primary source | Point used here |
|---|---|---|
| Full-text ranking | [PostgreSQL docs, "Controlling Text Search" (current)](https://www.postgresql.org/docs/current/textsearch-controls.html) | `ts_rank` / `ts_rank_cd` rank by term frequency and, for `_cd`, proximity; normalization options adjust for document length |
| Fuzzy names | [PostgreSQL docs, pg_trgm (current)](https://www.postgresql.org/docs/current/pgtrgm.html) | Trigram similarity with GIN/GiST indexes that also accelerate `LIKE`/`ILIKE` |
| Hybrid search | [Supabase, "Hybrid search"](https://supabase.com/docs/guides/ai/hybrid-search) | Combines a generated `tsvector` (GIN) with a pgvector embedding column and fuses ranks with Reciprocal Rank Fusion; embeddings must be produced by an embedding model |
| Embedding provider | [Anthropic docs, "Embeddings"](https://docs.anthropic.com/en/docs/embeddings) | Anthropic does not offer its own embedding model and points to third-party providers (Voyage AI named) |
| Prompt injection in retrieved content | [Claude docs, "Mitigate jailbreaks and prompt injections"](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks) | Put third-party content in tool results rather than the system prompt; state in the system prompt that such content is untrusted data; JSON-encode it; optionally screen it |
| Prompt injection taxonomy | [OWASP GenAI Security Project, LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) | Indirect injection through external content is the top-listed risk. **Only secondary summaries were returned**; the primary text was not read. Cited as a pointer, not for specific mitigations |

**Gaps.** No primary page was read in full. Pricing for embedding providers and Claude was not researched (the repo's own price table is `src/features/era/aiUsage.ts`). No research was done on Arabic, French or transliterated ("Arabizi") text search; which languages the household types is UNKNOWN.

## 7. Retrieval approaches against ERA's needs

**What ERA needs** (from code, not usage): retrieval per person over hundreds of rows a month (row counts UNKNOWN); exact references for writes (registered lookups only); names with spelling variants (`Kobeize`, `Mukhtar` appear in repo examples); paraphrase recall for follow-ups; freshness and deletion that propagate immediately; owner-only privacy; a $1/month per-user model ceiling (`MONTHLY_BUDGET_USD`, `src/app/api/era/ask/route.ts:60`); 2-second budget per optional read.

| Approach | Fits ERA because | Costs and risks in ERA | Infrastructure today | Verdict |
|---|---|---|---|---|
| **R1 Structured source reads** (registered capabilities, RPCs) | Exact, permission-checked, always fresh; IDs are valid by construction | One adapter per module; coverage grows slowly (HUB-81) | 18 registered capabilities (HUB-108) | **Primary path** for facts, commitments, goals |
| **R2 In-process lexical IDF** over recent `era_messages` | Already built and tested; no index; deletes take effect at once | 30 days / 400 rows ceiling; misses paraphrases; JS scoring cost grows with window | `eraAdaptiveContext.ts:264-294` | **Keep** for episodes |
| **R3 Postgres full-text search** (`tsvector`, GIN, `ts_rank`) | Moves R2 into the DB; can widen the window without shipping rows; deletion still immediate | Needs a migration (generated column + index); language configuration (`simple` vs `english`) unsettled for mixed-language text | Not present | **Next step** if a benchmark shows the 30-day window loses relevant episodes |
| **R4 Trigram matching** (`pg_trgm`) | Names, aliases, typos; the Brain `ILIKE` and Places tag match would benefit | Extension + index; thresholds need tuning on household names | Not present; extension availability UNKNOWN | **Use for references** (Catalogue search HUB-69) |
| **R5 Embeddings + pgvector, hybrid with RRF** | Best paraphrase recall | Top Layer §6 non-goal; new paid provider (Anthropic has none); every edit and forget must re-embed or delete vectors; personal text sent to a third party; another latency hop | Not present | **Not recommended** until R2/R3 fail a measured paraphrase benchmark and the owner reverses §6 |
| **R6 Long-context stuffing** (send everything) | Simple | Token cost against the $1 ceiling; latency; more injectable text; privacy | — | **Reject** |
| **R7 Model-written rolling profile** ("ERA's notes about you") | Compact | Unverifiable; drifts; promotes model prose to fact (forbidden, HUB-106); a hidden write on the read path (Doctrine §4) | — | **Reject** |

## 8. Three designs

All three share the cross-cutting components in §9. They differ in where a kept preference or circumstance lives.

### Design A — extend the lexicon (recommended)

Add `preference` and `circumstance` to `era_lexicon.kind`, plus `statement`, `subject`, `basis`, `valid_from`, `valid_until`, `superseded_by`, `revoked_reason`. Owner-run migration file, then `schema.sql` (Hard Rule 24). RLS stays `era_lexicon_self`.

- **Why:** the lexicon already has owner-only RLS, revocation without deletion, `source_message_id`, `depends_on` re-binding, conditions, a one-live-default index and Always/Forget UX. It is `era_*` (D4) and is U3's engine, so this extends an engine instead of creating one (D17). Slot-shaped preferences ("morning = 9") are already `default` rules; only free-text ones need the new kinds.
- **Creation:** "remember …", "from now on …", "until Sunday …" → ERA classifies the sentence. Facts with a module home get an offer to that module. What remains becomes a card `Keep · Until Sun` with [Keep] [No]. Native explicit save = Act + Undo; model-proposed save = Confirm (Top Layer §5). Never on a negated, hypothetical or quoted sentence (speech-act gate, `intents/speechAct.ts`).
- **Use:** the assembler reads live rows (`revoked_at IS NULL`, `valid_from ≤ now < valid_until`), ≤20, into a `kept` section with date, basis and expiry.
- **Tradeoffs:** + one engine, small migration, reuses UI; − stretches a slot-oriented table with free text; − personal only, so a household preference stated by one person is invisible to the other ([§9 K5](#k5-household-scope)); − depends on `era_lexicon` being deployed (⛁ UNKNOWN).
- **Failure behaviour:** table missing → existing 503 `LEXICON_SETUP_REQUIRED` path; assembler marks `kept: unavailable`, ERA does not claim it remembers nothing. Save fails offline → visible failure with retry chip, no new queue (D11). Concurrent duplicate save → unique index on live (`user_id`, `kind`, normalized `statement`, `subject`) → 409 → treated as already kept.
- **Dependencies:** HUB-62 DB evidence that `era_lexicon` exists; HUB-47/HUB-64 so only verified outcomes feed `example`; time-zone decision (OD-5) for `valid_until`.
- **Acceptance:** AS-1, AS-2, AS-4, AS-6 in [CORRECTION-AND-EXPIRY-RULES §10](CORRECTION-AND-EXPIRY-RULES.md#10-acceptance-scenarios).

### Design B — pinned statements, no migration (fallback)

Keep a statement by appending a system `era_messages` row `intent_kind: "memory_pin"` `{messageId, kind, validUntil}`; un-keep with `memory_unpin`. The assembler loads pins regardless of the 30-day window.

- **Tradeoffs:** + ships without SQL (era_messages RLS `ALL` self is in the snapshot); − every reader of `era_messages` must filter one more system kind (known gotcha, ERA Feature Map); − expiry and supersession are computed by replaying pins; − slower as history grows; − two places express "rules" (lexicon defaults and pins).
- **Failure behaviour:** pin row lost on network failure → card stays with retry, the statement remains only `stated`.
- **Use when:** the owner declines any migration but wants G1 closed.

### Design C — Brain notes as personal memory (not recommended)

Use `household_memories` for preferences and circumstances.

- **Against:** the table is absent from the authoritative schema and snapshot; audience is the whole household; no update route; recall is recency-ordered `ILIKE`; D17 recommends folding it; the Catalogue final build plan (C11a) keeps one deliberate note implementation and warns against silently converting personal preferences into household notes. Choose only if the owner decides Brain is the surviving note owner **and** adds a personal audience.

## 9. Cross-cutting components (needed with any design)

### K1 Source resolvers

Every fact used in an answer comes from a registered read executed for this request, with `as_of` and coverage. Historical IDs never supply a target (current rule, `eraAskProposal.ts:297`). New reads in priority order: canonical balances and billing month (HUB-45), active trip in window, household allergens for food tasks, Catalogue search (HUB-69).

### K2 Context envelope (injection containment)

- Instructions stay in the system block. **All retrieved content moves out of it** into one data message (or tool-result block) per request, JSON-encoded, each item tagged with `origin` (`self`, `era`, `module`, `external`), `author` and `as_of`.
- Free text from external origins (bank descriptions, scraped recipes, guest-portal input) is length-clipped and flagged `external: true`.
- Retrieved content can never create or change a memory, a consent or a target; only the current user turn and a tap can (rule CE-24).
- Admission, Confirm and artifact receipts stay the authority (unchanged).

### K3 Forget pipeline

One route that, for a message, statement, kept rule or note: revokes rules, redacts message content (tombstone keeps `id`, time, outcome and token counts), redacts the `ai_messages` content copies, clears payload copies (`metadata.value`), and returns the list of copies it could not reach (PM Master Book, other devices' caches). Details and partial-completion rules: [CORRECTION-AND-EXPIRY-RULES §7](CORRECTION-AND-EXPIRY-RULES.md#7-forget). No migration needed for redaction: `era_messages` (`ALL` self) and `ai_messages` (update own) policies in the 2026-08-04 snapshot allow it.

### K4 Persisted AI outputs

Any stored model output carries `generated_at`, the hash of its inputs and a model marker, and is stale when inputs change, not when a count changes. Applies to Focus insights (or its D9 replacement) and recipe imports (`ai_generated` must be set by the import path).

### K5 Household scope

- Records are personal. A preference about the household ("we don't eat meat on Fridays") is stored as the speaker's, with `subject: household`, and is shown to the model as "Maya said on 2026-10-30". It never applies to the partner's ERA.
- Partner data enters a request only through module reads that already apply household visibility (shared items, shared trips, household allergens). Private partner accounts are reported as `not visible`, never as zero.
- A truly shared household preference belongs in the module it governs (for example a Meal Planning setting), visible and editable by both. Whether to build that is OD-4.

## 10. Staged adoption

| Step | Change | Needs SQL | Closes | Depends on |
|---|---|---|---|---|
| S0 | Replay-only acceptance fixtures for forget, stale and injection cases (no paid calls, Hard Rule 29) | No | Evidence | — |
| S1 | K3 forget pipeline: redact `era_messages`, `ai_messages` content, payload copies; Brain note delete clears recall copies | No | G2 | HUB-62 confirmation of current policies |
| S2 | K2 envelope: retrieved data out of the system block; JSON-encode titles and descriptions; face contexts report coverage and treat errors as `unavailable` | No | G3, G4 | HUB-45/HUB-41 for money semantics |
| S3 | Design A migration (owner-run) + Keep card + `kept` section; Schedule resolvers read time defaults (`reminder.create · time.morning`) from the lexicon; examples recorded only after an acknowledged outcome | Yes ⛁ | G1, G8 (with OD-5), G10, G11 | `era_lexicon` deployed; HUB-47/64; OD-1 |
| S4 | K4 freshness for Focus insights or its replacement | Maybe | G7 | D9 |
| S5 | R3/R4 retrieval upgrades after a paraphrase and name benchmark | Yes | Recall | HUB-69; benchmark |
| S6 | Retire or fold the legacy assistant so one assembler serves every AI surface | No | G6 | Owner decision OD-10 |

## 11. Owner decisions

| ID | Decision | Options | Recommendation | Blocks |
|---|---|---|---|---|
| OD-1 | Where kept preferences and circumstances live | A extend `era_lexicon` · B pinned statements · C Brain notes · none | A (B if no SQL) | S3 |
| OD-2 | How long `era_messages` content is kept | Indefinitely (today) · N months then redact · per-chat choice | 12 months, then redact content and keep outcome rows | Retention job |
| OD-3 | What "Forget" does | Revoke only · redact · hard delete | Redact everywhere ERA copied; hard delete only on account removal | S1 |
| OD-4 | Household-scoped preferences | Personal only · module settings shared by both · shared ERA records | Personal only now; shared ones as module settings | K5 |
| OD-5 | Time zone of record | Device at statement time · stored per person · home zone (Beirut) | Store per person; until then record device zone with each kept rule | `valid_until` semantics |
| OD-6 | Embeddings | Keep §6 non-goal · allow after benchmark | Keep the non-goal | S5 |
| OD-7 | Ask AI content in `ai_messages` | Keep text · token receipts only | Receipts only (tokens, model, time); text lives in `era_messages` | S1 |
| OD-8 | Default circumstance expiry | 3 / 7 / 14 days; max | Stated end, else 7 days; max 90 without renewal | S3 |
| OD-9 | Partner-authored shared text in model context (shared items, shopping rows) | Never · titles only · full | Titles only, tagged with author | K2/K5 |
| OD-10 | Legacy floating assistant | Keep · route to ERA · retire | Retire after ERA covers its budget analysis use | S6 |
| OD-11 | Reports already imported into the Master Book | Leave · redact going forward · scrub | Redact transcripts in new imports to the minimum needed; owner decides on history | K3 |

## 12. Not proposed

A vector or graph store; model-written profiles; automatic habit promotion; storing medical, financial or partner facts in ERA; a new offline queue for memory saves; geofenced circumstances (owner exclusion D2/§6); memory that crosses accounts.
