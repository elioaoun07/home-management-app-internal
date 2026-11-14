import { afterAll, describe, expect, it } from "vitest";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { scan } from "../../scripts/os/scan.mjs";
import {
  defaults,
  formSchema,
  moduleArgs,
  psQuote,
} from "../../scripts/os/forms.mjs";
import {
  catalog,
  pmItems,
  prepare,
  repositoryPath,
} from "../../scripts/os/launchpad.mjs";
import { routeLaunchpad } from "../../scripts/pm/launchpad-route.mjs";

const repo = resolve("."),
  root = mkdtempSync(join(tmpdir(), "era-a6-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
function write(file: string, value: string) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), value);
}
for (const file of [
  "CLAUDE.md",
  "ERA Notes/01 - Architecture/Feature Map/_index.md",
  "scripts/new-module.mjs",
])
  write(file, readFileSync(join(repo, file), "utf8"));
cpSync(join(repo, ".claude/skills"), join(root, ".claude/skills"), {
  recursive: true,
});
cpSync(join(repo, ".claude/recipes"), join(root, ".claude/recipes"), {
  recursive: true,
});
write(
  "ERA Notes/Model-Registry.md",
  readFileSync(join(repo, "ERA Notes/Model-Registry.md"), "utf8"),
);
write("package.json", "{}");
write(
  "ERA Notes/10 - Project Management/Hub & ERA/4 - Checklist.md",
  "## Now\n**ERA reports**\n- [ ] **HUB-201** Report\n- [x] **HUB-202** Closed\n**Other**\n- [ ] **HUB-203** Other\n",
);
for (const args of [
  ["init", "--quiet"],
  [
    "-c",
    "user.name=A6",
    "-c",
    "user.email=a6@example.invalid",
    "-c",
    "core.hooksPath=.none",
    "-c",
    "commit.gpgSign=false",
    "commit",
    "--allow-empty",
    "--quiet",
    "-m",
    "fixture",
  ],
]) {
  const r = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status) throw Error(r.stderr);
}
const setup = scan(root),
  data = catalog(setup),
  items = pmItems(root);
const request = (
  skill: string,
  values: Record<string, unknown> = {},
): {
  skill: string;
  values: Record<string, unknown>;
  tier: string;
  effort: string;
  attachments: string[];
  paths: string[];
} => ({
  skill,
  values,
  tier: "CLAUDE_MID",
  effort: "default",
  attachments: [],
  paths: [],
});
const run = (input: ReturnType<typeof request>) =>
  prepare(root, input, setup, items);

