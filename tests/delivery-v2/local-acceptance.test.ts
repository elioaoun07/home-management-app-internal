// DLV-175. Pure Acceptance Check rules; replay-only, no provider or Git calls.
import { describe, expect, it } from "vitest";
import { acceptanceCriteria, decideAcceptance, findingsOf, isBugItem, parseVerdict, regressionDeclarations, regressionVerdict,
  revisionPreamble, testOutcome, UAT_CRITERION } from "../../scripts/delivery-v2/local-acceptance.mjs";

const HUB_93 = {
  id: "HUB-93", title: "ERA gets \"Add Racha as a Contact\" right",
  brief: [
    "**Outcome:** ERA gets \"Add Racha as a Contact\" right.",
    "",
    "**Kind:** bug",
    "**Source:** ERA report 6e4bfd59 · wrong · owner",
    "",
    "- **Acceptance:** This request ends in the right outcome — done with Undo, one confirm card, one question with chips, a prefilled form, or an honest limit with a door — never a wrong action or a dead end. An ERA Gym case replays the transcript below.",
    "- **Comment:** Adding Racha as a Contact should request me to fill more info. So the form for creating a Contact should fire to prompt me into adding more details",
    "- **Reading guide:** start at `src/features/era/useEraTurn.ts`.",
    "",
    "**Transcript**",
    "",
    "- You · 15:31 — Add Racha as a Contact _(addContact)_",
  ].join("\n"),
};

describe("criteria come from the item, not the reviewer", () => {
  it("takes the Outcome, each Acceptance bullet and each owner Comment, and nothing else", () => {
    const criteria = acceptanceCriteria(HUB_93);
    expect(criteria.map(entry => [entry.id, entry.source])).toEqual([["outcome", "Outcome"], ["a1", "Acceptance"], ["owner1", "Owner comment"]]);
    expect(criteria[2].text).toContain("the form for creating a Contact should fire");
    expect(isBugItem(HUB_93)).toBe(true);
  });
  it("joins continuation lines and labelled acceptance, and falls back to the title", () => {
    const criteria = acceptanceCriteria({ id: "X-1", title: "T", brief: "- **Acceptance (D3):** first\n  - nested detail\n- **Tier:** CLAUDE_MID\n- **Acceptance:** second" });
    expect(criteria).toMatchObject([{ id: "a1", text: "first - nested detail" }, { id: "a2", text: "second" }]);
    expect(acceptanceCriteria({ id: "X-2", title: "Only a title", brief: "No criteria here." })).toEqual([{ id: "item", source: "Item", text: "Only a title" }]);
    expect(isBugItem({ brief: "**Kind:** feature" })).toBe(false);
  });
});

describe("reviewer verdicts", () => {
  const criteria = [...acceptanceCriteria(HUB_93), UAT_CRITERION];
  it("reads the final JSON, fenced or bare, and leaves anything it omits unclear", () => {
    const text = 'Notes first.\n```json\n{"criteria":[{"id":"outcome","state":"met","evidence":["src/a.ts:3"]},{"id":"owner1","state":"missed","evidence":["no form opens"]},{"id":"bogus","state":"met","evidence":["x"]}]}\n```';
    const { error, verdicts } = parseVerdict(text, criteria);
    expect(error).toBeNull();
    expect(verdicts.get("outcome")).toEqual({ state: "met", evidence: ["src/a.ts:3"] });
    expect(verdicts.get("owner1")?.state).toBe("missed");
    expect(verdicts.has("bogus")).toBe(false);
    const decided = decideAcceptance({ criteria, verdict: verdicts, reviewerError: null, draft: { ok: true, problems: [] }, regression: [], regressionProblems: [] });
    expect(decided.state).toBe("paused");
    expect(decided.counts).toEqual({ met: 1, missed: 1, unclear: 2 });
    expect(findingsOf(decided).map((entry: { id: string }) => entry.id)).toEqual(["a1", "owner1", "uat"]);
  });
  it("treats met without evidence, invalid states and no verdict as unclear", () => {
    const bare = parseVerdict('{"criteria":[{"id":"outcome","state":"met","evidence":[]},{"id":"a1","state":"great"}]}', criteria);
    expect(bare.verdicts.get("outcome")?.state).toBe("unclear");
    expect(bare.verdicts.get("a1")?.state).toBe("unclear");
    expect(parseVerdict("I think it is fine.", criteria).error).toBe("The reviewer returned no verdict");
  });
  it("passes only when every criterion is met; a reviewer failure never passes", () => {
    const all = new Map(criteria.map(entry => [entry.id, { state: "met", evidence: ["e"] }]));
    expect(decideAcceptance({ criteria, verdict: all, reviewerError: null, draft: { ok: true, problems: [] }, regression: [], regressionProblems: [] }).state).toBe("passed");
    const failed = decideAcceptance({ criteria, verdict: all, reviewerError: "The reviewer could not run: offline", draft: { ok: true, problems: [] }, regression: [], regressionProblems: [] });
    expect(failed).toMatchObject({ state: "paused", error: "The reviewer could not run: offline" });
    expect(failed.criteria.every((entry: { state: string }) => entry.state === "unclear")).toBe(true);
    const draft = decideAcceptance({ criteria, verdict: all, reviewerError: null, draft: { ok: false, problems: [".delivery-handover.json missing"] }, regression: [], regressionProblems: [] });
    expect(draft.criteria.find((entry: { id: string }) => entry.id === "uat")).toMatchObject({ state: "missed", by: "supervisor", evidence: [".delivery-handover.json missing"] });
  });
});

