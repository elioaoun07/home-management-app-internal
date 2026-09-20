import { describe, expect, it } from "vitest";
import { acceptanceRevision, freezeSelectedItem, recheckContractSource } from "../../scripts/delivery-v2/work-ref.mjs";
import { briefInstruction, makeTaskBrief, preparedPlanFor, splitTaskInput } from "../../scripts/delivery-v2/task-input.mjs";

const ROW = "- [ ] **DLV-200** Correct a label _(friction - S)_";
const body = "- **Acceptance:** shows the label.\n- **Reading guide:** preserve the label invariant.\n<!-- delivery:advisory:v1 -->\nStart at renderLabel.\n<!-- /delivery:advisory -->";
const book = (text = body) => "### DLV-200\n\n" + text;
const freeze = (acceptanceVersion: number) => freezeSelectedItem({ raw: ROW, file: "Delivery/4 - Checklist.md", cbidx: 0, bookRaw: book(), acceptanceVersion, requestedDisposition: "verified_candidate", scratchScope: { include: ["src/label.ts"] }, publicationScope: { allowedPaths: ["src"] } });

describe("versioned selected-item guidance", () => {
  it("preserves legacy fingerprints and refuses drift under old approvals", () => {
    expect(splitTaskInput(body, false)).toMatchObject({ binding: body, guide: "" });
    const frozen = freeze(1);
    expect(frozen.contract!.acceptance_fingerprint).toBe(acceptanceRevision({ bookRaw: book(), alias: "DLV-200" }).fingerprint);
    const changed = book(body.replace("renderLabel", "newLabel"));
    expect(recheckContractSource({ raw: ROW, workRef: frozen.workRef!, contract: frozen.contract!, bookRaw: changed }).freshness!.fresh).toBe(false);
  });
  it("separates only explicitly adopted guidance on new contracts", () => {
    const frozen = freeze(2);
    expect(frozen.contract!.acceptance_fingerprint).toMatch(/^binding-v2:/);
    const check = (text: string) => recheckContractSource({ raw: ROW, workRef: frozen.workRef!, contract: frozen.contract!, bookRaw: book(text) }).freshness!.fresh;
    expect(check(body.replace("renderLabel", "newLabel"))).toBe(true);
    expect(check(body.replace("shows the label", "hides the label"))).toBe(false);
    expect(check(body.replace("preserve the label invariant", "discard the invariant"))).toBe(false);
  });
  it("binds malformed or duplicated advisory delimiters rather than dropping text", () => {
    for (const text of [body.replace("<!-- /delivery:advisory -->", ""), body + "\n<!-- delivery:advisory:v1 -->"]) {
      expect(splitTaskInput(text).binding).toBe(text.trim());
      expect(splitTaskInput(text).guide).toBe("");
    }
  });
  it("injects fresh/uncertain inputs, with only a recovery reference on known continuation", () => {
    const input = splitTaskInput(body);
    const contract = freeze(2).contract!;
    const plan = { revision: 1, body: { steps: ["edit label"], scope: ["src/label.ts"] } };
    const brief = makeTaskBrief({ input, contract, alias: "DLV-200", plan });
    const instruction = "Implement\n\nPlan:\n" + JSON.stringify(plan.body);
    for (const [continued, recoverable] of [[false, true], [true, false], [false, false]]) {
      const prompt = briefInstruction({ instruction, brief, input, plan, continued, recoverable });
      expect(prompt).toContain(brief.text);
      expect(prompt).toContain("Inspect current code");
      expect(prompt.match(/edit label/g)).toHaveLength(1);
    }
    const prompt = briefInstruction({ instruction, brief, input, plan, continued: true, recoverable: true });
    expect(prompt).toContain(brief.path);
    expect(prompt).not.toContain(brief.text);
    expect(JSON.parse(brief.text).guidance.text).toBe("Start at renderLabel.");
    const repair = makeTaskBrief({ input, contract, alias: "DLV-200", plan, failedCandidate: { candidate_id: "failed-1", generation: "g-2" } });
    expect(JSON.parse(repair.text).failed_candidate).toEqual({ candidate_id: "failed-1", generation: "g-2" });
  });
});

const material = { outcome: "Correct a label", acceptance: ["Label is correct"], scope: ["src/label.ts"], steps: ["Replace the label literal"], invariants: ["Keep the click handler"], exclusions: ["No other labels"], checks: ["label"], risks: [], unknowns: [], dependencies: [], risk: "low", ownerReviewed: true, provenance: "Owner-reviewed item specification" };
const policy = { criteria: [{ criterion_id: "label", required_for: "candidate", observer: { expected: { spec_id: "label" } }, oracle_ref: "tests/label.mjs" }], checks: { specs: { label: { kind: "command", argv: ["node", "tests/label.mjs"] } }, inputs: ["tests/label.mjs"] } };
const eligible = (changes = {}, extra = {}) => preparedPlanFor({ input: splitTaskInput("```delivery-plan-v1\n" + JSON.stringify({ ...material, ...changes }) + "\n```"), alias: "DLV-200", profile: "focused", contract: { outcome: material.outcome, scratchScope: { include: ["src/label.ts", "tests/label.mjs"] }, publicationScope: { allowedPaths: ["src"] } }, policy, facts: { declared: ["src/label.ts"], dependencyIds: [] }, sourceExists: () => true, ...extra });

describe("prepared-plan readiness", () => {
  it("uses explicit existing material unchanged", () => {
    expect(eligible().eligible).toBe(true);
    expect(eligible().body).toEqual(material);
  });
  it.each([{ steps: [] }, { acceptance: [] }, { invariants: [] }, { exclusions: [] }, { ownerReviewed: false }, { provenance: "" }, { unknowns: ["which label?"] }, { dependencies: ["DLV-199"] }, { checks: [] }, { scope: ["src/elsewhere.ts"] }, { scope: ["../outside"] }, { risk: "high" }, { outcome: "Change payment balance" }])("rejects incomplete, risky or unauthorized material %j", changes => {
    expect(eligible(changes).eligible).toBe(false);
  });
  it("does not infer readiness from scope, missing checks, or unapproved DLV-134", () => {
    expect(eligible({ unrecognizedRequirement: "must retain this" }).eligible).toBe(false);
    expect(eligible({}, { input: splitTaskInput("**Touches:** `src/label.ts`") }).eligible).toBe(false);
    expect(eligible({}, { sourceExists: () => false }).eligible).toBe(false);
    expect(eligible({}, { profile: "investigate" }).eligible).toBe(false);
    expect(eligible({}, { alias: "DLV-134" }).eligible).toBe(false);
    expect(eligible({}, { facts: { declared: ["src/label.ts"], dependencyIds: ["DLV-199"] } }).eligible).toBe(false);
  });
});
