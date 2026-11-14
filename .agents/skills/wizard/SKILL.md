---
name: wizard
description: "Runs interleaved AI/owner setup, install, or debug sessions as a shared step-by-step MD checklist: splits steps into AI-executed vs owner-executed, gives each an exact verification command + expected output, and only advances once the owner's pasted output confirms a step. Trigger: '/wizard', 'walk me through setting up X', any multi-step external-system config (SDK installs, cloud console setup, hardware/mic setup, env var provisioning) where some steps need hands the AI doesn't have. NOT for tasks the AI can finish end-to-end in-repo (route to start-task instead) or single-command instructions."
---

# /wizard — Interleaved Setup & Debug Sessions

> **Contract:** before executing a single step, write the full step plan to a durable MD file — the file, not chat scrollback, is the source of truth for what's done. No step is ever marked verified without the owner's literal, observed command output matching that step's stated acceptance criteria. The AI never performs a step it flagged owner-only, even if it technically could — see Known failure modes.

## Step 1 — Scope it, then split ownership per step

State the usual block first: `GOAL` / `DONE WHEN` / `OUT OF SCOPE` (same shape as `start-task`). Then, for every step in your plan, decide ownership:

| Question | Yes | No |
|---|---|---|
| Can I do this with tools I already have, entirely inside this sandbox, with no login/GUI click-through/physical action, and can I observe the real result myself? | **`[AI]`** — I run it | **`[OWNER]`** — I hand them the exact command + expected output |

Owner-only cases: account/console signup, OAuth click-through, installing software on their OS outside this repo, plugging in hardware, restarting a terminal/service, anything whose real-world effect the AI cannot itself observe.

## Step 2 — Create the wizard file BEFORE doing anything else

Path: `ERA Notes/08 - Sessions/Wizards/<slug>-YYYY-MM-DD.md` (create the folder if missing — `08 - Sessions/` is gitignored in full, personal and local, matching the existing session-notes convention; nothing here is committed). Template:

```markdown
---
title: <task>
started: YYYY-MM-DD
status: in-progress
---
# Wizard: <task>
**Goal:** <one sentence>  **Done when:** <observable outcome>

## Step 1 — <title> [OWNER|AI]
<instructions>
**Verify:** `<exact command>`
**Expected:** <what a pass looks like>
**Result:** _(pending)_
**Status:** ⬜
```

List every step you already know, in dependency order, even if a later step is genuinely provisional (`exact command TBD after step 3's output`). Never let the plan live only in chat — if the session gets compacted, the file is what survives.

## Step 3 — Execution loop

- **`[AI]` steps:** run now with your own tools, write the real output into **Result**, self-check it against **Expected**, mark ✅/❌, continue automatically to the next step.
- **`[OWNER]` steps:** post the instructions + command in chat, then STOP and wait. When the owner pastes output (in chat, or "done, check the file"), write their literal output into **Result**, compare to **Expected**, mark ✅/❌ — never assume a pass because the owner said "done".
- **On ❌:** do not advance past it. Explain what the output actually shows, give a corrected command, re-verify the same step.
- **Batch same-owner steps** that are adjacent in the sequence into one message rather than pinging step-by-step for things they can do together in one sitting.
- Flip the file's `status` (`in-progress` → `done`/`abandoned`) when the session concludes.

## Known failure modes

| Symptom | Cause | Guard |
|---|---|---|
| Step marked ✅ but the feature still doesn't work | AI inferred success instead of reading real output | Never write ✅ without literal output pasted/observed this turn |
| AI runs an install/config command flagged `[OWNER]` "to save a round trip" | The command changes the owner's machine/account outside the sandbox, or needs credentials the AI doesn't have | Re-check the Step 1 table before running anything — sandbox-executable ≠ owner-appropriate |
| Plan is gone after a context reset | Plan only existed in chat, which got compacted | The MD file is Step 2, before any other action, every single time |
| AI skips a step whose effect it "assumes" happened (restart terminal, replug hardware) | Effect is unobservable from inside the sandbox | Keep it `[OWNER]` even when the command itself is copy-pasteable by the AI |

## Worked example (installing a wake-word SDK)

1. `[OWNER]` Create a vendor console account and copy the access key. **Verify:** paste the key's first 6 chars in chat. **Expected:** non-empty string in the vendor's key format.
2. `[AI]` Add the key to `.env.local` under its documented var name (never echo the full value back). **Verify:** grep the file for the var name only. **Expected:** name present, value not printed.
3. `[OWNER]` Run the vendor's local test binary. **Verify:** `<vendor test command>`. **Expected:** a specific success string — paste the terminal output into chat.
4. `[AI]` Wire the event into the app's hook and typecheck. **Verify:** `pnpm typecheck`. **Expected:** clean, no errors.

## Checklist before leaving

- [ ] Wizard MD file exists in `ERA Notes/08 - Sessions/Wizards/`, created before step 1 was executed
- [ ] Every step tagged `[OWNER]`/`[AI]` with an exact verification command + expected output
- [ ] No step marked ✅ without literal, this-session output matching its Expected line
- [ ] No `[OWNER]` step was executed by the AI itself
- [ ] File's `status` updated at session end
- [ ] If the wizard touched `src/` or `migrations/`, close with `finish-task`; otherwise state explicitly "pure setup/tooling, no PM-trackable story"
