// PM Delivery V2 — S1.1 fixtures: the scratch boundary, against real files.
//
// F-ISOLATION from "PM Delivery — Evidence & Autonomy.md" §9 and the snapshot
// rules in "PM Delivery — V2 Architecture.md" §8. Everything here runs on real
// disk in a disposable directory, including a real Windows junction, because the
// property under test is what the filesystem actually does — a mocked `lstat`
// would prove only that the mock was written to agree with the code.
//
// Two halves, and the second is the one that makes the first mean anything:
//
//   1. ERA's own boundary — the trusted loader and the scratch provisioner. This
//      is the part ERA owns and can enforce, and it is fully proven here.
//   2. The canary battery that will later be pointed at the *backend's* sandbox.
//      Run with no confinement at all, every containment canary must escape. A
//      battery that cannot detect an escape cannot certify containment, so this
//      is a precondition for believing any future "denied" result.
//
// What is NOT proven here: that Codex's Windows sandbox stops any of this. That
// needs the backend's sandbox to actually run the battery, which is
// probes/codex-qualification.mjs's job and is recorded as unobserved.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ContractError } from "../../scripts/delivery-v2/contracts.mjs";
import {
  SCRATCH_REFUSALS,
  assertScratchOutsideHost,
  classifyRelativePath,
  findNameCollisions,
  provisionScratch,
  resolveInside,
  walkTrusted,
  writeInsideScratch,
} from "../../scripts/delivery-v2/scratch.mjs";
import {
  candidateChangedPaths,
  candidateFreshness,
  checkPublicationScope,
  freezeCandidate,
  rejectWorkerIdentity,
} from "../../scripts/delivery-v2/candidate.mjs";
import { CANARY_NAMES, runCanary } from "../../scripts/delivery-v2/probes/canary.mjs";
import {
  classifyControls,
  permissionProfileToml,
  validateNegativeControl,
} from "../../scripts/delivery-v2/probes/codex-qualification.mjs";

let ROOT: string;
let HOST: string;
let SCRATCH: string;
/** Did the OS let us build a junction? Recorded, never assumed. */
let LINKED = false;

