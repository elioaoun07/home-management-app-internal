// DLV-73 unit tests: the deterministic half of the INSTANT lane.
//
// These assertions are the entire safety argument for skipping the REVIEWING and
// UAT_PREP model turns, so they are written from the escalation side: for each
// way a diff can fail to be "the small declared edit the owner approved", the
// verifier must say so. A false `ok: true` here is a change shipped without any
// review at all.
import { describe, expect, it } from "vitest";

import {
  INSTANT_FAILURES,
  InstantError,
  buildInstantUat,
  normalizeDeclaredEdit,
  parseUnifiedDiff,
  unquoteGitPath,
  verifyInstantEdit,
} from "../../scripts/delivery/instant.mjs";

const TARGET = "src/components/expense/MobileExpenseForm.tsx";
const BEFORE = 'const QUICK_AMOUNTS = ["5", "10", "25", "50", "100"];';
const AFTER = 'const QUICK_AMOUNTS = ["5", "10", "20", "50", "100"];';
const EDIT = { path: TARGET, anchor: 1144, before: BEFORE, after: AFTER };

function diffFor(path: string, removed: string[], added: string[]) {
  return [`--- a/${path}`, `+++ b/${path}`, ...removed.map((l) => `-${l}`), ...added.map((l) => `+${l}`)].join("\n");
}
const CLEAN = diffFor(TARGET, [`  ${BEFORE}`], [`  ${AFTER}`]);

describe("normalizeDeclaredEdit", () => {
  it("accepts a well-formed edit and normalizes separators", () => {
    expect(normalizeDeclaredEdit({ ...EDIT, path: "src\\components\\x.tsx" })).toMatchObject({
      path: "src/components/x.tsx",
      anchor: 1144,
    });
  });

  it("allows an empty before — a pure insertion removes nothing", () => {
    expect(normalizeDeclaredEdit({ path: "a.ts", before: "", after: "x" })).toMatchObject({ before: "", after: "x" });
  });

  it("rejects an empty after, which would make verification pass vacuously", () => {
    expect(normalizeDeclaredEdit({ path: "a.ts", before: "x", after: "   " })).toBeNull();
    expect(normalizeDeclaredEdit({ path: "a.ts", before: "x" })).toBeNull();
  });

  it("rejects anything without a path", () => {
    expect(normalizeDeclaredEdit({ before: "x", after: "y" })).toBeNull();
    expect(normalizeDeclaredEdit(null)).toBeNull();
    expect(normalizeDeclaredEdit("src/a.ts")).toBeNull();
  });

  it("drops a non-integer or non-positive anchor rather than trusting it", () => {
    expect(normalizeDeclaredEdit({ ...EDIT, anchor: 0 })?.anchor).toBeNull();
    expect(normalizeDeclaredEdit({ ...EDIT, anchor: 12.5 })?.anchor).toBeNull();
    expect(normalizeDeclaredEdit({ ...EDIT, anchor: "1144" })?.anchor).toBeNull();
  });
});

describe("parseUnifiedDiff", () => {
  it("separates content lines from file headers", () => {
    const parsed = parseUnifiedDiff(CLEAN);
    expect(parsed.added).toEqual([`  ${AFTER}`]);
    expect(parsed.removed).toEqual([`  ${BEFORE}`]);
    // The two `---`/`+++` headers must not be counted as changed content — doing
    // so would inflate every diff by two lines per file.
    expect(parsed.changedLines).toBe(2);
    expect(parsed.files).toEqual([TARGET]);
  });

  it("records the file of a deletion, whose +++ side is /dev/null", () => {
    const parsed = parseUnifiedDiff([`--- a/${TARGET}`, "+++ /dev/null", "-gone"].join("\n"));
    expect(parsed.files).toEqual([TARGET]);
  });

  it("reports every file a multi-file diff touches", () => {
    const parsed = parseUnifiedDiff(`${CLEAN}\n${diffFor("src/other.ts", ["a"], ["b"])}`);
    expect(parsed.files).toEqual([TARGET, "src/other.ts"]);
  });

  it("returns empty for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual({ added: [], removed: [], changedLines: 0, files: [] });
  });

  // Regression, s-20260801-094951-jx8o: a deleted SQL migration full of `-- …`
  // comments rendered every one of them as `--- …`, and the old reader filed
  // dozens of comment sentences as touched "files" while dropping the same lines
  // out of `removed` — so a `before` match could fail on a diff containing it.
  it("treats a removed line beginning with -- as content, not a file header", () => {
    const parsed = parseUnifiedDiff(
      [
        "diff --git a/migrations/drop.sql b/migrations/drop.sql",
        "deleted file mode 100644",
        "--- a/migrations/drop.sql",
        "+++ /dev/null",
        "@@ -1,2 +0,0 @@",
        "--- WHAT: Narrow `pm_commands.type` — drop 'tick'.",
        "--- WHY:  a stray tap must not mark work done.",
      ].join("\n"),
    );
    expect(parsed.files).toEqual(["migrations/drop.sql"]);
    expect(parsed.removed).toEqual([
      "-- WHAT: Narrow `pm_commands.type` — drop 'tick'.",
      "-- WHY:  a stray tap must not mark work done.",
    ]);
    expect(parsed.changedLines).toBe(2);
  });

  it("does not mistake added content beginning with ++ for a file header", () => {
    const parsed = parseUnifiedDiff(
      ["--- a/src/a.ts", "+++ b/src/a.ts", "@@ -1 +1 @@", "-for (;;) i--;", "+++i;"].join("\n"),
    );
    expect(parsed.files).toEqual(["src/a.ts"]);
    expect(parsed.added).toEqual(["++i;"]);
    expect(parsed.changedLines).toBe(2);
  });

  // Git C-quotes any path with a non-ASCII byte. Both sides decode to the same
  // real path, so it must be reported once, not as two unknown files.
  it("decodes a git-quoted non-ASCII path once, not as separate a/ and b/ files", () => {
    const quoted = '"ERA Notes/10 - Project Management/Delivery/Delivery \\342\\200\\224 Master Book.md"';
    const parsed = parseUnifiedDiff(
      [`--- "a/${quoted.slice(1)}`, `+++ "b/${quoted.slice(1)}`, "@@ -1 +1 @@", "-old", "+new"].join("\n"),
    );
    expect(parsed.files).toEqual([
      "ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md",
    ]);
  });
});

