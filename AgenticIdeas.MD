# Verdict

**Yes—every item is doable.** More importantly, they fit your existing Delivery architecture without requiring a redesign.

The key principle should be:

> **A Delivery owns the permanent context. Claude, Codex, models, and effort levels are temporary execution engines attached to it.**

This transforms Delivery from “a wrapper around an AI chat” into a **provider-neutral delivery workspace** with auditable history, structured decisions, portable context, resumable execution, and controlled handoffs.

---

# Feasibility of your requests

| Request                               | Feasible? | Recommended behaviour                                                                            |
| ------------------------------------- | --------: | ------------------------------------------------------------------------------------------------ |
| View full conversation input/output   |       Yes | Normalized conversation viewer with messages, tool calls, commands, diffs, approvals and results |
| Dedicated Questions & Answers         |       Yes | Structured Q&A inbox linked to phases and blocking gates                                         |
| Choose model and effort before launch |       Yes | Run Configuration screen with phase defaults and optional overrides                              |
| Improve timeline                      |       Yes | Phase-oriented timeline instead of raw event spam                                                |
| Change model or effort mid-session    |       Yes | Pause at a safe turn boundary, change configuration, resume                                      |
| Switch Claude ↔ Codex                |       Yes | Create a provider handoff package and start a new provider session                               |
| Preserve context across switches      |       Yes | Through your database and context snapshots—not through provider-native caches                   |
| Raw plus compacted conversations      |       Yes | Immutable raw transcript plus versioned compacted context                                        |
| Smart caching/context reuse           |       Yes | Context policy engine decides between resume, compact, retrieve, fork or rebuild                 |

There is one limitation: you can display **messages, tool calls, tool results, commands, generated files, diffs, errors, approvals and provider reasoning summaries**, but you should not expect access to a model’s hidden internal chain of thought.

---

# 1. Conversation viewer

You should absolutely expose the conversations. They are currently one of the most valuable artifacts produced by Delivery.

## Recommended interface

### Delivery header

Always visible:

- Current phase and status
- Active provider
- Active model and effort
- Context usage
- Session cost and token usage
- Current Git branch/worktree
- Pause, stop and resume controls
- “Change model” and “Change provider” actions

### Conversation navigation

Organize conversations hierarchically:

```text
Delivery
 ├─ Discovery
 │   ├─ PM Orchestrator
 │   ├─ Business Analyst
 │   └─ User Questions
 ├─ Specification
 │   └─ PM Orchestrator
 ├─ Planning
 │   ├─ Technical Planner
 │   ├─ Database Specialist
 │   └─ Security Specialist
 └─ Building
     ├─ Backend Agent
     ├─ Frontend Agent
     └─ Validation Agent
```

Each phase, agent thread and turn should be independently collapsible.

### Message types

Use visually distinct cards:

- **User instruction**
- **AI response**
- **Question**
- **Answer**
- **Tool call**
- **Tool result**
- **Terminal command**
- **File changed**
- **Diff**
- **Approval request**
- **Warning or error**
- **Compaction checkpoint**
- **Model/provider switch**
- **Phase summary**

Tool calls and repetitive terminal output should be collapsed by default. User messages, AI conclusions, questions and errors should remain expanded.

### Search

Conversation search should support:

- Full-text search
- Highlighting all matches
- Match count
- Previous/next match
- Filter by provider
- Filter by model
- Filter by phase
- Filter by agent
- Filter by message type
- Filter by file path
- Search only commands, errors or questions
- Deep links to a specific event

For long Deliveries, use a virtualized message list so the browser does not render thousands of messages simultaneously.

### Additional high-value features

Add:

- Bookmark message
- Pin to permanent context
- Copy deep link
- “Convert to question”
- “Convert to decision”
- “Include in next handoff”
- “Exclude from AI context”
- Expand surrounding conversation
- Show which compacted summary contains this message

---

# 2. Questions and Answers section

This should not merely be a filtered copy of chat messages. Questions should be first-class Delivery records.

