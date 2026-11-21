import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cockpitAlias } from "../../scripts/pm/app/cockpitModel";
import { SetupSkillUse } from "../../scripts/pm/app/SetupSkillUse";
import { skillUse } from "../../scripts/pm/app/skillUseModel";
import type { Cockpit, Entity } from "../../scripts/pm/app/cockpitTypes";

const skill: Entity = {
  id: "skill:claude:start-task",
  kind: "skill",
  name: "start-task",
  source: ".claude/skills/start-task/SKILL.md",
};
const usage = (extra: Partial<NonNullable<Cockpit["skillUsage"]>> = {}) => ({
  available: true,
  recordedSessions: 20,
  skills: [
    { name: "start-task", lastUsed: "2026-11-15T10:00:00Z", sessions: 4 },
  ],
  ...extra,
});
const html = (value?: Cockpit["skillUsage"]) =>
  renderToStaticMarkup(
    createElement(SetupSkillUse, {
      entries: [skill],
      usage: value,
      selected: "",
      onSelect: () => {},
    }),
  );

describe("R127 retired Prompt tools", () => {
  it("removes page, endpoint and presets while preserving the D3 form machinery", () => {
    for (const file of [
      "scripts/pm/app/Launchpad.tsx",
      "scripts/pm/app/launchpad.css",
      "scripts/pm/launchpad-route.mjs",
      ".claude/recipes/era-report.json",
      ".claude/recipes/money-bug.json",
    ])
      expect(existsSync(file), file).toBe(false);
    for (const file of [
      "scripts/os/forms.mjs",
      "scripts/os/launchpad.mjs",
      "scripts/os/launch-settings.mjs",
      "tests/os/launchpad.test.ts",
    ])
      expect(existsSync(file), file).toBe(true);
    expect(readFileSync("scripts/pm-server.mjs", "utf8")).not.toContain(
      "/api/launchpad",
    );
    expect(readFileSync("scripts/pm/app/App.tsx", "utf8")).not.toContain(
      "Launchpad",
    );
    expect(readFileSync("scripts/pm/app/Setup.tsx", "utf8")).not.toContain(
      "Prompt tools",
    );
  });
  it("redirects the retired page and bare Launch while retaining contextual Delivery", () => {
    for (const root of ["skill-tools", "launch"])
      expect(cockpitAlias(root, new URLSearchParams())).toBe(
        "/explore?lane=now",
      );
    expect(
      cockpitAlias(
        "launch",
        new URLSearchParams("file=Budget%2F4+-+Checklist.md&cb=0"),
      ),
    ).toBeNull();
  });
});

describe("R127 recorded skill use", () => {
  it("shows the recorder's last-used date and session count without recounting rows", () => {
    expect(skillUse(skill, usage())).toEqual({
      lastUsed: "2026-11-15T10:00:00Z",
      sessions: 4,
      unused: false,
    });
    expect(html(usage())).toContain(
      '<time dateTime="2026-11-15T10:00:00Z">2026-11-15</time>',
    );
    expect(html(usage())).toContain('class="setup-skill-sessions">4</td>');
    expect(html(usage())).toContain("<th>Last used</th><th>Sessions</th>");
  });
  it.each([undefined, usage({ available: false })])(
    "uses dashes without an available recorder projection",
    (value) => {
      expect(skillUse(skill, value)).toEqual({
        lastUsed: null,
        sessions: null,
        unused: false,
      });
      expect(html(value)).toContain('class="setup-skill-last-used">—</td>');
      expect(html(value)).toContain('class="setup-skill-sessions">—</td>');
      expect(html(value)).not.toContain("Unused");
    },
  );
  it("tags zero-use skills only after twenty recorded sessions", () => {
    expect(
      skillUse(skill, usage({ skills: [], recordedSessions: 19 })).unused,
    ).toBe(false);
    expect(
      skillUse(skill, usage({ skills: [], recordedSessions: 20 })),
    ).toEqual({ lastUsed: null, sessions: 0, unused: true });
    expect(html(usage({ skills: [] }))).toContain(
      'class="setup-skill-unused">Unused</span>',
    );
  });
});