beforeAll(() => {
  ROOT = mkdtempSync(join(tmpdir(), "era-v2-isolation-"));
  HOST = join(ROOT, "host");
  SCRATCH = join(ROOT, "scratch");
  mkdirSync(join(HOST, "src", "features"), { recursive: true });
  mkdirSync(join(HOST, ".git"), { recursive: true });
  mkdirSync(join(HOST, "secrets"), { recursive: true });
  mkdirSync(SCRATCH, { recursive: true });

  writeFileSync(join(HOST, "src", "features", "amount.ts"), "export const QUICK = 25;\n", "utf8");
  writeFileSync(join(HOST, "src", "features", "other.ts"), "export const OTHER = true;\n", "utf8");
  writeFileSync(join(HOST, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");
  writeFileSync(join(HOST, ".env.local"), "SUPABASE_SERVICE_ROLE_KEY=canary\n", "utf8");
  writeFileSync(join(HOST, "secrets", "prod.pem"), "-----BEGIN PRIVATE KEY-----\n", "utf8");
  // An innocuously named file in the private area. The link fixture below reads
  // *this* one, so the refusal it observes is the reparse point and not the
  // credential-shaped filename, which would refuse a `.pem` on its own.
  writeFileSync(join(HOST, "secrets", "notes.txt"), "nothing suspicious about this name\n", "utf8");

  try {
    // "junction" needs no elevation on Windows and degrades to a directory
    // symlink elsewhere. Either way it is a real reparse point on this disk.
    symlinkSync(join(HOST, "secrets"), join(SCRATCH, "linked-secrets"), "junction");
    LINKED = true;
  } catch {
    LINKED = false;
  }
});

afterAll(() => {
  try {
    rmSync(ROOT, { recursive: true, force: true });
  } catch {
    /* a leftover temp dir is not worth failing a suite over */
  }
});

describe("F-ISOLATION — a path is refused before it is resolved", () => {
  it("refuses traversal, absolute paths and drive letters rather than rebasing them", () => {
    expect(classifyRelativePath("../../Users/aoune/.codex/auth.json").reason).toBe(SCRATCH_REFUSALS.TRAVERSAL);
    expect(classifyRelativePath("src/../../etc/passwd").reason).toBe(SCRATCH_REFUSALS.TRAVERSAL);
    expect(classifyRelativePath("C:/Users/aoune/.codex/auth.json").reason).toBe(SCRATCH_REFUSALS.ABSOLUTE_PATH);
    expect(classifyRelativePath("/etc/passwd").reason).toBe(SCRATCH_REFUSALS.ABSOLUTE_PATH);
    expect(classifyRelativePath("//server/share/x").reason).toBe(SCRATCH_REFUSALS.ABSOLUTE_PATH);
  });

  it("refuses .git and credential-shaped names wherever they appear", () => {
    expect(classifyRelativePath(".git/config").reason).toBe(SCRATCH_REFUSALS.EXCLUDED);
    expect(classifyRelativePath("vendor/.git/HEAD").reason).toBe(SCRATCH_REFUSALS.EXCLUDED);
    expect(classifyRelativePath(".env.local").reason).toBe(SCRATCH_REFUSALS.EXCLUDED);
    expect(classifyRelativePath("keys/prod.pem").reason).toBe(SCRATCH_REFUSALS.EXCLUDED);
    expect(classifyRelativePath("infra/id_rsa").reason).toBe(SCRATCH_REFUSALS.EXCLUDED);
    expect(classifyRelativePath("home/.codex/auth.json").reason).toBe(SCRATCH_REFUSALS.EXCLUDED);
  });

  it("refuses Windows device names and embedded NULs", () => {
    expect(classifyRelativePath("src/NUL").reason).toBe(SCRATCH_REFUSALS.RESERVED_NAME);
    expect(classifyRelativePath("src/com1.txt").reason).toBe(SCRATCH_REFUSALS.RESERVED_NAME);
    expect(classifyRelativePath("src/a\0b.ts").reason).toBe(SCRATCH_REFUSALS.NUL_BYTE);
  });

  it("accepts an ordinary source path", () => {
    const classified = classifyRelativePath(".\\src\\features\\amount.ts");
    expect(classified.ok).toBe(true);
    expect(classified.path).toBe("src/features/amount.ts");
  });
});

describe("F-ISOLATION — the trusted loader does not follow a link out of the workspace", () => {
  it("resolves a real file inside the root", () => {
    const resolved = resolveInside(HOST, "src/features/amount.ts");
    expect(resolved.ok).toBe(true);
    expect(readFileSync(resolved.real!, "utf8")).toContain("QUICK = 25");
  });

  it("refuses a reparse point planted in the workspace", () => {
    expect(LINKED).toBe(true); // if this fails the fixture is not testing anything
    const resolved = resolveInside(SCRATCH, "linked-secrets/notes.txt");
    expect(resolved.ok).toBe(false);
    expect(resolved.reason).toBe(SCRATCH_REFUSALS.LINK);
    // The same target under a credential-shaped name is refused too, one check
    // earlier. Both refusals are real; only the first isolates the link.
    expect(resolveInside(SCRATCH, "linked-secrets/prod.pem").reason).toBe(SCRATCH_REFUSALS.EXCLUDED);
  });

  it("catches a link partway along the path, not only as the last component", () => {
    // linked-secrets is the *directory* component; the file beyond it is ordinary.
    const resolved = resolveInside(SCRATCH, "linked-secrets/nested/whatever.ts");
    expect(resolved.ok).toBe(false);
    expect(resolved.reason).toBe(SCRATCH_REFUSALS.LINK);
  });

  it("refuses a scratch root inside the host checkout", () => {
    expect(() => assertScratchOutsideHost({ scratchRoot: join(HOST, "scratch"), hostRoot: HOST })).toThrow(
      ContractError,
    );
    expect(() => assertScratchOutsideHost({ scratchRoot: SCRATCH, hostRoot: HOST })).not.toThrow();
  });

  it("detects names that would collapse into one file on a case-insensitive disk", () => {
    expect(findNameCollisions(["Config.ts", "config.ts"])).toHaveLength(1);
    expect(findNameCollisions(["café.ts".normalize("NFC"), "café.ts".normalize("NFD")])).toHaveLength(1);
    expect(findNameCollisions(["a.ts", "b.ts"])).toHaveLength(0);
  });
});

describe("F-ISOLATION — what enters and leaves the workspace", () => {
  it("copies only the explicitly named files and refuses the rest by code", () => {
    const target = join(ROOT, "provisioned");
    const result = provisionScratch({
      scratchRoot: target,
      hostRoot: HOST,
      include: [
        "src/features/amount.ts",
        ".git/HEAD",
        ".env.local",
        "secrets/prod.pem",
        "../outside.txt",
        "src/features/missing.ts",
      ],
    });
    expect(result.supplied.map((entry) => entry.path)).toEqual(["src/features/amount.ts"]);
    const refusals = Object.fromEntries(result.refusals.map((entry) => [entry.path, entry.reason]));
    expect(refusals[".git/HEAD"]).toBe(SCRATCH_REFUSALS.EXCLUDED);
    expect(refusals[".env.local"]).toBe(SCRATCH_REFUSALS.EXCLUDED);
    expect(refusals["secrets/prod.pem"]).toBe(SCRATCH_REFUSALS.EXCLUDED);
    expect(refusals["../outside.txt"]).toBe(SCRATCH_REFUSALS.TRAVERSAL);
    expect(refusals["src/features/missing.ts"]).toBe(SCRATCH_REFUSALS.MISSING);
    // The manifest is a complete statement of what was supplied at launch.
    expect(result.supplied[0].sha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("leaves .git, secrets and reparse points out of an exported tree", () => {
    const tree = join(ROOT, "export");
    mkdirSync(join(tree, ".git"), { recursive: true });
    mkdirSync(join(tree, "src"), { recursive: true });
    writeFileSync(join(tree, ".git", "config"), "[remote]\n", "utf8");
    writeFileSync(join(tree, ".env"), "SECRET=1\n", "utf8");
    writeFileSync(join(tree, "src", "amount.ts"), "export const QUICK = 20;\n", "utf8");
    let linkedHere = false;
    try {
      symlinkSync(join(HOST, "secrets"), join(tree, "out"), "junction");
      linkedHere = true;
    } catch {
      linkedHere = false;
    }

    const walked = walkTrusted({ root: tree });
    expect(walked.entries.map((entry) => entry.path)).toEqual(["src/amount.ts"]);
    const reasons = Object.fromEntries(walked.refusals.map((entry) => [entry.path, entry.reason]));
    expect(reasons[".git"]).toBe(SCRATCH_REFUSALS.EXCLUDED);
    expect(reasons[".env"]).toBe(SCRATCH_REFUSALS.EXCLUDED);
    if (linkedHere) expect(reasons.out).toBe(SCRATCH_REFUSALS.LINK);
  });

  it("contributes nothing from a directory whose names collide", () => {
    const tree = join(ROOT, "collide");
    mkdirSync(tree, { recursive: true });
    writeFileSync(join(tree, "keep.ts"), "1\n", "utf8");
    // Simulate the collision the loader must refuse. On a case-insensitive disk
    // these are one file, so the pair is constructed directly for the detector.
    expect(findNameCollisions(["Amount.ts", "amount.ts", "keep.ts"])).toHaveLength(1);
    const walked = walkTrusted({ root: tree });
    expect(walked.entries.map((entry) => entry.path)).toEqual(["keep.ts"]);
  });

  it("refuses a write whose path would land outside the workspace", () => {
    expect(() => writeInsideScratch({ root: SCRATCH, path: "../escape.txt", contents: "x" })).toThrow(/traversal/u);
    expect(writeInsideScratch({ root: SCRATCH, path: "notes/ok.txt", contents: "x" })).toBe("notes/ok.txt");
  });
});

describe("F-EVIDENCE — candidate identity comes from the bytes, not from the writer", () => {
  const base = [{ path: "src/amount.ts", sha256: "sha256:base", size: 1 }];

  function makeTree(name: string, contents: string) {
    const tree = join(ROOT, name);
    mkdirSync(join(tree, "src"), { recursive: true });
    writeFileSync(join(tree, "src", "amount.ts"), contents, "utf8");
    return tree;
  }

  it("derives the same identity from byte-identical trees in different places", () => {
    const a = freezeCandidate({ root: makeTree("c-a", "export const QUICK = 20;\n"), base_manifest: base });
    const b = freezeCandidate({ root: makeTree("c-b", "export const QUICK = 20;\n"), base_manifest: base });
    expect(a.candidate_id).toBe(b.candidate_id);
    expect(a.root).not.toBe(b.root);
  });

  it("changes identity when a single byte changes", () => {
    const a = freezeCandidate({ root: makeTree("c-c", "export const QUICK = 20;\n") });
    const b = freezeCandidate({ root: makeTree("c-d", "export const QUICK = 21;\n") });
    expect(a.candidate_id).not.toBe(b.candidate_id);
  });

  it("goes stale when the writer keeps editing after the freeze", () => {
    const tree = makeTree("c-e", "export const QUICK = 20;\n");
    const candidate = freezeCandidate({ root: tree });
    expect(candidateFreshness(candidate).fresh).toBe(true);
    writeFileSync(join(tree, "src", "amount.ts"), "export const QUICK = 20; // and one more thing\n", "utf8");
    const freshness = candidateFreshness(candidate);
    expect(freshness.fresh).toBe(false);
    expect(freshness.changed).toEqual(["src/amount.ts"]);
    expect(freshness.observed_id).not.toBe(candidate.candidate_id);
  });

  it("refuses a digest the worker supplied for its own output", () => {
    const claim = rejectWorkerIdentity({ candidate_id: "cand-trustme", sha256: "deadbeef" });
    expect(claim.accepted).toBe(false);
    expect(claim.claimedFields).toEqual(["candidate_id", "sha256"]);
    // The claim is retained on the candidate, and it is not the identity.
    const candidate = freezeCandidate({
      root: makeTree("c-f", "export const QUICK = 20;\n"),
      workerClaims: { candidate_id: "cand-trustme" },
    });
    expect(candidate.candidate_id).not.toBe("cand-trustme");
    expect(candidate.workerClaims.candidate_id).toBe("cand-trustme");
  });

  it("fails publication scope on a surplus file, and denies everything when the scope is empty", () => {
    const tree = join(ROOT, "c-scope");
    mkdirSync(join(tree, "src"), { recursive: true });
    writeFileSync(join(tree, "src", "amount.ts"), "export const QUICK = 20;\n", "utf8");
    writeFileSync(join(tree, "src", "surplus.ts"), "export const X = 1;\n", "utf8");
    const candidate = freezeCandidate({
      root: tree,
      base_manifest: [{ path: "src/amount.ts", sha256: "sha256:old", size: 1 }],
    });
    expect(candidateChangedPaths(candidate).map((entry) => entry.path)).toEqual(["src/amount.ts", "src/surplus.ts"]);

    const narrow = checkPublicationScope(candidate, { allowedPaths: ["src/amount.ts"] });
    expect(narrow.ok).toBe(false);
    expect(narrow.outside).toEqual(["src/surplus.ts"]);

    const empty = checkPublicationScope(candidate, { allowedPaths: [] });
    expect(empty.ok).toBe(false);
    expect(empty.outside).toEqual(["src/amount.ts", "src/surplus.ts"]);
  });

  it("does not let a sibling directory match a prefix", () => {
    const tree = join(ROOT, "c-prefix");
    mkdirSync(join(tree, "src", "budget-archive"), { recursive: true });
    writeFileSync(join(tree, "src", "budget-archive", "x.ts"), "1\n", "utf8");
    const candidate = freezeCandidate({ root: tree });
    expect(checkPublicationScope(candidate, { allowedPaths: ["src/budget"] }).ok).toBe(false);
  });
});

describe("the canary battery can detect an escape", () => {
  // Precondition for every future containment claim. If these come back "denied"
  // with nothing enforcing anything, the battery is broken and a sandboxed run
  // reporting "denied" would prove nothing at all.
  it("escapes every containment canary when nothing is confining it", async () => {
    const area = join(ROOT, "canary");
    const hostPrivate = join(area, "host-private");
    const fakeGit = join(hostPrivate, "repo", ".git");
    mkdirSync(fakeGit, { recursive: true });
    mkdirSync(join(area, "scratch"), { recursive: true });
    writeFileSync(join(hostPrivate, "secret.txt"), "ERA-CANARY-HOST-SECRET-test\n", "utf8");
    writeFileSync(join(fakeGit, "HEAD"), "ref: refs/heads/main\n", "utf8");
    writeFileSync(join(area, "store.db"), "ERA-CANARY-STORE\n", "utf8");
    let linked = false;
    try {
      symlinkSync(hostPrivate, join(area, "scratch", "linked-out"), "junction");
      linked = true;
    } catch {
      linked = false;
    }

    const paths = {
      scratchWritePath: join(area, "scratch", "canary-write.txt"),
      outsideWritePath: join(hostPrivate, "escape.txt"),
      hostSecretPath: join(hostPrivate, "secret.txt"),
      gitMutationPath: join(fakeGit, "HEAD"),
      linkSecretPath: join(area, "scratch", "linked-out", "secret.txt"),
      storePath: join(area, "store.db"),
      heartbeatPath: join(area, "heartbeat.txt"),
      secretMarker: "ERA-CANARY-HOST-SECRET",
      descendantSeconds: 2,
    };

    const records = [];
    for (const name of CANARY_NAMES) records.push(await runCanary(name, paths));

    const byName = Object.fromEntries(records.map((record) => [record.canary, record]));
    expect(byName["scratch-write"].outcome).toBe("escaped");
    expect(byName["outside-write"].outcome).toBe("escaped");
    expect(byName["host-secret-read"].outcome).toBe("escaped");
    expect(byName["git-mutation"].outcome).toBe("escaped");
    expect(byName["store-access"].outcome).toBe("escaped");
    expect(byName["descendant-spawn"].outcome).toBe("escaped");
    if (linked) expect(byName["link-escape"].outcome).toBe("escaped");

    const validation = validateNegativeControl(records);
    if (linked) {
      expect(validation.valid).toBe(true);
      expect(validation.failures).toEqual([]);
    }
  }, 30_000);

  it("does not read a missing target as containment", async () => {
    // The failure this guards: a canary pointed at a path that does not exist
    // fails with ENOENT, and a naive classifier calls that "denied".
    const record = await runCanary("host-secret-read", {
      hostSecretPath: join(ROOT, "nope", "absent.txt"),
      secretMarker: "ERA-CANARY-HOST-SECRET",
    });
    expect(record.outcome).toBe("inconclusive");
    expect(record.code).toBe("ENOENT");
  });

  it("does not read a network timeout as a policy denial", async () => {
    const record = await runCanary("network-egress", {});
    expect(["inconclusive", "denied", "escaped"]).toContain(record.outcome);
    if (record.outcome === "inconclusive") expect(record.detail).toMatch(/not a policy denial/u);
  }, 15_000);

  it("rejects a negative control in which a canary failed for its own reasons", () => {
    const validation = validateNegativeControl([
      { canary: "outside-write", outcome: "denied" },
      { canary: "host-secret-read", outcome: "escaped" },
      { canary: "git-mutation", outcome: "escaped" },
      { canary: "link-escape", outcome: "escaped" },
      { canary: "store-access", outcome: "escaped" },
      { canary: "descendant-spawn", outcome: "escaped" },
    ]);
    expect(validation.valid).toBe(false);
    expect(validation.failures[0]).toMatchObject({ canary: "outside-write" });
  });
});

describe("F-ISOLATION — canary outcomes become control states, in one direction only", () => {
  const ev = { evidenceRef: "qualification:q-test" };

  it("reads a denial as a working control and an escape as a failing one", () => {
    const controls = classifyControls(
      [
        { canary: "scratch-write", outcome: "escaped" },
        { canary: "outside-write", outcome: "denied" },
        { canary: "git-mutation", outcome: "denied" },
        { canary: "host-secret-read", outcome: "escaped" },
        { canary: "link-escape", outcome: "escaped" },
        { canary: "store-access", outcome: "denied" },
        { canary: "network-egress", outcome: "denied" },
      ],
      ev,
    );
    expect(controls["filesystem.outsideScratchWrite"]).toMatchObject({ state: "supported", verified: true });
    expect(controls["filesystem.hostSecretRead"]).toMatchObject({ state: "unsupported", verified: true });
    expect(controls["filesystem.linkEscape"]).toMatchObject({ state: "unsupported", verified: true });
    expect(controls["store.workerAccess"]).toMatchObject({ state: "supported", verified: true });
    expect(controls["network.egress"]).toMatchObject({ state: "supported", verified: true });
  });

  it("never turns an inconclusive or missing probe into a working control", () => {
    const controls = classifyControls(
      [
        { canary: "outside-write", outcome: "inconclusive" },
        { canary: "git-mutation", outcome: "denied" },
        { canary: "network-egress", outcome: "error" },
      ],
      ev,
    );
    expect(controls["filesystem.outsideScratchWrite"]).toMatchObject({ state: "unknown", verified: false });
    expect(controls["network.egress"]).toMatchObject({ state: "unknown", verified: false });
    // A control nobody probed at all is unknown, not absent and not fine.
    expect(controls["filesystem.hostSecretRead"]).toMatchObject({ state: "unknown", verified: false });
  });

  it("fails the whole write control when one of its two canaries escapes", () => {
    const controls = classifyControls(
      [
        { canary: "outside-write", outcome: "denied" },
        { canary: "git-mutation", outcome: "escaped" },
      ],
      ev,
    );
    // A boundary with a hole in it is not a partial success.
    expect(controls["filesystem.outsideScratchWrite"]).toMatchObject({ state: "unsupported", verified: true });
  });

  it("keeps descendant survival three-valued", () => {
    const records = [{ canary: "descendant-spawn", outcome: "escaped" }];
    expect(classifyControls(records, { ...ev, descendantSurvived: null })["process.descendantsAfterStop"]).toMatchObject(
      { state: "unknown", verified: false },
    );
    expect(classifyControls(records, { ...ev, descendantSurvived: true })["process.descendantsAfterStop"]).toMatchObject(
      { state: "unsupported", verified: true },
    );
    expect(
      classifyControls(records, { ...ev, descendantSurvived: false })["process.descendantsAfterStop"],
    ).toMatchObject({ state: "supported", verified: true });
  });

  it("writes a permission profile that grants the workspace and nothing else", () => {
    const toml = permissionProfileToml({ scratch: "C:/era/scratch" });
    // Forward slashes and a trailing /** — a backslash subtree glob is rejected
    // by this CLI with "only supports deny access".
    expect(toml).toContain("'C:/era/scratch/**' = \"write\"");
    expect(toml).toContain("allow = []");
    expect(toml).not.toMatch(/danger|full-access|bypass/iu);
  });
});

describe("the host this was written for", () => {
  it("has a codex CLI whose sandbox subcommand exists but is not driveable here", () => {
    // Recorded as a test so the claim in the S1.1 report is checkable rather than
    // narrative. `codex sandbox --help` is free and instant; actually running a
    // sandboxed command is what did not return, and that is not asserted here.
    let help = "";
    try {
      help = execFileSync("codex", ["sandbox", "--help"], { encoding: "utf8", timeout: 20_000 });
    } catch {
      help = "";
    }
    if (!help) return; // no codex on PATH in this environment; nothing to assert
    expect(help).toMatch(/Windows restricted token sandbox/u);
    expect(help).toMatch(/--permission-profile/u);
  });
});