## Suggested Q&A structure

Each question contains:

```text
Question
Status: Open | Answered | Superseded | Dismissed
Impact: Blocking | Important | Informational
Asked by: PM | BA | Developer | Security | User
Phase: Discovery
Assigned to: Elio
Question text
Why it matters
Suggested options
Recommended option
Answer
Answered by
Answered at
Source conversation
Affected requirements/files
```

## UI behaviour

The Delivery page should have a visible badge such as:

```text
Questions: 3 open · 1 blocking
```

Tabs could include:

- Open
- Blocking
- Answered
- All

When you answer a question:

1. Store the answer permanently.
2. Add it to the Decision/Requirement Ledger when relevant.
3. Inject it into every future agent that needs it.
4. Mark any affected phase as ready to resume.
5. Preserve previous answer versions if the answer changes.

I would also add a separate **Decisions** tab. Questions are temporary uncertainties; decisions are durable project truth.

---

# 3. Selecting model and effort before Delivery

This should be available in the launch wizard.

## Basic mode

```text
Provider: Auto / Claude / Codex
Model: Recommended / specific model
Effort: Low / Medium / High / Maximum
```

## Advanced mode

Allow configuration by phase:

| Phase         | Provider | Model       | Effort |
| ------------- | -------- | ----------- | ------ |
| Discovery     | Claude   | Recommended | High   |
| Specification | Claude   | Recommended | High   |
| Planning      | Codex    | Recommended | High   |
| Building      | Codex    | Recommended | Medium |
| Validation    | Codex    | Recommended | High   |
| Review        | Claude   | Recommended | High   |

Also support specialist defaults:

```text
Security specialist: High
Database specialist: Medium
UX specialist: Medium
Routine formatter: Low
Final reviewer: Maximum
```

Your provider driver should publish a **capability manifest** so the UI only presents valid choices:

```ts
{
  provider: "claude",
  models: [...],
  effortLevels: [...],
  supportsResume: true,
  supportsMidSessionModelChange: true,
  supportsFork: true,
  supportsCompaction: true
}
```

This avoids hard-coding Claude or Codex behaviour into the dashboard.

---

# 4. Timeline redesign

You are correct that raw messages such as “agent initialized” or “processing response” provide little PM value.

## Make the main timeline phase-oriented

Each phase card should show:

```text
DISCOVERY                                      COMPLETE
Claude · Model X · High effort
Started 09:14 · Completed 09:27 · 13 minutes

Outcome
• Existing system mapped
• 4 constraints identified
• 2 questions answered

Artifacts
• discovery.md
• system-map.json

Usage
• 42K input · 8K output
• 71% cached input
• Estimated cost: …

Changes
• No repository modifications

Next gate
Specification approved
```

## Important timeline markers

Show only meaningful events at the main level:

- Phase started/completed
- Question raised/answered
- Approval requested/granted
- Model changed
- Effort changed
- Provider changed
- Conversation compacted
- Git checkpoint created
- Files modified
- Tests completed
- Validation failed
- Delivery blocked/unblocked
- Phase retried
- Human intervention

Everything else belongs under an expandable **Technical Activity** section.

## Status colours

Use:

- Complete: green
- Active: blue
- Waiting for user: amber
- Blocked: red
- Failed: dark red
- Cancelled: grey
- Needs decision: orange

Do not rely on colour alone. Include an icon and visible status label for accessibility.

---

# 5. Switching model or effort mid-session

This is possible, but it should happen at a **safe execution boundary**.

Claude’s Agent SDK currently supports changing the model and effort level on a running session, with the new settings taking effect on the next turn. ([Claude Platform Docs][1])

Codex supports continuing and resuming threads, while its app-server can resume a thread with model or reasoning-effort overrides instead of using the thread’s previous configuration. ([OpenAI Developers][2])

## Safe switch flow

