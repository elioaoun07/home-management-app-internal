// Synthetic Local session data and request boundary for the retained browser suite.
// No provider/session/backend write is permitted; only the named review response is simulated.
export const stateScenes = ["live", "thinking", "quiet", "stale", "signal-lost", "link-down", "failed-hook", "cancelled", "your-turn", "push-pending", "shipped", "reverted"];
export async function installLocalSessionFixture(page, { origin, frozenBundle, writes, simulatedReviews }) {
  let scene = "failed", toolEvent = null;
  let at = new Date().toISOString(), localResponses = 0, extraRows = [];
const phaseFor = value => ["live", "thinking", "quiet", "stale", "signal-lost", "link-down", "interrupted"].includes(value) ? "building" : value === "failed-hook" ? "failed" : value === "your-turn" ? "uat-ready" : ["replay-gap", "replay-stale-gap"].includes(value) ? "cancelled" : value;
const iso = offset => new Date(Date.parse(at) + offset).toISOString();
const richRows = () => {
  const age = ({ thinking: 34_000, quiet: 112_000, stale: 372_000 })[scene] || 5_000;
  const tail = -age;
  const rows = [
    { at: iso(tail - 120_000), summary: "Native session started", seq: 0, job_id: "native" },
    { at: iso(tail - 115_000), kind: "command", summary: '"C:\\windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command \'Get-Content -LiteralPath "C:/fixture/very-long-worktree-path/retained-failed-attempt/BUD-1/src/app/api/route.ts"\'', seq: 1, job_id: "native" },
    { at: iso(tail - 110_000), kind: "edit", summary: "src/app/api/route.ts, src/app/g/page.tsx", seq: 2, job_id: "native" },
    { at: iso(tail - 106_000), kind: "command", summary: "rg guest_portal_tags src/app/api/route.ts", seq: 3, job_id: "native", agent_json: { role: "subagent", id: "fixture-satellite", executor: "codex", model: "fixture" } },
    { at: iso(tail - 103_000), kind: "command", summary: "pnpm typecheck", seq: 4, job_id: "native" },
    { at: iso(tail), kind: "message", summary: "The route now checks the owning host before returning guest records.", seq: 5, job_id: "native" },
  ];
  if (scene === "replay-stale-gap") for (const row of rows.slice(0, 5)) row.at = new Date(Date.parse(row.at) - 480_000).toISOString();
  if (["your-turn", "push-pending", "shipped", "reverted"].includes(scene)) {
    rows[5].at = iso(tail - 36_000);
    rows.push({ at: iso(tail - 30_000), summary: "Host checks started", seq: 6, job_id: "supervisor" });
    for (const [index, name] of ["typecheck", "lint", "test", "pm:lint"].entries()) rows.push({ at: iso(tail - 25_000 + index * 5_000), summary: `${name}: 0`, seq: 7 + index, job_id: "supervisor" });
    rows.push({ at: iso(tail - 4_000), summary: "Ready for owner UAT", seq: 11, job_id: "supervisor" });
    if (scene === "shipped") rows.push({ at: iso(tail), summary: "Owner shipped merge", seq: 12, job_id: "supervisor" });
    if (scene === "reverted") rows.push({ at: iso(tail), summary: "Owner reverted merge", seq: 13, job_id: "supervisor" });
  }
  return rows;
};
const id = "local-00000000-0000-4000-8000-000000000117";
const otherId = "local-00000000-0000-4000-8000-000000000118";
function fixtureHandover(accepted) {
  return {
    handover_id: "fixture-uat", revision: 1, revisions: 1, status: "ready",
    subject: { type: "run", run_id: id, delivery_ref: "local:fixture", work_id: "BUD-1", campaign: "Budget", title: "Fixture UAT" },
    binding: { kind: "candidate", source_revision: "c".repeat(40) },
    environment: { target: "local", build: null, url: null, device: null }, created_at: at,
    summary: "Recorded fixture handover", setup: "", limits: "", problems: [],
    counts: { pass: accepted ? 1 : 0, fail: 0, blocked: 0, pending: accepted ? 0 : 1 },
    availability: { state: "available", evidence: null }, stale: false,
    acceptance: { state: accepted ? "accepted" : "pending", shipped: accepted },
    signoff: null, signable: true, blockers: [], feedback: [], draft: null,
    staleDraft: false, draftRev: 0, supersededBy: null,
    scenarios: [{ id: "fixture-scenario", title: "Recorded fixture scenario", required: true,
      result: accepted ? "pass" : "pending", draft: false, purpose: "", criteria: [], setup: "", starting: "",
      steps: [{ action: "Open fixture", expected: "Recorded fixture visible" }], defect: null,
      cleanup: "", limits: null, receipt: null, attempts: 0 }],
  };
}
const local = (requestedId = id) => ({
  run_id: requestedId,
  phase: phaseFor(scene),
  branch: "delivery/BUD-1",
  workspace: "C:/fixture/very-long-worktree-path/retained-failed-attempt/BUD-1",
  head: ["checking", "uat-ready", "your-turn", "push-pending", "shipped", "reverted"].includes(scene) ? "c".repeat(40) : null,
  current_head: "b".repeat(40),
  work: {
    id: requestedId === otherId ? "BUD-2" : "BUD-1",
    campaign: "Budget",
    title: "BUD-1 Verify cockpit fixture — criteria",
    brief:
      "**Outcome:** Verify cockpit fixture.\n\n- **Acceptance:** Only the owning host can read guest records.\n- Anonymous bulk read returns 401.\n- Host from another tag receives 403.\n- Owning host receives 200.",
  },
  settings: { executor: "claude", model: "fixture-claude", effort: "medium" },
  canShip: false,
  canUndo: false,
  interrupted: ["interrupted", "signal-lost"].includes(scene),
  error:
    scene === "failed"
      ? "native session exited 1: TypeError: Cannot freeze\n    at deepFreeze (file:///C:/fixture/scripts/delivery-v2/contracts.mjs:172:12)"
      : scene === "failed-hook" ? "git commit: \u001b[36mChecking AI guidance docs...\u001b[0m\n" + "Hook output\n".repeat(120) + "\u001b[31mFAIL tests/fixture.test.ts\u001b[0m\nTests  2 failed | 10 passed\nTest Files  1 failed | 3 passed\nELIFECYCLE Command failed with exit code 1.\n" : undefined,
  activity: [...(stateScenes.includes(scene) || ["replay-gap", "replay-stale-gap"].includes(scene) ? richRows() : [{ at, summary: "Native session started", seq: 0, job_id: "native" }]), ...(toolEvent ? [{ at: iso(1000), seq: 1, job_id: "native", ...toolEvent }] : []), ...extraRows],
  usage: scene === "shipped" ? { input_tokens: 1200, output_tokens: 300 } : null,
  checks:
    scene === "checking"
      ? [
          {
            name: "typecheck",
            exit: 0,
            stdout: "Typecheck passed",
            stderr: "",
            error: null,
          },
          {
            name: "lint",
            exit: null,
            stdout: "",
            stderr: "",
            error: "Checker interrupted",
          },
        ]
      : ["your-turn", "push-pending", "shipped", "reverted"].includes(scene) ? ["typecheck", "lint", "test", "pm:lint"].map((name, index) => ({ name, exit: 0, stdout: "Fixture passed", stderr: "", error: null, started_at: iso(-35_000 + index * 5_000), finished_at: iso(-30_000 + index * 5_000) })) : [],
  handover:
    ["uat-ready", "your-turn", "push-pending", "shipped", "reverted"].includes(scene)
      ? fixtureHandover(scene === "shipped")
      : null,
});
const waiting = {
  run_id: "local-older-uat",
  engine: "v2",
  lane: "local",
  alias: "BUD-2",
  title: "Older owner UAT",
  lifecycle: "ACTIVE",
  closed_outcome: null,
  stage: "uat-ready",
  active: false,
  ownerAction: "Ready to test",
  ownerActionKind: "local-review",
  updated_at: "2026-11-14T17:00:00Z",
  created_at: "2026-11-14T16:00:00Z",
  branch: null,
};
const main = () => ({
  run_id: id,
  engine: "v2",
  lane: "local",
  alias: "BUD-1",
  title: "Verify cockpit fixture",
  lifecycle: scene === "failed" ? "CLOSED" : "ACTIVE",
  closed_outcome: scene === "failed" ? "failed" : null,
  stage: phaseFor(scene),
  active: ["preparing", "building", "checking"].includes(scene),
  ownerAction: scene,
  ownerActionKind: scene === "interrupted" ? "inspect-session" : "none",
  updated_at: at,
  created_at: at,
  branch: "delivery/BUD-1",
  application: null,
});
const json = (route, data) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(data),
  });