describe("unquoteGitPath", () => {
  it("decodes octal-escaped UTF-8, which JSON.parse cannot", () => {
    expect(unquoteGitPath('"ERA Notes/Delivery \\342\\200\\224 Master Book.md"')).toBe(
      "ERA Notes/Delivery — Master Book.md",
    );
  });

  it("leaves an unquoted path alone apart from separator normalization", () => {
    expect(unquoteGitPath("src\\components\\x.tsx")).toBe("src/components/x.tsx");
    expect(unquoteGitPath("src/components/x.tsx")).toBe("src/components/x.tsx");
  });

  it("decodes the ordinary C escapes git also emits", () => {
    expect(unquoteGitPath('"a\\tb.txt"')).toBe("a\tb.txt");
    expect(unquoteGitPath('"say \\"hi\\".txt"')).toBe('say "hi".txt');
  });

  it("survives empty and malformed input rather than throwing", () => {
    expect(unquoteGitPath("")).toBe("");
    expect(unquoteGitPath(null)).toBe("");
    expect(unquoteGitPath('"unterminated')).toBe('"unterminated');
  });
});

describe("verifyInstantEdit", () => {
  const base = { declaredEdit: EDIT, changedFiles: [TARGET], diffText: CLEAN, scopeLockPaths: [TARGET] };

  it("passes the clean single-line case", () => {
    const result = verifyInstantEdit(base);
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.changedLines).toBe(2);
    expect(result.declaredPath).toBe(TARGET);
  });

  it("passes on whitespace differences — indentation is not semantic", () => {
    const reindented = diffFor(TARGET, [`      ${BEFORE}`], [`      ${AFTER}`]);
    expect(verifyInstantEdit({ ...base, diffText: reindented }).ok).toBe(true);
  });

  it("refuses when there is no declaredEdit to verify against", () => {
    const result = verifyInstantEdit({ ...base, declaredEdit: null });
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.code)).toEqual([INSTANT_FAILURES.NO_DECLARED_EDIT]);
  });

  it("catches a diff that touches a file the plan never named", () => {
    const twoFiles = `${CLEAN}\n${diffFor("src/other.ts", ["a"], ["b"])}`;
    const codes = verifyInstantEdit({ ...base, diffText: twoFiles }).failures.map((f) => f.code);
    expect(codes).toContain(INSTANT_FAILURES.UNDECLARED_FILE);
  });

  it("catches a file outside the post-plan scope lock", () => {
    const codes = verifyInstantEdit({ ...base, scopeLockPaths: ["src/features/other/**"] }).failures.map((f) => f.code);
    expect(codes).toContain(INSTANT_FAILURES.OUTSIDE_SCOPE_LOCK);
  });

  it("catches a diff above the lane's ceiling", () => {
    const big = diffFor(
      TARGET,
      Array.from({ length: 15 }, (_, i) => `old ${i}`),
      Array.from({ length: 15 }, (_, i) => `new ${i}`),
    );
    const result = verifyInstantEdit({ ...base, diffText: big, maxDiffLines: 20 });
    expect(result.failures.map((f) => f.code)).toContain(INSTANT_FAILURES.DIFF_TOO_LARGE);
    expect(result.changedLines).toBe(30);
  });

  it("catches an edit that replaced something other than what was declared", () => {
    const wrong = diffFor(TARGET, ["const SOMETHING_ELSE = 1;"], [`  ${AFTER}`]);
    expect(verifyInstantEdit({ ...base, diffText: wrong }).failures.map((f) => f.code)).toContain(
      INSTANT_FAILURES.BEFORE_NOT_REMOVED,
    );
  });

  it("catches an edit that wrote something other than what was declared", () => {
    const wrong = diffFor(TARGET, [`  ${BEFORE}`], ['const QUICK_AMOUNTS = ["5", "10", "99", "50", "100"];']);
    expect(verifyInstantEdit({ ...base, diffText: wrong }).failures.map((f) => f.code)).toContain(
      INSTANT_FAILURES.AFTER_NOT_ADDED,
    );
  });

  it("escalates when validation needed a fix loop — the first attempt was wrong", () => {
    // The session that needed fixing is precisely the one worth a human review,
    // so a green-on-retry build must never take the deterministic shortcut.
    const codes = verifyInstantEdit({ ...base, fixLoop: 1 }).failures.map((f) => f.code);
    expect(codes).toContain(INSTANT_FAILURES.FIX_LOOP_USED);
  });

  it("catches a build that changed nothing", () => {
    const codes = verifyInstantEdit({ ...base, diffText: "", changedFiles: [] }).failures.map((f) => f.code);
    expect(codes).toContain(INSTANT_FAILURES.NO_CHANGES);
  });

  it("reports every failure, not just the first", () => {
    // A caller escalating to the real review wants the whole list.
    const result = verifyInstantEdit({ ...base, diffText: diffFor("src/other.ts", ["a"], ["b"]), fixLoop: 2 });
    const codes = result.failures.map((f) => f.code);
    expect(codes).toContain(INSTANT_FAILURES.UNDECLARED_FILE);
    expect(codes).toContain(INSTANT_FAILURES.BEFORE_NOT_REMOVED);
    expect(codes).toContain(INSTANT_FAILURES.FIX_LOOP_USED);
    expect(codes.length).toBeGreaterThan(2);
  });

  it("trusts the diff over an empty changedFiles list", () => {
    // The diff is the authoritative record of what changed; `changedFiles` is
    // corroboration that may legitimately be empty.
    expect(verifyInstantEdit({ ...base, changedFiles: [] }).ok).toBe(true);
  });
});