```text
Running
   ↓
Pause requested
   ↓
Current tool call finishes or is cancelled
   ↓
Checkpoint stored
   ↓
Model/effort changed
   ↓
Configuration-change event recorded
   ↓
Next turn resumes
```

Do not attempt to replace the model while it is actively generating tokens or halfway through a destructive tool call.

Support three options:

### Continue

Change the model and continue the existing logical thread.

### Fork

Preserve the current path and start an alternative branch from the checkpoint.

### Restart phase

Create a fresh phase attempt with the same accepted requirements and project state.

The conversation should visibly show:

```text
Configuration changed
Claude Sonnet / Medium
        ↓
Claude Opus / High
Reason: Discovery revealed architectural complexity
```

---

# 6. Switching Claude to Codex mid-Delivery

This is feasible, but the terminology matters.

## What does not transfer

Claude’s native session ID, internal state and prompt cache cannot be consumed directly by Codex. Likewise, a Codex thread cannot be resumed natively by Claude.

Both platforms provide their own session-resume and prompt-caching mechanisms, based on their own threads and repeated prompt prefixes. ([Claude Platform Docs][3])

Therefore, there is no universal provider cache that moves from Claude to Codex. That conclusion follows from the providers exposing separate session and caching systems.

## What can transfer

Your system can transfer everything that matters:

- Original user objective
- Accepted specification
- Current plan
- Decisions
- Questions and answers
- Current phase
- Completed work
- Remaining tasks
- Raw conversation references
- Compacted conversation
- Relevant recent messages
- Files changed
- Git commit/worktree state
- Diffs
- Commands executed
- Test results
- Errors encountered
- Rejected approaches
- Permissions and constraints
- Expected next action

This becomes a **Provider Handoff Package**.

```text
Claude session
      ↓
Checkpoint and handoff package
      ↓
New Codex thread
      ↓
Codex verifies workspace and context
      ↓
Execution continues
```

The new provider is not literally continuing the old provider’s native memory. It is continuing the **same Delivery state**.

That distinction makes your architecture reliable rather than dependent on undocumented provider behaviour.

---

# 7. Is your Delivery-centric approach exceptional?

It is genuinely strong, but I would not describe every element as never seen before.

Codex already presents itself as a command center for multiple agent threads, supports continuing project work and preserves session history across its surfaces. Claude similarly provides resumable and searchable coding sessions. ([OpenAI][4])

What is particularly valuable in your approach is the **combination**:

- Work organized by business Deliverable rather than chat title
- PM workflow states and gates
- Claude and Codex under one orchestration layer
- Structured questions and decisions
- Raw audit history
- Portable compacted context
- Provider switching
- Phase-specific model allocation
- Git and artifact state attached to the same Delivery
- Cost, caching and context controls
- Ability to resume months later without searching terminal histories

That is no longer merely an AI chat interface.

It is closer to a:

> **Provider-neutral AI Delivery Operating System**

The main intellectual asset is not “saving chats.” It is **separating durable Delivery memory from temporary model execution state**.

---

# 8. Compacting conversations

This is crucial and should be implemented before Deliveries become very long.

Claude Code itself uses auto-compaction when context approaches its limit, and Anthropic acknowledges that compaction can lose important details. ([Claude Platform Docs][5])

Your implementation can be considerably safer because you control the raw history.

## Store three representations

### 1. Immutable raw event log

The authoritative record:

- Every prompt
- Every response
- Every tool call
- Every result
- Every question and answer
- Every configuration change
- Every artifact
- Every error

Never modify or replace these records.

### 2. Structured Delivery memory

Not generated from prose alone:

- Requirements ledger
- Decision ledger
- Constraints
- Open questions
- Completed tasks
- Current plan
- File and symbol index
- Test results
- Known risks
- Rejected approaches
- Current Git state

### 3. Versioned compacted conversation

A compact narrative generated from the raw event log.

Each compacted item should reference its evidence:

```text
Decision:
Use one orchestrator with inline capabilities.

Reason:
Specialist agents should remain read-only and single-turn.

Evidence:
event_1842, event_1857, answer_92
```