describe("R98 / A6 form launches", () => {
  it("keeps derived title and lookup fields blank until a slug is entered", () => {
    const form = formSchema.parse(
      JSON.parse(
        readFileSync(join(repo, ".claude/skills/new-module/form.json"), "utf8"),
      ),
    );
    expect(defaults(form, {})).toMatchObject({
      name: "",
      title: "",
      table: "",
      intent: "",
    });
    expect(defaults(form, { name: "my-parcels" })).toMatchObject({
      title: "My Parcels",
      table: "my_parcels",
      intent: "My Parcels",
    });
    expect(defaults(form, { name: "" }).title).toBe("");
  });
  it("registers exactly the eight planned forms, recipes, modules and enabled tier aliases", () => {
    expect(data.forms.map((f: { skill: string }) => f.skill).sort()).toEqual([
      "add-feature",
      "data-repair",
      "db-migration",
      "era-wire",
      "fix-bug",
      "new-module",
      "triage-inbox",
      "wizard",
    ]);
    expect(data.recipes).toHaveLength(2);
    expect(
      data.modules.some((m: { name: string }) => m.name === "Transactions"),
    ).toBe(true);
    expect(
      data.tiers.find((t: { alias: string }) => t.alias === "CODEX_HIGH")
        .disabled,
    ).toBe(true);
    expect(setup.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TIER-LITERAL" }),
      ]),
    );
  });
  it("finishes new-module's complete copy launch with derived inputs, automatic attachments and the real dry-run", async () => {
    const result = await run(
      request("new-module", {
        name: "parcel-fixture",
        oneLiner: "Track parcels",
      }),
    );
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    expect(result.values).toMatchObject({
      title: "Parcel Fixture",
      type: "standalone",
      table: "parcel_fixture",
      intent: "Parcel Fixture",
      noPage: false,
    });
    expect(result.values).not.toHaveProperty("connects");
    expect(result.prompt).toContain('"oneLiner": "Track parcels"');
    expect(result.prompt).toContain('"noPage": false');
    expect(result.preview).toContain("DRY RUN");
    expect(result.preview).toContain("parcel-fixture");
    expect(result.automatic).toEqual(
      expect.arrayContaining(["api-route", "ui-guardrails"]),
    );
    expect(result.command).toContain(
      "claude --model 'claude-sonnet-5-5' --effort 'medium'",
    );
    expect(result.launch?.enabled).toBe(false);
    expect(existsSync(join(root, "src/features/parcel-fixture"))).toBe(false);
    expect(existsSync(join(root, ".os/os.db"))).toBe(false); // copy is not an executed flight
  });
  it("blocks required, pattern, type, length, enum, uniqueness and undeclared values before preview", async () => {
    expect((await run(request("new-module"))).errors).toHaveProperty("name");
    for (const values of [
      { name: "../escape", oneLiner: "Test" },
      { name: "test", oneLiner: "x".repeat(141) },
      { name: "test", oneLiner: "Test", type: "other" },
      { name: "test", oneLiner: "Test", noPage: "true" },
      { name: "transactions", oneLiner: "Test" },
      { name: "test", oneLiner: "Test", unexpected: "value" },
    ]) {
      const result = await run(request("new-module", values));
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty("preview");
    }
    mkdirSync(join(root, "src/features/collision"), { recursive: true });
    expect(
      (
        await run(
          request("new-module", { name: "collision", oneLiner: "Test" }),
        )
      ).errors,
    ).toHaveProperty("name");
  });
  it("requires two registered standalones for junctions and removes stale hidden connects", async () => {
    const base = {
      name: "parcel-links",
      oneLiner: "Link parcels",
      type: "junction",
    };
    for (const connects of [
      [],
      ["Transactions"],
      ["Transactions", "unknown"],
      ["Transactions", "Hub Chat"],
    ])
      expect((await run(request("new-module", { ...base, connects }))).ok).toBe(
        false,
      );
    const result = await run(
      request("new-module", { ...base, connects: ["Transactions", "Recipes"] }),
    );
    expect(result.ok).toBe(true);
    expect(result.preview).toContain("junction");
    expect(moduleArgs(result.values)).toContain("Transactions ↔ Recipes");
    expect(
      (
        await run(
          request("new-module", {
            name: "parcel-only",
            oneLiner: "Test",
            connects: ["stale"],
            noPage: true,
          }),
        )
      ).preview,
    ).not.toContain("Client.tsx");
  });
  it("supports the other seven skills and rejects closed, fabricated and non-report items", async () => {
    for (const [skill, values] of [
      ["era-wire", { item: "HUB-201" }],
      [
        "fix-bug",
        {
          symptom: "Button fails",
          module: "Transactions",
          reproduction: "Tap",
          expected: "Opens",
        },
      ],
      [
        "add-feature",
        { item: "HUB-201", module: "Recipes", acceptance: "Can save" },
      ],
      ["db-migration", { description: "Add column", tables: "items" }],
      ["triage-inbox", {}],
      ["data-repair", { symptom: "Stale storage" }],
      ["wizard", { system: "Device", goal: "Connect it" }],
    ] as const)
      expect((await run(request(skill, values))).ok, skill).toBe(true);
    for (const item of ["HUB-202", "HUB-203", "HUB-999"])
      expect((await run(request("era-wire", { item }))).ok).toBe(false);
    expect(
      (
        await run(
          request("fix-bug", {
            module: "Recipes",
            reproduction: "Tap",
            expected: "Opens",
          }),
        )
      ).ok,
    ).toBe(false);
    expect(items.map((i: { id: string }) => i.id)).toEqual([
      "HUB-201",
      "HUB-203",
    ]);
  });
  it("rejects disabled tiers, unresolved defaults, unsupported efforts, unknown attachments and escaping paths", async () => {
    const base = request("triage-inbox");
    for (const input of [
      { ...base, tier: "CODEX_HIGH" },
      { ...base, tier: "CODEX_MID" },
      { ...base, effort: "turbo" },
      { ...base, attachments: ["invented"] },
      { ...base, paths: ["../escape"] },
      { ...base, paths: ["C:/Windows"] },
    ])
      expect((await run(input)).ok).toBe(false);
    expect((await run({ ...base, tier: "CODEX_MID", effort: "high" })).ok).toBe(
      true,
    );
    expect(() => repositoryPath(root, "../escape")).toThrow();
    expect(() => repositoryPath(root, ".env")).toThrow();
  });
  it("enforces path-based preloads even if an owner omits them", async () => {
    const result = await run({
      ...request("triage-inbox"),
      paths: ["src/app/api/accounts/route.ts", "src/app/recurring/page.tsx"],
    });
    expect(result.automatic).toEqual(
      expect.arrayContaining([
        "money-rules",
        "recurrence-safety",
        "api-route",
        "ui-guardrails",
      ]),
    );
    expect(result.prompt).toContain(".claude/skills/money-rules/SKILL.md");
  });
  it("validates repository path, tier and calendar-date field contracts", async () => {
    const form = formSchema.parse({
      skill: "wizard",
      title: "Typed fixture",
      tier: "CLAUDE_MID",
      effort: "default",
      launch: "worktree",
      checks: [],
      fields: [
        {
          id: "file",
          label: "File",
          type: "path",
          required: true,
          mention: "fixture",
        },
        {
          id: "day",
          label: "Day",
          type: "date",
          required: true,
          mention: "fixture",
        },
        {
          id: "modelTier",
          label: "Tier",
          type: "tier",
          required: true,
          mention: "fixture",
        },
      ],
    });
    const customSetup = {
      ...setup,
      entities: setup.entities.map((e: { id: string }) =>
        e.id === "form:wizard" ? { ...e, definition: form } : e,
      ),
    };
    const values = {
      file: "CLAUDE.md",
      day: "2028-02-29",
      modelTier: "CODEX_MID",
    };
    expect(
      (await prepare(root, request("wizard", values), customSetup, items)).ok,
    ).toBe(true);
    for (const patch of [
      { file: "absent.md" },
      { file: "../outside" },
      { day: "2026-02-29" },
      { day: "2026-99-99" },
      { modelTier: "CODEX_HIGH" },
    ])
      expect(
        (
          await prepare(
            root,
            request("wizard", { ...values, ...patch }),
            customSetup,
            items,
          )
        ).ok,
      ).toBe(false);
  });
  it("applies versioned recipes through the same validation and rendering path", async () => {
    const recipe = data.recipes.find(
      (r: { id: string }) => r.id === "money-bug",
    );
    const result = await run({
      ...request(recipe.skill, {
        ...recipe.values,
        symptom: "Wrong amount",
        module: "Transactions",
        reproduction: "Save",
        expected: "Correct amount",
      }),
      tier: recipe.tier,
      effort: recipe.effort,
      attachments: recipe.attachments,
    });
    expect(result.ok).toBe(true);
    expect(result.prompt).toContain("Tier: CLAUDE_HIGH");
    expect(result.attachments).toContain("money-rules");
  });
  it("keeps quotes, substitutions, backticks and multiline input literal in PowerShell commands", () => {
    const value = "a'\"; $(throw 'executed') `n\nUnicode ↔";
    if (process.platform === "win32") {
      const script = `$v = ${psQuote(value)}; [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($v))`;
      const result = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from(script, "utf16le").toString("base64"),
        ],
        { encoding: "utf8", windowsHide: true },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(Buffer.from(result.stdout.trim(), "base64").toString("utf8")).toBe(
        value,
      );
    } else expect(psQuote(value)).toContain("a''");
  });
  it("bounds schema defaults and diagnoses missing, forward and reverse form drift in A1", () => {
    const form = data.forms.find(
      (f: { skill: string }) => f.skill === "new-module",
    );
    expect(defaults(form, { name: "a-b" }).table).toBe("a_b");
    expect(
      formSchema.safeParse({
        ...form,
        fields: [...form.fields, form.fields[0]],
      }).success,
    ).toBe(false);
    write(
      ".claude/skills/fixture/SKILL.md",
      "# Skill\n| Input | Flag | Required | Default |\n| New | `--new` | yes | none |\n",
    );
    expect(scan(root).gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "FORM-MISSING" }),
      ]),
    );
    write(
      ".claude/skills/fixture/form.json",
      JSON.stringify({ ...form, skill: "fixture" }),
    );
    const gaps = scan(root).gaps.filter((g: { source: string }) =>
      g.source.includes("fixture"),
    );
    expect(
      gaps.some((g: { message: string }) => g.message.includes("--new")),
    ).toBe(true);
    expect(
      gaps.some((g: { message: string }) =>
        g.message.includes("missing skill anchor"),
      ),
    ).toBe(true);
  });
  it("refuses cross-site/LAN and malformed requests without starting a worker", async () => {
    const base = {
      root,
      body: request("triage-inbox"),
      headers: { host: "127.0.0.1:4317", origin: "http://127.0.0.1:4317" },
      loopbackPeer: true,
    };
    expect(
      (await routeLaunchpad({ ...base, loopbackPeer: false })).status,
    ).toBe(403);
    expect(
      (
        await routeLaunchpad({
          ...base,
          headers: { ...base.headers, origin: "https://example.invalid" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await routeLaunchpad({
          ...base,
          body: { ...base.body, executable: "evil" },
        })
      ).status,
    ).toBe(400);
    const good = await routeLaunchpad(base);
    expect(good.status).toBe(200);
    expect(good.json.ok).toBe(true);
  });
});
