// PM Delivery V2 — S0.1 fixtures: select and freeze one item.
//
// These assertions are the whole of invariant V2-I01 ("selection binds stable
// work identity and the intended source revision; ordinals and guessed aliases
// never launch work") and the F-ID family. A false pass here is a paid job run
// against a row the owner never chose — Diagnosis D01, reproduced below as a
// counterexample so the hazard stays visible next to its fix.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ContractError,
  authorizeContract,
  contractFreshness,
  dispositionObligations,
  fingerprint,
  makeCriterion,
  makeLocator,
  makeWorkRef,
  normalizeSourceText,
  rebindWorkRef,
  reviseContract,
} from "../../scripts/delivery-v2/contracts.mjs";
import {
  freezeSelectedItem,
  parseWorkItems,
  recheckContractSource,
  resolveWorkRef,
  selectWorkItem,
} from "../../scripts/delivery-v2/work-ref.mjs";

const FILE = "Fixture/4 - Checklist.md";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

function must<T>(value: T | null | undefined, what: string): T {
  if (value == null) throw new Error(`expected ${what}`);
  return value;
}

const BASELINE = fixture("selection-baseline.md");
const REORDERED = fixture("selection-reordered.md");
const EDITED = fixture("selection-edited.md");
const DUPLICATE = fixture("selection-duplicate-alias.md");

const SCRATCH = { root: "<scratch>", writable: ["<scratch>"], readable: ["<snapshot>"] };
const PUBLICATION = { allowedPaths: ["src/components/expense/"], changeConstraints: { maxFiles: 1 } };

it("prevents a queued contract from dispatching after its checklist item is completed", () => {
  const raw = "## Now\n- [ ] **BUD-14** Fix a bounded issue _(friction - S)_\n";
  const frozen = freezeSelectedItem({ raw, file: "Budget/4 - Checklist.md", cbidx: 0, bookRaw: null, requestedDisposition: "verified_candidate", scratchScope: SCRATCH, publicationScope: PUBLICATION });
  const result = recheckContractSource({ raw: raw.replace("[ ]", "[x]"), workRef: must(frozen.workRef, "work"), contract: must(frozen.contract, "contract"), bookRaw: null });
  expect(result.resolved).toBe(false);
  expect(result.reason).toBe("work-completed");
});

/** The R-1 row, selected the way the PM surface reports a click: by ordinal. */
function selectR1(raw: string) {
  const items = parseWorkItems(raw);
  const cbidx = must(
    items.find((item) => item.alias === "R-1"),
    "an R-1 row in the fixture",
  ).cbidx;
  return selectWorkItem({ raw, file: FILE, cbidx });
}

describe("parseWorkItems", () => {
  it("reads the house checklist grammar and fingerprints the raw row", () => {
    const items = parseWorkItems(BASELINE);
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({
      alias: "R-1",
      severity: "friction",
      effort: "S",
      section: "Now",
      state: "open",
      cbidx: 0,
    });
    expect(items[0].text).toContain("Replace the mobile quick-amount preset 25 with 20");
    expect(items[0].textFingerprint).toBe(fingerprint(normalizeSourceText(items[0].rest)));
    expect(items[3].alias).toBeNull();
  });

  it("does not fold the checkbox state into the fingerprint", () => {
    const ticked = BASELINE.replace("- [ ] **R-1**", "- [x] **R-1**");
    const before = must(parseWorkItems(BASELINE).find((i) => i.alias === "R-1"), "R-1");
    const after = must(parseWorkItems(ticked).find((i) => i.alias === "R-1"), "R-1");
    expect(after.state).toBe("done");
    expect(after.textFingerprint).toBe(before.textFingerprint);
  });
});

describe("selectWorkItem", () => {
  it("spends the ordinal immediately — the locator carries no position", () => {
    const selection = selectR1(BASELINE);
    const locator = must(selection.locator, "a locator");
    expect(selection.ok).toBe(true);
    expect(locator.alias).toBe("R-1");
    expect(Object.keys(locator).sort()).toEqual(["alias", "file", "heading", "mappingRevision", "textFingerprint"]);
  });

  it("refuses an out-of-range ordinal instead of clamping to the nearest row", () => {
    expect(selectWorkItem({ raw: BASELINE, file: FILE, cbidx: 99 }).reason).toBe("out-of-range");
    expect(selectWorkItem({ raw: BASELINE, file: FILE, cbidx: -1 }).reason).toBe("out-of-range");
  });
});