## What the AI should receive

Do not send only one large summary. Build the context from layers:

```text
1. Stable system and repository instructions
2. Delivery objective
3. Accepted specification
4. Current plan and phase
5. Decisions and constraints
6. Unresolved questions
7. Current compacted phase history
8. Relevant retrieved historical events
9. Recent uncompacted message tail
10. Workspace/Git delta
11. Immediate next action
```

This produces better continuity than either:

- Sending the entire raw transcript forever, or
- Trusting a single summary that may have omitted something.

## Rehydration

Add a user action:

```text
Restore omitted context
```

The user or AI could select a compacted statement and inspect:

- Original messages
- Commands
- Tool results
- Files
- Related decisions

You can then pin selected raw events into the next context assembly.

## Compaction triggers

Compact when:

- A phase completes
- Context crosses a configurable threshold
- The user switches providers
- A session has been inactive for a long period
- A fork is created
- The user explicitly requests it
- Tool output becomes disproportionately large

Keep the latest few conversation turns uncompacted because recent interaction often contains subtle intent.

---

# 9. Smart caching and context reuse

You need a **Context Policy Engine**, not a simple `useCache=true` flag.

Prompt caches work best when the beginning of successive requests remains identical. Both OpenAI and Anthropic document prefix-based caching, meaning changing earlier content can invalidate subsequent cached content. ([Claude Platform][6])

## The five layers must remain separate

| Layer                      | Portable between providers? |                     Durable? |
| -------------------------- | --------------------------: | ---------------------------: |
| Raw Delivery transcript    |                         Yes |                          Yes |
| Structured Delivery state  |                         Yes |                          Yes |
| Compacted context snapshot |                         Yes |                          Yes |
| Provider thread/session    |                          No |           Provider-dependent |
| Provider prompt cache      |                          No | Temporary/provider-dependent |

## Decision policy

Before each turn, evaluate:

```text
Is the provider unchanged?
Is the native session healthy?
Has the model configuration changed?
Has the system/tool configuration changed?
Has the repository changed outside Delivery?
Is the current phase still the same?
Is the existing context below its threshold?
Is the old context still relevant?
Would retrieval be cheaper than replaying everything?
```

Then select one of these strategies:

### Resume native session

Use when provider, phase and workspace remain compatible.

### Resume with model override

Use when staying with the same provider but changing model or effort.

### Compact and resume

Use when continuity is useful but the transcript is becoming too large.

### Fork from checkpoint

Use when exploring another solution without damaging the original path.

### New provider handoff

Use when moving Claude ↔ Codex.

### Rebuild context

Use when the provider session is missing, invalid or too stale.

### Retrieval-assisted continuation

Use compacted context plus only historically relevant raw events.

## Cache visibility

Expose these statistics:

```text
Context supplied: 54,200 tokens
Cached input: 39,800
New input: 14,400
Compacted away: 93,000
Retrieved from history: 7 events
Provider session reused: Yes
Context snapshot: v12
```

Also add a **Context Inspector** that shows exactly what will be given to the AI before resuming. This will be invaluable when investigating why an agent forgot something.

---

# Recommended architecture

```text
Delivery
 ├─ Delivery phases
 ├─ Phase attempts
 ├─ Provider sessions
 ├─ Conversation turns
 ├─ Normalized events
 ├─ Questions and answers
 ├─ Decisions
 ├─ Artifacts
 ├─ Configuration changes
 ├─ Context snapshots
 ├─ Compaction versions
 ├─ Handoff packages
 ├─ Git checkpoints
 └─ Usage and cache metrics
```

## Core records

