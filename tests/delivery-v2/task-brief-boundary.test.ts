import { describe, expect, it } from "vitest";
import { sdkFromRunnerStream } from "../../scripts/delivery-v2/worker-boundary.mjs";
import { withTaskBriefRead, installTaskBrief } from "../../scripts/delivery-v2/worker/task-brief.mjs";
import { fingerprint } from "../../scripts/delivery-v2/contracts.mjs";

describe("task brief crosses both native SDK bridges without provider calls", () => {
  const text = JSON.stringify({ outcome: "correct label", guidance: { advisory: true, text: "Inspect renderLabel" } });
  const digest = fingerprint(text);
  const brief = { text, digest, path: "/tmp/era-task-brief-" + digest.replace(/[^a-z0-9]/gi, "") + ".json" };
  it.each(["claude-agent-sdk", "codex-exec-sdk"])("preserves instruction, brief and continuity for %s", async backend => {
    const received: object[] = [];
    const sdk = sdkFromRunnerStream(backend, async function* (payload: object) { received.push(payload); yield { era: "runner-finished" }; }, brief);
    if (sdk.query) {
      for await (const record of sdk.query({ prompt: "Implement from the brief", options: { resume: "same-thread", cwd: "/work" } })) { expect(record).toBeDefined(); }
      expect(received[0]).toMatchObject({ options: { resume: "same-thread" } });
    } else if (sdk.Codex) {
      const thread = new sdk.Codex().resumeThread("same-thread", { workingDirectory: "/work" });
      for await (const record of (await thread.runStreamed("Implement from the brief")).events) { expect(record).toBeDefined(); }
      expect(received[0]).toMatchObject({ threadId: "same-thread" });
    }
    expect(received[0]).toMatchObject({ prompt: "Implement from the brief", taskBrief: brief });
  });
  it("allows only an exact Read of the supplied input, delegating every other permission", async () => {
    const calls: string[] = [];
    const guard = withTaskBriefRead((tool: string) => { calls.push(tool); return { behavior: "deny" }; }, brief.path);
    expect(await guard("Read", { file_path: brief.path }, {})).toMatchObject({ behavior: "allow" });
    for (const tool of ["Edit", "Write", "Bash"]) expect(await guard(tool, { file_path: brief.path }, {})).toMatchObject({ behavior: "deny" });
    expect(await guard("Read", { file_path: "/tmp/other.json" }, {})).toMatchObject({ behavior: "deny" });
    expect(calls).toEqual(["Edit", "Write", "Bash", "Read"]);
  });
  it("rejects corrupt or relocated recovery input before writing anything", () => {
    expect(() => installTaskBrief({ ...brief, digest: "changed" })).toThrow("identity mismatch");
    expect(() => installTaskBrief({ ...brief, path: "/work/replace-source.ts" })).toThrow("identity mismatch");
  });
});
