// DLV-164 / DLV-165. Replay-only: no provider is contacted. SDKs are fakes and
// the worker process is a fixture that uses the real stdin/stdout channel.
import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { normalizeAnswers, normalizeMessage, normalizeQuestion, projectQuestions, readLedger, resumePrompt } from "../../scripts/delivery-v2/local-questions.mjs";
import { ASK_TOOL, BACKEND_ID as CLAUDE, PARK_MESSAGE, buildSessionOptions, createClaudeAdapter, withOwnerQuestions } from "../../scripts/delivery-v2/adapters/claude.mjs";
import { BACKEND_ID as CODEX, createCodexAdapter } from "../../scripts/delivery-v2/adapters/codex.mjs";
import { makeExecutionRef, makeJobRequest } from "../../scripts/delivery-v2/adapters/adapter.mjs";
import { ownerChannel } from "../../scripts/delivery-v2/local-worker-channel.mjs";
import { nativeLocalSession } from "../../scripts/delivery-v2/local-process.mjs";
import { ASK_OWNER_ACK, handleAskMessage } from "../../scripts/delivery-v2/local-ask-mcp.mjs";

const sample = {
  question: "Which store should hold drafts?",
  header: "Storage",
  multiSelect: false,
  options: [
    { label: "IndexedDB (Recommended)", description: "Matches the offline queue." },
    { label: "localStorage", description: "Simpler, size-limited.", preview: "localStorage.setItem(...)" },
  ],
};
const temp = () => mkdtempSync(join(tmpdir(), "era-ask-"));
const job = (root: string, backend_id: string, job_id = "job-1") => makeJobRequest({ job_id, run_id: "run-1", backend_id, instruction: "Do the work",
  contract: { contract_id: "c", revision: 1 }, grant: { grant_id: "g", revision: 1 }, reservation: { unit: "tokens", basis: "fixture" },
  workspace: { root, access: "write", backing: "git-worktree" } });