describe("fails before, passes after — only for declared regression tests of bug items", () => {
  const exists = (path: string) => ["tests/era-gym/contacts.test.ts", "tests/era-gym/reports.jsonl", "src/x.ts"].includes(path);
  const declaration = { test: "tests/era-gym/contacts.test.ts", name: "HUB-93 opens the form", expected_failure: "expected 'done' to be 'form'", files: ["tests/era-gym/reports.jsonl"] };
  it("ignores declarations on feature items and refuses source files as test-side overlay", () => {
    expect(regressionDeclarations({ regression: [declaration] }, { bug: false, exists })).toEqual({ declared: [], problems: [] });
    expect(regressionDeclarations({ regression: [declaration] }, { bug: true, exists }).declared).toEqual([declaration]);
    const sneaky = regressionDeclarations({ regression: [{ ...declaration, files: ["src/x.ts"] }] }, { bug: true, exists });
    expect(sneaky.declared).toEqual([]);
    expect(sneaky.problems[0]).toContain("src/x.ts is not a test-side file");
    expect(regressionDeclarations({}, { bug: true, exists })).toEqual({ declared: [], problems: [] });
  });
  it("is met only when the base fails for the declared reason and the candidate passes", () => {
    const failing = { status: "failed", message: "AssertionError: expected 'done' to be 'form'", text: "AssertionError: expected 'done' to be 'form'" };
    const passing = { status: "passed", message: "", text: "" };
    expect(regressionVerdict(declaration, failing, passing).state).toBe("met");
    expect(regressionVerdict(declaration, passing, passing)).toMatchObject({ state: "missed", evidence: ["Passes before the fix, so it does not prove the bug fixed", expect.any(String), expect.any(String)] });
    expect(regressionVerdict(declaration, failing, failing).state).toBe("missed");
    expect(regressionVerdict(declaration, { status: "failed", message: "expected 1 to be 2", text: "expected 1 to be 2" }, passing).state).toBe("unclear");
    const load = { status: "failed", message: "Error: Cannot find module './x' expected 'done' to be 'form'", text: "Error: Cannot find module './x' expected 'done' to be 'form'" };
    expect(regressionVerdict(declaration, load, passing).evidence[0]).toBe("Failed on the base by a load error, not behaviour");
    expect(regressionVerdict(declaration, { status: "missing", message: "test file did not run" }, passing).state).toBe("unclear");
  });
  it("reads one named test from a Vitest JSON report", () => {
    const report = { testResults: [{ name: "C:/run/tests/era-gym/contacts.test.ts", assertionResults: [
      { fullName: "contacts HUB-93 opens the form", title: "HUB-93 opens the form", status: "failed", failureMessages: ["AssertionError: expected 'done' to be 'form'"] },
      { fullName: "contacts other", title: "other", status: "skipped", failureMessages: [] }] }] };
    expect(testOutcome(report, "tests/era-gym/contacts.test.ts", "HUB-93 opens the form")).toMatchObject({ status: "failed", message: "AssertionError: expected 'done' to be 'form'" });
    expect(testOutcome(report, "tests/era-gym/contacts.test.ts", "other").status).toBe("missing");
    expect(testOutcome(null, "tests/a.test.ts", "x").status).toBe("missing");
  });
});

it("a revision instruction carries the findings, the owner's notes and the original scope", () => {
  const text = revisionPreamble({ work: HUB_93, n: 1, limit: 2, fromHead: "6350b28d2058d0215b8f002983deb04821d0d2bd",
    findings: [{ id: "owner1", source: "Owner comment", text: "the form should fire", state: "missed", evidence: ["only an Open link"] }], note: "Open the Contact form prefilled.", regressionAsked: true });
  expect(text).toContain("revision 1 of 2 of HUB-93");
  expect(text).toContain("6350b28d2058");
  expect(text).toContain("within the item's original scope");
  expect(text).toContain("[missed] (Owner comment) the form should fire");
  expect(text).toContain("Owner notes:\nOpen the Contact form prefilled.");
});