describe("F-ID — a row inserted above the selection does not retarget it", () => {
  it("still resolves R-1 after R-9 is prepended, at its new ordinal", () => {
    const locator = must(selectR1(BASELINE).locator, "a locator");
    const resolved = resolveWorkRef({ raw: REORDERED, locator });
    const observation = must(resolved.observation, "an observation");

    expect(resolved.ok).toBe(true);
    expect(observation.alias).toBe("R-1");
    expect(observation.cbidx).toBe(1); // it moved
    expect(must(resolved.workRef, "a workRef").work_id).toBe(makeWorkRef(locator).work_id); // identity did not
  });

  it("counterexample: the ordinal alone now points at R-9 (Diagnosis D01)", () => {
    // The hazard is real, which is why nothing above resolves through cbidx.
    expect(parseWorkItems(BASELINE)[0].alias).toBe("R-1");
    expect(parseWorkItems(REORDERED)[0].alias).toBe("R-9");
  });

  it("keeps identity when the row moves to another section", () => {
    const locator = must(selectR1(BASELINE).locator, "a locator");
    const moved = BASELINE.replace(
      "- [ ] **R-1** Replace the mobile quick-amount preset 25 with 20 _(friction - S)_\n",
      "",
    ).replace(
      "## Next\n",
      "## Next\n\n- [ ] **R-1** Replace the mobile quick-amount preset 25 with 20 _(friction - S)_\n",
    );
    const resolved = resolveWorkRef({ raw: moved, locator });
    expect(resolved.ok).toBe(true);
    expect(must(resolved.observation, "an observation").section).toBe("Next");
  });
});

describe("F-ID — a duplicate human ID is a conflict, not a choice", () => {
  it("refuses to resolve an alias that names two rows", () => {
    const locator = must(selectR1(BASELINE).locator, "a locator");
    const resolved = resolveWorkRef({ raw: DUPLICATE, locator });
    expect(resolved.ok).toBe(false);
    expect(resolved.reason).toBe("ambiguous-alias");
    expect(resolved.candidates).toHaveLength(2);
    expect(resolved.workRef).toBeNull();
  });

  it("refuses at selection too, so no locator that can never resolve is ever minted", () => {
    const selection = selectWorkItem({ raw: DUPLICATE, file: FILE, cbidx: 0 });
    expect(selection.ok).toBe(false);
    expect(selection.reason).toBe("ambiguous-alias");
  });

  it("refuses an unaliased row whose text now appears twice", () => {
    const plain = must(parseWorkItems(BASELINE)[3], "the unaliased row");
    const locator = makeLocator({ file: FILE, textFingerprint: plain.textFingerprint });
    const twice = BASELINE + `\n- [ ]${plain.rest ? " " + plain.rest : ""}\n`;
    expect(resolveWorkRef({ raw: twice, locator }).reason).toBe("ambiguous-text");
  });

  it("refuses when the alias has gone away entirely", () => {
    const locator = must(selectR1(BASELINE).locator, "a locator");
    const removed = BASELINE.replace("**R-1**", "**R-42**");
    expect(resolveWorkRef({ raw: removed, locator }).reason).toBe("not-found");
  });
});

