---
title: ERA Steward — Dot connection setup
started: 2026-10-25
status: in-progress
---

# ERA Steward — Dot connection setup

**Goal:** let Dot call the four ERA operations directly through a private MCP plugin, without launching local coding tasks for routine commands or status.

**Done when:** Dot reads the existing Applied R44 run through the plugin, reconnects successfully with general local-computer access revoked, and the owner records the accepted delegation limits.

This file is the setup progress record. The [runbook](ERA-Steward-Runbook.md#steward-tools-connection-status-corrected-2026-10-25) describes the design; [Delivery UAT](Delivery-UAT.md#era-steward-sign-off--2026-10-24) holds final acceptance. Update each Result immediately after observing it. A pending step is never a pass.

**Current checkpoint:** Phases 1–2 complete. Next: owner Phase 3. Share only the non-secret tunnel ID and target workspace confirmation; keep the runtime key private. This repo file is the requested durable checklist, in place of a second personal session-note copy.

## Phase 1 — Verify the existing ERA side [AI]

- [x] **1.1 Check local prerequisites.** Verify Node, the server file, restricted session-file presence and installed candidate-test policy. Read only non-secret fields.
  - **Verify:** `node --version`; inspect file existence; validate policy using the repo validator.
  - **Expected:** Node available, server and restricted session present, valid policy with required candidate tests.
  - **Result — PASS, 2026-10-25:** observed `node: v22.20.0`, `serverPresent: true`, `restrictedSessionPresent: true`, `policyValid: true`, `policyRevision: 11`; candidate tests enabled with required enforcement and pinned Vitest argv. Evidence: `.tmp/steward-dot-connection/prerequisites.json`. Pairing/policy were not repeated.
- [x] **1.2 Exercise the real stdio server offline.** Send `initialize` and `tools/list` to a fresh process, then close it.
  - **Verify:** bounded child-process check; retain non-secret output under `.tmp/steward-dot-connection/`.
  - **Expected:** successful initialization and exactly `start-delivery`, `read-request`, `read-run`, `wait-for-changes`; zero Delivery/model calls.
  - **Result — PASS, 2026-10-25:** actual output: `initialize: true`; tools exactly `start-delivery`, `read-request`, `read-run`, `wait-for-changes`; `deliveryCalls: 0`, `providerCalls: 0`. Evidence: `.tmp/steward-dot-connection/stdio-check.json`.

## Phase 2 — Prepare the tunnel client inside this repo [AI]

- [x] **2.1 Find the official client.** Resolve the official release linked by OpenAI's tunnel documentation and check for a compatible Windows artifact.
  - **Verify:** inspect the official release metadata and published checksum/digest where available.
  - **Expected:** a documented Windows download with identifiable version and integrity evidence.
  - **Result — PASS, 2026-10-25:** official `openai/tunnel-client` release API returned `v0.0.18`, with Windows amd64 and arm64 ZIP assets and SHA-256 digests. Initial PATH check: `tunnel-client: not found in PATH`. Select the asset matching this host before download.
- [x] **2.2 Prepare and inspect the client.** If a suitable official release is accessible, download only into the ignored `.tmp/steward-dot-connection/` directory, verify its published integrity, and read its version/help. No global installation.
  - **Verify:** downloaded SHA-256 agrees with published metadata; bounded client help command succeeds.
  - **Expected:** supported executable and confirmed current initialization arguments.
  - **Result — PASS, 2026-10-25:** downloaded official `v0.0.18` Windows amd64 release into `.tmp/steward-dot-connection/v0.0.18/`. Published and observed ZIP SHA-256 both `8d0da1ce79532d44ccc5ed5d8bd36cdfffba37dfd287c602d69635c8bb5db2b2`. `--help`, `help quickstart` and `init --help` each exited 0; output retained beside `client-release.json`. An initial archive-path inspection needed the Windows compression assembly loaded; the corrected inspection passed for every entry. Client help confirms `--profile-dir`, `--mcp-command`, `--tunnel-id` and the default `env:CONTROL_PLANE_API_KEY` secret reference. No tunnel/network daemon started.

Use the prepared client from this repo:

```powershell
$tunnelClient = Join-Path (Get-Location) '.tmp/steward-dot-connection/v0.0.18/tunnel-client.exe'
$tunnelProfiles = Join-Path (Get-Location) '.tmp/steward-dot-connection/profiles'
& $tunnelClient help quickstart
```

## Phase 3 — Create account resources [OWNER]

- [ ] **3.1 Create/reuse the private tunnel.** Open [Platform tunnel settings](https://platform.openai.com/settings/organization/tunnels). Confirm the intended organization and associate the target ChatGPT workspace. Use an existing suitable tunnel if present.
  - **Verify:** the actual settings show its `tunnel_id`, target workspace and access. Tunnel management requires Read/Manage; runtime/plugin use requires Read/Use.
  - **Expected:** a tunnel usable from the intended ChatGPT workspace.
  - **Result:** Pending. Record only non-secret IDs and observed status.
- [ ] **3.2 Prepare runtime authentication locally.** Create/select the appropriately restricted runtime key. Enter it only into the owner's PowerShell session when starting Phase 4.2, using a hidden prompt and the client's `CONTROL_PLANE_API_KEY` environment reference. Never paste a key into chat, this file, command arguments or logs. An environment variable in the owner's terminal is not inherited by this AI session.
  - **Verify:** the owner's Phase 4.2 diagnostic authenticates without displaying the key.
  - **Expected:** authentication available to the owner's tunnel process only.
  - **Result:** Pending.

## Phase 4 — Configure and verify transport [AI, then OWNER]

- [ ] **4.1 Configure the repo's stdio server [AI].** Once the non-secret tunnel ID is available, use the verified client to configure profile `era-steward` under the repo's ignored profiles directory for `node C:/Users/aoune/WebApp/budget-app/scripts/delivery-v2/steward-mcp.mjs`. Keep authentication as an environment reference.
  - **Verify:** inspect the generated profile's command, tunnel ID, loopback binding and secret reference; do not start a service or expect the owner's terminal environment here.
  - **Expected:** a valid profile containing no literal API key. Authenticated diagnostics belong to Phase 4.2.
  - **Result:** Pending.
- [ ] **4.2 Activate the existing bridge and tunnel [OWNER].** Restart the existing bridge once to load current accounting routes; in the owner's terminal, supply the runtime key locally and run the prepared client's `doctor --profile era-steward --profile-dir $tunnelProfiles --explain`, followed by `run --profile era-steward --profile-dir $tunnelProfiles`. Keep one bridge and one tunnel process running. Press Check readiness once for installed policy revision 11.
  - **Verify:** bridge connected, tunnel diagnostic healthy/polling, readiness displays its real result and authorization expiry.
  - **Expected:** current bridge code active; no new Delivery Start or provider job. Setup blockers remain visible.
  - **Result:** Pending. The bridge publishes to production, so project Hard Rule 26 requires the owner to restart it.

## Phase 5 — Connect the plugin and prove Dot use [OWNER]

- [ ] **5.1 Create the private plugin.** In ChatGPT **Plugins → + → Add custom MCP server**, choose **Connection: Tunnel**, select the Phase 3 tunnel, configure authentication and choose **Create as a plugin**. Review the discovered catalogue.
  - **Verify:** the connection succeeds and its actual catalogue contains exactly the four ERA tools.
  - **Expected:** an installed, connected ERA Steward plugin. Do not put an owner Command Center credential in this plugin.
  - **Result:** Pending.
- [ ] **5.2 Read R44 from Dot directly.** Ask: `Use the ERA Steward plugin to read run r-46688acd1b86. Do not Start a delivery or create a Work/Codex task.`
  - **Verify:** inspect the actual plugin invocation and Dot Activity, not only its reply.
  - **Expected:** the same Applied R44 run, direct `read-run`, no new delegated coding task; accounting coverage is labelled honestly.
  - **Result:** Pending. Local stdio checks alone cannot complete this step.
- [ ] **5.3 Remove general local access and reconnect.** In Dot's profile, under Computers, revoke access to the personal computer. Keep the independently started tunnel/bridge running; repeat the direct read and bounded wait.
  - **Verify:** local access is visibly revoked; direct calls still return the same run after reconnect. Inspect Activity for new local coding tasks.
  - **Expected:** plugin operation succeeds without Dot's general local-computer access.
  - **Result:** Pending.
- [ ] **5.4 Require approval for other ERA delegation.** Under **Settings → Personalization → Custom rules**, add **Ask before taking action** for starting/continuing Work, Codex, Claude or shell tasks for ERA.
  - **Verify:** the saved rule has that scope and action; inspect subsequent Activity for adherence.
  - **Expected:** the rule is saved. It is a fallible approval instruction, not proof that every cloud model call is technically impossible.
  - **Result:** Pending.

## Phase 6 — Record acceptance [OWNER]

- [ ] **6.1 Physical phone check.** Open existing R44 on `/pm/live`, reload and reconnect.
  - **Verify:** Applied and identical run/result/application IDs; no Start.
  - **Expected:** existing delivery remains accessible on the phone.
  - **Result:** Pending.
- [ ] **6.2 Sign off the evidenced scope.** Record M1–M4 results in Delivery UAT; M5 already has an agent fixture-review PASS.
  - **Verify:** every required result above has actual evidence; remaining limitations are explicitly accepted or unresolved.
  - **Expected:** acceptance of direct typed initiation/monitoring, owner plan approval/Apply and disclosed delegation/budget limits. A hard ban on all cloud delegation or a hard spend cap is not established by this setup.
  - **Result:** Pending. Full Dot sign-off is not yet claimed.

## Sources

- [OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [Connect and test a plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Dot computers and apps](https://learn.chatgpt.com/docs/dots/computers-and-apps)
- [Dot controls](https://learn.chatgpt.com/docs/dots/controls)

## Progress log

- 2026-10-25 — Created the complete phased record before setup execution. Initial inspection found Node v22.20.0 and no `tunnel-client` in PATH. Account actions and service activation remain pending.
- 2026-10-25 — Completed 1.1, 1.2 and 2.1 from actual local-process and official-release output. No Delivery or provider call.
- 2026-10-25 — Completed 2.2: prepared and integrity-checked the official Windows client; three offline help commands exited 0. Phase 3 is the next dependency. No account resource or running service was created.
