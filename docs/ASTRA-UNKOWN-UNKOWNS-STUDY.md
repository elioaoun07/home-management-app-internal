# ASTRA — ERA Unknown Unknowns Study

## Mission

Study the entire ERA repository and discover the most consequential things I have **not asked previous agents to investigate**.

Your primary job is not to answer my questions.

Your primary job is to discover:

> **What important questions have I failed to ask?**

This session is being assigned to Astra specifically because I want findings that a conventional code review, roadmap review, architecture audit, or weaker model would be unlikely to uncover.

The goal is not more ideas.

The goal is to find hidden assumptions, structural weaknesses, overlooked opportunities, false beliefs, unnecessary complexity, misunderstood system behavior, and architectural truths that could materially change how I think about ERA.

---

# 1. This prompt is a research scaffold, not a search boundary

Do not optimize for satisfying the headings in this document.

Do not treat the examples below as a checklist.

They are merely investigative lenses.

You are explicitly authorized to pursue any line of investigation that repository evidence suggests is more consequential than the areas I anticipated.

If your most important finding:

- belongs to no existing roadmap item;
- crosses several modules;
- contradicts years of existing assumptions;
- does not fit the current architecture vocabulary;
- suggests deleting something everyone assumed was necessary;
- reveals that ERA is solving the wrong problem;
- identifies a capability nobody has considered;
- or challenges the premise of this study itself;

that is a valid and potentially excellent result.

A surprising conclusion backed by strong evidence is more valuable than agreement with this brief.

---

# 2. Existing work is prior evidence, not the answer

Read the repository deeply, including where relevant:

- `CLAUDE.md`
- Design Doctrine
- Feature Map
- active Master Plan
- Master Books
- campaign checklists
- ASTRA 10× Portfolio
- ASTRA Contradiction Register
- ASTRA Coverage & Orphans
- Top Layer ASTRA study
- Command Center ASTRA study
- campaign ASTRA Books
- relevant source code
- tests
- migrations as historical/source artifacts only
- git history
- runtime artifacts where safely available

Previous ASTRA work is valuable prior evidence.

It is **not authoritative merely because Astra wrote it**.

Verify important claims against current repository evidence.

If this study causes you to disagree with a previous ASTRA conclusion, say so explicitly and explain why.

Do not spend the session simply rediscovering the existing ASTRA portfolio.

---

# 3. Evidence and safety rules

This is a study session.

Do not modify application code.

Do not perform git writes.

Do not write to or query the live production database.

Do not infer current RLS, policies, triggers or DB-function behavior from stale repository artifacts.

For every consequential factual finding provide:

- repository evidence;
- command evidence;
- artifact evidence;
- or an explicit `UNVERIFIED:` statement describing what would settle it.

Separate clearly:

**Observed fact**
from
**inference**
from
**hypothesis**
from
**recommendation**.

Do not inflate confidence.

A falsifiable uncomfortable conclusion is more valuable than a polished guess.

---

# 4. What qualifies as an Unknown Unknown

A finding belongs in this study only when it passes this test:

> **If this is true, could it materially change architecture, priorities, trust, maintainability, capability, or daily use of ERA?**

Do NOT fill the report with:

- small bugs;
- ordinary refactors;
- isolated missing tests;
- generic best practices;
- dependency updates;
- naming cleanup;
- local performance improvements;
- known backlog work;
- findings already fully represented by existing ASTRA packets.

Those can be handled by ordinary models.

Look instead for things whose importance emerges only after understanding multiple parts of the system together.

---

# 5. Investigative lenses — examples only

You may explore these when useful, but you are not required to cover them.

### Hidden assumptions

What does the repository repeatedly assume without proving?

What assumptions originated years ago and survived because nobody questioned them?

What does documentation treat as a fact that implementation does not actually guarantee?

### Wrong abstractions

Where might ERA have chosen the wrong unit of architecture?

Examples could include:

- module boundary;
- source of truth;
- event;
- capability;
- state;
- identity;
- signal;
- workflow;
- agent;
- cache;
- notification;
- conversation.

Do not assume these examples contain the answer.

### Accidental architecture

What important behavior exists only because several unrelated implementations happen to line up?

What has effectively become infrastructure without ever being designed as such?

### Hidden coupling

What apparently independent systems actually depend on the same assumptions, state, identity, timing or failure semantics?

Look beyond direct imports.

### Wrong measurements

Where does ERA measure something that is only a proxy for the thing the owner actually cares about?

Examples:

- success versus acknowledgment;
- activity versus usefulness;
- generated artifact versus verified outcome;
- stored notification versus observed delivery;
- processed tokens versus context;
- green checks versus actual correctness.

Search beyond known examples.

### Historical constraints

What architecture exists because of limitations that are no longer true?

This may include:

- older model capability;
- old framework constraints;
- past deployment assumptions;
- previous device limitations;
- old provider behavior;
- assumptions inherited from prototypes.

Do not modernize merely because something is old.

Find places where the old constraint is genuinely driving unnecessary complexity today.

### Unexploited assets

What valuable capability is latent in data, infrastructure, abstractions or relationships ERA already possesses?

Ask especially:

> What is one architectural move away from becoming disproportionately valuable?

### Duplication at the conceptual level

Do not only search for duplicate code.

Search for the same concept being implemented multiple times under different names.

### Missing negative space

What _isn't_ represented anywhere but probably needs to be?

What important state, relationship, outcome or uncertainty is absent from ERA's model?

### Human/system mismatch

Where does ERA's architecture force the owner to behave in a way that exists only to accommodate the software?

What repeated manual behavior is actually an architectural smell?

### Trust asymmetry