describe("F-ID — the click carries a witness, so a reorder cannot change what it meant", () => {
  const R1 = "- [ ] **R-1** Replace the mobile quick-amount preset 25 with 20 _(friction - S)_";
  const clicked = { alias: "R-1", line: R1 };
  const R1_CBIDX = must(
    parseWorkItems(BASELINE).find((item) => item.alias === "R-1"),
    "an R-1 row in the baseline",
  ).cbidx;
  const freezeWith = (overrides: Record<string, unknown> = {}) =>
    freezeSelectedItem({
      raw: BASELINE,
      file: FILE,
      cbidx: R1_CBIDX,
      witness: clicked,
      requestedDisposition: "verified_candidate",
      scratchScope: SCRATCH,
      publicationScope: PUBLICATION,
      ...overrides,
    });

  it("selects R-1 at its stale ordinal after R-9 is prepended", () => {
    const outcome = selectWorkItem({ raw: REORDERED, file: FILE, cbidx: R1_CBIDX, witness: clicked });
    expect(outcome.ok).toBe(true);
    expect(must(outcome.item, "the witnessed row").alias).toBe("R-1");
    // The ordinal the owner clicked names R-9 now.
    expect(parseWorkItems(REORDERED)[R1_CBIDX].alias).toBe("R-9");
  });

  it("refuses a missing or self-contradictory witness", () => {
    expect(selectWorkItem({ raw: BASELINE, file: FILE, cbidx: R1_CBIDX, witness: null }).reason).toBe(
      "missing-selection-witness",
    );
    expect(
      selectWorkItem({ raw: BASELINE, file: FILE, cbidx: R1_CBIDX, witness: { alias: "R-2", line: R1 } }).reason,
    ).toBe("missing-selection-witness");
  });

  it("refuses stale, unknown and duplicate witnessed selections", () => {
    expect(selectWorkItem({ raw: EDITED, file: FILE, cbidx: R1_CBIDX, witness: clicked }).reason).toBe("stale-source");
    expect(
      selectWorkItem({ raw: BASELINE, file: FILE, cbidx: R1_CBIDX, witness: { line: R1.replace("R-1", "R-77") } }).reason,
    ).toBe("not-found");
    expect(selectWorkItem({ raw: DUPLICATE, file: FILE, cbidx: R1_CBIDX, witness: clicked }).reason).toBe("ambiguous-alias");
  });

  it("refuses an unaliased row whose text appears twice, even at the clicked ordinal", () => {
    const row = "- [ ] A row with no ID chip at all, which can only be found by its own text";
    const raw = BASELINE.replace(row, row + "\n" + row);
    const cbidx = parseWorkItems(raw).findIndex((item) => item.alias === null);
    expect(selectWorkItem({ raw, file: FILE, cbidx, witness: { line: row } }).reason).toBe("ambiguous-text");
  });

  it("binds the Master Book acceptance revision, found by normalized ID", () => {
    const book = "## Acceptance Criteria Index\n\n### r-1\n\n- **Acceptance:** preset reads 20.\n";
    const frozen = freezeWith({ bookRaw: book });
    expect(frozen.ok).toBe(true);
    const workRef = must(frozen.workRef, "a WorkRef");
    const contract = must(frozen.contract, "a contract");
    expect(contract.acceptance_fingerprint).toBe(fingerprint(normalizeSourceText("- **Acceptance:** preset reads 20.")));

    expect(must(recheckContractSource({ raw: REORDERED, workRef, contract, bookRaw: book }).freshness, "freshness").fresh).toBe(
      true,
    );
    expect(
      recheckContractSource({ raw: BASELINE, workRef, contract, bookRaw: book.replace("reads 20", "reads 20 and says so") })
        .freshness,
    ).toMatchObject({ fresh: false, stale: ["acceptance"], obligation: "successor-revision-required" });
    // A bound revision nobody re-read cannot be confirmed.
    expect(must(recheckContractSource({ raw: BASELINE, workRef, contract }).freshness, "freshness").fresh).toBe(false);

    // No section binds "none"; a section added later stales it.
    const bare = freezeWith({ bookRaw: null });
    expect(must(bare.contract, "a contract").acceptance_fingerprint).toBe("none");
    expect(
      must(
        recheckContractSource({ raw: BASELINE, workRef: must(bare.workRef, "a WorkRef"), contract: must(bare.contract, "c"), bookRaw: book })
          .freshness,
        "freshness",
      ).fresh,
    ).toBe(false);

    // Unbound contracts keep their previous identity; bound ones do not collide with them.
    const unbound = freezeWith();
    expect(must(unbound.contract, "a contract").acceptance_fingerprint).toBeNull();
    expect(must(unbound.contract, "a contract").contract_id).not.toBe(contract.contract_id);
  });

  it("refuses two Master Book sections for one ID", () => {
    const book = "### R-1\n\nFirst.\n\n### r-1\n\nSecond.\n";
    expect(freezeWith({ bookRaw: book }).reason).toBe("ambiguous-acceptance");
  });
});