await page.route("**/*", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  if (url.origin !== origin) return route.abort();
  if (frozenBundle && ["/app/assets/pm.js", "/app/assets/pm.css"].includes(url.pathname)) {
    const kind = url.pathname.endsWith(".js") ? "js" : "css";
    return route.fulfill({ contentType: kind === "js" ? "text/javascript" : "text/css", body: frozenBundle[kind] });
  }
  if (!["GET", "HEAD"].includes(request.method())) {
    const body = request.postDataJSON();
    if (url.pathname === "/api/delivery/v2/local" && body?.action === "review" && body.run_id === id) {
      simulatedReviews.push(body.run_id);
      return json(route, { patch: "diff --git a/fixture-only-first-run.ts b/fixture-only-first-run.ts\n--- a/fixture-only-first-run.ts\n+++ b/fixture-only-first-run.ts\n+fixture-only-first-run" });
    }
    writes.push(url.pathname);
    return route.abort();
  }
  if (url.pathname === "/api/delivery/v2/session")
    return json(route, { paired: true, actor: "fixture", csrf: "fixture" });
  if (url.pathname === "/api/delivery/sessions")
    return json(route, { sessions: [] });
  if (url.pathname === "/api/delivery/v2/local/run") {
    if (scene === "link-down" && localResponses++ > 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "fixture link down" }) });
    return json(route, local(url.searchParams.get("id") || id));
  }
  if (url.pathname === "/api/delivery/v2/runs")
    return json(route, {
      runs: [
        waiting,
        ...(["attention", "blocked"].includes(scene) ? [] : [main()]),
      ],
      requests:
        scene === "blocked"
          ? [
              {
                command_id: "blocked-fixture",
                initiatedBy: "Owner",
                actor: "fixture",
                file: "Budget/4 - Checklist.md",
                status: "blocked",
                stage: "blocked",
                run_id: null,
                terminal: false,
                acceptedAt: at,
                startedAt: null,
                lastConfirmedAt: at,
                jobUpdatedAt: null,
                staleAfterMs: 180000,
                workId: "BUD-1",
                blocker: { code: "fixture-blocked" },
                evidence: [],
                result: null,
                runEvidence: null,
              },
            ]
          : [],
    });
  if (url.pathname === "/api/delivery/v2/queue")
    return json(route, {
      queue: {
        running: [],
        waiting: [],
        decisions: [],
        candidates: [],
        applying: null,
        unknown: { jobs: [] },
      },
    });
  if (url.pathname === "/api/delivery/v2/uat")
    return json(route, { handovers: [] });
  return route.continue();
});

  return {
    id, otherId, iso,
    set scene(value) { scene = value; },
    set toolEvent(value) { toolEvent = value; },
    set at(value) { at = value; },
    set localResponses(value) { localResponses = value; },
    get extraRows() { return extraRows; },
    set extraRows(value) { extraRows = value; },
  };
}
