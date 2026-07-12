# 5 — Dashboard UX, UAT & Recovery

**Stamped:** 2026-07-11 · **Revised:** 2026-07-12 · Covers plan sections: dashboard page & interaction design (3), New Delivery Session flow & Agent Catalog, failure recovery & session resumption (14), UAT artifact structure (15), observability & token-usage reporting (16)

## 1 · Integration into client.js (exact anchors in doc 1 §2)

| Change | Anchor | Addition |
|---|---|---|
| Route types | `currentRoute` (1437) | `{type:"delivery"}` and `{type:"delivery-session", id}` |
| Nav setters | after `goBugs` (1468) | `goDelivery()`, `goDeliverySession(id)` — same shape (set route, `persistRoute()`, render, `highlightActive()`) |
| Dispatch | `renderCurrent()` (3384–3401) | two branches; guard: `MODE!=="server"` or unknown id → `goHome()` (covers the static twin and stale localStorage routes) |
| Quicklink | `buildTreeHTML()` (1087–1116) | `CAN_EDIT`-gated "Delivery" link + one `ICON_PATHS` entry |
| Wiring | `wireTreeEvents()` (1280–1373) | one more `[data-route="delivery"]` block |
| SSE | `subscribeSSE()` (3411) | `es.addEventListener("delivery", …)` → refetch session data when a delivery route is active (150 ms debounce) |
| Launch affordance | task rows in `renderChecklistRollup` (2628) + `renderFile` (2347) | server-mode-only "Deliver" button per open task (`data-file`/`data-cbidx`/`data-text`) — a shortcut that opens the New Delivery Session flow (§2) with topic + item preselected |

**Static-mode degradation:** no quicklink, no Deliver buttons, no embedded delivery data in `PM_DATA`; persisted delivery routes reroute to home. `build-pm-dashboard.mjs` untouched.

## 2 · Screens

**New Delivery Session flow** (primary entry point, on the `delivery` route — the task-row Deliver button is a *shortcut into this same flow*, never the only path):

1. **Select topic/campaign** — the campaign folders (Budget, Schedule, Kitchen, Trips, Hub & ERA, Notifications & Alerts).
2. **Select an open current work item** from that topic — checklist items filtered per the selectability rules below.
3. **Preview the item and its source** — line text, id/severity/effort, heading context, source file excerpt (existing preview panel).
4. **Select the provider** — Codex or Claude Code.
5. **Classifier minimum capability set** — computed client-side from the injected registry + classifier (doc 2 §5), rendered from the Agent Catalog metadata; always-on rows visibly locked.
6. **Optional capabilities only are removable** — locked rows have no remove affordance; the server independently rejects locked-row drops.
7. **Risk flags & warnings** — item-derived risk flags, dirty-working-tree warning (explicit confirm), build-lock banner when active.
8. **Launch** → `POST /api/delivery/start`.

The **Deliver button** on a task row (checklist rollup + file view) opens this flow with topic and item preselected at step 3.

**Work-item selectability rules:**

| Item condition | Treatment |
|---|---|
| Open checkbox `[ ]` in a campaign checklist | Selectable |
| Completed `[x]` | Not selectable (shown greyed for context) |
| Postponed | Selectable, with a visible "postponed" chip — delivering one is a deliberate owner choice, not blocked |
| Already in an active (non-terminal) delivery session | Not selectable; shows an "in delivery" badge linking to that session |
| Source text changed between preview and launch | Server 409 (textHash drift) → UI refreshes the item and asks the owner to re-confirm |
| Global build lock active | Flow browsable end-to-end, Launch disabled with the lock banner (server 429 as backstop) |

**Agent Catalog** (`delivery` route, "Agents" section): renders `agent-registry.mjs` (doc 3 §4) in full — every registered agent, enabled *and* planned. Per entry: name, capability key, purpose, execution mode (inline / independent / primary / runner-native), activation trigger (always-on / classifier rule), inputs, outputs, blocking vs advisory, read-only vs implementation-capable, supported provider(s), implementation status, and phase availability. Planned agents (S5/S6 specialists) are visibly marked "Planned — not yet available" and have no launch affordance. Because the catalog, the launch preview (step 5), and the session output cards all read the same registry, they can never disagree.

**Sessions list** (`delivery` route): New Delivery Session button, then the list — item (linked to its source-file route), campaign, agent badge, state badge, awaiting-gate flag, updated-at, total tokens, runner-liveness dot (heartbeat < 15 s). Header shows the build-lock status. Row click → detail.

**Session detail** (`delivery-session` route), stacked regions:

1. **Header** — item id + text, campaign, agent, state badge, elapsed, total tokens, changed-files count.
2. **Stepper** — SELECTED→…→SHIPPED pills; BLOCKED / NEEDS_DECISION render as an overlay pill with the reason.
3. **Gate panel** (only when `state.awaiting` is set) — spec/plan/UAT summary rendered inline through the existing md pipeline; Approve / Request-changes-with-note / Cancel; typed `APPROVE` input when risk-flagged; NEEDS_DECISION = question + options + free-text; UAT_READY = summary + artifact links + Accept (with "tick source checkbox" default-on) / Reject-with-note.
4. **Agent outputs** (§4) — one expandable card per agent.
5. **Message composer** (§3) — always visible while the session is non-terminal.
6. **Timeline + artifacts** — left: event feed (`/api/delivery/events?id&after=seq`, live-appended, auto-scroll); right: artifact tree opening in the existing preview panel (md rendered; json/patch/log as code).