Where does ERA present stronger certainty than the underlying evidence deserves?

Where does it know more than it exposes?

Where does it expose more than it actually knows?

### Future model capability

Assume AI systems continue becoming substantially more capable.

Which parts of ERA become unnecessary?

Which parts become more valuable?

Which assets should ERA deliberately own because stronger general AI does not replace them?

### Complexity economics

Which part of ERA consumes disproportionate implementation, maintenance, context or owner attention relative to the value it creates?

What should be deleted rather than improved?

---

# 6. Follow evidence outside my framing

When you encounter a potentially important finding:

1. Do not immediately turn it into a recommendation.
2. Trace it through the repository.
3. Search for counter-evidence.
4. Determine how many systems depend on it.
5. Ask what would happen if the assumption were false.
6. Determine whether previous plans already partially address it.
7. Attempt to falsify your own interpretation.
8. Only then decide whether it qualifies.

I prefer **5 deep findings** over 30 plausible observations.

---

# 7. Deliberately search for things previous agents were unlikely to find

Pay particular attention to findings that require:

- connecting distant modules;
- reconstructing historical design evolution;
- comparing documentation with implementation;
- tracing several layers of abstraction;
- understanding multiple failure paths together;
- questioning the unit being measured;
- noticing that two apparently different problems share one root cause;
- noticing that several proposed fixes are treating symptoms of one missing primitive;
- recognizing that a feature should disappear rather than improve.

The hard part of this study is synthesis.

Use Astra for that.

---

# 8. Do not automatically create work

This is discovery first.

Do not convert every finding into:

- a packet;
- a checklist item;
- a migration;
- an implementation project.

For each important finding determine first whether the appropriate next step is:

- no action;
- collect evidence;
- run an experiment;
- clarify an owner decision;
- amend documentation;
- perform a focused architectural study;
- simplify/delete something;
- or eventually implement something.

Discovery does not imply roadmap expansion.

---

# 9. Required deliverables

Create:

`ERA Notes/10 - Project Management/Unknown Unknowns/`

## `ERA — Unknown Unknowns.md`

The main findings.

For every finding include:

- Finding
- Why it matters
- Why it was easy to miss
- Evidence
- Systems affected
- Confidence
- Counter-evidence considered
- What would falsify it
- Consequence if true
- Appropriate next move
- Whether action is needed now

Do not force a finding count.

Cap the main set at **20**, but use fewer when appropriate.

---

## `ERA — Hidden Assumptions.md`

Identify assumptions ERA currently depends on.

Separate:

- proven invariant;
- deliberate owner decision;
- implementation assumption;
- historical assumption;
- undocumented assumption;
- assumption now contradicted by evidence.

Highlight assumptions whose failure would affect several systems.

---

## `ERA — Questions Nobody Asked.md`

Write the important questions that emerged from studying the repository.

These should be questions worth giving to another premium reasoning session, the owner, or a focused experiment.

Do not turn ordinary engineering questions into premium questions.

---

## `ERA — Follow-up Experiments.md`

For findings that remain uncertain, define the **smallest experiment capable of disproving or validating them**.

Prefer:

- read-only measurement;
- deterministic fixture;
- artifact analysis;
- synthetic test;
- owner observation;

over implementation.

Each experiment should state:

- hypothesis;
- evidence required;
- method;
- pass/fail interpretation;
- what decision the result changes.

---

# 10. Rank only after discovery

After the investigation is complete, rank the findings by:

**potential consequence × confidence × architectural reach**

not by implementation convenience.

Then identify the **five findings most likely to change ERA's future**.

For those five answer:

- What do I currently believe?
- What does the evidence suggest instead?
- Why does the difference matter?
- What should change in my thinking before any code changes?

---

# 11. Mandatory second-pass self-challenge

Before declaring the study complete, stop and challenge your own work.

Ask yourself:

### What did I initially assume because the existing documents framed it that way?

### What did repository evidence force me to change my mind about?

### Which area did I almost ignore because no roadmap item points toward it?

### Which finding would a competent but weaker model be most likely to miss?

### Which finding required connecting the most distant parts of the system?

### Which apparent problem turned out to be a symptom of something deeper?

### Which existing recommendation became less convincing after this study?

### What am I still accepting as obvious that I have not actually proven?

### If my findings mostly resemble the current roadmap, did I actually complete an Unknown Unknowns study?

If the final output mostly restates existing plans, ASTRA Books or known defects:

**continue investigating.**

Do not stop merely because every requested document exists.

---

# 12. Mandatory final section

End `ERA — Unknown Unknowns.md` with:

# Things I initially believed that the repository forced me to change my mind about

This section is mandatory.

Include only genuine changes in your own working model produced during the investigation.

Then answer:

> **What is the single most important thing about ERA that the owner does not appear to be thinking about enough?**

The answer may be:

- architectural;
- product-related;
- reliability-related;
- organizational;
- AI-related;
- data-related;
- or something this prompt never anticipated.

Evidence matters more than category.

---

# Final instruction

Your primary job is not to validate my roadmap.

Your primary job is not to demonstrate that you read the repository.

Your primary job is not to produce more work.

Your job is to use deep repository understanding to discover what the owner and previous agents have been systematically failing to notice.

The examples in this brief are **lenses, not boundaries**.

If the strongest finding sits outside every lens above, follow it.

If the best result is uncomfortable, surface it.

If the best result is deletion, recommend deletion.

If the best result is that an existing assumption is actually correct, prove it.

If the best result requires no implementation at all, that is acceptable.

**Do not optimize for completeness of this prompt. Optimize for consequence, evidence, surprise and truth.**
