# Catalogue — Execution Prompts

Source of truth:
`docs/Catalogue — ASTRA Deep Dive.md`, especially §10.

These prompts execute the accepted Catalogue architecture:

**Catalogue = ERA Global Reference / Definition Library**
**Operational modules = execution/state/history owners**

Do not reopen the superseded Object Memory architecture or mandatory Tasks V2 unless a packet discovers evidence that genuinely invalidates §10.

---

# Execution rules

For every packet:

1. Re-read the relevant packet in §10 before changing code.
2. Verify the packet's assumptions against current source.
3. Keep scope limited to that packet and its necessary prerequisites.
4. Do not silently implement adjacent packets.
5. Preserve existing IDs/data unless the packet explicitly authorizes otherwise.
6. Run the packet's required tests plus appropriate typecheck/lint.
7. Update relevant PM/checklist/docs.
8. Do not claim production/runtime verification without evidence.
9. If a prerequisite or architectural contradiction is discovered, STOP and report it rather than broadening scope.
10. At completion report:

- files changed
- behavior before vs after
- tests/checks run
- migration/deployment action required
- remaining risks
- newly discovered follow-up work

---

# C01a — Record-aware document authorization

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read `docs/Catalogue — ASTRA Deep Dive.md` §10 and implement packet
**C01a — P0 · Record-aware document authorization**.

Implement C01a completely according to its specified objective, scope,
dependencies, acceptance criteria, risks and tests.

Keep scope strictly to C01a.

Do not implement C01b, C02, C03 or broader Catalogue redesign except for a
minimal prerequisite that is impossible to avoid. If such a prerequisite
exists, stop and report it before broadening scope.

Verify the current implementation before modifying it.

Run the required scoped tests and appropriate typecheck/lint.

Update the relevant project documentation/checklist.

Do not claim production verification.

Report completion using the standard execution report defined in this file.

---

# C00 — Establish rollout evidence

Recommended effort:

- Claude Code: MEDIUM
- Codex: MEDIUM

Prompt:

Read §10 packet **C00 — P0 · Establish rollout evidence**.

Execute C00 only.

This is an evidence/census task, not an implementation or cleanup task.
Do not normalize production data, infer missing relationships or make schema
changes.

Produce the exact evidence/artifacts required by C00 and identify anything
that still requires owner-supplied runtime/database evidence.

Update the relevant deployment/campaign documentation.

---

# C04a — Repair day/range adapter

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C04a — P0 · Repair the day/range adapter** and the current
Schedule campaign documentation it references.

Implement C04a only.

Treat this as Schedule correctness work, not Catalogue redesign.

Preserve existing Schedule IDs and behavior outside the explicitly corrected
occurrence semantics.

Do not proceed into C04b or C04c.

Run the complete occurrence/date regression set required by the packet and
appropriate typecheck/lint.

Report any behavior where the current repository contradicts the packet before
inventing new recurrence semantics.

---

# C02 — Safe Catalogue updates

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C02 — P0 · Safe Catalogue updates**.

Implement C02 only.

The goals are safe metadata patch semantics, revision-aware writes,
preservation of untouched/unknown data, validation of changed fields and
prevention of lost concurrent updates.

Do not use this packet as an opportunity to normalize old Catalogue metadata
or redesign the forms.

Preserve legacy values unless explicitly edited.

Follow the migration and old-client compatibility requirements in §10.

Run all specified concurrency, metadata preservation and validation tests.

---

# C01b — Preserve document files through replacement/Undo

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C01b — P0 · Preserve document files through
replacement/Undo**.

Implement C01b only.

C01a and C02 are prerequisites and must be verified before proceeding.

Implement the immutable-upload, conditional-pointer-swap and bounded recovery
contract without introducing Documents V2 or a generic artifact/version system.

Run the failure-injection and concurrent replacement tests specified by C01b.

---

# C03 — Identity-preserving Undo and deletion lifecycle

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C03 — P0 · Identity-preserving Undo and deletion lifecycle**.

Implement C03 only.

Deletion/restore must preserve the original Catalogue identity and existing
references.

Do not recreate deleted records under new IDs.

Audit every deletion path identified by the packet, including recycle-bin and
purge paths.

Do not broaden this into a generic application-wide Undo rewrite.

Run the linked-record, restore, purge and concurrency witnesses specified by
the packet.

---

# C04b — Carry occurrence identity through effects

Recommended effort:

- Claude Code: XHIGH / MAX
- Codex: XHIGH

Prompt:

Read §10 packet **C04b — P0 · Carry occurrence identity through effects** and
the relevant Schedule recurrence documentation.

Implement C04b only.

This is a high-risk Schedule correctness change.

Preserve every existing operational item ID and historical row ID.

Do not introduce Tasks V2, replace Schedule, redesign recurrence or combine
this with C04c.

Be extremely conservative with legacy ambiguous occurrence data: preserve
ambiguity rather than guessing.

Execute all migration, uniqueness, flexible-slot, completion, move, alert,
subtask and retry witnesses specified by C04b.

Stop if current deployed/schema evidence required by the migration is missing.

---

# C04c — Converge existing consumers

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C04c — P0 · Converge existing consumers**.

Implement C04c only after C04a and C04b are verified.

Move the specified Schedule/ERA consumers onto the proven shared occurrence
contract while preserving their existing UI/layout.

Do not redesign Calendar, Week, Today or Planner.

Require fixture parity before deleting or bypassing existing expansion code.

---

# C05 — Atomic activation and reliable replay

Recommended effort:

- Claude Code: XHIGH / MAX
- Codex: XHIGH

Prompt:

Read §10 packet **C05 — P0 · Atomic activation and reliable replay**.

Implement C05 only.

This packet establishes the authoritative Catalogue-definition → Schedule
activation command.

Preserve Catalogue definition IDs and all resulting Schedule item IDs.

Do not implement Tasks V2.

All Catalogue-derived creation paths identified in the packet must converge on
the checked owner behavior before the packet can be considered complete.

Pay particular attention to:

- atomic DB effects
- stable request identity
- replay/idempotency
- partial failure
- authorization
- source revisions
- offline replay
- post-commit Google projection

Run failure injection at every specified stage.

Do not claim success if old/direct writers can still bypass the new contract.

---

# C06 — Atomic promotion to reusable definition

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C06 — P0 · Atomic promotion to reusable definition**.

Implement C06 only after its prerequisites are verified.

Promoting a Schedule item must create/reuse a Catalogue definition without
changing the existing operational item, execution state or history.

Preserve IDs and explicit linked/unlinked semantics.

Run retry, rollback, permission and no-execution-state-copy tests.

---

# C07 — Safe activation pause/stop/resume

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C07 — P0 · Safe activation pause/stop/resume**.

Implement C07 only.

Lifecycle commands target Schedule activations, not Catalogue definitions.

Preserve history, placement IDs and unrelated pause sources such as Trips.

Do not reinterpret Pause as recurrence truncation.

Run the complete fixed/flexible/one-off and overlapping-pause regression set.

---

# C08 — Future-only defaults and accurate usage

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C08 — P1 · Future-only defaults and accurate usage**.

Implement C08 only after its Schedule prerequisites are verified.

Make the Catalogue definition contract real:

Catalogue defaults affect future instantiation.
Existing Schedule execution keeps its captured operational values.

Implement accurate authorized usage information without read-side mutation.

Do not fabricate historical targets.

---

# C17 — Inventory ownership guard

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C17 — P1 · Inventory ownership guard**.

Implement C17 only.

Catalogue may own descriptive reference information while Inventory retains
authority over quantities, units, stock policy and history.

Do not introduce Inventory V2, SKU/asset/lot infrastructure or unrelated
restock automation.

---

# C09 — Reference-focused Catalogue UX

Recommended effort:

- Claude Code: MEDIUM
- Codex: MEDIUM

Prompt:

Read §10 packet **C09 — P1 · Reference-focused Catalogue browsing/forms**.

Implement C09 only.

Make Catalogue visibly behave as ERA's Global Reference / Definition Library.

Preserve the existing navigation and useful records.

Do not redesign ERA shell/navigation or remove Catalogue.

Operational actions must lead to their owning module rather than creating
another editable copy inside Catalogue.

Verify mobile (~390 px) and desktop.

---

# C10 — Authorized Catalogue search

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C10 — P1 · Authorized Catalogue search**.

Implement C10 only.

Build bounded authorized lexical retrieval over existing records.

Do not introduce Object Memory, embeddings, vector storage, generic entity
resolution or persistent search infrastructure.

Authorization must occur before ranking/snippets/counts are exposed.

Run the relevance, pagination, Arabic/Arabizi and privacy matrix specified by
the packet.

---

# C11a — Saved-note correction

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C11a — P1 · Correct the surviving saved-note path** and the
existing D17/M-00 decision evidence.

Implement the correct deployment branch only after verifying which saved-note
backend actually exists.

Do not create a new Memory store merely to satisfy the plan.

Preserve existing IDs, authors and audience.

---

# C11b — ERA retrieval integration

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C11b — P1 · ERA retrieval and correction integration**.

Implement C11b only after C10 is complete.

Brain/ERA is a retrieval/conversation surface, not another editable source of
truth.

Use authorized existing record IDs and owner corrections.

Do not create Object Memory/entity/assertion infrastructure.

Run ambiguity, forged-ID, stale-source, authorization and context-coverage
tests.

---

# C12 — Wish → Budget goal

Recommended effort:

- Claude Code: MEDIUM
- Codex: MEDIUM

Prompt:

Read §10 packet **C12 — P1 · Wish → Budget goal**.

Implement C12 only.

Catalogue keeps loose research/wishes.
Budget owns the financial plan.

Promotion must be explicit, idempotent and must not create financial effects
outside the Future Purchase contract.

---

# C13 — Recipe clipping → Kitchen master

Recommended effort:

- Claude Code: HIGH
- Codex: HIGH

Prompt:

Read §10 packet **C13 — P1 · Recipe clipping → Kitchen master**.

Implement C13 only after its Kitchen prerequisites are satisfied.

Keep one executable recipe owner: Kitchen.

Catalogue may retain the original clipping/reference but must not become a
second synchronized recipe editor.

---

# P2 / optional packets

C14, C15, C16 and C18:

- Claude Code: MEDIUM/HIGH depending on discovered complexity
- Codex: MEDIUM/HIGH

C19:

- Claude Code: HIGH
- Codex: HIGH

Do not execute P2/optional packets automatically after P1.

Each requires a separate owner decision that the capability is still useful.

---

# Explicitly not part of this execution program

Do not build:

- universal Object Memory
- entity/alias/assertion/relationship infrastructure
- mandatory Tasks V2
- task-definition migration out of Catalogue
- wholesale Documents V2
- graph database
- broad automatic extraction
- general knowledge graph
- second Brain truth store
- mass Catalogue migration
- automatic financial/schedule effects from merely linking a reference