describe("deterministic re-resolution", () => {
  it("re-reading identical content yields the same mapping and revision", () => {
    const locator = must(selectR1(BASELINE).locator, "a locator");
    const first = resolveWorkRef({ raw: BASELINE, locator });
    const second = resolveWorkRef({ raw: BASELINE, locator });
    expect(second.workRef).toEqual(first.workRef);
    expect(must(second.workRef, "a workRef").mapping_revision).toBe(1);
  });

  it("selecting the same row twice yields the same contract id", () => {
    const args = {
      raw: BASELINE,
      file: FILE,
      cbidx: 0,
      requestedDisposition: "verified_candidate",
      scratchScope: SCRATCH,
      publicationScope: PUBLICATION,
    };
    expect(freezeSelectedItem(args).contract).toEqual(freezeSelectedItem(args).contract);
  });

  it("only an explicit rebind moves the mapping revision, and never the identity", () => {
    const locator = must(selectR1(BASELINE).locator, "a locator");
    const workRef = makeWorkRef(locator);
    expect(rebindWorkRef(workRef, locator).mapping_revision).toBe(2);
    expect(rebindWorkRef(workRef, locator).work_id).toBe(workRef.work_id);
    const otherFile = makeLocator({ ...locator, file: "Other/4 - Checklist.md" });
    expect(() => rebindWorkRef(workRef, otherFile)).toThrow(ContractError);
  });
});

describe("F-ID — editing the selected item obliges a successor revision", () => {
  it("refuses to resolve the edited row as the authorized one", () => {
    const locator = must(selectR1(BASELINE).locator, "a locator");
    const resolved = resolveWorkRef({ raw: EDITED, locator });
    expect(resolved.ok).toBe(false);
    expect(resolved.reason).toBe("stale-source");
    expect(must(resolved.observation, "the edited row").text).toContain("Remove the mobile quick-amount preset row");
  });

  it("reports the obligation rather than silently re-binding the contract", () => {
    const frozen = freezeSelectedItem({
      raw: BASELINE,
      file: FILE,
      cbidx: 0,
      requestedDisposition: "verified_candidate",
      scratchScope: SCRATCH,
      publicationScope: PUBLICATION,
    });
    const workRef = must(frozen.workRef, "a workRef");
    const contract = must(frozen.contract, "a contract");

    expect(recheckContractSource({ raw: BASELINE, workRef, contract }).freshness?.fresh).toBe(true);

    const recheck = recheckContractSource({ raw: EDITED, workRef, contract });
    expect(recheck.resolved).toBe(false);
    expect(recheck.reason).toBe("stale-source");
    expect(recheck.freshness?.obligation).toBe("successor-revision-required");
  });

  it("discharges the obligation with a linked revision 2, leaving revision 1 untouched", () => {
    const frozen = freezeSelectedItem({
      raw: BASELINE,
      file: FILE,
      cbidx: 0,
      requestedDisposition: "verified_candidate",
      scratchScope: SCRATCH,
      publicationScope: PUBLICATION,
    });
    const first = must(frozen.contract, "a contract");
    const edited = must(
      parseWorkItems(EDITED).find((item) => item.alias === "R-1"),
      "the edited R-1",
    );
    const second = reviseContract(first, {
      source_fingerprint: edited.textFingerprint,
      outcome: edited.text,
      revision_reason: "owner edited the item intent after authorization",
    });

    expect(second.revision).toBe(2);
    expect(second.supersedes).toBe(first.contract_id);
    expect(second.contract_id).not.toBe(first.contract_id);
    expect(first.revision).toBe(1);
    expect(contractFreshness(second, edited.textFingerprint).fresh).toBe(true);
  });

  it("cannot be discharged by mutating the frozen contract in place", () => {
    const contract = authorizeContract({
      work_id: "w-test",
      source_fingerprint: fingerprint("x"),
      outcome: "do the thing",
      scratchScope: SCRATCH,
      publicationScope: PUBLICATION,
      requestedDisposition: "verified_candidate",
    });
    expect(() => {
      (contract as unknown as { source_fingerprint: string }).source_fingerprint = fingerprint("y");
    }).toThrow(TypeError);
    expect(() => reviseContract(contract, { revision_reason: "" })).toThrow(ContractError);
  });

  it("an unrelated row changing in the same file does not stale the contract", () => {
    const frozen = freezeSelectedItem({
      raw: BASELINE,
      file: FILE,
      cbidx: 0,
      requestedDisposition: "verified_candidate",
      scratchScope: SCRATCH,
      publicationScope: PUBLICATION,
    });
    const elsewhere = BASELINE.replace("laptop is asleep", "laptop is asleep or offline");
    const recheck = recheckContractSource({
      raw: elsewhere,
      workRef: must(frozen.workRef, "a workRef"),
      contract: must(frozen.contract, "a contract"),
    });
    expect(recheck.resolved).toBe(true);
    expect(recheck.freshness?.fresh).toBe(true);
  });
});