describe("DLV-164 question shape and ledger", () => {
  it("keeps the tool fields and refuses malformed questions with a reason", () => {
    expect(normalizeQuestion({ id: "toolu_1", questions: [{ ...sample, extra: true }] })).toEqual({
      ok: true, question: { id: "toolu_1", questions: [{ question: sample.question, header: "Storage", multiSelect: false, options: [
        { label: "IndexedDB (Recommended)", description: "Matches the offline queue." },
        { label: "localStorage", description: "Simpler, size-limited.", preview: "localStorage.setItem(...)" },
      ] }] },
    });
    expect(normalizeQuestion({ id: "x", questions: [] })).toMatchObject({ ok: false });
    expect(normalizeQuestion({ id: "x", questions: [{ ...sample, options: sample.options.slice(0, 1) }] })).toMatchObject({ ok: false, reason: expect.stringContaining("two to four") });
    expect(normalizeQuestion({ id: "x", questions: [sample, sample] })).toMatchObject({ ok: false, reason: expect.stringContaining("distinct") });
    expect(normalizeQuestion({ id: "../bad", questions: [sample] })).toMatchObject({ ok: false });
  });
  it("requires one owner answer per question and a bounded message", () => {
    const entry = normalizeQuestion({ id: "q", questions: [sample] }).question!;
    expect(normalizeAnswers(entry, { [sample.question]: " IndexedDB " })).toEqual({ ok: true, answers: { [sample.question]: "IndexedDB" } });
    expect(normalizeAnswers(entry, {})).toMatchObject({ ok: false, reason: "answer-every-question" });
    expect(normalizeAnswers(entry, { [sample.question]: "a", other: "b" })).toMatchObject({ ok: false, reason: "unknown-question-text" });
    expect(normalizeMessage("  use IndexedDB ")).toEqual({ ok: true, text: "use IndexedDB" });
    expect(normalizeMessage(" ")).toMatchObject({ ok: false });
  });
  it("opens a question only while answerable and reads phase-1 array ledgers", () => {
    const entries = [{ id: "a", answers: null, closed_at: null }, { id: "b", answers: { q: "x" } }, { id: "c", answers: null, closed_at: "t" }];
    const states = (answerable: boolean) => projectQuestions(entries, answerable).map((entry: { state: string }) => entry.state);
    expect(states(true)).toEqual(["open", "answered", "closed"]);
    expect(states(false)).toEqual(["closed", "answered", "closed"]);
    const dir = temp();
    try {
      writeFileSync(join(dir, "old.json"), JSON.stringify([{ id: "a" }]));
      expect(readLedger(join(dir, "old.json"))).toEqual({ questions: [{ id: "a" }], messages: [] });
      expect(readLedger(join(dir, "missing.json"))).toEqual({ questions: [], messages: [] });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("words the resume prompt from answers, then messages", () => {
    const entry = { ...normalizeQuestion({ id: "q", questions: [sample] }).question!, answers: { [sample.question]: "IndexedDB" } };
    const prompt = resumePrompt({ answered: [entry], messages: [{ text: "Keep it small." }] });
    expect(prompt).toBe(`The owner answered your question:\n- ${sample.question}\n  Answer: IndexedDB\n\nMessage from the owner:\nKeep it small.\n\nContinue the task.`);
  });
});

describe("DLV-164/165 Claude adapter", () => {
  it("advertises AskUserQuestion and message hooks only for a Local build", () => {
    const ask = async () => ({ park: true });
    const inbox = () => null;
    const dir = temp();
    try {
      const local = buildSessionOptions({ workspaceRoot: dir, local: true, ask, inbox });
      expect(local.tools).toContain(ASK_TOOL);
      expect(Object.keys(local.hooks)).toEqual(expect.arrayContaining(["PostToolUse", "Stop"]));
      expect(buildSessionOptions({ workspaceRoot: dir, local: true }).tools).not.toContain(ASK_TOOL);
      expect(buildSessionOptions({ workspaceRoot: dir, local: false, ask, inbox }).tools).not.toContain(ASK_TOOL);
      const review = buildSessionOptions({ workspaceRoot: dir, local: true, mode: "review", ask, inbox });
      expect(review.tools).not.toContain(ASK_TOOL);
      expect(review.hooks).toBeUndefined();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("parks on a recorded question and leaves every other tool to the base screen", async () => {
    const seen: string[] = [];
    const base = async (tool: string) => { seen.push(tool); return { behavior: "deny" as const, message: "base" }; };
    const input = { questions: [sample] };
    expect(await withOwnerQuestions(base, async () => ({ park: true }))(ASK_TOOL, input, {})).toEqual({ behavior: "deny", message: PARK_MESSAGE, interrupt: true });
    expect(await withOwnerQuestions(base, async () => ({ answers: { [sample.question]: "IndexedDB" } }))(ASK_TOOL, input, {}))
      .toEqual({ behavior: "allow", updatedInput: { questions: [sample], answers: { [sample.question]: "IndexedDB" } } });
    expect(await withOwnerQuestions(base, async () => ({ refused: "Fix it." }))(ASK_TOOL, input, {})).toEqual({ behavior: "deny", message: "Fix it." });
    expect(await withOwnerQuestions(base, async () => { throw new Error("pipe closed"); })(ASK_TOOL, input, {})).toMatchObject({ behavior: "deny", message: expect.stringContaining("pipe closed") });
    expect(await withOwnerQuestions(base, async () => ({ park: true }))("Read", { file_path: "x" }, {})).toEqual({ behavior: "deny", message: "base" });
    expect(seen).toEqual(["Read"]);
  });
  it("delivers owner messages after a tool call and keeps a stopping session going", async () => {
    const queue = ["Message from the owner:\nUse IndexedDB."];
    const options = buildSessionOptions({ workspaceRoot: temp(), local: true, inbox: () => queue.shift() ?? null });
    const post = options.hooks.PostToolUse[0].hooks[0], stop = options.hooks.Stop[0].hooks[0];
    expect(await post({}, undefined, {})).toEqual({ continue: true, hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "Message from the owner:\nUse IndexedDB." } });
    expect(await post({}, undefined, {})).toEqual({ continue: true });
    queue.push("Message from the owner:\nAlso add a test.");
    expect(await stop({}, undefined, {})).toEqual({ decision: "block", reason: "Message from the owner:\nAlso add a test." });
    expect(await stop({}, undefined, {})).toEqual({ continue: true });
  });
  it("ends a parked dispatch at the interrupted turn's result and resumes the same session", async () => {
    const dir = temp();
    const calls: Record<string, unknown>[] = [];
    let decision: unknown = null;
    type Options = { resume?: string; canUseTool: (tool: string, input: unknown, context: unknown) => Promise<unknown> };
    const sdk = { query: ({ options }: { options: Options }) => (async function* () {
      calls.push(options);
      yield { type: "system", subtype: "init", model: "fixture-model" };
      if (!options.resume) decision = await options.canUseTool(ASK_TOOL, { questions: [sample] }, { toolUseID: "toolu_9", signal: new AbortController().signal });
      yield { type: "result", subtype: options.resume ? "success" : "error_during_execution", is_error: !options.resume, usage: { input_tokens: 3, output_tokens: 1 } };
      yield { type: "assistant", message: { content: [{ type: "text", text: "must not be read after parking" }] } };
    })() };
    try {
      const adapter = createClaudeAdapter({ importSdk: async () => sdk, local: true });
      const asked: unknown[] = [];
      const parked = await adapter.start(job(dir, CLAUDE), { askOwner: async (input: unknown, context: { id?: string }) => { asked.push([input, context.id]); return { park: true, id: context.id }; } });
      expect(decision).toEqual({ behavior: "deny", message: PARK_MESSAGE, interrupt: true });
      expect(asked).toEqual([[{ questions: [sample] }, "toolu_9"]]);
      expect(parked).toMatchObject({ status: "finished", observations: { nativeOutcome: "parked", parked: { id: "toolu_9" }, failure: null, finalText: "" } });
      const native = parked.executionRef.native_ref!;
      const resumed = await adapter.resume(makeExecutionRef({ backend_id: CLAUDE, dispatch_key: "job-1", native_ref: native }), job(dir, CLAUDE, "job-1:r1"), {});
      expect(calls[1]).toMatchObject({ resume: native });
      expect(resumed).toMatchObject({ status: "finished", observations: { nativeOutcome: "succeeded", parked: null } });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("DLV-165 Codex parity", () => {
  it("parks on the ask_owner tool call and stops the turn if work continues", async () => {
    const dir = temp();
    let aborted = false;
    const events = [
      { type: "thread.started", thread_id: "thread-7" },
      { type: "item.completed", item: { id: "item_2", type: "mcp_tool_call", server: "era_owner", tool: "ask_owner", status: "completed", arguments: { questions: [sample] } } },
      { type: "item.started", item: { id: "item_3", type: "command_execution", command: "ls" } },
      { type: "item.completed", item: { id: "item_4", type: "agent_message", text: "must not be read" } },
    ];
    const sdk = { Codex: class { startThread() { return { runStreamed: async (_text: string, { signal }: { signal: AbortSignal }) => {
      signal.addEventListener("abort", () => { aborted = true; });
      return { events: (async function* () { for (const event of events) yield event; })() };
    } }; } } };
    try {
      const asked: unknown[] = [];
      const result = await createCodexAdapter({ importSdk: async () => sdk }).start(job(dir, CODEX), {
        askOwner: async (input: unknown) => { asked.push(input); return { park: true, id: "q-1" }; },
      });
      expect(asked).toEqual([{ questions: [sample] }]);
      expect(aborted).toBe(true);
      expect(result).toMatchObject({ status: "finished", executionRef: { native_ref: "thread-7" }, observations: { nativeOutcome: "parked", parked: { id: "q-1" }, finalText: "" } });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("serves ask_owner over MCP: lists it, acknowledges a valid call, refuses a malformed one", () => {
    expect(handleAskMessage({ id: 1, method: "initialize", params: {} })).toMatchObject({ result: { capabilities: { tools: {} } } });
    expect(handleAskMessage({ id: 2, method: "tools/list" })?.result.tools.map((tool: { name: string }) => tool.name)).toEqual(["ask_owner"]);
    expect(handleAskMessage({ id: 3, method: "tools/call", params: { name: "ask_owner", arguments: { questions: [sample] } } }))
      .toMatchObject({ result: { isError: false, content: [{ text: ASK_OWNER_ACK }] } });
    expect(handleAskMessage({ id: 4, method: "tools/call", params: { name: "ask_owner", arguments: { questions: [{ ...sample, options: [] }] } } }))
      .toMatchObject({ result: { isError: true, content: [{ text: expect.stringContaining("two to four") }] } });
    expect(handleAskMessage({ method: "notifications/initialized" })).toBeNull();
  });
});

describe("DLV-164/165 worker channel", () => {
  it("validates and relays a question, then parks without waiting", async () => {
    const input = new PassThrough(), written: string[] = [];
    const channel = ownerChannel({ input, write: (line: string, done?: () => void) => { written.push(line); done?.(); } });
    input.write(JSON.stringify({ job: 1 }) + "\n");
    expect(JSON.parse(await channel.request)).toEqual({ job: 1 });
    expect(await channel.askOwner({ questions: [{ ...sample, options: [] }] }, { id: "toolu_0" })).toMatchObject({ refused: expect.stringContaining("two to four") });
    expect(written).toEqual([]);
    expect(await channel.askOwner({ questions: [sample] }, { id: "toolu_1" })).toEqual({ park: true, id: "toolu_1" });
    expect(JSON.parse(written[0])).toMatchObject({ type: "question", value: { id: "toolu_1", questions: [{ question: sample.question }] } });
  });
  it("queues owner messages once and reports them delivered when taken", async () => {
    const input = new PassThrough(), written: string[] = [];
    const channel = ownerChannel({ input, write: (line: string) => { written.push(line); } });
    input.write("{}\n");
    await channel.request;
    expect(channel.takeMessages()).toBeNull();
    input.write(JSON.stringify({ type: "message", id: "m1", text: "Use IndexedDB." }) + "\n");
    input.write(JSON.stringify({ type: "message", id: "m1", text: "Use IndexedDB." }) + "\n");
    input.write(JSON.stringify({ type: "message", id: "m2", text: "Add a test." }) + "\n");
    await new Promise(resolve => setImmediate(resolve));
    expect(channel.takeMessages()).toBe("Messages from the owner:\nUse IndexedDB.\n\nAdd a test.");
    expect(written.map(line => JSON.parse(line))).toEqual([{ type: "delivered", ids: ["m1", "m2"] }]);
    expect(channel.takeMessages()).toBeNull();
  });
  it("round-trips a parked question and a live message through a real worker process", async () => {
    const dir = temp();
    const worker = fileURLToPath(new URL("./fixtures/local-question-worker.mjs", import.meta.url));
    try {
      const asked: unknown[] = [];
      const parked = await nativeLocalSession({ request: { workspace: { root: dir }, mode: "ask", questions: [sample] } as never,
        env: { ...process.env }, signal: new AbortController().signal, worker, onQuestion: (value: unknown) => asked.push(value) });
      expect(asked).toMatchObject([{ id: "toolu_fixture", questions: [{ question: sample.question }] }]);
      expect(parked).toMatchObject({ observations: { nativeOutcome: "parked", parked: { id: "toolu_fixture" } } });
      const delivered: string[][] = [];
      const listened = await nativeLocalSession({ request: { workspace: { root: dir }, mode: "listen" } as never,
        env: { ...process.env }, signal: new AbortController().signal, worker,
        onChannel: (send: (message: unknown) => boolean) => { expect(send({ type: "message", id: "m1", text: "Use IndexedDB." })).toBe(true); },
        onDelivered: (ids: string[]) => delivered.push(ids) });
      expect(delivered).toEqual([["m1"]]);
      expect(listened).toMatchObject({ observations: { delivered: "Message from the owner:\nUse IndexedDB." } });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 30_000);
});
