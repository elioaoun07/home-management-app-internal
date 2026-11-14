import { afterAll, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Worker } from "node:worker_threads";
import { cockpit } from "../../scripts/pm/cockpit.mjs";
import { openStore } from "../../scripts/os/store.mjs";
import { sessionScorecard } from "../../scripts/os/scorecard.mjs";
import { buildCorpusRows } from "../../scripts/pm/relay.mjs";
import { assembleSnapshot } from "../../scripts/pm/relay-shared.mjs";
import {
  chain,
  setupDiff,
  ruleFact,
  cockpitAlias,
  clean,
} from "../../scripts/pm/app/cockpitModel";
import type { Flight, Setup } from "../../scripts/pm/app/cockpitTypes";
import { scanCheckboxes } from "../../scripts/pm/shared/md-scan.mjs";
import { readerBody } from "../../scripts/pm/app/Library";
import { buildHtml } from "../../scripts/pm/ui.mjs";
import { createCockpitReader } from "../../scripts/pm/cockpit-reader.mjs";

const root = mkdtempSync(join(tmpdir(), "pm2-a5-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, "ERA Notes/10 - Project Management"), { recursive: true });
const rules = `# Instructions\n\n## Hard Rules\n${Array.from({ length: 29 }, (_, i) => `${i + 1}. Rule ${i + 1}`).join("\n")}\n`;
writeFileSync(join(root, "CLAUDE.md"), rules);
writeFileSync(
  join(root, "ERA Notes/10 - Project Management/Backlog.md"),
  "# Durable backlog\n",
);
for (const args of [
  ["init", "--quiet"],
  [
    "-c",
    "user.name=A5",
    "-c",
    "user.email=a5@example.invalid",
    "-c",
    "core.hooksPath=.no-hooks",
    "-c",
    "commit.gpgSign=false",
    "commit",
    "--allow-empty",
    "--quiet",
    "-m",
    "fixture",
  ],
]) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(result.stderr);
}
describe("R97 read-only A1–A4 projection", () => {
  it("keeps the host loop responsive, coalesces refreshes, preserves failed reads and recovers an unchanged snapshot", async () => {
    let attempts = 0,
      changes = 0;
    const reader = createCockpitReader({
      root,
      autoStart: false,
      intervalMs: 0,
      onChange: () => {
        changes++;
      },
      createWorker: () => {
        attempts++;
        return attempts === 2
          ? new Worker("throw new Error('fixture failure')", { eval: true })
          : new Worker(
              new URL("../../scripts/pm/cockpit-worker.mjs", import.meta.url),
              { workerData: { root } },
            );
      },
    });
    try {
      const first = reader.refresh();
      expect(reader.refresh()).toBe(first);
      expect(
        await Promise.race([
          first.then(() => "snapshot"),
          new Promise((resolve) => setImmediate(() => resolve("loop"))),
        ]),
      ).toBe("loop");
      await first;
      expect(reader.read().pending).toBe(false);
      const fingerprint = reader.read().setup?.fingerprint;
      expect(fingerprint).toBeTruthy();
      await reader.refresh();
      expect(reader.read().stale).toBe(true);
      expect(reader.read().setup?.fingerprint).toBe(fingerprint);
      await reader.refresh();
      expect(reader.read().stale).toBe(false);
      expect(reader.read().setup?.fingerprint).toBe(fingerprint);
      expect(changes).toBe(3);
    } finally {
      reader.stop();
    }
  });
  it("renders setup on day one without creating .os or changing the backlog", () => {
    const before = readFileSync(join(root, "CLAUDE.md"), "utf8");
    const value = cockpit(root);
    expect(value.setup.schema).toBe("os/setup@1");
    expect(
      value.setup.entities.filter((e: { id: string }) => /^HR-/.test(e.id)),
    ).toHaveLength(29);
    expect(value.records).toEqual([]);
    expect(existsSync(join(root, ".os"))).toBe(false);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toBe(before);
  });
  it("reads stored verdicts, preserves unknown accounting and carries full read-only session evidence through the existing relay", () => {
    const session = {
      schema: "os/session@1",
      id: "a5-flight",
      agent: "claude",
      startedAt: "2026-11-01T10:00:00Z",
      endedAt: null,
      skills: [],
      reads: [],
      timeline: [],
      turns: null,
      usage: {},
      setup: { fingerprint: "sha256:a" },
      outcome: "unrecorded",
    };
    const verdict = {
      schema: "os/verdict@1",
      rule: "HR-22",
      verdict: "fail",
      added: 1,
      findings: [
        {
          file: "src/example.ts",
          line: 7,
          excerpt: "recorded evidence",
          message: "Fixture finding",
        },
      ],
    };
    const record = { session, events: [], checks: [], verdicts: [verdict] };
    const scored = { ...session, scorecard: sessionScorecard(record) };
    const store = openStore(root);
    store.put({ ...record, session: scored });
    store.close();
    const value = cockpit(root);
    expect(value.records[0].session.scorecard.cost.totalTokens).toBeNull();
    expect(value.records[0].verdicts[0].findings[0].line).toBe(7);
    const { manifest } = buildCorpusRows({
      data: { generatedAt: "now", files: [], cockpit: value },
      installation_id: "inst-012345abcdef",
    });
    const assembled = assembleSnapshot(manifest.payload, new Map());
    expect(assembled.ok).toBe(true);
    if (!assembled.snapshot) throw new Error("Relay snapshot missing");
    expect(assembled.snapshot.cockpit.records).toEqual(value.records);
    expect(value.groups[0].rates).toBeNull();
    expect(value.groups[0].statisticsEligible).toBe(false);
  });
  it("clearing derived history leaves both rules and backlog usable", () => {
    rmSync(join(root, ".os"), { recursive: true, force: true });
    const value = cockpit(root);
    expect(value.records).toEqual([]);
    expect(
      value.setup.entities.some((e: { id: string }) => e.id === "HR-22"),
    ).toBe(true);
    expect(
      readFileSync(
        join(root, "ERA Notes/10 - Project Management/Backlog.md"),
        "utf8",
      ),
    ).toBe("# Durable backlog\n");
  });
});
describe("R97 evidence and parity semantics", () => {
  it("uses A4 clean semantics without treating unknown or failed checks as clean", () => {
    const record = (rules: string, checks: string) => ({
      session: {
        scorecard: { rules: { verdict: rules }, checks: { verdict: checks } },
      },
    });
    expect(clean(record("improved", "pass"))).toBe(true);
    expect(clean(record("pass", "pass"))).toBe(true);
    expect(clean(record("unknown", "pass"))).toBe(false);
    expect(clean(record("pass", "unknown"))).toBe(false);
    expect(clean(record("fail", "pass"))).toBe(false);
  });
  it("retires local rollback assets while retaining the portable static renderer", () => {
    for (const file of ["client.js", "styles.css", "body.html"])
      expect(existsSync(join(process.cwd(), "scripts/pm", file))).toBe(false);
    const server = readFileSync("scripts/pm-server.mjs", "utf8");
    expect(server).not.toContain("buildHtmlLegacy");
    expect(server).not.toContain("UI_MODE");
    expect(buildHtml({ bundle: { js: "/* static */", css: "" } })).toContain(
      'id="app"',
    );
  });
  it("redirects older Home/Delivery/Analytics addresses without dropping filters or session detail", () => {
    expect(cockpitAlias("", new URLSearchParams())).toBe("/bridge");
    expect(cockpitAlias("home", new URLSearchParams())).toBe("/bridge");
    expect(
      cockpitAlias("analytics", new URLSearchParams("campaign=Budget&weeks=4")),
    ).toBe("/score?campaign=Budget&weeks=4&view=backlog");
    expect(cockpitAlias("delivery", new URLSearchParams("history=1"))).toBe(
      "/sessions?history=1&view=delivery",
    );
    expect(cockpitAlias("delivery", new URLSearchParams(), true)).toBeNull();
  });
  it("opens priorities from bare Launch while preserving existing work filters", () => {
    expect(cockpitAlias("launch", new URLSearchParams())).toBe(
      "/explore?lane=now",
    );
    const query = new URLSearchParams("campaign=Kitchen&q=recipes&lane=next");
    expect(cockpitAlias("launch", query)).toBe(
      "/explore?campaign=Kitchen&q=recipes&lane=next",
    );
    expect(query.toString()).toBe("campaign=Kitchen&q=recipes&lane=next");
    expect(cockpitAlias("launch", new URLSearchParams("view=list"))).toBe(
      "/explore?view=list",
    );
  });
  it("does not redirect a contextual launch or delivery handoff", () => {
    for (const query of [
      "file=Budget%2F4+-+Checklist.md&cb=0",
      "file=Budget%2F4+-+Checklist.md",
      "cb=0",
    ])
      expect(cockpitAlias("launch", new URLSearchParams(query))).toBeNull();
    expect(cockpitAlias("launch", new URLSearchParams(), true)).toBeNull();
    expect(cockpitAlias("deliver", new URLSearchParams(), true)).toBeNull();
  });
  const setup: Setup = {
    schema: "os/setup@1",
    fingerprint: "test",
    generatedAt: "now",
    sources: [],
    entities: [
      { id: "agent:claude", kind: "agent", entities: ["guard:claude"] },
      { id: "agent:codex", kind: "agent", entities: [] },
      { id: "guard:claude", kind: "hook" },
      { id: "HR-26", kind: "rule" },
      { id: "HR-1", kind: "rule" },
    ],
    relations: [
      { type: "applies-to", from: "guard:claude", to: "agent:claude" },
      { type: "enforces", from: "guard:claude", to: "HR-26" },
    ],
  };
  it("does not light an agent's missing guard through another agent or an unrelated rule", () => {
    expect([...chain(setup, "agent:codex")]).toEqual(["agent:codex"]);
    expect(chain(setup, "agent:claude").has("HR-26")).toBe(true);
    expect(chain(setup, "HR-26").has("agent:claude")).toBe(true);
    expect(chain(setup, "HR-26").has("agent:codex")).toBe(false);
    expect(chain(setup, "HR-1").has("guard:claude")).toBe(false);
  });
  it("never invents historical file hashes or a verdict", () => {
    const a = { session: { setup: { fingerprint: "a" } } } as Flight,
      b = { session: { setup: { fingerprint: "b" } } } as Flight;
    expect(setupDiff(a, b).state).toContain("unrecorded");
    expect(ruleFact(a, "HR-22")).toBeUndefined();
  });
  it("keeps exact checkbox ordinals across hidden frontmatter and fenced examples", () => {
    const raw =
      "---\r\ntitle: Example\r\n---\r\n# Doc\r\n- [ ] Real\r\n```md\r\n- [ ] Example\r\n```\r\n1. [x] Another\r\n";
    expect(scanCheckboxes(readerBody(raw))).toEqual(scanCheckboxes(raw));
    expect(readerBody(raw).split(/\r?\n/)[4]).toBe("- [ ] Real");
  });
});