describe("buildInstantUat", () => {
  const spec = { proposedBehavior: "the chip shows 20", acceptanceCriteria: [{ id: "AC1", text: "chip shows 20" }] };
  const verification = { ok: true, failures: [], changedLines: 2, declaredPath: TARGET };

  it("emits an evidence pointer the runner can actually resolve", () => {
    // Prose here is silently downgraded to `unmet` by reconcileAcceptance, which
    // parked every early INSTANT session on an acceptance question.
    const uat = buildInstantUat({ spec, plan: {}, declaredEdit: EDIT, verification, changedFiles: [TARGET] });
    expect(uat.acceptanceCriteria[0]).toMatchObject({ id: "AC1", status: "met", evidence: `${TARGET}:1144` });
    expect(uat.acceptanceCriteria[0].note).toContain("deterministic");
  });

  it("falls back to the bare path when the edit carries no anchor", () => {
    const uat = buildInstantUat({ spec, plan: {}, declaredEdit: { ...EDIT, anchor: null }, verification });
    expect(uat.acceptanceCriteria[0].evidence).toBe(TARGET);
  });

  it("carries the turn's own manual steps through unchanged", () => {
    const steps = [{ action: "Open /expense", expected: "chip reads 20" }];
    const uat = buildInstantUat({ spec, plan: {}, declaredEdit: EDIT, verification, manualSteps: steps });
    expect(uat.manualSteps).toEqual(steps);
  });

  it("drops malformed manual steps rather than emitting a broken UAT script", () => {
    const uat = buildInstantUat({
      spec, plan: {}, declaredEdit: EDIT, verification,
      manualSteps: [{ action: "ok", expected: "fine" }, { action: "no expected" }, null] as never,
    });
    expect(uat.manualSteps).toEqual([{ action: "ok", expected: "fine" }]);
  });

  it("never claims `met` when verification did not pass", () => {
    const failed = { ok: false, failures: [{ code: "x", message: "y" }], changedLines: 40, declaredPath: TARGET };
    const uat = buildInstantUat({ spec, plan: {}, declaredEdit: EDIT, verification: failed });
    expect(uat.acceptanceCriteria[0].status).toBe("unmet");
    expect(uat.acceptanceCriteria[0].evidence).toBeNull();
  });

  it("refuses to build a UAT package around an invalid edit", () => {
    expect(() => buildInstantUat({ spec, plan: {}, declaredEdit: { path: "" }, verification })).toThrow(InstantError);
  });
});
