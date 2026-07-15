import { describe, expect, it } from "vitest";
import { lintChecklist } from "../../scripts/pm/lint.mjs";

const FM = "---\nstatus: active\nupdated: 2026-07-15\n---\n";
const rules = (findings: { rule: string }[]) => findings.map((f) => f.rule);

describe("lintChecklist", () => {
  it("passes a canonical checklist", () => {
    const raw = `${FM}# Budget · 4 — Checklist\n\n## Now\n- [ ] **BUD-1** Do the thing _(blocker - M)_\n\n## Next\n- [ ] **BUD-2** Next thing _(friction - S)_\n\n## Later\n- [ ] **BUD-3** Later thing _(parked - L)_\n\n## Definition of Done\n- [ ] **D1** It is done.\n`;
    expect(lintChecklist(raw, { campaign: "Budget" })).toEqual([]);
  });

  it("flags emoji severity, effort ranges, and the `H` effort", () => {
    const raw = `${FM}## Now\n- [ ] **HUB-1** Emoji meta _(🔴 · M)_\n\n## Next\n- [ ] **HUB-2** Range effort _(annoyance - S-M)_\n\n## Later\n- [ ] **HUB-3** Big _(friction - H)_\n`;
    const r = lintChecklist(raw, { campaign: "Hub & ERA" });
    expect(r.filter((f) => f.rule === "E3").length).toBe(3);
  });

  it("flags a wrong / missing ID prefix", () => {
    const raw = `${FM}## Now\n- [ ] **1.2** No prefix _(blocker - S)_\n\n## Next\n- [ ] **BUD-9** Wrong campaign _(friction - S)_\n\n## Later\n- [ ] **KIT-1** Right _(parked - M)_\n`;
    const r = lintChecklist(raw, { campaign: "Kitchen" });
    expect(r.some((f) => f.rule === "E4")).toBe(true);
    expect(r.some((f) => f.rule === "E3")).toBe(true); // **1.2** isn't a valid ID chip
  });

  it("flags duplicate IDs and missing lanes", () => {
    const raw = `${FM}## Now\n- [ ] **TRIP-1** A _(blocker - S)_\n- [ ] **TRIP-1** Dup _(friction - S)_\n`;
    const r = lintChecklist(raw, { campaign: "Trips" });
    expect(r.some((f) => f.rule === "E4" && /duplicate/.test(f.message))).toBe(true);
    expect(rules(r)).toContain("E2"); // missing Next / Later
  });

  it("flags a checkbox outside any lane and a nested checkbox", () => {
    const raw = `${FM}## Random\n- [ ] **BUD-1** Orphan _(blocker - S)_\n\n## Now\n- [ ] **BUD-2** Ok _(blocker - S)_\n  - [ ] **BUD-3** Nested _(friction - S)_\n\n## Next\n\n## Later\n`;
    const r = lintChecklist(raw, { campaign: "Budget" });
    expect(r.some((f) => f.rule === "E2" && /not under/.test(f.message))).toBe(true);
    expect(r.some((f) => f.rule === "E3" && /nested/.test(f.message))).toBe(true);
  });

  it("resolves links via injected resolvers (E5)", () => {
    const raw = `${FM}## Now\n- [ ] **BUD-1** See [x](<../Missing/1.md>) and \`src/gone.ts\` _(blocker - S)_\n\n## Next\n\n## Later\n`;
    const r = lintChecklist(raw, {
      campaign: "Budget",
      resolveMd: () => false,
      resolveCode: () => false,
    });
    expect(r.filter((f) => f.rule === "E5").length).toBe(2);
  });
});
