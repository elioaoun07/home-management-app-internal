import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertExpectedCheckbox,
  assertRestoreCurrent,
  guardUndo,
} from "../../scripts/pm/write-guards.mjs";
import { restoreSnapshots } from "../../scripts/pm/archive.mjs";
const roots: string[] = [];
const statusOf = (write: () => void) => {
  try {
    write();
    return null;
  } catch (error) {
    return (error as { status?: number }).status ?? "thrown";
  }
};
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "era-pm-undo-"));
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
describe("local outcome write witnesses", () => {
  it("rejects an ordinal that moved to another otherwise-open outcome", () => {
    const a = "- [ ] **R51** Original _(friction - M)_",
      b = "- [ ] **R52** New _(friction - M)_";
    expect(() =>
      assertExpectedCheckbox("## Now\r\n" + b + "\r\n" + a, 0, a),
    ).toThrow(/changed/);
    expect(() =>
      assertExpectedCheckbox("## Now\r\n" + b + "\r\n" + a, 1, a),
    ).not.toThrow();
  });
  it("refuses a required write that carries no witness", () => {
    const a = "- [ ] **R51** Original _(friction - M)_";
    expect(
      statusOf(() =>
        assertExpectedCheckbox("## Now\n" + a, 0, undefined, { required: true }),
      ),
    ).toBe(428);
  });
  it("keeps a reordered selection on its intended row or refuses", () => {
    const a = "- [ ] **R51** Original _(friction - M)_",
      b = "- [ ] **R52** Prepended _(friction - M)_";
    const after = ["## Now", b, a].join("\n");
    // The stale ordinal now names B; it cannot be written as A.
    expect(
      statusOf(() =>
        assertExpectedCheckbox(after, 0, a, { required: true, expectId: "R51" }),
      ),
    ).toBe(409);
    expect(
      statusOf(() =>
        assertExpectedCheckbox(after, 1, a, { required: true, expectId: "r51" }),
      ),
    ).toBeNull();
  });
  it("refuses unknown ordinals, mismatched IDs and duplicate IDs", () => {
    const a = "- [ ] **R51** Original _(friction - M)_";
    const twin = "- [ ] **R51** Copy _(friction - M)_";
    expect(
      statusOf(() => assertExpectedCheckbox("## Now\n" + a, 3, a, { required: true })),
    ).toBe(409);
    expect(
      statusOf(() =>
        assertExpectedCheckbox("## Now\n" + a, 0, a, { required: true, expectId: "R52" }),
      ),
    ).toBe(409);
    expect(
      statusOf(() =>
        assertExpectedCheckbox(["## Now", a, twin].join("\n"), 0, a, { required: true }),
      ),
    ).toBe(409);
  });
  it("takes the post-write witness and restores only while it still matches", () => {
    const root = fixture();
    writeFileSync(join(root, "a.md"), "after");
    const reply = guardUndo(root, { undo: [{ path: "a.md", raw: "before" }] });
    expect(reply.undo[0].expectCurrent).toBe("after");
    assertRestoreCurrent(root, reply.undo);
    restoreSnapshots(root, reply.undo);
    expect(readFileSync(join(root, "a.md"), "utf8")).toBe("before");
  });
  it("rejects a whole batch before writing when a receipt changed externally", () => {
    const root = fixture();
    writeFileSync(join(root, "a.md"), "after");
    writeFileSync(join(root, "b.md"), "new receipt");
    const reply = guardUndo(root, {
      undo: [
        { path: "a.md", raw: "before" },
        { path: "b.md", raw: "old receipt" },
      ],
    });
    writeFileSync(join(root, "b.md"), "owner edit");
    expect(() => {
      assertRestoreCurrent(root, reply.undo);
      restoreSnapshots(root, reply.undo);
    }).toThrow(/newer edit/);
    expect(readFileSync(join(root, "a.md"), "utf8")).toBe("after");
    expect(readFileSync(join(root, "b.md"), "utf8")).toBe("owner edit");
  });
  it("guards first-created files and refuses escaping the PM root", () => {
    const root = fixture();
    writeFileSync(join(root, "cancelled.md"), "receipt");
    const reply = guardUndo(root, {
      undo: [{ path: "cancelled.md", raw: null }],
    });
    writeFileSync(join(root, "cancelled.md"), "owner edit");
    expect(() => assertRestoreCurrent(root, reply.undo)).toThrow(/newer edit/);
    expect(() =>
      assertRestoreCurrent(root, [
        { path: "../outside.md", raw: "x", expectCurrent: null },
      ]),
    ).toThrow();
  });
});
