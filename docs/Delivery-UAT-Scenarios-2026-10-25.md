# Delivery UAT — start here

Prepared for Elio on 25 October 2026. Scope confirmed by the owner: **existing delivery attempts and completed items awaiting UAT**. Unbuilt backlog features are not being given fictional current-build instructions.

## Choose what to test

| You want to test… | Open this wizard |
|---|---|
| An existing Delivery V2 attempt, including KIT-11, BUD-83 and R44; recent Delivery/Steward changes and PM navigation/Drive | [Current delivery attempts](Delivery-UAT-Current-Attempts-2026-10-25.md) |
| An older V1 attempt, its completion record or its cancelled/untestable disposition | [Legacy delivery attempts](Delivery-UAT-Legacy-Attempts-2026-10-25.md) |
| PM review screens, plans, checks, Apply/rollback, phone recovery, Work, Analytics or Sprints | [PM and Delivery walkthroughs](Delivery-UAT-PM-Review-2026-10-25.md) |
| Schedule/reminder changes marked implemented but awaiting owner testing | [Schedule walkthroughs](Delivery-UAT-Schedule-2026-10-25.md) |
| ERA composer, native capture, conversation, proposals, history, recovery or related completed Hub changes | [Hub and ERA walkthroughs](Delivery-UAT-Hub-2026-10-25.md) |
| Completed Budget, Kitchen, Healthcare, Trips, Notifications or Outfits slices whose acceptance is held in a larger owner gate | [Product follow-ups](Delivery-UAT-Product-Followups-2026-10-25.md) |

Each file tells you where to start, the records/build you need, numbered actions, what should appear and how to restore any test data. Missing build/setup is **Blocked**, not a feature failure. New manual results are **Pending**; previous owner decisions remain in their original evidence records.

## How to use a scenario

1. Open the relevant wizard above and choose its scenario ID.
2. Read **Setup/Prerequisites** first. Confirm the named candidate or source revision is present in the test environment. A local Apply receipt does not establish that the phone or hosted app serves it.
3. Follow each numbered action, comparing the visible result before moving on.
4. If the actual result differs, note the first failing step and what appeared. If you cannot reach the step because a prerequisite is missing, record **Blocked** and the missing prerequisite.
5. Complete the cleanup instructions. Keep any evidence needed to explain a failure before removing isolated test data.
6. Send or record the result using the form below. A separate result is needed for another build/device; a narrow laptop window is not a physical-phone pass.

```text
Scenario / item:
Run or direct-delivery reference:
Tested build / environment:
Device / browser:
Tester / date:
Result: PASS / FAIL / BLOCKED
Step:
Expected:
Observed:
Feedback / screenshot link:
Cleanup completed or remaining:
```

**Find these in PM Command Center → Delivery → Review & sign off** (R81). Enter a work number in **Work ID or title**, then select **View steps**, **Start test** or **Continue**. **Not ready** holds draft/incomplete instructions; **To test** holds current ready handovers; **Feedback**, **History** and **All** keep the remaining records reachable. Search, filter and pagination survive returning from the wizard. The local drafts were refreshed on 25 October: all 64 handovers now have valid step/expected-result pairs, including R80/R81; none has been marked ready or signed off. A draft is readable but results/sign-off require a verified matching delivered build. **Mark ready** binds the run candidate or current checkout; it must follow build verification, not merely make the button available. Another installation can load these documents with `pnpm pm:uat import-docs --apply`. See the [UAT wizard, sign-off and feedback specification](<../ERA Notes/10 - Project Management/Plans/Delivery UAT Sign-off and Feedback.md>).

## Coverage and evidence boundary

The local retained runtime inventory on 25 October contains **24 entries**: **8 V2 runs** and **16 V1 session directories**. One V1 directory is a synthetic acceptance fixture; it is explicitly identified rather than counted as an owner-delivered feature. Every retained entry has an individual row in the current/legacy inventory, including repeats, cancelled attempts and unavailable candidates.

The V2 snapshot contains five closed verified-candidate attempts and three cancelled attempts. Availability is separate: two runs have a final Applied application, one historical run has rollback/conflict history, and two verified candidates have no application. V1 contains one historically SHIPPED session and fifteen CANCELLED entries, including the synthetic fixture. These are existing runtime states, **not new UAT verdicts**.

The initial campaign backfill covered all **40 explicit `Implementation: done` + `UAT: pending` sections** then found in the eleven active Master Books: Delivery, PM Tooling, Hub & ERA and Schedule contain these declarations. Each has an item-level link to concrete steps or a clear disposition. The remaining campaigns were checked for prose-only acceptance/deployment gates and are covered in Product follow-ups where a completed slice is identifiable. Partial broader work (including HUB-105/HUB-107) stays partial; deferred, replaced and cancelled owner checks keep their dispositions. These documents are a coverage receipt and test content, not another backlog.

**Subsequent repair:** [PM-M14 / R80](Delivery-UAT-PM-Review-2026-10-25.md#pm-m14--restore-delivery-identity-navigation-and-browser-access) adds the owner walkthrough for restored delivery IDs, secondary navigation and browser pairing. Its implementation evidence and new Pending UAT result are recorded separately in the PM Tooling book.

**Discovery repair:** [PM-M15 / R81](Delivery-UAT-PM-Review-2026-10-25.md#pm-m15--find-test-steps-and-return-to-the-review-list) exposes UAT at the top of Delivery. Twenty existing steps gained explicit expected-result wording; the importer now recognizes lowercase expectation markers after a sentence or semicolon. A guarded refresh updated 13 incomplete handovers and added the R80/R81 walkthroughs, preserving the other 49 unchanged. All remain Draft with Pending results and no sign-off; this later local draft refresh is separate from the original documentation-only evidence below.

**Evidence cutoff:** HEAD `735d3881` plus the pre-existing working tree, campaign evidence and current source read during this drafting session. V2 inventory used SQLite `mode=ro`; V1 used retained session files. No runtime store or historical receipt was rewritten. Scenario files identify source label drift and candidate/build gaps rather than guessing them away. No owner test, production mutation, provider call, deployment, policy change, Apply or sign-off was performed during drafting.

**Documentation validation (2026-10-25):** eight new documents, 212 file/heading links checked with zero errors; independent coverage review confirmed the 40 declared pending items and all 24 retained entries. `pnpm pm:lint`, `pnpm pm:check-docs`, `pnpm docs:check` and scoped `git diff --check` pass. Archive found nothing to sweep; `pnpm pm:dashboard` rebuilt the local view without publishing. Fifteen older Delivery evidence links were corrected after verifying their actual targets. No application test suite or manual UAT was run for this documentation-only change.

## Historical instructions

[Delivery UAT](Delivery-UAT.md) retains earlier observations, operational trials and owner decisions. Follow this new index for current wording; do not replay historical installation, policy, launch or dependency-preparation instructions simply because they appear in an old UAT row. Earlier PASS results remain attached to their original build and device.
