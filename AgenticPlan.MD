Proceed with **Slice S2 — Server, Runner, and Dashboard** from `6 - Roadmap, Testing & Risks.md`.

Use the full Agentic Delivery Workspace plan folder as the authoritative source. Treat the completed S1 modules as the foundation.

Implement only S2:

- `scripts/delivery/server-routes.mjs`
- `scripts/delivery/run-session.mjs`
- Delivery integration in `scripts/pm-server.mjs`
- Session persistence under `.delivery/`
- Runner spawning, heartbeat, monitoring, recovery, and resume
- Decision and owner-message handling
- Named delivery SSE events
- Global build lock
- Source-drift and active-session validation
- New Delivery Session flow
- Topic and work-item selection
- Work-item preview
- Provider and capability selection UI
- Agent Catalog
- Sessions list
- Session detail page
- Workflow stepper
- Approval and decision panels
- Owner message composer
- Agent-output cards
- Event timeline
- Artifact viewer
- Fake-driver end-to-end flow

Follow all documented constraints:

- Use the S1 central registry, classifier, packet, state machine, events, persistence, prompts, Git wrapper, and fake driver.
- Keep the Agent Catalog, classifier, launch preview, and output cards registry-driven.
- Use the fake driver only.
- Do not add Codex or Claude SDK dependencies.
- Do not implement real provider drivers.
- Do not begin S3, S4, S5, or S6.
- Do not perform any Git-state-changing command, including stash.
- Do not implement Git worktrees, branches, commits, resets, restores, or automatic rollback.
- Revert and rollback instructions must remain display-only.
- Preserve the existing static dashboard behavior.
- Do not modify `src/` or `migrations/`.
- Keep all existing tests green, except any clearly documented pre-existing failure.
- Add the complete S2 unit and integration test coverage defined in the plan.

Before editing, use read-only checks to confirm the current repository state and that no stash or unexpected Git-state change remains from S1.

When complete, report:

1. Files created or modified
2. S2 features completed
3. Tests added
4. Validation commands and results
5. Any pre-existing failures
6. Any deviations from the approved S2 plan
7. Confirmation that no real SDK dependencies or later-slice work were added
