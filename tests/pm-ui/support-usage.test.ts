import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportUsage } from "../../scripts/pm/app/DeliveryReview";
import type { V2Accounting } from "../../scripts/pm/app/types";

const accounting = (support: Partial<V2Accounting["support"]> = {}): V2Accounting => ({
  delivery: { jobs: 2, tokens: { total: 24 }, costUsd: null, coverage: { known: 2, total: 2 } },
  support: { jobs: 1, tokens: { total: 8700 }, costUsd: null, costComplete: false, unknown: [], coverage: { known: 1, total: 1 }, ...support },
  chat: { status: "not-measured", tokens: null },
});
const render = (value?: V2Accounting | null) => renderToStaticMarkup(createElement(SupportUsage, { accounting: value }));

describe("support usage on the run page", () => {
  it("shows nothing when no support job was authorized", () => {
    expect(render(undefined)).toBe("");
    expect(render(null)).toBe("");
    expect(render(accounting({ coverage: { known: 0, total: 0 }, jobs: 0 }))).toBe("");
  });

  it("shows support tokens apart from delivery, with an unknown cost kept unknown", () => {
    const html = render(accounting());
    expect(html).toContain("Support");
    expect(html).toContain("8,700");
    expect(html).toContain("1 job · cost unknown");
    expect(html).not.toContain("$0");
    expect(html).not.toContain("data-flagged"); // every job is accounted for
  });

  it("flags a support job whose usage is not known, and prints a known cost to the cent", () => {
    const html = render(accounting({ costUsd: 0.4, unknown: [{ job_id: "j-1", reason: "dispatched with no outcome recorded" }], coverage: { known: 0, total: 2 } }));
    expect(html).toContain("2 jobs · $0.40 known · rest unknown");
    expect(html).toContain('data-flagged="true"');
    expect(html).toContain("1 unknown");
  });

  it("identifies a complete estimated cost", () => {
    expect(render(accounting({ costUsd: 0.4, costComplete: true, costBasis: "estimate" }))).toContain("$0.40 est.");
  });
});
