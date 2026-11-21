import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cockpit } from "../../scripts/pm/cockpit.mjs";
import { skillUse } from "../../scripts/pm/app/skillUseModel";
import { writeInvalidScorecardStore } from "./fixtures/r127-invalid-store.mjs";

const scratch = mkdtempSync(join(tmpdir(), "r127-skill-reader-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
let serial = 0;
function fixture() {
  const root = join(scratch, String(serial++));
  mkdirSync(join(root, ".os"), { recursive: true });
  writeFileSync(join(root, "CLAUDE.md"), "# Fixture\n");
  return root;
}
const skill = {
  id: "skill:claude:start-task",
  name: "start-task",
  kind: "skill",
};

describe("R127 skill-use source availability", () => {
  it("treats a genuinely absent recorder store as known zero", () => {
    const data = cockpit(fixture());
    expect(data.skillUsage).toEqual({
      available: true,
      recordedSessions: 0,
      skills: [],
    });
    expect(skillUse(skill, data.skillUsage)).toEqual({
      lastUsed: null,
      sessions: 0,
      unused: false,
    });
  });

  it("withholds zero-use claims when an existing native store cannot be read", () => {
    const root = fixture();
    writeFileSync(join(root, ".os/os.db"), "Unreadable fixture database");
    const data = cockpit(root);
    expect(
      data.warnings.some((warning: string) =>
        warning.startsWith("Sessions unavailable:"),
      ),
    ).toBe(true);
    expect(data.skillUsage.available).toBe(false);
    expect(skillUse(skill, data.skillUsage)).toEqual({
      lastUsed: null,
      sessions: null,
      unused: false,
    });
  });

  it("requires record validation to succeed after the session list is read", () => {
    const root = fixture();
    writeInvalidScorecardStore(root);
    const data = cockpit(root);
    expect(data.skillUsage.available).toBe(false);
    expect(
      data.warnings.some((warning: string) =>
        warning.startsWith("Sessions unavailable:"),
      ),
    ).toBe(true);
    expect(skillUse(skill, data.skillUsage)).toEqual({
      lastUsed: null,
      sessions: null,
      unused: false,
    });
  });
});
