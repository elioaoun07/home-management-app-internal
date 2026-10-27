import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { DeliveryHome } from "../../scripts/pm/app/DeliveryHome";
import { RunLink } from "../../scripts/pm/app/components";
import { UatPage } from "../../scripts/pm/app/UatWizard";
import { setTransport } from "../../scripts/pm/app/transport";
import { createLocalTransport } from "../../scripts/pm/app/localTransport";
import { pmKeys } from "../../scripts/pm/app/state";
import type { RunSummary, UatSummary } from "../../scripts/pm/app/types";

const fixture = vi.hoisted(() => ({ paired: false, stale: false, error: null as Error | null, queueError: null as Error | null, uat: [] as UatSummary[], query: "" }));
vi.mock("../../scripts/pm/app/state", async original => ({
  ...await original<typeof import("../../scripts/pm/app/state")>(),
  useWorld: () => ({ connected: true, connection: { stale: fixture.stale }, runsReady: true, runs: [], runError: null, world: { work: [] } }),
  useRoute: () => ({ path: "/delivery", full: `/delivery?${fixture.query}`, query: new URLSearchParams(fixture.query) }),
}));
vi.mock("../../scripts/pm/app/DeliveryV2", async original => ({
  ...await original<typeof import("../../scripts/pm/app/DeliveryV2")>(),
  useV2Session: () => ({ data: { paired: fixture.paired }, isError: false }),
  useV2Runs: () => ({ data: undefined, error: fixture.error, isError: !!fixture.error, isSuccess: !fixture.error }),
  useV2Queue: () => ({ data: undefined, error: fixture.queueError, isError: !!fixture.queueError, isSuccess: !fixture.queueError }),
}));
vi.mock("../../scripts/pm/app/UatWizard", async original => ({
  ...await original<typeof import("../../scripts/pm/app/UatWizard")>(),
  useUat: () => ({ data: fixture.uat, isError: false }),
}));

beforeEach(() => { fixture.paired = false; fixture.stale = false; fixture.error = null; fixture.queueError = null; fixture.uat = []; fixture.query = ""; setTransport(createLocalTransport()); });
const render = () => renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(DeliveryHome)));

it("opens draft review rows without a disclosure and retains the review search on return", () => {
  fixture.paired = true;
  fixture.query = "tests=all&testSearch=R80";
  fixture.uat = [{ handover_id: "draft-r80", status: "draft", acceptance: { state: "pending", shipped: false }, subject: { type: "direct", run_id: null, delivery_ref: "direct:R80", campaign: "PM Tooling", work_id: "R80", title: "Browser access" }, created_at: "2026-10-25T10:00:00Z", scenarios: [] } as unknown as UatSummary];
  const html = render();
  expect(html).toContain("Review &amp; sign off");
  expect(html).toContain("Work ID or title");
  expect(html).toContain("R80 · PM Tooling");
  expect(html).toContain("View steps");
  expect(html).toContain("Draft");
  expect(html).toContain("test/draft-r80?from=%2Fdelivery%3Ftests%3Dall%26testSearch%3DR80");
  expect(html).not.toContain("Test records");
  expect(html).not.toContain("Start test");
});

it("shows the pairing recovery path instead of a raw session error or false idle status", () => {
  fixture.error = new Error("this browser's session is not recognised");
  const html = render();
  expect(html).toContain("Pair this browser");
  expect(html).toContain("pnpm pm:pair");
  expect(html).toContain("Delivery status unavailable");
  expect(html).not.toContain("Nothing running");
  expect(html).not.toContain("session is not recognised");
});

it("does not announce idle when an authenticated queue read fails", () => {
  fixture.paired = true; fixture.queueError = new Error("Queue unavailable");
  const html = render();
  expect(html).toContain("Queue unavailable");
  expect(html).not.toContain("Nothing running");
});

it("does not announce idle from a stale transport snapshot", () => {
  fixture.paired = true; fixture.stale = true;
  expect(render()).not.toContain("Nothing running");
});

it.each(["createdAt", "updatedAt"])("keeps the work ID and recorded %s visible on legacy history rows", field => {
  const run: RunSummary = { sessionId: "old-attempt", item: { id: "HUB-1", campaign: "Hub & ERA", text: "Intent routing" }, state: "CANCELLED", agent: "claude", [field]: "2026-08-22T09:31:43Z" };
  const html = renderToStaticMarkup(createElement(RunLink, { run }));
  expect(html).toContain("HUB-1");
  expect(html).toContain("Hub &amp; ERA");
  expect(html).toMatch(/datetime="2026-08-22T09:31:43Z"/i);
  expect(html).toContain("old-attempt");
  if (field === "updatedAt") expect(html).toContain("Updated ");
});

it("offers pairing on a direct Test link instead of claiming the handover is missing", () => {
  const client = new QueryClient();
  client.setQueryData(pmKeys.v2session, { paired: false, actor: null, csrf: null });
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(UatPage, { id: "known-handover" })));
  expect(html).toContain("Pair this browser");
  expect(html).not.toContain("Not found");
});