## 3 · Message composer (owner ↔ orchestrator, mid-session)

A persistent textarea + Send at the bottom of the session detail page — communication is **not** limited to approval/rejection forms.

- Send → `POST /api/delivery/message {id, text}` → pm-server writes `messages/<seq>.json` (single-writer discipline holds: pm-server writes, runner reads).
- The message is immediately appended to `events.ndjson` semantics via an `owner.message` event (runner logs it on pickup; the UI optimistically shows it in the timeline at once), so **every message is a persisted session event** — nothing lives only in chat.
- **Boundary incorporation:** the runner drains unread messages (seq > `messagesProcessed`) at every workflow boundary — immediately before composing any next agent turn, and between BUILDING plan steps — and injects them into the next prompt under "Owner guidance (mid-session)". A running turn is **never interrupted**.
- Messages are advisory: they never transition state and never substitute for a gate decision. If guidance conflicts with the approved plan, the orchestrator raises NEEDS_DECISION instead of silently diverging.
- UI affordances: "queued — will be read at the next step" indicator until the runner's `owner.message.consumed` event confirms pickup; composer disabled (with explanation) once the session is terminal.

## 4 · Agent output cards (calm, per-agent visibility)

Every agent instance — the **Delivery Orchestrator** plus each activated specialist — gets its own card in the Agent outputs region, labeled from the same registry metadata the Agent Catalog renders (doc 3 §4). Design goal: **visually calm, reduced noise**; the raw event firehose stays in the timeline, cards show curated output only.

- **Collapsed (default):** one muted line — agent name, capability, phase(s) it ran in, status (running spinner / done / `VERDICT`), tokens used. Monochrome; the only color is the verdict chip (PASS green-muted / BLOCK amber — no red per house UI rules).
- **Expanded:** the agent's rendered artifact(s) (spec.md / plan.md / review-*.md / uat summary) through the existing md renderer, plus its final message. No command spam, no reasoning traces — those remain in the timeline for whoever wants them.
- Data source: artifacts + events filtered by the `agent` field every event carries (`orchestrator`, `review:security`, …). Cards appear in activation order; the orchestrator card is always first and open by default on gate states.

## 5 · UAT package (`artifacts/uat/`)

```
uat/
  summary.md              What changed & why; acceptance-criteria table AC → status → evidence pointer;
                          scope touched vs plan; deviations & known limitations
  manual-test-script.md   Numbered steps against the owner's own running `pnpm dev` app (direct edits are
                          already live — zero setup); per AC: action → expected → [ ] pass; targeted
                          regression spots from the classifier's module map
  validation-report.md    + validation.json — verbatim typecheck/lint/test outcomes with timings
  changes.md              Changed-file list with a one-liner per file
  diff.patch              Read-only `git diff` vs the session baseline (full)
  reviews/                Copies of review-*.md with verdicts
  rollback.md             Suggested commands FOR THE OWNER, display-only: exact
                          `git checkout -- <file>` / delete-new-file commands to abandon the
                          change. No code path in the tool executes these — the owner copies
                          and runs them manually, always
  notes.md                HR25 trace (checkbox tick record), follow-ups proposed
```

Screenshots: not in MVP (needs browser automation) — S6 candidate. The dashboard renders `summary.md` inline at the UAT gate and links the rest through the artifact viewer.

## 6 · Observability & token reporting

- Every turn's normalized usage accumulates into `state.json.usage.perPhase[phase]` (+ `total`); specialists tracked under a `review:` prefix.
- Session detail renders the per-phase usage table; the list shows totals; each agent card shows its own tokens.
- Cost column appears **only if** the owner sets `priceIn`/`priceOut` ($/1M tokens) in `.delivery/config.json` — no hardcoded price table to rot.
- `events.ndjson` is the complete audit trace (every agent item, validation run, decision, owner message); `runner.log` catches stray process output; both readable in-dashboard via the artifact endpoint.

## 7 · Failure recovery & resumption

Invariant: `state.json` is the authoritative resume point; `events.ndjson` is audit/UI only (replayed for display and usage recomputation, never required for control flow). Every phase is re-enterable because artifacts are written atomically and state advances only after its artifacts are durable.

| Crash | Detection | Recovery |
|---|---|---|
| pm-server dies | UI dead | Runner continues (detached, own fds). On `pnpm pm` restart: rescan `.delivery/sessions`, re-arm watcher, serve state as-is. Decisions/messages not sent while down were simply never sent — gates just wait |
| Runner dies mid-phase | `runner.json.heartbeatAt` stale (> 15 s) + pid probe | UI Resume → respawn `--resume`: read state.json → driver `resume(ref)` (fallback: fresh thread + artifact paths — artifacts make threads replaceable) → re-enter current phase; analysis phases rerun their turn (artifact overwritten atomically); BUILDING re-entry re-snapshots changed files and continues |
| Agent turn fails | runner catches stream error / turn.failed | 1 automatic retry (same inputs, 30 s backoff); second failure → BLOCKED with excerpt; human Retry re-arms the counter |
| Machine reboot | both of the above | The two paths compose: restart pm-server → stale heartbeats → Resume per session. `.delivery/` is plain disk state |
| Missed decision/message watch event | 2 s poll fallback in gate/boundary loops | `decisionsProcessed` / `messagesProcessed` seq counters make consumption idempotent; stale-gate decisions logged and ignored |
| Owner edits files mid-session | baseline drift detected at next boundary | Surfaced as a warning event + changed-file attribution marked best-effort; validation remains authoritative |
