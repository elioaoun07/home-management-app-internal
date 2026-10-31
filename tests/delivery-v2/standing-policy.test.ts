import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { bindEnvironmentChecks, manifestMatchesLock } from "../../scripts/delivery-v2/dependency-environment.mjs";
import { expandScratchInclude } from "../../scripts/delivery-v2/scratch.mjs";
import { materializePolicy } from "../../scripts/delivery-v2/policy.mjs";
import { gradeCandidateTests } from "../../scripts/delivery-v2/candidate-tests.mjs";
import { deriveTouches, ensureDeclaredTouches } from "../../scripts/delivery-v2/touches.mjs";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function tree(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "era-standing-"));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const LOCK = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true

importers:

  .:
    dependencies:
      '@scope/pkg':
        specifier: ^1.2.0
        version: 1.2.3
      next:
        specifier: 16.0.7
        version: 16.0.7(react@19.1.0)
    devDependencies:
      vitest:
        specifier: 4.1.7
        version: 4.1.7

packages:
`;
const manifest = (extra: Record<string, unknown> = {}) => JSON.stringify({
  name: "app", scripts: { dev: "next dev" },
  dependencies: { "@scope/pkg": "^1.2.0", next: "16.0.7" }, devDependencies: { vitest: "4.1.7" }, ...extra,
});

describe("environment pinned to dependencies, not package.json bytes", () => {
  it("treats script and metadata edits as the same install", () => {
    expect(manifestMatchesLock(manifest(), LOCK)).toBe(true);
    expect(manifestMatchesLock(manifest({ scripts: { dev: "next dev", lint: "eslint" }, version: "2.0.0" }), LOCK)).toBe(true);
  });
  it("refuses a dependency change, an added dependency or an install-affecting field", () => {
    expect(manifestMatchesLock(manifest({ dependencies: { "@scope/pkg": "^1.3.0", next: "16.0.7" } }), LOCK)).toBe(false);
    expect(manifestMatchesLock(manifest({ devDependencies: { vitest: "4.1.7", eslint: "9.35.0" } }), LOCK)).toBe(false);
    expect(manifestMatchesLock(manifest({ pnpm: { overrides: { next: "16.0.8" } } }), LOCK)).toBe(false);
    expect(manifestMatchesLock("not json", LOCK)).toBe(false);
    expect(manifestMatchesLock(manifest(), "lockfileVersion: '6.0'\n")).toBe(false);
  });
  it("binds no environment checks for a policy without item command checks", () => {
    expect(bindEnvironmentChecks({ oracles: [], checks: { specs: {}, inputs: ["vitest.config.ts"] }, inputs: {} })).toEqual({});
    expect(() => bindEnvironmentChecks({ oracles: [], checks: { specs: { x: { kind: "command", argv: ["node", "x.mjs"], expected: { assertions: 1 } } }, inputs: [] }, inputs: {} })).toThrow();
  });
});

describe("standing policy scopes", () => {
  it("expands directories into files, skipping credentials and excluded segments", () => {
    const root = tree({ "src/a.ts": "", "src/deep/b.tsx": "", "src/.env.local": "x", "src/node_modules/m.js": "", "src/.pm/stamp.json": "", "CLAUDE.md": "" });
    expect(expandScratchInclude(root, ["src", "CLAUDE.md", "missing.md"])).toEqual(["CLAUDE.md", "missing.md", "src/a.ts", "src/deep/b.tsx"]);
  });
  it("resolves directory scopes and current generated pins, and leaves explicit policies untouched", () => {
    const root = tree({ "src/a.ts": "a", ".next/types/routes.d.ts": "routes" });
    const typecheck = { program: { roots: [], extensions: [], generatedTypes: { ".next/types/routes.d.ts": "current", ".next/types/gone.ts": "current" } } };
    const policy = { scratchScope: { kind: "snapshot", include: ["src"] }, checks: { requiredVerifications: { typecheck } } };
    const resolved = materializePolicy(root, policy);
    expect(resolved.scratchScope.include).toEqual(["src/a.ts"]);
    expect(Object.keys(resolved.checks.requiredVerifications.typecheck.program.generatedTypes)).toEqual([".next/types/routes.d.ts"]);
    expect(resolved.checks.requiredVerifications.typecheck.program.generatedTypes[".next/types/routes.d.ts"]).toMatch(/^sha256:[a-f0-9]{64}$/u);
    const explicit = { scratchScope: { kind: "snapshot", include: ["src/a.ts"] }, checks: { requiredVerifications: {} } };
    expect(materializePolicy(root, explicit)).toBe(explicit);
  });
  it("fails a candidate with no tests only when the policy requires them", () => {
    const none = { files: [], missing: [], unsafe: [] } as never;
    expect(gradeCandidateTests({ selection: none, raw: null }).state).toBe("satisfied");
    expect(gradeCandidateTests({ selection: none, raw: null, requireTests: true }).state).toBe("failed");
  });
});

describe("Touches derived by Check readiness", () => {
  const featureMap = {
    "ERA Notes/01 - Architecture/Feature Map/_index.md": '"meal planner" / "what we\'re eating this week" | [standalone/meal-planning.md](standalone/meal-planning.md)\n',
    "ERA Notes/01 - Architecture/Feature Map/standalone/meal-planning.md": "- **Hooks**: `src/features/meal-planning/hooks.ts`\n- **API routes**: `src/app/api/meal-plans/`\n- `migrations/schema.sql`\n",
  };
  const allowed = ["src", "tests"];

  it("prefers the item's prepared plan scope, clipped to the publication scope", () => {
    const section = "### KIT-9\n\n```delivery-plan-v1\n" + JSON.stringify({ scope: ["src/lib/x.ts", "migrations/1.sql"] }) + "\n```\n";
    expect(deriveTouches({ section, repoRoot: tree({}), allowedPaths: allowed })).toEqual({ paths: ["src/lib/x.ts"], source: "plan" });
  });
  it("routes item text through the Feature Map and adds tests", () => {
    const root = tree(featureMap);
    const derived = deriveTouches({ section: "### KIT-9\n\n**Outcome:** Show leftovers in the meal planner.\n", repoRoot: root, allowedPaths: allowed });
    expect(derived).toEqual({ paths: ["src/app/api/meal-plans", "src/features/meal-planning/hooks.ts", "tests"], source: "feature-map" });
  });
  it("writes the line after the label block, keeps CRLF, and never rewrites a declared section", () => {
    const book = "# Kitchen\r\n\r\n### KIT-9\r\n\r\n**Outcome:** Show leftovers in the meal planner.\r\n**Kind:** bug\r\n\r\n- **Acceptance:** done\r\n\r\n### KIT-10\r\n\r\n**Outcome:** Other.\r\n**Touches:** none\r\n";
    const root = tree({ ...featureMap, "PM/Kitchen/Kitchen — Master Book.md": book, "PM/Kitchen/4 - Checklist.md": "- [ ] **KIT-9** x\n" });
    const written = ensureDeclaredTouches({ root, pmRel: "PM", file: "Kitchen/4 - Checklist.md", id: "KIT-9", allowedPaths: allowed });
    expect(written.state).toBe("derived");
    const after = readFileSync(join(root, "PM/Kitchen/Kitchen — Master Book.md"), "utf8");
    expect(after).toContain("**Kind:** bug\r\n**Touches:** `src/app/api/meal-plans`, `src/features/meal-planning/hooks.ts`, `tests`\r\n\r\n- **Acceptance:**");
    expect(after.split("\r\n").every((line) => !line.includes("\n"))).toBe(true);
    expect(ensureDeclaredTouches({ root, pmRel: "PM", file: "Kitchen/4 - Checklist.md", id: "KIT-9", allowedPaths: allowed }).state).toBe("declared");
    const declared = ensureDeclaredTouches({ root, pmRel: "PM", file: "Kitchen/4 - Checklist.md", id: "KIT-10", allowedPaths: allowed });
    expect(declared).toEqual({ state: "declared", paths: [], source: null });
    expect(readFileSync(join(root, "PM/Kitchen/Kitchen — Master Book.md"), "utf8")).toBe(after);
  });
  it("writes nothing when nothing routes", () => {
    const root = tree({ ...featureMap, "PM/Kitchen/Kitchen — Master Book.md": "### KIT-9\n\n**Outcome:** Zzz.\n" });
    expect(ensureDeclaredTouches({ root, pmRel: "PM", file: "Kitchen/4 - Checklist.md", id: "KIT-9", allowedPaths: allowed }).state).toBe("unknown");
    expect(readFileSync(join(root, "PM/Kitchen/Kitchen — Master Book.md"), "utf8")).toBe("### KIT-9\n\n**Outcome:** Zzz.\n");
  });
});