| Entity              | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `delivery_runs`     | One complete execution or retry                   |
| `phase_runs`        | Execution of Discovery, Plan, Build, etc.         |
| `provider_sessions` | Claude/Codex native session identifiers           |
| `turns`             | User-to-agent execution units                     |
| `events`            | Normalized provider output and tool activity      |
| `questions`         | Structured questions                              |
| `answers`           | Versioned answers                                 |
| `decisions`         | Durable accepted decisions                        |
| `context_snapshots` | What an AI was given at a checkpoint              |
| `compactions`       | Versioned summaries with source references        |
| `handoffs`          | Context transferred between providers             |
| `config_changes`    | Provider/model/effort transitions                 |
| `artifacts`         | Specifications, plans, reports, diffs and results |

---

# Advanced enhancements worth adding

## Context debugger

Show:

- Why each context item was included
- What was omitted
- Token size per section
- Source event
- Last verified date
- Whether it is raw, structured or summarized

## Branching and comparison

From any checkpoint:

```text
Try with Claude
Try with Codex
Try with higher effort
Try alternative architecture
```

Then compare:

- Result
- Files changed
- Tests
- Cost
- Duration
- Review score
- Risk findings

## Cross-provider review

A strong workflow would be:

```text
Claude performs discovery/specification
Codex implements
Claude reviews business alignment
Codex fixes technical findings
Independent validator runs acceptance
```

No single provider should be trusted to review all of its own assumptions.

## Delivery replay

Allow a historical Delivery to be reconstructed:

- Configuration used
- Context received
- Commands executed
- Files before/after
- Approval decisions
- Provider transitions

## Context pinning

Let you permanently pin statements such as:

```text
Never create Used_On_Opportunity__c.
Do not introduce triggers.
The web app remains first-class.
```

Pinned context should survive compaction and provider switching.

## Context health score

Show warnings such as:

```text
Healthy
2 unresolved contradictions
1 stale architectural assumption
Context grew 38% since last compaction
Repository changed outside this Delivery
Handoff verification recommended
```

## Automatic phase handoff verification

When a new provider starts:

1. Read the handoff.
2. Inspect relevant workspace state.
3. Restate its understanding.
4. Detect conflicts.
5. Continue only when no blocking inconsistency exists.

This can be automated without requiring your approval unless a material contradiction is found.

---

# Recommended implementation order

## Delivery UX upgrade

Implement:

- Conversation viewer
- Search and highlighting
- Q&A section
- Model/effort selection
- Improved phase timeline
- Blocked status in red

## Execution control

Implement:

- Pause/resume
- Safe model and effort switching
- Configuration audit events
- Phase retry and fork

## Provider portability

Implement:

- Provider-neutral event schema
- Claude ↔ Codex handoff packages
- Workspace verification
- Provider-session mapping

## Context intelligence

Implement:

- Immutable raw transcript
- Structured memory ledgers
- Versioned compaction
- Recent raw tail
- Retrieval from old events
- Context inspector

## Optimization

Implement:

- Smart resume/rebuild policy
- Cache analytics
- Context health
- Cross-provider comparisons
- Automated cost and quality routing

Your strongest defensible feature is not caching alone. It is:

> **A Delivery can retain its identity, history, decisions, artifacts and execution state even when every underlying AI session, model and provider is replaced.**

That is the architecture I would use as the foundation for the next Delivery milestone.

[1]: https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-typescript?utm_source=chatgpt.com "Agent SDK reference - TypeScript - Claude Code Docs"
[2]: https://developers.openai.com/codex/codex-sdk?utm_source=chatgpt.com "Codex SDK | ChatGPT Learn"
[3]: https://docs.anthropic.com/en/docs/claude-code/sdk?utm_source=chatgpt.com "Agent SDK overview - Claude Code Docs"
[4]: https://openai.com/index/introducing-the-codex-app/?utm_source=chatgpt.com "Introducing the Codex app"
[5]: https://docs.anthropic.com/en/docs/claude-code/costs?utm_source=chatgpt.com "Manage costs effectively - Claude Code Docs"
[6]: https://platform.claude.com/docs/en/build-with-claude/prompt-caching?utm_source=chatgpt.com "Prompt caching - Claude Platform Docs"
