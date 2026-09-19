import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { freezeCandidate } from "../../scripts/delivery-v2/candidate.mjs";
import { candidateReview } from "../../scripts/delivery-v2/review.mjs";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function setup() {
  const root = mkdtempSync(join(tmpdir(), "delivery-review-"));
  roots.push(root);
  const sourceRoot = join(root, "source"),
    next = join(root, "candidate"),
    journal = join(root, "journal");
  for (const path of [sourceRoot, next, join(journal, "before")])
    mkdirSync(path, { recursive: true });
  writeFileSync(join(sourceRoot, "work.txt"), "old\n");
  writeFileSync(join(next, "work.txt"), "new\n");
  const base = freezeCandidate({ root: sourceRoot });
  const candidate = freezeCandidate({
    root: next,
    base_manifest: [...base.manifest],
  });
  return { root, sourceRoot, next, candidate, journal };
}
describe("frozen candidate review", () => {
  it("shows the exact base-to-candidate change when source bytes match the recorded hash", () => {
    const fixture = setup();
    const [file] = candidateReview(fixture);
    expect(file.review.state).toBe("available");
    expect(file.review.diff).toContain("-old\n+new");
    expect(file.review.beforeHash).not.toBe(file.review.afterHash);
  });
  it("never presents later checkout edits as the candidate's before-image", () => {
    const fixture = setup();
    writeFileSync(join(fixture.sourceRoot, "work.txt"), "owner edit\n");
    const [file] = candidateReview(fixture);
    expect(file.review.reason).toBe("base-unavailable");
    expect(file.review.diff).toBeUndefined();
  });
  it("recovers a verified before-image from the candidate's own application journal", () => {
    const f = setup();
    writeFileSync(join(f.sourceRoot, "work.txt"), "new\n");
    writeFileSync(join(f.journal, "before/0.bin"), "old\n");
    const applications = [
      {
        candidate_id: f.candidate.candidate_id,
        journal_dir: f.journal,
        plan: {
          ops: [
            {
              path: "work.txt",
              index: 0,
              before: f.candidate.base_manifest[0].sha256,
              after: f.candidate.manifest[0].sha256,
            },
          ],
        },
      },
    ];
    expect(candidateReview({ ...f, applications })[0].review.diff).toContain(
      "-old\n+new",
    );
    writeFileSync(join(f.journal, "before/0.bin"), "tampered\n");
    expect(candidateReview({ ...f, applications })[0].review.state).toBe(
      "unavailable",
    );
  });
  it("refuses tampered candidate bytes", () => {
    const f = setup();
    writeFileSync(join(f.next, "work.txt"), "tampered");
    expect(candidateReview(f)[0].review.reason).toBe("hash-mismatch");
  });
  it("represents creations and deletions against absence, including missing final newlines", () => {
    const f = setup();
    writeFileSync(join(f.next, "created.txt"), "created");
    rmSync(join(f.next, "work.txt"));
    const candidate = freezeCandidate({
      root: f.next,
      base_manifest: [...f.candidate.base_manifest],
    });
    const files = candidateReview({ ...f, candidate });
    expect(files[0].kind).toBe("add");
    expect(files[0].review.beforeHash).toBeNull();
    expect(files[0].review.diff).toContain("\\ No newline at end of file");
    expect(files[1].kind).toBe("delete");
    expect(files[1].review.afterHash).toBeNull();
  });
  it("labels binary and oversized files instead of publishing partial text", () => {
    const f = setup();
    writeFileSync(join(f.next, "work.txt"), Buffer.from([0, 1, 2]));
    let candidate = freezeCandidate({
      root: f.next,
      base_manifest: [...f.candidate.base_manifest],
    });
    expect(candidateReview({ ...f, candidate })[0].review.reason).toBe(
      "binary",
    );
    writeFileSync(join(f.next, "work.txt"), "a".repeat(150000));
    candidate = freezeCandidate({
      root: f.next,
      base_manifest: [...f.candidate.base_manifest],
    });
    expect(candidateReview({ ...f, candidate })[0].review.reason).toBe(
      "too-large",
    );
  });
});
