# ERA Steward setup: full history and current documented outcome

**Evidence cutoff:** October 19, 2026, 11:51 p.m. Beirut time. This is a historical summary of the setup and the latest retained pilot record. It does not assert the live Command Center state after that checkpoint.

## What you were trying to set up

You named OpenAI’s Dot **ERA Steward** and wanted it to initiate and oversee work through ERA’s existing PM Command Center. Your intended flow was: choose an authorized delivery item, ask Steward to start it, see the session in the same Command Center on desktop and phone, approve the exact plan revision on your phone, let the existing runner and selected coding executor work, then review the result yourself. Final Apply was to stay under your control.

You wanted to keep `pnpm pm --bridge` and the existing delivery system. You did not want a second orchestrator or parallel coding task. You also said you did not want to spend another day forwarding technical messages between Dot and ChatGPT, approving routine diagnostics, or reviewing Docker mounts and PowerShell quoting. The accepted architecture assigns Steward initiation and oversight while preserving your phone plan approval and final Apply. See [Delivery V2](../ERA%20Notes/10%20-%20Project%20Management/Plans/Delivery%20V2.md) and [PM Relay Setup](../ERA%20Notes/06%20-%20Setup%20%26%20Onboarding/PM%20Relay%20Setup.md).

The proposed small pilot was **R44, “Guard new client mutations against raw fetch.”** It was scoped to a warning-only ESLint rule and a focused fixture for client-side `POST`, `PATCH`, `PUT`, and `DELETE` calls, with no bulk replacements or dependency upgrades. For much of the recovery, R44 did not reach its planning job.

## What you encountered

### Access and environment setup

Docker was initially stopped. After you started it, ordinary PowerShell could reach Docker Desktop’s Linux engine, but the restricted local coding task got `Access is denied` on the Docker named pipe. Those were different execution contexts even though they used the same Windows identity and Docker context. Narrowly approved diagnostics worked; broad Docker permission changes were not needed.

The old Linux dependency volume lacked the required validation tools or had mismatched packages. Windows `node_modules` and the local package cache could not prove a complete, lockfile-matched Linux installation. The isolated installation approach therefore needed pinned Linux packages, a frozen lockfile, restricted registry access, disabled lifecycle scripts, and preservation of the existing checkout and volumes.

The provisioning scripts then hit ordinary setup mistakes: the non-root installer could not write to `/deps`; volume initialization left root-owned contents; nested PowerShell here-strings had quoting errors; and a mount-count assertion was wrong. The permission gate was corrected, but these defects led to more proposal and approval cycles. The root-ownership explanation was supported by the Docker setup but was not directly observed as a confirmed ownership transition.

### Repeatedly incomplete dependency preparation

An installation took **9 minutes 13 seconds** and its next scan failed on dangling links. A later frozen install took **10 minutes 11 seconds** and returned success, but inspection still found missing Linux native package payloads, including the Codex package needed by the worker. The installer’s usual output had not retained enough detail to identify whether the package failed during download, extraction, or import.

A later controlled storage check reproduced `ENOSPC`: required package contents exceeded the existing **2 GiB temporary filesystem**. The store was moved to a separate owned disk volume while the other resource and security limits stayed in place. This finally addressed a concrete storage limit, after earlier work had focused on installer output and package links. See [Delivery recovery evidence](../ERA%20Notes/10%20-%20Project%20Management/Delivery/Delivery%20%E2%80%94%20Master%20Book.md), including the October 17–19 operational records.

### Frozen source and checker failures

Unrelated ERA development repeatedly changed the checkout while delivery inputs were being prepared. You committed that work and an independent snapshot was created so delivery inputs could be frozen without requiring your active checkout to remain clean forever.

The initial compiler snapshot then rejected generated Next declarations and could still allow partial staging. Later, the full compiler snapshot omitted JSX files. After an approved larger checker pass, compilation failed on a missing `InboxView.jsx` and a related TypeScript error. The snapshot collector was corrected to include 35 JSX inputs. A later verifier-only continuation succeeded without reinstalling dependencies.

After the installation tree was complete, Windows hit `ENAMETOOLONG` when verifier arguments were too large. Large inputs were moved through standard input. The full TypeScript program then exceeded the default, 3 GiB, and 3.5 GiB heaps inside the **4 GiB checker**. Three full preparation attempts had been consumed. You approved an **8 GiB checker with a 6 GiB V8 heap**; this passed the memory barrier and exposed the omitted JSX files. After the source correction, another specifically approved verifier pass completed.

### Model version and image assembly

The qualified Linux worker used Codex **0.144.1**, which did not advertise your selected `gpt-6-luna / low`. Your normal Windows CLI and VS Code installation used different versions, and the newer VS Code binary did advertise the selection. The evidence pointed to a worker client-version mismatch; it did not prove that your account lacked access or that inference would succeed.

