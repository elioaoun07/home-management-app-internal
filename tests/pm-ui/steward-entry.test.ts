import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { LaunchV2 } from "../../scripts/pm/app/DeliveryV2";
import { buildWorld } from "../../scripts/pm/app/model";
import { client, pmKeys } from "../../scripts/pm/app/state";
import { setTransport } from "../../scripts/pm/app/transport";
import { createLocalTransport } from "../../scripts/pm/app/localTransport";

let steward = true;
vi.mock("../../scripts/pm/app/state", async (original) => ({
  ...(await original<typeof import("../../scripts/pm/app/state")>()),
  useWorld: () => ({ connected: true }),
  useRoute: () => ({
    path: "/deliver/DLV-140",
    query: new URLSearchParams(steward ? "initiator=era-steward" : ""),
  }),
}));
afterEach(() => client.clear());

it("lets the real Steward entry record missing setup while ordinary Start stays gated", () => {
  const work = buildWorld({
    generatedAt: "2026-10-20T10:00:00Z",
    files: [
      {
        relPath: "Delivery/4 - Checklist.md",
        raw: "## Now\n- [ ] **DLV-140** Observe Steward requests _(friction - M)_\n",
      },
      {
        relPath: "Delivery/Delivery — Master Book.md",
        raw: "## Acceptance Criteria Index\n### DLV-140\n**Outcome:** Observe requests.\n",
      },
    ],
  }).work[0];
  setTransport(createLocalTransport());
  client.setQueryData(pmKeys.v2session, {
    paired: true,
    actor: "owner",
    scope: "fixture",
  });
  client.setQueryData(pmKeys.v2executors, { executors: [], refusals: [] });
  client.setQueryData(pmKeys.v2runs, { runs: [], requests: [] });
  const intent = ["deliver", work.file, String(work.idChip || work.id).toUpperCase()].join(":");
  client.setQueryData(pmKeys.v2intent("fixture:owner", intent), null);
  const render = () =>
    renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(LaunchV2, { work }),
      ),
    );
  steward = true;
  const attributed = render();
  expect(attributed).toContain("ERA Steward");
  expect(attributed).toMatch(
    /<button class="primary">[\s\S]*?Start<\/button>/u,
  );
  steward = false;
  const ordinary = render();
  expect(ordinary).toContain("initiator=era-steward");
  expect(ordinary).toMatch(
    /<button class="primary" disabled="">[\s\S]*?Start<\/button>/u,
  );
  steward = true;
  client.setQueryData(pmKeys.v2intent("fixture:owner", intent), { path: "deliver", body: {}, completed: true, runId: "cancelled-run" });
  client.setQueryData(pmKeys.v2runs, { runs: [{ run_id: "cancelled-run", lifecycle: "CLOSED", closed_outcome: "cancelled" }], requests: [] });
  const cancelled = render();
  expect(cancelled).toContain(">New delivery</button>");
  expect(cancelled).toContain(">Open delivery</button>");
  expect(cancelled).toMatch(/<button class="primary">New delivery<\/button>/u);
  expect(cancelled).not.toMatch(/>Start<\/button>/u);
  client.setQueryData(pmKeys.v2runs, { runs: [{ run_id: "cancelled-run", lifecycle: "WAITING", closed_outcome: "cancelled" }], requests: [] });
  expect(render()).not.toContain(">New delivery</button>");
});
