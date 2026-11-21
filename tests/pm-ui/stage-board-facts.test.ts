import { describe, expect, it } from "vitest";
import { boardRetry } from "../../scripts/pm/app/stage/facts";
describe("work-bound Local retry evidence", () => {
  const run = (branch: string) => ({
    branch,
    work: { id: "HUB-118", title: "Recorded work" },
  });
  it("recognises the supervisor's UUID suffix and prior numeric suffixes", () => {
    expect(
      boardRetry(run("delivery/HUB-118-fda52e31-2f6c-4106-b9be-36c2f8eca381")),
    ).toBe(true);
    expect(boardRetry(run("delivery/HUB-118-2"))).toBe(true);
  });
  it("keeps the first attempt and an empty suffix unmarked", () => {
    expect(boardRetry(run("delivery/HUB-118"))).toBe(false);
    expect(boardRetry(run("delivery/HUB-118-"))).toBe(false);
  });
  it("does not accept another work id or an unrelated branch suffix", () => {
    expect(boardRetry(run("delivery/HUB-119-fda52e31"))).toBe(false);
    expect(boardRetry(run("feature/HUB-118-2"))).toBe(false);
  });
});