describe("F-RESULT — requested deployment stays requested deployment", () => {
  const deployCriterion = makeCriterion({
    criterion_id: "AC-deployed",
    proposition: "the fix is observable on the deployed build",
    scope: { environment: "production", scenario: "mobile quick-amount row" },
    observer: { kind: "attributed", expected: { displayed: "20" } },
    oracle_ref: "selected item revision",
    freshness_inputs: ["deployed-build"],
    required_for: "disposition",
    forbidden_substitutes: ["command", "source_match"],
  });

  const frozen = freezeSelectedItem({
    raw: BASELINE,
    file: FILE,
    cbidx: 0,
    requestedDisposition: "verified_deployment",
    criteria: [deployCriterion],
    scratchScope: SCRATCH,
    publicationScope: PUBLICATION,
  });

  it("records the requested destination verbatim, whatever the executor can reach", () => {
    const contract = must(frozen.contract, "a contract");
    expect(contract.requestedDisposition).toBe("verified_deployment");
    expect(contract.criteria_refs).toEqual([{ criterion_id: "AC-deployed", revision: 1 }]);
  });

  it("a verified candidate leaves the deployment outstanding, it does not complete the work", () => {
    const contract = must(frozen.contract, "a contract");
    const obligations = dispositionObligations(contract, {
      observedDisposition: "verified_candidate",
      criterionStates: [{ criterion_id: "AC-deployed", required_for: "disposition", state: "missing" }],
    });

    expect(obligations.satisfied).toBe(false);
    expect(obligations.requestedDisposition).toBe("verified_deployment");
    expect(obligations.observedDisposition).toBe("verified_candidate");
    expect(obligations.outstanding).toEqual([
      { kind: "criterion", criterion_id: "AC-deployed", state: "missing" },
      { kind: "disposition", requested: "verified_deployment", observed: "verified_candidate" },
    ]);
  });

  it("only an observed deployment with its evidence closes it", () => {
    const contract = must(frozen.contract, "a contract");
    expect(
      dispositionObligations(contract, {
        observedDisposition: "verified_deployment",
        criterionStates: [{ criterion_id: "AC-deployed", required_for: "disposition", state: "satisfied" }],
      }).satisfied,
    ).toBe(true);
  });

  it("an owner waiver is not a satisfied criterion", () => {
    const contract = must(frozen.contract, "a contract");
    expect(
      dispositionObligations(contract, {
        observedDisposition: "verified_deployment",
        criterionStates: [{ criterion_id: "AC-deployed", required_for: "disposition", state: "waived" }],
      }).satisfied,
    ).toBe(false);
  });

  it("cannot be downgraded to a candidate-only promise without an owner decision", () => {
    const contract = must(frozen.contract, "a contract");
    expect(() =>
      reviseContract(contract, {
        requestedDisposition: "verified_candidate",
        revision_reason: "no qualified application path exists yet",
      }),
    ).toThrow(ContractError);

    const decided = reviseContract(contract, {
      requestedDisposition: "verified_candidate",
      revision_reason: "owner accepted a candidate-only endpoint for this item",
      owner_decision_ref: "d-owner-0007",
    });
    expect(decided.requestedDisposition).toBe("verified_candidate");
    expect(decided.owner_decision_ref).toBe("d-owner-0007");
    expect(contract.requestedDisposition).toBe("verified_deployment");
  });
});
