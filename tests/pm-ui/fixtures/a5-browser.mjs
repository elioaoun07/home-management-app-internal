// Explicit local-only browser fixture. Copies the server into an isolated temp
// repo and injects its existing fake-runner seams. No .env, bridge or provider.
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { openStore } from "../../../scripts/os/store.mjs";
import { sessionScorecard } from "../../../scripts/os/scorecard.mjs";
const source = resolve("."),
  root = mkdtempSync(join(tmpdir(), "era-a5-browser-"));
mkdirSync(join(source, ".pm/a5-evidence"), { recursive: true });
cpSync(join(source, "scripts"), join(root, "scripts"), { recursive: true });
symlinkSync(
  join(source, "node_modules"),
  join(root, "node_modules"),
  "junction",
);
writeFileSync(
  join(root, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      jsx: "react-jsx",
      paths: { "@/*": [source.replaceAll("\\", "/") + "/src/*"] },
    },
  }),
);
writeFileSync(
  join(root, "package.json"),
  JSON.stringify({
    scripts: {
      typecheck: 'node -e "process.exit(0)"',
      lint: 'node -e "process.exit(0)"',
      test: 'node -e "process.exit(0)"',
    },
  }),
);
writeFileSync(join(root, "CLAUDE.md"), readFileSync(join(source, "CLAUDE.md")));
mkdirSync(join(root, ".claude/skills"), { recursive: true });
cpSync(
  join(source, ".claude/skills/start-task"),
  join(root, ".claude/skills/start-task"),
  { recursive: true },
);
// Retained flag supplies the complete skill inventory to credential-free checks.
if (process.argv.includes("--launchpad")) {
  for (const path of [".claude/skills", "ERA Notes/Model-Registry.md", "ERA Notes/01 - Architecture/Feature Map"])
    cpSync(join(source, path), join(root, path), { recursive: true });
}
const pm = join(root, "ERA Notes/10 - Project Management");
mkdirSync(join(pm, "Budget"), { recursive: true });
const book = "Budget/Budget — Master Book.md",
  checklist = "Budget/4 - Checklist.md";