You approved a specific upgrade to native Codex **0.156.1**, one replacement image, and another preparation within unchanged confinement limits. The first image assembly failed because BuildKit interpreted a local image identifier as a registry reference. That attempt was consumed. The corrected local Docker Engine assembly succeeded; the final preparation, warm reuse, and fresh worker/checker qualification then passed. The worker advertised the exact model and effort, while actual inference entitlement still had not been exercised.

### Readiness and service responsiveness

Passing environment qualification still did not ensure that Start would be available. Readiness inspection read compiler files twice, a service request took **12.303 seconds** against an **8-second** request bound, and multi-stage facts initially shared a timestamp from the beginning of the probe. Evidence could be stale by the time collection finished.

The same synchronous compiler traversal could delay the service’s **3-second** health checks, making a healthy laptop appear Offline. The code was changed to reuse hashes within a trusted walk, preserve each fact’s own observation time, and move compiler inspection to a bounded worker. Twelve concurrent health checks later passed, with a maximum of 125 ms. These fixes improved responsiveness, but later Steward refreshes still encountered intermittent native-check failures.

### Model checks and missing failure details

October 19 native model checks were intermittent. Some metadata-only checks advertised Luna/low and confirmed cleanup; Steward’s own refreshes failed. One reported a native-stage rejection after **21.146 seconds**. A later refresh failed after **45.772 seconds**, without retaining the native version or process-cleanup record.

Two reporting gaps were identified and corrected: native failure details could be lost when related readiness evidence expired, and the outer Docker wrapper could discard failed-process metadata and partial output. The fixes retained sanitized codes, invalid field names, timing, and cleanup signals. A passing diagnostic did not reproduce or explain the earlier failure, so its original cause remains unknown. Metadata probes used zero provider turns; included-usage observations do not establish task-attributed consumption or inference entitlement.

### Approvals, retries, and phone confusion

Each failure exposed a new boundary requiring a decision: a checker memory amendment, a corrected compiler snapshot, the Codex version change, another image assembly, and a time-only renewal after the policy expired during a pause. You had already asked the agents to handle ordinary quoting, assertion, and test defects within approved work rather than return with a new packet for each routine correction.

The bridge also needed repeated reconciliation when more than one local process appeared. Pairing, journals, existing run history, and phone access had to be checked around restarts. Confirming that the phone displayed the previous **Applied KIT-11** run did not prove that R44 was ready or running.

Some phone questions used internal delivery terms without telling you what to look for. You eventually told the agent it kept asking the same question and asked what you should actually do. The phone displayed **“Laptop 0s Ack None Workers Unavailable.”** That confirmed a laptop heartbeat; it did not show worker availability or confirm the KIT-11 history. The recovery record then acknowledged that the phone had not yet been checked for that reload and that repeated prompting should stop.

At points you could not tell whether Steward was doing read-only investigation or whether a delivery was actually running. You asked, “If nothing is running how to run it; if something is running how can I monitor it?” You also had to relay messages because the recovery session could inspect the Command Center but had no direct way to contact ERA Steward. Recovery agents hit an account usage cap during the work as well. These problems made a supervised handoff feel like manual coordination between agents rather than delegation.

## Latest pilot outcome in the retained evidence

The main Delivery Master Book still contained an earlier “no run” status. A newer, more specific artifact recorded the pilot launch and supersedes that earlier snapshot: [R44 plan revision 1 record](../.tmp/delivery-recovery-20261018/continuation/r44-pilot-plan-r1-20261019T2051.json).

| Milestone | Recorded status at 11:51 p.m. Beirut, October 19 |
| --- | --- |
| Steward launched R44 through the existing Command Center | Yes; run `r-262a6aee5ed3` started at 11:47 p.m. |
| Selected executor | Codex / `gpt-6-luna` / low / Focused |
| Planning | Completed; plan revision 1 appeared in “Review plan” |
| Reported planning usage | 29,866 tokens |
| Exact plan approval | Waiting for you; approval had not been clicked |
| Implementation jobs | Zero observed |
| Verified candidate | Not reached |
| Apply, commit, push, or deploy | None |

The plan download timed out, so completion of the file download was uncertain; its displayed content was retained in the report. The launch command UUID and planning job ID were not exposed in the observed interface. A later blocked readiness projection concerned possible new admission after the R44 run already existed. It did not indicate that the admitted run had failed.

The outcome was real progress: ERA Steward did start the existing PM workflow and reached a concrete plan for your review. The full experience you wanted—phone approval, implementation, a verified candidate, and your final Apply decision—was not yet evidenced in the latest retained checkpoint. This document reflects that checkpoint rather than a live status check.
