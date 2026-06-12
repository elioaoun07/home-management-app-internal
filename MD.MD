All docs are in place. Final verification — mirror sync state and the complete file tree:

Ran 1 shell command

Everything is done and verified — docs:check passes, all three AI mirrors are regenerated from current CLAUDE.md, and the 28-test suite is green. Here's the full picture:

What I found (the audit)

Your setup had been silently broken for 10 days. A June 6–8 edit accidentally deleted the Focus row from CLAUDE.md's Feature Index, which made docs:check fail — and since the mirror-sync hook dies silently on that failure, AGENTS.md/CODEX.md/copilot-instructions.md had been frozen at May 30. Worse, two commits landed during that window even though pre-commit should have blocked them, meaning pre-commit isn't actually gating your commits (bypassed or not firing — worth a test commit to confirm).

Other significant discoveries:

- Three Feature Index paths were fictional: Hub Chat pointed at src/app/hub/ (real: src/app/chat/), Items/Reminders at src/app/items/ (real: src/app/reminders/), Inventory at src/app/inventory/ (real: it mounts inside Catalogue). All fixed.
- No migration files are retained — migrations/ has only schema.sql, so the RPC bodies (activate_trip, complete_trip, get_schedule_bundle) exist only in the live DB with no version control. CLAUDE.md even cites a migration file that no longer exists.
- Your PM docs were behind reality: balance-utils, recurring next-due, and schedule expansion tests all exist and pass, but the Budget/Schedule PM files still said "untested." Updated per Hard Rule #25.
- settings.local.json allowlists Bash(Remove-Item \*)deletes. I left it but flagged it as the #3 ranked