writeFileSync(
  join(pm, checklist),
  "# Checklist\n\n## Now\n- [ ] **BUD-1** Verify cockpit fixture — [criteria](<Budget — Master Book.md#bud-1>) _(friction - M)_\n\n## Next\n\n## Later\n",
);
writeFileSync(
  join(pm, book),
  "# Budget\n\n## Acceptance Criteria Index\n### BUD-1\n**Outcome:** Verify cockpit fixture.\n**Touches:** `README.md`\n- **Acceptance:** The fixture completes.\n\n## Shipped Log\n",
);
writeFileSync(join(pm, "0 - Inbox.md"), "# Inbox\n\n## New\n");
writeFileSync(
  join(pm, "_index.md"),
  "# Fixture\n\n[Budget](<Budget/4 - Checklist.md>)\n",
);
writeFileSync(
  join(pm, "Budget/1 - Example.md"),
  "---\ntitle: Example\n---\n# Example\n\n- [ ] Editable checkbox\n\n```md\n- [ ] Fenced example\n```\n",
);
writeFileSync(join(pm, "Budget/2 - Another.md"), "# Another\n");
writeFileSync(join(root, "README.md"), "A5 fixture\n");
writeFileSync(
  join(root, ".gitignore"),
  "node_modules/\n.pm/\n.delivery/\n.os/\n",
);
for (const args of [
  ["init", "--quiet"],
  ["add", "README.md", "CLAUDE.md", "ERA Notes", ".gitignore"],
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
    "--quiet",
    "-m",
    "A5 fixture",
  ],
]) {
  const r = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status) throw Error(r.stderr);
}
const store = openStore(root);
for (let i = 0; i < 2; i++) {
  const session = {
    schema: "os/session@1",
    id: `fixture-${i}`,
    agent: i ? "codex" : "claude",
    itemId: "BUD-1",
    tier: i ? "CODEX_MID" : "CLAUDE_MID",
    effort: "medium",
    startedAt: `2026-11-0${i + 1}T10:00:00Z`,
    endedAt: `2026-11-0${i + 1}T10:04:00Z`,
    coverage: "transcript",
    skills: [],
    reads: [],
    timeline: [{ id: "edit", tool: "Edit", edit: true, target: "README.md" }],
    usage: { input_tokens: 10, output_tokens: 5 },
    turns: 1,
    outcome: "unrecorded",
    setup: {
      fingerprint: `sha256:${i ? "b" : "a"}`.padEnd(71, "1"),
      counts: { rule: 29, skill: i ? 0 : 1 },
    },
  };
  const verdict = {
    schema: "os/verdict@1",
    rule: "HR-22",
    verdict: i ? "pass" : "fail",
    added: i ? 0 : 1,
    removed: 0,
    findings: [
      {
        file: "src/example.ts",
        line: 7,
        excerpt: "recorded failing line",
        message: "Fixture finding",
      },
    ],
  };
  const record = { session, events: [], checks: [], verdicts: [verdict] };
  // A7 UI evidence only. These are explicitly synthetic, never acceptance runs.
  if (process.argv.includes("--arena")) {
    const spec = JSON.parse(readFileSync(join(source, "scripts/os/cases/kit11.json"), "utf8"));
    session.id = `arena-browser-fixture-${i}`;
    session.base = spec.start;
    session.head = (i ? "b" : "c").repeat(40);
    session.setup.fingerprint = "sha256:browser-fixture";
    session.arena = { caseId: spec.id, caseFingerprint: "sha256:browser-fixture", start: spec.start,
      oracleHash: spec.oracleHash, oracleVerdict: i ? "pass" : "fail", isolation: "protected" };
  }
  store.put({
    ...record,
    session: { ...session, scorecard: sessionScorecard(record) },
  });
}
store.close();
const driver = `import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {createFakeDriver} from './delivery/drivers/fake.mjs';
import {advanceSession,defaultFakeScript} from './delivery/run-session.mjs';
export const validation=async()=>({ok:true,results:{typecheck:{ok:true,ms:1,excerpt:'fixture'},lint:{ok:true,ms:1,excerpt:'fixture'},test:{ok:true,ms:1,excerpt:'fixture'}}});
const drivers=new Map();
export function runFake(ctx,id){setTimeout(async()=>{try{
const sessionDir=join(ctx.SESSIONS_DIR,id),packet=JSON.parse(readFileSync(join(sessionDir,'packet.json'),'utf8'));
if(!drivers.has(id)){const script=defaultFakeScript(packet),uat=JSON.parse(script.turns.at(-1).finalText);uat.acceptanceCriteria[0].evidence='tests';script.turns.at(-1).finalText=JSON.stringify(uat);drivers.set(id,createFakeDriver({script}));}
for(let i=0;i<40;i++) {const tick=await advanceSession({sessionDir,repoRoot:ctx.ROOT,driver:drivers.get(id),runValidation:validation,retryDelayMs:0,sleep:()=>{},takeSnapshot:()=>({status:'',head:packet.workspace.baseHead,refs:'fixture',indexDiff:'',trackedDiff:'',fingerprints:{}}),readHead:()=>packet.workspace.baseHead});if(!tick.didWork)break;}
}catch(error){console.error('FAKE FIXTURE',error);}},0);}
`;
writeFileSync(join(root, "scripts/a5-fixture-driver.mjs"), driver);
const serverPath = join(root, "scripts/pm-server.mjs");
let server = readFileSync(serverPath, "utf8");
server =
  "import {runFake,validation} from './a5-fixture-driver.mjs';\n" +
  server.replace(
    "createDeliveryContext({ ROOT, PM_DIR, PM_REL })",
    "createDeliveryContext({ ROOT, PM_DIR, PM_REL, spawnRunner: runFake, runValidation: validation, gitStatusPorcelain: () => '', gitRevParseHead: () => 'fixture-head' })",
  );
writeFileSync(serverPath, server);
const env = {
  PM_DRIVE_PUBLISH: "0",
  PM_DRIVE_DIR: join(root, "fixture-drive-disabled"),
  SystemRoot: process.env.SystemRoot,
  PATH: process.env.PATH,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  USERPROFILE: process.env.USERPROFILE,
  APPDATA: process.env.APPDATA,
  LOCALAPPDATA: process.env.LOCALAPPDATA,
};
const child = spawn(
  process.execPath,
  [serverPath, "--no-open", "--no-bridge", "--port=4397"],
  { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
writeFileSync(
  join(source, ".pm/a5-evidence/fixture.json"),
  JSON.stringify({ root, pid: child.pid, url: "http://127.0.0.1:4397" }),
);
process.stdout.write(`Fixture root: ${root}\n`);
process.on("SIGINT", () => {
  child.kill();
  process.exit(0);
});
await new Promise((resolve) => child.on("exit", resolve));
