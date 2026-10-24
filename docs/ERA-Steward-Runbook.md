# ERA Steward runbook — "Run delivery for item <ID>"

**Owner direction (2026-10-20):** readiness and setup are checked and fixed on the PM Command Center side. ERA Steward does one thing: press Start for the item it is given and report the result. Background: [ERA Steward setup summary](ERA-Steward-Setup-Summary.md). Tracked as [DLV-139](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-139>).

## Owner — before handing an item to Steward

1. `pnpm pm --bridge` is running in one terminal.
2. Open `http://127.0.0.1:4317/#/deliver/<ID>` (for example `#/deliver/R44`).
3. Press **Check readiness**. Each Readiness chip is ✓, or 🕒 (rechecked automatically at Start).
4. Fix anything listed under the chips, then check again. Common fixes:
   - **Start Docker Desktop**
   - **Sign in again** — the line shows the exact action (for example, run `codex` once)
   - **Policy expired — renew it**
   - **Record your test result** (after an Apply)
   - **Add Touches to the item**
   - **package.json or lockfile changed** — undo the change, or re-stage the environment (DLV-133)

   Uncommitted files do not block a launch by themselves. Avoid saving code changes while Start runs; if files change mid-check, Start says so and can be pressed again.
5. Tell Steward: **"Run delivery for item <ID>"**.

## Steward — "Run delivery for item <ID>"

1. Open `http://127.0.0.1:4317/#/deliver/<ID>?initiator=era-steward` in the paired Command Center browser (or select **Steward** on the launch screen).
2. Keep the preselected executor, lane, model and effort unless the owner named different ones.
3. Press **Start** once. Wait on the page. Start runs the Docker, sign-in and model checks itself (about 1–2 minutes), so its evidence cannot expire before it is used.
4. When the run page opens, reply with its link. You are done.

**If Start does not open a run:** reply with the lines shown under Readiness, word for word, then stop. The owner fixes them on the PM side. If the owner asks you to try again after fixing, press Start again.

**If the page shows a receipt (Acknowledged or Outcome unknown):** press its **Check** button, which re-sends the same request. Never start a second launch for the item.

**If the page asks to pair this browser:** tell the owner and stop.

## Request status (DLV-140)

The Steward entry sends `initiatedBy: era-steward` through the existing Start transport. The local supervisor commits a receipt with the authenticated actor and the original command UUID before checking mode, executor or readiness. Delivery, the launch screen and the run page share these request cards on desktop and `/pm/live`. Ordinary Start is not attributed to Steward.

In Steward mode, Start can record a request even when readiness, executor setup or the test gate is blocked. The same server admission checks still refuse the run; the difference is a durable, visible blocker before a run exists.

The card shows **Initiated by ERA Steward**, request/launch UUID, accepted and coordination-start timestamps, stage, last confirmed coordination update, job state, known blocker, run link and retained evidence. This records use of the Steward entry; it does not authenticate an external chat agent or infer its activity. The actual authenticated actor remains in Evidence.

**Status unconfirmed** concerns coordinator liveness only. Each device derives it from `lastConfirmedAt`, even while showing cached/offline relay data. The default interval is 180,000 ms; `PM_STEWARD_STALE_MS` configures the service value (integer 1,000–86,400,000 ms; invalid values use the default). Passive reads and polling do not refresh that timestamp. The displayed job state and terminal result remain authoritative and separate. Silence never marks a job failed or triggers a retry.

A repeated UUID returns its recorded outcome or remains unconfirmed. A second UUID for the same pending/open Steward work is refused with the original UUID. An interrupted prelaunch request with no proven outcome keeps its claim: use the same saved request and status check; do not mint another launch. Owner investigation is required if no command outcome can be recovered. After a confirmed refusal the existing DLV-138 correction flow may create a new explicit request. The newest 100 requests are published; older receipts remain in the supervisor store. No automatic cleanup, retry or expiry action runs.

**Never:** run terminal or Docker commands; restart or start `pnpm pm`; press Check readiness repeatedly; diagnose failures; write readiness reports; approve plans; press Apply. Plan approval and Apply stay with the owner, on the phone or laptop.
